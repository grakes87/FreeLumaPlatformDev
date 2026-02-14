'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface FeedMuteContextValue {
  /** Global mute state — all videos respect this */
  muted: boolean;
  /** Toggle global mute on/off */
  toggleMute: () => void;
}

const FeedMuteContext = createContext<FeedMuteContextValue>({
  muted: true,
  toggleMute: () => {},
});

export function FeedMuteProvider({ children }: { children: React.ReactNode }) {
  // Start muted (iOS requires muted autoplay)
  const [muted, setMuted] = useState(true);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  return (
    <FeedMuteContext.Provider value={{ muted, toggleMute }}>
      {children}
    </FeedMuteContext.Provider>
  );
}

export function useFeedMute() {
  return useContext(FeedMuteContext);
}
