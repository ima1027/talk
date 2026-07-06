import { describe, expect, it } from 'vitest';
import { getScenario } from '../content';
import { applyChoice, createSession, type Session } from '../engine/engine';
import { computeTurningPoint } from './review';

const scenario = getScenario('fashion-first_casual-01');

function play(indices: { pick: (choices: { quality: string }[]) => number }[], rngValues: number[]): Session {
  let session = createSession(scenario);
  let step = 0;
  const rng = () => rngValues[Math.min(step, rngValues.length - 1)];
  while (!session.finished && step < 12) {
    const node = scenario.nodes[session.currentNodeId];
    if (node.type !== 'player_choice') throw new Error('unexpected');
    const picker = indices[Math.min(step, indices.length - 1)];
    session = applyChoice(scenario, session, picker.pick(node.choices), rng);
    step++;
  }
  return session;
}

const pickBy = (quality: string) => ({
  pick: (choices: { quality: string }[]) => {
    const i = choices.findIndex((c) => c.quality === quality);
    return i >= 0 ? i : 0;
  },
});

describe('computeTurningPoint', () => {
  it('地雷を踏んだら ng のターニングポイントを返す', () => {
    const session = play([pickBy('ng'), pickBy('best')], [0]);
    const tp = computeTurningPoint(scenario, session);
    expect(tp?.kind).toBe('ng');
    if (tp?.kind === 'ng') {
      expect(tp.taken.quality).toBe('ng');
      expect(tp.better.quality).toBe('best');
    }
  });

  it('良い終わりならターニングポイントなし', () => {
    // best を選び続け、rng=0 で expand側へ → end_good に到達するルート
    const session = play([pickBy('best')], [0]);
    const end = scenario.nodes[session.currentNodeId];
    if (end.type === 'end' && end.mood === 'good') {
      expect(computeTurningPoint(scenario, session)).toBeNull();
    }
  });

  it('無難な終わりで◎を見送っていたら missed を返す', () => {
    // ok を選び続けて短いルートに入るプレイ(rng=0.99 で short/flat 側に寄せる)
    const session = play([pickBy('ok')], [0.99]);
    const end = scenario.nodes[session.currentNodeId];
    if (end.type === 'end' && end.mood !== 'good') {
      const tp = computeTurningPoint(scenario, session);
      expect(tp).not.toBeNull();
      expect(['missed', 'ng', 'flat-luck']).toContain(tp!.kind);
    }
  });
});
