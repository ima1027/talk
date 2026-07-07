import { useMemo, useState } from 'react';
import { scenarios } from '../content';
import { recommendDaily } from '../lib/recommend';
import { allCharacterProgress, isUnlocked } from '../lib/relationship';
import CharacterSection from './CharacterSection';
import {
  addMedal,
  clearChallenge,
  loadChallenge,
  loadHistory,
  loadMedals,
  scenarioStats,
  type ScenarioStats,
} from '../lib/storage';
import {
  completionPercent,
  computeRank,
  computeXp,
  currentTitle,
  nextTitle,
  titleProgress,
  RANK_STYLES,
  ALL_MOODS,
} from '../lib/rewards';
import {
  CATEGORY_LABELS,
  MOOD_EMOJI,
  MOOD_LABELS,
  SCENE_LABELS,
  topicStyle,
  type Category,
  type Scenario,
} from '../engine/types';

const ALL_CATEGORIES: Category[] = ['expand', 'counter', 'short', 'flat'];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function CategoryDots({ seen }: { seen: Category[] }) {
  return (
    <span className="inline-flex items-center gap-1" title="体験した相手の反応タイプ">
      {ALL_CATEGORIES.map((c) => (
        <span
          key={c}
          title={`${CATEGORY_LABELS[c]}${seen.includes(c) ? ': 体験済み' : ': 未体験'}`}
          className={`size-2 rounded-full ${seen.includes(c) ? 'bg-indigo-500' : 'bg-slate-200'}`}
        />
      ))}
    </span>
  );
}

function MoodCollection({ seen }: { seen: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5" title="回収したエンディング">
      {ALL_MOODS.map((m) => (
        <span key={m} title={MOOD_LABELS[m]} className={seen.includes(m) ? '' : 'opacity-20 grayscale'}>
          {MOOD_EMOJI[m]}
        </span>
      ))}
    </span>
  );
}

function ScenarioCard({
  scenario,
  stats,
  onStart,
  onTree,
  highlight,
  weaknessNote,
}: {
  scenario: Scenario;
  stats?: ScenarioStats;
  onStart: () => void;
  onTree: () => void;
  highlight?: boolean;
  weaknessNote?: string;
}) {
  const style = topicStyle(scenario.topic);
  const rank = computeRank(stats);
  return (
    <div
      className={`w-full rounded-2xl border border-l-4 p-4 shadow-sm ${style.border} ${
        highlight ? 'border-y-indigo-300 border-r-indigo-300 bg-indigo-50' : 'border-y-slate-200 border-r-slate-200 bg-white'
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        {highlight && <span className="rounded-full bg-indigo-600 px-2 py-0.5 font-bold text-white">今日の1本</span>}
        {weaknessNote && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 font-bold text-white">苦手対策</span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-white ${style.chip}`}>
          {style.emoji} {scenario.topic}
        </span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{SCENE_LABELS[scenario.scene]}</span>
        {rank && (
          <span className={`rounded-full px-2 py-0.5 font-black ${RANK_STYLES[rank]}`} title="攻略ランク(✕なしクリアでB、反応4種でA、全エンディングでS)">
            {rank}
          </span>
        )}
      </div>
      <div className="font-bold">{scenario.title}</div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{scenario.situation}</p>
      {weaknessNote && <p className="mt-1 text-xs text-amber-700">{weaknessNote}</p>}
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        {stats ? (
          <>
            <span>プレイ {stats.plays}回</span>
            <CategoryDots seen={stats.categoriesSeen} />
            <span>反応 {stats.categoriesSeen.length}/4</span>
            <MoodCollection seen={stats.moodsSeen} />
          </>
        ) : (
          <span className="rounded bg-slate-100 px-1.5 py-0.5">未プレイ</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onStart}
          className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
        >
          練習する
        </button>
        <button
          onClick={onTree}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
        >
          ツリー
        </button>
      </div>
    </div>
  );
}

export default function Home({
  onStart,
  onTree,
}: {
  onStart: (scenarioId: string) => void;
  onTree: (scenarioId: string) => void;
}) {
  const [tick, setTick] = useState(0);
  const history = useMemo(() => loadHistory(), [tick]);
  const stats = useMemo(() => scenarioStats(history), [history]);
  const medals = useMemo(() => loadMedals(), [tick]);
  const challenge = useMemo(() => loadChallenge(), [tick]);
  const characterProgresses = useMemo(() => allCharacterProgress(scenarios, stats), [stats]);

  // 続編(未解禁)は「今日の1本」の候補から外す
  const playable = useMemo(() => scenarios.filter((s) => isUnlocked(s, scenarios, stats)), [stats]);
  const recommendation = useMemo(
    () => recommendDaily(playable, history, todayKey(), new Date()),
    [playable, history],
  );

  const xp = computeXp(history, medals.length);
  const title = currentTitle(xp);
  const next = nextTitle(xp);
  const completion = completionPercent(stats, scenarios.map((s) => s.id));

  const daily = scenarios.find((s) => s.id === recommendation.scenarioId)!;
  // キャラクター続編を持つシナリオはキャラ欄に集約し、一覧からは外す
  const rest = scenarios.filter((s) => s.id !== daily.id && !s.characterId);
  const weaknessNote =
    recommendation.reason === 'weakness' && recommendation.insight
      ? `${recommendation.insight.message.split('。')[0]}。この1本で集中的に練習できる。`
      : undefined;

  const claimMedal = () => {
    if (!challenge) return;
    addMedal({ phrase: challenge.phrase, scenarioId: challenge.scenarioId, at: new Date().toISOString() });
    clearChallenge();
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-black tracking-tight">talk</h1>
          <span className="text-xs text-slate-400" title="実会話メダル">
            🏅 ×{medals.length}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          鍛えるのは「相手の反応タイプを見分けて、次の一手を選ぶ」力。地雷さえ避ければ、会話はだいたい何とかなる。
        </p>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-black">{title.name}</span>
            <span className="text-xs text-slate-400">
              {xp} XP{next ? ` / 次の称号「${next.name}」まであと ${next.xp - xp}` : '(最高位)'}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.round(titleProgress(xp) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>シナリオ攻略度(全{scenarios.length}本、Sランクで満点)</span>
            <span className="font-bold text-slate-600">{completion}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-yellow-400 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </header>

      {challenge && (
        <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
          <h2 className="text-sm font-bold text-yellow-800">🏅 実会話チャレンジ</h2>
          <p className="mt-1 text-sm text-yellow-900">
            「{challenge.phrase}」——この型を、実際の会話のどこかで。
          </p>
          <button
            onClick={claimMedal}
            className="mt-2 w-full rounded-lg bg-yellow-400 py-2 text-sm font-black text-yellow-950 transition hover:bg-yellow-500"
          >
            試せた!(メダル獲得 +20XP)
          </button>
        </section>
      )}

      <section className="space-y-2">
        <ScenarioCard
          scenario={daily}
          stats={stats.get(daily.id)}
          onStart={() => onStart(daily.id)}
          onTree={() => onTree(daily.id)}
          highlight
          weaknessNote={weaknessNote}
        />
      </section>

      <CharacterSection
        progresses={characterProgresses}
        statsMap={stats}
        onStart={onStart}
        onTree={onTree}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-500">シナリオ一覧</h2>
        {rest.map((s) => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            stats={stats.get(s.id)}
            onStart={() => onStart(s.id)}
            onTree={() => onTree(s.id)}
          />
        ))}
      </section>

      <footer className="pt-4 text-center text-xs text-slate-400">
        目的は「面白いことを言う」ではなく、会話のパスを回して気持ちよく終えること。
      </footer>
    </div>
  );
}
