import { useMemo } from 'react';
import { getScenario, scenarios } from '../content';
import { recommendDaily } from '../lib/recommend';
import { computeInsight, loadHistory } from '../lib/storage';
import { MOOD_EMOJI, MOOD_LABELS, SCENE_LABELS, type Mood } from '../engine/types';

const MOOD_STYLES: Record<Mood, string> = {
  good: 'bg-emerald-100 text-emerald-800',
  neutral: 'bg-slate-200 text-slate-600',
  awkward: 'bg-rose-100 text-rose-700',
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function History({ onStart }: { onStart: (scenarioId: string) => void }) {
  const history = useMemo(() => loadHistory(), []);
  const insight = useMemo(() => computeInsight(history), [history]);
  const recommendation = useMemo(
    () => recommendDaily(scenarios, history, todayKey(), new Date()),
    [history],
  );

  return (
    <div className="space-y-4 pb-8">
      <header>
        <h1 className="text-xl font-black">履歴</h1>
        <p className="text-sm text-slate-500">プレイの記録と、あなたの傾向。データはこの端末にだけ保存される。</p>
      </header>

      {insight ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="mb-1 font-bold">傾向</h2>
          <p>{insight.message}</p>
          <p className="mt-1 text-xs text-amber-700">
            (該当の場面での選択 {insight.samples} 回中、✕率 {Math.round(insight.ngRate * 100)}%)
          </p>
          <button
            onClick={() => onStart(recommendation.scenarioId)}
            className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
          >
            この苦手を練習する(おすすめの1本へ)
          </button>
        </section>
      ) : (
        history.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            今のところ目立った苦手パターンはなし。ホームの「今日の1本」を回していこう。
          </section>
        )
      )}

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
          <p>まだ記録がない。</p>
          <button
            onClick={() => onStart(recommendation.scenarioId)}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            今日の1本を始める
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((entry, i) => {
            let title = entry.scenarioId;
            let scene = '';
            let playable = false;
            try {
              const s = getScenario(entry.scenarioId);
              title = s.title;
              scene = SCENE_LABELS[s.scene];
              playable = true;
            } catch {
              // コンテンツ改編で消えたシナリオはIDのまま表示
            }
            return (
              <li key={i} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {formatDate(entry.endedAt)}
                    {scene && ` ・ ${scene}`}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-bold ${MOOD_STYLES[entry.mood]}`}>
                    {MOOD_EMOJI[entry.mood]} {MOOD_LABELS[entry.mood]}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{title}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    ◎{entry.counts.best} ○{entry.counts.ok} ✕{entry.counts.ng}
                  </p>
                  {playable && (
                    <button
                      onClick={() => onStart(entry.scenarioId)}
                      className="rounded-lg border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50"
                    >
                      もう一度
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
