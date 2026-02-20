import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * DiamondTower Prefab - Crystalline faceted tower
 * Features: Wide base tapering upward with V-shaped facets,
 * neon lines following all edges, sequential facet illumination
 * Dimensions: 1.4 x 1.4 x 4.0 units (2x2 grid cells)
 */
export class DiamondTowerPrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private facetGlows: THREE.Mesh[] = [];
  private animTime = 0;
  private illuminationPhase = 0;

  // Tower dimensions
  private readonly BASE_WIDTH = 1.2;
  private readonly TOP_WIDTH = 0.6;
  private readonly TOWER_HEIGHT = 4.0;
  private readonly FACET_SEGMENTS = 8;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createCrystalBody();
    this.createFacetNeonLines();
    this.createFacetGlows();
    this.createTopStructure();
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Octagonal base platform
    const baseGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.15, 8);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.castShadow = true;
    this.group.add(base);

    // Neon border ring
    const ringGeo = new THREE.TorusGeometry(0.85, 0.02, 4, 8);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.pink,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createCrystalBody(): void {
    // Create custom geometry with V-shaped facets
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    const segments = this.FACET_SEGMENTS;
    const levels = 6; // Number of horizontal divisions

    // Generate vertices for each level
    const levelVertices: THREE.Vector3[][] = [];

    for (let level = 0; level <= levels; level++) {
      const t = level / levels;
      const y = t * this.TOWER_HEIGHT;

      // Radius tapers from BASE_WIDTH to TOP_WIDTH
      const baseRadius = this.BASE_WIDTH / 2;
      const topRadius = this.TOP_WIDTH / 2;
      const radius = baseRadius + (topRadius - baseRadius) * t;

      // Add slight V-shaped indentation at each level (alternating)
      const levelVerts: THREE.Vector3[] = [];

      for (let seg = 0; seg < segments; seg++) {
        const angle = (seg / segments) * Math.PI * 2;

        // Create V-shaped facets by pushing alternate vertices inward
        let r = radius;
        if (level > 0 && level < levels && seg % 2 === 0) {
          r *= 0.85; // Push inward for V shape
        }

        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        levelVerts.push(new THREE.Vector3(x, y, z));
      }

      levelVertices.push(levelVerts);
    }

    // Build faces from vertices
    for (let level = 0; level < levels; level++) {
      const bottom = levelVertices[level];
      const top = levelVertices[level + 1];

      for (let seg = 0; seg < segments; seg++) {
        const nextSeg = (seg + 1) % segments;

        // Bottom left, bottom right, top left, top right
        const bl = bottom[seg];
        const br = bottom[nextSeg];
        const tl = top[seg];
        const tr = top[nextSeg];

        // Triangle 1
        const baseIdx = vertices.length / 3;
        vertices.push(bl.x, bl.y + 0.15, bl.z);
        vertices.push(br.x, br.y + 0.15, br.z);
        vertices.push(tl.x, tl.y + 0.15, tl.z);
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);

        // Triangle 2
        vertices.push(br.x, br.y + 0.15, br.z);
        vertices.push(tr.x, tr.y + 0.15, tr.z);
        vertices.push(tl.x, tl.y + 0.15, tl.z);
        indices.push(baseIdx + 3, baseIdx + 4, baseIdx + 5);
      }
    }

    // Add top cap
    const topCenter = new THREE.Vector3(0, this.TOWER_HEIGHT + 0.15, 0);
    const topVerts = levelVertices[levels];
    for (let seg = 0; seg < segments; seg++) {
      const nextSeg = (seg + 1) % segments;
      const baseIdx = vertices.length / 3;

      vertices.push(topCenter.x, topCenter.y, topCenter.z);
      vertices.push(topVerts[seg].x, topVerts[seg].y + 0.15, topVerts[seg].z);
      vertices.push(topVerts[nextSeg].x, topVerts[nextSeg].y + 0.15, topVerts[nextSeg].z);
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.1,
      flatShading: true, // Emphasize facets
    });

    this.body = new THREE.Mesh(geometry, bodyMat);
    this.body.castShadow = true;
    this.group.add(this.body);
  }

  private createFacetNeonLines(): void {
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.pink,
      transparent: true,
      opacity: 0.9,
    });

    const segments = this.FACET_SEGMENTS;
    const levels = 6;

    // Calculate all edge vertices
    const levelVertices: THREE.Vector3[][] = [];

    for (let level = 0; level <= levels; level++) {
      const t = level / levels;
      const y = t * this.TOWER_HEIGHT + 0.15;

      const baseRadius = this.BASE_WIDTH / 2;
      const topRadius = this.TOP_WIDTH / 2;
      const radius = baseRadius + (topRadius - baseRadius) * t;

      const levelVerts: THREE.Vector3[] = [];

      for (let seg = 0; seg < segments; seg++) {
        const angle = (seg / segments) * Math.PI * 2;

        let r = radius;
        if (level > 0 && level < levels && seg % 2 === 0) {
          r *= 0.85;
        }

        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        levelVerts.push(new THREE.Vector3(x, y, z));
      }

      levelVertices.push(levelVerts);
    }

    // Vertical edges (main structure lines)
    for (let seg = 0; seg < segments; seg++) {
      const points: THREE.Vector3[] = [];
      for (let level = 0; level <= levels; level++) {
        points.push(levelVertices[level][seg]);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }

    // Horizontal edges at each level
    for (let level = 0; level <= levels; level++) {
      const points = [...levelVertices[level], levelVertices[level][0]];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }

    // Diagonal V-lines (connecting inward vertices)
    const orangeMat = new THREE.LineBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.7,
    });

    for (let level = 0; level < levels; level++) {
      for (let seg = 0; seg < segments; seg += 2) {
        const nextSeg = (seg + 1) % segments;
        const prevSeg = (seg - 1 + segments) % segments;

        // V shape from current to neighbors
        const current = levelVertices[level + 1][seg];
        const left = levelVertices[level][prevSeg];
        const right = levelVertices[level][nextSeg];

        const leftPoints = [left, current];
        const rightPoints = [right, current];

        const leftGeo = new THREE.BufferGeometry().setFromPoints(leftPoints);
        const rightGeo = new THREE.BufferGeometry().setFromPoints(rightPoints);

        const leftLine = new THREE.Line(leftGeo, orangeMat.clone());
        const rightLine = new THREE.Line(rightGeo, orangeMat.clone());

        this.neonEdges.push(leftLine);
        this.neonEdges.push(rightLine);
        this.group.add(leftLine);
        this.group.add(rightLine);
      }
    }
  }

  private createFacetGlows(): void {
    // Create small glowing panels at each facet center
    const segments = this.FACET_SEGMENTS;
    const levels = 6;

    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.pink,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    for (let level = 0; level < levels; level++) {
      const t = (level + 0.5) / levels;
      const y = t * this.TOWER_HEIGHT + 0.15;

      const baseRadius = this.BASE_WIDTH / 2;
      const topRadius = this.TOP_WIDTH / 2;
      const radius = (baseRadius + (topRadius - baseRadius) * t) * 0.7;

      for (let seg = 0; seg < segments; seg++) {
        const angle = ((seg + 0.5) / segments) * Math.PI * 2;

        const glowGeo = new THREE.PlaneGeometry(0.15, 0.3);
        const glow = new THREE.Mesh(glowGeo, glowMat.clone());

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        glow.position.set(x, y, z);
        glow.lookAt(0, y, 0);
        glow.rotateY(Math.PI);

        this.facetGlows.push(glow);
        this.group.add(glow);
      }
    }
  }

  private createTopStructure(): void {
    // Crystal crown at top
    const crownMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.95,
      roughness: 0.05,
    });

    const crownGeo = new THREE.ConeGeometry(0.15, 0.4, 8);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 0.15 + this.TOWER_HEIGHT + 0.2;
    this.group.add(crown);

    // Beacon at very top
    const beaconMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.pink,
      transparent: true,
      opacity: 0.95,
    });
    const beaconGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 0.15 + this.TOWER_HEIGHT + 0.45;
    this.addGlowMesh(beacon);
    this.group.add(beacon);

    // Top neon ring
    const topRingGeo = new THREE.TorusGeometry(this.TOP_WIDTH / 2 + 0.05, 0.02, 4, 8);
    const topRingMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.8,
    });
    const topRing = new THREE.Mesh(topRingGeo, topRingMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 0.15 + this.TOWER_HEIGHT;
    this.addGlowMesh(topRing);
    this.group.add(topRing);
  }

  private createGroundGlow(): void {
    const glowGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.pink,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    this.group.add(glow);
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    const edgeColor = isCritical ? COLORS.glow.red :
                      isWarning ? COLORS.glow.orange :
                      COLORS.glow.pink;

    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        if (this.status !== 'online') {
          edge.material.color.setHex(edgeColor);
        }
      }
    });

    this.facetGlows.forEach((glow) => {
      if (glow.material instanceof THREE.MeshBasicMaterial) {
        glow.material.opacity = isOffline ? 0.05 : 0.3;
      }
    });

    if (this.body?.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects animation speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') return;

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Sequential facet illumination (data flow effect)
    this.illuminationPhase += deltaTime * speed * 2;
    const totalFacets = this.facetGlows.length;
    const activeIdx = Math.floor(this.illuminationPhase % totalFacets);

    this.facetGlows.forEach((glow, idx) => {
      if (glow.material instanceof THREE.MeshBasicMaterial) {
        // Create traveling wave of illumination
        const distance = Math.abs(idx - activeIdx);
        const wrappedDistance = Math.min(distance, totalFacets - distance);
        const intensity = Math.max(0, 1 - wrappedDistance / 4);
        glow.material.opacity = 0.1 + intensity * 0.5;
      }
    });

    // Pulse neon edges
    const edgePulse = 0.6 + 0.4 * Math.sin(this.animTime * 2);
    this.neonEdges.forEach((edge, idx) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        // Alternate between pink and orange lines
        const isOrangeLine = idx >= this.FACET_SEGMENTS * 2;
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = isOrangeLine ?
            0.5 + 0.3 * Math.sin(this.animTime * 3 + idx * 0.2) :
            edgePulse;
        }
      }
    });
  }
}
