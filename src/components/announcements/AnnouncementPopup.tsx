'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import { useTutorial } from '@/components/tutorial/TutorialProvider';
import { cn } from '@/lib/utils/cn';

interface AnnouncementData {
  id: number;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
}

export function AnnouncementPopup() {
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const fetchedRef = useRef(false);

  // Defer if tutorial is active
  let tutorialPhase: string = 'done';
  try {
    const tutorial = useTutorial();
    tutorialPhase = tutorial.phase;
  } catch {
    // useTutorial throws if outside provider — treat as done
  }

  const tutorialDone = tutorialPhase === 'done' || tutorialPhase === 'idle';

  const preloadMedia = useCallback((items: AnnouncementData[]) => {
    const first = items[0];
    if (!first?.media_url) {
      setMediaReady(true);
      return;
    }
    if (first.media_type === 'video') {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.oncanplay = () => setMediaReady(true);
      video.onerror = () => setMediaReady(true);
      // Fallback if canplay never fires
      setTimeout(() => setMediaReady(true), 5000);
      video.src = first.media_url;
    } else {
      const img = new Image();
      img.onload = () => setMediaReady(true);
      img.onerror = () => setMediaReady(true);
      img.src = first.media_url;
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      const res = await fetch('/api/announcements/active', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const items = data.announcements || [];
        setAnnouncements(items);
        if (items.length > 0) {
          preloadMedia(items);
        }
      }
    } catch {
      // Silent — don't interrupt user
    }
  }, [preloadMedia]);

  useEffect(() => {
    if (tutorialDone) {
      fetchAnnouncements();
    }
  }, [tutorialDone, fetchAnnouncements]);

  const currentAnnouncement = announcements[currentIndex];

  const handleDismiss = async () => {
    if (!currentAnnouncement || dismissing) return;
    setDismissing(true);

    try {
      await fetch(`/api/announcements/${currentAnnouncement.id}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Silent — dismiss locally even if API fails
    }

    setDismissing(false);

    // Move to next or close
    if (currentIndex < announcements.length - 1) {
      const nextIdx = currentIndex + 1;
      const next = announcements[nextIdx];
      // Preload next announcement's media before showing
      if (next?.media_url) {
        setMediaReady(false);
        if (next.media_type === 'video') {
          const video = document.createElement('video');
          video.preload = 'auto';
          video.oncanplay = () => setMediaReady(true);
          video.onerror = () => setMediaReady(true);
          setTimeout(() => setMediaReady(true), 5000);
          video.src = next.media_url;
        } else {
          const img = new Image();
          img.onload = () => setMediaReady(true);
          img.onerror = () => setMediaReady(true);
          img.src = next.media_url;
        }
      }
      setCurrentIndex(nextIdx);
    } else {
      setAnnouncements([]);
    }
  };

  // Nothing to show, or media still loading
  if (!currentAnnouncement || !mediaReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl dark:bg-surface-dark animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className="absolute right-3 top-3 z-20 rounded-full bg-black/30 p-1.5 text-white transition-colors hover:bg-black/50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Media */}
        {currentAnnouncement.media_url && (
          <div className="relative w-full">
            {currentAnnouncement.media_type === 'video' ? (
              <video
                src={currentAnnouncement.media_url}
                className="w-full max-h-64 object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={currentAnnouncement.media_url}
                alt=""
                className="w-full max-h-64 object-cover"
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <h2 className="text-lg font-bold text-text dark:text-text-dark">
            {currentAnnouncement.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted dark:text-text-muted-dark whitespace-pre-line">
            {currentAnnouncement.body}
          </p>

          {/* CTA Link */}
          {currentAnnouncement.link_url && (
            <a
              href={/^https?:\/\//i.test(currentAnnouncement.link_url) ? currentAnnouncement.link_url : `https://${currentAnnouncement.link_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {currentAnnouncement.link_label || 'Learn More'}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Dismiss + counter */}
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={dismissing}
              className={cn(
                'rounded-full px-6 py-2.5 text-sm font-semibold transition-colors',
                currentAnnouncement.link_url
                  ? 'border border-border text-text hover:bg-surface-hover dark:border-border-dark dark:text-text-dark dark:hover:bg-surface-hover-dark'
                  : 'bg-primary text-white hover:bg-primary-dark'
              )}
            >
              {dismissing ? 'Dismissing...' : 'Got It'}
            </button>

            {announcements.length > 1 && (
              <span className="text-xs text-text-muted dark:text-text-muted-dark">
                {currentIndex + 1} of {announcements.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
