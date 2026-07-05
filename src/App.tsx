import { useState } from 'react';
import { getScenario } from './content';
import type { Session } from './engine/engine';
import Home from './components/Home';
import Play from './components/Play';
import Review from './components/Review';

type View =
  | { screen: 'home' }
  | { screen: 'play'; scenarioId: string }
  | { screen: 'review'; scenarioId: string; session: Session };

export default function App() {
  const [view, setView] = useState<View>({ screen: 'home' });

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 py-6">
      {view.screen === 'home' && <Home onStart={(scenarioId) => setView({ screen: 'play', scenarioId })} />}
      {view.screen === 'play' && (
        <Play
          key={view.scenarioId}
          scenario={getScenario(view.scenarioId)}
          onFinish={(session) => setView({ screen: 'review', scenarioId: view.scenarioId, session })}
          onQuit={() => setView({ screen: 'home' })}
        />
      )}
      {view.screen === 'review' && (
        <Review
          scenario={getScenario(view.scenarioId)}
          session={view.session}
          onRetry={() => setView({ screen: 'play', scenarioId: view.scenarioId })}
          onHome={() => setView({ screen: 'home' })}
        />
      )}
    </div>
  );
}
