'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import {
  Monitor,
  Shield,
  UserPlus,
  Layers,
  AlertTriangle,
  Type,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FontFamilySection } from './FontFamilySection';

interface SettingToggleProps {
  label: string;
  description: string;
  settingKey: string;
  value: string;
  onValue?: string;
  offValue?: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  warning?: string;
}

function SettingToggle({
  label,
  description,
  settingKey,
  value,
  onValue = 'true',
  offValue = 'false',
  onChange,
  disabled,
  warning,
}: SettingToggleProps) {
  const isOn = value === onValue;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4 dark:border-border-dark dark:bg-background-dark">
      <div className="flex-1">
        <p className="font-medium text-text dark:text-text-dark">{label}</p>
        <p className="mt-0.5 text-sm text-text-muted dark:text-text-muted-dark">
          {description}
        </p>
        {warning && isOn && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {warning}
          </div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={isOn}
        onClick={() => onChange(settingKey, isOn ? offValue : onValue)}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          isOn ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white transition-transform',
            isOn ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

interface SettingSelectorProps {
  label: string;
  description: string;
  settingKey: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

function SettingSelector({
  label,
  description,
  settingKey,
  value,
  options,
  onChange,
  disabled,
}: SettingSelectorProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4 dark:border-border-dark dark:bg-background-dark">
      <div className="flex-1">
        <p className="font-medium text-text dark:text-text-dark">{label}</p>
        <p className="mt-0.5 text-sm text-text-muted dark:text-text-muted-dark">
          {description}
        </p>
      </div>
      <div className="flex gap-1 rounded-xl bg-surface-hover p-1 dark:bg-surface-hover-dark">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(settingKey, opt.value)}
            disabled={disabled}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              value === opt.value
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SettingsGroup {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function SettingsGroup({ title, icon: Icon, children }: SettingsGroup) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-text-muted dark:text-text-muted-dark" />
        <h3 className="font-semibold text-text dark:text-text-dark">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function AdminSettings() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [fontSectionOpen, setFontSectionOpen] = useState(false);

  useEffect(() => {
    fetch('/api/platform-settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        // PlatformSettings API returns the key-value object directly
        if (data && typeof data === 'object' && !data.error) {
          setSettings(data);
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleChange = async (key: string, value: string) => {
    const prev = settings[key];
    // Optimistic update
    setSettings((s) => ({ ...s, [key]: value }));
    setSaving(key);

    try {
      const res = await fetch('/api/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });

      if (res.ok) {
        toast.success(`${key.replace(/_/g, ' ')} updated`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update');
        setSettings((s) => ({ ...s, [key]: prev || '' }));
      }
    } catch {
      toast.error('Failed to update setting');
      setSettings((s) => ({ ...s, [key]: prev || '' }));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SettingsGroup title="Feed & Display" icon={Monitor}>
        <SettingSelector
          label="Feed Style"
          description="Choose the default feed layout for all users."
          settingKey="feed_style"
          value={settings.feed_style || 'instagram'}
          options={[
            { value: 'instagram', label: 'Instagram' },
            { value: 'tiktok', label: 'TikTok' },
          ]}
          onChange={handleChange}
          disabled={saving === 'feed_style'}
        />
      </SettingsGroup>

      <SettingsGroup title="Content & Moderation" icon={Shield}>
        <SettingToggle
          label="Profanity Filter"
          description="Automatically detect and censor profane language in posts and comments."
          settingKey="profanity_filter_enabled"
          value={settings.profanity_filter_enabled || 'true'}
          onChange={handleChange}
          disabled={saving === 'profanity_filter_enabled'}
        />
        <SettingToggle
          label="AI Moderation"
          description="Use AI to automatically flag potentially harmful content."
          settingKey="ai_moderation_enabled"
          value={settings.ai_moderation_enabled || 'false'}
          onChange={handleChange}
          disabled={saving === 'ai_moderation_enabled'}
        />
      </SettingsGroup>

      <SettingsGroup title="Registration" icon={UserPlus}>
        <SettingSelector
          label="Registration Mode"
          description="Control how new users can sign up."
          settingKey="registration_mode"
          value={settings.registration_mode || 'invite'}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'invite', label: 'Invite Only' },
          ]}
          onChange={handleChange}
          disabled={saving === 'registration_mode'}
        />
        <SettingToggle
          label="Maintenance Mode"
          description="Temporarily disable the platform for all non-admin users."
          settingKey="maintenance_mode"
          value={settings.maintenance_mode || 'false'}
          onChange={handleChange}
          disabled={saving === 'maintenance_mode'}
          warning="The platform is currently in maintenance mode. Non-admin users cannot access the site."
        />
      </SettingsGroup>

      <SettingsGroup title="Mode Isolation" icon={Layers}>
        <SettingToggle
          label="Social Feed Isolation"
          description="When enabled, Bible-mode and Positivity-mode users only see posts from their own mode in the social feed."
          settingKey="mode_isolation_social"
          value={settings.mode_isolation_social || 'false'}
          onChange={handleChange}
          disabled={saving === 'mode_isolation_social'}
        />
        <SettingToggle
          label="Prayer Wall Isolation"
          description="When enabled, prayer wall only shows requests from users in the same mode."
          settingKey="mode_isolation_prayer"
          value={settings.mode_isolation_prayer || 'false'}
          onChange={handleChange}
          disabled={saving === 'mode_isolation_prayer'}
        />
      </SettingsGroup>

      {/* Font Family Configuration */}
      <div className="space-y-3">
        <button
          onClick={() => setFontSectionOpen(!fontSectionOpen)}
          className="flex w-full items-center gap-2"
        >
          <Type className="h-5 w-5 text-text-muted dark:text-text-muted-dark" />
          <h3 className="font-semibold text-text dark:text-text-dark">Font Family</h3>
          <span className="ml-auto text-text-muted dark:text-text-muted-dark">
            {fontSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          Configure font families for different text elements across the app.
        </p>
        {fontSectionOpen && <FontFamilySection />}
      </div>
    </div>
  );
}
