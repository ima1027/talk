// 継続キャラクターの台帳。シナリオJSONの characterId がここを指す。
// 「雑談ができると人間関係が育つ」という現実の報酬構造をそのままゲーム化する仕組みで、
// 同じ相手のシナリオ(章)を✕なしクリアすると関係レベルが上がり、続編が解禁される。
import type { Scenario } from '../engine/types';

export interface CharacterDef {
  id: string;
  /** 表示名(本名は出さず「◯◯な人」で呼ぶ。プレイヤーの記憶の持ち方と同じ) */
  name: string;
  emoji: string;
  /** ホームのキャラクター欄に出す一言 */
  desc: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'fishing-boss',
    name: '釣り好きの上司',
    emoji: '🎣',
    desc: '隣の課の無口な上司。外回り帰りの電車で、初めて仕事以外の話をした。',
  },
  {
    id: 'baseball-father',
    name: '野球好きの義父',
    emoji: '⚾',
    desc: '配偶者の父。口数は少ないが、野球の話になると止まらないらしい。',
  },
  {
    id: 'curry-gamer',
    name: 'ボドゲ会のカレー好き',
    emoji: '🎲',
    desc: '月1のボードゲーム会で同卓になった人。スパイスカレーの店巡りが趣味。',
  },
];

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS.find((c) => c.id === id);
  if (!c) throw new Error(`キャラクターが見つからない: ${id}`);
  return c;
}

/** あるキャラクターの章(シナリオ)を1話から順に返す */
export function characterChapters(characterId: string, scenarios: Scenario[]): Scenario[] {
  return scenarios.filter((s) => s.characterId === characterId).sort((a, b) => (a.chapter ?? 0) - (b.chapter ?? 0));
}

/**
 * シナリオ横断のキャラクター整合チェック:
 * characterId は台帳に存在し、章番号は 1..n の連番で重複しないこと。
 */
export function validateCharacterLinks(scenarios: Scenario[]): string[] {
  const errors: string[] = [];
  const byCharacter = new Map<string, Scenario[]>();
  for (const s of scenarios) {
    if (!s.characterId) continue;
    if (!CHARACTERS.some((c) => c.id === s.characterId)) {
      errors.push(`${s.id}: characterId=${s.characterId} が characters.ts に存在しない`);
      continue;
    }
    const list = byCharacter.get(s.characterId) ?? [];
    list.push(s);
    byCharacter.set(s.characterId, list);
  }
  for (const [characterId, list] of byCharacter) {
    const chapters = list.map((s) => s.chapter ?? 0).sort((a, b) => a - b);
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i] !== i + 1) {
        errors.push(`${characterId}: 章番号が 1..${chapters.length} の連番でない(実際: ${chapters.join(',')})`);
        break;
      }
    }
  }
  return errors;
}
