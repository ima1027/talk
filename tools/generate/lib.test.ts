import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  generateWithRetries,
  validateGenerated,
  type ChatMessage,
  type GenerateRequest,
} from './lib';

const exampleJson = readFileSync(
  join(import.meta.dirname, '../../src/content/scenarios/weather-first_casual-01.json'),
  'utf8',
);
const validScenario = JSON.parse(exampleJson) as Record<string, unknown>;

function makeReq(overrides: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    topic: '天気・季節',
    scene: 'first_casual',
    existingIds: ['fashion-first_casual-01'],
    exampleJson,
    ...overrides,
  };
}

describe('extractJson', () => {
  it('素のJSONを読める', () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });
  it('コードフェンス付きを読める', () => {
    expect(extractJson('説明です。\n```json\n{"a": 1}\n```\n以上。')).toEqual({ a: 1 });
  });
  it('前置き+後置きがあっても最初の{から最後の}まで読む', () => {
    expect(extractJson('はい、こちらです: {"a": {"b": 2}} 完了')).toEqual({ a: { b: 2 } });
  });
  it('JSONがなければ例外', () => {
    expect(() => extractJson('JSONはありません')).toThrow();
  });
});

describe('validateGenerated', () => {
  it('手本シナリオ自体は topic/scene が合っていれば合格', () => {
    expect(validateGenerated(validScenario, makeReq())).toEqual([]);
  });
  it('topic/scene の不一致と id 重複を検出する', () => {
    const req = makeReq({ topic: '旅', scene: 'senior_known', existingIds: [validScenario.id as string] });
    const errors = validateGenerated(validScenario, req);
    expect(errors.some((e) => e.includes('topic'))).toBe(true);
    expect(errors.some((e) => e.includes('scene'))).toBe(true);
    expect(errors.some((e) => e.includes('重複'))).toBe(true);
  });
});

describe('generateWithRetries', () => {
  it('一発で有効なJSONが返れば1試行で終わる', async () => {
    const send = async () => exampleJson;
    const result = await generateWithRetries(send, makeReq());
    expect(result.attempts).toBe(1);
    expect(result.scenario.id).toBe(validScenario.id);
  });

  it('壊れた出力にはエラーを差し戻し、直れば成功する', async () => {
    const replies = ['これはJSONではないです', exampleJson];
    let calls = 0;
    const send = async (messages: ChatMessage[]) => {
      calls++;
      if (calls === 2) {
        // 2回目の呼び出しにはエラーフィードバックが含まれている
        expect(messages.at(-1)?.content).toContain('JSONとして解釈できません');
      }
      return replies[calls - 1];
    };
    const result = await generateWithRetries(send, makeReq());
    expect(result.attempts).toBe(2);
  });

  it('検証エラーはメッセージとしてフィードバックされる', async () => {
    const broken = JSON.stringify({ ...validScenario, entry: 'missing_node' });
    let feedback = '';
    let calls = 0;
    const send = async (messages: ChatMessage[]) => {
      calls++;
      if (calls === 2) feedback = messages.at(-1)?.content ?? '';
      return calls === 1 ? broken : exampleJson;
    };
    await generateWithRetries(send, makeReq());
    expect(feedback).toContain('自動検証で以下のエラー');
    expect(feedback).toContain('missing_node');
  });

  it('最大試行回数を超えたら例外', async () => {
    const send = async () => 'だめな出力';
    await expect(generateWithRetries(send, makeReq(), 2)).rejects.toThrow('2回');
  });
});

describe('プロンプト', () => {
  it('システムプロンプトに必須要件が入っている', () => {
    const sys = buildSystemPrompt();
    for (const keyword of ['expand', 'counter', 'short', 'flat', 'closing', 'NG選択肢', 'リカバリ', '45字']) {
      expect(sys).toContain(keyword);
    }
  });
  it('ユーザープロンプトに条件と手本が入る', () => {
    const prompt = buildUserPrompt(makeReq({ situation: '駅のホームで' }));
    expect(prompt).toContain('天気・季節');
    expect(prompt).toContain('first_casual');
    expect(prompt).toContain('駅のホームで');
    expect(prompt).toContain('fashion-first_casual-01');
    expect(prompt).toContain('"entry"');
  });
});
