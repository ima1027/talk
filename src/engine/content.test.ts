import { describe, expect, it } from 'vitest';
import { scenarios } from '../content';
import { validateScenario } from './validate';

describe('同梱コンテンツの整合性 (docs/requirements.md §5.2)', () => {
  it('シナリオが4本以上ある', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(4);
  });

  it.each(scenarios.map((s) => [s.id, s] as const))('%s が全チェックを通る', (_id, scenario) => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it('MVP必須: ユーザー例示シナリオ(ファッションを褒める)が存在し expand/counter 分岐を持つ', () => {
    const scenario = scenarios.find((s) => s.id === 'fashion-first_casual-01');
    expect(scenario).toBeDefined();
    const p1 = scenario!.nodes['p1'];
    if (p1.type !== 'partner_response') throw new Error('p1 が partner_response でない');
    const categories = p1.branches.map((b) => b.category);
    expect(categories).toContain('expand');
    expect(categories).toContain('counter');
  });
});

describe('validateScenario は壊れたコンテンツを検出する', () => {
  const broken = {
    id: 'x',
    topic: 't',
    scene: 'first_casual',
    title: 'x',
    situation: 'x',
    guide: 'x',
    entry: 'n1',
    nodes: {
      n1: {
        type: 'player_choice',
        choices: [
          { text: 'a', quality: 'best', explanation: 'e', next: 'missing' },
          { text: 'b', quality: 'ok', explanation: 'e', next: 'missing' },
        ],
      },
    },
  };

  it('存在しない next・カテゴリ不足などを報告する', () => {
    const errors = validateScenario(broken);
    expect(errors.some((e) => e.includes('missing'))).toBe(true);
    expect(errors.some((e) => e.includes('NG選択肢'))).toBe(true);
    expect(errors.some((e) => e.includes('クロージング'))).toBe(true);
  });
});
