'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { PrayerTab } from '@/hooks/usePrayerWall';

interface PrayerTabsProps {
  activeTab: PrayerTab;
  onTabChange: (tab: PrayerTab) => void;
}

const MY_PRAYER_SUB_TABS: { value: PrayerTab; label: string }[] = [
  { value: 'my_requests', label: 'My Requests' },
  { value: 'my_joined', label: "Prayers I've Joined" },
];

export function PrayerTabs({ activeTab, onTabChange }: PrayerTabsProps) {
  const [myDropdownOpen, setMyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMyTab = activeTab === 'my_requests' || activeTab === 'my_joined';
  const activeMyLabel = MY_PRAYER_SUB_TABS.find((t) => t.value === activeTab)?.label ?? 'My Prayers';

  // Close dropdown on outside click
  useEffect(() => {
    if (!myDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMyDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [myDropdownOpen]);

  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 backdrop-blur-sm">
      {/* Others' Prayers tab */}
      <button
        type="button"
        onClick={() => {
          onTabChange('others');
          setMyDropdownOpen(false);
        }}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium transition-all',
          activeTab === 'others'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/60 hover:text-white/80'
        )}
      >
        Others&apos; Prayers
      </button>

      {/* My Prayers tab with dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (!isMyTab) {
              onTabChange('my_requests');
            }
            setMyDropdownOpen((prev) => !prev);
          }}
          className={cn(
            'flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            isMyTab
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/60 hover:text-white/80'
          )}
        >
          <span>{isMyTab ? activeMyLabel : 'My Prayers'}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              myDropdownOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Sub-tab dropdown */}
        {myDropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-white/20 bg-white/10 py-1 shadow-lg backdrop-blur-2xl">
            {MY_PRAYER_SUB_TABS.map((sub) => (
              <button
                key={sub.value}
                type="button"
                onClick={() => {
                  onTabChange(sub.value);
                  setMyDropdownOpen(false);
                }}
                className={cn(
                  'block w-full px-4 py-2 text-left text-sm transition-colors',
                  activeTab === sub.value
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
