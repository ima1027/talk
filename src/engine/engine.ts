import type { Branch, Choice, Scenario } from './types';

/** セッションログの1エントリ。ふりかえり画面はこれを再生する */
export type LogEntry =
  | { kind: 'player'; nodeId: string; choiceIndex: number }
  | { kind: 'partner'; nodeId: string; branchIndex: number };

export interface Session {
  scenarioId: string;
  currentNodeId: string;
  log: LogEntry[];
  finished: boolean;
}

export type Rng = () => number;

export function createSession(scenario: Scenario): Session {
  return {
    scenarioId: scenario.id,
    currentNodeId: scenario.entry,
    log: [],
    finished: false,
  };
}

/** カテゴリごとの重み補正(未体験の反応タイプを出やすくする等)。省略時は1倍 */
export type CategoryBoost = (category: Branch['category']) => number;

export function pickWeighted(branches: Branch[], rng: Rng, boost?: CategoryBoost): number {
  const weights = branches.map((b) => b.weight * (boost ? boost(b.category) : 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < branches.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return branches.length - 1;
}

/**
 * プレイヤーの選択を適用し、続く partner_response を消化して
 * 次の player_choice か end で止まった新しいセッションを返す。
 */
export function applyChoice(
  scenario: Scenario,
  session: Session,
  choiceIndex: number,
  rng: Rng,
  boost?: CategoryBoost,
): Session {
  const node = scenario.nodes[session.currentNodeId];
  if (session.finished || node.type !== 'player_choice') return session;
  const choice = node.choices[choiceIndex];
  const log: LogEntry[] = [...session.log, { kind: 'player', nodeId: session.currentNodeId, choiceIndex }];

  let cursor = choice.next;
  while (scenario.nodes[cursor].type === 'partner_response') {
    const partner = scenario.nodes[cursor];
    if (partner.type !== 'partner_response') break;
    const branchIndex = pickWeighted(partner.branches, rng, boost);
    log.push({ kind: 'partner', nodeId: cursor, branchIndex });
    cursor = partner.branches[branchIndex].next;
  }

  return {
    ...session,
    currentNodeId: cursor,
    log,
    finished: scenario.nodes[cursor].type === 'end',
  };
}

/** ふりかえり用: ログからプレイヤーが選んだ Choice を取り出す */
export function chosenChoices(scenario: Scenario, session: Session): { nodeId: string; choice: Choice }[] {
  const result: { nodeId: string; choice: Choice }[] = [];
  for (const entry of session.log) {
    if (entry.kind !== 'player') continue;
    const node = scenario.nodes[entry.nodeId];
    if (node.type === 'player_choice') {
      result.push({ nodeId: entry.nodeId, choice: node.choices[entry.choiceIndex] });
    }
  }
  return result;
}

/** 表示順シャッフル用のインデックス配列(Fisher–Yates) */
export function shuffledIndices(length: number, rng: Rng): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/** 「今日の1本」: 日付文字列から決定論的にシナリオを選ぶ */
export function dailyScenarioId(scenarioIds: string[], dateKey: string): string {
  let hash = 0;
  for (const ch of dateKey) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return scenarioIds[hash % scenarioIds.length];
}
