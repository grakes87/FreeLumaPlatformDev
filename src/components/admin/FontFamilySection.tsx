'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import {
  CURATED_FONTS,
  FONT_CATEGORIES,
  type FontCategory,
} from '@/lib/fonts/google-fonts';
import { FONT_SECTIONS, DEFAULT_FONT, type FontField } from '@/lib/fonts/font-fields';
import { Search, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

// ── Font Picker Sub-component ────────────────────────────────────────

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
  label: string;
  description: string;
  sampleText: string;
}

const CATEGORY_LABELS: Record<FontCategory | 'all', string> = {
  all: 'All',
  'sans-serif': 'Sans-Serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
};

function FontPicker({ value, onChange, label, description, sampleText }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FontCategory | 'all'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const isDefault = !value || value === DEFAULT_FONT || value === '';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  // Filter fonts by search + category
  const filteredFonts = useMemo(() => {
    let fonts = CURATED_FONTS;
    if (categoryFilter !== 'all') {
      fonts = fonts.filter((f) => f.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      fonts = fonts.filter((f) => f.family.toLowerCase().includes(q));
    }
    return fonts;
  }, [search, categoryFilter]);

  const handleSelect = (family: string) => {
    onChange(family);
    setOpen(false);
    setSearch('');
    setCategoryFilter('all');
  };

  const handleReset = () => {
    onChange(DEFAULT_FONT);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="rounded-xl border border-border bg-background p-3 dark:border-border-dark dark:bg-background-dark">
        {/* Field label and description */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text dark:text-text-dark">{label}</p>
            <p className="text-xs text-text-muted dark:text-text-muted-dark">{description}</p>
          </div>
          {!isDefault && (
            <button
              onClick={handleReset}
              title="Reset to default"
              className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Selected value + trigger */}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
            'border-border bg-surface hover:bg-surface-hover dark:border-border-dark dark:bg-surface-dark dark:hover:bg-surface-hover-dark',
            open && 'ring-2 ring-primary/30'
          )}
        >
          <div className="flex-1 min-w-0">
            <span
              className={cn(
                'block truncate',
                isDefault
                  ? 'text-text-muted dark:text-text-muted-dark'
                  : 'text-text dark:text-text-dark'
              )}
              style={!isDefault ? { fontFamily: `'${value}', sans-serif` } : undefined}
            >
              {isDefault ? 'Default (inherit)' : value}
            </span>
          </div>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform dark:text-text-muted-dark', open && 'rotate-180')}
          />
        </button>

        {/* Sample text preview */}
        <div className="mt-2 rounded-lg bg-surface-hover/50 px-3 py-2 dark:bg-surface-hover-dark/50">
          <p
            className="text-sm text-text dark:text-text-dark"
            style={!isDefault ? { fontFamily: `'${value}', sans-serif` } : undefined}
          >
            {sampleText}
          </p>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark">
          {/* Search */}
          <div className="border-b border-border p-2 dark:border-border-dark">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search fonts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg bg-background py-2 pl-8 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-primary/30 dark:bg-background-dark dark:text-text-dark dark:placeholder:text-text-muted-dark"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 border-b border-border p-2 dark:border-border-dark">
            {(['all', ...FONT_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  categoryFilter === cat
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-hover-dark dark:hover:text-text-dark'
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Font list */}
          <div className="max-h-[300px] overflow-y-auto">
            {filteredFonts.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-text-muted dark:text-text-muted-dark">
                No fonts match your search
              </div>
            ) : (
              filteredFonts.map((font) => (
                <button
                  key={font.family}
                  onClick={() => handleSelect(font.family)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover dark:hover:bg-surface-hover-dark',
                    value === font.family && 'bg-primary/10 dark:bg-primary/20'
                  )}
                >
                  <span
                    className="text-text dark:text-text-dark"
                    style={{ fontFamily: `'${font.family}', ${font.category}` }}
                  >
                    {font.family}
                  </span>
                  <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
                    {font.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FontFamilySection Component ─────────────────────────────────

export function FontFamilySection() {
  const toast = useToast();
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});
  const [savedConfig, setSavedConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({ 0: true });

  // Load initial config from platform settings
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/platform-settings', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const raw = data?.font_config;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setDraftConfig(parsed);
            setSavedConfig(parsed);
          } catch {
            // Invalid JSON, start fresh
          }
        }
      } catch {
        toast.error('Failed to load font settings');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [toast]);

  // Load all 100 fonts for admin preview
  useEffect(() => {
    const families = CURATED_FONTS.map(
      (f) => `family=${encodeURIComponent(f.family)}:wght@400;700`
    ).join('&');
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = 'admin-font-preview';
    document.head.appendChild(link);

    return () => {
      const el = document.getElementById('admin-font-preview');
      if (el) el.remove();
    };
  }, []);

  const hasChanges = useMemo(() => {
    const draftKeys = Object.keys(draftConfig).filter(
      (k) => draftConfig[k] && draftConfig[k] !== DEFAULT_FONT
    );
    const savedKeys = Object.keys(savedConfig).filter(
      (k) => savedConfig[k] && savedConfig[k] !== DEFAULT_FONT
    );
    if (draftKeys.length !== savedKeys.length) return true;
    for (const key of draftKeys) {
      if (draftConfig[key] !== savedConfig[key]) return true;
    }
    for (const key of savedKeys) {
      if (draftConfig[key] !== savedConfig[key]) return true;
    }
    return false;
  }, [draftConfig, savedConfig]);

  const handleFieldChange = useCallback((fieldKey: string, family: string) => {
    setDraftConfig((prev) => {
      const next = { ...prev };
      if (family === DEFAULT_FONT || family === '') {
        delete next[fieldKey];
      } else {
        next[fieldKey] = family;
      }
      return next;
    });
  }, []);

  const handleResetAll = useCallback(() => {
    setDraftConfig({});
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const configValue = JSON.stringify(draftConfig);
      const res = await fetch('/api/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'font_config', value: configValue }),
      });

      if (res.ok) {
        setSavedConfig({ ...draftConfig });
        toast.success('Font settings published');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to publish font settings');
      }
    } catch {
      toast.error('Failed to publish font settings');
    } finally {
      setPublishing(false);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const configuredCount = Object.keys(draftConfig).filter(
    (k) => draftConfig[k] && draftConfig[k] !== DEFAULT_FONT
  ).length;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 px-3 py-2 dark:bg-surface-hover-dark/50">
        <span className="text-xs text-text-muted dark:text-text-muted-dark">
          {configuredCount} of 16 fields customized
        </span>
        {configuredCount > 0 && (
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </button>
        )}
      </div>

      {/* Sections */}
      {FONT_SECTIONS.map((section, sIdx) => {
        const isExpanded = !!expandedSections[sIdx];
        const sectionConfigured = section.fields.filter(
          (f) => draftConfig[f.key] && draftConfig[f.key] !== DEFAULT_FONT
        ).length;

        return (
          <div
            key={section.title}
            className="overflow-hidden rounded-xl border border-border dark:border-border-dark"
          >
            <button
              onClick={() => toggleSection(sIdx)}
              className="flex w-full items-center justify-between bg-surface px-4 py-3 text-left hover:bg-surface-hover dark:bg-surface-dark dark:hover:bg-surface-hover-dark"
            >
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-text dark:text-text-dark">
                  {section.title}
                </h4>
                {sectionConfigured > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary dark:bg-primary/20">
                    {sectionConfigured}/{section.fields.length}
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
              ) : (
                <ChevronDown className="h-4 w-4 text-text-muted dark:text-text-muted-dark" />
              )}
            </button>

            {isExpanded && (
              <div className="space-y-2 bg-background/50 p-3 dark:bg-background-dark/50">
                {section.fields.map((field: FontField) => (
                  <FontPicker
                    key={field.key}
                    value={draftConfig[field.key] || DEFAULT_FONT}
                    onChange={(family) => handleFieldChange(field.key, family)}
                    label={field.label}
                    description={field.description}
                    sampleText={field.sampleText}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Preview Summary */}
      {configuredCount > 0 && (
        <div className="rounded-xl border border-border p-4 dark:border-border-dark">
          <h4 className="mb-3 text-sm font-semibold text-text dark:text-text-dark">
            Preview Summary
          </h4>
          <div className="space-y-2">
            {Object.entries(draftConfig)
              .filter(([, v]) => v && v !== DEFAULT_FONT)
              .map(([fieldKey, family]) => {
                const field = FONT_SECTIONS.flatMap((s) => s.fields).find(
                  (f) => f.key === fieldKey
                );
                if (!field) return null;
                return (
                  <div
                    key={fieldKey}
                    className="flex items-center justify-between gap-3 rounded-lg bg-surface-hover/50 px-3 py-2 dark:bg-surface-hover-dark/50"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-text-muted dark:text-text-muted-dark">
                        {field.label}
                      </span>
                      <p
                        className="truncate text-sm text-text dark:text-text-dark"
                        style={{ fontFamily: `'${family}', sans-serif` }}
                      >
                        {field.sampleText}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-text-muted dark:text-text-muted-dark">
                      {family}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Publish button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handlePublish}
          disabled={!hasChanges || publishing}
          className={cn(
            'rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors',
            hasChanges && !publishing
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
          )}
        >
          {publishing ? 'Publishing...' : 'Publish Changes'}
        </button>
      </div>
    </div>
  );
}
