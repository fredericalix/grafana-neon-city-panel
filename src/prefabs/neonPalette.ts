// =============================================================================
// SHARED NEON COLOR PALETTE DERIVATION
// =============================================================================

export interface ScreenPalette {
  bg: string;
  text: string;
  glow: string;
  highlight: string;
  scanline: string;
  gradientBase: string;
}

/** Parse a hex color (#RRGGBB or #RGB) into [r, g, b] 0-255 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Derive a full screen palette from a single neon hex color */
export function neonToPalette(hex: string): ScreenPalette {
  const [r, g, b] = hexToRgb(hex);
  const bgR = Math.round(r * 0.05);
  const bgG = Math.round(g * 0.05);
  const bgB = Math.round(b * 0.05);
  const glowR = Math.round(r * 0.55);
  const glowG = Math.round(g * 0.55);
  const glowB = Math.round(b * 0.55);
  const hiR = Math.min(255, Math.round(r * 0.6 + 255 * 0.4));
  const hiG = Math.min(255, Math.round(g * 0.6 + 255 * 0.4));
  const hiB = Math.min(255, Math.round(b * 0.6 + 255 * 0.4));

  const toHex2 = (n: number) => n.toString(16).padStart(2, '0');
  return {
    bg: `#${toHex2(bgR)}${toHex2(bgG)}${toHex2(bgB)}`,
    text: hex,
    glow: `#${toHex2(glowR)}${toHex2(glowG)}${toHex2(glowB)}`,
    highlight: `#${toHex2(hiR)}${toHex2(hiG)}${toHex2(hiB)}`,
    scanline: `rgba(${r},${g},${b},0.04)`,
    gradientBase: `rgba(${r},${g},${b},`,
  };
}

export const DEFAULT_NEON = '#00ffff';
