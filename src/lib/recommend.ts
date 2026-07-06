import { dailyScenarioId } from '../engine/engine';
import type { Category, Scenario } from '../engine/types';
import { computeInsight, type HistoryEntry, type Insight } from './storage';

export interface DailyRecommendation {
  scenarioId: string;
  /** daily=日替わり / weakness=苦手カテゴリの再出題(間隔反復) */
  reason: 'daily' | 'weakness';
  insight?: Insight;
}

/** そのシナリオが指定カテゴリへの対処をどれだけ練習させるか(分岐数で近似) */
export function categoryCoverage(scenario: Scenario, category: Category): number {
  let count = 0;
  for (const node of Object.values(scenario.nodes)) {
    if (node.type !== 'partner_response') continue;
    for (const branch of node.branches) {
      if (branch.category === category) count++;
    }
  }
  return count;
}

function daysSinceLastPlay(scenarioId: string, history: HistoryEntry[], now: Date): number {
  const last = history.find((h) => h.scenarioId === scenarioId);
  if (!last) return Infinity;
  const ms = now.getTime() - new Date(last.endedAt).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * 「今日の1本」の選定。
 * 履歴から苦手な返答カテゴリが見つかれば、そのカテゴリを多く含み、
 * かつ最近やっていないシナリオを優先する(苦手の再出題)。
 * なければ日付から決定論的に選ぶ(日替わり)。同条件なら結果は決定論的。
 */
export function recommendDaily(
  scenarios: Scenario[],
  history: HistoryEntry[],
  dateKey: string,
  now: Date,
): DailyRecommendation {
  const ids = scenarios.map((s) => s.id);
  const insight = computeInsight(history);

  // opener(会話の入り)はどのシナリオでも練習できるため日替わりに任せる
  if (!insight || insight.context === 'opener') {
    return { scenarioId: dailyScenarioId(ids, dateKey), reason: 'daily', insight: insight ?? undefined };
  }

  const weak = insight.context;
  let best: { score: number; ids: string[] } = { score: -1, ids: [] };
  for (const scenario of scenarios) {
    const coverage = categoryCoverage(scenario, weak);
    const freshness = Math.min(daysSinceLastPlay(scenario.id, history, now), 7);
    const score = coverage * 10 + freshness;
    if (score > best.score) best = { score, ids: [scenario.id] };
    else if (score === best.score) best.ids.push(scenario.id);
  }

  if (best.ids.length === 0 || best.score <= 0) {
    return { scenarioId: dailyScenarioId(ids, dateKey), reason: 'daily', insight };
  }
  // 同点なら日付ハッシュで決定論的に選ぶ
  return { scenarioId: dailyScenarioId(best.ids.sort(), dateKey), reason: 'weakness', insight };
}
