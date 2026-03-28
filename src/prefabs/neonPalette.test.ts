import { hexToRgb, neonToPalette, DEFAULT_NEON } from './neonPalette';

describe('neonPalette', () => {
  describe('hexToRgb', () => {
    it('parses #ff0000 as [255, 0, 0]', () => {
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
    });

    it('parses #00ff00 as [0, 255, 0]', () => {
      expect(hexToRgb('#00ff00')).toEqual([0, 255, 0]);
    });

    it('parses #0000ff as [0, 0, 255]', () => {
      expect(hexToRgb('#0000ff')).toEqual([0, 0, 255]);
    });

    it('parses #000000 as [0, 0, 0]', () => {
      expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    });

    it('parses #ffffff as [255, 255, 255]', () => {
      expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    });

    it('handles short hex #f00 as [255, 0, 0]', () => {
      expect(hexToRgb('#f00')).toEqual([255, 0, 0]);
    });

    it('handles short hex #0f0 as [0, 255, 0]', () => {
      expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
    });
  });

  describe('neonToPalette', () => {
    it('returns a complete ScreenPalette object', () => {
      const palette = neonToPalette('#00ffff');
      expect(palette).toHaveProperty('bg');
      expect(palette).toHaveProperty('text');
      expect(palette).toHaveProperty('glow');
      expect(palette).toHaveProperty('highlight');
      expect(palette).toHaveProperty('scanline');
      expect(palette).toHaveProperty('gradientBase');
    });

    it('sets text to the input hex', () => {
      expect(neonToPalette('#ff00ff').text).toBe('#ff00ff');
    });

    it('derives bg as ~5% of input channels', () => {
      const palette = neonToPalette('#ff0000');
      // bg red channel: round(255 * 0.05) = 13 = 0x0d
      expect(palette.bg).toBe('#0d0000');
    });

    it('derives glow as ~55% of input channels', () => {
      const palette = neonToPalette('#ff0000');
      // glow red channel: round(255 * 0.55) = 140 = 0x8c
      expect(palette.glow).toBe('#8c0000');
    });

    it('clamps highlight to 255', () => {
      // For #ffffff: highlight = min(255, round(255*0.6 + 255*0.4)) = 255
      const palette = neonToPalette('#ffffff');
      expect(palette.highlight).toBe('#ffffff');
    });

    it('includes scanline as rgba string', () => {
      const palette = neonToPalette('#00ffff');
      expect(palette.scanline).toMatch(/^rgba\(\d+,\d+,\d+,0\.04\)$/);
    });

    it('includes gradientBase as rgba prefix', () => {
      const palette = neonToPalette('#00ffff');
      expect(palette.gradientBase).toMatch(/^rgba\(\d+,\d+,\d+,$/);
    });
  });

  describe('DEFAULT_NEON', () => {
    it('equals #00ffff (cyan)', () => {
      expect(DEFAULT_NEON).toBe('#00ffff');
    });
  });
});
