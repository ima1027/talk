// 会話ツリーのLLMバッチ生成CLI(docs/requirements.md §8.1-8.2)。
// 使い方: npm run generate -- --topic 旅 --scene first_casual [--situation "..."] [--model claude-opus-4-8]
// 生成物は content/drafts/ に置かれ、人の監修(§8.3)を経て promote で昇格させる。

import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Scene } from '../../src/engine/types';
import {
  buildSystemPrompt,
  generateWithRetries,
  REVIEW_CHECKLIST,
  type ChatMessage,
  type GenerateRequest,
} from './lib';

const SCENARIOS_DIR = join(import.meta.dirname, '../../src/content/scenarios');
const DRAFTS_DIR = join(import.meta.dirname, '../../content/drafts');
const EXAMPLE_FILE = 'weather-first_casual-01.json';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1] ?? '';
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const topic = args.topic;
  const scene = args.scene as Scene;
  if (!topic || !['first_formal', 'first_casual', 'senior_known'].includes(scene)) {
    console.error('使い方: npm run generate -- --topic <テーマ> --scene <first_formal|first_casual|senior_known> [--situation "状況"] [--model <model-id>]');
    process.exit(1);
  }

  const existingIds = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
  const exampleJson = readFileSync(join(SCENARIOS_DIR, EXAMPLE_FILE), 'utf8');
  const req: GenerateRequest = { topic, scene, situation: args.situation, existingIds, exampleJson };

  // 認証は環境変数 ANTHROPIC_API_KEY か `ant auth login` のプロファイルで解決される
  const client = new Anthropic();
  const model = args.model ?? 'claude-opus-4-8';
  const system = buildSystemPrompt();

  const send = async (messages: ChatMessage[]): Promise<string> => {
    const stream = client.messages.stream({
      model,
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      system,
      messages,
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new Error('モデルが生成を拒否しました(stop_reason: refusal)');
    }
    return message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
  };

  console.log(`生成中: topic=${topic} scene=${scene} model=${model} ...`);
  const { scenario, attempts } = await generateWithRetries(send, req);

  mkdirSync(DRAFTS_DIR, { recursive: true });
  const outPath = join(DRAFTS_DIR, `${scenario.id}.json`);
  writeFileSync(outPath, JSON.stringify(scenario, null, 2) + '\n');

  console.log(`\n✔ 検証合格(試行${attempts}回) → ${outPath}`);
  console.log(`  タイトル: ${scenario.title}`);
  console.log(`  ノード数: ${Object.keys(scenario.nodes).length}`);
  console.log(`\n${REVIEW_CHECKLIST}`);
  console.log(`\n昇格: npm run promote -- content/drafts/${scenario.id}.json`);
}

main().catch((e) => {
  console.error(`エラー: ${(e as Error).message}`);
  if ((e as Error).message.includes('api_key') || (e as Error).message.includes('authentication')) {
    console.error('認証: ANTHROPIC_API_KEY を設定するか `ant auth login` を実行してください。');
  }
  process.exit(1);
});
