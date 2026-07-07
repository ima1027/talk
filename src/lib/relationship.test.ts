import { describe, expect, it } from 'vitest';
import { scenarios } from '../content';
import { getCharacter } from '../content/characters';
import {
  allCharacterProgress,
  characterProgress,
  isUnlocked,
  relationshipEventNow,
} from './relationship';
import { scenarioStats, type HistoryEntry } from './storage';

// キャラクター続編を持つ実データを利用する
const CH1 = 'hobby-senior_known-01'; // fishing-boss 第1話
const CH2 = 'food-senior_known-02'; // fishing-boss 第2話

function entry(scenarioId: string, over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    scenarioId,
    endedAt: '2026-07-06T10:00:00Z',
    mood: 'good',
    counts: { best: 2, ok: 1, ng: 0 },
    choices: [{ context: 'opener', quality: 'best' }],
    techniques: [],
    ...over,
  };
}

describe('characterProgress', () => {
  it('未プレイはレベル0、第1話だけ解禁', () => {
    const p = characterProgress(getCharacter('fishing-boss'), scenarios, new Map());
    expect(p.level).toBe(0);
    expect(p.unlockedCount).toBe(1);
    expect(p.chapters.length).toBeGreaterThanOrEqual(2);
    expect(p.nextHint).toContain('第1話');
  });

  it('第1話プレイ(✕あり)でレベル1・顔見知り、続編はまだロック', () => {
    const history = [entry(CH1, { counts: { best: 1, ok: 0, ng: 1 }, mood: 'awkward' })];
    const p = characterProgress(getCharacter('fishing-boss'), scenarios, scenarioStats(history));
    expect(p.level).toBe(1);
    expect(p.label).toBe('顔見知り');
    expect(p.unlockedCount).toBe(1);
  });

  it('第1話✕なしクリアでレベル2・続編解禁', () => {
    const history = [entry(CH1)];
    const p = characterProgress(getCharacter('fishing-boss'), scenarios, scenarioStats(history));
    expect(p.level).toBe(2);
    expect(p.label).toBe('話せる仲');
    expect(p.unlockedCount).toBe(2);
  });
});

describe('isUnlocked', () => {
  it('第1話は常に解禁', () => {
    const ch1 = scenarios.find((s) => s.id === CH1)!;
    expect(isUnlocked(ch1, scenarios, new Map())).toBe(true);
  });
  it('続編は前話の✕なしクリアが条件', () => {
    const ch2 = scenarios.find((s) => s.id === CH2)!;
    expect(isUnlocked(ch2, scenarios, new Map())).toBe(false);
    const cleared = scenarioStats([entry(CH1)]);
    expect(isUnlocked(ch2, scenarios, cleared)).toBe(true);
    const dirty = scenarioStats([entry(CH1, { counts: { best: 0, ok: 0, ng: 1 }, mood: 'awkward' })]);
    expect(isUnlocked(ch2, scenarios, dirty)).toBe(false);
  });
});

describe('relationshipEventNow', () => {
  it('直近プレイでレベルが上がったら解禁イベントを返す', () => {
    const ch1 = scenarios.find((s) => s.id === CH1)!;
    const history = [entry(CH1)]; // 直近=第1話✕なしクリア
    const ev = relationshipEventNow(ch1, scenarios, history);
    expect(ev).not.toBeNull();
    expect(ev!.character.id).toBe('fishing-boss');
    expect(ev!.unlockedSequel?.id).toBe(CH2);
  });
  it('関係が上がらなかった(✕あり)プレイではイベントなし', () => {
    const ch1 = scenarios.find((s) => s.id === CH1)!;
    const history = [entry(CH1, { counts: { best: 0, ok: 0, ng: 1 }, mood: 'awkward' })];
    // ✕ありでもレベル0→1にはなるので、それは解禁イベントとして扱われる(初プレイ)。
    // 2回目の✕ありプレイではレベルが動かない
    const history2 = [
      entry(CH1, { counts: { best: 0, ok: 0, ng: 1 }, mood: 'awkward', endedAt: '2026-07-06T12:00:00Z' }),
      entry(CH1, { counts: { best: 0, ok: 0, ng: 1 }, mood: 'awkward' }),
    ];
    expect(relationshipEventNow(ch1, scenarios, history)).not.toBeNull(); // 初プレイでlv1
    expect(relationshipEventNow(ch1, scenarios, history2)).toBeNull(); // 2回目は据え置き
  });
  it('キャラクターのないシナリオでは常に null', () => {
    const noChar = scenarios.find((s) => !s.characterId)!;
    expect(relationshipEventNow(noChar, scenarios, [entry(noChar.id)])).toBeNull();
  });
});

describe('allCharacterProgress', () => {
  it('登場章のある全キャラクターを返す', () => {
    const all = allCharacterProgress(scenarios, new Map());
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const p of all) expect(p.chapters.length).toBeGreaterThan(0);
  });
});
