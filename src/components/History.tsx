import { useMemo } from 'react';
import { getScenario } from '../content';
import { computeInsight, loadHistory } from '../lib/storage';
import { MOOD_LABELS, SCENE_LABELS, type Mood } from '../engine/types';

const MOOD_STYLES: Record<Mood, string> = {
  good: 'bg-emerald-100 text-emerald-800',
  neutral: 'bg-slate-200 text-slate-600',
  awkward: 'bg-rose-100 text-rose-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function History() {
  const history = useMemo(() => loadHistory(), []);
  const insight = useMemo(() => computeInsight(history), [history]);

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
            (該当の場面での選択 {insight.samples} 回中、NG率 {Math.round(insight.ngRate * 100)}%)
          </p>
        </section>
      ) : (
        history.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            今のところ目立った苦手パターンはなし。いろいろなシナリオを回してみよう。
          </section>
        )
      )}

      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-400">
          まだ記録がない。「今日の1本」から始めてみよう。
        </p>
      ) : (
        <ul className="space-y-2">
          {history.map((entry, i) => {
            let title = entry.scenarioId;
            let scene = '';
            try {
              const s = getScenario(entry.scenarioId);
              title = s.title;
              scene = SCENE_LABELS[s.scene];
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
                    {MOOD_LABELS[entry.mood]}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  ベスト{entry.counts.best} ・ あり{entry.counts.ok} ・ NG{entry.counts.ng}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
