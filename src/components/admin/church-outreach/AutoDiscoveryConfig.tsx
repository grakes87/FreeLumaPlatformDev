'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
  Save,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Config {
  enabled: boolean;
  search_filters: string;
  min_fit_score: number;
  max_per_run: number;
  auto_enroll_sequence_id: number | null;
  run_at_hour_utc: number;
}

interface Sequence {
  id: number;
  name: string;
}

// Convert UTC hour ↔ local hour using browser timezone offset
function utcToLocal(utcHour: number): number {
  const now = new Date();
  now.setUTCHours(utcHour, 0, 0, 0);
  return now.getHours();
}
function localToUtc(localHour: number): number {
  const now = new Date();
  now.setHours(localHour, 0, 0, 0);
  return now.getUTCHours();
}
function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:00 ${period}`;
}

export default function AutoDiscoveryConfig() {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [freelumaContext, setFreeLumaContext] = useState('');
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    phase: string;
    message: string;
    current: number;
    total: number;
    stats: { discovered: number; imported: number; enrolled: number; errors: number };
  } | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, seqRes] = await Promise.all([
        fetch('/api/admin/church-outreach/auto-discovery', { credentials: 'include' }),
        fetch('/api/admin/church-outreach/sequences', { credentials: 'include' }),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config);
        setFreeLumaContext(data.freelumaContext || '');
      }
      if (seqRes.ok) {
        const seqData = await seqRes.json();
        setSequences(Array.isArray(seqData.sequences) ? seqData.sequences : []);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !config) fetchConfig();
  }, [expanded, config, fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/church-outreach/auto-discovery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...config, freelumaContext }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setConfig(data.config);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult(null);
    setProgress(null);
    try {
      const res = await fetch('/api/admin/church-outreach/auto-discovery', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Run failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.phase === 'done') {
              const s = data.stats;
              setRunResult(`Discovered: ${s.discovered}, Imported: ${s.imported}, Enrolled: ${s.enrolled}, Errors: ${s.errors}`);
              setProgress(null);
            } else if (data.phase === 'error') {
              setRunResult(`Error: ${data.message}`);
              setProgress(null);
            } else {
              setProgress(data);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setRunResult('Run failed — check server logs');
      setProgress(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <span className="font-semibold text-text dark:text-text-dark">Auto-Discovery Settings</span>
          {config?.enabled && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Active
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-4 dark:border-border-dark">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : config ? (
            <div className="space-y-4">
              {/* Enable toggle */}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary"
                />
                <span className="text-sm font-medium text-text dark:text-text-dark">
                  Enable automatic daily discovery
                </span>
              </label>

              {/* Search filters */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  Search Filters
                </label>
                <input
                  type="text"
                  value={config.search_filters}
                  onChange={(e) => setConfig({ ...config, search_filters: e.target.value })}
                  placeholder="e.g., baptist, youth ministry (optional — leave blank for all churches)"
                  className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm text-text dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                />
                <p className="mt-1 text-xs text-text-muted dark:text-text-muted-dark">
                  Searches churches across the United States. Add keywords to narrow results.
                </p>
              </div>

              {/* Settings grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted dark:text-text-muted-dark">Min Fit Score</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.min_fit_score}
                    onChange={(e) => setConfig({ ...config, min_fit_score: parseInt(e.target.value) || 8 })}
                    className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted dark:text-text-muted-dark">Max Per Run</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.max_per_run}
                    onChange={(e) => setConfig({ ...config, max_per_run: parseInt(e.target.value) || 20 })}
                    className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted dark:text-text-muted-dark">Run Time</label>
                  <select
                    value={utcToLocal(config.run_at_hour_utc)}
                    onChange={(e) => setConfig({ ...config, run_at_hour_utc: localToUtc(parseInt(e.target.value)) })}
                    className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{formatHour(i)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto-enroll sequence */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  Auto-Enroll Sequence
                </label>
                <select
                  value={config.auto_enroll_sequence_id ?? ''}
                  onChange={(e) => setConfig({ ...config, auto_enroll_sequence_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                >
                  <option value="">None (manual enrollment)</option>
                  {sequences.map((seq) => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>
              </div>

              {/* FreeLuma context */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
                  FreeLuma Context (used by AI email writer)
                </label>
                <textarea
                  value={freelumaContext}
                  onChange={(e) => setFreeLumaContext(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-surface-hover p-2 text-sm dark:border-border-dark dark:bg-surface-hover-dark dark:text-text-dark"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </button>
                <button
                  onClick={handleRunNow}
                  disabled={running || !config.enabled}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run Now
                </button>
              </div>

              {/* Progress indicator */}
              {running && progress && (
                <div className="rounded-lg border border-border bg-surface-hover p-4 dark:border-border-dark dark:bg-surface-hover-dark">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-text dark:text-text-dark">{progress.message}</span>
                    {progress.total > 0 && (
                      <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        {progress.current}/{progress.total}
                      </span>
                    )}
                  </div>
                  {progress.total > 0 && (
                    <div className="mb-3 h-2 overflow-hidden rounded-full bg-border dark:bg-border-dark">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          progress.phase === 'researching' ? 'bg-purple-500' :
                          progress.phase === 'scraping' ? 'bg-blue-500' :
                          progress.phase === 'importing' ? 'bg-green-500' :
                          progress.phase === 'email' ? 'bg-amber-500' :
                          'bg-primary'
                        )}
                        style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-text-muted dark:text-text-muted-dark">
                    <span>Found: {progress.stats.discovered}</span>
                    <span>Imported: {progress.stats.imported}</span>
                    {progress.stats.errors > 0 && (
                      <span className="text-red-500">Errors: {progress.stats.errors}</span>
                    )}
                  </div>
                </div>
              )}

              {runResult && (
                <p className="rounded-lg bg-surface-hover p-3 text-sm text-text dark:bg-surface-hover-dark dark:text-text-dark">
                  {runResult}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted dark:text-text-muted-dark">Failed to load config</p>
          )}
        </div>
      )}
    </div>
  );
}
