'use client';

import { useState, useCallback } from 'react';
import {
  Search,
  Loader2,
  MapPin,
  Phone,
  Globe,
  Star,
  CheckCircle,
  Download,
  Microscope,
  Info,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import ChurchDetailModal from './ChurchDetailModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryResult {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  types: string[];
  googleMapsUrl: string;
  already_imported: boolean;
  // Enriched from scrape/research
  researchData?: {
    pastor_name?: string;
    denomination?: string;
    youth_programs?: string[];
    congregation_size_estimate?: string;
    ai_summary?: string;
    staff_names?: string[];
    service_times?: string[];
    social_media?: Record<string, string>;
    contact_email?: string;
    contact_phone?: string;
  };
  wasScraped?: boolean;
  wasResearched?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiscoverySearch() {
  const toast = useToast();

  // Search form state
  const [location, setLocation] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [filters, setFilters] = useState('');

  // Results state
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [noApiKey, setNoApiKey] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Research + Import state
  const [researching, setResearching] = useState(false);
  const [importing, setImporting] = useState(false);

  // Church detail modal
  const [detailChurchId, setDetailChurchId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Search handler
  // ---------------------------------------------------------------------------

  const handleSearch = useCallback(async () => {
    if (!location.trim()) {
      toast.error('Please enter a location');
      return;
    }

    setSearching(true);
    setResults([]);
    setSelectedIds(new Set());
    setNoApiKey(false);

    try {
      const res = await fetch('/api/admin/church-outreach/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          location: location.trim(),
          radiusMiles,
          filters: filters.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Search failed' }));
        throw new Error(err.error || 'Search failed');
      }

      const json = await res.json();
      const data = json.data ?? json;

      if (data.message && data.results?.length === 0) {
        // API key not configured
        setNoApiKey(true);
        return;
      }

      setResults(data.results || []);
      if (data.results?.length === 0) {
        toast.info('No churches found in this area');
      } else {
        toast.success(`Found ${data.results.length} churches`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [location, radiusMiles, filters, toast]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const toggleSelect = useCallback((placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }, []);

  const selectableResults = results.filter((r) => !r.already_imported);
  const selectedCount = selectedIds.size;

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(selectableResults.map((r) => r.placeId)));
  }, [selectableResults]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ---------------------------------------------------------------------------
  // Research handler
  // ---------------------------------------------------------------------------

  const handleResearch = useCallback(async () => {
    const toResearch = results.filter(
      (r) => selectedIds.has(r.placeId) && r.website && !r.researchData
    );

    if (toResearch.length === 0) {
      toast.info('No selected churches with websites to research');
      return;
    }

    setResearching(true);

    let completed = 0;
    for (const church of toResearch) {
      try {
        const res = await fetch('/api/admin/church-outreach/discover/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            websiteUrl: church.website,
            placeId: church.placeId,
            name: church.name,
            address: church.address,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;

          // Update result in-place with research data
          setResults((prev) =>
            prev.map((r) => {
              if (r.placeId !== church.placeId) return r;
              return {
                ...r,
                wasScraped: data.scraped !== null,
                wasResearched: data.research !== null,
                researchData: data.research
                  ? {
                      pastor_name: data.research.pastor_name,
                      denomination: data.research.denomination,
                      youth_programs: data.research.youth_programs,
                      congregation_size_estimate: data.research.congregation_size_estimate,
                      ai_summary: data.research.ai_summary,
                      staff_names: data.research.staff_names,
                      service_times: data.research.service_times,
                      social_media: data.research.social_media,
                      contact_email: data.research.contact_email,
                      contact_phone: data.research.contact_phone,
                    }
                  : undefined,
              };
            })
          );
          completed++;
        }
      } catch {
        // Skip individual failures
      }
    }

    setResearching(false);
    toast.success(`Researched ${completed} of ${toResearch.length} churches`);
  }, [results, selectedIds, toast]);

  // ---------------------------------------------------------------------------
  // Import handler
  // ---------------------------------------------------------------------------

  const handleImport = useCallback(async () => {
    const toImport = results.filter((r) => selectedIds.has(r.placeId) && !r.already_imported);

    if (toImport.length === 0) {
      toast.info('No churches selected for import');
      return;
    }

    setImporting(true);

    try {
      const churches = toImport.map((r) => ({
        placeId: r.placeId,
        name: r.name,
        address: r.address,
        phone: r.phone,
        website: r.website,
        lat: r.lat,
        lng: r.lng,
        // Research data (if available)
        ...(r.researchData || {}),
        wasScraped: r.wasScraped || false,
        wasResearched: r.wasResearched || false,
      }));

      const res = await fetch('/api/admin/church-outreach/discover/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ churches }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(err.error || 'Import failed');
      }

      const json = await res.json();
      const data = json.data ?? json;

      // Mark imported results
      const importedIds = new Set(toImport.map((r) => r.placeId));
      setResults((prev) =>
        prev.map((r) =>
          importedIds.has(r.placeId) ? { ...r, already_imported: true } : r
        )
      );
      setSelectedIds(new Set());

      toast.success(
        `Imported ${data.imported} churches${data.skipped > 0 ? ` (${data.skipped} already existed)` : ''}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [results, selectedIds, toast]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Search form */}
      <div className="rounded-xl border border-border bg-surface p-6 dark:border-border-dark dark:bg-surface-dark">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
          Search Churches
        </h3>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State or ZIP code"
                className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>

          <div className="w-40">
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Radius: {radiusMiles} mi
            </label>
            <input
              type="range"
              min={5}
              max={50}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-text dark:text-text-dark">
              Filters
            </label>
            <input
              type="text"
              value={filters}
              onChange={(e) => setFilters(e.target.value)}
              placeholder="e.g. baptist, youth ministry"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search Churches
          </button>
        </div>
      </div>

      {/* No API key message */}
      {noApiKey && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Google Places API Key Not Configured
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Add <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">GOOGLE_PLACES_API_KEY</code> to
              your <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">.env.local</code> file
              to enable church discovery. You can get an API key from the{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Google Cloud Console
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* Results staging area */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted dark:text-text-muted-dark">
                {results.length} found, {selectedCount} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm font-medium text-primary hover:underline"
              >
                Select all
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={deselectAll}
                  className="text-sm font-medium text-text-muted hover:underline dark:text-text-muted-dark"
                >
                  Deselect
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleResearch}
                disabled={researching || selectedCount === 0}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-hover-dark"
              >
                {researching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Microscope className="h-4 w-4" />
                )}
                Research Selected
              </button>
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Import Selected
              </button>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid gap-3">
            {results.map((result) => (
              <ResultCard
                key={result.placeId}
                result={result}
                selected={selectedIds.has(result.placeId)}
                onToggle={() => toggleSelect(result.placeId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Church detail modal */}
      {detailChurchId !== null && (
        <ChurchDetailModal
          churchId={detailChurchId}
          isOpen
          onClose={() => setDetailChurchId(null)}
          onUpdate={() => {
            // Re-search to refresh already_imported flags
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card sub-component
// ---------------------------------------------------------------------------

function ResultCard({
  result,
  selected,
  onToggle,
}: {
  result: DiscoveryResult;
  selected: boolean;
  onToggle: () => void;
}) {
  const disabled = result.already_imported;

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface p-4 transition-colors dark:bg-surface-dark',
        disabled
          ? 'border-border/50 opacity-60 dark:border-border-dark/50'
          : selected
            ? 'border-primary/50 ring-1 ring-primary/20'
            : 'border-border hover:border-primary/30 dark:border-border-dark dark:hover:border-primary/30'
      )}
    >
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={disabled}
            className="h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary disabled:cursor-not-allowed"
          />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-text dark:text-text-dark">
                {result.name}
              </h4>
              <p className="text-sm text-text-muted dark:text-text-muted-dark">
                {result.address}
              </p>
            </div>
            {disabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="h-3 w-3" />
                Already Imported
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted dark:text-text-muted-dark">
            {result.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {result.phone}
              </span>
            )}
            {result.website && (
              <a
                href={result.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {result.rating !== null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {result.rating}
                {result.ratingCount !== null && (
                  <span className="text-xs">({result.ratingCount})</span>
                )}
              </span>
            )}
          </div>

          {/* Research data (if enriched) */}
          {result.researchData && (
            <div className="mt-2 rounded-lg bg-surface-hover p-3 dark:bg-surface-hover-dark">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
                Research Results
              </p>
              <div className="grid gap-1 text-sm">
                {result.researchData.pastor_name && (
                  <p>
                    <span className="font-medium text-text dark:text-text-dark">Pastor:</span>{' '}
                    <span className="text-text-muted dark:text-text-muted-dark">
                      {result.researchData.pastor_name}
                    </span>
                  </p>
                )}
                {result.researchData.denomination && (
                  <p>
                    <span className="font-medium text-text dark:text-text-dark">Denomination:</span>{' '}
                    <span className="text-text-muted dark:text-text-muted-dark">
                      {result.researchData.denomination}
                    </span>
                  </p>
                )}
                {result.researchData.congregation_size_estimate && (
                  <p>
                    <span className="font-medium text-text dark:text-text-dark">Size:</span>{' '}
                    <span className="text-text-muted dark:text-text-muted-dark">
                      {result.researchData.congregation_size_estimate}
                    </span>
                  </p>
                )}
                {result.researchData.youth_programs &&
                  result.researchData.youth_programs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium text-text dark:text-text-dark">Youth:</span>
                      {result.researchData.youth_programs.map((prog) => (
                        <span
                          key={prog}
                          className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        >
                          {prog}
                        </span>
                      ))}
                    </div>
                  )}
                {result.researchData.ai_summary && (
                  <p className="mt-1 text-xs italic text-text-muted dark:text-text-muted-dark">
                    {result.researchData.ai_summary}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
