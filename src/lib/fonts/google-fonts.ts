/**
 * Curated list of 100 popular Google Fonts with category metadata.
 * Used by the admin font picker (Plan 06) and FontLoader component.
 */

export interface GoogleFont {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
}

export type FontCategory = GoogleFont['category'];

export const FONT_CATEGORIES: FontCategory[] = [
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
];

/**
 * 100 curated Google Fonts sorted alphabetically within each category.
 * Prioritized by popularity on Google Fonts.
 *
 * Breakdown: ~40 sans-serif, ~25 serif, ~15 display, ~15 handwriting, ~5 monospace
 */
export const CURATED_FONTS: GoogleFont[] = [
  // ── Sans-Serif (40) ──────────────────────────────────────────────
  { family: 'Albert Sans', category: 'sans-serif' },
  { family: 'Archivo', category: 'sans-serif' },
  { family: 'Assistant', category: 'sans-serif' },
  { family: 'Barlow', category: 'sans-serif' },
  { family: 'Be Vietnam Pro', category: 'sans-serif' },
  { family: 'Cabin', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Exo 2', category: 'sans-serif' },
  { family: 'Figtree', category: 'sans-serif' },
  { family: 'IBM Plex Sans', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Josefin Sans', category: 'sans-serif' },
  { family: 'Kanit', category: 'sans-serif' },
  { family: 'Karla', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Lexend', category: 'sans-serif' },
  { family: 'Libre Franklin', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Mukta', category: 'sans-serif' },
  { family: 'Mulish', category: 'sans-serif' },
  { family: 'Noto Sans', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Nunito Sans', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Outfit', category: 'sans-serif' },
  { family: 'Overpass', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Prompt', category: 'sans-serif' },
  { family: 'Quicksand', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Red Hat Display', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Saira', category: 'sans-serif' },
  { family: 'Source Sans 3', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Urbanist', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },

  // ── Serif (25) ────────────────────────────────────────────────────
  { family: 'Bitter', category: 'serif' },
  { family: 'Bodoni Moda', category: 'serif' },
  { family: 'Bree Serif', category: 'serif' },
  { family: 'Cardo', category: 'serif' },
  { family: 'Cormorant', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Eczar', category: 'serif' },
  { family: 'Frank Ruhl Libre', category: 'serif' },
  { family: 'IBM Plex Serif', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'Literata', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Mate', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Noto Serif', category: 'serif' },
  { family: 'Old Standard TT', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Spectral', category: 'serif' },
  { family: 'Unna', category: 'serif' },
  { family: 'Vollkorn', category: 'serif' },

  // ── Display (15) ──────────────────────────────────────────────────
  { family: 'Abril Fatface', category: 'display' },
  { family: 'Alfa Slab One', category: 'display' },
  { family: 'Audiowide', category: 'display' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Bungee', category: 'display' },
  { family: 'Concert One', category: 'display' },
  { family: 'Fredoka', category: 'display' },
  { family: 'Lobster', category: 'display' },
  { family: 'Orbitron', category: 'display' },
  { family: 'Oswald', category: 'display' },
  { family: 'Passion One', category: 'display' },
  { family: 'Permanent Marker', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Rubik Mono One', category: 'display' },
  { family: 'Titan One', category: 'display' },

  // ── Handwriting (15) ──────────────────────────────────────────────
  { family: 'Amatic SC', category: 'handwriting' },
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Cookie', category: 'handwriting' },
  { family: 'Courgette', category: 'handwriting' },
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Gloria Hallelujah', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Handlee', category: 'handwriting' },
  { family: 'Indie Flower', category: 'handwriting' },
  { family: 'Kalam', category: 'handwriting' },
  { family: 'Pacifico', category: 'handwriting' },
  { family: 'Patrick Hand', category: 'handwriting' },
  { family: 'Sacramento', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Shadows Into Light', category: 'handwriting' },

  // ── Monospace (5) ─────────────────────────────────────────────────
  { family: 'Fira Code', category: 'monospace' },
  { family: 'IBM Plex Mono', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Space Mono', category: 'monospace' },
];

/**
 * Lookup a curated font by family name.
 * Returns undefined if not in the curated list.
 */
export function findCuratedFont(family: string): GoogleFont | undefined {
  return CURATED_FONTS.find((f) => f.family === family);
}
