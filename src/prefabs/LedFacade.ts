import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * LedFacade Prefab - Shenzhen-style LED animated facade tower
 * Features: Rectangular tower with dynamic LED canvas on all facades,
 * animated wave patterns, scrolling bars, color transitions
 * Dimensions: 1.0 x 0.6 x 3.5 units (1x1 grid cell)
 */
export class LedFacadePrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private facadeMeshes: THREE.Mesh[] = [];
  private animTime = 0;

  // LED Canvas system
  private ledCanvas!: HTMLCanvasElement;
  private ledContext!: CanvasRenderingContext2D;
  private ledTexture!: THREE.CanvasTexture;
  private patternPhase = 0;
  private currentPattern: 'waves' | 'bars' | 'pulse' | 'rain' = 'waves';
  private patternTimer = 0;

  // Tower dimensions
  private readonly TOWER_WIDTH = 0.8;
  private readonly TOWER_DEPTH = 0.5;
  private readonly TOWER_HEIGHT = 3.5;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createTowerBody();
    this.createLedFacades();
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
      this.TOWER_WIDTH + 0.2,
      0.12,
      this.TOWER_DEPTH + 0.2
    );
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.06;
    base.castShadow = true;
    this.group.add(base);

    // Neon border
    const hw = (this.TOWER_WIDTH + 0.2) / 2;
    const hd = (this.TOWER_DEPTH + 0.2) / 2;
    const borderPoints = [
      new THREE.Vector3(-hw, 0.12, -hd),
      new THREE.Vector3(hw, 0.12, -hd),
      new THREE.Vector3(hw, 0.12, hd),
      new THREE.Vector3(-hw, 0.12, hd),
      new THREE.Vector3(-hw, 0.12, -hd),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.green,
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
    this.body.position.y = 0.12 + this.TOWER_HEIGHT / 2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Frame structure (dark metal edges)
    const frameMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Corner pillars
    const corners = [
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    for (const [cx, cz] of corners) {
      const pillarGeo = new THREE.BoxGeometry(0.08, this.TOWER_HEIGHT + 0.1, 0.08);
      const pillar = new THREE.Mesh(pillarGeo, frameMat);
      pillar.position.set(
        cx * (this.TOWER_WIDTH / 2 - 0.02),
        0.12 + this.TOWER_HEIGHT / 2,
        cz * (this.TOWER_DEPTH / 2 - 0.02)
      );
      this.group.add(pillar);
    }
  }

  private createLedFacades(): void {
    // Create shared canvas for LED facade texture
    this.ledCanvas = document.createElement('canvas');
    this.ledCanvas.width = 256;
    this.ledCanvas.height = 512;
    this.ledContext = this.ledCanvas.getContext('2d')!;

    this.ledTexture = new THREE.CanvasTexture(this.ledCanvas);
    this.ledTexture.minFilter = THREE.LinearFilter;
    this.ledTexture.magFilter = THREE.LinearFilter;

    // Initial render
    this.updateLedTexture();

    // Front facade (main display)
    const facadeGeo = new THREE.PlaneGeometry(
      this.TOWER_WIDTH - 0.1,
      this.TOWER_HEIGHT - 0.2
    );
    const facadeMat = new THREE.MeshBasicMaterial({
      map: this.ledTexture,
      transparent: true,
      opacity: 0.95,
    });

    // Front
    const frontFacade = new THREE.Mesh(facadeGeo, facadeMat);
    frontFacade.position.set(0, 0.12 + this.TOWER_HEIGHT / 2, this.TOWER_DEPTH / 2 + 0.01);
    this.facadeMeshes.push(frontFacade);
    this.group.add(frontFacade);

    // Back
    const backFacade = new THREE.Mesh(facadeGeo.clone(), facadeMat.clone());
    backFacade.position.set(0, 0.12 + this.TOWER_HEIGHT / 2, -this.TOWER_DEPTH / 2 - 0.01);
    backFacade.rotation.y = Math.PI;
    this.facadeMeshes.push(backFacade);
    this.group.add(backFacade);

    // Side facades (narrower)
    const sideFacadeGeo = new THREE.PlaneGeometry(
      this.TOWER_DEPTH - 0.1,
      this.TOWER_HEIGHT - 0.2
    );

    // Left
    const leftFacade = new THREE.Mesh(sideFacadeGeo, facadeMat.clone());
    leftFacade.position.set(-this.TOWER_WIDTH / 2 - 0.01, 0.12 + this.TOWER_HEIGHT / 2, 0);
    leftFacade.rotation.y = -Math.PI / 2;
    this.facadeMeshes.push(leftFacade);
    this.group.add(leftFacade);

    // Right
    const rightFacade = new THREE.Mesh(sideFacadeGeo.clone(), facadeMat.clone());
    rightFacade.position.set(this.TOWER_WIDTH / 2 + 0.01, 0.12 + this.TOWER_HEIGHT / 2, 0);
    rightFacade.rotation.y = Math.PI / 2;
    this.facadeMeshes.push(rightFacade);
    this.group.add(rightFacade);
  }

  private updateLedTexture(): void {
    const ctx = this.ledContext;
    const canvas = this.ledCanvas;
    const w = canvas.width;
    const h = canvas.height;

    // Clear with dark background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, w, h);

    // Choose pattern based on status
    if (this.status === 'critical') {
      this.drawAlertPattern(ctx, w, h);
    } else if (this.status === 'warning') {
      this.drawWarningPattern(ctx, w, h);
    } else {
      // Normal patterns
      switch (this.currentPattern) {
        case 'waves':
          this.drawWavePattern(ctx, w, h);
          break;
        case 'bars':
          this.drawBarsPattern(ctx, w, h);
          break;
        case 'pulse':
          this.drawPulsePattern(ctx, w, h);
          break;
        case 'rain':
          this.drawRainPattern(ctx, w, h);
          break;
      }
    }

    // Add scanline overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }

    this.ledTexture.needsUpdate = true;
  }

  private drawWavePattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const waveCount = 5;
    const phase = this.patternPhase;

    for (let i = 0; i < waveCount; i++) {
      const waveY = h - (phase * 100 + i * (h / waveCount)) % h;
      const gradient = ctx.createLinearGradient(0, waveY - 30, 0, waveY + 30);
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.8)');
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, waveY - 30, w, 60);
    }

    // Accent cyan glow at edges
    const edgeGradient = ctx.createLinearGradient(0, 0, w, 0);
    edgeGradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
    edgeGradient.addColorStop(0.1, 'rgba(0, 255, 255, 0)');
    edgeGradient.addColorStop(0.9, 'rgba(0, 255, 255, 0)');
    edgeGradient.addColorStop(1, 'rgba(0, 255, 255, 0.3)');
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, 0, w, h);
  }

  private drawBarsPattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const barCount = 12;
    const barHeight = h / barCount;

    for (let i = 0; i < barCount; i++) {
      const y = i * barHeight;
      const intensity = Math.sin(this.patternPhase * 3 + i * 0.5) * 0.5 + 0.5;
      const barWidth = w * intensity;

      const gradient = ctx.createLinearGradient(0, y, barWidth, y);
      gradient.addColorStop(0, `rgba(0, 255, 136, ${0.8 * intensity})`);
      gradient.addColorStop(0.7, `rgba(0, 255, 255, ${0.6 * intensity})`);
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, y + 2, barWidth, barHeight - 4);
    }
  }

  private drawPulsePattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const pulseRadius = (Math.sin(this.patternPhase * 2) * 0.5 + 0.5) * Math.max(w, h);
    const cx = w / 2;
    const cy = h / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0.9)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Add concentric rings
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let r = 20; r < pulseRadius; r += 40) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawRainPattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Digital rain effect
    const columnCount = 16;
    const columnWidth = w / columnCount;

    for (let col = 0; col < columnCount; col++) {
      const x = col * columnWidth;
      const speed = 0.5 + Math.sin(col * 1.7) * 0.3;
      const offset = (this.patternPhase * speed * h * 2) % (h * 1.5);

      const gradient = ctx.createLinearGradient(x, offset - h, x, offset);
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
      gradient.addColorStop(0.8, 'rgba(0, 255, 136, 0.7)');
      gradient.addColorStop(1, 'rgba(0, 255, 255, 1)');

      ctx.fillStyle = gradient;
      ctx.fillRect(x + 2, offset - h, columnWidth - 4, h);
    }
  }

  private drawWarningPattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const flash = Math.sin(this.patternPhase * 4) > 0;
    const intensity = flash ? 0.8 : 0.4;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `rgba(255, 170, 0, ${intensity})`);
    gradient.addColorStop(0.5, `rgba(255, 100, 0, ${intensity * 0.6})`);
    gradient.addColorStop(1, `rgba(255, 170, 0, ${intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Warning stripes
    ctx.fillStyle = `rgba(0, 0, 0, ${0.3})`;
    for (let y = (this.patternPhase * 50) % 40 - 40; y < h + 40; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y - 20);
      ctx.lineTo(w, y);
      ctx.lineTo(0, y + 20);
      ctx.fill();
    }
  }

  private drawAlertPattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const flash = Math.sin(this.patternPhase * 8) > 0;
    const intensity = flash ? 1.0 : 0.3;

    ctx.fillStyle = `rgba(255, 50, 50, ${intensity})`;
    ctx.fillRect(0, 0, w, h);

    // Pulsing center
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
    gradient.addColorStop(0, `rgba(255, 100, 100, ${intensity})`);
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // ALERT text
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = flash ? '#ffffff' : '#ff6666';
    ctx.fillText('ALERT', w / 2, h / 2);
  }

  private createNeonEdges(): void {
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.9,
    });

    const hw = this.TOWER_WIDTH / 2;
    const hd = this.TOWER_DEPTH / 2;
    const th = this.TOWER_HEIGHT;

    // Vertical corner edges
    const corners = [[-hw, -hd], [-hw, hd], [hw, -hd], [hw, hd]];
    for (const [cx, cz] of corners) {
      const points = [
        new THREE.Vector3(cx, 0.12, cz),
        new THREE.Vector3(cx, 0.12 + th, cz),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }

    // Top horizontal edges
    const topPoints = [
      new THREE.Vector3(-hw, 0.12 + th, -hd),
      new THREE.Vector3(hw, 0.12 + th, -hd),
      new THREE.Vector3(hw, 0.12 + th, hd),
      new THREE.Vector3(-hw, 0.12 + th, hd),
      new THREE.Vector3(-hw, 0.12 + th, -hd),
    ];
    const topGeo = new THREE.BufferGeometry().setFromPoints(topPoints);
    const topLine = new THREE.Line(topGeo, edgeMat.clone());
    this.neonEdges.push(topLine);
    this.group.add(topLine);
  }

  private createTopStructure(): void {
    // Rooftop equipment
    const equipMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.8,
      roughness: 0.3,
    });

    // AC unit style box
    const boxGeo = new THREE.BoxGeometry(0.2, 0.1, 0.15);
    const box = new THREE.Mesh(boxGeo, equipMat);
    box.position.set(0.15, 0.12 + this.TOWER_HEIGHT + 0.05, 0);
    this.group.add(box);

    // Antenna
    const antennaMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });
    const antennaGeo = new THREE.CylinderGeometry(0.01, 0.015, 0.25, 6);
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(-0.15, 0.12 + this.TOWER_HEIGHT + 0.125, 0);
    this.group.add(antenna);

    // Beacon
    const beaconMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.9,
    });
    const beaconGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(-0.15, 0.12 + this.TOWER_HEIGHT + 0.28, 0);
    this.addGlowMesh(beacon);
    this.group.add(beacon);
  }

  private createGroundGlow(): void {
    const glowGeo = new THREE.PlaneGeometry(1.5, 1.0);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
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
                      COLORS.glow.green;

    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        edge.material.color.setHex(edgeColor);
      }
    });

    this.facadeMeshes.forEach((mesh) => {
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
    // Activity affects animation speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') {return;}

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Update pattern phase
    this.patternPhase += deltaTime * speed;

    // Cycle patterns every 8 seconds (not in warning/critical)
    if (this.status === 'online') {
      this.patternTimer += deltaTime;
      if (this.patternTimer > 8) {
        this.patternTimer = 0;
        const patterns: Array<'waves' | 'bars' | 'pulse' | 'rain'> = ['waves', 'bars', 'pulse', 'rain'];
        const currentIdx = patterns.indexOf(this.currentPattern);
        this.currentPattern = patterns[(currentIdx + 1) % patterns.length];
      }
    }

    // Update LED texture
    this.updateLedTexture();

    // Pulse neon edges
    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 2);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = pulse;
        }
      }
    });
  }
}
