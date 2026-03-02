'use client';

import type { ReactionWeights } from '@/lib/ai-engagement/types';
import { REACTION_PRESETS } from '@/lib/ai-engagement/reaction-generator';

interface GenerationConfigProps {
  commentsPerItem: number;
  onCommentsChange: (n: number) => void;
  reactionsPerItem: number;
  onReactionsChange: (n: number) => void;
  reactionWeights: ReactionWeights;
  onWeightsChange: (w: ReactionWeights) => void;
  selectedCount: number;
  generating: boolean;
  onGenerate: () => void;
}

type PresetKey = keyof typeof REACTION_PRESETS;

const PRESET_LABELS: Record<PresetKey, string> = {
  balanced: 'Balanced',
  'love-heavy': 'Love Heavy',
  'pray-heavy': 'Pray Heavy',
};

export default function GenerationConfig({
  commentsPerItem,
  onCommentsChange,
  reactionsPerItem,
  onReactionsChange,
  reactionWeights,
  onWeightsChange,
  selectedCount,
  generating,
  onGenerate,
}: GenerationConfigProps) {
  const setPreset = (key: PresetKey) => {
    onWeightsChange({ ...REACTION_PRESETS[key] });
  };

  return (
    <div className="space-y-5">
      {/* Comments slider */}
      <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text dark:text-text-dark">
            Comments per item
          </label>
          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
            {commentsPerItem}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          value={commentsPerItem}
          onChange={(e) => onCommentsChange(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-text-muted dark:text-text-muted-dark">
          <span>0</span>
          <span>15</span>
        </div>
      </div>

      {/* Reactions slider */}
      <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text dark:text-text-dark">
            Reactions per item
          </label>
          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
            {reactionsPerItem}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={60}
          value={reactionsPerItem}
          onChange={(e) => onReactionsChange(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-text-muted dark:text-text-muted-dark">
          <span>0</span>
          <span>60</span>
        </div>
      </div>

      {/* Reaction distribution */}
      <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-text dark:text-text-dark">
            Reaction Distribution
          </span>
          <div className="flex gap-1">
            {(Object.keys(REACTION_PRESETS) as PresetKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className="rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:text-text dark:bg-surface-hover-dark dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                {PRESET_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(['like', 'love', 'haha', 'wow', 'sad', 'pray'] as const).map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-xs capitalize text-text-muted dark:text-text-muted-dark">
                {key === 'like' ? '👍 Like' : key === 'love' ? '❤️ Love' : key === 'haha' ? '😂 Haha' : key === 'wow' ? '😮 Wow' : key === 'sad' ? '😢 Sad' : '🙏 Pray'}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={reactionWeights[key] ?? 0}
                onChange={(e) => onWeightsChange({ ...reactionWeights, [key]: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Summary + Generate button */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
        <div className="text-sm text-text-muted dark:text-text-muted-dark">
          <strong className="text-text dark:text-text-dark">{selectedCount}</strong> items selected
          {' · '}
          ~{selectedCount * commentsPerItem} comments + ~{selectedCount * reactionsPerItem} reactions
        </div>
        <button
          onClick={onGenerate}
          disabled={generating || selectedCount === 0}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
