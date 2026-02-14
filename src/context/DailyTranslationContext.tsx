'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
  const [activeTranslation, setActiveTranslation] = useState<string | null>(null);
  const [availableTranslations, setAvailableTranslations] = useState<string[]>([]);
  const [translationNames, setTranslationNames] = useState<Record<string, string>>({});

  const registerTranslations = useCallback((codes: string[], names: Record<string, string>) => {
    setAvailableTranslations((prev) => {
      // Only register once (first data load)
      if (prev.length > 0) return prev;
      return codes;
    });
    setTranslationNames((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return names;
    });
    setActiveTranslation((prev) => {
      if (prev !== null) return prev;
      return codes.length > 0 ? codes[0] : null;
    });
  }, []);

  const clearTranslations = useCallback(() => {
    setAvailableTranslations([]);
    setTranslationNames({});
    setActiveTranslation(null);
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
