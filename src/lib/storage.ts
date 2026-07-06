import type { Session } from '../engine/engine';
import type { Category, Choice, Mood, Quality, Scenario } from '../engine/types';

// localStorage が使えない環境(テスト等)ではメモリにフォールバックする
const memoryStore = new Map<string, string>();

function read(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {
    // 失敗時はメモリへ
  }
  return memoryStore.get(key) ?? null;
}

function write(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // 失敗時はメモリへ
  }
  memoryStore.set(key, value);
}

const HISTORY_KEY = 'talk.history.v1';
const ZUKAN_KEY = 'talk.zukan.v1';

// ---- 履歴 (F6) ----

/** どの返答カテゴリへの対処だったか。opener = 会話の一手目 */
export type ChoiceContext = Category | 'opener';

export interface HistoryChoice {
  context: ChoiceContext;
  quality: Quality;
}

export interface HistoryEntry {
  scenarioId: string;
  endedAt: string;
  mood: Mood;
  counts: Record<Quality, number>;
  choices: HistoryChoice[];
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = read(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function buildHistoryEntry(scenario: Scenario, session: Session, endedAt: string): HistoryEntry {
  const counts: Record<Quality, number> = { best: 0, ok: 0, ng: 0 };
  const choices: HistoryChoice[] = [];
  session.log.forEach((entry, i) => {
    if (entry.kind !== 'player') return;
    const node = scenario.nodes[entry.nodeId];
    if (node.type !== 'player_choice') return;
    const choice = node.choices[entry.choiceIndex];
    counts[choice.quality]++;
    const prev = session.log[i - 1];
    let context: ChoiceContext = 'opener';
    if (prev?.kind === 'partner') {
      const prevNode = scenario.nodes[prev.nodeId];
      if (prevNode.type === 'partner_response') context = prevNode.branches[prev.branchIndex].category;
    }
    choices.push({ context, quality: choice.quality });
  });
  const endNode = scenario.nodes[session.currentNodeId];
  return {
    scenarioId: scenario.id,
    endedAt,
    mood: endNode.type === 'end' ? endNode.mood : 'neutral',
    counts,
    choices,
  };
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const history = [entry, ...loadHistory()].slice(0, 200);
  write(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export const CONTEXT_LABELS: Record<ChoiceContext, string> = {
  opener: '会話の入り',
  expand: '「広がる返答」への対処',
  counter: '「質問返し」への対処',
  short: '「短い返事」への対処',
  flat: '「そっけない反応」への対処',
};

const INSIGHT_TIPS: Record<ChoiceContext, string> = {
  opener: '安全な入り(場の共通項・季節の体感・軽い褒め)から始めるのが定石。',
  expand: '相手が出したキーワードを拾って質問するのが定石。',
  counter: '一問二答(答え+ひとこと)で返すのが定石。',
  short: '角度を変えて、もう一手だけ試すのが定石。',
  flat: '深追いせず、撤退・話題転換に切り替えるのが定石。',
};

export interface Insight {
  context: ChoiceContext;
  ngRate: number;
  samples: number;
  message: string;
}

/** 履歴から「どの返答タイプへの対処が苦手か」を推定する(標本3以上・NG率1/3以上) */
export function computeInsight(history: HistoryEntry[]): Insight | null {
  const agg = new Map<ChoiceContext, { ng: number; total: number }>();
  for (const entry of history) {
    for (const c of entry.choices) {
      const a = agg.get(c.context) ?? { ng: 0, total: 0 };
      a.total++;
      if (c.quality === 'ng') a.ng++;
      agg.set(c.context, a);
    }
  }
  let worst: Insight | null = null;
  for (const [context, { ng, total }] of agg) {
    if (total < 3) continue;
    const rate = ng / total;
    if (rate < 1 / 3) continue;
    if (!worst || rate > worst.ngRate) {
      worst = {
        context,
        ngRate: rate,
        samples: total,
        message: `${CONTEXT_LABELS[context]}でNGが出やすいようです。${INSIGHT_TIPS[context]}`,
      };
    }
  }
  return worst;
}

// ---- パターン図鑑 (F5) ----

export interface ZukanState {
  phrases: string[];
  techniques: string[];
}

export interface ZukanItem {
  key: string;
  scenarioId: string;
  scenarioTitle: string;
  topic: string;
  choice: Choice;
}

export function phraseKey(scenarioId: string, nodeId: string, choiceIndex: number): string {
  return `${scenarioId}:${nodeId}:${choiceIndex}`;
}

/** 図鑑の全収集対象 = 技法タグを持つ選択肢(=手本フレーズ) */
export function zukanUniverse(scenarios: Scenario[]): ZukanItem[] {
  const items: ZukanItem[] = [];
  for (const scenario of scenarios) {
    for (const [nodeId, node] of Object.entries(scenario.nodes)) {
      if (node.type !== 'player_choice') continue;
      node.choices.forEach((choice, i) => {
        if (!choice.techniques || choice.techniques.length === 0) return;
        items.push({
          key: phraseKey(scenario.id, nodeId, i),
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          topic: scenario.topic,
          choice,
        });
      });
    }
  }
  return items;
}

export function loadZukan(): ZukanState {
  try {
    const raw = read(ZUKAN_KEY);
    if (raw) return JSON.parse(raw) as ZukanState;
  } catch {
    // 壊れていたら初期化
  }
  return { phrases: [], techniques: [] };
}

/** セッションで実際に選んだ手本フレーズと技法を図鑑に追加する */
export function collectFromSession(scenario: Scenario, session: Session): ZukanState {
  const state = loadZukan();
  const phrases = new Set(state.phrases);
  const techniques = new Set(state.techniques);
  for (const entry of session.log) {
    if (entry.kind !== 'player') continue;
    const node = scenario.nodes[entry.nodeId];
    if (node.type !== 'player_choice') continue;
    const choice = node.choices[entry.choiceIndex];
    if (!choice.techniques || choice.techniques.length === 0) continue;
    phrases.add(phraseKey(scenario.id, entry.nodeId, entry.choiceIndex));
    for (const t of choice.techniques) techniques.add(t);
  }
  const next: ZukanState = { phrases: [...phrases], techniques: [...techniques] };
  write(ZUKAN_KEY, JSON.stringify(next));
  return next;
}
