/**
 * RoadNetwork - Tron-style road rendering system
 *
 * Generates neon-edged road surfaces from a grid definition
 * and an animated ground grid overlay.
 */

import * as THREE from 'three';
import { COLORS } from '../prefabs/materials';

export class RoadNetwork {
  private group: THREE.Group;
  private neonEdges: THREE.Line[] = [];
  private centerLines: THREE.Line[] = [];
  private groundGrid: THREE.LineSegments | null = null;
  private pulseTime = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'RoadNetwork';
  }

  getObject(): THREE.Group {
    return this.group;
  }

  /**
   * Build road meshes from grid definition.
   * Each '1' in the roads array is a road cell at grid position (x, z).
   * Origin maps grid (0,0) to world-space coordinates.
   */
  build(roads: string[], origin: { x: number; z: number }): void {
    this.disposeRoads();

    if (!roads || roads.length === 0) {
      return;
    }

    // Parse grid into a Set for fast neighbor lookup
    const roadSet = new Set<string>();
    for (let z = 0; z < roads.length; z++) {
      const row = roads[z];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '1') {
          roadSet.add(`${x},${z}`);
        }
      }
    }

    const hasRoad = (gx: number, gz: number) => roadSet.has(`${gx},${gz}`);

    // Shared materials
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.road,
      metalness: 0.4,
      roughness: 0.6,
    });
    const neonEdgeMaterial = new THREE.LineBasicMaterial({
      color: COLORS.roadNeon,
      transparent: true,
      opacity: 0.9,
    });
    const centerLineMaterial = new THREE.LineBasicMaterial({
      color: 0xff00ff, // magenta
      transparent: true,
      opacity: 0.5,
    });

    // Merge all road surfaces into one geometry for performance
    const roadGeometries: THREE.BufferGeometry[] = [];

    for (let z = 0; z < roads.length; z++) {
      const row = roads[z];
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '1') {
          continue;
        }

        const worldX = origin.x + x;
        const worldZ = origin.z + z;

        // Road surface — toNonIndexed() so merge works without index buffer
        const planeGeo = new THREE.PlaneGeometry(1, 1).toNonIndexed();
        planeGeo.rotateX(-Math.PI / 2);
        planeGeo.translate(worldX, 0.005, worldZ);
        roadGeometries.push(planeGeo);

        // Check neighbors
        const hasN = hasRoad(x, z - 1);
        const hasS = hasRoad(x, z + 1);
        const hasW = hasRoad(x - 1, z);
        const hasE = hasRoad(x + 1, z);
        const neighborCount = [hasN, hasS, hasW, hasE].filter(Boolean).length;

        // Neon edges on boundaries (no adjacent road on that side)
        const edgeY = 0.02;
        if (!hasN) {
          this.addNeonEdge(worldX - 0.5, edgeY, worldZ - 0.5, worldX + 0.5, edgeY, worldZ - 0.5, neonEdgeMaterial);
        }
        if (!hasS) {
          this.addNeonEdge(worldX - 0.5, edgeY, worldZ + 0.5, worldX + 0.5, edgeY, worldZ + 0.5, neonEdgeMaterial);
        }
        if (!hasW) {
          this.addNeonEdge(worldX - 0.5, edgeY, worldZ - 0.5, worldX - 0.5, edgeY, worldZ + 0.5, neonEdgeMaterial);
        }
        if (!hasE) {
          this.addNeonEdge(worldX + 0.5, edgeY, worldZ - 0.5, worldX + 0.5, edgeY, worldZ + 0.5, neonEdgeMaterial);
        }

        // Center-line dashes on straight (non-intersection) segments
        if (neighborCount === 2) {
          const isVertical = hasN && hasS;
          const isHorizontal = hasW && hasE;

          if (isVertical) {
            // Vertical dash in center
            this.addCenterLine(worldX, edgeY, worldZ - 0.3, worldX, edgeY, worldZ + 0.3, centerLineMaterial);
          } else if (isHorizontal) {
            // Horizontal dash in center
            this.addCenterLine(worldX - 0.3, edgeY, worldZ, worldX + 0.3, edgeY, worldZ, centerLineMaterial);
          }
        }
      }
    }

    // Merge road surfaces into a single mesh
    if (roadGeometries.length > 0) {
      const merged = this.mergeGeometries(roadGeometries);
      const roadMesh = new THREE.Mesh(merged, roadMaterial);
      roadMesh.receiveShadow = true;
      this.group.add(roadMesh);

      // Dispose individual geometries after merging
      for (const geo of roadGeometries) {
        geo.dispose();
      }
    }
  }

  /**
   * Create Tron-style grid lines on the ground plane.
   */
  buildGroundGrid(size: number): void {
    if (this.groundGrid) {
      this.group.remove(this.groundGrid);
      this.groundGrid.geometry.dispose();
      (this.groundGrid.material as THREE.Material).dispose();
    }

    const halfSize = size / 2;
    const points: number[] = [];

    // Vertical lines
    for (let x = -halfSize; x <= halfSize; x += 1) {
      points.push(x, 0.002, -halfSize, x, 0.002, halfSize);
    }
    // Horizontal lines
    for (let z = -halfSize; z <= halfSize; z += 1) {
      points.push(-halfSize, 0.002, z, halfSize, 0.002, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

    const material = new THREE.LineBasicMaterial({
      color: COLORS.roadNeon,
      transparent: true,
      opacity: 0.08,
    });

    this.groundGrid = new THREE.LineSegments(geometry, material);
    this.groundGrid.name = 'GroundGrid';
    this.group.add(this.groundGrid);
  }

  /**
   * Update neon pulse animations.
   */
  update(deltaTime: number): void {
    this.pulseTime += deltaTime;

    // Neon edge pulse
    const edgeOpacity = 0.7 + 0.3 * Math.sin(this.pulseTime * 2);
    for (const edge of this.neonEdges) {
      (edge.material as THREE.LineBasicMaterial).opacity = edgeOpacity;
    }

    // Center line pulse (slower, subtler)
    const centerOpacity = 0.3 + 0.2 * Math.sin(this.pulseTime * 1.5);
    for (const line of this.centerLines) {
      (line.material as THREE.LineBasicMaterial).opacity = centerOpacity;
    }

    // Ground grid breathing
    if (this.groundGrid) {
      (this.groundGrid.material as THREE.LineBasicMaterial).opacity =
        0.06 + 0.04 * Math.sin(this.pulseTime * 1.5);
    }
  }

  dispose(): void {
    this.disposeRoads();
    if (this.groundGrid) {
      this.groundGrid.geometry.dispose();
      (this.groundGrid.material as THREE.Material).dispose();
      this.groundGrid = null;
    }
    this.group.clear();
  }

  // ---------------------------------------------------------------------------
  // PRIVATE
  // ---------------------------------------------------------------------------

  private disposeRoads(): void {
    // Remove all children except ground grid
    const toRemove: THREE.Object3D[] = [];
    for (const child of this.group.children) {
      if (child !== this.groundGrid) {
        toRemove.push(child);
      }
    }
    for (const obj of toRemove) {
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    }
    this.neonEdges = [];
    this.centerLines = [];
  }

  private addNeonEdge(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    material: THREE.LineBasicMaterial
  ): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geometry, material);
    this.neonEdges.push(line);
    this.group.add(line);
  }

  private addCenterLine(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    material: THREE.LineBasicMaterial
  ): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geometry, material);
    this.centerLines.push(line);
    this.group.add(line);
  }

  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let totalVertices = 0;
    for (const geo of geometries) {
      totalVertices += geo.getAttribute('position').count;
    }

    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    let offset = 0;

    for (const geo of geometries) {
      const posAttr = geo.getAttribute('position');
      const normAttr = geo.getAttribute('normal');
      const count = posAttr.count;

      for (let i = 0; i < count * 3; i++) {
        positions[offset * 3 + i] = (posAttr.array as Float32Array)[i];
        if (normAttr) {
          normals[offset * 3 + i] = (normAttr.array as Float32Array)[i];
        }
      }
      offset += count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return merged;
  }
}
