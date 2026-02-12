'use client';

import { useInView } from 'react-intersection-observer';

interface UseInfiniteScrollOptions {
  /** IntersectionObserver threshold (0-1). Default: 0 */
  threshold?: number;
  /** Root margin for IntersectionObserver. Default: '200px' (pre-fetch before visible) */
  rootMargin?: string;
}

/**
 * Generic infinite scroll hook wrapping react-intersection-observer.
 *
 * Attach `ref` to a sentinel element at the bottom of a scrollable list.
 * When `inView` becomes true, trigger your load-more function.
 *
 * @example
 * ```tsx
 * const { ref, inView } = useInfiniteScroll();
 *
 * useEffect(() => {
 *   if (inView && hasMore && !loading) fetchNextPage();
 * }, [inView, hasMore, loading]);
 *
 * return (
 *   <>
 *     {posts.map(p => <PostCard key={p.id} post={p} />)}
 *     <div ref={ref} />
 *   </>
 * );
 * ```
 */
export function useInfiniteScroll(options?: UseInfiniteScrollOptions) {
  const { ref, inView } = useInView({
    threshold: options?.threshold ?? 0,
    rootMargin: options?.rootMargin ?? '200px',
  });

  return { ref, inView };
}
