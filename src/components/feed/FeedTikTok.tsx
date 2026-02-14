'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFeed } from '@/hooks/useFeed';
import { useAuth } from '@/hooks/useAuth';
import { useImmersive } from '@/context/ImmersiveContext';
import { FeedMuteProvider } from '@/context/FeedMuteContext';
import { FeedTabs } from '@/components/feed/FeedTabs';
import { PostFeed } from '@/components/feed/PostFeed';
import { PostComposer } from '@/components/feed/PostComposer';

export function FeedTikTok() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setImmersive } = useImmersive();
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  useEffect(() => {
    if (searchParams.get('compose') === 'post') {
      setComposerOpen(true);
      router.replace('/feed', { scroll: false });
    }
  }, [searchParams, router]);

  const {
    posts,
    loading,
    refreshing,
    hasMore,
    activeTab,
    fetchNextPage,
    refresh,
    setActiveTab,
    removePost,
    updatePost,
  } = useFeed();

  return (
    <FeedMuteProvider>
      <div className="bg-black">
        {/* Feed tabs */}
        <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} overlay />

        {/* Post feed */}
        <PostFeed
          posts={posts}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={fetchNextPage}
          feedStyle="tiktok"
          refreshing={refreshing}
          onRefresh={refresh}
          currentUserId={user?.id ?? null}
          onRemovePost={removePost}
          onUpdatePost={updatePost}
        />

        {/* Post composer */}
        <PostComposer
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          onPostCreated={() => {
            setComposerOpen(false);
            refresh();
          }}
        />
      </div>
    </FeedMuteProvider>
  );
}
