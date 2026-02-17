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
  Search,
  X,
  Zap,
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
  status: 'pending' | 'generated' | 'activated';
  mode_hint: string | null;
  created_at: string;
  used_at: string | null;
  usedByUser?: CodeUser | null;
}

type FilterTab = 'all' | 'pending' | 'generated' | 'activated';

export default function AdminActivationCodesPage() {
  const toast = useToast();

  // Data state
  const [codes, setCodes] = useState<ActivationCodeRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, pending_count: 0, generated_count: 0, activated_count: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Generate state
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateModeHint, setGenerateModeHint] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState<'bible' | 'positivity'>('bible');
  const [exportCount, setExportCount] = useState(100);
  const [exporting, setExporting] = useState(false);

  // Clipboard state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCodes = useCallback(async (p: number, f: FilterTab, q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (f !== 'all') params.set('status', f);
      if (q) params.set('search', q);

      const res = await fetch(`/api/admin/activation-codes?${params}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
        setStats({
          total: (data.pending_count || 0) + (data.generated_count || 0) + (data.activated_count || 0),
          pending_count: data.pending_count || 0,
          generated_count: data.generated_count || 0,
          activated_count: data.activated_count || 0,
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
    fetchCodes(page, filter, searchQuery);
  }, [page, filter, searchQuery, fetchCodes]);

  const handleFilterChange = (f: FilterTab) => {
    setFilter(f);
    setPage(1);
  };

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
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
    if (exportCount < 1) return;

    setExporting(true);
    try {
      // Fetch generated codes matching selected mode
      const params = new URLSearchParams({ page: '1', limit: String(exportCount), status: 'generated' });

      const res = await fetch(`/api/admin/activation-codes?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        toast.error('Failed to fetch codes for export');
        return;
      }

      const data = await res.json();
      // Filter by selected mode client-side (mode_hint match)
      const allCodes: ActivationCodeRecord[] = (data.codes || []).filter(
        (c: ActivationCodeRecord) => c.mode_hint === exportMode
      );

      if (allCodes.length === 0) {
        toast.error(`No generated ${exportMode} codes available to export`);
        return;
      }

      // Build CSV with hardcoded URL format
      const csv = 'URL,Code,Mode\n' + allCodes.map((c) =>
        `https://freeluma.app?code=${c.code}&mode=${exportMode},${c.code},${exportMode}`
      ).join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activation-codes-${exportMode}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark exported codes as pending (now available for activation)
      const exportedIds = allCodes.map((c) => c.id);
      if (exportedIds.length > 0) {
        await fetch('/api/admin/activation-codes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ids: exportedIds, status: 'pending' }),
        });
      }

      toast.success(`Exported ${allCodes.length} ${exportMode} codes — status changed to Pending`);
      setShowExport(false);
      fetchCodes(page, filter);
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
    { key: 'pending', label: 'Pending' },
    { key: 'generated', label: 'Generated' },
    { key: 'activated', label: 'Activated' },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Pending
          </span>
        );
      case 'generated':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Generated
          </span>
        );
      case 'activated':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Activated
          </span>
        );
      default:
        return null;
    }
  };

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-text-muted dark:text-text-muted-dark">Pending</p>
              <p className="text-2xl font-bold text-text dark:text-text-dark">
                {stats.pending_count.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-text-muted dark:text-text-muted-dark">Generated</p>
              <p className="text-2xl font-bold text-text dark:text-text-dark">
                {stats.generated_count.toLocaleString()}
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
              <p className="text-sm text-text-muted dark:text-text-muted-dark">Activated</p>
              <p className="text-2xl font-bold text-text dark:text-text-dark">
                {stats.activated_count.toLocaleString()}
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

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
          <input
            type="text"
            placeholder="Search by code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={cn(
              'w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-10 text-sm text-text',
              'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark'
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Search
        </Button>
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
                    {statusBadge(code.status)}
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
            <h3 className="font-semibold text-text dark:text-text-dark">Export Generated Codes</h3>
            <p className="text-sm text-text-muted dark:text-text-muted-dark">
              Download generated codes as CSV ({stats.generated_count.toLocaleString()} available)
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowExport(!showExport)} disabled={stats.generated_count === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        {showExport && (
          <div className="mt-4 space-y-4 border-t border-border pt-4 dark:border-border-dark">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-32">
                <Input
                  label="Quantity"
                  type="number"
                  min={1}
                  max={stats.generated_count || 1}
                  value={exportCount}
                  onChange={(e) => setExportCount(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={exporting}
                />
              </div>
              <div className="w-48">
                <label className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark">
                  Mode
                </label>
                <select
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value as 'bible' | 'positivity')}
                  disabled={exporting}
                  className={cn(
                    'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text',
                    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
                    'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark'
                  )}
                >
                  <option value="bible">Bible</option>
                  <option value="positivity">Positivity</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">
              Preview: https://freeluma.app?code=XXXXXX&mode={exportMode}
            </p>
            <div className="flex gap-3">
              <Button onClick={handleExport} loading={exporting}>
                Download
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowExport(false)}
                disabled={exporting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
