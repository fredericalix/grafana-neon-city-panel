import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * Spire Prefab - KK100-inspired ovoidal tower
 * Features: Tall cylindrical tower tapering to rounded top,
 * animated edge glow pulse, spiral windows, rotating beacon
 * Dimensions: 1.2 x 1.2 x 5.0 units (2x2 grid cells)
 */
export class SpirePrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private windows: THREE.Mesh[] = [];
  private edgePulseOffset = 0;
  private animTime = 0;
  private beacon!: THREE.Mesh;
  private topRing!: THREE.Mesh;

  // Tower dimensions
  private readonly TOWER_RADIUS = 0.5;
  private readonly TOWER_HEIGHT = 5.0;
  private readonly SEGMENTS = 24;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createTowerBody();
    this.createEdgeGlow();
    this.createSpiralWindows();
    this.createTopStructure();
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Hexagonal base platform
    const baseGeo = new THREE.CylinderGeometry(0.7, 0.8, 0.15, 6);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.castShadow = true;
    this.group.add(base);

    // Neon border ring
    const ringGeo = new THREE.TorusGeometry(0.75, 0.02, 4, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.gold,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createTowerBody(): void {
    // Create ovoidal profile using LatheGeometry
    const points: THREE.Vector2[] = [];
    const steps = 40;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * this.TOWER_HEIGHT;

      // Profile: wider at bottom, tapers to rounded top
      let radius: number;
      if (t < 0.7) {
        // Main body - slight taper
        radius = this.TOWER_RADIUS * (1 - t * 0.15);
      } else {
        // Top dome - exponential curve to point
        const domeT = (t - 0.7) / 0.3;
        const baseRadius = this.TOWER_RADIUS * 0.85;
        radius = baseRadius * Math.cos(domeT * Math.PI / 2);
      }

      points.push(new THREE.Vector2(Math.max(0.02, radius), y));
    }

    const bodyGeo = new THREE.LatheGeometry(points, this.SEGMENTS);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.15,
    });

    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.15;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Horizontal accent bands
    const bandHeights = [0.8, 1.6, 2.4, 3.2];
    for (const h of bandHeights) {
      // Calculate radius at this height
      const t = h / this.TOWER_HEIGHT;
      const bandRadius = this.TOWER_RADIUS * (1 - t * 0.15) + 0.02;

      const bandGeo = new THREE.TorusGeometry(bandRadius, 0.02, 4, this.SEGMENTS);
      const bandMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.gold,
        transparent: true,
        opacity: 0.7,
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.15 + h;
      this.addGlowMesh(band);
      this.group.add(band);
    }
  }

  private createEdgeGlow(): void {
    // Create vertical edge lines that pulse upward
    const edgeCount = 8;
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.gold,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < edgeCount; i++) {
      const angle = (i / edgeCount) * Math.PI * 2;
      const points: THREE.Vector3[] = [];

      // Follow the tower profile
      const steps = 50;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const y = t * this.TOWER_HEIGHT;

        let radius: number;
        if (t < 0.7) {
          radius = this.TOWER_RADIUS * (1 - t * 0.15);
        } else {
          const domeT = (t - 0.7) / 0.3;
          const baseRadius = this.TOWER_RADIUS * 0.85;
          radius = baseRadius * Math.cos(domeT * Math.PI / 2);
        }

        const x = Math.cos(angle) * (radius + 0.01);
        const z = Math.sin(angle) * (radius + 0.01);
        points.push(new THREE.Vector3(x, 0.15 + y, z));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createSpiralWindows(): void {
    const windowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.yellow,
      transparent: true,
      opacity: 0.7,
    });

    // Create spiral pattern of windows
    const windowCount = 60;
    const spiralTurns = 3;

    for (let i = 0; i < windowCount; i++) {
      const t = i / windowCount;
      const y = t * this.TOWER_HEIGHT * 0.65 + 0.3; // Stay in main body
      const angle = t * spiralTurns * Math.PI * 2;

      // Skip some windows randomly for variation
      if (Math.random() > 0.7) continue;

      // Calculate radius at this height
      const heightT = y / this.TOWER_HEIGHT;
      const radius = this.TOWER_RADIUS * (1 - heightT * 0.15) + 0.01;

      const windowGeo = new THREE.PlaneGeometry(0.08, 0.15);
      const window = new THREE.Mesh(windowGeo, windowMat.clone());

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      window.position.set(x, 0.15 + y, z);
      window.lookAt(0, 0.15 + y, 0);
      window.rotateY(Math.PI);

      this.windows.push(window);
      this.group.add(window);
    }
  }

  private createTopStructure(): void {
    // Antenna spire at very top
    const antennaMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });

    const antennaGeo = new THREE.CylinderGeometry(0.01, 0.02, 0.4, 8);
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 0.15 + this.TOWER_HEIGHT + 0.2;
    this.group.add(antenna);

    // Rotating beacon
    const beaconMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.gold,
      transparent: true,
      opacity: 0.95,
    });
    const beaconGeo = new THREE.SphereGeometry(0.06, 16, 16);
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.y = 0.15 + this.TOWER_HEIGHT + 0.45;
    this.addGlowMesh(this.beacon);
    this.group.add(this.beacon);

    // Top neon ring (just below dome)
    const topRingGeo = new THREE.TorusGeometry(0.35, 0.02, 8, 24);
    const topRingMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.yellow,
      transparent: true,
      opacity: 0.8,
    });
    this.topRing = new THREE.Mesh(topRingGeo, topRingMat);
    this.topRing.rotation.x = Math.PI / 2;
    this.topRing.position.y = 0.15 + this.TOWER_HEIGHT * 0.72;
    this.addGlowMesh(this.topRing);
    this.group.add(this.topRing);
  }

  private createGroundGlow(): void {
    const glowGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.gold,
      transparent: true,
      opacity: 0.12,
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

    // Update edge colors based on status
    const edgeColor = isCritical ? COLORS.glow.red :
                      isWarning ? COLORS.glow.orange :
                      COLORS.glow.gold;

    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        edge.material.color.setHex(edgeColor);
      }
    });

    // Dim windows
    this.windows.forEach((w) => {
      if (w.material instanceof THREE.MeshBasicMaterial) {
        w.material.opacity = isOffline ? 0.1 : 0.7;
      }
    });

    // Body emissive
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

    // Animate edge pulse (traveling wave up the tower)
    this.edgePulseOffset += deltaTime * speed * 2;
    if (this.edgePulseOffset > this.TOWER_HEIGHT) {
      this.edgePulseOffset = 0;
    }

    // Pulse the neon edges with traveling wave effect
    this.neonEdges.forEach((edge, idx) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        const phase = this.animTime * 3 + idx * 0.5;
        const pulse = 0.6 + 0.4 * Math.sin(phase);
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = pulse;
        }
      }
    });

    // Window flicker
    this.windows.forEach((w, i) => {
      if (w.material instanceof THREE.MeshBasicMaterial) {
        const phase = this.animTime * 2 + i * 0.3;
        const flicker = 0.5 + 0.4 * Math.sin(phase) + 0.1 * Math.sin(phase * 4.3);
        w.material.opacity = Math.min(0.85, flicker);
      }
    });

    // Rotate top ring
    if (this.topRing) {
      this.topRing.rotation.z += deltaTime * 0.5 * speed;
    }

    // Beacon pulse
    if (this.beacon?.material instanceof THREE.MeshBasicMaterial) {
      const beaconPulse = 0.7 + 0.3 * Math.sin(this.animTime * 4);
      this.beacon.material.opacity = beaconPulse;
    }
  }
}
