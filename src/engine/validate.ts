import type { Scenario } from './types';

const SCENES = ['first_formal', 'first_casual', 'senior_known'];
const QUALITIES = ['best', 'ok', 'ng'];
const CATEGORIES = ['expand', 'counter', 'short', 'flat'];
const MOODS = ['good', 'neutral', 'awkward'];

/** 選択肢テキストの上限(全角30字目安+多少の余裕)。docs/requirements.md §5.3 */
const MAX_CHOICE_LENGTH = 45;

/**
 * コンテンツ整合性チェック(docs/requirements.md §5.2, §8.2)。
 * LLM生成コンテンツにも人手コンテンツにも同じチェックをかける。
 * 違反メッセージの配列を返す(空 = 合格)。
 */
export function validateScenario(raw: unknown): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  if (typeof raw !== 'object' || raw === null) return ['シナリオがオブジェクトではない'];
  const s = raw as Record<string, unknown>;

  for (const field of ['id', 'topic', 'title', 'situation', 'guide', 'entry']) {
    if (typeof s[field] !== 'string' || (s[field] as string).length === 0) {
      err(`${field} が空か文字列でない`);
    }
  }
  if (!SCENES.includes(s.scene as string)) err(`scene が不正: ${String(s.scene)}`);
  if (typeof s.nodes !== 'object' || s.nodes === null) {
    err('nodes がオブジェクトでない');
    return errors;
  }

  const nodes = s.nodes as Record<string, Record<string, unknown>>;
  const entry = s.entry as string;
  if (!nodes[entry]) err(`entry ノード ${entry} が存在しない`);

  let ngCount = 0;
  const usedCategories = new Set<string>();
  const edges = new Map<string, string[]>();

  for (const [id, node] of Object.entries(nodes)) {
    const targets: string[] = [];
    edges.set(id, targets);

    if (node.type === 'player_choice') {
      const choices = node.choices as Record<string, unknown>[] | undefined;
      if (!Array.isArray(choices) || choices.length < 1) {
        err(`${id}: choices が空`);
        continue;
      }
      if (!node.closing && choices.length < 2) {
        err(`${id}: クロージング以外の選択ポイントは2択以上必要`);
      }
      for (const [i, c] of choices.entries()) {
        const label = `${id}.choices[${i}]`;
        if (typeof c.text !== 'string' || c.text.length === 0) err(`${label}: text が空`);
        else if (c.text.length > MAX_CHOICE_LENGTH) err(`${label}: text が長すぎる(${c.text.length}字)`);
        if (!QUALITIES.includes(c.quality as string)) err(`${label}: quality が不正`);
        if (c.quality === 'ng') ngCount++;
        if (typeof c.explanation !== 'string' || (c.explanation as string).length === 0) {
          err(`${label}: explanation がない`);
        }
        const next = c.next as string;
        if (!nodes[next]) err(`${label}: next=${String(next)} が存在しない`);
        else {
          if (nodes[next].type === 'player_choice') err(`${label}: player_choice から player_choice へ直接遷移`);
          targets.push(next);
        }
      }
    } else if (node.type === 'partner_response') {
      const branches = node.branches as Record<string, unknown>[] | undefined;
      if (!Array.isArray(branches) || branches.length < 1) {
        err(`${id}: branches が空`);
        continue;
      }
      for (const [i, b] of branches.entries()) {
        const label = `${id}.branches[${i}]`;
        if (!CATEGORIES.includes(b.category as string)) err(`${label}: category が不正`);
        else usedCategories.add(b.category as string);
        if (typeof b.weight !== 'number' || b.weight <= 0) err(`${label}: weight は正の数`);
        if (typeof b.text !== 'string' || b.text.length === 0) err(`${label}: text が空`);
        const next = b.next as string;
        if (!nodes[next]) err(`${label}: next=${String(next)} が存在しない`);
        else {
          if (nodes[next].type === 'partner_response') err(`${label}: partner_response から partner_response へ直接遷移`);
          targets.push(next);
        }
      }
    } else if (node.type === 'end') {
      if (typeof node.text !== 'string' || (node.text as string).length === 0) err(`${id}: end に text がない`);
      if (!MOODS.includes(node.mood as string)) err(`${id}: mood が不正`);
    } else {
      err(`${id}: type が不正: ${String(node.type)}`);
    }
  }

  // 到達可能性と閉路検出(DFS)
  const reachable = new Set<string>();
  const visiting = new Set<string>();
  let hasCycle = false;
  const visit = (id: string) => {
    if (visiting.has(id)) {
      hasCycle = true;
      return;
    }
    if (reachable.has(id)) return;
    reachable.add(id);
    visiting.add(id);
    for (const next of edges.get(id) ?? []) visit(next);
    visiting.delete(id);
  };
  if (nodes[entry]) visit(entry);
  if (hasCycle) err('閉路がある(無限ループの恐れ)');
  for (const id of Object.keys(nodes)) {
    if (!reachable.has(id)) err(`${id}: entry から到達できない`);
  }

  // 終端は必ず end ノード(= きれいな切り上げで終わる構造)
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== 'end' && (edges.get(id) ?? []).length === 0) {
      err(`${id}: 行き止まり(end 以外のノードに遷移先がない)`);
    }
  }

  // §5.2: カテゴリ3種以上(flat 必須)、NG選択肢2つ以上、クロージング選択ポイントあり
  if (usedCategories.size < 3) err(`返答カテゴリが${usedCategories.size}種のみ(3種以上必要)`);
  if (!usedCategories.has('flat')) err('flat(そっけない)への対処が含まれていない');
  if (ngCount < 2) err(`NG選択肢が${ngCount}個のみ(2個以上必要)`);
  const hasClosing = Object.values(nodes).some((n) => n.type === 'player_choice' && n.closing === true);
  if (!hasClosing) err('クロージング(closing: true)の選択ポイントがない');

  return errors;
}

export function assertValidScenario(raw: unknown): Scenario {
  const errors = validateScenario(raw);
  if (errors.length > 0) {
    const id = (raw as { id?: string })?.id ?? '(id不明)';
    throw new Error(`シナリオ ${id} の検証エラー:\n- ${errors.join('\n- ')}`);
  }
  return raw as Scenario;
}
