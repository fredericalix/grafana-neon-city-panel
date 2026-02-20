import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
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
} from './MonitorTubeShader';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  baseSize: 6.0, // Visual size (larger than 3x3 footprint for aesthetics)
  baseHeight: 0.15,
  cylinder: {
    radius: 0.8,      // Slightly wider
    height: 5.6,      // Twice as tall
    segments: 32,
  },
  bands: {
    innerRadius: 0.7,
    outerRadius: 1.6,
    thickness: 0.1, // Torus tube radius
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
    height: 4.8,      // Scaled with cylinder height
  },
  animation: {
    baseRotationSpeed: 0.3, // rad/s at normal activity
    fastMultiplier: 3.0,
    gaugeInterpolationSpeed: 2.0,
    haloPulseSpeed: 1.5,
  },
};

// =============================================================================
// METRICS INTERFACES
// =============================================================================

export interface BandData {
  name: string;
  value: number; // 0-100
  color?: number; // optional override
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
 * A 3x3 grid building featuring:
 * - Central holographic cylinder with scanlines and flicker
 * - 3-7 horizontal ring bands displaying gauge values (0-100%)
 * - Rotating band group with activity-based speed
 * - Base halo ring with pulsing glow
 * - Optional outer shell with circuit pattern
 * - Grid floor with pulse waves
 *
 * Inspired by Tron Legacy, cyberpunk dashboards, and holographic displays
 */
export class MonitorTubePrefab extends BasePrefab {
  // Metrics state
  private targetMetrics: MonitorTubeMetrics = createDefaultMetrics();
  private currentMetrics: MonitorTubeMetrics = createDefaultMetrics();

  // Animation time
  private animTime = 0;

  // ============= STRUCTURE COMPONENTS =============
  private basePlatform!: THREE.Mesh;
  private gridFloor!: THREE.Mesh;
  private gridFloorMaterial!: THREE.ShaderMaterial;

  // Central cylinder
  private centralCylinder!: THREE.Mesh;
  private cylinderMaterial!: THREE.ShaderMaterial;
  private innerCore!: THREE.Mesh;
  private innerCoreMaterial!: THREE.MeshBasicMaterial;
  private topCap!: THREE.Mesh;
  private topCapMaterial!: THREE.ShaderMaterial;
  private bottomCap!: THREE.Mesh;
  private bottomCapMaterial!: THREE.ShaderMaterial;

  // Ring bands
  private bandGroup!: THREE.Group;
  private bandMeshes: THREE.Mesh[] = [];
  private bandMaterials: THREE.ShaderMaterial[] = [];

  // Halo
  private haloMesh!: THREE.Mesh;
  private haloMaterial!: THREE.ShaderMaterial;

  // Outer shell
  private outerShell!: THREE.Mesh;
  private outerShellMaterial!: THREE.ShaderMaterial;

  // Neon border
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

  /**
   * Create the hexagonal base platform with animated grid
   */
  private createBasePlatform(): void {
    const size = CONFIG.baseSize;

    // Hexagonal base platform (6 segments = hexagon)
    const baseGeo = new THREE.CylinderGeometry(
      size / 2,
      size / 2,
      CONFIG.baseHeight,
      6
    );
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

  /**
   * Create neon border around the hexagonal base
   */
  private createBaseBorder(): void {
    const radius = CONFIG.baseSize / 2;
    const borderMat = new THREE.LineBasicMaterial({
      color: MONITOR_TUBE_COLORS.cyan,
      transparent: true,
      opacity: 0.8,
    });

    // Hexagonal border points
    const borderPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6; // Offset to align with hex
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

  /**
   * Create the central holographic cylinder
   */
  private createCentralCylinder(): void {
    const { radius, height, segments } = CONFIG.cylinder;

    // Open cylinder (no top/bottom caps) for holographic effect
    const cylinderGeo = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      true // Open-ended
    );
    this.cylinderMaterial = createMonitorHologramMaterial();
    this.centralCylinder = new THREE.Mesh(cylinderGeo, this.cylinderMaterial);
    this.centralCylinder.position.y = CONFIG.baseHeight + height / 2;
    this.group.add(this.centralCylinder);

    // Inner glowing core (smaller, solid)
    const coreRadius = radius * 0.3;
    const coreGeo = new THREE.CylinderGeometry(
      coreRadius,
      coreRadius,
      height * 0.8,
      16
    );
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

    // Bottom cap (on pedestal)
    const bottomCapGeo = new THREE.CircleGeometry(radius * 1.2, segments);
    this.bottomCapMaterial = createCapMaterial();
    this.bottomCap = new THREE.Mesh(bottomCapGeo, this.bottomCapMaterial);
    this.bottomCap.rotation.x = Math.PI / 2;
    this.bottomCap.position.y = CONFIG.baseHeight + 0.02;
    this.group.add(this.bottomCap);
  }

  /**
   * Create the ring bands group
   */
  private createRingBands(): void {
    this.bandGroup = new THREE.Group();
    this.bandGroup.position.y = CONFIG.baseHeight;
    this.group.add(this.bandGroup);

    this.rebuildBands(this.currentMetrics.bandCount);
  }

  /**
   * Rebuild bands with a new count
   */
  private rebuildBands(count: number): void {
    // Clear existing band meshes and materials
    for (const mesh of this.bandMeshes) {
      this.bandGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of this.bandMaterials) {
      mat.dispose();
    }
    this.bandMeshes = [];
    this.bandMaterials = [];

    // Calculate vertical positions to evenly distribute bands within cylinder height
    const cylinderHeight = CONFIG.cylinder.height;
    const bandSpacing = cylinderHeight / (count + 1);

    for (let i = 0; i < count; i++) {
      // Create torus geometry for horizontal ring
      const torusGeo = new THREE.TorusGeometry(
        CONFIG.bands.outerRadius,
        CONFIG.bands.thickness,
        16,
        CONFIG.bands.segments
      );

      // Create material with unique rotation offset for visual variety
      const bandMat = createRingBandMaterial();
      bandMat.uniforms.uRotationOffset.value = i * 0.15;

      // Alternate colors for visual interest
      if (i % 2 === 1) {
        bandMat.uniforms.uColorLow.value = new THREE.Color(MONITOR_TUBE_COLORS.magenta);
        bandMat.uniforms.uColorMid.value = new THREE.Color(MONITOR_TUBE_COLORS.orange);
      }

      const bandMesh = new THREE.Mesh(torusGeo, bandMat);

      // Rotate to horizontal (torus is vertical by default)
      bandMesh.rotation.x = Math.PI / 2;

      // Position at calculated Y within cylinder
      bandMesh.position.y = bandSpacing * (i + 1);

      this.bandMeshes.push(bandMesh);
      this.bandMaterials.push(bandMat);
      this.bandGroup.add(bandMesh);
    }

    // Ensure metrics arrays match band count
    while (this.currentMetrics.bands.length < count) {
      this.currentMetrics.bands.push({
        name: `Band ${this.currentMetrics.bands.length + 1}`,
        value: 50,
      });
    }
    while (this.targetMetrics.bands.length < count) {
      this.targetMetrics.bands.push({
        name: `Band ${this.targetMetrics.bands.length + 1}`,
        value: 50,
      });
    }
    // Trim if count reduced
    this.currentMetrics.bands.length = count;
    this.targetMetrics.bands.length = count;
  }

  /**
   * Create the base halo ring
   */
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

  /**
   * Create the outer shell with circuit pattern
   */
  private createOuterShell(): void {
    const shellGeo = new THREE.CylinderGeometry(
      CONFIG.outerShell.radius,
      CONFIG.outerShell.radius,
      CONFIG.outerShell.height,
      32,
      1,
      true // Open-ended
    );
    this.outerShellMaterial = createOuterShellMaterial();
    this.outerShell = new THREE.Mesh(shellGeo, this.outerShellMaterial);
    this.outerShell.position.y = CONFIG.baseHeight + CONFIG.outerShell.height / 2 + 0.2;
    this.group.add(this.outerShell);
  }

  // ===========================================================================
  // PUBLIC API - METRICS UPDATES
  // ===========================================================================

  /**
   * Update all metrics at once
   */
  updateMetrics(metrics: Partial<MonitorTubeMetrics>): void {
    if (metrics.bandCount !== undefined && metrics.bandCount !== this.currentMetrics.bandCount) {
      this.setBandCount(metrics.bandCount);
    }
    if (metrics.bands !== undefined) {
      for (let i = 0; i < metrics.bands.length && i < this.targetMetrics.bands.length; i++) {
        Object.assign(this.targetMetrics.bands[i], metrics.bands[i]);
      }
    }
  }

  /**
   * Update a single band's target values
   */
  updateBand(index: number, data: Partial<BandData>): void {
    if (index >= 0 && index < this.targetMetrics.bands.length) {
      if (data.name !== undefined) {
        this.targetMetrics.bands[index].name = data.name;
      }
      if (data.value !== undefined) {
        this.targetMetrics.bands[index].value = Math.max(0, Math.min(100, data.value));
      }
      if (data.color !== undefined) {
        this.targetMetrics.bands[index].color = data.color;
      }
    }
  }

  /**
   * Set the band count (3-7)
   */
  setBandCount(count: number): void {
    const clampedCount = Math.max(CONFIG.bands.minCount, Math.min(CONFIG.bands.maxCount, count)) as 3 | 4 | 5 | 6 | 7;

    if (clampedCount !== this.currentMetrics.bandCount) {
      // Update band count
      this.currentMetrics.bandCount = clampedCount;
      this.targetMetrics.bandCount = clampedCount;

      // Adjust bands array - add new bands or remove excess
      while (this.targetMetrics.bands.length < clampedCount) {
        const newIndex = this.targetMetrics.bands.length;
        this.targetMetrics.bands.push({
          name: `Band ${newIndex + 1}`,
          value: 50,
        });
        this.currentMetrics.bands.push({
          name: `Band ${newIndex + 1}`,
          value: 50,
        });
      }
      // Trim if we have too many
      this.targetMetrics.bands.length = clampedCount;
      this.currentMetrics.bands.length = clampedCount;

      // Rebuild visual meshes
      this.rebuildBands(clampedCount);
    }
  }

  /**
   * Get current band count
   */
  getBandCount(): number {
    return this.currentMetrics.bandCount;
  }

  /**
   * Get all band values
   */
  getBandValues(): number[] {
    return this.currentMetrics.bands.map((b) => b.value);
  }

  // ===========================================================================
  // STATUS & ACTIVITY HANDLERS
  // ===========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    // Get preset based on status
    const presetName = status === 'offline' ? 'offline' :
                       status === 'critical' ? 'critical' :
                       status === 'warning' ? 'warning' : 'online';
    const preset = MONITOR_TUBE_PRESETS[presetName];

    // Update hologram
    if (this.cylinderMaterial) {
      this.cylinderMaterial.uniforms.uOpacity.value = preset.hologramOpacity;
      this.cylinderMaterial.uniforms.uFlickerIntensity.value = preset.flickerIntensity;
      this.cylinderMaterial.uniforms.uActivityLevel.value = preset.activityLevel;

      // Apply CRT distortion effects
      if (this.cylinderMaterial.uniforms.uCrtDistortion) {
        this.cylinderMaterial.uniforms.uCrtDistortion.value = preset.crtDistortion;
      }
      if (this.cylinderMaterial.uniforms.uNoiseIntensity) {
        this.cylinderMaterial.uniforms.uNoiseIntensity.value = preset.noiseIntensity;
      }
      if (this.cylinderMaterial.uniforms.uChromaticAberration) {
        this.cylinderMaterial.uniforms.uChromaticAberration.value = preset.chromaticAberration;
      }

      // Color change based on status
      // Normal (online) = orange, Warning = orange (with CRT distortion)
      // Critical = red, Offline = gray
      const hologramColor = status === 'critical' ? MONITOR_TUBE_COLORS.red :
                            status === 'offline' ? MONITOR_TUBE_COLORS.metalGray :
                            MONITOR_TUBE_COLORS.orange; // Orange for both online and warning
      this.cylinderMaterial.uniforms.uColor.value = new THREE.Color(hologramColor);
    }

    // Update inner core
    if (this.innerCoreMaterial) {
      const coreOpacity = status === 'offline' ? 0.1 : 0.4;
      const coreColor = status === 'critical' ? MONITOR_TUBE_COLORS.red :
                        MONITOR_TUBE_COLORS.orange; // Orange for normal/warning
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

    // Update grid floor pulse speed
    if (this.gridFloorMaterial) {
      this.gridFloorMaterial.uniforms.uPulseSpeed.value = 0.5 * speedMultiplier;
    }

    // Update hologram scanline speed
    if (this.cylinderMaterial) {
      this.cylinderMaterial.uniforms.uScanlineSpeed.value = 5.0 * speedMultiplier;
    }

    // Update halo pulse speed
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

    // Interpolate metrics toward targets
    this.interpolateMetrics(deltaTime);

    // Animate band rotation
    this.animateBandRotation(deltaTime);

    // Update gauge fills
    this.updateGaugeFills();

    // Update halo
    this.updateHalo();

    // Update shader uniforms
    this.updateShaderUniforms();
  }

  /**
   * Smoothly interpolate current metrics toward target values
   */
  private interpolateMetrics(deltaTime: number): void {
    const lerpSpeed = CONFIG.animation.gaugeInterpolationSpeed;
    const t = Math.min(1, lerpSpeed * deltaTime);

    for (let i = 0; i < this.currentMetrics.bands.length; i++) {
      if (i < this.targetMetrics.bands.length) {
        this.currentMetrics.bands[i].value +=
          (this.targetMetrics.bands[i].value - this.currentMetrics.bands[i].value) * t;
      }
    }
  }

  /**
   * Animate band group rotation based on activity
   */
  private animateBandRotation(deltaTime: number): void {
    const speedMultiplier = this.getActivitySpeed();
    const rotationSpeed = CONFIG.animation.baseRotationSpeed * speedMultiplier;

    // Rotate the entire band group
    this.bandGroup.rotation.y += rotationSpeed * deltaTime;

    // Optionally add alternating slight wobble to individual bands for depth
    for (let i = 0; i < this.bandMeshes.length; i++) {
      const wobble = Math.sin(this.animTime * 2 + i * 0.7) * 0.02;
      this.bandMeshes[i].rotation.z = wobble;
    }
  }

  /**
   * Update each band material's uValue uniform
   */
  private updateGaugeFills(): void {
    for (let i = 0; i < this.bandMaterials.length; i++) {
      const mat = this.bandMaterials[i];
      if (i < this.currentMetrics.bands.length) {
        mat.uniforms.uValue.value = this.currentMetrics.bands[i].value;

        // Apply custom color override if specified
        const bandData = this.currentMetrics.bands[i];
        if (bandData.color !== undefined) {
          mat.uniforms.uColorLow.value = new THREE.Color(bandData.color);
        }
      }
    }
  }

  /**
   * Update halo based on average band values
   */
  private updateHalo(): void {
    if (!this.haloMaterial) return;

    // Calculate average value across all bands
    let avgValue = 0;
    if (this.currentMetrics.bands.length > 0) {
      avgValue = this.currentMetrics.bands.reduce((sum, b) => sum + b.value, 0) /
                 this.currentMetrics.bands.length;
    }

    // Map average to activity level (0-1)
    const activityLevel = avgValue / 100;
    this.haloMaterial.uniforms.uActivityLevel.value = activityLevel;
  }

  /**
   * Update uTime on all shader materials
   */
  private updateShaderUniforms(): void {
    // Grid floor
    if (this.gridFloorMaterial) {
      this.gridFloorMaterial.uniforms.uTime.value = this.animTime;
    }

    // Central cylinder hologram
    if (this.cylinderMaterial) {
      this.cylinderMaterial.uniforms.uTime.value = this.animTime;
    }

    // Caps
    if (this.topCapMaterial) {
      this.topCapMaterial.uniforms.uTime.value = this.animTime;
    }
    if (this.bottomCapMaterial) {
      this.bottomCapMaterial.uniforms.uTime.value = this.animTime;
    }

    // Halo
    if (this.haloMaterial) {
      this.haloMaterial.uniforms.uTime.value = this.animTime;
    }

    // Outer shell
    if (this.outerShellMaterial) {
      this.outerShellMaterial.uniforms.uTime.value = this.animTime;
    }

    // Ring bands
    for (const mat of this.bandMaterials) {
      mat.uniforms.uTime.value = this.animTime;
    }
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  override dispose(): void {
    // Dispose shader materials
    this.gridFloorMaterial?.dispose();
    this.cylinderMaterial?.dispose();
    this.topCapMaterial?.dispose();
    this.bottomCapMaterial?.dispose();
    this.haloMaterial?.dispose();
    this.outerShellMaterial?.dispose();
    this.innerCoreMaterial?.dispose();

    // Dispose band materials
    for (const mat of this.bandMaterials) {
      mat.dispose();
    }

    // Dispose band geometries
    for (const mesh of this.bandMeshes) {
      mesh.geometry.dispose();
    }

    super.dispose();
  }
}
