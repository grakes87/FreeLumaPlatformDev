'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  X,
  BookOpen,
  Sparkles,
  AlertCircle,
  Camera,
  FileText,
  Heart,
  Brain,
  Palette,
  Languages,
  Play,
  Pause,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { DailyContentAttributes } from '@/lib/db/models/DailyContent';
import type { DailyContentTranslationAttributes } from '@/lib/db/models/DailyContentTranslation';

interface AssignmentDetailProps {
  assignmentId: number;
  onClose: () => void;
}

interface ContentWithTranslations extends DailyContentAttributes {
  translations?: DailyContentTranslationAttributes[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  rejected: { label: 'Rejected', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  assigned: { label: 'Assigned', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  submitted: { label: 'Submitted', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  approved: { label: 'Approved', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  generated: { label: 'Generated', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  empty: { label: 'Empty', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-text dark:text-text-dark">
          {title}
        </h3>
      </div>
      <div className="text-sm leading-relaxed text-text-muted dark:text-text-muted-dark whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

function AudioPlayer({ url, label }: { url: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
    setPlaying(!playing);
  }, [playing]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <span className="text-xs text-text-muted dark:text-text-muted-dark">{label}</span>
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

export function AssignmentDetail({ assignmentId, onClose }: AssignmentDetailProps) {
  const [content, setContent] = useState<ContentWithTranslations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchContent() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/creator/content/${assignmentId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load content');
        }
        const data = await res.json();
        if (!cancelled) {
          setContent(data.content);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContent();
    return () => { cancelled = true; };
  }, [assignmentId]);

  // Lock body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const statusCfg = content ? STATUS_CONFIG[content.status] ?? STATUS_CONFIG.empty : STATUS_CONFIG.empty;
  const canRecord = content && (content.status === 'assigned' || content.status === 'rejected');

  const overlay = (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg dark:bg-bg-dark">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-border-dark">
        <div className="flex items-center gap-2">
          {content && (
            <>
              <span className="text-sm font-medium text-text dark:text-text-dark">
                {formatDate(content.post_date)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  content.mode === 'bible'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                )}
              >
                {content.mode === 'bible' ? (
                  <BookOpen className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {content.mode === 'bible' ? 'Bible' : 'Positivity'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusCfg.bg,
                  statusCfg.text
                )}
              >
                {statusCfg.label}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Content body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {content && !loading && (
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Rejection note */}
            {content.rejection_note && (
              <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950/30">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Rejection Note
                  </p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {content.rejection_note}
                  </p>
                </div>
              </div>
            )}

            {/* Camera Script (prominent) */}
            {content.camera_script && (
              <Section icon={Camera} title="Camera Script">
                {content.camera_script}
              </Section>
            )}

            {/* Verse / Quote */}
            {content.verse_reference && (
              <Section icon={BookOpen} title={`Verse: ${content.verse_reference}`}>
                {content.content_text}
              </Section>
            )}

            {!content.verse_reference && content.content_text && (
              <Section icon={FileText} title="Quote">
                {content.content_text}
              </Section>
            )}

            {/* Devotional Reflection */}
            {content.devotional_reflection && (
              <Section icon={Heart} title="Devotional Reflection">
                {content.devotional_reflection}
              </Section>
            )}

            {/* Meditation Script */}
            {content.meditation_script && (
              <Section icon={Brain} title="Meditation Script">
                {content.meditation_script}
              </Section>
            )}

            {/* Background Prompt */}
            {content.background_prompt && (
              <Section icon={Palette} title="Background Prompt">
                {content.background_prompt}
              </Section>
            )}

            {/* Translations with audio + SRT */}
            {content.translations && content.translations.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
                <div className="mb-3 flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-text dark:text-text-dark">
                    Translations
                  </h3>
                </div>
                <div className="space-y-3">
                  {content.translations.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-border/50 p-3 dark:border-border-dark/50"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
                        {t.translation_code}
                      </p>
                      <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
                        {t.translated_text}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {t.audio_url && (
                          <AudioPlayer
                            url={t.audio_url}
                            label={`${t.translation_code} audio`}
                          />
                        )}
                        {t.audio_srt_url && (
                          <a
                            href={t.audio_srt_url}
                            download
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            SRT
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {canRecord && (
        <div className="border-t border-border px-4 py-3 dark:border-border-dark">
          <div className="mx-auto max-w-2xl">
            <Link
              href={`/creator/record/${assignmentId}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <Camera className="h-4 w-4" />
              Record Video
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
