import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Progressively shrinks font-size on `textRef` until it fits inside
 * `containerRef` without overflow. Runs before paint (useLayoutEffect)
 * so the user never sees the oversized text.
 *
 * @param textRef       - the element whose font-size will be adjusted
 * @param containerRef  - the bounding box it must fit within
 * @param deps          - re-run when these change (e.g. text content)
 * @param minFontSize   - stop shrinking at this size (px), default 12
 * @param step          - px to shrink per iteration, default 1
 */
export function useAutoFitText(
  textRef: RefObject<HTMLElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
  minFontSize = 12,
  step = 1
) {
  // Track the original size so we can reset when content changes
  const originalSize = useRef<number | null>(null);

  useLayoutEffect(() => {
    const textEl = textRef.current;
    const containerEl = containerRef.current;
    if (!textEl || !containerEl) return;

    // Reset to original/computed size before measuring
    if (originalSize.current !== null) {
      textEl.style.fontSize = `${originalSize.current}px`;
    } else {
      // Clear any inline override so we measure the CSS-defined size
      textEl.style.fontSize = '';
    }

    const computed = parseFloat(getComputedStyle(textEl).fontSize);
    if (originalSize.current === null) {
      originalSize.current = computed;
    }

    let currentSize = originalSize.current;

    // Shrink until text fits or we hit the minimum
    while (
      currentSize > minFontSize &&
      textEl.scrollHeight > containerEl.clientHeight
    ) {
      currentSize -= step;
      textEl.style.fontSize = `${currentSize}px`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
