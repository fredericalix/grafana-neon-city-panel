import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * TwinTowers Prefab - Twin cylindrical towers with electric arcs
 * Features: Two parallel towers, antennas on top, animated electric arcs,
 * energy particles traveling between towers
 * Dimensions: 1.8 x 0.8 x 3.0 units (2x1 grid cells)
 */
export class TwinTowersPrefab extends BasePrefab {
  private towers: THREE.Mesh[] = [];
  private neonEdges: THREE.Line[] = [];
  private windows: THREE.Mesh[] = [];
  private arcLines: THREE.Line[] = [];
  // Sauron Eye components
  private eyeGroup!: THREE.Group;
  private eyeOuterRing!: THREE.Mesh;
  private eyeInnerGlow!: THREE.Mesh;
  private animTime = 0;
  private arcPhase = 0;
  private eyeRotation = 0;
  private eyeScanDirection = 1; // 1 or -1 for scanning direction

  // Non-status-colored elements (keep original violet/magenta colors)
  private bands: THREE.Mesh[] = [];
  private antennaTips: THREE.Mesh[] = [];
  private antennaRings: THREE.Mesh[] = [];

  // Tower dimensions
  private readonly TOWER_RADIUS = 0.25;
  private readonly TOWER_HEIGHT = 3.0;
  private readonly TOWER_SPACING = 0.8;
  private readonly ANTENNA_HEIGHT = 0.5;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createTowers();
    this.createAntennas();
    this.createElectricArcs();
    this.createSauronEye();
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Elongated base platform
    const baseGeo = new THREE.BoxGeometry(1.6, 0.12, 0.7);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.06;
    base.castShadow = true;
    this.group.add(base);

    // Neon border
    const borderMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.violet,
      transparent: true,
      opacity: 0.9,
    });
    const hw = 0.8;
    const hd = 0.35;
    const borderPoints = [
      new THREE.Vector3(-hw, 0.12, -hd),
      new THREE.Vector3(hw, 0.12, -hd),
      new THREE.Vector3(hw, 0.12, hd),
      new THREE.Vector3(-hw, 0.12, hd),
      new THREE.Vector3(-hw, 0.12, -hd),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const border = new THREE.Line(borderGeo, borderMat);
    this.neonEdges.push(border);
    this.group.add(border);
  }

  private createTowers(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.15,
    });

    const positions = [-this.TOWER_SPACING / 2, this.TOWER_SPACING / 2];

    for (const xPos of positions) {
      // Main tower body (octagonal)
      const towerGeo = new THREE.CylinderGeometry(
        this.TOWER_RADIUS,
        this.TOWER_RADIUS + 0.03,
        this.TOWER_HEIGHT,
        8
      );
      const tower = new THREE.Mesh(towerGeo, bodyMat.clone());
      tower.position.set(xPos, 0.12 + this.TOWER_HEIGHT / 2, 0);
      tower.castShadow = true;
      this.towers.push(tower);
      this.group.add(tower);

      // Horizontal accent bands
      const bandHeights = [0.5, 1.2, 1.9, 2.6];
      for (const h of bandHeights) {
        const bandGeo = new THREE.TorusGeometry(this.TOWER_RADIUS + 0.02, 0.015, 4, 8);
        const bandMat = new THREE.MeshBasicMaterial({
          color: COLORS.glow.violet,
          transparent: true,
          opacity: 0.7,
        });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(xPos, 0.12 + h, 0);
        this.bands.push(band); // Don't use addGlowMesh - we manage color manually
        this.group.add(band);
      }

      // Windows (spiral pattern)
      this.createTowerWindows(xPos);

      // Vertical neon lines on tower
      this.createTowerNeonLines(xPos);
    }
  }

  private createTowerWindows(xPos: number): void {
    const windowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.6,
    });

    const windowCount = 20;
    for (let i = 0; i < windowCount; i++) {
      const t = i / windowCount;
      const y = t * (this.TOWER_HEIGHT - 0.4) + 0.3;
      const angle = t * Math.PI * 4; // Two full rotations

      if (Math.random() > 0.7) continue;

      const windowGeo = new THREE.PlaneGeometry(0.06, 0.1);
      const window = new THREE.Mesh(windowGeo, windowMat.clone());

      const wx = xPos + Math.cos(angle) * (this.TOWER_RADIUS + 0.01);
      const wz = Math.sin(angle) * (this.TOWER_RADIUS + 0.01);
      window.position.set(wx, 0.12 + y, wz);
      window.lookAt(xPos, 0.12 + y, 0);
      window.rotateY(Math.PI);

      this.windows.push(window);
      this.group.add(window);
    }
  }

  private createTowerNeonLines(xPos: number): void {
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.violet,
      transparent: true,
      opacity: 0.9,
    });

    // 4 vertical lines per tower
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const lx = xPos + Math.cos(angle) * (this.TOWER_RADIUS + 0.01);
      const lz = Math.sin(angle) * (this.TOWER_RADIUS + 0.01);

      const points = [
        new THREE.Vector3(lx, 0.12, lz),
        new THREE.Vector3(lx, 0.12 + this.TOWER_HEIGHT, lz),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createAntennas(): void {
    const antennaMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.95,
      roughness: 0.05,
    });

    const positions = [-this.TOWER_SPACING / 2, this.TOWER_SPACING / 2];

    for (const xPos of positions) {
      // Main antenna
      const antennaGeo = new THREE.CylinderGeometry(0.02, 0.03, this.ANTENNA_HEIGHT, 6);
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(xPos, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT / 2, 0);
      this.group.add(antenna);

      // Antenna tip (glowing sphere)
      const tipMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.violet,
        transparent: true,
        opacity: 0.95,
      });
      const tipGeo = new THREE.SphereGeometry(0.05, 12, 12);
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(xPos, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT + 0.05, 0);
      this.antennaTips.push(tip); // Don't use addGlowMesh - we manage color manually
      this.group.add(tip);

      // Antenna ring
      const ringGeo = new THREE.TorusGeometry(0.08, 0.01, 4, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.magenta,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(xPos, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT * 0.7, 0);
      this.antennaRings.push(ring); // Don't use addGlowMesh - we manage color manually
      this.group.add(ring);
    }
  }

  private createElectricArcs(): void {
    // Create multiple arc lines between antenna tips
    const arcCount = 3;
    const arcMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.violet,
      transparent: true,
      opacity: 0.8,
    });

    const leftTip = new THREE.Vector3(-this.TOWER_SPACING / 2, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT + 0.05, 0);
    const rightTip = new THREE.Vector3(this.TOWER_SPACING / 2, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT + 0.05, 0);

    for (let a = 0; a < arcCount; a++) {
      // Create curved arc with control points
      const arcPoints: THREE.Vector3[] = [];
      const segments = 20;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        // Lerp between tips with vertical offset for arc shape
        const x = leftTip.x + (rightTip.x - leftTip.x) * t;
        const arcHeight = Math.sin(t * Math.PI) * (0.2 + a * 0.1);
        const y = leftTip.y + arcHeight;
        const z = (Math.random() - 0.5) * 0.1; // Slight z variation

        arcPoints.push(new THREE.Vector3(x, y, z));
      }

      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arc = new THREE.Line(arcGeo, arcMat.clone());
      this.arcLines.push(arc);
      this.group.add(arc);
    }
  }

  private createSauronEye(): void {
    // Eye of Sauron between the two towers - simplified version
    const eyeY = 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT * 0.5;

    this.eyeGroup = new THREE.Group();
    this.eyeGroup.position.set(0, eyeY, 0);

    // Colors for the fiery eye
    const FIRE_ORANGE = 0xff6600;
    const FIRE_YELLOW = 0xffaa00;

    // 1. Outer ring (iris) - vertical torus
    const outerRingGeo = new THREE.TorusGeometry(0.28, 0.04, 16, 32);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: FIRE_ORANGE,
      transparent: true,
      opacity: 0.95,
    });
    this.eyeOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.eyeOuterRing.rotation.y = Math.PI / 2; // Make it face forward (vertical)
    this.addGlowMesh(this.eyeOuterRing);
    this.eyeGroup.add(this.eyeOuterRing);

    // 2. Inner glow (eye interior) - stretched sphere
    const innerGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: FIRE_YELLOW,
      transparent: true,
      opacity: 0.6,
    });
    this.eyeInnerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    this.eyeInnerGlow.scale.set(0.5, 1, 0.3); // Flatten into eye shape
    this.addGlowMesh(this.eyeInnerGlow);
    this.eyeGroup.add(this.eyeInnerGlow);

    this.group.add(this.eyeGroup);
  }

  private createGroundGlow(): void {
    const glowGeo = new THREE.PlaneGeometry(2.0, 1.0);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.violet,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    this.group.add(glow);
  }

  private updateArcGeometry(): void {
    const leftTip = new THREE.Vector3(-this.TOWER_SPACING / 2, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT + 0.05, 0);
    const rightTip = new THREE.Vector3(this.TOWER_SPACING / 2, 0.12 + this.TOWER_HEIGHT + this.ANTENNA_HEIGHT + 0.05, 0);

    this.arcLines.forEach((arc, arcIdx) => {
      const positions = arc.geometry.attributes.position as THREE.BufferAttribute;
      const segments = positions.count - 1;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;

        // Add noise for lightning effect
        const noise = Math.sin(this.arcPhase * 10 + i * 0.5 + arcIdx) * 0.05;
        const jitter = (Math.random() - 0.5) * 0.02;

        const x = leftTip.x + (rightTip.x - leftTip.x) * t;
        const arcHeight = Math.sin(t * Math.PI) * (0.15 + arcIdx * 0.08 + noise);
        const y = leftTip.y + arcHeight + jitter;
        const z = noise * 2 + jitter;

        positions.setXYZ(i, x, y, z);
      }

      positions.needsUpdate = true;
    });
  }

  private updateSauronEye(deltaTime: number): void {
    const speed = this.getActivitySpeed();

    // 1. Scanning rotation - eye looks left and right
    const scanSpeed = 0.3 * speed;
    const maxRotation = Math.PI / 4; // 45 degrees each way

    this.eyeRotation += this.eyeScanDirection * deltaTime * scanSpeed;

    // Reverse direction at limits
    if (this.eyeRotation > maxRotation) {
      this.eyeRotation = maxRotation;
      this.eyeScanDirection = -1;
    } else if (this.eyeRotation < -maxRotation) {
      this.eyeRotation = -maxRotation;
      this.eyeScanDirection = 1;
    }

    this.eyeGroup.rotation.y = this.eyeRotation;

    // 2. Pulsing effect on the inner glow - speed affects pulse rate
    const pulse = 0.5 + 0.3 * Math.sin(this.animTime * 4 * speed);
    if (this.eyeInnerGlow.material instanceof THREE.MeshBasicMaterial) {
      this.eyeInnerGlow.material.opacity = pulse;
    }

    // 3. Outer ring pulse - speed affects pulse rate
    const ringPulse = 0.85 + 0.15 * Math.sin(this.animTime * 3 * speed);
    if (this.eyeOuterRing.material instanceof THREE.MeshBasicMaterial) {
      this.eyeOuterRing.material.opacity = ringPulse;
    }
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    const edgeColor = isCritical ? COLORS.glow.red :
                      isWarning ? COLORS.glow.orange :
                      COLORS.glow.violet;

    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        edge.material.color.setHex(edgeColor);
      }
    });

    this.arcLines.forEach((arc) => {
      if (arc.material instanceof THREE.LineBasicMaterial) {
        arc.material.opacity = isOffline ? 0 : 0.8;
        arc.material.color.setHex(edgeColor);
      }
    });

    // Update Sauron Eye visibility and color
    this.eyeGroup.visible = !isOffline;

    if (this.eyeOuterRing.material instanceof THREE.MeshBasicMaterial) {
      this.eyeOuterRing.material.color.setHex(
        isCritical ? 0xff0000 : isWarning ? 0xff4400 : 0xff6600
      );
    }
    if (this.eyeInnerGlow.material instanceof THREE.MeshBasicMaterial) {
      this.eyeInnerGlow.material.color.setHex(
        isCritical ? 0xff2200 : isWarning ? 0xff6600 : 0xffaa00
      );
    }

    this.windows.forEach((w) => {
      if (w.material instanceof THREE.MeshBasicMaterial) {
        w.material.opacity = isOffline ? 0.1 : 0.6;
      }
    });

    this.towers.forEach((tower) => {
      if (tower.material instanceof THREE.MeshStandardMaterial) {
        tower.material.emissive = new THREE.Color(
          isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
        );
      }
    });

    // Bands, antenna tips and rings - use violet/orange/red based on status
    // (not green for online - these keep their accent colors)
    const accentColor = isCritical ? COLORS.glow.red :
                        isWarning ? COLORS.glow.orange :
                        COLORS.glow.violet;

    this.bands.forEach((band) => {
      if (band.material instanceof THREE.MeshBasicMaterial) {
        band.material.color.setHex(accentColor);
        band.material.opacity = isOffline ? 0.2 : 0.7;
      }
    });

    this.antennaTips.forEach((tip) => {
      if (tip.material instanceof THREE.MeshBasicMaterial) {
        tip.material.color.setHex(accentColor);
        tip.material.opacity = isOffline ? 0.2 : 0.95;
      }
    });

    this.antennaRings.forEach((ring) => {
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.color.setHex(isCritical ? COLORS.glow.red :
                                   isWarning ? COLORS.glow.orange :
                                   COLORS.glow.magenta);
        ring.material.opacity = isOffline ? 0.2 : 0.8;
      }
    });
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects animation speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') return;

    this.animTime += deltaTime;
    this.arcPhase += deltaTime * this.getActivitySpeed() * 3;

    // Update electric arcs with lightning effect
    this.updateArcGeometry();

    // Update Sauron Eye
    this.updateSauronEye(deltaTime);

    // Pulse arc opacity
    const arcPulse = 0.5 + 0.5 * Math.sin(this.animTime * 8);
    this.arcLines.forEach((arc, idx) => {
      if (arc.material instanceof THREE.LineBasicMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          // Staggered flashing for lightning effect
          const flash = Math.sin(this.animTime * 15 + idx * 2) > 0.7 ? 1 : 0.4;
          arc.material.opacity = arcPulse * flash;
        }
      }
    });

    // Window flicker
    this.windows.forEach((w, i) => {
      if (w.material instanceof THREE.MeshBasicMaterial) {
        const phase = this.animTime * 2 + i * 0.4;
        const flicker = 0.4 + 0.4 * Math.sin(phase);
        w.material.opacity = Math.min(0.8, flicker);
      }
    });

    // Pulse neon edges in sync
    const edgePulse = 0.7 + 0.3 * Math.sin(this.animTime * 2);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = edgePulse;
        }
      }
    });
  }
}
