import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../content';
import { applyChoice, createSession, dailyScenarioId, pickWeighted, shuffledIndices } from './engine';
import type { Branch } from './types';

const fixedRng = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('pickWeighted', () => {
  const branches = [
    { category: 'expand', weight: 4, text: 'a', next: 'x' },
    { category: 'short', weight: 1, text: 'b', next: 'y' },
  ] as Branch[];

  it('重みに応じて選ぶ', () => {
    expect(pickWeighted(branches, () => 0.0)).toBe(0);
    expect(pickWeighted(branches, () => 0.79)).toBe(0);
    expect(pickWeighted(branches, () => 0.81)).toBe(1);
    expect(pickWeighted(branches, () => 0.999)).toBe(1);
  });
});

describe('applyChoice', () => {
  it('選択→相手の返答を消化して次の選択ポイントで止まる', () => {
    const scenario = getScenario('fashion-first_casual-01');
    let session = createSession(scenario);
    expect(session.currentNodeId).toBe('n1');

    // rng=0 → p1 の先頭ブランチ(expand)が選ばれ n2e に進む
    session = applyChoice(scenario, session, 0, fixedRng([0]));
    expect(session.currentNodeId).toBe('n2e');
    expect(session.log).toHaveLength(2);
    expect(session.log[0]).toEqual({ kind: 'player', nodeId: 'n1', choiceIndex: 0 });
    expect(session.log[1]).toEqual({ kind: 'partner', nodeId: 'p1', branchIndex: 0 });
    expect(session.finished).toBe(false);
  });

  it('どのシナリオも best 選択+先頭ブランチをたどれば end に到達する', () => {
    for (const { id } of scenarios) {
      const scenario = getScenario(id);
      let session = createSession(scenario);
      let guard = 0;
      while (!session.finished && guard < 30) {
        const node = scenario.nodes[session.currentNodeId];
        if (node.type !== 'player_choice') throw new Error(`${id}: 想定外のノード ${session.currentNodeId}`);
        const bestIndex = node.choices.findIndex((c) => c.quality === 'best');
        session = applyChoice(scenario, session, Math.max(bestIndex, 0), fixedRng([0]));
        guard++;
      }
      expect(session.finished, `${id} が ${guard} 手で終わらない`).toBe(true);
      const endNode = scenario.nodes[session.currentNodeId];
      expect(endNode.type).toBe('end');
    }
  });
});

describe('ユーティリティ', () => {
  it('shuffledIndices は同じ長さの順列を返す', () => {
    const indices = shuffledIndices(4, fixedRng([0.9, 0.1, 0.5, 0.3]));
    expect([...indices].sort()).toEqual([0, 1, 2, 3]);
  });

  it('dailyScenarioId は同じ日付なら同じシナリオを返す', () => {
    const ids = ['a', 'b', 'c'];
    expect(dailyScenarioId(ids, '2026-07-05')).toBe(dailyScenarioId(ids, '2026-07-05'));
    expect(ids).toContain(dailyScenarioId(ids, '2026-07-06'));
  });
});
