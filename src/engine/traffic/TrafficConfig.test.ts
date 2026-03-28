import {
  getSpeedMultiplier,
  calculateTargetVehicleCount,
  getRandomPacketColor,
  DEFAULT_TRAFFIC_CONFIG,
  SPEED_MULTIPLIERS,
  TRAFFIC_COLORS,
  PERFORMANCE_LIMITS,
  TrafficSpeed,
} from './TrafficConfig';

describe('TrafficConfig', () => {
  describe('getSpeedMultiplier', () => {
    it('returns 0.5 for slow', () => {
      expect(getSpeedMultiplier('slow')).toBe(0.5);
    });

    it('returns 1.0 for normal', () => {
      expect(getSpeedMultiplier('normal')).toBe(1.0);
    });

    it('returns 2.0 for fast', () => {
      expect(getSpeedMultiplier('fast')).toBe(2.0);
    });

    it('falls back to normal (1.0) for unknown input', () => {
      expect(getSpeedMultiplier('turbo' as TrafficSpeed)).toBe(1.0);
    });
  });

  describe('calculateTargetVehicleCount', () => {
    it('returns 0 for density 0', () => {
      expect(calculateTargetVehicleCount(0, 100, 30)).toBe(0);
    });

    it('returns 0 for negative density', () => {
      expect(calculateTargetVehicleCount(-10, 100, 30)).toBe(0);
    });

    it('returns at least 1 for any positive density', () => {
      expect(calculateTargetVehicleCount(1, 100, 30)).toBeGreaterThanOrEqual(1);
    });

    it('returns expected value for mid-range density', () => {
      const result = calculateTargetVehicleCount(50, 100, 30);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(30);
    });

    it('is capped by maxVehicles', () => {
      const result = calculateTargetVehicleCount(100, 1000, 10);
      expect(result).toBeLessThanOrEqual(10);
    });

    it('is capped by road cells (30% of road count)', () => {
      // 5 road cells → max 1 (floor(5 * 0.3) = 1)
      const result = calculateTargetVehicleCount(100, 5, 30);
      expect(result).toBeLessThanOrEqual(Math.floor(5 * 0.3));
    });

    it('returns maxVehicles at 100% density when roads allow', () => {
      const result = calculateTargetVehicleCount(100, 1000, 30);
      expect(result).toBe(30);
    });
  });

  describe('getRandomPacketColor', () => {
    it('returns a color from TRAFFIC_COLORS.dataPacket', () => {
      const color = getRandomPacketColor();
      expect(TRAFFIC_COLORS.dataPacket).toContain(color);
    });

    it('returns a number', () => {
      expect(typeof getRandomPacketColor()).toBe('number');
    });
  });

  describe('constants', () => {
    it('DEFAULT_TRAFFIC_CONFIG has expected shape', () => {
      expect(DEFAULT_TRAFFIC_CONFIG).toMatchObject({
        density: expect.any(Number),
        speed: expect.any(String),
        maxVehicles: expect.any(Number),
        lightCycleRatio: expect.any(Number),
        enabled: expect.any(Boolean),
      });
    });

    it('SPEED_MULTIPLIERS covers all TrafficSpeed values', () => {
      expect(SPEED_MULTIPLIERS).toHaveProperty('slow');
      expect(SPEED_MULTIPLIERS).toHaveProperty('normal');
      expect(SPEED_MULTIPLIERS).toHaveProperty('fast');
    });

    it('PERFORMANCE_LIMITS has reasonable values', () => {
      expect(PERFORMANCE_LIMITS.maxVehiclesDefault).toBeGreaterThan(0);
      expect(PERFORMANCE_LIMITS.maxVehiclesHigh).toBeGreaterThanOrEqual(
        PERFORMANCE_LIMITS.maxVehiclesDefault
      );
    });
  });
});
