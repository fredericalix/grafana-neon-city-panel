import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState } from '../types';
import { BasePrefab } from './BasePrefab';
import {
  MONITOR_TUBE_COLORS,
  MONITOR_TUBE_PRESETS,
  createRingBandMaterial,
  createMonitorHologramMaterial,
  createHaloMaterial,
  createMonitorGridMaterial,
  createOuterShellMaterial,
  createCapMaterial,
} from './shaders/MonitorTubeShader';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  baseSize: 6.0,
  baseHeight: 0.15,
  cylinder: {
    radius: 0.8,
    height: 5.6,
    segments: 32,
  },
  bands: {
    innerRadius: 0.7,
    outerRadius: 1.6,
    thickness: 0.1,
    minCount: 3,
    maxCount: 7,
    defaultCount: 5,
    segments: 64,
  },
  halo: {
    radius: 2.2,
    tubeRadius: 0.15,
    segments: 48,
  },
  outerShell: {
    radius: 1.8,
    height: 4.8,
  },
  animation: {
    baseRotationSpeed: 0.3,
    fastMultiplier: 3.0,
    gaugeInterpolationSpeed: 2.0,
    haloPulseSpeed: 1.5,
  },
  radiusScale: {
    min: 0.5,  // scale at value 0
    max: 1.5,  // scale at value 100
  },
};

// =============================================================================
// METRICS INTERFACES
// =============================================================================

export interface BandData {
  name: string;
  value: number;
  color?: number;
  radius: number; // 0-100, maps to scale min..max
}

export interface MonitorTubeMetrics {
  bandCount: 3 | 4 | 5 | 6 | 7;
  bands: BandData[];
}

// =============================================================================
// DEFAULT METRICS
// =============================================================================

function createDefaultMetrics(count: number = CONFIG.bands.defaultCount): MonitorTubeMetrics {
  const bands: BandData[] = [];
  for (let i = 0; i < count; i++) {
    bands.push({
      name: `Band ${i + 1}`,
      value: 50,
      radius: 50,
    });
  }
  return {
    bandCount: Math.max(CONFIG.bands.minCount, Math.min(CONFIG.bands.maxCount, count)) as 3 | 4 | 5 | 6 | 7,
    bands,
  };
}

// =============================================================================
// MONITOR TUBE PREFAB
// =============================================================================

/**
 * Monitor Tube Prefab - Cylindrical structure with 3-7 horizontal ring bands
 *
 * Features:
 * - Central holographic cylinder with scanlines and flicker
 * - 3-7 horizontal ring bands displaying gauge values (0-100%)
 * - Rotating band group with activity-based speed
 * - Base halo ring with pulsing glow
 * - Outer shell with circuit pattern
 * - Grid floor with pulse waves
 */
export class MonitorTubePrefab extends BasePrefab {
  private targetMetrics: MonitorTubeMetrics = createDefaultMetrics();
  private currentMetrics: MonitorTubeMetrics = createDefaultMetrics();

  private animTime = 0;

  // Structure components
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

  private bandGroup!: THREE.Group;
  private bandMeshes: THREE.Mesh[] = [];
  private bandMaterials: THREE.ShaderMaterial[] = [];

  private haloMesh!: THREE.Mesh;
  private haloMaterial!: THREE.ShaderMaterial;

  private outerShell!: THREE.Mesh;
  private outerShellMaterial!: THREE.ShaderMaterial;

  private baseBorder!: THREE.Line;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createCentralCylinder();
    this.createRingBands();
    this.createHalo();
    this.createOuterShell();
  }

  // ===========================================================================
  // COMPONENT CREATION
  // ===========================================================================

  private createBasePlatform(): void {
    const size = CONFIG.baseSize;

    // Hexagonal base platform
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

    // Animated grid floor overlay
    const gridGeo = new THREE.CircleGeometry(size / 2 * 0.9, 6);
    this.gridFloorMaterial = createMonitorGridMaterial();
    this.gridFloor = new THREE.Mesh(gridGeo, this.gridFloorMaterial);
    this.gridFloor.rotation.x = -Math.PI / 2;
    this.gridFloor.position.y = CONFIG.baseHeight + 0.01;
    this.group.add(this.gridFloor);

    // Neon edge ring around base
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

    // Open cylinder for holographic effect
    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
    this.cylinderMaterial = createMonitorHologramMaterial();
    this.centralCylinder = new THREE.Mesh(cylinderGeo, this.cylinderMaterial);
    this.centralCylinder.position.y = CONFIG.baseHeight + height / 2;
    this.group.add(this.centralCylinder);

    // Inner glowing core
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

    // Top cap
    const topCapGeo = new THREE.CircleGeometry(radius * 1.2, segments);
    this.topCapMaterial = createCapMaterial();
    this.topCap = new THREE.Mesh(topCapGeo, this.topCapMaterial);
    this.topCap.rotation.x = -Math.PI / 2;
    this.topCap.position.y = CONFIG.baseHeight + height + 0.02;
    this.group.add(this.topCap);

    // Bottom cap
    const bottomCapGeo = new THREE.CircleGeometry(radius * 1.2, segments);
    this.bottomCapMaterial = createCapMaterial();
    this.bottomCap = new THREE.Mesh(bottomCapGeo, this.bottomCapMaterial);
    this.bottomCap.rotation.x = Math.PI / 2;
    this.bottomCap.position.y = CONFIG.baseHeight + 0.02;
    this.group.add(this.bottomCap);
  }

  private createRingBands(): void {
    this.bandGroup = new THREE.Group();
    this.bandGroup.position.y = CONFIG.baseHeight;
    this.group.add(this.bandGroup);

    this.rebuildBands(this.currentMetrics.bandCount);
  }

  private rebuildBands(count: number): void {
    // Clear existing
    for (const mesh of this.bandMeshes) {
      this.bandGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of this.bandMaterials) {
      mat.dispose();
    }
    this.bandMeshes = [];
    this.bandMaterials = [];

    const cylinderHeight = CONFIG.cylinder.height;
    const bandSpacing = cylinderHeight / (count + 1);

    for (let i = 0; i < count; i++) {
      const torusGeo = new THREE.TorusGeometry(
        CONFIG.bands.outerRadius,
        CONFIG.bands.thickness,
        16,
        CONFIG.bands.segments
      );

      const bandMat = createRingBandMaterial();
      bandMat.uniforms.uRotationOffset.value = i * 0.15;

      // Alternate colors
      if (i % 2 === 1) {
        bandMat.uniforms.uColorLow.value = new THREE.Color(MONITOR_TUBE_COLORS.magenta);
        bandMat.uniforms.uColorMid.value = new THREE.Color(MONITOR_TUBE_COLORS.orange);
      }

      const bandMesh = new THREE.Mesh(torusGeo, bandMat);
      bandMesh.rotation.x = Math.PI / 2;
      bandMesh.position.y = bandSpacing * (i + 1);

      this.bandMeshes.push(bandMesh);
      this.bandMaterials.push(bandMat);
      this.bandGroup.add(bandMesh);
    }

    // Ensure metrics arrays match
    while (this.currentMetrics.bands.length < count) {
      this.currentMetrics.bands.push({ name: `Band ${this.currentMetrics.bands.length + 1}`, value: 50, radius: 50 });
    }
    while (this.targetMetrics.bands.length < count) {
      this.targetMetrics.bands.push({ name: `Band ${this.targetMetrics.bands.length + 1}`, value: 50, radius: 50 });
    }
    this.currentMetrics.bands.length = count;
    this.targetMetrics.bands.length = count;
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
  // STATUS & ACTIVITY HANDLERS
  // ===========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    const presetName = status === 'offline' ? 'offline' :
                       status === 'critical' ? 'critical' :
                       status === 'warning' ? 'warning' : 'online';
    const preset = MONITOR_TUBE_PRESETS[presetName];

    // Update hologram
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
                            status === 'offline' ? MONITOR_TUBE_COLORS.metalGray :
                            MONITOR_TUBE_COLORS.orange;
      this.cylinderMaterial.uniforms.uColor.value = new THREE.Color(hologramColor);
    }

    // Update inner core
    if (this.innerCoreMaterial) {
      const coreOpacity = status === 'offline' ? 0.1 : 0.4;
      const coreColor = status === 'critical' ? MONITOR_TUBE_COLORS.red : MONITOR_TUBE_COLORS.orange;
      this.innerCoreMaterial.opacity = coreOpacity;
      this.innerCoreMaterial.color.setHex(coreColor);
    }

    // Update halo
    if (this.haloMaterial) {
      this.haloMaterial.uniforms.uIntensity.value = preset.haloIntensity;
      this.haloMaterial.uniforms.uActivityLevel.value = preset.activityLevel;
    }

    // Update ring bands
    for (const mat of this.bandMaterials) {
      mat.uniforms.uGlowStrength.value = preset.glowStrength;
      mat.uniforms.uScanlineIntensity.value = preset.scanlineIntensity;
    }

    // Update grid floor color
    if (this.gridFloorMaterial) {
      const gridColor = status === 'critical' ? MONITOR_TUBE_COLORS.red :
                        status === 'warning' ? MONITOR_TUBE_COLORS.orange :
                        MONITOR_TUBE_COLORS.cyan;
      this.gridFloorMaterial.uniforms.uGridColor.value = new THREE.Color(gridColor);
    }

    // Update outer shell
    if (this.outerShellMaterial) {
      const shellOpacity = status === 'offline' ? 0.05 : 0.15;
      this.outerShellMaterial.uniforms.uOpacity.value = shellOpacity;
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
  // ANIMATION UPDATE
  // ===========================================================================

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    this.interpolateMetrics(deltaTime);
    this.animateBandRotation(deltaTime);
    this.updateGaugeFills();
    this.updateBandRadii();
    this.updateHalo();
    this.updateShaderUniforms();
  }

  private interpolateMetrics(deltaTime: number): void {
    const lerpSpeed = CONFIG.animation.gaugeInterpolationSpeed;
    const t = Math.min(1, lerpSpeed * deltaTime);

    for (let i = 0; i < this.currentMetrics.bands.length; i++) {
      if (i < this.targetMetrics.bands.length) {
        this.currentMetrics.bands[i].value +=
          (this.targetMetrics.bands[i].value - this.currentMetrics.bands[i].value) * t;
        this.currentMetrics.bands[i].radius +=
          (this.targetMetrics.bands[i].radius - this.currentMetrics.bands[i].radius) * t;
      }
    }
  }

  private animateBandRotation(deltaTime: number): void {
    const speedMultiplier = this.getActivitySpeed();
    const rotationSpeed = CONFIG.animation.baseRotationSpeed * speedMultiplier;

    this.bandGroup.rotation.y += rotationSpeed * deltaTime;

    for (let i = 0; i < this.bandMeshes.length; i++) {
      const wobble = Math.sin(this.animTime * 2 + i * 0.7) * 0.02;
      this.bandMeshes[i].rotation.z = wobble;
    }
  }

  private updateGaugeFills(): void {
    for (let i = 0; i < this.bandMaterials.length; i++) {
      const mat = this.bandMaterials[i];
      if (i < this.currentMetrics.bands.length) {
        mat.uniforms.uValue.value = this.currentMetrics.bands[i].value;

        const bandData = this.currentMetrics.bands[i];
        if (bandData.color !== undefined) {
          mat.uniforms.uColorLow.value = new THREE.Color(bandData.color);
        }
      }
    }
  }

  private updateBandRadii(): void {
    const { min, max } = CONFIG.radiusScale;
    for (let i = 0; i < this.bandMeshes.length; i++) {
      if (i < this.currentMetrics.bands.length) {
        const normalized = this.currentMetrics.bands[i].radius / 100;
        const scale = min + normalized * (max - min);
        this.bandMeshes[i].scale.set(scale, scale, 1);
      }
    }
  }

  override updateData(state: BuildingState): void {
    if (!state.monitorBands || state.monitorBands.length === 0) {
      return;
    }

    const count = Math.max(CONFIG.bands.minCount, Math.min(CONFIG.bands.maxCount, state.monitorBands.length));

    // Rebuild bands if count changed
    if (count !== this.currentMetrics.bandCount) {
      this.currentMetrics.bandCount = count as 3 | 4 | 5 | 6 | 7;
      this.targetMetrics.bandCount = count as 3 | 4 | 5 | 6 | 7;
      this.rebuildBands(count);
      // Re-apply current status/activity presets to new band materials
      this.onStatusChange(this.status);
      this.onActivityChange(this.activity);
    }

    // Update target values and radii from data
    for (let i = 0; i < count; i++) {
      if (i < state.monitorBands.length) {
        const band = state.monitorBands[i];
        this.targetMetrics.bands[i].value = band.value;
        this.targetMetrics.bands[i].radius = band.value;
        if (band.label) {
          this.targetMetrics.bands[i].name = band.label;
        }
      }
    }
  }

  private updateHalo(): void {
    if (!this.haloMaterial) return;

    let avgValue = 0;
    if (this.currentMetrics.bands.length > 0) {
      avgValue = this.currentMetrics.bands.reduce((sum, b) => sum + b.value, 0) /
                 this.currentMetrics.bands.length;
    }

    const activityLevel = avgValue / 100;
    this.haloMaterial.uniforms.uActivityLevel.value = activityLevel;
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
    for (const mat of this.bandMaterials) {
      mat.uniforms.uTime.value = this.animTime;
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

    for (const mat of this.bandMaterials) {
      mat.dispose();
    }
    for (const mesh of this.bandMeshes) {
      mesh.geometry.dispose();
    }

    super.dispose();
  }
}
