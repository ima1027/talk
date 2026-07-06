import type { Session } from '../engine/engine';
import type { Choice, Scenario } from '../engine/types';

/**
 * ふりかえりの「ターニングポイント」:
 * 「無難な終わりだったとき、どうすればよかったのか」に1点で答えるための分析。
 */
export type TurningPoint =
  | { kind: 'ng'; logIndex: number; taken: Choice; better: Choice }
  | { kind: 'missed'; logIndex: number; taken: Choice; better: Choice }
  | { kind: 'flat-luck' }
  | null;

export function computeTurningPoint(scenario: Scenario, session: Session): TurningPoint {
  const players: { logIndex: number; choice: Choice; siblings: Choice[] }[] = [];
  session.log.forEach((entry, i) => {
    if (entry.kind !== 'player') return;
    const node = scenario.nodes[entry.nodeId];
    if (node.type !== 'player_choice') return;
    players.push({ logIndex: i, choice: node.choices[entry.choiceIndex], siblings: node.choices });
  });

  // 1) 地雷・引っ掛けを踏んでいたら、そこが最大の分岐点
  for (const p of players) {
    if (p.choice.quality !== 'ng') continue;
    const better = p.siblings.find((c) => c.quality === 'best') ?? p.siblings.find((c) => c.quality === 'ok');
    if (better) return { kind: 'ng', logIndex: p.logIndex, taken: p.choice, better };
  }

  const endNode = scenario.nodes[session.currentNodeId];
  if (endNode.type !== 'end' || endNode.mood === 'good') return null;

  // 2) 無難な終わりで、◎を見送った箇所があればそこを提示(最後のもの=効いた可能性が高い)
  for (let i = players.length - 1; i >= 0; i--) {
    const p = players[i];
    if (p.choice.quality === 'ok' && p.siblings.some((c) => c.quality === 'best')) {
      const better = p.siblings.find((c) => c.quality === 'best')!;
      return { kind: 'missed', logIndex: p.logIndex, taken: p.choice, better };
    }
  }

  // 3) 打ち手は悪くなかったが、相手がそっけなかった(=運の要素)
  const hadFlat = session.log.some((entry) => {
    if (entry.kind !== 'partner') return false;
    const node = scenario.nodes[entry.nodeId];
    return node.type === 'partner_response' && node.branches[entry.branchIndex].category === 'flat';
  });
  if (hadFlat) return { kind: 'flat-luck' };

  return null;
}
