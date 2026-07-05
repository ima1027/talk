import type { Session } from '../engine/engine';
import {
  CATEGORY_LABELS,
  MOOD_LABELS,
  QUALITY_LABELS,
  SCENE_LABELS,
  type Choice,
  type Quality,
  type Scenario,
} from '../engine/types';

const QUALITY_STYLES: Record<Quality, string> = {
  best: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ok: 'bg-sky-100 text-sky-800 border-sky-300',
  ng: 'bg-rose-100 text-rose-800 border-rose-300',
};

function QualityBadge({ quality }: { quality: Quality }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${QUALITY_STYLES[quality]}`}>
      {QUALITY_LABELS[quality]}
    </span>
  );
}

function TechniqueChips({ techniques }: { techniques?: string[] }) {
  if (!techniques || techniques.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {techniques.map((t) => (
        <span key={t} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white">
          {t}
        </span>
      ))}
    </span>
  );
}

interface TakenChoice {
  nodeId: string;
  choice: Choice;
  alternatives: Choice[];
}

/** ふりかえりの総評: ポジティブ2+改善1(調査済みの 2:1 比率、requirements §F3) */
function buildFeedback(taken: TakenChoice[]) {
  const ranked = [...taken].sort((a, b) => {
    const order: Record<Quality, number> = { best: 0, ok: 1, ng: 2 };
    return order[a.choice.quality] - order[b.choice.quality];
  });
  const positives = ranked
    .filter((t) => t.choice.quality !== 'ng')
    .slice(0, 2)
    .map((t) => t.choice);
  const worst = [...taken].reverse().find((t) => t.choice.quality === 'ng') ?? taken.find((t) => t.choice.quality === 'ok');
  const improvement = worst && worst.choice.quality !== 'best' ? worst : undefined;
  return { positives, improvement };
}

export default function Review({
  scenario,
  session,
  onRetry,
  onHome,
}: {
  scenario: Scenario;
  session: Session;
  onRetry: () => void;
  onHome: () => void;
}) {
  const endNode = scenario.nodes[session.currentNodeId];
  const mood = endNode.type === 'end' ? endNode.mood : 'neutral';

  const taken: TakenChoice[] = [];
  for (const entry of session.log) {
    if (entry.kind !== 'player') continue;
    const node = scenario.nodes[entry.nodeId];
    if (node.type !== 'player_choice') continue;
    taken.push({
      nodeId: entry.nodeId,
      choice: node.choices[entry.choiceIndex],
      alternatives: node.choices.filter((_, i) => i !== entry.choiceIndex),
    });
  }

  const counts = { best: 0, ok: 0, ng: 0 } as Record<Quality, number>;
  for (const t of taken) counts[t.choice.quality]++;

  const { positives, improvement } = buildFeedback(taken);
  const tryPhrase =
    taken.find((t) => t.choice.quality === 'best')?.choice ??
    (() => {
      const entryNode = scenario.nodes[scenario.entry];
      return entryNode.type === 'player_choice' ? entryNode.choices.find((c) => c.quality === 'best') : undefined;
    })();

  return (
    <div className="space-y-5 pb-8">
      <header>
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-white">{scenario.topic}</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
        </div>
        <h1 className="text-xl font-black">ふりかえり</h1>
        <p className="text-sm text-slate-500">
          {scenario.title} — {MOOD_LABELS[mood]}(ベスト{counts.best}・あり{counts.ok}・NG{counts.ng})
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-bold">総評</h2>
        <ul className="space-y-2 text-sm">
          {positives.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-emerald-600">◎</span>
              <span>
                「{c.text}」 — {c.explanation}
              </span>
            </li>
          ))}
          {positives.length === 0 && (
            <li className="flex gap-2">
              <span className="shrink-0 text-emerald-600">◎</span>
              <span>最後まで会話を終えられたこと自体が収穫。下のNG解説がそのまま伸びしろになる。</span>
            </li>
          )}
          {improvement ? (
            <li className="flex gap-2">
              <span className="shrink-0 text-rose-500">▲</span>
              <span>
                「{improvement.choice.text}」 — {improvement.choice.explanation}
              </span>
            </li>
          ) : (
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              <span>今回の選択に大きな改善点なし。別の返答パターンが来た場合のルートも覗いてみよう。</span>
            </li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-500">たどったルート</h2>
        {session.log.map((entry, i) => {
          const node = scenario.nodes[entry.nodeId];
          if (entry.kind === 'player' && node.type === 'player_choice') {
            const choice = node.choices[entry.choiceIndex];
            const alternatives = node.choices.filter((_, ci) => ci !== entry.choiceIndex);
            return (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-600">あなた</span>
                  <div className="flex items-center gap-1">
                    <TechniqueChips techniques={choice.techniques} />
                    <QualityBadge quality={choice.quality} />
                  </div>
                </div>
                <p className="font-medium">{choice.text}</p>
                <p className="mt-1 text-sm text-slate-600">{choice.explanation}</p>
                {alternatives.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-400">
                      他の選択肢({alternatives.length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {alternatives.map((alt, ai) => (
                        <li key={ai} className="rounded-lg bg-slate-50 p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span>{alt.text}</span>
                            <QualityBadge quality={alt.quality} />
                          </div>
                          <p className="text-xs text-slate-500">{alt.explanation}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          }
          if (entry.kind === 'partner' && node.type === 'partner_response') {
            const branch = node.branches[entry.branchIndex];
            const others = node.branches.filter((_, bi) => bi !== entry.branchIndex);
            return (
              <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500">相手</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    {CATEGORY_LABELS[branch.category]}
                  </span>
                </div>
                <p>{branch.text}</p>
                {others.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-400">
                      こう返ってくることも({others.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {others.map((b, bi) => (
                        <li key={bi} className="rounded-lg bg-white p-2">
                          <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">
                            {CATEGORY_LABELS[b.category]}
                          </span>
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          }
          return null;
        })}
        {endNode.type === 'end' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <span className="font-bold">{MOOD_LABELS[endNode.mood]}: </span>
            {endNode.text}
          </div>
        )}
      </section>

      {tryPhrase && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="mb-1 text-sm font-bold text-indigo-800">今日どこかで試す一手</h2>
          <p className="font-medium text-indigo-900">「{tryPhrase.text}」</p>
          <p className="mt-1 text-xs text-indigo-700">
            そのままでなくていい。この「型」をひとつ、実際の会話で試せたら今日は合格。
          </p>
        </section>
      )}

      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          もう一度(別ルートを引く)
        </button>
        <button
          onClick={onHome}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          ホームへ
        </button>
      </div>
    </div>
  );
}
