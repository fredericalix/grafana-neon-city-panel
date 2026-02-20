import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * TowerA Prefab - Massive Tron-style skyscraper with CRT screens
 * Features: 4 units tall, square tower, giant CRT screens on all 4 sides,
 * scanlines, flicker effects, cyberpunk aesthetic
 * Occupies 2x2 grid cells
 */
export class TowerAPrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private screenMeshes: THREE.Mesh[] = [];
  private animTime = 0;

  // CRT Screen system
  private screenCanvas!: HTMLCanvasElement;
  private screenContext!: CanvasRenderingContext2D;
  private screenTexture!: THREE.CanvasTexture;
  private displayText = 'WHOOKTOWN';
  private scanlineOffset = 0;
  private flickerIntensity = 0;

  // Tower dimensions (2x2 cells, 4 units tall)
  private readonly TOWER_WIDTH = 1.6; // ~2 cells wide
  private readonly TOWER_DEPTH = 1.6; // ~2 cells deep
  private readonly TOWER_HEIGHT = 4.0;
  private readonly SCREEN_WIDTH = 1.2;
  private readonly SCREEN_HEIGHT = 2.0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Base platform
    this.createBasePlatform();

    // Main tower body
    this.createTowerBody();

    // CRT Screens on all 4 sides
    this.createCRTScreens();

    // Neon edge lines
    this.createNeonEdges();

    // Top structure
    this.createTopStructure();

    // Ground glow
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
    // Large base platform
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    const baseGeo = new THREE.BoxGeometry(
      this.TOWER_WIDTH + 0.3,
      0.15,
      this.TOWER_DEPTH + 0.3
    );
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.castShadow = true;
    this.group.add(base);

    // Neon border around base
    const borderPoints = [
      new THREE.Vector3(-this.TOWER_WIDTH / 2 - 0.15, 0.15, -this.TOWER_DEPTH / 2 - 0.15),
      new THREE.Vector3(this.TOWER_WIDTH / 2 + 0.15, 0.15, -this.TOWER_DEPTH / 2 - 0.15),
      new THREE.Vector3(this.TOWER_WIDTH / 2 + 0.15, 0.15, this.TOWER_DEPTH / 2 + 0.15),
      new THREE.Vector3(-this.TOWER_WIDTH / 2 - 0.15, 0.15, this.TOWER_DEPTH / 2 + 0.15),
      new THREE.Vector3(-this.TOWER_WIDTH / 2 - 0.15, 0.15, -this.TOWER_DEPTH / 2 - 0.15),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const border = new THREE.Line(borderGeo, borderMat);
    this.neonEdges.push(border);
    this.group.add(border);
  }

  private createTowerBody(): void {
    // Main tower body - slightly tapered
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.15,
    });

    const bodyGeo = new THREE.BoxGeometry(
      this.TOWER_WIDTH,
      this.TOWER_HEIGHT,
      this.TOWER_DEPTH
    );
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.15 + this.TOWER_HEIGHT / 2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Horizontal accent bands
    const bandHeights = [0.8, 1.6, 2.4, 3.2];
    for (const h of bandHeights) {
      const bandMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.6,
      });
      const bandGeo = new THREE.BoxGeometry(
        this.TOWER_WIDTH + 0.02,
        0.05,
        this.TOWER_DEPTH + 0.02
      );
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.15 + h;
      this.addGlowMesh(band);
      this.group.add(band);
    }

    // Corner pillars
    const corners = [
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    for (const [cx, cz] of corners) {
      const pillarMat = new THREE.MeshStandardMaterial({
        color: COLORS.building.secondary,
        metalness: 0.8,
        roughness: 0.3,
      });
      const pillarGeo = new THREE.BoxGeometry(0.15, this.TOWER_HEIGHT + 0.3, 0.15);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(
        cx * (this.TOWER_WIDTH / 2 - 0.05),
        0.15 + this.TOWER_HEIGHT / 2,
        cz * (this.TOWER_DEPTH / 2 - 0.05)
      );
      this.group.add(pillar);
    }
  }

  private createCRTScreens(): void {
    // Create shared canvas for CRT screen texture
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 256;
    this.screenContext = this.screenCanvas.getContext('2d')!;

    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    // Initial render
    this.updateScreenTexture();

    // Screen positions (4 sides)
    const screenPositions = [
      { pos: [0, 0, this.TOWER_DEPTH / 2 + 0.01], rot: [0, 0, 0] },           // Front (Z+)
      { pos: [0, 0, -this.TOWER_DEPTH / 2 - 0.01], rot: [0, Math.PI, 0] },    // Back (Z-)
      { pos: [this.TOWER_WIDTH / 2 + 0.01, 0, 0], rot: [0, Math.PI / 2, 0] }, // Right (X+)
      { pos: [-this.TOWER_WIDTH / 2 - 0.01, 0, 0], rot: [0, -Math.PI / 2, 0] }, // Left (X-)
    ];

    for (const screen of screenPositions) {
      // Screen frame
      const frameMat = new THREE.MeshStandardMaterial({
        color: COLORS.building.metal,
        metalness: 0.9,
        roughness: 0.1,
      });
      const frameGeo = new THREE.BoxGeometry(
        this.SCREEN_WIDTH + 0.1,
        this.SCREEN_HEIGHT + 0.1,
        0.08
      );
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(
        screen.pos[0],
        0.15 + this.TOWER_HEIGHT / 2 + 0.3,
        screen.pos[2]
      );
      frame.rotation.set(screen.rot[0], screen.rot[1], screen.rot[2]);
      this.group.add(frame);

      // Screen display - position in front of frame (frame depth is 0.08)
      const screenMat = new THREE.MeshBasicMaterial({
        map: this.screenTexture,
        transparent: true,
        opacity: 0.95,
      });
      const screenGeo = new THREE.PlaneGeometry(this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      // Calculate position: frame position + half frame depth + small offset to be in front
      const frameDepthHalf = 0.04;
      const screenOffset = 0.02;
      screenMesh.position.set(
        screen.pos[0] === 0 ? 0 : (screen.pos[0] > 0 ? screen.pos[0] + frameDepthHalf + screenOffset : screen.pos[0] - frameDepthHalf - screenOffset),
        0.15 + this.TOWER_HEIGHT / 2 + 0.3,
        screen.pos[2] === 0 ? 0 : (screen.pos[2] > 0 ? screen.pos[2] + frameDepthHalf + screenOffset : screen.pos[2] - frameDepthHalf - screenOffset)
      );
      screenMesh.rotation.set(screen.rot[0], screen.rot[1], screen.rot[2]);
      this.screenMeshes.push(screenMesh);
      this.group.add(screenMesh);

      // Screen border glow - same position as screen mesh
      const glowMat = new THREE.LineBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.8,
      });
      const hw = this.SCREEN_WIDTH / 2;
      const hh = this.SCREEN_HEIGHT / 2;
      const glowPoints = [
        new THREE.Vector3(-hw, -hh, 0.05),
        new THREE.Vector3(hw, -hh, 0.05),
        new THREE.Vector3(hw, hh, 0.05),
        new THREE.Vector3(-hw, hh, 0.05),
        new THREE.Vector3(-hw, -hh, 0.05),
      ];
      const glowGeo = new THREE.BufferGeometry().setFromPoints(glowPoints);
      const glowLine = new THREE.Line(glowGeo, glowMat);
      glowLine.position.set(
        screen.pos[0] === 0 ? 0 : (screen.pos[0] > 0 ? screen.pos[0] + frameDepthHalf + screenOffset : screen.pos[0] - frameDepthHalf - screenOffset),
        0.15 + this.TOWER_HEIGHT / 2 + 0.3,
        screen.pos[2] === 0 ? 0 : (screen.pos[2] > 0 ? screen.pos[2] + frameDepthHalf + screenOffset : screen.pos[2] - frameDepthHalf - screenOffset)
      );
      glowLine.rotation.set(screen.rot[0], screen.rot[1], screen.rot[2]);
      this.neonEdges.push(glowLine);
      this.group.add(glowLine);
    }
  }

  private updateScreenTexture(): void {
    const ctx = this.screenContext;
    const canvas = this.screenCanvas;
    const text = this.displayText || 'WHOOKTOWN';

    // Clear with dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CRT curvature effect (vignette)
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width / 1.5
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Flicker effect - occasional brightness variation
    const flickerBrightness = 1 - this.flickerIntensity * 0.3;

    // Main text with glow effect
    ctx.save();
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Ghosting effect (offset copies)
    ctx.fillStyle = `rgba(255, 0, 128, ${0.15 * flickerBrightness})`;
    ctx.fillText(text, canvas.width / 2 - 3, canvas.height / 2);
    ctx.fillStyle = `rgba(0, 255, 255, ${0.15 * flickerBrightness})`;
    ctx.fillText(text, canvas.width / 2 + 3, canvas.height / 2);

    // Main glow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(0, 255, 255, ${0.9 * flickerBrightness})`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Bright center text
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * flickerBrightness})`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.restore();

    // Scanlines effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let y = this.scanlineOffset % 4; y < canvas.height; y += 4) {
      ctx.fillRect(0, y, canvas.width, 2);
    }

    // Horizontal interference line (random)
    if (Math.random() < 0.1) {
      const lineY = Math.random() * canvas.height;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, lineY, canvas.width, 2);
    }

    // Color aberration on edges
    ctx.fillStyle = 'rgba(255, 0, 128, 0.05)';
    ctx.fillRect(0, 0, 10, canvas.height);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);

    // Update texture
    this.screenTexture.needsUpdate = true;
  }

  private createNeonEdges(): void {
    // Vertical neon edges on tower corners
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.9,
    });

    const corners = [
      [-this.TOWER_WIDTH / 2, -this.TOWER_DEPTH / 2],
      [-this.TOWER_WIDTH / 2, this.TOWER_DEPTH / 2],
      [this.TOWER_WIDTH / 2, -this.TOWER_DEPTH / 2],
      [this.TOWER_WIDTH / 2, this.TOWER_DEPTH / 2],
    ];

    for (const [cx, cz] of corners) {
      const points = [
        new THREE.Vector3(cx, 0.15, cz),
        new THREE.Vector3(cx, 0.15 + this.TOWER_HEIGHT, cz),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createTopStructure(): void {
    // Top cap
    const capMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.9,
      roughness: 0.1,
    });
    const capGeo = new THREE.BoxGeometry(
      this.TOWER_WIDTH + 0.1,
      0.2,
      this.TOWER_DEPTH + 0.1
    );
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.15 + this.TOWER_HEIGHT + 0.1;
    this.group.add(cap);

    // Antenna array
    const antennaPositions = [
      [0, 0],
      [-0.3, -0.3], [0.3, -0.3],
      [-0.3, 0.3], [0.3, 0.3],
    ];
    for (let i = 0; i < antennaPositions.length; i++) {
      const [ax, az] = antennaPositions[i];
      const height = i === 0 ? 0.5 : 0.3;

      const antennaMat = new THREE.MeshStandardMaterial({
        color: COLORS.building.metal,
        metalness: 0.9,
        roughness: 0.1,
      });
      const antennaGeo = new THREE.CylinderGeometry(0.02, 0.03, height, 6);
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(ax, 0.15 + this.TOWER_HEIGHT + 0.2 + height / 2, az);
      this.group.add(antenna);

      // Beacon light on top
      const beaconMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.9,
      });
      const beaconGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(ax, 0.15 + this.TOWER_HEIGHT + 0.2 + height + 0.04, az);
      this.addGlowMesh(beacon);
      this.group.add(beacon);
    }

    // Top neon ring
    const ringGeo = new THREE.TorusGeometry(0.6, 0.02, 4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.15 + this.TOWER_HEIGHT + 0.25;
    ring.rotation.x = Math.PI / 2;
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createGroundGlow(): void {
    // Large ground glow under the tower
    const glowGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    this.group.add(glow);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  updateTowerText(text: string): void {
    this.displayText = text || 'WHOOKTOWN';
    this.updateScreenTexture();
  }

  // ---------------------------------------------------------------------------
  // STATUS & ACTIVITY
  // ---------------------------------------------------------------------------

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    // Dim neon edges
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        if (isCritical) {
          edge.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          edge.material.color.setHex(COLORS.glow.orange);
        } else {
          // Reset to original cyan color when online
          edge.material.color.setHex(COLORS.glow.cyan);
        }
      }
    });

    // Dim screens
    this.screenMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = isOffline ? 0.3 : 0.95;
      }
    });

    // Body emissive for warning/critical
    if (this.body?.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects CRT effects intensity
  }

  // ---------------------------------------------------------------------------
  // ANIMATION
  // ---------------------------------------------------------------------------

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') return;

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Update scanline offset for scrolling effect
    this.scanlineOffset += deltaTime * 60 * speed;

    // Random flicker effect
    if (Math.random() < 0.05 * speed) {
      this.flickerIntensity = Math.random() * 0.5;
    } else {
      this.flickerIntensity *= 0.9; // Decay
    }

    // Update CRT screen texture
    this.updateScreenTexture();

    // Pulse neon edges
    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = pulse;
        }
      }
    });

    // Screen brightness pulse (subtle)
    const screenPulse = 0.9 + 0.1 * Math.sin(this.animTime * 2);
    this.screenMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = screenPulse;
      }
    });
  }
}
