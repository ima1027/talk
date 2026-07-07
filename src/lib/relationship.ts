// 関係性レベル(提案1)。同じ相手の章を✕なしクリアするたびに関係が育ち、続編が解禁される。
// 報酬システムと同じ原則で、レベルは履歴から決定論的に再計算する(保存カウンタなし)。
import { CHARACTERS, characterChapters, type CharacterDef } from '../content/characters';
import type { Scenario } from '../engine/types';
import { scenarioStats, type HistoryEntry, type ScenarioStats } from './storage';

/** レベル0=まだ話していない。第1話をプレイで1、以降は章を✕なしクリアするごとに+1 */
export const LEVEL_LABELS = ['まだ話していない', '顔見知り', '話せる仲', '気安い仲'] as const;

export interface CharacterProgress {
  character: CharacterDef;
  /** 1話から順に並んだ章シナリオ */
  chapters: Scenario[];
  level: number;
  label: string;
  /** 先頭から何話まで遊べるか(第1話は常に解禁) */
  unlockedCount: number;
  /** 次にレベルを上げる方法。最大なら null */
  nextHint: string | null;
}

/** 先頭から連続して✕なしクリア済みの章数 */
function cleanStreak(chapters: Scenario[], statsMap: Map<string, ScenarioStats>): number {
  let streak = 0;
  for (const chapter of chapters) {
    if ((statsMap.get(chapter.id)?.cleanClears ?? 0) === 0) break;
    streak++;
  }
  return streak;
}

export function characterProgress(
  character: CharacterDef,
  scenarios: Scenario[],
  statsMap: Map<string, ScenarioStats>,
): CharacterProgress {
  const chapters = characterChapters(character.id, scenarios);
  const streak = cleanStreak(chapters, statsMap);
  const played = (statsMap.get(chapters[0]?.id ?? '')?.plays ?? 0) > 0;
  const level = Math.min(played ? 1 + streak : 0, LEVEL_LABELS.length - 1);
  const unlockedCount = Math.min(1 + streak, chapters.length);

  let nextHint: string | null = null;
  if (!played) {
    nextHint = `第1話「${chapters[0]?.title ?? ''}」をプレイすると顔見知りに`;
  } else if (streak < chapters.length) {
    const target = chapters[streak];
    const gain =
      streak + 1 < chapters.length
        ? `続編が解禁`
        : `「${LEVEL_LABELS[Math.min(level + 1, LEVEL_LABELS.length - 1)]}」に`;
    nextHint = `第${streak + 1}話「${target.title}」を✕なしクリアで${gain}`;
  }

  return { character, chapters, level, label: LEVEL_LABELS[level], unlockedCount, nextHint };
}

/** シナリオが登場する全キャラクターの進捗(登場章があるものだけ) */
export function allCharacterProgress(
  scenarios: Scenario[],
  statsMap: Map<string, ScenarioStats>,
): CharacterProgress[] {
  return CHARACTERS.map((c) => characterProgress(c, scenarios, statsMap)).filter((p) => p.chapters.length > 0);
}

/** そのシナリオが今プレイできるか。続編(第2話以降)は前の章すべての✕なしクリアが条件 */
export function isUnlocked(scenario: Scenario, scenarios: Scenario[], statsMap: Map<string, ScenarioStats>): boolean {
  if (!scenario.characterId || (scenario.chapter ?? 1) <= 1) return true;
  const chapters = characterChapters(scenario.characterId, scenarios);
  const index = chapters.findIndex((s) => s.id === scenario.id);
  return cleanStreak(chapters, statsMap) >= index;
}

/** ロック中の続編に出す解禁条件の説明 */
export function lockHint(scenario: Scenario, scenarios: Scenario[]): string {
  const chapters = scenario.characterId ? characterChapters(scenario.characterId, scenarios) : [];
  const index = chapters.findIndex((s) => s.id === scenario.id);
  const prev = chapters[index - 1];
  return prev ? `第${index}話「${prev.title}」を✕なしクリアで解禁` : '';
}

export interface RelationshipEvent {
  character: CharacterDef;
  /** 上がった後のレベル表示 */
  label: string;
  /** 今回のプレイで新しく解禁された続編(なければ null = レベル最大到達など) */
  unlockedSequel: Scenario | null;
}

/**
 * 直近のプレイ(履歴の先頭)で関係レベルが上がったかを判定する。
 * ふりかえり画面の解禁演出用。履歴は新しい順に並んでいる前提。
 */
export function relationshipEventNow(
  scenario: Scenario,
  scenarios: Scenario[],
  history: HistoryEntry[],
): RelationshipEvent | null {
  if (!scenario.characterId) return null;
  const latest = history[0];
  if (!latest || latest.scenarioId !== scenario.id) return null;

  const character = CHARACTERS.find((c) => c.id === scenario.characterId);
  if (!character) return null;

  const before = characterProgress(character, scenarios, scenarioStats(history.slice(1)));
  const after = characterProgress(character, scenarios, scenarioStats(history));
  if (after.level <= before.level) return null;

  const unlockedSequel =
    after.unlockedCount > before.unlockedCount ? (after.chapters[after.unlockedCount - 1] ?? null) : null;
  return { character, label: after.label, unlockedSequel };
}
