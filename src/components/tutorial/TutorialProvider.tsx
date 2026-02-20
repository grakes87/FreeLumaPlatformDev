'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { slideshowSteps, coachMarkSteps, type CoachMarkStep } from './tutorialSteps';
import { TutorialSlideshow } from './TutorialSlideshow';
import { TutorialCoachMarks } from './TutorialCoachMarks';

type TutorialPhase = 'idle' | 'slideshow' | 'coach-marks' | 'done';

export interface TutorialContextValue {
  showTutorial: boolean;
  phase: TutorialPhase;
  currentStep: number;
  totalSteps: number;
  userMode: 'bible' | 'positivity';
  advance: () => void;
  skip: () => void;
  replay: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error(
      'useTutorial must be used within a TutorialProvider.'
    );
  }
  return ctx;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [phase, setPhase] = useState<TutorialPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const completingRef = useRef(false);

  const userMode = user?.mode ?? 'bible';

  // Filter coach mark steps based on user mode
  const filteredCoachSteps = useMemo<CoachMarkStep[]>(
    () =>
      userMode === 'positivity'
        ? coachMarkSteps.filter((s) => !s.bibleOnly)
        : coachMarkSteps,
    [userMode]
  );

  // Total steps for current phase
  const totalSteps =
    phase === 'slideshow'
      ? slideshowSteps.length
      : phase === 'coach-marks'
        ? filteredCoachSteps.length
        : 0;

  // Client-side mount check for createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-start tutorial if user hasn't seen it (1s delay for feed to load)
  useEffect(() => {
    if (!user) return;
    if (user.has_seen_tutorial) return;
    if (phase !== 'idle') return;

    const timer = setTimeout(() => {
      setPhase('slideshow');
      setCurrentStep(0);
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, phase]);

  // Lock body scroll when tutorial overlay is active
  useEffect(() => {
    const isActive = phase === 'slideshow' || phase === 'coach-marks';
    if (isActive) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (isActive) {
        document.body.style.overflow = '';
      }
    };
  }, [phase]);

  const completeTutorial = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    try {
      await fetch('/api/tutorial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      await refreshUser();
    } catch {
      // Silently fail -- tutorial still dismisses client-side
    }
    setPhase('done');
    completingRef.current = false;
  }, [refreshUser]);

  const advance = useCallback(() => {
    if (phase === 'slideshow') {
      if (currentStep >= slideshowSteps.length - 1) {
        // Transition to coach marks
        setPhase('coach-marks');
        setCurrentStep(0);
      } else {
        setCurrentStep((s) => s + 1);
      }
    } else if (phase === 'coach-marks') {
      if (currentStep >= filteredCoachSteps.length - 1) {
        completeTutorial();
      } else {
        setCurrentStep((s) => s + 1);
      }
    }
  }, [phase, currentStep, filteredCoachSteps.length, completeTutorial]);

  const skip = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const replay = useCallback(async () => {
    try {
      await fetch('/api/tutorial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reset: true }),
      });
      await refreshUser();
    } catch {
      // Silently fail
    }
    setPhase('slideshow');
    setCurrentStep(0);
  }, [refreshUser]);

  const showTutorial = phase === 'slideshow' || phase === 'coach-marks';

  const value = useMemo<TutorialContextValue>(
    () => ({
      showTutorial,
      phase,
      currentStep,
      totalSteps,
      userMode,
      advance,
      skip,
      replay,
    }),
    [showTutorial, phase, currentStep, totalSteps, userMode, advance, skip, replay]
  );

  // Render overlay via portal
  const overlay =
    mounted && showTutorial ? (
      <>
        {phase === 'slideshow' && <TutorialSlideshow />}
        {phase === 'coach-marks' && (
          <TutorialCoachMarks steps={filteredCoachSteps} />
        )}
      </>
    ) : null;

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {mounted && overlay
        ? createPortal(overlay, document.body)
        : null}
    </TutorialContext.Provider>
  );
}
