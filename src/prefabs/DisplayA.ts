import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState, DisplayRingCount } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * DisplayA Prefab - Futuristic Display Tower (Tron Legacy Style)
 * Features: Tall cylindrical tower, holographic rings with scrolling text,
 * circuit patterns, neon edges, cyberpunk aesthetic
 */
export class DisplayAPrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private circuitLines: THREE.Line[] = [];
  private animTime = 0;

  // Holographic rings system
  private rings: THREE.Group[] = [];
  private ringMeshes: THREE.Mesh[] = [];
  private ringCanvases: HTMLCanvasElement[] = [];
  private ringContexts: CanvasRenderingContext2D[] = [];
  private ringTextures: THREE.CanvasTexture[] = [];
  private textOffsets: number[] = [0, 0, 0];
  private texts: string[];

  // Configuration
  private ringCount: DisplayRingCount = 3;

  // Tower dimensions (similar to house_c height ~2.0)
  private readonly TOWER_HEIGHT = 1.8;
  private readonly TOWER_RADIUS = 0.15;
  private readonly BASE_RADIUS = 0.25;

  constructor(building: Building) {
    super(building);
    this.texts = [building.defaultText || 'WHOOKTOWN', 'SYSTEM ONLINE', 'STATUS OK'];
  }

  protected build(): void {
    // Base platform
    this.createBasePlatform();

    // Main tower body
    this.createTowerBody();

    // Circuit patterns on tower
    this.createCircuitPatterns();

    // Neon edge lines
    this.createNeonEdges();

    // Top beacon
    this.createTopBeacon();

    // Holographic rings with text
    this.createHolographicRings();

    // Ground glow effect (local)
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
    // Hexagonal base platform
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    const baseGeo = new THREE.CylinderGeometry(this.BASE_RADIUS, this.BASE_RADIUS + 0.05, 0.08, 8);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.04;
    base.castShadow = true;
    this.group.add(base);

    // Neon ring around base
    const ringGeo = new THREE.TorusGeometry(this.BASE_RADIUS + 0.02, 0.015, 4, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.08;
    ring.rotation.x = Math.PI / 2;
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createTowerBody(): void {
    // Main cylindrical tower with segments
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.15,
    });

    // Main body - slightly tapered
    const bodyGeo = new THREE.CylinderGeometry(
      this.TOWER_RADIUS * 0.8,
      this.TOWER_RADIUS,
      this.TOWER_HEIGHT,
      12,
      8
    );
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.08 + this.TOWER_HEIGHT / 2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Accent panels (geometric segments)
    const panelMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Vertical accent panels
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const panelGeo = new THREE.BoxGeometry(0.03, this.TOWER_HEIGHT * 0.8, 0.02);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      const radius = this.TOWER_RADIUS + 0.01;
      panel.position.set(
        Math.cos(angle) * radius,
        0.08 + this.TOWER_HEIGHT / 2,
        Math.sin(angle) * radius
      );
      panel.rotation.y = -angle;
      this.group.add(panel);
    }

    // Horizontal ring segments along tower
    const segmentHeights = [0.3, 0.6, 0.9, 1.2, 1.5];
    for (const h of segmentHeights) {
      const segGeo = new THREE.TorusGeometry(this.TOWER_RADIUS + 0.02, 0.012, 4, 16);
      const segMat = new THREE.MeshBasicMaterial({
        color: h % 0.6 < 0.3 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.7,
      });
      const seg = new THREE.Mesh(segGeo, segMat);
      seg.position.y = 0.08 + h;
      seg.rotation.x = Math.PI / 2;
      this.addGlowMesh(seg);
      this.group.add(seg);
    }
  }

  private createCircuitPatterns(): void {
    // Create circuit-like lines on the tower surface
    const circuitMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.6,
    });

    // Vertical circuit lines
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 12;
      const radius = this.TOWER_RADIUS + 0.005;

      const points: THREE.Vector3[] = [];
      const segments = 8;
      for (let j = 0; j <= segments; j++) {
        const y = 0.15 + (j / segments) * (this.TOWER_HEIGHT - 0.2);
        // Add slight zigzag for circuit effect
        const offset = (j % 2 === 0) ? 0 : 0.01;
        points.push(new THREE.Vector3(
          Math.cos(angle) * (radius + offset),
          y,
          Math.sin(angle) * (radius + offset)
        ));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, circuitMat.clone());
      this.circuitLines.push(line);
      this.group.add(line);
    }

    // Horizontal circuit connections
    const hHeights = [0.4, 0.8, 1.3];
    for (const h of hHeights) {
      const hPoints: THREE.Vector3[] = [];
      const hSegments = 12;
      for (let i = 0; i <= hSegments; i++) {
        const angle = (i / hSegments) * Math.PI * 2;
        const radius = this.TOWER_RADIUS + 0.008;
        hPoints.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          0.08 + h,
          Math.sin(angle) * radius
        ));
      }
      const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
      const hMat = new THREE.LineBasicMaterial({
        color: COLORS.glow.magenta,
        transparent: true,
        opacity: 0.5,
      });
      const hLine = new THREE.Line(hGeo, hMat);
      this.circuitLines.push(hLine);
      this.group.add(hLine);
    }
  }

  private createNeonEdges(): void {
    // Vertical neon edges on tower corners
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bottomRadius = this.TOWER_RADIUS;
      const topRadius = this.TOWER_RADIUS * 0.8;

      const points = [
        new THREE.Vector3(
          Math.cos(angle) * bottomRadius,
          0.08,
          Math.sin(angle) * bottomRadius
        ),
        new THREE.Vector3(
          Math.cos(angle) * topRadius,
          0.08 + this.TOWER_HEIGHT,
          Math.sin(angle) * topRadius
        ),
      ];

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createTopBeacon(): void {
    // Top dome
    const domeMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });
    const domeGeo = new THREE.SphereGeometry(this.TOWER_RADIUS * 0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.08 + this.TOWER_HEIGHT;
    this.group.add(dome);

    // Antenna spire
    const spireGeo = new THREE.CylinderGeometry(0.01, 0.02, 0.2, 6);
    const spire = new THREE.Mesh(spireGeo, domeMat);
    spire.position.y = 0.08 + this.TOWER_HEIGHT + 0.15;
    this.group.add(spire);

    // Top beacon light
    const beaconGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 0.08 + this.TOWER_HEIGHT + 0.28;
    this.addGlowMesh(beacon);
    this.group.add(beacon);
  }

  private createHolographicRings(): void {
    // Heights ordered from top to bottom: text1 (top), text2 (middle), text3 (bottom)
    const ringHeights = [1.5, 1.0, 0.5];
    // Radii for the text bands - increased for better visibility
    const ringRadii = [0.55, 0.6, 0.55];

    for (let i = 0; i < 3; i++) {
      const ringGroup = new THREE.Group();
      ringGroup.position.y = ringHeights[i];

      // Create canvas for scrolling text (taller for better visibility)
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      this.ringCanvases.push(canvas);
      this.ringContexts.push(ctx);

      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.ringTextures.push(texture);

      // Inner decorative ring (smaller radius, closer to tower)
      const innerRadius = ringRadii[i] - 0.12;
      const innerGeo = new THREE.TorusGeometry(innerRadius, 0.02, 4, 32);
      const innerMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.6,
      });
      const innerRing = new THREE.Mesh(innerGeo, innerMat);
      innerRing.rotation.x = Math.PI / 2;
      ringGroup.add(innerRing);

      // Text band - cylinder at OUTER radius for better readability
      // Using open-ended cylinder to display text on the outside surface
      const textBandRadius = ringRadii[i] + 0.05; // Outside the decorative rings
      const textBandHeight = 0.20; // Much taller for better visibility
      const ringGeo = new THREE.CylinderGeometry(
        textBandRadius,
        textBandRadius,
        textBandHeight,
        64,
        1,
        true // open-ended
      );
      const ringMat = new THREE.MeshBasicMaterial({
        map: texture,
        color: i % 2 === 0 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMeshes.push(ringMesh);
      ringGroup.add(ringMesh);

      // Outer glow ring (outside the text band) - thicker for visibility
      const outerGeo = new THREE.TorusGeometry(textBandRadius + 0.03, 0.012, 4, 32);
      const outerMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.5,
      });
      const outerRing = new THREE.Mesh(outerGeo, outerMat);
      outerRing.rotation.x = Math.PI / 2;
      outerRing.position.y = textBandHeight / 2;
      ringGroup.add(outerRing);

      // Bottom glow ring for text band
      const bottomGeo = new THREE.TorusGeometry(textBandRadius + 0.03, 0.012, 4, 32);
      const bottomRing = new THREE.Mesh(bottomGeo, outerMat.clone());
      bottomRing.rotation.x = Math.PI / 2;
      bottomRing.position.y = -textBandHeight / 2;
      ringGroup.add(bottomRing);

      // Initially hide ring 3 if ringCount is 2
      if (i === 2) {
        ringGroup.visible = this.ringCount === 3;
      }

      this.rings.push(ringGroup);
      this.group.add(ringGroup);
    }

    // Initial text render
    this.updateAllTexts();
  }

  private createGroundGlow(): void {
    // Local ground glow under the tower
    const glowGeo = new THREE.CircleGeometry(0.6, 32);
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

  private updateTextCanvas(index: number): void {
    if (index >= this.ringContexts.length) {return;}

    const ctx = this.ringContexts[index];
    const canvas = this.ringCanvases[index];
    const text = this.texts[index] || '';

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background with slight transparency
    ctx.fillStyle = 'rgba(0, 20, 40, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text styling - larger font for better visibility
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Repeat text to fill canvas for seamless scrolling
    const textWidth = ctx.measureText(text + '   ').width;
    const repeats = Math.ceil(canvas.width / textWidth) + 2;

    // Glow effect - stronger for visibility
    ctx.shadowColor = index % 2 === 0 ? '#00ffff' : '#ff00ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = index % 2 === 0 ? '#00ffff' : '#ff00ff';

    const offset = this.textOffsets[index] % textWidth;
    for (let i = 0; i < repeats; i++) {
      ctx.fillText(text + '   ', -offset + i * textWidth, canvas.height / 2);
    }

    // Update texture
    if (this.ringTextures[index]) {
      this.ringTextures[index].needsUpdate = true;
    }
  }

  private updateAllTexts(): void {
    for (let i = 0; i < 3; i++) {
      this.updateTextCanvas(i);
    }
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  updateRingCount(count: DisplayRingCount): void {
    this.ringCount = count;
    if (this.rings[2]) {
      this.rings[2].visible = count === 3;
    }
  }

  updateText(index: number, text: string): void {
    if (index >= 0 && index < 3) {
      this.texts[index] = text || '';
      this.updateTextCanvas(index);
    }
  }

  updateText1(text: string): void {
    this.updateText(0, text);
  }

  updateText2(text: string): void {
    this.updateText(1, text);
  }

  updateText3(text: string): void {
    this.updateText(2, text);
  }

  override updateData(state: BuildingState): void {
    if (state.text1 !== undefined) {
      this.updateText1(state.text1);
    }
    if (state.text2 !== undefined) {
      this.updateText2(state.text2);
    }
    if (state.text3 !== undefined) {
      this.updateText3(state.text3);
    }
    if (state.ringCount !== undefined) {
      this.updateRingCount(state.ringCount);
    }
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
          edge.material.color.setHex(COLORS.glow.cyan);
        }
      }
    });

    // Dim circuit lines
    this.circuitLines.forEach((line) => {
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.opacity = isOffline ? 0.1 : 0.6;
      }
    });

    // Dim rings
    this.ringMeshes.forEach((mesh, i) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = isOffline ? 0.2 : 0.8;
        if (isCritical) {
          mesh.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          mesh.material.color.setHex(COLORS.glow.orange);
        } else {
          mesh.material.color.setHex(i % 2 === 0 ? COLORS.glow.cyan : COLORS.glow.magenta);
        }
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
    // Activity affects rotation and scroll speed
  }

  // ---------------------------------------------------------------------------
  // ANIMATION
  // ---------------------------------------------------------------------------

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') {return;}

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Rotate holographic rings
    this.rings.forEach((ring, i) => {
      if (ring.visible) {
        // Alternate rotation direction
        ring.rotation.y += deltaTime * 0.3 * speed * (i % 2 === 0 ? 1 : -1);
      }
    });

    // Scroll text on rings
    for (let i = 0; i < 3; i++) {
      if (this.rings[i]?.visible) {
        this.textOffsets[i] += deltaTime * 80 * speed;
        this.updateTextCanvas(i);
      }
    }

    // Pulse neon edges
    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = pulse;
      }
    });

    // Pulse circuit lines with different phase
    const circuitPulse = 0.4 + 0.3 * Math.sin(this.animTime * 2 + 1);
    this.circuitLines.forEach((line, i) => {
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.opacity = circuitPulse * (0.8 + 0.2 * Math.sin(this.animTime * 4 + i * 0.5));
      }
    });

    // Holographic flicker effect on rings
    this.ringMeshes.forEach((mesh, i) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial && this.rings[i]?.visible) {
        // Subtle opacity flicker for holographic effect
        const flicker = 0.7 + 0.15 * Math.sin(this.animTime * 8 + i * 2) +
                        0.05 * Math.sin(this.animTime * 23 + i * 7); // High frequency noise
        mesh.material.opacity = flicker;
      }
    });
  }
}
