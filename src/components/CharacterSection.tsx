import type { CharacterProgress } from '../lib/relationship';
import { LEVEL_LABELS, lockHint } from '../lib/relationship';
import { computeRank, RANK_STYLES } from '../lib/rewards';
import { scenarios } from '../content';
import type { ScenarioStats } from '../lib/storage';
import { MOOD_EMOJI, type Scenario } from '../engine/types';

const MAX_LEVEL = LEVEL_LABELS.length - 1; // 3

/** 関係レベルのピップ表示(●●○)。level 1〜3 を3つのドットで */
function LevelPips({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`関係レベル: ${LEVEL_LABELS[level]}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span
          key={i}
          className={`text-xs ${i < level ? 'text-rose-500' : 'text-slate-300'}`}
        >
          {i < level ? '♥' : '♡'}
        </span>
      ))}
    </span>
  );
}

function ChapterRow({
  chapter,
  index,
  unlocked,
  stats,
  onStart,
  onTree,
}: {
  chapter: Scenario;
  index: number;
  unlocked: boolean;
  stats?: ScenarioStats;
  onStart: () => void;
  onTree: () => void;
}) {
  const rank = computeRank(stats);
  if (!unlocked) {
    return (
      <li className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
        <span className="text-lg grayscale">🔒</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-400">第{index + 1}話 ???</p>
          <p className="truncate text-xs text-slate-400">{lockHint(chapter, scenarios)}</p>
        </div>
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500">第{index + 1}話</span>
        {rank && (
          <span className={`rounded-full px-1.5 py-0.5 font-black ${RANK_STYLES[rank]}`} title="攻略ランク">
            {rank}
          </span>
        )}
        {stats && stats.moodsSeen.length > 0 && (
          <span className="ml-auto" title="回収したエンディング">
            {stats.moodsSeen
              .map((m) => MOOD_EMOJI[m])
              .join('')}
          </span>
        )}
        {!stats && <span className="ml-auto rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-500">未プレイ</span>}
      </div>
      <p className="text-sm font-bold leading-snug">{chapter.title}</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onStart}
          className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
        >
          {stats ? 'もう一度' : '練習する'}
        </button>
        <button
          onClick={onTree}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
        >
          ツリー
        </button>
      </div>
    </li>
  );
}

function CharacterCard({
  progress,
  statsMap,
  onStart,
  onTree,
}: {
  progress: CharacterProgress;
  statsMap: Map<string, ScenarioStats>;
  onStart: (id: string) => void;
  onTree: (id: string) => void;
}) {
  const { character, chapters, level, label, unlockedCount, nextHint } = progress;
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-2xl shadow-sm">
          {character.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{character.name}</span>
            <LevelPips level={level} />
          </div>
          <p className="text-xs font-bold text-rose-500">{label}</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{character.desc}</p>
      <ul className="mt-3 space-y-2">
        {chapters.map((chapter, i) => (
          <ChapterRow
            key={chapter.id}
            chapter={chapter}
            index={i}
            unlocked={i < unlockedCount}
            stats={statsMap.get(chapter.id)}
            onStart={() => onStart(chapter.id)}
            onTree={() => onTree(chapter.id)}
          />
        ))}
      </ul>
      {nextHint && (
        <p className="mt-2 flex items-start gap-1 text-xs text-rose-600">
          <span>→</span>
          <span>{nextHint}</span>
        </p>
      )}
    </div>
  );
}

export default function CharacterSection({
  progresses,
  statsMap,
  onStart,
  onTree,
}: {
  progresses: CharacterProgress[];
  statsMap: Map<string, ScenarioStats>;
  onStart: (id: string) => void;
  onTree: (id: string) => void;
}) {
  if (progresses.length === 0) return null;
  const maxed = progresses.filter((p) => p.level >= MAX_LEVEL).length;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-slate-500">つながり(続きがある相手)</h2>
        <span className="text-xs text-slate-400" title="気安い仲まで育てた相手">
          気安い仲 {maxed}/{progresses.length}
        </span>
      </div>
      <p className="text-xs text-slate-400">
        同じ相手との会話を✕なしでこなすと関係が育ち、続編が解禁される。
      </p>
      {progresses.map((p) => (
        <CharacterCard
          key={p.character.id}
          progress={p}
          statsMap={statsMap}
          onStart={onStart}
          onTree={onTree}
        />
      ))}
    </section>
  );
}
