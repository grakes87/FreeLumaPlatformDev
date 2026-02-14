'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { FeedTab } from '@/hooks/useFeed';

interface FeedTabsProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  /** Render as a transparent overlay (TikTok mode) */
  overlay?: boolean;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'fyp', label: 'For You' },
];

/**
 * FYP / Following tab bar with animated underline indicator.
 * overlay=true: transparent overlay positioned at top center (TikTok mode).
 * overlay=false: sticky tab bar with solid background (Instagram mode).
 */
export function FeedTabs({ activeTab, onTabChange, overlay = false }: FeedTabsProps) {
  const tabRefs = useRef<Map<FeedTab, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current.get(activeTab);
    if (el) {
      const parent = el.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setIndicatorStyle({
          left: elRect.left - parentRect.left,
          width: elRect.width,
        });
      }
    }
  }, [activeTab]);

  if (overlay) {
    return (
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex items-center justify-center"
        style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="pointer-events-auto relative flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el);
              }}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'px-4 py-2 text-base font-semibold transition-colors',
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-white/50'
              )}
            >
              {tab.label}
            </button>
          ))}

          {/* Animated underline indicator */}
          <div
            className="absolute bottom-0 h-0.5 rounded-full bg-white transition-all duration-300"
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/95">
      <div className="relative flex">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.key, el);
            }}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex-1 py-3 text-center text-sm font-semibold transition-colors',
              activeTab === tab.key
                ? 'text-primary'
                : 'text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark'
            )}
          >
            {tab.label}
          </button>
        ))}

        {/* Animated underline indicator */}
        <div
          className="absolute bottom-0 h-0.5 rounded-full bg-primary transition-all duration-300"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      </div>
    </div>
  );
}
