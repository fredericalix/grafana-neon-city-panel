import { PathGenerator } from './PathGenerator';

describe('PathGenerator', () => {
  let pg: PathGenerator;
  const origin = { x: 0, z: 0 };

  beforeEach(() => {
    pg = new PathGenerator();
  });

  describe('parseRoads', () => {
    it('produces 0 cells for empty array', () => {
      pg.parseRoads([], origin);
      expect(pg.getRoadCellCount()).toBe(0);
    });

    it('produces 0 cells for null/undefined', () => {
      pg.parseRoads(null as any, origin);
      expect(pg.getRoadCellCount()).toBe(0);

      pg.parseRoads(undefined as any, origin);
      expect(pg.getRoadCellCount()).toBe(0);
    });

    it('produces 1 cell for single "1"', () => {
      pg.parseRoads(['1'], origin);
      expect(pg.getRoadCellCount()).toBe(1);
    });

    it('produces 2 cells for "101" (gaps)', () => {
      pg.parseRoads(['101'], origin);
      expect(pg.getRoadCellCount()).toBe(2);
    });

    it('ignores non-"1" characters', () => {
      pg.parseRoads(['0X2'], origin);
      expect(pg.getRoadCellCount()).toBe(0);
    });

    it('calculates worldX/worldZ from origin', () => {
      const customOrigin = { x: 5, z: 10 };
      pg.parseRoads(['1'], customOrigin);
      const cells = pg.getRoadCells();
      expect(cells[0].worldX).toBe(5);
      expect(cells[0].worldZ).toBe(10);
    });

    it('links N/S neighbors correctly', () => {
      pg.parseRoads(['1', '1'], origin);
      const cells = pg.getRoadCells();
      // Two cells in a vertical line should be neighbors
      expect(cells[0].neighbors).toContain(cells[1]);
      expect(cells[1].neighbors).toContain(cells[0]);
    });

    it('links E/W neighbors correctly', () => {
      pg.parseRoads(['11'], origin);
      const cells = pg.getRoadCells();
      expect(cells[0].neighbors).toContain(cells[1]);
      expect(cells[1].neighbors).toContain(cells[0]);
    });

    it('does not link diagonal cells as neighbors', () => {
      pg.parseRoads(['10', '01'], origin);
      const cells = pg.getRoadCells();
      expect(cells[0].neighbors).not.toContain(cells[1]);
    });

    it('marks cells with >2 neighbors as intersections', () => {
      // Cross pattern: 3 neighbors for the center cell
      pg.parseRoads(['010', '111', '010'], origin);
      const cells = pg.getRoadCells();
      const center = cells.find((c) => c.x === 1 && c.z === 1);
      expect(center).toBeDefined();
      expect(center!.isIntersection).toBe(true);
      expect(center!.neighbors.length).toBe(4);
    });

    it('marks cells with <=2 neighbors as non-intersections', () => {
      pg.parseRoads(['111'], origin);
      const cells = pg.getRoadCells();
      // Middle cell has 2 neighbors, endpoints have 1
      for (const cell of cells) {
        expect(cell.isIntersection).toBe(false);
      }
    });
  });

  describe('getRoadCells / getRoadCellCount', () => {
    it('returns all parsed cells', () => {
      pg.parseRoads(['111'], origin);
      expect(pg.getRoadCells().length).toBe(3);
      expect(pg.getRoadCellCount()).toBe(3);
    });
  });

  describe('getRandomSpawnCell', () => {
    it('returns null when no roads', () => {
      pg.parseRoads([], origin);
      expect(pg.getRandomSpawnCell()).toBeNull();
    });

    it('returns a valid cell when roads exist', () => {
      pg.parseRoads(['111'], origin);
      const cell = pg.getRandomSpawnCell();
      expect(cell).not.toBeNull();
      expect(pg.getRoadCells()).toContain(cell);
    });
  });

  describe('generateRandomPath', () => {
    it('returns empty array when no roads', () => {
      pg.parseRoads([], origin);
      expect(pg.generateRandomPath()).toEqual([]);
    });

    it('returns a non-empty path when roads exist', () => {
      pg.parseRoads(['11111', '10001', '11111'], origin);
      const path = pg.generateRandomPath();
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('calculatePathLength', () => {
    it('returns 0 for empty path', () => {
      expect(pg.calculatePathLength([])).toBe(0);
    });

    it('returns 0 for single-point path', () => {
      const { Vector3 } = jest.requireMock('three');
      expect(pg.calculatePathLength([new Vector3(0, 0, 0)])).toBe(0);
    });

    it('computes correct length for known path', () => {
      const { Vector3 } = jest.requireMock('three');
      const path = [new Vector3(0, 0, 0), new Vector3(3, 0, 4)];
      expect(pg.calculatePathLength(path)).toBeCloseTo(5, 5);
    });
  });

  describe('getPointOnPath', () => {
    it('returns first point at t=0', () => {
      const { Vector3 } = jest.requireMock('three');
      const path = [new Vector3(0, 0, 0), new Vector3(10, 0, 0)];
      const point = pg.getPointOnPath(path, 0);
      expect(point.x).toBeCloseTo(0);
    });

    it('returns last point at t=1', () => {
      const { Vector3 } = jest.requireMock('three');
      const path = [new Vector3(0, 0, 0), new Vector3(10, 0, 0)];
      const point = pg.getPointOnPath(path, 1);
      expect(point.x).toBeCloseTo(10);
    });

    it('returns midpoint at t=0.5', () => {
      const { Vector3 } = jest.requireMock('three');
      const path = [new Vector3(0, 0, 0), new Vector3(10, 0, 0)];
      const point = pg.getPointOnPath(path, 0.5);
      expect(point.x).toBeCloseTo(5);
    });

    it('returns origin vector for empty path', () => {
      const point = pg.getPointOnPath([], 0.5);
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
      expect(point.z).toBe(0);
    });
  });

  describe('getDirectionOnPath', () => {
    it('returns a normalized direction vector', () => {
      const { Vector3 } = jest.requireMock('three');
      const path = [new Vector3(0, 0, 0), new Vector3(10, 0, 0)];
      const dir = pg.getDirectionOnPath(path, 0.5);
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      expect(len).toBeCloseTo(1, 1);
    });

    it('returns default direction for single-point path', () => {
      const { Vector3 } = jest.requireMock('three');
      const dir = pg.getDirectionOnPath([new Vector3(0, 0, 0)], 0.5);
      // Default is (0, 0, 1)
      expect(dir.z).toBe(1);
    });
  });
});
