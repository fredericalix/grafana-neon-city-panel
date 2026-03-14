import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState, DisplayRingCount } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';
import { ScreenPalette, neonToPalette, DEFAULT_NEON } from './neonPalette';

// =============================================================================
// CONFIGURATION — ~5x scale of DisplayA to match MonitorTubeGiant height
// =============================================================================

const CONFIG = {
  tower: {
    height: 9.0,
    radiusTop: 0.6,
    radiusBottom: 0.75,
    segments: 12,
    heightSegments: 8,
  },
  base: {
    radiusTop: 1.25,
    radiusBottom: 1.5,
    height: 0.4,
    sides: 8,
  },
  rings: {
    heights: [7.5, 5.0, 2.5],
    radii: [3.0, 3.25, 3.0],
    textBandHeight: 1.0,
    textBandOffset: 0.25,
    innerRingOffset: 0.6,
    innerRingTube: 0.1,
    outerGlowTube: 0.06,
    outerGlowOffset: 0.15,
    segments: 64,
  },
  screen: {
    canvasWidth: 2048,
    canvasHeight: 256,
    fontSize: 96,
    scrollSpeed: 80,
  },
  beacon: {
    domeRadius: 0.45,
    spireRadiusTop: 0.05,
    spireRadiusBottom: 0.1,
    spireHeight: 1.0,
    lightRadius: 0.15,
  },
  groundGlowRadius: 3.0,
  baseNeonRingRadius: 1.35,
  baseNeonRingTube: 0.075,
  accentPanelWidth: 0.15,
  accentPanelDepth: 0.1,
  segmentRingHeights: [1.5, 3.0, 4.5, 6.0, 7.5],
  segmentRingTube: 0.06,
  circuitLineRadius: 0.04,
  neonEdgeCount: 4,
  circuitVerticalCount: 6,
  circuitHorizontalHeights: [2.0, 4.0, 6.5],
};

// =============================================================================
// DISPLAY A GIANT PREFAB
// =============================================================================

/**
 * DisplayAGiant — ~5x scale Display A to match MonitorTubeGiant height.
 *
 * Futuristic display tower with 2-3 holographic text rings, circuit patterns,
 * neon edges, and a top beacon. Supports per-building neon color preset.
 */
export class DisplayAGiantPrefab extends BasePrefab {
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

  // User-chosen neon color
  private baseNeonColor: string;
  private screenColors: ScreenPalette;

  constructor(building: Building) {
    super(building);
    this.texts = [building.defaultText || 'WHOOKTOWN', 'SYSTEM ONLINE', 'STATUS OK'];
    this.baseNeonColor = building.color || DEFAULT_NEON;
    this.screenColors = neonToPalette(this.baseNeonColor);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createTowerBody();
    this.createCircuitPatterns();
    this.createNeonEdges();
    this.createTopBeacon();
    this.createHolographicRings();
    this.createGroundGlow();
  }

  // ===========================================================================
  // COMPONENT CREATION
  // ===========================================================================

  private createBasePlatform(): void {
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    const baseGeo = new THREE.CylinderGeometry(
      CONFIG.base.radiusTop, CONFIG.base.radiusBottom, CONFIG.base.height, CONFIG.base.sides
    );
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = CONFIG.base.height / 2;
    base.castShadow = true;
    this.group.add(base);

    // Neon ring around base
    const ringGeo = new THREE.TorusGeometry(CONFIG.baseNeonRingRadius, CONFIG.baseNeonRingTube, 4, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.baseNeonColor),
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = CONFIG.base.height;
    ring.rotation.x = Math.PI / 2;
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createTowerBody(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.15,
    });

    const bodyGeo = new THREE.CylinderGeometry(
      CONFIG.tower.radiusTop, CONFIG.tower.radiusBottom,
      CONFIG.tower.height, CONFIG.tower.segments, CONFIG.tower.heightSegments
    );
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = CONFIG.base.height + CONFIG.tower.height / 2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Vertical accent panels
    const panelMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.8,
      roughness: 0.3,
    });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const panelGeo = new THREE.BoxGeometry(
        CONFIG.accentPanelWidth, CONFIG.tower.height * 0.8, CONFIG.accentPanelDepth
      );
      const panel = new THREE.Mesh(panelGeo, panelMat);
      const radius = CONFIG.tower.radiusBottom + 0.05;
      panel.position.set(
        Math.cos(angle) * radius,
        CONFIG.base.height + CONFIG.tower.height / 2,
        Math.sin(angle) * radius
      );
      panel.rotation.y = -angle;
      this.group.add(panel);
    }

    // Horizontal ring segments along tower
    for (const h of CONFIG.segmentRingHeights) {
      const segGeo = new THREE.TorusGeometry(CONFIG.tower.radiusBottom + 0.1, CONFIG.segmentRingTube, 4, 16);
      const segMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.baseNeonColor),
        transparent: true,
        opacity: 0.7,
      });
      const seg = new THREE.Mesh(segGeo, segMat);
      seg.position.y = CONFIG.base.height + h;
      seg.rotation.x = Math.PI / 2;
      this.addGlowMesh(seg);
      this.group.add(seg);
    }
  }

  private createCircuitPatterns(): void {
    const circuitMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.baseNeonColor),
      transparent: true,
      opacity: 0.6,
    });

    // Vertical circuit lines
    for (let i = 0; i < CONFIG.circuitVerticalCount; i++) {
      const angle = (i / CONFIG.circuitVerticalCount) * Math.PI * 2 + Math.PI / 12;
      const radius = CONFIG.tower.radiusBottom + 0.025;

      const points: THREE.Vector3[] = [];
      const segments = 8;
      for (let j = 0; j <= segments; j++) {
        const y = CONFIG.base.height + 0.75 + (j / segments) * (CONFIG.tower.height - 1.0);
        const offset = (j % 2 === 0) ? 0 : 0.05;
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
    for (const h of CONFIG.circuitHorizontalHeights) {
      const hPoints: THREE.Vector3[] = [];
      const hSegments = 12;
      for (let i = 0; i <= hSegments; i++) {
        const angle = (i / hSegments) * Math.PI * 2;
        const radius = CONFIG.tower.radiusBottom + 0.04;
        hPoints.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          CONFIG.base.height + h,
          Math.sin(angle) * radius
        ));
      }
      const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
      const hMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.baseNeonColor),
        transparent: true,
        opacity: 0.5,
      });
      const hLine = new THREE.Line(hGeo, hMat);
      this.circuitLines.push(hLine);
      this.group.add(hLine);
    }
  }

  private createNeonEdges(): void {
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.baseNeonColor),
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < CONFIG.neonEdgeCount; i++) {
      const angle = (i / CONFIG.neonEdgeCount) * Math.PI * 2 + Math.PI / 4;

      const points = [
        new THREE.Vector3(
          Math.cos(angle) * CONFIG.tower.radiusBottom,
          CONFIG.base.height,
          Math.sin(angle) * CONFIG.tower.radiusBottom
        ),
        new THREE.Vector3(
          Math.cos(angle) * CONFIG.tower.radiusTop,
          CONFIG.base.height + CONFIG.tower.height,
          Math.sin(angle) * CONFIG.tower.radiusTop
        ),
      ];

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createTopBeacon(): void {
    const domeMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });
    const domeGeo = new THREE.SphereGeometry(
      CONFIG.beacon.domeRadius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2
    );
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = CONFIG.base.height + CONFIG.tower.height;
    this.group.add(dome);

    // Antenna spire
    const spireGeo = new THREE.CylinderGeometry(
      CONFIG.beacon.spireRadiusTop, CONFIG.beacon.spireRadiusBottom, CONFIG.beacon.spireHeight, 6
    );
    const spire = new THREE.Mesh(spireGeo, domeMat);
    spire.position.y = CONFIG.base.height + CONFIG.tower.height + CONFIG.beacon.spireHeight / 2 + 0.1;
    this.group.add(spire);

    // Top beacon light
    const beaconGeo = new THREE.SphereGeometry(CONFIG.beacon.lightRadius, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.baseNeonColor),
      transparent: true,
      opacity: 0.9,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = CONFIG.base.height + CONFIG.tower.height + CONFIG.beacon.spireHeight + 0.3;
    this.addGlowMesh(beacon);
    this.group.add(beacon);
  }

  private createHolographicRings(): void {
    const { heights, radii, textBandHeight, textBandOffset, innerRingOffset, innerRingTube,
            outerGlowTube, outerGlowOffset, segments } = CONFIG.rings;

    for (let i = 0; i < 3; i++) {
      const ringGroup = new THREE.Group();
      ringGroup.position.y = heights[i];

      // Canvas for scrolling text
      const canvas = document.createElement('canvas');
      canvas.width = CONFIG.screen.canvasWidth;
      canvas.height = CONFIG.screen.canvasHeight;
      const ctx = canvas.getContext('2d')!;
      this.ringCanvases.push(canvas);
      this.ringContexts.push(ctx);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.ringTextures.push(texture);

      // Inner decorative ring
      const innerRadius = radii[i] - innerRingOffset;
      const innerGeo = new THREE.TorusGeometry(innerRadius, innerRingTube, 4, 32);
      const innerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.baseNeonColor),
        transparent: true,
        opacity: 0.6,
      });
      const innerRing = new THREE.Mesh(innerGeo, innerMat);
      innerRing.rotation.x = Math.PI / 2;
      ringGroup.add(innerRing);

      // Text band cylinder
      const textBandRadius = radii[i] + textBandOffset;
      const ringGeo = new THREE.CylinderGeometry(
        textBandRadius, textBandRadius, textBandHeight, segments, 1, true
      );
      const ringMat = new THREE.MeshBasicMaterial({
        map: texture,
        color: new THREE.Color(this.baseNeonColor),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMeshes.push(ringMesh);
      ringGroup.add(ringMesh);

      // Outer glow ring (top)
      const outerGeo = new THREE.TorusGeometry(textBandRadius + outerGlowOffset, outerGlowTube, 4, 32);
      const outerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.baseNeonColor),
        transparent: true,
        opacity: 0.5,
      });
      const outerRing = new THREE.Mesh(outerGeo, outerMat);
      outerRing.rotation.x = Math.PI / 2;
      outerRing.position.y = textBandHeight / 2;
      ringGroup.add(outerRing);

      // Bottom glow ring
      const bottomGeo = new THREE.TorusGeometry(textBandRadius + outerGlowOffset, outerGlowTube, 4, 32);
      const bottomRing = new THREE.Mesh(bottomGeo, outerMat.clone());
      bottomRing.rotation.x = Math.PI / 2;
      bottomRing.position.y = -textBandHeight / 2;
      ringGroup.add(bottomRing);

      // Ring 3 visibility
      if (i === 2) {
        ringGroup.visible = this.ringCount === 3;
      }

      this.rings.push(ringGroup);
      this.group.add(ringGroup);
    }

    this.updateAllTexts();
  }

  private createGroundGlow(): void {
    const glowGeo = new THREE.CircleGeometry(CONFIG.groundGlowRadius, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.baseNeonColor),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    this.group.add(glow);
  }

  // ===========================================================================
  // TEXT RENDERING
  // ===========================================================================

  private updateTextCanvas(index: number): void {
    if (index >= this.ringContexts.length) {
      return;
    }

    const ctx = this.ringContexts[index];
    const canvas = this.ringCanvases[index];
    const text = this.texts[index] || '';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background with slight tint from neon color
    ctx.fillStyle = this.screenColors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text styling
    ctx.font = `bold ${CONFIG.screen.fontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Repeat text for seamless scrolling
    const textWidth = ctx.measureText(text + '   ').width;
    const repeats = Math.ceil(canvas.width / textWidth) + 2;

    // Glow effect
    ctx.shadowColor = this.screenColors.glow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.screenColors.text;

    const offset = this.textOffsets[index] % textWidth;
    for (let i = 0; i < repeats; i++) {
      ctx.fillText(text + '   ', -offset + i * textWidth, canvas.height / 2);
    }

    if (this.ringTextures[index]) {
      this.ringTextures[index].needsUpdate = true;
    }
  }

  private updateAllTexts(): void {
    for (let i = 0; i < 3; i++) {
      this.updateTextCanvas(i);
    }
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

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

  updateText1(text: string): void { this.updateText(0, text); }
  updateText2(text: string): void { this.updateText(1, text); }
  updateText3(text: string): void { this.updateText(2, text); }

  override updateData(state: BuildingState): void {
    if (state.text1 !== undefined) { this.updateText1(state.text1); }
    if (state.text2 !== undefined) { this.updateText2(state.text2); }
    if (state.text3 !== undefined) { this.updateText3(state.text3); }
    if (state.ringCount !== undefined) { this.updateRingCount(state.ringCount); }
  }

  // ===========================================================================
  // STATUS & ACTIVITY
  // ===========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    // Update screen color palette
    if (isWarning) {
      this.screenColors = neonToPalette('#ffaa00');
    } else if (isCritical) {
      this.screenColors = neonToPalette('#ff4444');
    } else if (isOffline) {
      this.screenColors = neonToPalette('#444444');
    } else {
      this.screenColors = neonToPalette(this.baseNeonColor);
    }

    // Re-render text canvases with new palette
    this.updateAllTexts();

    // Neon edges
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        if (isCritical) {
          edge.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          edge.material.color.setHex(COLORS.glow.orange);
        } else {
          edge.material.color.set(this.baseNeonColor);
        }
      }
    });

    // Circuit lines
    this.circuitLines.forEach((line) => {
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.opacity = isOffline ? 0.1 : 0.6;
      }
    });

    // Ring meshes
    this.ringMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = isOffline ? 0.2 : 0.8;
        if (isCritical) {
          mesh.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          mesh.material.color.setHex(COLORS.glow.orange);
        } else {
          mesh.material.color.set(this.baseNeonColor);
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
    // Activity affects rotation and scroll speed via getActivitySpeed()
  }

  // ===========================================================================
  // ANIMATION
  // ===========================================================================

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') {
      return;
    }

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Rotate holographic rings
    this.rings.forEach((ring, i) => {
      if (ring.visible) {
        ring.rotation.y += deltaTime * 0.3 * speed * (i % 2 === 0 ? 1 : -1);
      }
    });

    // Scroll text
    for (let i = 0; i < 3; i++) {
      if (this.rings[i]?.visible) {
        this.textOffsets[i] += deltaTime * CONFIG.screen.scrollSpeed * speed;
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

    // Pulse circuit lines
    const circuitPulse = 0.4 + 0.3 * Math.sin(this.animTime * 2 + 1);
    this.circuitLines.forEach((line, i) => {
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.opacity = circuitPulse * (0.8 + 0.2 * Math.sin(this.animTime * 4 + i * 0.5));
      }
    });

    // Holographic flicker on rings
    this.ringMeshes.forEach((mesh, i) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial && this.rings[i]?.visible) {
        const flicker = 0.7 + 0.15 * Math.sin(this.animTime * 8 + i * 2) +
                        0.05 * Math.sin(this.animTime * 23 + i * 7);
        mesh.material.opacity = flicker;
      }
    });
  }
}
