/**
 * Deterministic tag → colour mapping.
 *
 * Eight hues that stay legible on both the light and dark theme backgrounds.
 * A simple string hash picks one per tag name, so the same tag always renders
 * the same colour everywhere — plan cards, item dialog, cue-strip filters.
 *
 * Each entry carries CSS custom-property–friendly values that the TagChip
 * component injects via inline `style`.
 */

export type TagColor = {
  /** The dot / check accent. */
  dot: string;
  /** Soft chip background. */
  bg: string;
  /** Text colour on the soft bg. */
  text: string;
  /** Border for selected / active state. */
  border: string;
  /** Light-theme soft bg (separate so dark mode can override). */
  bgDark: string;
  textDark: string;
  dotDark: string;
  borderDark: string;
};

const PALETTE: TagColor[] = [
  // Indigo (brand)
  {
    dot: '#6366f1', bg: '#e6e9ff', text: '#4145c4', border: '#6366f1',
    dotDark: '#8b8eff', bgDark: 'rgba(99,102,241,0.16)', textDark: '#b9bbff', borderDark: '#7b7ef7',
  },
  // Teal
  {
    dot: '#14b8a6', bg: '#ccfbf1', text: '#0f766e', border: '#14b8a6',
    dotDark: '#2dd4bf', bgDark: 'rgba(20,184,166,0.16)', textDark: '#5eead4', borderDark: '#2dd4bf',
  },
  // Amber
  {
    dot: '#f59e0b', bg: '#fef3c7', text: '#92400e', border: '#f59e0b',
    dotDark: '#fbbf24', bgDark: 'rgba(245,158,11,0.16)', textDark: '#fcd34d', borderDark: '#fbbf24',
  },
  // Rose
  {
    dot: '#f43f5e', bg: '#ffe4e6', text: '#9f1239', border: '#f43f5e',
    dotDark: '#fb7185', bgDark: 'rgba(244,63,94,0.16)', textDark: '#fda4af', borderDark: '#fb7185',
  },
  // Sky
  {
    dot: '#0ea5e9', bg: '#e0f2fe', text: '#0369a1', border: '#0ea5e9',
    dotDark: '#38bdf8', bgDark: 'rgba(14,165,233,0.16)', textDark: '#7dd3fc', borderDark: '#38bdf8',
  },
  // Violet
  {
    dot: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6', border: '#8b5cf6',
    dotDark: '#a78bfa', bgDark: 'rgba(139,92,246,0.16)', textDark: '#c4b5fd', borderDark: '#a78bfa',
  },
  // Emerald
  {
    dot: '#10b981', bg: '#d1fae5', text: '#065f46', border: '#10b981',
    dotDark: '#34d399', bgDark: 'rgba(16,185,129,0.16)', textDark: '#6ee7b7', borderDark: '#34d399',
  },
  // Orange
  {
    dot: '#f97316', bg: '#ffedd5', text: '#9a3412', border: '#f97316',
    dotDark: '#fb923c', bgDark: 'rgba(249,115,22,0.16)', textDark: '#fdba74', borderDark: '#fb923c',
  },
];

/**
 * Palette index → name, in `PALETTE` order.
 *
 * Exists so the API and MCP tools can take `"amber"` rather than `2`: an agent
 * picking a colour for a tag has no way to know what index 2 looks like.
 */
export const TAG_COLOR_NAMES = [
  'indigo',
  'teal',
  'amber',
  'rose',
  'sky',
  'violet',
  'emerald',
  'orange',
] as const;

export type TagColorName = (typeof TAG_COLOR_NAMES)[number];

/** Name → palette index, or null when the name isn't one of ours. */
export function tagColorIndexByName(name: string): number | null {
  const index = TAG_COLOR_NAMES.indexOf(name as TagColorName);
  return index === -1 ? null : index;
}

/** Palette index → name, for reporting a stored override back to a caller. */
export function tagColorNameByIndex(index: number): TagColorName {
  return TAG_COLOR_NAMES[Math.abs(index) % TAG_COLOR_NAMES.length];
}

/** Simple string hash → index. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Number of colours in the palette. */
export const TAG_PALETTE_SIZE = PALETTE.length;

/** Returns the palette entry by index (clamped). */
export function tagColorByIndex(index: number): TagColor {
  return PALETTE[Math.abs(index) % PALETTE.length];
}

/**
 * Returns the palette entry for a tag name.
 *
 * If `overrides` maps the tag to a palette index, that index wins.
 * Otherwise a deterministic hash picks one.
 */
export function tagColor(
  tag: string,
  overrides?: Record<string, number>,
): TagColor {
  if (overrides && tag in overrides) {
    return tagColorByIndex(overrides[tag]);
  }
  return PALETTE[hash(tag) % PALETTE.length];
}
