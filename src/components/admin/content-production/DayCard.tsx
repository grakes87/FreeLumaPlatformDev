'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RefreshCw,
  Loader2,
  User,
  Calendar,
  FileText,
  Copy,
  Upload,
  Video,
  AudioLines,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';

export interface DayTranslation {
  translation_code: string;
  has_translated_text: boolean;
  has_audio: boolean;
  has_srt: boolean;
  has_chapter_text: boolean;
  audio_url: string | null;
}

export interface DayData {
  id: number;
  post_date: string;
  status: string;
  creator: {
    id: number;
    name: string;
    user_id: number | null;
    is_ai?: boolean;
    heygen_avatar_id?: string | null;
    user?: {
      id: number;
      avatar_url: string | null;
      avatar_color: string | null;
    } | null;
  } | null;
  title: string | null;
  verse_reference: string | null;
  has_camera_script: boolean;
  has_devotional: boolean;
  has_meditation: boolean;
  meditation_script: string | null;
  has_meditation_audio: boolean;
  meditation_audio_url: string | null;
  has_background_prompt: boolean;
  has_background_video: boolean;
  has_lumashort_video: boolean;
  lumashort_video_url: string | null;
  background_prompt: string | null;
  translations: DayTranslation[];
}

interface DayCardProps {
  day: DayData;
  mode: 'bible' | 'positivity';
  expectedTranslations?: string[];
  onRegenerate?: (dayId: number, field: string, translationCode?: string) => void | Promise<void>;
  onVideoUpload?: (dayId: number, postDate: string, file: File) => void | Promise<void>;
  onGenerateHeygenVideo?: (dayId: number, postDate: string) => void | Promise<void>;
}

const STATUS_COLORS: Record<string, string> = {
  empty: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  generated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  assigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function FieldBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
        has
          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      )}
    >
      {has ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function DayCard({ day, mode, expectedTranslations, onRegenerate, onVideoUpload, onGenerateHeygenVideo }: DayCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMeditation, setCopiedMeditation] = useState(false);
  const [showMeditationScript, setShowMeditationScript] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<Array<{
    id: number;
    field: string;
    translation_code: string | null;
    status: 'started' | 'success' | 'failed';
    error_message: string | null;
    duration_ms: number | null;
    created_at: string;
  }>>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/content-production/logs?daily_content_id=${day.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data ?? json);
      }
    } finally {
      setLogsLoading(false);
    }
  }, [day.id]);

  // Refresh logs when showLogs toggled on, or after a regeneration completes
  useEffect(() => {
    if (showLogs && expanded) fetchLogs();
  }, [showLogs, expanded, regenerating.size, fetchLogs]);

  const handleRegenerate = useCallback(
    async (e: React.MouseEvent, field: string, translationCode?: string) => {
      e.stopPropagation();
      if (!onRegenerate) return;
      const key = translationCode ? `${field}_${translationCode}` : field;
      setRegenerating((prev) => new Set(prev).add(key));
      try {
        await onRegenerate(day.id, field, translationCode);
      } finally {
        setRegenerating((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [day.id, onRegenerate]
  );

  const dateLabel = new Date(day.post_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const statusClass = STATUS_COLORS[day.status] || STATUS_COLORS.empty;

  return (
    <div className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Calendar className="h-4 w-4 shrink-0 text-text-muted dark:text-text-muted-dark" />
        <span className="min-w-[7rem] text-sm font-medium text-text dark:text-text-dark">
          {dateLabel}
        </span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusClass)}>
          {day.status}
        </span>
        {day.title && (
          <span className="truncate text-sm text-text-muted dark:text-text-muted-dark">
            {day.title}
          </span>
        )}
        {day.creator && (
          <span className="ml-auto flex items-center gap-1 text-xs text-text-muted dark:text-text-muted-dark">
            <User className="h-3 w-3" />
            {day.creator.name}
          </span>
        )}
        <span className="ml-auto shrink-0 text-text-muted dark:text-text-muted-dark">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 dark:border-border-dark">
          {day.status === 'empty' ? (
            <p className="text-sm italic text-text-muted dark:text-text-muted-dark">
              No content generated for this day.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    Date
                  </p>
                  <p className="text-text dark:text-text-dark">{day.post_date}</p>
                </div>
                {day.verse_reference && (
                  <div>
                    <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                      Verse
                    </p>
                    <p className="text-text dark:text-text-dark">{day.verse_reference}</p>
                  </div>
                )}
              </div>

              {/* Field completeness */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                  Content Fields
                </p>
                <div className="flex flex-wrap gap-2">
                  <FieldBadge has={day.has_camera_script} label="Camera Script" />
                  {mode === 'positivity' && (
                    <>
                      <FieldBadge has={day.has_meditation} label="Meditation Script" />
                      <FieldBadge has={day.has_meditation_audio} label="Meditation Audio" />
                    </>
                  )}
                  <FieldBadge has={day.has_background_prompt} label="BG Prompt" />
                  <FieldBadge has={day.has_background_video} label="BG Video" />
                  <FieldBadge has={day.has_lumashort_video} label="Video" />
                </div>
              </div>

              {/* Background prompt text + video upload */}
              {day.has_background_prompt && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                      Background Prompt
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(day.background_prompt || '');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="rounded-lg border border-border bg-surface-hover/30 px-3 py-2 text-sm text-text dark:border-border-dark dark:bg-surface-hover-dark/30 dark:text-text-dark">
                    {day.background_prompt}
                  </p>
                </div>
              )}

              {/* Meditation script text + audio generation (positivity mode) */}
              {mode === 'positivity' && day.has_meditation && day.meditation_script && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMeditationScript(!showMeditationScript);
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium uppercase text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                    >
                      {showMeditationScript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Meditation Script
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(day.meditation_script || '');
                        setCopiedMeditation(true);
                        setTimeout(() => setCopiedMeditation(false), 2000);
                      }}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      {copiedMeditation ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedMeditation ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {showMeditationScript && (
                    <p className="rounded-lg border border-border bg-surface-hover/30 px-3 py-2 text-sm text-text dark:border-border-dark dark:bg-surface-hover-dark/30 dark:text-text-dark">
                      {day.meditation_script}
                    </p>
                  )}
                  {/* Generate Meditation Audio button */}
                  {!day.has_meditation_audio && onRegenerate && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenerating.has('meditation_audio')}
                        onClick={(e) => handleRegenerate(e, 'meditation_audio')}
                      >
                        {regenerating.has('meditation_audio')
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <AudioLines className="h-3 w-3" />}
                        Generate Meditation Audio
                      </Button>
                    </div>
                  )}
                  {/* Show audio player if meditation audio exists */}
                  {day.has_meditation_audio && day.meditation_audio_url && (
                    <div className="mt-2">
                      <audio
                        controls
                        src={day.meditation_audio_url}
                        className="h-8 w-full"
                      >
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              )}

              {/* Upload background video */}
              {day.has_background_prompt && onVideoUpload && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    Background Video
                  </p>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs transition-colors',
                      'hover:border-primary hover:bg-primary/5',
                      'dark:border-border-dark dark:hover:border-primary dark:hover:bg-primary/5',
                      uploadingVideo && 'pointer-events-none opacity-60'
                    )}
                  >
                    {uploadingVideo
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      : <Upload className="h-3.5 w-3.5 text-text-muted dark:text-text-muted-dark" />}
                    <span className="text-text-muted dark:text-text-muted-dark">
                      {uploadingVideo ? 'Uploading...' : day.has_background_video ? 'Replace background video (.mp4)' : 'Upload .mp4 background video'}
                    </span>
                    <input
                      type="file"
                      accept=".mp4,video/mp4"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !onVideoUpload) return;
                        e.target.value = '';
                        setUploadingVideo(true);
                        try {
                          await onVideoUpload(day.id, day.post_date, file);
                        } finally {
                          setUploadingVideo(false);
                        }
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Generate AI Video button */}
              {onGenerateHeygenVideo && day.creator?.is_ai && day.creator?.heygen_avatar_id && !day.has_lumashort_video && day.has_camera_script && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    AI Video Generation
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={regenerating.has('heygen_video')}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setRegenerating((prev) => new Set(prev).add('heygen_video'));
                      try {
                        await onGenerateHeygenVideo(day.id, day.post_date);
                      } finally {
                        setRegenerating((prev) => {
                          const next = new Set(prev);
                          next.delete('heygen_video');
                          return next;
                        });
                      }
                    }}
                  >
                    {regenerating.has('heygen_video')
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Video className="h-3 w-3" />}
                    Generate AI Video ({day.creator.name})
                  </Button>
                </div>
              )}

              {/* Regenerate buttons */}
              {onRegenerate && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                    Regenerate Fields
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!day.has_camera_script && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenerating.has('camera_script')}
                        onClick={(e) => handleRegenerate(e, 'camera_script')}
                      >
                        {regenerating.has('camera_script')
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        Camera Script
                      </Button>
                    )}
                    {mode === 'positivity' && !day.has_meditation && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenerating.has('meditation_script')}
                        onClick={(e) => handleRegenerate(e, 'meditation_script')}
                      >
                        {regenerating.has('meditation_script')
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        Meditation Script
                      </Button>
                    )}
                    {mode === 'positivity' && day.has_meditation && !day.has_meditation_audio && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenerating.has('meditation_audio')}
                        onClick={(e) => handleRegenerate(e, 'meditation_audio')}
                      >
                        {regenerating.has('meditation_audio')
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <AudioLines className="h-3 w-3" />}
                        Meditation Audio
                      </Button>
                    )}
                    {!day.has_background_prompt && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenerating.has('background_prompt')}
                        onClick={(e) => handleRegenerate(e, 'background_prompt')}
                      >
                        {regenerating.has('background_prompt')
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        BG Prompt
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Translation status */}
              {(() => {
                // Use expectedTranslations if provided, otherwise just show what exists
                const codes = expectedTranslations && expectedTranslations.length > 0
                  ? expectedTranslations
                  : day.translations.map((t) => t.translation_code);
                if (codes.length === 0) return null;

                const existingMap = new Map(
                  day.translations.map((t) => [t.translation_code, t])
                );

                return (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                      Translations ({codes.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {codes.map((code) => {
                        const t = existingMap.get(code);
                        if (!t) {
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            >
                              <X className="h-3 w-3" />
                              {code}
                            </span>
                          );
                        }
                        const complete = t.has_translated_text && t.has_audio && t.has_srt && t.has_chapter_text;
                        return (
                          <span
                            key={code}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
                              complete
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            )}
                          >
                            {code}
                            {complete ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="text-[10px]">
                                {[
                                  !t.has_translated_text && 'text',
                                  !t.has_audio && 'audio',
                                  !t.has_srt && 'srt',
                                  !t.has_chapter_text && 'chapter',
                                ].filter(Boolean).join(',')}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    {/* Translation regenerate buttons */}
                    {onRegenerate && (() => {
                      const missingTranslations: { code: string; missing: string[]; hasChapterText: boolean }[] = [];
                      for (const code of codes) {
                        const t = existingMap.get(code);
                        if (!t) {
                          missingTranslations.push({ code, missing: ['all'], hasChapterText: false });
                        } else {
                          const parts: string[] = [];
                          if (!t.has_translated_text || !t.has_chapter_text) parts.push('text');
                          if (!t.has_audio || !t.has_srt) parts.push('tts');
                          if (parts.length > 0) {
                            missingTranslations.push({ code, missing: parts, hasChapterText: t.has_chapter_text });
                          }
                        }
                      }
                      if (missingTranslations.length === 0) return null;

                      return (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-text-muted dark:text-text-muted-dark">
                            Regenerate Translations
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {missingTranslations.map(({ code, missing }) => {
                              const key = `chapter_text_${code}`;
                              return (missing.includes('all') || missing.includes('text')) ? (
                                <Button
                                  key={`text-${code}`}
                                  size="sm"
                                  variant="outline"
                                  disabled={regenerating.has(key)}
                                  onClick={(e) => handleRegenerate(e, 'chapter_text', code)}
                                >
                                  {regenerating.has(key)
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <RefreshCw className="h-3 w-3" />}
                                  {code} Text
                                </Button>
                              ) : null;
                            })}
                            {missingTranslations.map(({ code, missing, hasChapterText }) => {
                              const key = `tts_${code}`;
                              return (missing.includes('all') || missing.includes('tts')) && hasChapterText ? (
                                <Button
                                  key={`tts-${code}`}
                                  size="sm"
                                  variant="outline"
                                  disabled={regenerating.has(key)}
                                  onClick={(e) => handleRegenerate(e, 'tts', code)}
                                >
                                  {regenerating.has(key)
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <RefreshCw className="h-3 w-3" />}
                                  {code} TTS
                                </Button>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {/* Generation log toggle */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowLogs(!showLogs); }}
                className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
              >
                <FileText className="h-3 w-3" />
                {showLogs ? 'Hide' : 'Show'} Generation Log
              </button>

              {/* Generation logs */}
              {showLogs && (
                <div className="space-y-1">
                  {logsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
                      <span className="text-xs text-text-muted dark:text-text-muted-dark">Loading logs...</span>
                    </div>
                  ) : logs.length === 0 ? (
                    <p className="py-2 text-xs italic text-text-muted dark:text-text-muted-dark">
                      No generation history yet.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-hover/30 dark:border-border-dark dark:bg-surface-hover-dark/30">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-left dark:border-border-dark">
                            <th className="px-2 py-1.5 font-medium text-text-muted dark:text-text-muted-dark">Field</th>
                            <th className="px-2 py-1.5 font-medium text-text-muted dark:text-text-muted-dark">Status</th>
                            <th className="px-2 py-1.5 font-medium text-text-muted dark:text-text-muted-dark">Duration</th>
                            <th className="px-2 py-1.5 font-medium text-text-muted dark:text-text-muted-dark">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => (
                            <tr key={log.id} className="border-b border-border/50 last:border-0 dark:border-border-dark/50">
                              <td className="px-2 py-1.5 text-text dark:text-text-dark">
                                {log.translation_code ? `${log.translation_code} ${log.field}` : log.field.replace(/_/g, ' ')}
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                  log.status === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                                  log.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                                  log.status === 'started' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                )}>
                                  {log.status === 'success' && <Check className="h-2.5 w-2.5" />}
                                  {log.status === 'failed' && <X className="h-2.5 w-2.5" />}
                                  {log.status === 'started' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                  {log.status}
                                </span>
                                {log.error_message && (
                                  <span className="ml-1 text-[10px] text-red-500" title={log.error_message}>
                                    {log.error_message.substring(0, 40)}{log.error_message.length > 40 ? '...' : ''}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-text-muted dark:text-text-muted-dark">
                                {log.duration_ms != null ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                              </td>
                              <td className="px-2 py-1.5 text-text-muted dark:text-text-muted-dark">
                                {new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
