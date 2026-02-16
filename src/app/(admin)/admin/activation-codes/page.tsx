'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

interface CodeUser {
  id: number;
  username: string;
  display_name: string | null;
}

interface ActivationCodeRecord {
  id: number;
  code: string;
  used: boolean;
  source: 'generated' | 'imported';
  mode_hint: string | null;
  created_at: string;
  used_at: string | null;
  usedByUser?: CodeUser | null;
}

type FilterTab = 'all' | 'unused' | 'used';

export default function AdminActivationCodesPage() {
  const toast = useToast();

  // Data state
  const [codes, setCodes] = useState<ActivationCodeRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, used_count: 0, unused_count: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);

  // Generate state
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateModeHint, setGenerateModeHint] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportPrefix, setExportPrefix] = useState('');
  const [exporting, setExporting] = useState(false);

  // Clipboard state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCodes = useCallback(async (p: number, f: FilterTab) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (f === 'used') params.set('used', 'true');
      if (f === 'unused') params.set('used', 'false');

      const res = await fetch(`/api/admin/activation-codes?${params}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
        setStats({
          total: (data.used_count || 0) + (data.unused_count || 0),
          used_count: data.used_count || 0,
          unused_count: data.unused_count || 0,
        });
        setTotalPages(data.total_pages || 1);
      } else {
        toast.error('Failed to load activation codes');
      }
    } catch {
      toast.error('Failed to load activation codes');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCodes(page, filter);
  }, [page, filter, fetchCodes]);

  const handleFilterChange = (f: FilterTab) => {
    setFilter(f);
    setPage(1);
  };

  const handleGenerate = async () => {
    if (generateCount < 1 || generateCount > 100) return;

    setGenerating(true);
    try {
      const body: Record<string, unknown> = { count: generateCount };
      if (generateModeHint) body.mode_hint = generateModeHint;

      const res = await fetch('/api/admin/activation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Generated ${data.count} codes`);
        setShowGenerate(false);
        setGenerateCount(10);
        setGenerateModeHint('');
        fetchCodes(1, filter);
        setPage(1);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate codes');
      }
    } catch {
      toast.error('Failed to generate codes');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all codes matching current filter
      const params = new URLSearchParams({ page: '1', limit: '99999' });
      if (filter === 'used') params.set('used', 'true');
      if (filter === 'unused') params.set('used', 'false');

      const res = await fetch(`/api/admin/activation-codes?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        toast.error('Failed to fetch codes for export');
        return;
      }

      const data = await res.json();
      const allCodes: ActivationCodeRecord[] = data.codes || [];

      // Build CSV
      const prefix = exportPrefix.trim();
      let csv: string;
      if (prefix) {
        csv = 'URL,Code\n' + allCodes.map((c) => `${prefix}${c.code},${c.code}`).join('\n');
      } else {
        csv = 'Code\n' + allCodes.map((c) => c.code).join('\n');
      }

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activation-codes-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${allCodes.length} codes`);
      setShowExport(false);
      setExportPrefix('');
    } catch {
      toast.error('Failed to export codes');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unused', label: 'Unused' },
    { key: 'used', label: 'Used' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">
            Activation Codes
          </h1>
          <p className="text-text-muted dark:text-text-muted-dark">
            Generate, track, and export activation codes
          </p>
        </div>
        <Button onClick={() => setShowGenerate(!showGenerate)}>
          <Plus className="h-4 w-4" /> Generate Codes
        </Button>
      </div>

      {/* Generate Inline Form */}
      {showGenerate && (
        <div className="rounded-2xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
          <h3 className="mb-4 text-lg font-semibold text-text dark:text-text-dark">
            Generate New Codes
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32">
              <Input
                label="Quantity"
                type="number"
                min={1}
                max={100}
                value={generateCount}
                onChange={(e) => setGenerateCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                disabled={generating}
              />
            </div>
            <div className="w-48">
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                Mode Hint
              </label>
              <select
                value={generateModeHint}
                onChange={(e) => setGenerateModeHint(e.target.value)}
                disabled={generating}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
                  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                )}
              >
                <option value="">None</option>
                <option value="bible">Bible</option>
                <option value="positivity">Positivity</option>
              </select>
            </div>
            <Button onClick={handleGenerate} loading={generating}>
              Generate
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowGenerate(false);
                setGenerateCount(10);
                setGenerateModeHint('');
              }}
              disabled={generating}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-muted dark:text-text-muted-dark">Total Codes</p>
              <p className="text-2xl font-bold text-text dark:text-text-dark">
                {stats.total.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-text-muted dark:text-text-muted-dark">Used</p>
              <p className="text-2xl font-bold text-text dark:text-text-dark">
                {stats.used_count.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-text-muted dark:text-text-muted-dark">Unused</p>
              <p className="text-2xl font-bold text-text dark:text-text-dark">
                {stats.unused_count.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleFilterChange(t.key)}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              filter === t.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Codes Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : codes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 dark:border-border-dark">
          <Key className="h-12 w-12 text-text-muted dark:text-text-muted-dark" />
          <p className="text-text-muted dark:text-text-muted-dark">
            {filter === 'all'
              ? 'No activation codes yet. Generate your first batch to get started.'
              : `No ${filter} codes found.`}
          </p>
          {filter === 'all' && (
            <Button onClick={() => setShowGenerate(true)}>
              <Plus className="h-4 w-4" /> Generate Codes
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border dark:border-border-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-hover/50 dark:border-border-dark dark:bg-surface-hover-dark/50">
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">
                  Code
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">
                  Created
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">
                  Redeemed By
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted-dark">
                  Redeemed At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {codes.map((code) => (
                <tr
                  key={code.id}
                  className="bg-surface transition-colors hover:bg-surface-hover/30 dark:bg-surface-dark dark:hover:bg-surface-hover-dark/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-text dark:text-text-dark">
                        {code.code}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(code.code)}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
                        title="Copy code"
                      >
                        {copiedCode === code.code ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {code.used ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Used
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Unused
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {code.source === 'generated' ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Generated
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Imported
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted dark:text-text-muted-dark">
                    {formatDate(code.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {code.usedByUser ? (
                      <a
                        href={`/admin/users?search=${encodeURIComponent(code.usedByUser.username)}`}
                        className="text-primary hover:underline"
                      >
                        {code.usedByUser.display_name || code.usedByUser.username}
                      </a>
                    ) : (
                      <span className="text-text-muted dark:text-text-muted-dark">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted dark:text-text-muted-dark">
                    {formatDate(code.used_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted dark:text-text-muted-dark">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* CSV Export Section */}
      <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text dark:text-text-dark">Export Codes</h3>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              Download {filter === 'all' ? 'all' : filter} codes as CSV
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowExport(!showExport)}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        {showExport && (
          <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4 dark:border-border-dark">
            <div className="min-w-0 flex-1">
              <Input
                label="URL Prefix (optional)"
                placeholder="https://freeluma.com/signup?code="
                value={exportPrefix}
                onChange={(e) => setExportPrefix(e.target.value)}
                disabled={exporting}
              />
            </div>
            <Button onClick={handleExport} loading={exporting}>
              Download
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowExport(false);
                setExportPrefix('');
              }}
              disabled={exporting}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
