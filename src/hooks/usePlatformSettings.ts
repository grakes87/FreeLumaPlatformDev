'use client';

import { useState, useEffect, useCallback } from 'react';

type FeedStyle = 'tiktok' | 'instagram';

interface PlatformSettings {
  [key: string]: string;
}

interface UsePlatformSettingsReturn {
  settings: PlatformSettings;
  feedStyle: FeedStyle;
  modeIsolation: boolean;
  loading: boolean;
  getSetting: (key: string) => string | null;
}

/**
 * Hook to fetch and expose admin-controlled platform settings.
 * Reads GET /api/platform-settings on mount.
 * Exposes feedStyle (tiktok | instagram) and modeIsolation convenience getters.
 */
export function usePlatformSettings(): UsePlatformSettingsReturn {
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        const res = await fetch('/api/platform-settings', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setSettings(data);
        }
      } catch (err) {
        console.error('[usePlatformSettings] fetch error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const getSetting = useCallback(
    (key: string): string | null => {
      return settings[key] ?? null;
    },
    [settings]
  );

  const feedStyle: FeedStyle =
    (settings.feed_style as FeedStyle) || 'tiktok';

  const modeIsolation =
    settings.mode_isolation_social === 'true';

  return { settings, feedStyle, modeIsolation, loading, getSetting };
}
