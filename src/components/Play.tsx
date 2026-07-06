import { useEffect, useMemo, useRef, useState } from 'react';
import { applyChoice, createSession, shuffledIndices, type Session } from '../engine/engine';
import { loadHistory, scenarioStats } from '../lib/storage';
import {
  CATEGORY_LABELS,
  MOOD_EMOJI,
  MOOD_LABELS,
  QUALITY_LABELS,
  SCENE_AVATARS,
  SCENE_LABELS,
  topicStyle,
  type Category,
  type Choice,
  type Quality,
  type Scenario,
} from '../engine/types';

const REVEAL_DELAY_MS = 700;

const FEEDBACK_STYLES: Record<Quality, string> = {
  best: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  ok: 'border-sky-200 bg-sky-50 text-sky-900',
  ng: 'border-rose-200 bg-rose-50 text-rose-900',
};

function PartnerBubble({ text, category, avatar }: { text: string; category?: Category; avatar: string }) {
  return (
    <div className="flex items-end justify-start gap-2">
      <span className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg">
        {avatar}
      </span>
      <div className="max-w-[80%]">
        {category && (
          <span className="mb-0.5 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            {CATEGORY_LABELS[category]}
          </span>
        )}
        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          {text}
        </div>
      </div>
    </div>
  );
}

function PlayerBubble({ text, choice }: { text: string; choice: Choice }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-white shadow-sm">
        {text}
      </div>
      <div className={`max-w-[85%] rounded-lg border px-3 py-1.5 text-xs ${FEEDBACK_STYLES[choice.quality]}`}>
        <span className="font-bold">{QUALITY_LABELS[choice.quality]}</span>
        <span className="ml-1">{choice.explanation}</span>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start pl-10">
      <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
  const style = topicStyle(scenario.topic);
  const avatar = SCENE_AVATARS[scenario.scene];

  // 未体験の反応タイプが出やすくなる重み補正(成功パターンを効率よく回収できるように)
  const boost = useMemo(() => {
    const seen = new Set(scenarioStats(loadHistory()).get(scenario.id)?.categoriesSeen ?? []);
    return (category: Category) => (seen.has(category) ? 1 : 3);
  }, [scenario.id]);

  const currentNode = scenario.nodes[session.currentNodeId];
  const playerTurns = session.log.filter((e) => e.kind === 'player').length;

  // 選択肢の表示順はノードごとにシャッフルする(◎が常に同じ位置に来ないように)
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
    setSession(applyChoice(scenario, session, index, Math.random, boost));
    setRevealing(true);
  };

  // 演出中は最後のプレイヤー発言(と即時解説)までを表示し、相手の返答はタイピング表示にする
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
            <span className={`rounded-full px-2 py-0.5 text-white ${style.chip}`}>
              {style.emoji} {scenario.topic}
            </span>
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
        {scenario.partnerNote && (
          <p className="mt-1">
            <span className="font-bold">相手について知っていること:</span> {scenario.partnerNote}
          </p>
        )}
        <p className="mt-1 text-xs text-amber-700">ねらい: {scenario.guide}</p>
      </div>

      <div className="flex-1 space-y-3">
        {visibleLog.map((entry, i) => {
          const node = scenario.nodes[entry.nodeId];
          if (entry.kind === 'player' && node.type === 'player_choice') {
            const choice = node.choices[entry.choiceIndex];
            return <PlayerBubble key={i} text={choice.text} choice={choice} />;
          }
          if (entry.kind === 'partner' && node.type === 'partner_response') {
            const branch = node.branches[entry.branchIndex];
            return <PartnerBubble key={i} text={branch.text} category={branch.category} avatar={avatar} />;
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
            <p className="font-bold">
              {MOOD_EMOJI[endNode.mood]} {MOOD_LABELS[endNode.mood]}
            </p>
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
