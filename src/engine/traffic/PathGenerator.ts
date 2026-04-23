/**
 * PathGenerator - Road path navigation for traffic vehicles
 *
 * Generates paths along roads for vehicles to follow.
 * Parses a 2D string grid and builds a navigation graph.
 */

import * as THREE from 'three';
import { RoadCell, VEHICLE_HEIGHT } from './TrafficConfig';

export class PathGenerator {
  private roadCells: Map<string, RoadCell> = new Map();
  private cellList: RoadCell[] = [];

  /**
   * Parse roads array and build navigation graph.
   * Origin maps grid (0,0) to world-space coordinates.
   */
  parseRoads(roads: string[], origin: { x: number; z: number }): void {
    this.roadCells.clear();
    this.cellList = [];

    if (!roads || roads.length === 0) {
      return;
    }

    // First pass: Create all road cells
    for (let z = 0; z < roads.length; z++) {
      const row = roads[z];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '1') {
          const cell: RoadCell = {
            x,
            z,
            worldX: origin.x + x,
            worldZ: origin.z + z,
            neighbors: [],
            isIntersection: false,
          };
          const key = this.cellKey(x, z);
          this.roadCells.set(key, cell);
          this.cellList.push(cell);
        }
      }
    }

    // Second pass: Link neighbors and identify intersections
    for (const cell of this.cellList) {
      const neighborOffsets = [
        { dx: 0, dz: -1 }, // North
        { dx: 0, dz: 1 },  // South
        { dx: -1, dz: 0 }, // West
        { dx: 1, dz: 0 },  // East
      ];

      for (const offset of neighborOffsets) {
        const neighborKey = this.cellKey(cell.x + offset.dx, cell.z + offset.dz);
        const neighbor = this.roadCells.get(neighborKey);
        if (neighbor) {
          cell.neighbors.push(neighbor);
        }
      }

      // A cell is an intersection if it has more than 2 neighbors
      cell.isIntersection = cell.neighbors.length > 2;
    }
  }

  /**
   * Get all road cells
   */
  getRoadCells(): RoadCell[] {
    return this.cellList;
  }

  /**
   * Get road cell count
   */
  getRoadCellCount(): number {
    return this.cellList.length;
  }

  /**
   * Get a random road cell for spawning
   */
  getRandomSpawnCell(): RoadCell | null {
    if (this.cellList.length === 0) {return null;}
    return this.cellList[Math.floor(Math.random() * this.cellList.length)];
  }

  /**
   * Generate a random path starting from a given cell
   * Returns smoothed world-space coordinates
   */
  generateRandomPath(startCell?: RoadCell, minLength = 5): THREE.Vector3[] {
    if (this.cellList.length === 0) {
      return [];
    }

    // Use provided start or pick random
    const start = startCell ?? this.getRandomSpawnCell();
    if (!start) {return [];}

    const path: RoadCell[] = [start];
    const visited = new Set<string>();
    visited.add(this.cellKey(start.x, start.z));

    let current = start;
    let attempts = 0;
    const maxAttempts = 100;

    // Build path by following random neighbors
    while (path.length < minLength && attempts < maxAttempts) {
      attempts++;

      // Get unvisited neighbors
      const unvisitedNeighbors = current.neighbors.filter(
        n => !visited.has(this.cellKey(n.x, n.z))
      );

      if (unvisitedNeighbors.length === 0) {
        // Dead end - try to continue from any unvisited connected cell
        const anyUnvisited = current.neighbors.find(
          n => !visited.has(this.cellKey(n.x, n.z)) === false &&
               n.neighbors.some(nn => !visited.has(this.cellKey(nn.x, nn.z)))
        );
        if (anyUnvisited) {
          current = anyUnvisited;
          continue;
        }
        break;
      }

      // Prefer continuing straight if possible
      const nextCell = this.preferStraight(current, path, unvisitedNeighbors);
      path.push(nextCell);
      visited.add(this.cellKey(nextCell.x, nextCell.z));
      current = nextCell;
    }

    // If path is too short, extend it by allowing revisits
    if (path.length < minLength && path.length > 0) {
      current = path[path.length - 1];
      while (path.length < minLength) {
        if (current.neighbors.length === 0) {break;}
        const next = current.neighbors[Math.floor(Math.random() * current.neighbors.length)];
        path.push(next);
        current = next;
      }
    }

    // Convert to world coordinates
    const worldPath = path.map(cell =>
      new THREE.Vector3(cell.worldX, VEHICLE_HEIGHT, cell.worldZ)
    );

    // Smooth the path
    return this.smoothPath(worldPath, 4);
  }

  /**
   * Prefer continuing straight over turning
   */
  private preferStraight(
    current: RoadCell,
    path: RoadCell[],
    options: RoadCell[]
  ): RoadCell {
    if (path.length < 2 || options.length === 1) {
      return options[Math.floor(Math.random() * options.length)];
    }

    const prev = path[path.length - 2];
    const dx = current.x - prev.x;
    const dz = current.z - prev.z;

    // Look for a cell that continues in the same direction
    const straight = options.find(
      n => n.x === current.x + dx && n.z === current.z + dz
    );

    if (straight && Math.random() > 0.3) {
      return straight; // 70% chance to go straight
    }

    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Create path that follows road grid strictly with slight corner rounding
   */
  private smoothPath(points: THREE.Vector3[], _segments: number): THREE.Vector3[] {
    if (points.length < 2) {return points;}

    const result: THREE.Vector3[] = [];
    const cornerRadius = 0.15; // Small radius for corner rounding

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const prev = points[i - 1];
      const next = points[i + 1];

      if (!prev || !next) {
        // First or last point - just add it
        result.push(current.clone());
        continue;
      }

      // Check if this is a corner (direction changes)
      const dirIn = new THREE.Vector3().subVectors(current, prev).normalize();
      const dirOut = new THREE.Vector3().subVectors(next, current).normalize();
      const dot = dirIn.dot(dirOut);

      if (dot > 0.9) {
        // Nearly straight - just add the point
        result.push(current.clone());
      } else {
        // Corner detected - add rounded corner points
        // Point before corner
        const beforeCorner = current.clone().sub(dirIn.clone().multiplyScalar(cornerRadius));
        result.push(beforeCorner);

        // Add a few intermediate points for the corner arc
        const arcPoints = 3;
        for (let j = 1; j <= arcPoints; j++) {
          const t = j / (arcPoints + 1);
          const arcPoint = new THREE.Vector3().lerpVectors(
            beforeCorner,
            current.clone().add(dirOut.clone().multiplyScalar(cornerRadius)),
            t
          );
          // Pull toward the corner slightly for a rounder feel
          const pullToward = current.clone();
          arcPoint.lerp(pullToward, 0.3 * Math.sin(t * Math.PI));
          result.push(arcPoint);
        }

        // Point after corner
        const afterCorner = current.clone().add(dirOut.clone().multiplyScalar(cornerRadius));
        result.push(afterCorner);
      }
    }

    return result;
  }

  /**
   * Calculate total length of a path
   */
  calculatePathLength(path: THREE.Vector3[]): number {
    let length = 0;
    for (let i = 0; i < path.length - 1; i++) {
      length += path[i].distanceTo(path[i + 1]);
    }
    return length;
  }

  /**
   * Get point on path at progress t (0-1).
   * `cachedTotalLength` lets hot-path callers (vehicles in the render loop)
   * avoid re-walking the path each frame.
   */
  getPointOnPath(path: THREE.Vector3[], t: number, cachedTotalLength?: number): THREE.Vector3 {
    if (path.length === 0) {return new THREE.Vector3();}
    if (path.length === 1) {return path[0].clone();}

    const totalLength = cachedTotalLength ?? this.calculatePathLength(path);
    const targetDist = t * totalLength;

    let accDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const segmentLength = path[i].distanceTo(path[i + 1]);
      if (accDist + segmentLength >= targetDist) {
        const localT = (targetDist - accDist) / segmentLength;
        return path[i].clone().lerp(path[i + 1], localT);
      }
      accDist += segmentLength;
    }

    return path[path.length - 1].clone();
  }

  /**
   * Get direction at point on path.
   * Computes the total path length once and reuses it for the two sample points.
   */
  getDirectionOnPath(path: THREE.Vector3[], t: number, cachedTotalLength?: number): THREE.Vector3 {
    if (path.length < 2) {return new THREE.Vector3(0, 0, 1);}

    const totalLength = cachedTotalLength ?? this.calculatePathLength(path);
    const epsilon = 0.01;
    const t1 = Math.max(0, t - epsilon);
    const t2 = Math.min(1, t + epsilon);

    const p1 = this.getPointOnPath(path, t1, totalLength);
    const p2 = this.getPointOnPath(path, t2, totalLength);

    return p2.sub(p1).normalize();
  }

  /**
   * Create key for road cell
   */
  private cellKey(x: number, z: number): string {
    return `${x},${z}`;
  }
}
