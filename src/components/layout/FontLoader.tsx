'use client';

import { useMemo } from 'react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { FONT_FIELDS } from '@/lib/fonts/font-fields';
import { findCuratedFont } from '@/lib/fonts/google-fonts';

/**
 * FontLoader -- injects Google Fonts CSS link and CSS custom properties.
 *
 * Reads `font_config` from platform settings (JSON string mapping field keys
 * to Google Font family names). Loads only the fonts that are actually
 * selected, via a single Google Fonts CSS2 request.
 *
 * Renders nothing when no custom fonts are configured (zero performance cost).
 */
export function FontLoader() {
  const { fontConfig } = usePlatformSettings();

  // Collect unique font families that are actually configured
  const uniqueFonts = useMemo(() => {
    const families = new Set<string>();
    for (const value of Object.values(fontConfig)) {
      if (value && value !== 'inherit' && value !== '') {
        families.add(value);
      }
    }
    return Array.from(families).sort();
  }, [fontConfig]);

  // Build CSS variable declarations
  const cssVars = useMemo(() => {
    const lines: string[] = [];
    for (const field of FONT_FIELDS) {
      const family = fontConfig[field.key];
      if (family && family !== 'inherit' && family !== '') {
        // Look up the font's category for the fallback stack
        const curated = findCuratedFont(family);
        const fallback = curated?.category ?? 'sans-serif';
        lines.push(`  ${field.cssVar}: '${family}', ${fallback};`);
      } else {
        lines.push(`  ${field.cssVar}: inherit;`);
      }
    }
    return `:root {\n${lines.join('\n')}\n}`;
  }, [fontConfig]);

  // Nothing to load -- render nothing
  if (uniqueFonts.length === 0) {
    return null;
  }

  // Build Google Fonts CSS2 URL with all selected families
  const families = uniqueFonts
    .map(
      (f) =>
        `family=${encodeURIComponent(f)}:wght@300;400;500;600;700`
    )
    .join('&');
  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  return (
    <>
      {/* Load the Google Fonts stylesheet */}
      <link rel="stylesheet" href={href} />

      {/* Set CSS custom properties for each font field */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
    </>
  );
}
