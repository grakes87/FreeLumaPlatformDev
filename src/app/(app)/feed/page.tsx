'use client';

import dynamic from 'next/dynamic';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const FeedInstagram = dynamic(
  () => import('@/components/feed/FeedInstagram').then((m) => ({ default: m.FeedInstagram })),
  { ssr: false }
);

const FeedTikTok = dynamic(
  () => import('@/components/feed/FeedTikTok').then((m) => ({ default: m.FeedTikTok })),
  { ssr: false }
);

export default function FeedPage() {
  const { feedStyle, loading } = usePlatformSettings();

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-7.5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return feedStyle === 'tiktok' ? <FeedTikTok /> : <FeedInstagram />;
}
