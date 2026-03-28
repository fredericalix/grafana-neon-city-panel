import {
  COLORS,
  getStatusColor,
  getStatusPulseSpeed,
  createBuildingMaterial,
  createGlowMaterial,
  createMetalMaterial,
} from './materials';
import { BuildingStatus } from '../types';

describe('materials', () => {
  describe('getStatusColor', () => {
    it('returns online color for "online"', () => {
      expect(getStatusColor('online')).toBe(COLORS.state.online);
    });

    it('returns offline color for "offline"', () => {
      expect(getStatusColor('offline')).toBe(COLORS.state.offline);
    });

    it('returns warning color for "warning"', () => {
      expect(getStatusColor('warning')).toBe(COLORS.state.warning);
    });

    it('returns critical color for "critical"', () => {
      expect(getStatusColor('critical')).toBe(COLORS.state.critical);
    });

    it('returns unknown color for unrecognized status', () => {
      expect(getStatusColor('something' as BuildingStatus)).toBe(COLORS.state.unknown);
    });
  });

  describe('getStatusPulseSpeed', () => {
    it('returns 0.5 for online', () => {
      expect(getStatusPulseSpeed('online')).toBe(0.5);
    });

    it('returns 0.1 for offline', () => {
      expect(getStatusPulseSpeed('offline')).toBe(0.1);
    });

    it('returns 1.0 for warning', () => {
      expect(getStatusPulseSpeed('warning')).toBe(1.0);
    });

    it('returns 2.0 for critical', () => {
      expect(getStatusPulseSpeed('critical')).toBe(2.0);
    });

    it('returns 0.3 for unrecognized status', () => {
      expect(getStatusPulseSpeed('something' as BuildingStatus)).toBe(0.3);
    });
  });

  describe('createBuildingMaterial', () => {
    it('returns a MeshStandardMaterial with the given color', () => {
      const mat = createBuildingMaterial(0xff0000);
      expect(mat).toBeDefined();
      expect(mat.metalness).toBe(0.1);
      expect(mat.roughness).toBe(0.8);
    });
  });

  describe('createGlowMaterial', () => {
    it('returns a MeshBasicMaterial with transparency', () => {
      const mat = createGlowMaterial(0x00ff00);
      expect(mat).toBeDefined();
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBe(0.8);
    });

    it('accepts a custom opacity', () => {
      const mat = createGlowMaterial(0x00ff00, 0.5);
      expect(mat.opacity).toBe(0.5);
    });
  });

  describe('createMetalMaterial', () => {
    it('returns a MeshStandardMaterial with metal properties', () => {
      const mat = createMetalMaterial();
      expect(mat).toBeDefined();
      expect(mat.metalness).toBe(0.7);
      expect(mat.roughness).toBe(0.3);
    });
  });

  describe('COLORS constant', () => {
    it('has state colors', () => {
      expect(COLORS.state).toHaveProperty('online');
      expect(COLORS.state).toHaveProperty('offline');
      expect(COLORS.state).toHaveProperty('warning');
      expect(COLORS.state).toHaveProperty('critical');
      expect(COLORS.state).toHaveProperty('unknown');
    });

    it('has building colors', () => {
      expect(COLORS.building).toHaveProperty('primary');
      expect(COLORS.building).toHaveProperty('dark');
    });

    it('has glow colors', () => {
      expect(COLORS.glow).toHaveProperty('cyan');
      expect(COLORS.glow).toHaveProperty('magenta');
    });
  });
});
