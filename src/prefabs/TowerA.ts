import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * TowerA Prefab - Massive Tron-style skyscraper with CRT screens
 * Occupies 2x2 grid cells
 * Ported from whooktown/threejs-scene
 */
export class TowerAPrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private screenMeshes: THREE.Mesh[] = [];
  private animTime = 0;

  private screenCanvas!: HTMLCanvasElement;
  private screenContext!: CanvasRenderingContext2D;
  private screenTexture!: THREE.CanvasTexture;
  private displayText = 'WHOOKTOWN';
  private displayText2 = '';
  private displayText3 = '';
  private scanlineOffset = 0;
  private flickerIntensity = 0;

  // Metric-reactive CRT effects (interpolated smoothly)
  private targetCpu = 0;
  private targetRam = 0;
  private currentCpu = 0;
  private currentRam = 0;

  private readonly TOWER_WIDTH = 1.6;
  private readonly TOWER_DEPTH = 1.6;
  private readonly TOWER_HEIGHT = 4.0;
  private readonly SCREEN_WIDTH = 1.2;
  private readonly SCREEN_HEIGHT = 2.0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createTowerBody();
    this.createCRTScreens();
    this.createNeonEdges();
    this.createTopStructure();
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
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
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 256;
    this.screenContext = this.screenCanvas.getContext('2d')!;

    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;

    this.updateScreenTexture();

    const screenPositions = [
      { pos: [0, 0, this.TOWER_DEPTH / 2 + 0.01], rot: [0, 0, 0] },
      { pos: [0, 0, -this.TOWER_DEPTH / 2 - 0.01], rot: [0, Math.PI, 0] },
      { pos: [this.TOWER_WIDTH / 2 + 0.01, 0, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [-this.TOWER_WIDTH / 2 - 0.01, 0, 0], rot: [0, -Math.PI / 2, 0] },
    ];

    for (const screen of screenPositions) {
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

      const screenMat = new THREE.MeshBasicMaterial({
        map: this.screenTexture,
        transparent: true,
        opacity: 0.95,
      });
      const screenGeo = new THREE.PlaneGeometry(this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
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
    const cx = canvas.width / 2;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CRT vignette
    const gradient = ctx.createRadialGradient(cx, canvas.height / 2, 0, cx, canvas.height / 2, canvas.width / 1.5);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const flickerBrightness = 1 - this.flickerIntensity * 0.3;

    // Aberration offset driven by RAM (0→±1px, 100→±6px)
    const aberrationOffset = 1 + (this.currentRam / 100) * 5;

    // Determine text lines and vertical positions
    const lines: { text: string; font: string; y: number }[] = [];
    const hasMultiple = this.displayText2 || this.displayText3;

    if (hasMultiple) {
      lines.push({ text: this.displayText || 'WHOOKTOWN', font: 'bold 40px monospace', y: 80 });
      if (this.displayText2) {
        lines.push({ text: this.displayText2, font: '28px monospace', y: 140 });
      }
      if (this.displayText3) {
        lines.push({ text: this.displayText3, font: '22px monospace', y: 190 });
      }
    } else {
      lines.push({ text: this.displayText || 'WHOOKTOWN', font: 'bold 48px monospace', y: canvas.height / 2 });
    }

    // Render each text line with CRT effects
    for (const line of lines) {
      ctx.save();
      ctx.font = line.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Chromatic ghosting (magenta left, cyan right)
      ctx.fillStyle = `rgba(255, 0, 128, ${0.15 * flickerBrightness})`;
      ctx.fillText(line.text, cx - aberrationOffset, line.y);
      ctx.fillStyle = `rgba(0, 255, 255, ${0.15 * flickerBrightness})`;
      ctx.fillText(line.text, cx + aberrationOffset, line.y);

      // Main glow
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(0, 255, 255, ${0.9 * flickerBrightness})`;
      ctx.fillText(line.text, cx, line.y);

      // Bright center
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * flickerBrightness})`;
      ctx.fillText(line.text, cx, line.y);
      ctx.restore();
    }

    // Scanlines — opacity driven by RAM (0→0.1, 100→0.35)
    const scanlineOpacity = 0.1 + (this.currentRam / 100) * 0.25;
    ctx.fillStyle = `rgba(0, 0, 0, ${scanlineOpacity})`;
    for (let y = this.scanlineOffset % 4; y < canvas.height; y += 4) {
      ctx.fillRect(0, y, canvas.width, 2);
    }

    // Random noise/interference — probability driven by CPU (0→5%, 100→30%)
    const noiseProbability = 0.05 + (this.currentCpu / 100) * 0.25;
    if (Math.random() < noiseProbability) {
      const lineY = Math.random() * canvas.height;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, lineY, canvas.width, 2);
    }

    // Edge chromatic aberration strips
    const edgeWidth = 10 + (this.currentRam / 100) * 10;
    const edgeOpacity = 0.05 + (this.currentRam / 100) * 0.1;
    ctx.fillStyle = `rgba(255, 0, 128, ${edgeOpacity})`;
    ctx.fillRect(0, 0, edgeWidth, canvas.height);
    ctx.fillStyle = `rgba(0, 255, 255, ${edgeOpacity})`;
    ctx.fillRect(canvas.width - edgeWidth, 0, edgeWidth, canvas.height);

    this.screenTexture.needsUpdate = true;
  }

  private createNeonEdges(): void {
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

  updateTowerText(text: string): void {
    this.displayText = text || 'WHOOKTOWN';
    this.updateScreenTexture();
  }

  override updateData(state: BuildingState): void {
    if (state.text1 !== undefined) {
      this.displayText = state.text1 || 'WHOOKTOWN';
    }
    if (state.text2 !== undefined) {
      this.displayText2 = state.text2;
    }
    if (state.text3 !== undefined) {
      this.displayText3 = state.text3;
    }
    if (state.cpuUsage !== undefined) {
      this.targetCpu = Math.max(0, Math.min(100, state.cpuUsage));
    }
    if (state.ramUsage !== undefined) {
      this.targetRam = Math.max(0, Math.min(100, state.ramUsage));
    }
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        if (isCritical) {
          edge.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          edge.material.color.setHex(COLORS.glow.orange);
        } else {
          edge.material.color.setHex(COLORS.glow.cyan);
        }
      }
    });

    this.screenMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = isOffline ? 0.3 : 0.95;
      }
    });

    if (this.body?.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects CRT effects intensity
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') return;

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Smooth interpolation of CPU/RAM metrics
    const lerpT = Math.min(1, 2.0 * deltaTime);
    this.currentCpu += (this.targetCpu - this.currentCpu) * lerpT;
    this.currentRam += (this.targetRam - this.currentRam) * lerpT;

    this.scanlineOffset += deltaTime * 60 * speed;

    // Flicker probability driven by CPU (0→0.05, 100→0.4)
    const flickerProb = (0.05 + (this.currentCpu / 100) * 0.35) * speed;
    // Flicker max intensity driven by CPU (0→0.2, 100→0.7)
    const flickerMax = 0.2 + (this.currentCpu / 100) * 0.5;
    if (Math.random() < flickerProb) {
      this.flickerIntensity = Math.random() * flickerMax;
    } else {
      this.flickerIntensity *= 0.9;
    }

    this.updateScreenTexture();

    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = pulse;
        }
      }
    });

    const screenPulse = 0.9 + 0.1 * Math.sin(this.animTime * 2);
    this.screenMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = screenPulse;
      }
    });
  }
}
