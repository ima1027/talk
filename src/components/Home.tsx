import { scenarios } from '../content';
import { dailyScenarioId } from '../engine/engine';
import { SCENE_LABELS, type Scenario } from '../engine/types';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function ScenarioCard({ scenario, onStart, highlight }: { scenario: Scenario; onStart: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onStart}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${
        highlight ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-xs">
        {highlight && <span className="rounded-full bg-indigo-600 px-2 py-0.5 font-bold text-white">今日の1本</span>}
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-white">{scenario.topic}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
      </div>
      <div className="font-bold">{scenario.title}</div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{scenario.situation}</p>
    </button>
  );
}

export default function Home({ onStart }: { onStart: (scenarioId: string) => void }) {
  const dailyId = dailyScenarioId(
    scenarios.map((s) => s.id),
    todayKey(),
  );
  const daily = scenarios.find((s) => s.id === dailyId)!;
  const rest = scenarios.filter((s) => s.id !== dailyId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">talk</h1>
        <p className="text-sm text-slate-500">
          雑談シミュレーター — 30秒の雑談を、安全な場所で何度でも練習する。
        </p>
      </header>

      <section className="space-y-2">
        <ScenarioCard scenario={daily} onStart={() => onStart(daily.id)} highlight />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500">シナリオ一覧</h2>
        {rest.map((s) => (
          <ScenarioCard key={s.id} scenario={s} onStart={() => onStart(s.id)} />
        ))}
      </section>

      <footer className="pt-4 text-center text-xs text-slate-400">
        目的は「面白いことを言う」ではなく、会話のパスを回して気持ちよく終えること。
      </footer>
    </div>
  );
}
