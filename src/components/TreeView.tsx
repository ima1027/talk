import { useState, type ReactNode } from 'react';
import { CATEGORY_LABELS, MOOD_LABELS, QUALITY_LABELS, SCENE_LABELS, type Quality, type Scenario } from '../engine/types';

const QUALITY_DOT: Record<Quality, string> = {
  best: 'bg-emerald-500',
  ok: 'bg-sky-400',
  ng: 'bg-rose-400',
};

/** 開いたときだけ子を描画する details(合流で同じ部分木が複数回現れるため) */
function LazyDetails({ summary, children }: { summary: ReactNode; children: () => ReactNode }) {
  const [opened, setOpened] = useState(false);
  return (
    <details onToggle={(e) => e.currentTarget.open && setOpened(true)} className="group">
      <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 hover:bg-slate-100">
        <span className="mr-1 inline-block text-slate-400 transition-transform group-open:rotate-90">▸</span>
        {summary}
      </summary>
      <div className="ml-3 border-l-2 border-slate-200 pl-3">{opened ? children() : null}</div>
    </details>
  );
}

function NodeView({ scenario, nodeId, depth }: { scenario: Scenario; nodeId: string; depth: number }) {
  const node = scenario.nodes[nodeId];
  if (depth > 24) return null;

  if (node.type === 'end') {
    return (
      <div className="px-2 py-1.5 text-sm text-slate-500">
        <span className="mr-1">◼</span>
        <span className="font-bold">{MOOD_LABELS[node.mood]}</span> — {node.text}
      </div>
    );
  }

  if (node.type === 'player_choice') {
    return (
      <div>
        {node.prompt && <p className="px-2 pt-1 text-xs text-slate-400">{node.prompt}</p>}
        {node.choices.map((choice, i) => (
          <LazyDetails
            key={i}
            summary={
              <span className="text-sm">
                <span className={`mr-1.5 inline-block size-2 rounded-full ${QUALITY_DOT[choice.quality]}`} />
                <span className="mr-1 text-xs text-slate-400">あなた[{QUALITY_LABELS[choice.quality]}]</span>
                {choice.text}
              </span>
            }
          >
            {() => (
              <div>
                <p className="px-2 py-1 text-xs text-slate-500">{choice.explanation}</p>
                <NodeView scenario={scenario} nodeId={choice.next} depth={depth + 1} />
              </div>
            )}
          </LazyDetails>
        ))}
      </div>
    );
  }

  return (
    <div>
      {node.branches.map((branch, i) => (
        <LazyDetails
          key={i}
          summary={
            <span className="text-sm">
              <span className="mr-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                {CATEGORY_LABELS[branch.category]}
              </span>
              {branch.text}
            </span>
          }
        >
          {() => <NodeView scenario={scenario} nodeId={branch.next} depth={depth + 1} />}
        </LazyDetails>
      ))}
    </div>
  );
}

export default function TreeView({ scenario, onBack, onPlay }: { scenario: Scenario; onBack: () => void; onPlay: () => void }) {
  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-white">{scenario.topic}</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
          </div>
          <h1 className="text-lg font-black leading-snug">ツリー閲覧: {scenario.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{scenario.situation}</p>
        </div>
        <button onClick={onBack} className="shrink-0 text-xs text-slate-400 underline">
          戻る
        </button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
        分岐をタップして、全ルートと解説を予習・復習できます。
        <span className="ml-2 inline-flex items-center gap-2">
          <span><span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />ベスト</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-sky-400" />あり</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-rose-400" />NG</span>
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <NodeView scenario={scenario} nodeId={scenario.entry} depth={0} />
      </div>

      <button
        onClick={onPlay}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-700"
      >
        このシナリオで練習する
      </button>
    </div>
  );
}
