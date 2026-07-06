import { useEffect, useState } from 'react';
import type { Session } from '../engine/engine';
import { computeTurningPoint } from '../lib/review';
import { addMedal, clearChallenge, setChallenge } from '../lib/storage';
import {
  CATEGORY_LABELS,
  MOOD_EMOJI,
  MOOD_LABELS,
  QUALITY_LABELS,
  SCENE_LABELS,
  topicStyle,
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

export default function Review({
  scenario,
  session,
  onRetry,
  onTree,
  onHome,
}: {
  scenario: Scenario;
  session: Session;
  onRetry: () => void;
  onTree: () => void;
  onHome: () => void;
}) {
  const endNode = scenario.nodes[session.currentNodeId];
  const mood = endNode.type === 'end' ? endNode.mood : 'neutral';
  const style = topicStyle(scenario.topic);

  const taken: { quality: Quality; text: string }[] = [];
  for (const entry of session.log) {
    if (entry.kind !== 'player') continue;
    const node = scenario.nodes[entry.nodeId];
    if (node.type !== 'player_choice') continue;
    const c = node.choices[entry.choiceIndex];
    taken.push({ quality: c.quality, text: c.text });
  }
  const counts = { best: 0, ok: 0, ng: 0 } as Record<Quality, number>;
  for (const t of taken) counts[t.quality]++;

  const turningPoint = computeTurningPoint(scenario, session);
  const goodMoves = taken.filter((t) => t.quality === 'best').slice(0, 2);

  const [medalClaimed, setMedalClaimed] = useState(false);

  const tryPhrase =
    (() => {
      for (const entry of session.log) {
        if (entry.kind !== 'player') continue;
        const node = scenario.nodes[entry.nodeId];
        if (node.type !== 'player_choice') continue;
        const c = node.choices[entry.choiceIndex];
        if (c.quality === 'best') return c;
      }
      const entryNode = scenario.nodes[scenario.entry];
      return entryNode.type === 'player_choice' ? entryNode.choices.find((c) => c.quality === 'best') : undefined;
    })();

  // 「試す一手」を実会話チャレンジとして登録(ホームからいつでもメダル化できる)
  useEffect(() => {
    if (tryPhrase && !medalClaimed) {
      setChallenge({ phrase: tryPhrase.text, scenarioId: scenario.id, setAt: new Date().toISOString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const claimMedal = () => {
    if (!tryPhrase || medalClaimed) return;
    addMedal({ phrase: tryPhrase.text, scenarioId: scenario.id, at: new Date().toISOString() });
    clearChallenge();
    setMedalClaimed(true);
  };

  return (
    <div className="space-y-5 pb-8">
      <header>
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 text-white ${style.chip}`}>
            {style.emoji} {scenario.topic}
          </span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
        </div>
        <h1 className="text-xl font-black">
          {MOOD_EMOJI[mood]} ふりかえり
        </h1>
        <p className="text-sm text-slate-500">
          {MOOD_LABELS[mood]} ・ ◎{counts.best} ○{counts.ok} ✕{counts.ng}
        </p>
      </header>

      {goodMoves.length > 0 && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          ◎ {goodMoves.map((m) => `「${m.text}」`).join(' ')} が効いていた。
        </p>
      )}

      {turningPoint && turningPoint.kind !== 'flat-luck' && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-1 text-sm font-bold text-amber-800">
            {turningPoint.kind === 'ng' ? 'ここが分かれ目だった' : 'もっと広がる一手があった'}
          </h2>
          <p className="text-sm text-amber-900">
            <span className="line-through opacity-60">「{turningPoint.taken.text}」</span>
            <br />
            <span className="font-bold">→「{turningPoint.better.text}」</span>
          </p>
          <p className="mt-1 text-xs text-amber-800">{turningPoint.better.explanation}</p>
        </section>
      )}
      {turningPoint?.kind === 'flat-luck' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          今回は相手がそっけなかっただけで、打ち手は悪くない。無理に盛り上げず引けたなら、それも成功。もう一度やると別の反応パターンに当たる。
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-500">たどったルート(別の選択肢・別の反応も開ける)</h2>
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
            <span className="font-bold">
              {MOOD_EMOJI[endNode.mood]} {MOOD_LABELS[endNode.mood]}:{' '}
            </span>
            {endNode.text}
          </div>
        )}
      </section>

      {tryPhrase && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="mb-1 text-sm font-bold text-indigo-800">🏅 今日どこかで試す一手(実会話チャレンジ)</h2>
          <p className="font-medium text-indigo-900">「{tryPhrase.text}」</p>
          <p className="mt-1 text-xs text-indigo-700">
            そのままでなくていい。この「型」を実際の会話で試せたら、ホームからいつでもメダル化できる。
          </p>
          {medalClaimed ? (
            <p className="mt-2 rounded-lg bg-yellow-100 py-2 text-center text-sm font-black text-yellow-800">
              🏅 実会話メダル獲得! (+20XP)
            </p>
          ) : (
            <button
              onClick={claimMedal}
              className="mt-2 w-full rounded-lg border border-yellow-400 bg-yellow-50 py-2 text-sm font-bold text-yellow-800 transition hover:bg-yellow-100"
            >
              もう実際に試せた(メダル獲得)
            </button>
          )}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={onRetry}
          className="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          もう一度(未体験の反応が出やすくなる)
        </button>
        <div className="flex gap-2">
          <button
            onClick={onTree}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            全ルートを見る
          </button>
          <button
            onClick={onHome}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            ホームへ
          </button>
        </div>
      </div>
    </div>
  );
}
