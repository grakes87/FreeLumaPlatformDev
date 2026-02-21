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

/** If target covers more than this fraction of the viewport, use centered overlay instead of spotlight */
const FULLSCREEN_THRESHOLD = 0.6;

function useTargetRect(
  target: string,
  onNotFound: () => void
): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const rafIdRef = useRef(0);
  const startTimeRef = useRef(0);
  const onNotFoundRef = useRef(onNotFound);
  onNotFoundRef.current = onNotFound;

  useEffect(() => {
    setRect(null);
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
        onNotFoundRef.current();
        return;
      }

      rafIdRef.current = requestAnimationFrame(poll);
    }

    poll();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [target]);

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

function isTargetFullscreen(rect: TargetRect): boolean {
  if (typeof window === 'undefined') return false;
  const viewportArea = window.innerWidth * window.innerHeight;
  const targetArea = rect.width * rect.height;
  return targetArea / viewportArea > FULLSCREEN_THRESHOLD;
}

function Spotlight({ rect }: { rect: TargetRect }) {
  return (
    <div
      className="pointer-events-none fixed z-[61] transition-all duration-300 ease-out"
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
  isLast: boolean;
  title: string;
  description: string;
  stepLabel: string;
  onAdvance: () => void;
  onSkip: () => void;
}

function PositionedTooltip({ step, rect, isFirst, isLast, title, description, stepLabel, onAdvance, onSkip }: TooltipProps) {
  const spotlightTop = rect.top - PADDING;
  const spotlightBottom = rect.top + rect.height + PADDING;
  const spotlightCenterX = rect.left + rect.width / 2;
  const viewH = window.innerHeight;
  const targetCenter = rect.top + rect.height / 2;

  const showAbove = targetCenter > viewH * 0.45;

  let tooltipStyle: React.CSSProperties;
  let arrowClass: string;

  if (showAbove) {
    tooltipStyle = {
      bottom: viewH - spotlightTop + TOOLTIP_GAP,
      left: Math.max(12, Math.min(spotlightCenterX - 150, window.innerWidth - 312)),
      width: 300,
    };
    arrowClass = 'after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900';
  } else {
    tooltipStyle = {
      top: spotlightBottom + TOOLTIP_GAP,
      left: Math.max(12, Math.min(spotlightCenterX - 150, window.innerWidth - 312)),
      width: 300,
    };
    arrowClass = 'before:absolute before:-top-2 before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900';
  }

  return (
    <div
      className={cn(
        'fixed z-[62] rounded-xl bg-gray-900 p-4 shadow-xl',
        arrowClass
      )}
      style={tooltipStyle}
    >
      <TooltipContent
        step={step}
        isFirst={isFirst}
        isLast={isLast}
        title={title}
        description={description}
        stepLabel={stepLabel}
        onAdvance={onAdvance}
        onSkip={onSkip}
      />
    </div>
  );
}

/** Shared tooltip inner content used by both positioned and centered tooltips */
function TooltipContent({
  step, isFirst, isLast, title, description, stepLabel, onAdvance, onSkip,
}: Omit<TooltipProps, 'rect'>) {
  return (
    <>
      <h3 className="mb-1 text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-white/80">{description}</p>

      {isFirst && step.id === 'daily-card' && (
        <div className="mt-2 flex flex-col items-center">
          <div className="flex flex-col items-center text-white/60" style={{ animation: 'coachSwipeHint 1.5s ease-in-out infinite' }}>
            <ChevronUp className="h-4 w-4" />
            <span className="text-[10px]">Swipe up</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-white/50 transition-colors hover:text-white/80"
        >
          Skip
        </button>
        <span className="text-[10px] text-white/40">{stepLabel}</span>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700 active:bg-purple-800"
        >
          {isLast ? 'Done' : 'Next'}
        </button>
      </div>
    </>
  );
}

/** Centered overlay tooltip — used when target fills the screen or isn't found */
function CenteredTooltip({
  step, isFirst, isLast, title, description, stepLabel, onAdvance, onSkip,
}: Omit<TooltipProps, 'rect'>) {
  return (
    <div className="fixed inset-0 z-[62] flex items-center justify-center p-6">
      <div className="w-full max-w-xs rounded-xl bg-gray-900 p-4 shadow-xl">
        <TooltipContent
          step={step}
          isFirst={isFirst}
          isLast={isLast}
          title={title}
          description={description}
          stepLabel={stepLabel}
          onAdvance={onAdvance}
          onSkip={onSkip}
        />
      </div>
    </div>
  );
}

export function TutorialCoachMarks({ steps }: { steps: CoachMarkStep[] }) {
  const { currentStep, advance, skip, totalSteps, userMode } = useTutorial();
  const step = steps[currentStep];

  const handleNotFound = useCallback(() => {
    advance();
  }, [advance]);

  const targetRect = useTargetRect(step?.target ?? '', handleNotFound);

  const isLastStep = currentStep >= steps.length - 1;

  if (!step) return null;

  const title = (userMode === 'bible' && step.bibleTitle) ? step.bibleTitle : step.title;
  const description = (userMode === 'bible' && step.bibleDescription) ? step.bibleDescription : step.description;
  const stepLabel = `${currentStep + 1} / ${totalSteps}`;

  // If target covers most of the viewport (e.g. daily-card is full-screen),
  // the spotlight box-shadow trick doesn't work — use centered overlay instead
  const fullscreen = targetRect ? isTargetFullscreen(targetRect) : false;
  const useSpotlight = targetRect && !fullscreen;
  const useCentered = !targetRect || fullscreen;

  const tooltipProps = {
    step,
    isFirst: currentStep === 0,
    isLast: isLastStep,
    title,
    description,
    stepLabel,
    onAdvance: advance,
    onSkip: skip,
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dark backdrop — for centered tooltip mode */}
      {useCentered && (
        <div className="absolute inset-0 bg-black/75" />
      )}

      {/* Spotlight cutout — only for smaller targets */}
      {useSpotlight && <Spotlight rect={targetRect} />}

      {/* Positioned tooltip next to spotlight */}
      {useSpotlight && (
        <PositionedTooltip rect={targetRect} {...tooltipProps} />
      )}

      {/* Centered tooltip — full-screen targets or element not found */}
      {useCentered && (
        <CenteredTooltip {...tooltipProps} />
      )}

      {/* Animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes coachSwipeHint {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-12px); opacity: 1; }
        }
      ` }} />
    </div>
  );
}
