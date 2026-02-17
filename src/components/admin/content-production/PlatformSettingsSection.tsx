'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';

/* ─── Types ─── */

interface SettingField {
  key: string;
  label: string;
  type: 'password' | 'text';
  placeholder: string;
}

const SETTINGS_FIELDS: SettingField[] = [
  {
    key: 'elevenlabs_api_key',
    label: 'ElevenLabs API Key',
    type: 'password',
    placeholder: 'sk_...',
  },
  {
    key: 'elevenlabs_voice_id',
    label: 'ElevenLabs Voice ID',
    type: 'text',
    placeholder: 'voice_...',
  },
  {
    key: 'murf_api_key',
    label: 'Murf API Key',
    type: 'password',
    placeholder: 'murf_...',
  },
  {
    key: 'murf_voice_id',
    label: 'Murf Voice ID',
    type: 'text',
    placeholder: 'en-US-...',
  },
  {
    key: 'heygen_api_key',
    label: 'HeyGen API Key',
    type: 'password',
    placeholder: 'hg_...',
  },
];

/* ─── Single Setting Row ─── */

function SettingRow({
  field,
  value,
  onSave,
}: {
  field: SettingField;
  value: string;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = useCallback(async () => {
    const trimmed = localValue.trim();
    if (trimmed === value) return;
    setSaving(true);
    try {
      await onSave(field.key, trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [localValue, value, field.key, onSave]);

  const isPassword = field.type === 'password';

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text dark:text-text-dark">
        {field.label}
      </label>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={isPassword && !revealed ? 'password' : 'text'}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder={field.placeholder}
            className={cn(
              'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text transition-colors',
              'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50',
              'dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-text-muted-dark',
              isPassword && !revealed && 'pr-10'
            )}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark"
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {/* Status indicator */}
        <div className="flex h-8 w-8 items-center justify-center">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {saved && !saving && <Check className="h-4 w-4 text-green-500" />}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function PlatformSettingsSection() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/platform-settings', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setError(null);
      } else {
        setError('Failed to load settings');
      }
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(
    async (key: string, value: string) => {
      try {
        const res = await fetch('/api/platform-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key, value }),
        });
        if (res.ok) {
          setSettings((prev) => ({ ...prev, [key]: value }));
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to save setting');
        }
      } catch {
        toast.error('Failed to save setting');
      }
    },
    [toast]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-300 py-8 text-red-500 dark:border-red-700 dark:text-red-400">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">
          Pipeline Settings
        </h3>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          Configure API keys and voice/avatar IDs for the content production pipeline.
          Settings are saved automatically on blur.
        </p>
      </div>

      <div className="space-y-4">
        {SETTINGS_FIELDS.map((field) => (
          <SettingRow
            key={field.key}
            field={field}
            value={settings[field.key] || ''}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  );
}
