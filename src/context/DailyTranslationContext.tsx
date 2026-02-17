'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface DailyTranslationContextValue {
  /** Currently selected translation code (e.g. "CSB", "KJV") */
  activeTranslation: string | null;
  /** Switch translation globally across all daily content slides */
  setActiveTranslation: (code: string) => void;
  /** Available translation codes */
  availableTranslations: string[];
  /** Map of code → full name (e.g. { CSB: "Christian Standard Bible" }) */
  translationNames: Record<string, string>;
  /** Called by DailyFeed on first data load to populate available translations */
  registerTranslations: (codes: string[], names: Record<string, string>) => void;
  /** Clear state when leaving the daily page */
  clearTranslations: () => void;
}

const DailyTranslationContext = createContext<DailyTranslationContextValue | null>(null);

export function DailyTranslationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeTranslation, setActiveTranslationState] = useState<string | null>(null);
  const [availableTranslations, setAvailableTranslations] = useState<string[]>([]);
  const [translationNames, setTranslationNames] = useState<Record<string, string>>({});
  // Track whether the user manually switched (don't override manual picks)
  const userManuallyPickedRef = useRef(false);

  const setActiveTranslation = useCallback((code: string) => {
    userManuallyPickedRef.current = true;
    setActiveTranslationState(code);

    // Persist to user profile (fire-and-forget)
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ preferred_translation: code }),
    }).catch(() => {});
  }, []);

  const registerTranslations = useCallback((codes: string[], names: Record<string, string>) => {
    setAvailableTranslations((prev) => {
      if (prev.length > 0) return prev;
      return codes;
    });
    setTranslationNames((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return names;
    });
    setActiveTranslationState((prev) => {
      if (prev !== null) return prev;
      // Use user's preferred translation if auth already loaded
      if (user?.preferred_translation && codes.includes(user.preferred_translation)) {
        return user.preferred_translation;
      }
      return codes.length > 0 ? codes[0] : null;
    });
  }, [user?.preferred_translation]);

  // When user auth finishes loading (after feed data already registered),
  // apply preferred_translation if the user hasn't manually picked yet
  useEffect(() => {
    if (
      user?.preferred_translation &&
      availableTranslations.length > 0 &&
      availableTranslations.includes(user.preferred_translation) &&
      !userManuallyPickedRef.current
    ) {
      setActiveTranslationState(user.preferred_translation);
    }
  }, [user?.preferred_translation, availableTranslations]);

  const clearTranslations = useCallback(() => {
    setAvailableTranslations([]);
    setTranslationNames({});
    setActiveTranslationState(null);
    userManuallyPickedRef.current = false;
  }, []);

  return (
    <DailyTranslationContext.Provider
      value={{
        activeTranslation,
        setActiveTranslation,
        availableTranslations,
        translationNames,
        registerTranslations,
        clearTranslations,
      }}
    >
      {children}
    </DailyTranslationContext.Provider>
  );
}

export function useDailyTranslation() {
  return useContext(DailyTranslationContext);
}
