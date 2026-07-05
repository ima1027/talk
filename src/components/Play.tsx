import { useEffect, useMemo, useRef, useState } from 'react';
import { applyChoice, createSession, shuffledIndices, type Session } from '../engine/engine';
import { MOOD_LABELS, SCENE_LABELS, type Scenario } from '../engine/types';

const REVEAL_DELAY_MS = 700;

function PartnerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        {text}
      </div>
    </div>
  );
}

function PlayerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="inline-flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
          <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
        </span>
      </div>
    </div>
  );
}

export default function Play({
  scenario,
  onFinish,
  onQuit,
}: {
  scenario: Scenario;
  onFinish: (session: Session) => void;
  onQuit: () => void;
}) {
  const [session, setSession] = useState<Session>(() => createSession(scenario));
  const [revealing, setRevealing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentNode = scenario.nodes[session.currentNodeId];
  const playerTurns = session.log.filter((e) => e.kind === 'player').length;

  // 選択肢の表示順はノードごとにシャッフルする(bestが常に先頭に来ないように)
  const choiceOrder = useMemo(() => {
    if (currentNode.type !== 'player_choice') return [];
    return shuffledIndices(currentNode.choices.length, Math.random);
  }, [session.currentNodeId, currentNode]);

  useEffect(() => {
    if (!revealing) return;
    const timer = setTimeout(() => setRevealing(false), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [revealing]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.log.length, revealing]);

  const select = (index: number) => {
    if (revealing || session.finished) return;
    setSession(applyChoice(scenario, session, index, Math.random));
    setRevealing(true);
  };

  // 表示するログ: 演出中は最後のプレイヤー発言までにとどめる
  const visibleLog = revealing
    ? session.log.slice(0, session.log.findLastIndex((e) => e.kind === 'player') + 1)
    : session.log;
  const showResult = session.finished && !revealing;
  const endNode = currentNode.type === 'end' ? currentNode : null;

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-white">{scenario.topic}</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
            <span className="text-slate-400">{playerTurns}手目</span>
          </div>
          <h1 className="text-sm font-bold leading-snug">{scenario.title}</h1>
        </div>
        <button onClick={onQuit} className="shrink-0 text-xs text-slate-400 underline">
          やめる
        </button>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-bold">場面</p>
        <p>{scenario.situation}</p>
        <p className="mt-1 text-xs text-amber-700">ねらい: {scenario.guide}</p>
      </div>

      <div className="flex-1 space-y-3">
        {visibleLog.map((entry, i) => {
          const node = scenario.nodes[entry.nodeId];
          if (entry.kind === 'player' && node.type === 'player_choice') {
            return <PlayerBubble key={i} text={node.choices[entry.choiceIndex].text} />;
          }
          if (entry.kind === 'partner' && node.type === 'partner_response') {
            return <PartnerBubble key={i} text={node.branches[entry.branchIndex].text} />;
          }
          return null;
        })}
        {revealing && <TypingDots />}

        {showResult && endNode && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              endNode.mood === 'good'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : endNode.mood === 'awkward'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <p className="font-bold">{MOOD_LABELS[endNode.mood]}</p>
            <p className="mt-1">{endNode.text}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 bg-slate-100/95 px-4 pb-2 pt-3 backdrop-blur">
        {!revealing && !session.finished && currentNode.type === 'player_choice' && (
          <div className="space-y-2">
            {currentNode.prompt && <p className="text-xs text-slate-500">{currentNode.prompt}</p>}
            {choiceOrder.map((index) => (
              <button
                key={index}
                onClick={() => select(index)}
                className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50 active:scale-[0.99]"
              >
                {currentNode.choices[index].text}
              </button>
            ))}
          </div>
        )}
        {showResult && (
          <button
            onClick={() => onFinish(session)}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            ふりかえりへ
          </button>
        )}
      </div>
    </div>
  );
}
