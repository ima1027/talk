import { useMemo, useState } from 'react';
import { scenarios } from '../content';
import { loadZukan, zukanUniverse } from '../lib/storage';
import { QUALITY_LABELS } from '../engine/types';

export default function Zukan() {
  const state = useMemo(() => loadZukan(), []);
  const universe = useMemo(() => zukanUniverse(scenarios), []);
  const collected = useMemo(() => new Set(state.phrases), [state]);
  const allTechniques = useMemo(
    () => [...new Set(universe.flatMap((i) => i.choice.techniques ?? []))].sort(),
    [universe],
  );
  const [filter, setFilter] = useState<string | null>(null);

  const items = filter ? universe.filter((i) => i.choice.techniques?.includes(filter)) : universe;
  const collectedCount = universe.filter((i) => collected.has(i.key)).length;
  const rate = universe.length === 0 ? 0 : Math.round((collectedCount / universe.length) * 100);

  return (
    <div className="space-y-4 pb-8">
      <header>
        <h1 className="text-xl font-black">パターン図鑑</h1>
        <p className="text-sm text-slate-500">練習の中で実際に「使った」手本フレーズが集まっていく。</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">収集率</span>
          <span className="text-lg font-black text-indigo-600">
            {collectedCount}
            <span className="text-sm font-normal text-slate-400"> / {universe.length}({rate}%)</span>
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${rate}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          出会った技法: {state.techniques.length > 0 ? state.techniques.join('、') : 'まだなし — まずは1プレイ!'}
        </p>
      </section>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-bold ${filter === null ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          すべて
        </button>
        {allTechniques.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t === filter ? null : t)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${filter === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const owned = collected.has(item.key);
          return (
            <li
              key={item.key}
              className={`rounded-2xl border p-3 ${owned ? 'border-slate-200 bg-white shadow-sm' : 'border-dashed border-slate-300 bg-slate-50'}`}
            >
              {owned ? (
                <>
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    {(item.choice.techniques ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-slate-400">
                      {QUALITY_LABELS[item.choice.quality]} / {item.topic}
                    </span>
                  </div>
                  <p className="font-medium">「{item.choice.text}」</p>
                  <p className="mt-1 text-xs text-slate-500">{item.choice.explanation}</p>
                </>
              ) : (
                <>
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    {(item.choice.techniques ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-slate-300 px-2 py-0.5 text-xs text-white">
                        {t}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-slate-400">{item.topic}</span>
                  </div>
                  <p className="font-medium text-slate-400">??? — まだ出会っていない一手</p>
                  <p className="mt-1 text-xs text-slate-400">「{item.scenarioTitle}」で使うと解放</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
