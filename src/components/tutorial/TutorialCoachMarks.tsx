'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { CoachMarkStep } from './tutorialSteps';
import { useTutorial } from './TutorialProvider';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const POLL_TIMEOUT_MS = 3000;
const TOOLTIP_GAP = 12;

function useTargetRect(
  target: string,
  onNotFound: () => void
): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const rafIdRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    let cancelled = false;

    function poll() {
      if (cancelled) return;

      const el = document.querySelector(target);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        return;
      }

      if (Date.now() - startTimeRef.current > POLL_TIMEOUT_MS) {
        // Element not found after timeout -- skip
        onNotFound();
        return;
      }

      rafIdRef.current = requestAnimationFrame(poll);
    }

    poll();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [target, onNotFound]);

  // Recalculate on resize (debounced)
  useEffect(() => {
    if (!rect) return;

    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const el = document.querySelector(target);
        if (el) {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [target, rect]);

  return rect;
}

interface SpotlightProps {
  rect: TargetRect;
}

function Spotlight({ rect }: SpotlightProps) {
  return (
    <div
      className="pointer-events-none fixed transition-all duration-300 ease-out"
      style={{
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
        borderRadius: SPOTLIGHT_RADIUS,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
        border: '2px solid rgba(255, 255, 255, 0.3)',
      }}
    />
  );
}

interface TooltipProps {
  step: CoachMarkStep;
  rect: TargetRect;
  isFirst: boolean;
}

function Tooltip({ step, rect, isFirst }: TooltipProps) {
  const spotlightTop = rect.top - PADDING;
  const spotlightBottom = rect.top + rect.height + PADDING;
  const spotlightCenterX = rect.left + rect.width / 2;

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  let arrowClass = '';

  if (step.position === 'bottom') {
    // Tooltip below spotlight
    tooltipStyle = {
      top: spotlightBottom + TOOLTIP_GAP,
      left: Math.max(16, Math.min(spotlightCenterX - 140, window.innerWidth - 296)),
      width: 280,
    };
    arrowClass = 'before:absolute before:-top-2 before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900';
  } else if (step.position === 'top') {
    // Tooltip above spotlight
    tooltipStyle = {
      bottom: window.innerHeight - spotlightTop + TOOLTIP_GAP,
      left: Math.max(16, Math.min(spotlightCenterX - 140, window.innerWidth - 296)),
      width: 280,
    };
    arrowClass = 'after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900';
  } else if (step.position === 'left') {
    tooltipStyle = {
      top: rect.top + rect.height / 2 - 40,
      right: window.innerWidth - (rect.left - PADDING - TOOLTIP_GAP),
      width: 240,
    };
  } else {
    // right
    tooltipStyle = {
      top: rect.top + rect.height / 2 - 40,
      left: rect.left + rect.width + PADDING + TOOLTIP_GAP,
      width: 240,
    };
  }

  return (
    <div
      className={cn(
        'fixed z-[61] rounded-xl bg-gray-900 p-4 shadow-xl',
        arrowClass
      )}
      style={tooltipStyle}
    >
      <h3 className="mb-1 text-sm font-semibold text-white">{step.title}</h3>
      <p className="text-xs leading-relaxed text-white/80">{step.description}</p>

      {/* Swipe-up animation hint for first coach mark (daily-card) */}
      {isFirst && step.id === 'daily-card' && (
        <div className="mt-3 flex flex-col items-center">
          <div className="animate-swipe-hint flex flex-col items-center text-white/60">
            <ChevronUp className="h-5 w-5" />
            <span className="text-[10px]">Swipe up</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function TutorialCoachMarks({ steps }: { steps: CoachMarkStep[] }) {
  const { currentStep, advance, skip, totalSteps } = useTutorial();
  const step = steps[currentStep];

  const handleNotFound = useCallback(() => {
    advance();
  }, [advance]);

  const targetRect = useTargetRect(step?.target ?? '', handleNotFound);

  const isLastStep = currentStep >= steps.length - 1;

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Clickable backdrop to prevent interaction with underlying content */}
      <div className="absolute inset-0" aria-hidden="true" />

      {/* Spotlight cutout */}
      {targetRect && <Spotlight rect={targetRect} />}

      {/* Tooltip */}
      {targetRect && (
        <Tooltip
          step={step}
          rect={targetRect}
          isFirst={currentStep === 0}
        />
      )}

      {/* Bottom controls */}
      <div className="fixed inset-x-0 bottom-0 z-[62] flex items-center justify-between px-6 pb-8 pt-4">
        {/* Step counter */}
        <span className="text-xs text-white/50">
          {currentStep + 1} of {totalSteps}
        </span>

        <div className="flex items-center gap-4">
          {/* Skip */}
          <button
            type="button"
            onClick={skip}
            className="text-sm text-white/60 transition-colors hover:text-white/90"
          >
            Skip
          </button>

          {/* Next / Done */}
          <button
            type="button"
            onClick={advance}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 active:bg-purple-800"
          >
            {isLastStep ? 'Done' : 'Next'}
          </button>
        </div>
      </div>

      {/* Swipe hint animation keyframes */}
      <style jsx global>{`
        @keyframes swipe-hint {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-12px);
            opacity: 1;
          }
        }
        .animate-swipe-hint {
          animation: swipe-hint 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
