import { useState } from 'react';
import { getScenario } from './content';
import type { Session } from './engine/engine';
import { addHistoryEntry, buildHistoryEntry, collectFromSession } from './lib/storage';
import Home from './components/Home';
import Play from './components/Play';
import Review from './components/Review';
import TreeView from './components/TreeView';
import Zukan from './components/Zukan';
import History from './components/History';

type Tab = 'home' | 'zukan' | 'history';

type View =
  | { screen: Tab }
  | { screen: 'play'; scenarioId: string }
  | { screen: 'review'; scenarioId: string; session: Session }
  | { screen: 'tree'; scenarioId: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '練習' },
  { id: 'zukan', label: '図鑑' },
  { id: 'history', label: '履歴' },
];

export default function App() {
  const [view, setView] = useState<View>({ screen: 'home' });

  const finishSession = (scenarioId: string, session: Session) => {
    const scenario = getScenario(scenarioId);
    addHistoryEntry(buildHistoryEntry(scenario, session, new Date().toISOString()));
    collectFromSession(scenario, session);
    setView({ screen: 'review', scenarioId, session });
  };

  const isTab = view.screen === 'home' || view.screen === 'zukan' || view.screen === 'history';

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 py-6">
      {isTab && (
        <nav className="mb-5 flex gap-1 rounded-xl bg-slate-200/70 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView({ screen: tab.id })}
              className={`flex-1 rounded-lg py-1.5 text-sm font-bold transition ${
                view.screen === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {view.screen === 'home' && (
        <Home
          onStart={(scenarioId) => setView({ screen: 'play', scenarioId })}
          onTree={(scenarioId) => setView({ screen: 'tree', scenarioId })}
        />
      )}
      {view.screen === 'zukan' && <Zukan />}
      {view.screen === 'history' && <History onStart={(scenarioId) => setView({ screen: 'play', scenarioId })} />}
      {view.screen === 'tree' && (
        <TreeView
          scenario={getScenario(view.scenarioId)}
          onBack={() => setView({ screen: 'home' })}
          onPlay={() => setView({ screen: 'play', scenarioId: view.scenarioId })}
        />
      )}
      {view.screen === 'play' && (
        <Play
          key={view.scenarioId}
          scenario={getScenario(view.scenarioId)}
          onFinish={(session) => finishSession(view.scenarioId, session)}
          onQuit={() => setView({ screen: 'home' })}
        />
      )}
      {view.screen === 'review' && (
        <Review
          scenario={getScenario(view.scenarioId)}
          session={view.session}
          onRetry={() => setView({ screen: 'play', scenarioId: view.scenarioId })}
          onTree={() => setView({ screen: 'tree', scenarioId: view.scenarioId })}
          onHome={() => setView({ screen: 'home' })}
        />
      )}
    </div>
  );
}
