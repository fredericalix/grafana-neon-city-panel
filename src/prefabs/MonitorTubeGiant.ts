import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState } from '../types';
import { BasePrefab } from './BasePrefab';
import {
  MONITOR_TUBE_COLORS,
  MONITOR_TUBE_PRESETS,
  createMonitorHologramMaterial,
  createHaloMaterial,
  createMonitorGridMaterial,
  createOuterShellMaterial,
  createCapMaterial,
} from './shaders/MonitorTubeShader';

// =============================================================================
// CONFIGURATION — all dimensions doubled from MonitorTube
// =============================================================================

const CONFIG = {
  baseSize: 12.0,
  baseHeight: 0.3,
  cylinder: {
    radius: 1.6,
    height: 11.2,
    segments: 48,
  },
  bands: {
    radius: 3.2,
    bandHeight: 0.5,
    minCount: 3,
    maxCount: 7,
    defaultCount: 5,
    radialSegments: 64,
  },
  halo: {
    radius: 4.4,
    tubeRadius: 0.3,
    segments: 64,
  },
  outerShell: {
    radius: 3.6,
    height: 9.6,
  },
  screen: {
    canvasWidth: 2048,
    canvasHeight: 128,
    scrollSpeed: 120,
    fontSize: 56,
  },
  animation: {
    baseRotationSpeed: 0.2,
    haloPulseSpeed: 1.5,
  },
};

// =============================================================================
// METRICS
// =============================================================================

interface GiantMetrics {
  bandCount: 3 | 4 | 5 | 6 | 7;
  messages: string[];
}

function createDefaultMetrics(count: number = CONFIG.bands.defaultCount): GiantMetrics {
  return {
    bandCount: Math.max(CONFIG.bands.minCount, Math.min(CONFIG.bands.maxCount, count)) as 3 | 4 | 5 | 6 | 7,
    messages: new Array(count).fill(''),
  };
}

// =============================================================================
// MONITOR TUBE GIANT PREFAB
// =============================================================================

/**
 * MonitorTubeGiant — 2x scale MonitorTube with opaque neon ticker bands.
 *
 * Each band is a flat CylinderGeometry (open-ended) wrapped around the central
 * tube, acting as an LED ticker screen. Text scrolls right-to-left once
 * (teleprinter style) then the band goes idle until the next data refresh.
 */
export class MonitorTubeGiantPrefab extends BasePrefab {
  private metrics: GiantMetrics = createDefaultMetrics();
  private animTime = 0;

  // Structure
  private basePlatform!: THREE.Mesh;
  private gridFloor!: THREE.Mesh;
  private gridFloorMaterial!: THREE.ShaderMaterial;
  private centralCylinder!: THREE.Mesh;
  private cylinderMaterial!: THREE.ShaderMaterial;
  private innerCore!: THREE.Mesh;
  private innerCoreMaterial!: THREE.MeshBasicMaterial;
  private topCap!: THREE.Mesh;
  private topCapMaterial!: THREE.ShaderMaterial;
  private bottomCap!: THREE.Mesh;
  private bottomCapMaterial!: THREE.ShaderMaterial;
  private haloMesh!: THREE.Mesh;
  private haloMaterial!: THREE.ShaderMaterial;
  private outerShell!: THREE.Mesh;
  private outerShellMaterial!: THREE.ShaderMaterial;
  private baseBorder!: THREE.Line;

  // Screen bands
  private bandGroup!: THREE.Group;
  private screenMeshes: THREE.Mesh[] = [];
  private screenCanvases: HTMLCanvasElement[] = [];
  private screenContexts: CanvasRenderingContext2D[] = [];
  private screenTextures: THREE.CanvasTexture[] = [];

  // Teleprinter state per band
  private textOffsets: number[] = [];
  private currentMessages: string[] = [];
  private messageFinished: boolean[] = [];
  private textWidths: number[] = [];

  // Screen color palette — changes with status
  private screenColors = {
    bg: '#000d0d',
    text: '#00ffff',
    glow: '#0088aa',
    highlight: '#66ffff',
    scanline: 'rgba(0,255,255,0.04)',
    gradientBase: 'rgba(0,255,255,',
  };

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createCentralCylinder();
    this.createScreenBands();
    this.createHalo();
    this.createOuterShell();
  }

  // ===========================================================================
  // COMPONENT CREATION
  // ===========================================================================

  private createBasePlatform(): void {
    const size = CONFIG.baseSize;

    const baseGeo = new THREE.CylinderGeometry(size / 2, size / 2, CONFIG.baseHeight, 6);
    const baseMat = new THREE.MeshStandardMaterial({
      color: MONITOR_TUBE_COLORS.darkMetal,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.basePlatform = new THREE.Mesh(baseGeo, baseMat);
    this.basePlatform.position.y = CONFIG.baseHeight / 2;
    this.basePlatform.receiveShadow = true;
    this.group.add(this.basePlatform);

    const gridGeo = new THREE.CircleGeometry(size / 2 * 0.9, 6);
    this.gridFloorMaterial = createMonitorGridMaterial();
    this.gridFloor = new THREE.Mesh(gridGeo, this.gridFloorMaterial);
    this.gridFloor.rotation.x = -Math.PI / 2;
    this.gridFloor.position.y = CONFIG.baseHeight + 0.01;
    this.group.add(this.gridFloor);

    this.createBaseBorder();
  }

  private createBaseBorder(): void {
    const radius = CONFIG.baseSize / 2;
    const borderMat = new THREE.LineBasicMaterial({
      color: MONITOR_TUBE_COLORS.cyan,
      transparent: true,
      opacity: 0.8,
    });

    const borderPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      borderPoints.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          CONFIG.baseHeight + 0.02,
          Math.sin(angle) * radius
        )
      );
    }

    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    this.baseBorder = new THREE.Line(borderGeo, borderMat);
    this.group.add(this.baseBorder);
  }

  private createCentralCylinder(): void {
    const { radius, height, segments } = CONFIG.cylinder;

    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
    this.cylinderMaterial = createMonitorHologramMaterial({ color: MONITOR_TUBE_COLORS.cyan });
    this.centralCylinder = new THREE.Mesh(cylinderGeo, this.cylinderMaterial);
    this.centralCylinder.position.y = CONFIG.baseHeight + height / 2;
    this.group.add(this.centralCylinder);

    const coreRadius = radius * 0.3;
    const coreGeo = new THREE.CylinderGeometry(coreRadius, coreRadius, height * 0.8, 16);
    this.innerCoreMaterial = new THREE.MeshBasicMaterial({
      color: MONITOR_TUBE_COLORS.cyan,
      transparent: true,
      opacity: 0.4,
    });
    this.innerCore = new THREE.Mesh(coreGeo, this.innerCoreMaterial);
    this.innerCore.position.y = CONFIG.baseHeight + height / 2;
    this.addGlowMesh(this.innerCore);
    this.group.add(this.innerCore);

    const topCapGeo = new THREE.CircleGeometry(radius * 1.2, segments);
    this.topCapMaterial = createCapMaterial();
    this.topCap = new THREE.Mesh(topCapGeo, this.topCapMaterial);
    this.topCap.rotation.x = -Math.PI / 2;
    this.topCap.position.y = CONFIG.baseHeight + height + 0.02;
    this.group.add(this.topCap);

    const bottomCapGeo = new THREE.CircleGeometry(radius * 1.2, segments);
    this.bottomCapMaterial = createCapMaterial();
    this.bottomCap = new THREE.Mesh(bottomCapGeo, this.bottomCapMaterial);
    this.bottomCap.rotation.x = Math.PI / 2;
    this.bottomCap.position.y = CONFIG.baseHeight + 0.02;
    this.group.add(this.bottomCap);
  }

  private createScreenBands(): void {
    this.bandGroup = new THREE.Group();
    this.bandGroup.position.y = CONFIG.baseHeight;
    this.group.add(this.bandGroup);

    this.rebuildBands(this.metrics.bandCount);
  }

  private rebuildBands(count: number): void {
    // Clear existing
    for (const mesh of this.screenMeshes) {
      this.bandGroup.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.dispose();
      }
    }
    for (const tex of this.screenTextures) {
      tex.dispose();
    }
    this.screenMeshes = [];
    this.screenCanvases = [];
    this.screenContexts = [];
    this.screenTextures = [];
    this.textOffsets = [];
    this.currentMessages = [];
    this.messageFinished = [];
    this.textWidths = [];

    const cylinderHeight = CONFIG.cylinder.height;
    const bandSpacing = cylinderHeight / (count + 1);

    for (let i = 0; i < count; i++) {
      const yPos = bandSpacing * (i + 1);

      // Canvas for screen content
      const canvas = document.createElement('canvas');
      canvas.width = CONFIG.screen.canvasWidth;
      canvas.height = CONFIG.screen.canvasHeight;
      const ctx = canvas.getContext('2d')!;
      this.screenCanvases.push(canvas);
      this.screenContexts.push(ctx);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.screenTextures.push(texture);

      // Flat band — open-ended cylinder wrapped around the central tube
      const bandGeo = new THREE.CylinderGeometry(
        CONFIG.bands.radius,
        CONFIG.bands.radius,
        CONFIG.bands.bandHeight,
        CONFIG.bands.radialSegments,
        1,
        true
      );
      const bandMat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
      const bandMesh = new THREE.Mesh(bandGeo, bandMat);
      bandMesh.position.y = yPos;
      this.screenMeshes.push(bandMesh);
      this.bandGroup.add(bandMesh);

      // Init ticker state
      this.textOffsets.push(CONFIG.screen.canvasWidth);
      this.currentMessages.push('');
      this.messageFinished.push(true);
      this.textWidths.push(0);

      // Render initial empty screen
      this.renderScreenBackground(i);
    }

    // Sync metrics array length
    while (this.metrics.messages.length < count) {
      this.metrics.messages.push('');
    }
    this.metrics.messages.length = count;
  }

  private createHalo(): void {
    const haloGeo = new THREE.TorusGeometry(
      CONFIG.halo.radius,
      CONFIG.halo.tubeRadius,
      16,
      CONFIG.halo.segments
    );
    this.haloMaterial = createHaloMaterial();
    this.haloMesh = new THREE.Mesh(haloGeo, this.haloMaterial);
    this.haloMesh.rotation.x = Math.PI / 2;
    this.haloMesh.position.y = CONFIG.baseHeight + 0.1;
    this.addGlowMesh(this.haloMesh);
    this.group.add(this.haloMesh);
  }

  private createOuterShell(): void {
    const shellGeo = new THREE.CylinderGeometry(
      CONFIG.outerShell.radius,
      CONFIG.outerShell.radius,
      CONFIG.outerShell.height,
      32,
      1,
      true
    );
    this.outerShellMaterial = createOuterShellMaterial();
    this.outerShell = new THREE.Mesh(shellGeo, this.outerShellMaterial);
    this.outerShell.position.y = CONFIG.baseHeight + CONFIG.outerShell.height / 2 + 0.2;
    this.group.add(this.outerShell);
  }

  // ===========================================================================
  // SCREEN RENDERING
  // ===========================================================================

  /** Render the neon CRT background (scanlines, dark glow) */
  private renderScreenBackground(index: number): void {
    if (index >= this.screenContexts.length) {
      return;
    }
    const ctx = this.screenContexts[index];
    const w = CONFIG.screen.canvasWidth;
    const h = CONFIG.screen.canvasHeight;

    // Dark tinted base
    ctx.fillStyle = this.screenColors.bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal luminosity gradient (brighter center)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this.screenColors.gradientBase + '0.03)');
    grad.addColorStop(0.5, this.screenColors.gradientBase + '0.07)');
    grad.addColorStop(1, this.screenColors.gradientBase + '0.03)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // CRT scanlines
    ctx.fillStyle = this.screenColors.scanline;
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    if (this.screenTextures[index]) {
      this.screenTextures[index].needsUpdate = true;
    }
  }

  /** Render background + teleprinter text at current offset */
  private renderTickerFrame(index: number): void {
    if (index >= this.screenContexts.length) {
      return;
    }

    // Repaint background first
    this.renderScreenBackground(index);

    const msg = this.currentMessages[index];
    if (!msg) {
      return;
    }

    const ctx = this.screenContexts[index];
    const h = CONFIG.screen.canvasHeight;
    const offset = this.textOffsets[index];

    ctx.save();
    ctx.font = `bold ${CONFIG.screen.fontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Glow layer
    ctx.shadowColor = this.screenColors.glow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.screenColors.text;
    ctx.fillText(msg, offset, h / 2);

    // Bright core
    ctx.shadowBlur = 4;
    ctx.fillStyle = this.screenColors.highlight;
    ctx.fillText(msg, offset, h / 2);

    ctx.restore();
  }

  // ===========================================================================
  // STATUS & ACTIVITY
  // ===========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    const presetName = status === 'offline' ? 'offline' :
                       status === 'critical' ? 'critical' :
                       status === 'warning' ? 'warning' : 'online';
    const preset = MONITOR_TUBE_PRESETS[presetName];

    // Update screen color palette based on status
    if (status === 'warning') {
      this.screenColors = {
        bg: '#0d0800', text: '#ffaa00', glow: '#cc6600',
        highlight: '#ffcc44', scanline: 'rgba(255,170,0,0.04)', gradientBase: 'rgba(255,170,0,',
      };
    } else if (status === 'critical') {
      this.screenColors = {
        bg: '#0d0004', text: '#ff4444', glow: '#cc2222',
        highlight: '#ff8888', scanline: 'rgba(255,68,68,0.04)', gradientBase: 'rgba(255,68,68,',
      };
    } else if (status === 'offline') {
      this.screenColors = {
        bg: '#080808', text: '#444444', glow: '#222222',
        highlight: '#666666', scanline: 'rgba(68,68,68,0.04)', gradientBase: 'rgba(68,68,68,',
      };
    } else {
      this.screenColors = {
        bg: '#000d0d', text: '#00ffff', glow: '#0088aa',
        highlight: '#66ffff', scanline: 'rgba(0,255,255,0.04)', gradientBase: 'rgba(0,255,255,',
      };
    }

    // Re-render all screen backgrounds with new palette
    for (let i = 0; i < this.screenContexts.length; i++) {
      if (this.messageFinished[i] || !this.currentMessages[i]) {
        this.renderScreenBackground(i);
      }
    }

    if (this.cylinderMaterial) {
      this.cylinderMaterial.uniforms.uOpacity.value = preset.hologramOpacity;
      this.cylinderMaterial.uniforms.uFlickerIntensity.value = preset.flickerIntensity;
      this.cylinderMaterial.uniforms.uActivityLevel.value = preset.activityLevel;
      if (this.cylinderMaterial.uniforms.uCrtDistortion) {
        this.cylinderMaterial.uniforms.uCrtDistortion.value = preset.crtDistortion;
      }
      if (this.cylinderMaterial.uniforms.uNoiseIntensity) {
        this.cylinderMaterial.uniforms.uNoiseIntensity.value = preset.noiseIntensity;
      }
      if (this.cylinderMaterial.uniforms.uChromaticAberration) {
        this.cylinderMaterial.uniforms.uChromaticAberration.value = preset.chromaticAberration;
      }
      const hologramColor = status === 'critical' ? MONITOR_TUBE_COLORS.red :
                            status === 'warning' ? MONITOR_TUBE_COLORS.orange :
                            status === 'offline' ? MONITOR_TUBE_COLORS.metalGray :
                            MONITOR_TUBE_COLORS.cyan;
      this.cylinderMaterial.uniforms.uColor.value = new THREE.Color(hologramColor);
    }

    if (this.innerCoreMaterial) {
      this.innerCoreMaterial.opacity = status === 'offline' ? 0.1 : 0.4;
      this.innerCoreMaterial.color.setHex(
        status === 'critical' ? MONITOR_TUBE_COLORS.red :
        status === 'warning' ? MONITOR_TUBE_COLORS.orange :
        MONITOR_TUBE_COLORS.cyan
      );
    }

    if (this.haloMaterial) {
      this.haloMaterial.uniforms.uIntensity.value = preset.haloIntensity;
      this.haloMaterial.uniforms.uActivityLevel.value = preset.activityLevel;
    }

    if (this.gridFloorMaterial) {
      const gridColor = status === 'critical' ? MONITOR_TUBE_COLORS.red :
                        status === 'warning' ? MONITOR_TUBE_COLORS.orange :
                        MONITOR_TUBE_COLORS.cyan;
      this.gridFloorMaterial.uniforms.uGridColor.value = new THREE.Color(gridColor);
    }

    if (this.outerShellMaterial) {
      this.outerShellMaterial.uniforms.uOpacity.value = status === 'offline' ? 0.05 : 0.15;
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    const speedMultiplier = this.getActivitySpeed();

    if (this.gridFloorMaterial) {
      this.gridFloorMaterial.uniforms.uPulseSpeed.value = 0.5 * speedMultiplier;
    }
    if (this.cylinderMaterial) {
      this.cylinderMaterial.uniforms.uScanlineSpeed.value = 5.0 * speedMultiplier;
    }
    if (this.haloMaterial) {
      this.haloMaterial.uniforms.uPulseSpeed.value = CONFIG.animation.haloPulseSpeed * speedMultiplier;
    }
  }

  // ===========================================================================
  // DATA UPDATE
  // ===========================================================================

  override updateData(state: BuildingState): void {
    // Band count from monitorBands (or default)
    if (state.monitorBands && state.monitorBands.length > 0) {
      const count = Math.max(CONFIG.bands.minCount, Math.min(CONFIG.bands.maxCount, state.monitorBands.length));

      if (count !== this.metrics.bandCount) {
        this.metrics.bandCount = count as 3 | 4 | 5 | 6 | 7;
        this.rebuildBands(count);
        this.onStatusChange(this.status);
        this.onActivityChange(this.activity);
      }
    }

    // Update scrolling messages from monitorMessages
    if (state.monitorMessages) {
      for (let i = 0; i < this.currentMessages.length; i++) {
        const newMsg = i < state.monitorMessages.length ? state.monitorMessages[i] : '';
        if (newMsg && newMsg !== this.currentMessages[i]) {
          // New message — start teleprinter from the right edge
          this.currentMessages[i] = newMsg;
          this.textOffsets[i] = CONFIG.screen.canvasWidth;
          this.messageFinished[i] = false;
          // Measure text width
          if (this.screenContexts[i]) {
            this.screenContexts[i].font = `bold ${CONFIG.screen.fontSize}px monospace`;
            this.textWidths[i] = this.screenContexts[i].measureText(newMsg).width;
          }
        } else if (!newMsg && this.currentMessages[i]) {
          // Message cleared
          this.currentMessages[i] = '';
          this.messageFinished[i] = true;
          this.renderScreenBackground(i);
        }
      }
    }
  }

  // ===========================================================================
  // ANIMATION
  // ===========================================================================

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    this.animateBandRotation(deltaTime);
    this.updateTeleprinter(deltaTime);
    this.updateShaderUniforms();
  }

  private animateBandRotation(deltaTime: number): void {
    const speedMultiplier = this.getActivitySpeed();
    const rotationSpeed = CONFIG.animation.baseRotationSpeed * speedMultiplier;

    this.bandGroup.rotation.y += rotationSpeed * deltaTime;

    for (let i = 0; i < this.screenMeshes.length; i++) {
      const wobble = Math.sin(this.animTime * 2 + i * 0.7) * 0.02;
      this.screenMeshes[i].rotation.z = wobble;
    }
  }

  private updateTeleprinter(deltaTime: number): void {
    if (this.status === 'offline') {
      return;
    }

    const speed = this.getActivitySpeed();

    for (let i = 0; i < this.screenMeshes.length; i++) {
      if (this.messageFinished[i] || !this.currentMessages[i]) {
        continue;
      }

      // Advance text position (scrolling left)
      this.textOffsets[i] -= deltaTime * CONFIG.screen.scrollSpeed * speed;

      // Check if the entire text has scrolled off the left edge
      if (this.textOffsets[i] + this.textWidths[i] < 0) {
        this.messageFinished[i] = true;
        this.renderScreenBackground(i);
      } else {
        this.renderTickerFrame(i);
      }
    }
  }

  private updateShaderUniforms(): void {
    if (this.gridFloorMaterial) {
      this.gridFloorMaterial.uniforms.uTime.value = this.animTime;
    }
    if (this.cylinderMaterial) {
      this.cylinderMaterial.uniforms.uTime.value = this.animTime;
    }
    if (this.topCapMaterial) {
      this.topCapMaterial.uniforms.uTime.value = this.animTime;
    }
    if (this.bottomCapMaterial) {
      this.bottomCapMaterial.uniforms.uTime.value = this.animTime;
    }
    if (this.haloMaterial) {
      this.haloMaterial.uniforms.uTime.value = this.animTime;
    }
    if (this.outerShellMaterial) {
      this.outerShellMaterial.uniforms.uTime.value = this.animTime;
    }
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  override dispose(): void {
    this.gridFloorMaterial?.dispose();
    this.cylinderMaterial?.dispose();
    this.topCapMaterial?.dispose();
    this.bottomCapMaterial?.dispose();
    this.haloMaterial?.dispose();
    this.outerShellMaterial?.dispose();
    this.innerCoreMaterial?.dispose();

    for (const tex of this.screenTextures) {
      tex.dispose();
    }
    for (const mesh of this.screenMeshes) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.dispose();
      }
    }

    super.dispose();
  }
}
