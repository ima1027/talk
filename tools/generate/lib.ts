// コンテンツ増産パイプラインの中核ロジック(API呼び出しから分離してテスト可能にする)
// docs/requirements.md §8 に対応する。

import type { Scenario, Scene } from '../../src/engine/types';
import { validateScenario } from '../../src/engine/validate';

export const SCENE_DESCRIPTIONS: Record<Scene, string> = {
  first_formal: '初対面・フォーマル(仕事の顔合わせ、取引先との待ち時間など。敬語)',
  first_casual: '初対面・カジュアル(友人の紹介、イベント、飲み会など。丁寧だが柔らかい話し言葉)',
  senior_known: '顔見知りの目上・気を遣う相手(別部署の上司、義家族、習い事の先生など。敬語)',
};

/** 制作ルール。docs/requirements.md §3.4, §5.2, §5.3 を生成用に凝縮したもの */
export function buildSystemPrompt(): string {
  return `あなたは「雑談シミュレーションツール」の会話ツリー作家です。雑談が苦手な人が、失敗しても安全な環境で会話パターンを反復練習するための分岐シナリオ(JSON)を執筆します。

# データ形式
出力は次のTypeScript型に適合するJSONオブジェクト1個のみ:

- Scenario: { id, topic, scene, title, situation, guide, entry, nodes }
- nodes は id→ノードのオブジェクト。ノードは3種:
  - player_choice: { type:"player_choice", prompt?, closing?, choices:[{ text, quality:"best"|"ok"|"ng", techniques?:string[], explanation, next }] }
  - partner_response: { type:"partner_response", branches:[{ category:"expand"|"counter"|"short"|"flat", weight:正数, text, next }] }
  - end: { type:"end", text, mood:"good"|"neutral"|"awkward" }
- 遷移規則: player_choice の next は partner_response か end。partner_response の next は player_choice か end。閉路(ループ)禁止。全ノード到達可能。

# 返答カテゴリ(会話分析の知見に基づく)
- expand=肯定して広がる(即座・直接+追加情報。一問二答型)
- counter=質問返し・褒め返し(こちらにボールが返る)
- short=短く終わる(整列するが最小限)
- flat=そっけない(間・最小化・言い訳の目印を付けて書く)
最初の分岐点では4カテゴリすべてを出すこと。flatの出現重みは全体の1〜2割目安。

# 必須要件(自動検証される)
1. 全終端は end ノード。そこに至る直前に closing:true の player_choice(きれいな切り上げの練習)を必ず通る
2. 4カテゴリのうち3つ以上が登場し、flat への撤退練習を必ず含む
3. NG選択肢(quality:"ng")を2箇所以上。次の5類型から作る: ①曖昧質問(〜どうでした?) ②プレッシャー質問(ご趣味は?) ③話の腰を折る ④踏み込みすぎ(値段・年収・家族構成) ⑤タブー直撃(政治・宗教・ひいき球団・容姿・学歴)
4. NGを選んだら即終了にせず、気まずい相手反応→リカバリの選択肢(立て直しの練習)につなげる
5. 全選択肢に explanation(2〜3文。「なぜ良い/まずいか」+「使い回せる原則」)。best/ok には techniques タグ
6. 選択肢 text は全角45字以内(30字目安)。closing以外の選択ポイントは2択以上
7. 深さは3〜5往復+クロージング(実時間30〜60秒の雑談に相当)。ノードの合流を使いパターン爆発を防ぐ

# 技法タグ(この既存セットから優先的に使う)
褒め / 褒め+質問 / 感想+質問 / 共感・受け止め / オウム返し / 相手の話題を拾う / “ない”から拾う / きっかけを聞く / 教わる姿勢 / 一問二答 / 自己開示 / 情報のギブ / 答えやすい質問 / ハマってるもの型 / 季節の体感 / 場の共通話題 / 小さな提案 / 次につなげる / 切り上げ / 撤退・話題転換 / 話題を戻す / リカバリ / ハードルを下げる / 角度を変える / ねぎらい

# 文体
- 相手の発話はカテゴリの性格が伝わるように(expandは長め、flatは極端に短く「……」等)
- 場面に応じた敬語レベルを守る。解説は学習者への語りかけ(です・だ調どちらでも一貫させる)
- シミュレーションの目的は「面白いことを言う」ではなく「会話のパスを回して気持ちよく終える」こと

# 出力
JSONのみを出力する。コードフェンスや説明文は不要。`;
}

export interface GenerateRequest {
  topic: string;
  scene: Scene;
  situation?: string;
  existingIds: string[];
  /** 手本として同梱する既存シナリオのJSON文字列 */
  exampleJson: string;
}

export function buildUserPrompt(req: GenerateRequest): string {
  const situationLine = req.situation
    ? `状況設定: ${req.situation}`
    : '状況設定: テーマと場面に合う自然な状況をあなたが設定する';
  return `次の条件で会話ツリーを1本執筆してください。

- topic: ${req.topic}
- scene: ${req.scene} — ${SCENE_DESCRIPTIONS[req.scene]}
- ${situationLine}
- id は "<英小文字テーマ名>-${req.scene}-NN" 形式で、次の既存IDと重複しないこと: ${req.existingIds.join(', ')}

# 手本(既存シナリオ。構造・粒度・解説の書き方の基準)
${req.exampleJson}`;
}

/** モデル出力からJSONオブジェクトを取り出す(コードフェンスや前置きに耐性を持たせる) */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('出力からJSONオブジェクトが見つからない');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** 生成物への追加チェック(バリデータ本体に含まれない生成固有の検査) */
export function validateGenerated(raw: unknown, req: GenerateRequest): string[] {
  const errors = validateScenario(raw);
  const s = raw as Partial<Scenario>;
  if (s.topic !== req.topic) errors.push(`topic が指定と違う: ${String(s.topic)} (期待: ${req.topic})`);
  if (s.scene !== req.scene) errors.push(`scene が指定と違う: ${String(s.scene)} (期待: ${req.scene})`);
  if (s.id && req.existingIds.includes(s.id)) errors.push(`id が既存と重複: ${s.id}`);
  return errors;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface GenerateResult {
  scenario: Scenario;
  attempts: number;
}

/**
 * 生成→検証→エラーフィードバックのリトライループ。
 * send はチャット履歴を受け取りアシスタントの本文を返す(テストではモックを注入)。
 */
export async function generateWithRetries(
  send: (messages: ChatMessage[]) => Promise<string>,
  req: GenerateRequest,
  maxAttempts = 3,
): Promise<GenerateResult> {
  const messages: ChatMessage[] = [{ role: 'user', content: buildUserPrompt(req) }];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reply = await send(messages);
    messages.push({ role: 'assistant', content: reply });

    let parsed: unknown;
    try {
      parsed = extractJson(reply);
    } catch (e) {
      lastErrors = [`JSONとして解釈できない: ${(e as Error).message}`];
      messages.push({
        role: 'user',
        content: '出力をJSONとして解釈できませんでした。説明文やコードフェンスなしで、JSONオブジェクトのみを出力し直してください。',
      });
      continue;
    }

    lastErrors = validateGenerated(parsed, req);
    if (lastErrors.length === 0) {
      return { scenario: parsed as Scenario, attempts: attempt };
    }
    messages.push({
      role: 'user',
      content: `自動検証で以下のエラーが出ました。すべて修正した完全なJSONを出力し直してください。\n- ${lastErrors.join('\n- ')}`,
    });
  }

  throw new Error(`生成が${maxAttempts}回の試行で検証を通りませんでした。最後のエラー:\n- ${lastErrors.join('\n- ')}`);
}

/** 人の監修用チェックリスト(docs/requirements.md §5.2/§5.3/§8.3) */
export const REVIEW_CHECKLIST = `人の監修チェックリスト(通ったら promote で昇格):
  [ ] 会話が日本語として自然(機械っぽい言い回し・不自然な敬語がない)
  [ ] 場面×話題の適合マトリクス(requirements 付録A)に反していない
  [ ] NG選択肢が「わざとらしすぎない、やりがちな失敗」になっている
  [ ] 解説が原則として使い回せる形で書かれている
  [ ] 相手の返答がカテゴリの性格(expand=広がる/flat=そっけない)を体現している
  [ ] 既存ツリーと状況・フレーズが被りすぎていない`;
