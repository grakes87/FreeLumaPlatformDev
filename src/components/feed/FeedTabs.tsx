'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { FeedTab } from '@/hooks/useFeed';

interface FeedTabsProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'fyp', label: 'For You' },
  { key: 'following', label: 'Following' },
];

/**
 * Sticky FYP / Following tab bar with animated underline indicator.
 */
export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
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
