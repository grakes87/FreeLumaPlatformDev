'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

type EffectiveMode = 'bible' | 'positivity';

interface ViewModeContextValue {
  /** The mode to use for rendering: always 'bible' or 'positivity', never 'both' */
  effectiveMode: EffectiveMode;
  /** Whether the user is a Both-mode user (controls toggle visibility) */
  isBothMode: boolean;
  /** Switch the active view mode (only works for Both users) */
  setViewMode: (mode: EffectiveMode) => void;
}

const STORAGE_KEY = 'fl_view_mode';

const ViewModeContext = createContext<ViewModeContextValue>({
  effectiveMode: 'bible',
  isBothMode: false,
  setViewMode: () => {},
});

export function ViewModeProvider({
  children,
  initialMode,
}: {
  children: ReactNode;
  initialMode?: EffectiveMode;
}) {
  const { user } = useAuth();
  const isBothMode = user?.mode === 'both';

  const [viewMode, setViewModeState] = useState<EffectiveMode>(() => {
    // Priority: initialMode (from URL) > localStorage > 'bible'
    if (initialMode) return initialMode;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'bible' || stored === 'positivity') return stored;
    }
    return 'bible';
  });

  // When initialMode changes (e.g., URL navigation), update for Both users
  useEffect(() => {
    if (initialMode && isBothMode) {
      setViewModeState(initialMode);
    }
  }, [initialMode, isBothMode]);

  const setViewMode = useCallback((mode: EffectiveMode) => {
    if (!isBothMode) return;
    setViewModeState(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [isBothMode]);

  // Resolve: for non-both users, always return user.mode directly
  const effectiveMode: EffectiveMode = isBothMode
    ? viewMode
    : (user?.mode === 'positivity' ? 'positivity' : 'bible');

  return (
    <ViewModeContext.Provider value={{ effectiveMode, isBothMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}

export { ViewModeContext };
