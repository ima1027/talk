import { useMemo, useState } from 'react';
import { scenarios } from '../content';
import { isUnlocked } from '../lib/relationship';
import { loadHistory, scenarioStats } from '../lib/storage';
import {
  CATEGORY_LABELS,
  MOOD_EMOJI,
  QUALITY_LABELS,
  SCENE_AVATARS,
  SCENE_LABELS,
  topicStyle,
  type Quality,
  type Scenario,
  type Scene,
} from '../engine/types';

// 伴走モード(要件 §2 将来スコープ→M4):
// 実会話の直前・最中に開き、練習モードと同じツリーを「手動分岐」でたどる。
// 相手の返答はランダムではなく、実際に返ってきた内容に一番近い分岐を自分でタップする。

const QUALITY_CARD_STYLES: Record<Quality, string> = {
  best: 'border-emerald-300 bg-emerald-50/60',
  ok: 'border-sky-200 bg-white',
  ng: 'border-rose-300 bg-rose-50/60',
};

const QUALITY_BADGE_STYLES: Record<Quality, string> = {
  best: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ok: 'bg-sky-100 text-sky-800 border-sky-300',
  ng: 'bg-rose-100 text-rose-800 border-rose-300',
};

/** 実会話中に開く前提の場面選択(「いま目の前にいる相手」で選ぶ) */
function ScenePicker({ onPick }: { onPick: (scenario: Scenario) => void }) {
  const stats = useMemo(() => scenarioStats(loadHistory()), []);
  const playable = useMemo(() => scenarios.filter((s) => isUnlocked(s, scenarios, stats)), [stats]);
  const sceneOrder: Scene[] = ['first_casual', 'peer_known', 'senior_known', 'first_formal'];
  const groups = sceneOrder
    .map((scene) => ({ scene, items: playable.filter((s) => s.scene === scene) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4 pb-8">
      <header>
        <h1 className="text-xl font-black">伴走モード</h1>
        <p className="text-sm text-slate-500">
          実際の会話の直前・最中に。一手候補をカンペとして見ながら、相手が実際に返した内容に一番近い分岐をタップして進める。
        </p>
      </header>

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-900">
        <p className="font-bold">使い方</p>
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>いまの場面に近いシナリオを選ぶ</li>
          <li>候補から言えそうな一手を選んで、実際に言ってみる</li>
          <li>相手の返答に一番近い反応をタップ → 次の一手候補が出る</li>
        </ol>
        <p className="mt-1 text-indigo-700">そのまま読み上げなくていい。「型」の再現が目的。</p>
      </section>

      {groups.map(({ scene, items }) => (
        <section key={scene} className="space-y-2">
          <h2 className="text-sm font-bold text-slate-500">
            {SCENE_AVATARS[scene]} {SCENE_LABELS[scene]}
          </h2>
          {items.map((s) => {
            const style = topicStyle(s.topic);
            return (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                className={`w-full rounded-2xl border border-l-4 border-y-slate-200 border-r-slate-200 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50 ${style.border}`}
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-xs">
                  <span className={`rounded-full px-2 py-0.5 text-white ${style.chip}`}>
                    {style.emoji} {s.topic}
                  </span>
                  {s.chapter && s.chapter > 1 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500">続編</span>
                  )}
                </div>
                <p className="text-sm font-bold leading-snug">{s.title}</p>
                {s.partnerNote && <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.partnerNote}</p>}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function CompanionRun({ scenario, onExit }: { scenario: Scenario; onExit: () => void }) {
  // たどったノードの履歴(戻る操作用。実会話中の誤タップに備える)
  const [path, setPath] = useState<string[]>([scenario.entry]);
  const nodeId = path[path.length - 1];
  const node = scenario.nodes[nodeId];
  const style = topicStyle(scenario.topic);

  const go = (next: string) => setPath((p) => [...p, next]);
  const back = () => setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs">
            <span className={`rounded-full px-2 py-0.5 text-white ${style.chip}`}>
              {style.emoji} {scenario.topic}
            </span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
          </div>
          <h1 className="text-base font-black leading-snug">{scenario.title}</h1>
        </div>
        <button
          onClick={onExit}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500"
        >
          終了
        </button>
      </header>

      {scenario.partnerNote && path.length === 1 && (
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
          {SCENE_AVATARS[scenario.scene]} {scenario.partnerNote}
        </p>
      )}

      {node.type === 'player_choice' && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-indigo-700">🗣️ あなたの一手候補 — 言えそうなものをどうぞ</h2>
          {node.prompt && <p className="text-xs text-slate-400">{node.prompt}</p>}
          <ul className="space-y-2">
            {node.choices.map((choice, i) => (
              <li key={i}>
                <button
                  onClick={() => go(choice.next)}
                  className={`w-full rounded-2xl border p-3 text-left shadow-sm transition hover:brightness-[0.98] ${QUALITY_CARD_STYLES[choice.quality]}`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold ${QUALITY_BADGE_STYLES[choice.quality]}`}
                    >
                      {QUALITY_LABELS[choice.quality]}
                    </span>
                    {(choice.techniques ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="font-medium leading-snug">{choice.text}</p>
                  <p className="mt-1 text-xs text-slate-500">{choice.explanation}</p>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">言ったらタップ。✕は「避けるべき地雷」のメモとして見る。</p>
        </section>
      )}

      {node.type === 'partner_response' && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-600">
            {SCENE_AVATARS[scenario.scene]} 相手はどう返した? — 一番近いものをタップ
          </h2>
          <ul className="space-y-2">
            {node.branches.map((branch, i) => (
              <li key={i}>
                <button
                  onClick={() => go(branch.next)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left shadow-sm transition hover:bg-slate-100"
                >
                  <span className="mb-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    {CATEGORY_LABELS[branch.category]}
                  </span>
                  <p className="leading-snug">{branch.text}</p>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">
            ぴったりでなくてOK。「広がった/聞き返された/短い/そっけない」の型で選ぶ。
          </p>
        </section>
      )}

      {node.type === 'end' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-3xl">{MOOD_EMOJI[node.mood]}</p>
          <p className="mt-2 text-sm font-bold">{node.text}</p>
          <p className="mt-1 text-xs text-slate-500">
            ここまで来たら、あとは流れにまかせて大丈夫。終わり方が良ければ雑談は成功。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setPath([scenario.entry])}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-600"
            >
              最初から
            </button>
            <button
              onClick={onExit}
              className="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white"
            >
              場面を選び直す
            </button>
          </div>
        </section>
      )}

      {path.length > 1 && node.type !== 'end' && (
        <button onClick={back} className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-400">
          ← ひとつ戻る(タップミスした時に)
        </button>
      )}
    </div>
  );
}

export default function Companion() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  if (!scenario) return <ScenePicker onPick={setScenario} />;
  return <CompanionRun key={scenario.id} scenario={scenario} onExit={() => setScenario(null)} />;
}
