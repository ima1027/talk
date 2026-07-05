// コンテンツデータの型定義。docs/requirements.md §3.4, §6 に対応する。

export type Scene = 'first_formal' | 'first_casual' | 'senior_known';

export type Quality = 'best' | 'ok' | 'ng';

/** 相手の返答カテゴリ(§3.4)。会話分析の preferred/dispreferred に対応づけている */
export type Category = 'expand' | 'counter' | 'short' | 'flat';

export type Mood = 'good' | 'neutral' | 'awkward';

export interface Choice {
  text: string;
  quality: Quality;
  techniques?: string[];
  explanation: string;
  /** 遷移先。partner_response か end ノードを指す */
  next: string;
}

export interface PlayerChoiceNode {
  type: 'player_choice';
  /** 選択肢の上に出す状況の補足(任意) */
  prompt?: string;
  /** クロージング(切り上げ)の選択ポイントか */
  closing?: boolean;
  choices: Choice[];
}

export interface Branch {
  category: Category;
  /** 練習モードでの出現重み(正の数) */
  weight: number;
  text: string;
  /** 遷移先。player_choice か end ノードを指す */
  next: string;
}

export interface PartnerResponseNode {
  type: 'partner_response';
  branches: Branch[];
}

export interface EndNode {
  type: 'end';
  /** 会話がどう終わったかのナレーション */
  text: string;
  mood: Mood;
}

export type ScenarioNode = PlayerChoiceNode | PartnerResponseNode | EndNode;

export interface Scenario {
  id: string;
  topic: string;
  scene: Scene;
  title: string;
  situation: string;
  /** 教示: この場面で何を練習するかの1行ガイド */
  guide: string;
  entry: string;
  nodes: Record<string, ScenarioNode>;
}

export const SCENE_LABELS: Record<Scene, string> = {
  first_formal: '初対面・フォーマル',
  first_casual: '初対面・カジュアル',
  senior_known: '顔見知りの目上',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  expand: '肯定して広がる',
  counter: '質問返し・褒め返し',
  short: '短く終わる',
  flat: 'そっけない',
};

export const QUALITY_LABELS: Record<Quality, string> = {
  best: 'ベスト',
  ok: 'あり',
  ng: 'NG',
};

export const MOOD_LABELS: Record<Mood, string> = {
  good: 'いい雰囲気で終了',
  neutral: '無難に終了',
  awkward: '気まずい終了',
};
