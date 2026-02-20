import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { getStatusColor, getStatusPulseSpeed, createGlowMaterial, COLORS } from './materials';

/**
 * Animation state for prefabs
 */
export interface AnimationState {
  pulsePhase: number;
  rotationSpeed: number;
  particleTime: number;
}

/**
 * Stored material info for construction animation
 */
interface MaterialInfo {
  mesh: THREE.Mesh | THREE.Line | THREE.LineSegments | THREE.Points;
  originalOpacity: number;
  originalColor: THREE.Color;
  originalTransparent: boolean;
  worldY: number;
}

/**
 * Base class for all building prefabs
 */
export abstract class BasePrefab {
  protected group: THREE.Group;
  protected building: Building;
  protected glowMeshes: THREE.Mesh[] = [];
  protected status: BuildingStatus = 'online';
  protected activity: BuildingActivity = 'normal';

  protected animationState: AnimationState = {
    pulsePhase: Math.random() * Math.PI * 2,
    rotationSpeed: 0,
    particleTime: 0,
  };

  // Construction/deconstruction animation state
  private constructionProgress = 1; // 0 = invisible, 1 = fully built
  private isConstructing = false;
  private isDeconstructing = false;
  private constructionCallback?: () => void;
  private materialInfos: MaterialInfo[] = [];
  private constructionAnimTime = 0;
  private maxBuildingHeight = 2.5; // Will be calculated from actual geometry

  constructor(building: Building) {
    this.building = building;
    this.group = new THREE.Group();
    this.group.userData.buildingId = building.id;
    this.group.userData.building = building;

    // NOTE: build() is called by the factory function after construction
    // to avoid JavaScript class field initialization overwriting values set in build()
  }

  /** Must be called after construction to build the 3D objects */
  initialize(): void {
    this.build();
  }

  // ---------------------------------------------------------------------------
  // ABSTRACT METHODS
  // ---------------------------------------------------------------------------

  protected abstract build(): void;

  protected abstract onStatusChange(status: BuildingStatus): void;

  protected abstract onActivityChange(activity: BuildingActivity): void;

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  getObject(): THREE.Group {
    return this.group;
  }

  getBuilding(): Building {
    return this.building;
  }

  /**
   * Calculate bounding sphere radius for the building.
   * Used for camera focus distance calculation.
   */
  getBoundingRadius(): number {
    const box = new THREE.Box3().setFromObject(this.group);
    const size = new THREE.Vector3();
    box.getSize(size);
    return Math.max(size.x, size.y, size.z) / 2;
  }

  /**
   * Get the center point of the building at a useful focus height.
   * Returns a point at 2/3 height for more interesting camera focus.
   */
  getFocusPoint(): THREE.Vector3 {
    const box = new THREE.Box3().setFromObject(this.group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    // Return a point at 2/3 height (more interesting than dead center)
    center.y = box.min.y + (box.max.y - box.min.y) * 0.66;
    return center;
  }

  /**
   * Update the building data (metadata: name, description, tags, notes).
   * Called when building info changes without position/type change.
   */
  updateBuildingData(building: Building): void {
    this.building = building;
    this.group.userData.building = building;
  }

  updateStatus(status: BuildingStatus): void {
    this.status = status;

    // Update glow colors
    const color = new THREE.Color(getStatusColor(status));
    for (const mesh of this.glowMeshes) {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.color = color;
      }
    }

    this.onStatusChange(status);
  }

  updateActivity(activity: BuildingActivity): void {
    this.activity = activity;
    this.onActivityChange(activity);
  }

  /**
   * Play holographic construction animation (Tron style - line by line from bottom)
   */
  playConstructAnimation(): Promise<void> {
    return new Promise((resolve) => {
      // Store original material properties
      this.materialInfos = [];
      this.maxBuildingHeight = 0;

      this.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line ||
            obj instanceof THREE.LineSegments || obj instanceof THREE.Points) {
          const material = obj.material as THREE.Material & {
            opacity?: number;
            color?: THREE.Color;
            transparent?: boolean;
          };

          // Calculate world Y position
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          const localY = worldPos.y - this.group.position.y;

          // Track max height
          if (obj instanceof THREE.Mesh && obj.geometry) {
            obj.geometry.computeBoundingBox();
            const bbox = obj.geometry.boundingBox;
            if (bbox) {
              const meshTop = localY + bbox.max.y;
              this.maxBuildingHeight = Math.max(this.maxBuildingHeight, meshTop);
            }
          }

          this.materialInfos.push({
            mesh: obj,
            originalOpacity: material.opacity ?? 1,
            originalColor: material.color?.clone() ?? new THREE.Color(0xffffff),
            originalTransparent: material.transparent ?? false,
            worldY: localY,
          });

          // Set initial state: invisible with cyan tint
          material.transparent = true;
          material.opacity = 0;
          if (material.color) {
            material.color.setHex(COLORS.glow.cyan);
          }
        }
      });

      if (this.maxBuildingHeight === 0) this.maxBuildingHeight = 2.0;

      this.constructionProgress = 0;
      this.isConstructing = true;
      this.isDeconstructing = false;
      this.constructionCallback = resolve;
    });
  }

  /**
   * Play holographic deconstruction animation (reverse Tron style - line by line from top)
   */
  playDeconstructAnimation(): Promise<void> {
    return new Promise((resolve) => {
      // Store material properties if not already stored
      if (this.materialInfos.length === 0) {
        this.maxBuildingHeight = 0;

        this.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line ||
              obj instanceof THREE.LineSegments || obj instanceof THREE.Points) {
            const material = obj.material as THREE.Material & {
              opacity?: number;
              color?: THREE.Color;
              transparent?: boolean;
            };

            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            const localY = worldPos.y - this.group.position.y;

            if (obj instanceof THREE.Mesh && obj.geometry) {
              obj.geometry.computeBoundingBox();
              const bbox = obj.geometry.boundingBox;
              if (bbox) {
                const meshTop = localY + bbox.max.y;
                this.maxBuildingHeight = Math.max(this.maxBuildingHeight, meshTop);
              }
            }

            this.materialInfos.push({
              mesh: obj,
              originalOpacity: material.opacity ?? 1,
              originalColor: material.color?.clone() ?? new THREE.Color(0xffffff),
              originalTransparent: material.transparent ?? false,
              worldY: localY,
            });
          }
        });

        if (this.maxBuildingHeight === 0) this.maxBuildingHeight = 2.0;
      }

      this.constructionProgress = 1;
      this.isDeconstructing = true;
      this.isConstructing = false;
      this.constructionCallback = resolve;
    });
  }

  update(deltaTime: number): void {
    this.constructionAnimTime += deltaTime;

    // Handle construction animation
    if (this.isConstructing) {
      this.constructionProgress += deltaTime * 0.11; // ~9s animation (slow and cinematic)
      const scanLineY = this.constructionProgress * this.maxBuildingHeight;

      for (const info of this.materialInfos) {
        const material = info.mesh.material as THREE.Material & {
          opacity?: number;
          color?: THREE.Color;
        };

        // Check if this mesh should be revealed (below scan line)
        if (info.worldY < scanLineY) {
          // Holographic flicker effect
          const flicker = 0.7 + 0.3 * Math.sin(this.constructionAnimTime * 20);
          const revealProgress = Math.min(1, (scanLineY - info.worldY) / 0.3);

          // Lerp opacity from 0 to original
          material.opacity = info.originalOpacity * revealProgress * flicker;

          // Lerp color from cyan to original
          if (material.color) {
            const cyanColor = new THREE.Color(COLORS.glow.cyan);
            material.color.lerpColors(cyanColor, info.originalColor, revealProgress);
          }
        }
      }

      if (this.constructionProgress >= 1) {
        // Restore all original values
        for (const info of this.materialInfos) {
          const material = info.mesh.material as THREE.Material & {
            opacity?: number;
            color?: THREE.Color;
            transparent?: boolean;
            needsUpdate?: boolean;
          };
          material.opacity = info.originalOpacity;
          material.transparent = info.originalTransparent;
          if (material.color) {
            material.color.copy(info.originalColor);
          }
          // Force material update after changing transparent property
          material.needsUpdate = true;
        }
        this.isConstructing = false;
        this.materialInfos = [];
        this.constructionCallback?.();
      }
    }

    // Handle deconstruction animation
    if (this.isDeconstructing) {
      this.constructionProgress -= deltaTime * 1.2; // ~0.8s animation (faster)
      const scanLineY = this.constructionProgress * this.maxBuildingHeight;

      for (const info of this.materialInfos) {
        const material = info.mesh.material as THREE.Material & {
          opacity?: number;
          color?: THREE.Color;
          transparent?: boolean;
        };

        material.transparent = true;

        // Check if this mesh should start fading (above scan line going down)
        if (info.worldY > scanLineY) {
          // Holographic flicker effect with red/orange tint
          const flicker = 0.7 + 0.3 * Math.sin(this.constructionAnimTime * 25);
          const fadeProgress = Math.min(1, (info.worldY - scanLineY) / 0.3);

          // Lerp opacity from original to 0
          material.opacity = info.originalOpacity * (1 - fadeProgress) * flicker;

          // Tint towards red/orange during deconstruction
          if (material.color) {
            const redColor = new THREE.Color(COLORS.glow.red);
            material.color.lerpColors(info.originalColor, redColor, fadeProgress);
          }
        } else {
          // Still visible, keep original
          material.opacity = info.originalOpacity;
          if (material.color) {
            material.color.copy(info.originalColor);
          }
        }
      }

      if (this.constructionProgress <= 0) {
        // Make everything invisible
        for (const info of this.materialInfos) {
          const material = info.mesh.material as THREE.Material & {
            opacity?: number;
          };
          material.opacity = 0;
        }
        this.isDeconstructing = false;
        this.materialInfos = [];
        this.constructionCallback?.();
      }
    }

    // Skip normal updates during construction/deconstruction
    if (this.isConstructing || this.isDeconstructing) {
      return;
    }

    const pulseSpeed = getStatusPulseSpeed(this.status);

    // Update pulse phase
    this.animationState.pulsePhase += deltaTime * pulseSpeed * Math.PI * 2;

    // Calculate pulse value (0 to 1)
    const pulseValue = (Math.sin(this.animationState.pulsePhase) + 1) / 2;
    const minOpacity = 0.3;
    const maxOpacity = 0.9;
    const opacity = minOpacity + (maxOpacity - minOpacity) * pulseValue;

    // Apply to glow meshes
    for (const mesh of this.glowMeshes) {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = opacity;
      }
    }

    // Update particles
    this.animationState.particleTime += deltaTime;
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material?.dispose();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  protected addGlowMesh(mesh: THREE.Mesh): void {
    this.glowMeshes.push(mesh);
  }

  protected createGlowPoint(
    x: number,
    y: number,
    z: number,
    color: number,
    size = 0.1
  ): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = createGlowMaterial(color);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    this.addGlowMesh(mesh);
    return mesh;
  }

  protected getActivitySpeed(): number {
    switch (this.activity) {
      case 'slow':
        return 0.3;
      case 'normal':
        return 1.0;
      case 'fast':
        return 3.0;
      default:
        return 1.0;
    }
  }
}
