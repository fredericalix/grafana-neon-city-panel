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
    this.status = status;
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

  updateData(_state: BuildingState): void {
    // Override in subclasses to handle extra data fields
  }

  update(deltaTime: number): void {
    const pulseSpeed = getStatusPulseSpeed(this.status);
    this.animationState.pulsePhase += deltaTime * pulseSpeed * Math.PI * 2;

    const pulseValue = (Math.sin(this.animationState.pulsePhase) + 1) / 2;
    const opacity = 0.3 + 0.6 * pulseValue;

    for (const mesh of this.glowMeshes) {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = opacity;
      }
    }

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

  protected addGlowMesh(mesh: THREE.Mesh): void {
    this.glowMeshes.push(mesh);
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
