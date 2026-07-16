import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState } from '../types';
import { getStatusColor, getStatusPulseSpeed, createGlowMaterial } from './materials';

export interface AnimationState {
  pulsePhase: number;
  rotationSpeed: number;
  particleTime: number;
}

/**
 * Base class for all building prefabs.
 * Ported from whooktown/threejs-scene - simplified for Grafana panel context.
 */
export abstract class BasePrefab {
  protected group: THREE.Group;
  protected building: Building;
  protected glowMeshes: THREE.Mesh[] = [];
  protected status: BuildingStatus = 'online';
  protected activity: BuildingActivity = 'normal';
  // Grafana refreshes call updateStatus/updateActivity on every poll; these
  // flags let the first call apply unconditionally while later no-op calls
  // skip the (potentially expensive) onStatusChange/onActivityChange work.
  private statusApplied = false;
  private activityApplied = false;

  protected animationState: AnimationState = {
    pulsePhase: Math.random() * Math.PI * 2,
    rotationSpeed: 0,
    particleTime: 0,
  };

  constructor(building: Building) {
    this.building = building;
    this.group = new THREE.Group();
    this.group.userData.buildingId = building.id;
    this.group.userData.building = building;
  }

  initialize(): void {
    this.build();
  }

  protected abstract build(): void;
  protected abstract onStatusChange(status: BuildingStatus): void;
  protected abstract onActivityChange(activity: BuildingActivity): void;

  getObject(): THREE.Group {
    return this.group;
  }

  getBuilding(): Building {
    return this.building;
  }

  updateStatus(status: BuildingStatus): void {
    if (this.statusApplied && status === this.status) {
      return;
    }
    this.statusApplied = true;
    this.status = status;
    const color = getStatusColor(status);
    for (const mesh of this.glowMeshes) {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        // setHex on the material's own Color — assigning a shared Color
        // instance would alias every glow material to the same object.
        mesh.material.color.setHex(color);
      }
    }
    this.onStatusChange(status);
  }

  updateActivity(activity: BuildingActivity): void {
    if (this.activityApplied && activity === this.activity) {
      return;
    }
    this.activityApplied = true;
    this.activity = activity;
    this.onActivityChange(activity);
  }

  updateData(_state: BuildingState): void {
    // Override in subclasses to handle extra data fields
  }

  update(deltaTime: number): void {
    const pulseSpeed = getStatusPulseSpeed(this.status);
    this.animationState.pulsePhase += deltaTime * pulseSpeed * Math.PI * 2;

    const pulseValue = (Math.sin(this.animationState.pulsePhase) + 1) / 2;
    // Offline buildings hold a fixed dim glow instead of pulsing —
    // otherwise this per-frame write overrides the dim opacity that
    // subclasses set in onStatusChange.
    const opacity = this.status === 'offline' ? 0.15 : 0.3 + 0.6 * pulseValue;

    for (const mesh of this.glowMeshes) {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = opacity;
      }
    }

    this.animationState.particleTime += deltaTime;
  }

  dispose(): void {
    this.group.traverse((object) => {
      // Line, LineSegments and Points carry geometry/material too but are
      // not instanceof Mesh — check the properties, not the class.
      const { geometry, material } = object as THREE.Mesh;
      geometry?.dispose();
      if (Array.isArray(material)) {
        material.forEach((m) => this.disposeMaterial(m));
      } else if (material) {
        this.disposeMaterial(material);
      }
    });
  }

  /**
   * Dispose a material and any textures it references.
   * THREE.Material.dispose() does NOT free the GPU textures it points to,
   * so canvas/data textures leak unless disposed explicitly. Covers all
   * standard texture slots used across the prefabs.
   */
  private disposeMaterial(material: THREE.Material): void {
    const textureKeys: Array<keyof THREE.MeshStandardMaterial> = [
      'map',
      'emissiveMap',
      'alphaMap',
      'aoMap',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'bumpMap',
      'displacementMap',
      'envMap',
    ];
    for (const key of textureKeys) {
      const tex = (material as unknown as Record<string, unknown>)[key as string];
      if (tex instanceof THREE.Texture) {
        tex.dispose();
      }
    }
    material.dispose();
  }

  protected addGlowMesh(mesh: THREE.Mesh): void {
    if (!this.glowMeshes.includes(mesh)) {
      this.glowMeshes.push(mesh);
    }
  }

  protected createGlowPoint(x: number, y: number, z: number, color: number, size = 0.1): THREE.Mesh {
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
