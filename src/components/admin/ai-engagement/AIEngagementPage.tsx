'use client';

import { useState, useCallback } from 'react';
import TargetSelector from './TargetSelector';
import GenerationConfig from './GenerationConfig';
import StagedItemsReview from './StagedItemsReview';
import type {
  EngagementTargetType,
  ContentItem,
  StagedComment,
  StagedReaction,
  ReactionWeights,
  GenerateResponse,
  PublishResponse,
} from '@/lib/ai-engagement/types';
import { REACTION_PRESETS } from '@/lib/ai-engagement/reaction-generator';

type Step = 'select' | 'configure' | 'review';

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'select', label: '1. Select Targets' },
  { key: 'configure', label: '2. Configure & Generate' },
  { key: 'review', label: '3. Review & Publish' },
];

export default function AIEngagementPage() {
  // Step state
  const [step, setStep] = useState<Step>('select');

  // Target selection
  const [type, setType] = useState<EngagementTargetType>('daily');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Generation config
  const [commentsPerItem, setCommentsPerItem] = useState(6);
  const [reactionsPerItem, setReactionsPerItem] = useState(25);
  const [reactionWeights, setReactionWeights] = useState<ReactionWeights>({
    ...REACTION_PRESETS.balanced,
  });

  // Generated data
  const [generating, setGenerating] = useState(false);
  const [comments, setComments] = useState<StagedComment[]>([]);
  const [reactions, setReactions] = useState<StagedReaction[]>([]);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  const selectedItems = items.filter((i) => selectedIds.has(i.id));

  const handleGenerate = useCallback(async () => {
    if (selectedItems.length === 0) return;
    setGenerating(true);
    setComments([]);
    setReactions([]);

    try {
      const res = await fetch('/api/admin/ai-engagement/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          targets: selectedItems.map((item) => ({
            content_id: item.id,
            content_text: item.content_text,
            verse_reference: item.verse_reference,
            mode: item.mode,
            category_name: item.category_name,
          })),
          comments_per_item: commentsPerItem,
          reactions_per_item: reactionsPerItem,
          reaction_weights: reactionWeights,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data: GenerateResponse = await res.json();
      setComments(data.comments);
      setReactions(data.reactions);
      setStep('review');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [selectedItems, type, commentsPerItem, reactionsPerItem, reactionWeights]);

  const handleRemoveComment = useCallback((index: number) => {
    setComments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch('/api/admin/ai-engagement/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          comments: comments.map((c) => ({
            user_id: c.user_id,
            content_id: c.content_id,
            body: c.body,
          })),
          reactions: reactions.map((r) => ({
            user_id: r.user_id,
            content_id: r.content_id,
            reaction_type: r.reaction_type,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Publish failed');
      }

      const data: PublishResponse = await res.json();
      setPublishResult(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [type, comments, reactions]);

  const handleReset = () => {
    setStep('select');
    setComments([]);
    setReactions([]);
    setPublishResult(null);
    setSelectedIds(new Set());
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
          AI Engagement
        </h1>
        <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
          Generate AI-powered comments and reactions for daily content and verse categories.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex gap-1">
        {STEP_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              // Only allow going back
              if (key === 'select') setStep('select');
              else if (key === 'configure' && (step === 'configure' || step === 'review'))
                setStep('configure');
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              step === key
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-muted dark:bg-surface-hover-dark dark:text-text-muted-dark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Publish success */}
      {publishResult && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <h3 className="font-bold text-green-800 dark:text-green-300">Published Successfully!</h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            {publishResult.comments_inserted} comments and {publishResult.reactions_inserted} reactions inserted.
          </p>
          <button
            onClick={handleReset}
            className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Start New Batch
          </button>
        </div>
      )}

      {/* Step content */}
      {!publishResult && (
        <>
          {step === 'select' && (
            <>
              <TargetSelector
                type={type}
                onTypeChange={setType}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                items={items}
                onItemsLoaded={setItems}
              />
              {selectedIds.size > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setStep('configure')}
                    className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Next: Configure
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'configure' && (
            <GenerationConfig
              commentsPerItem={commentsPerItem}
              onCommentsChange={setCommentsPerItem}
              reactionsPerItem={reactionsPerItem}
              onReactionsChange={setReactionsPerItem}
              reactionWeights={reactionWeights}
              onWeightsChange={setReactionWeights}
              selectedCount={selectedIds.size}
              generating={generating}
              onGenerate={handleGenerate}
            />
          )}

          {step === 'review' && (
            <StagedItemsReview
              type={type}
              items={items}
              comments={comments}
              reactions={reactions}
              onRemoveComment={handleRemoveComment}
              onPublish={handlePublish}
              publishing={publishing}
            />
          )}
        </>
      )}
    </div>
  );
}
