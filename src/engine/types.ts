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
  /** 相手について事前に知っていること(顔見知り場面用)。選択の前提として画面に表示する */
  partnerNote?: string;
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

// 複数正解設計: ◎と○は優劣ではなく「特に効く/これもあり」。避けるべきは✕だけ
export const QUALITY_LABELS: Record<Quality, string> = {
  best: '◎ 効く一手',
  ok: '○ これもあり',
  ng: '✕ 地雷',
};

export const MOOD_LABELS: Record<Mood, string> = {
  good: 'いい雰囲気で終了',
  neutral: '無難に終了',
  awkward: '気まずい終了',
};

export const MOOD_EMOJI: Record<Mood, string> = {
  good: '😊',
  neutral: '🙂',
  awkward: '😅',
};

/** テーマ別のアイコンとアクセント色(ホーム・プレイ画面の視覚的な手がかり) */
export const TOPIC_STYLES: Record<string, { emoji: string; chip: string; border: string }> = {
  '天気・季節': { emoji: '🌤️', chip: 'bg-sky-600', border: 'border-l-sky-400' },
  '道楽': { emoji: '🎣', chip: 'bg-emerald-600', border: 'border-l-emerald-400' },
  'ニュース': { emoji: '📰', chip: 'bg-slate-600', border: 'border-l-slate-400' },
  '旅': { emoji: '🧳', chip: 'bg-amber-600', border: 'border-l-amber-400' },
  '家族': { emoji: '🏠', chip: 'bg-rose-600', border: 'border-l-rose-400' },
  '健康': { emoji: '💪', chip: 'bg-lime-600', border: 'border-l-lime-400' },
  '仕事': { emoji: '💼', chip: 'bg-indigo-600', border: 'border-l-indigo-400' },
  '衣': { emoji: '👕', chip: 'bg-violet-600', border: 'border-l-violet-400' },
  '食': { emoji: '🍜', chip: 'bg-orange-600', border: 'border-l-orange-400' },
  '住': { emoji: '🏘️', chip: 'bg-teal-600', border: 'border-l-teal-400' },
};

export const DEFAULT_TOPIC_STYLE = { emoji: '💬', chip: 'bg-slate-800', border: 'border-l-slate-400' };

export function topicStyle(topic: string) {
  return TOPIC_STYLES[topic] ?? DEFAULT_TOPIC_STYLE;
}

/** 相手アバター(場面ごと) */
export const SCENE_AVATARS: Record<Scene, string> = {
  first_formal: '🧑‍💼',
  first_casual: '🙂',
  senior_known: '👔',
};
