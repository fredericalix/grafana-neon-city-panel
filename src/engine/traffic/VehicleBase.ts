/**
 * VehicleBase - Abstract base class for traffic vehicles
 *
 * Provides common functionality for path following, trail management,
 * and lifecycle management.
 */

import * as THREE from 'three';
import { TrailSystem } from './TrailSystem';
import { PathGenerator } from './PathGenerator';
import {
  TrafficSpeed,
  VehicleType,
  BASE_VEHICLE_SPEED,
  getSpeedMultiplier,
  SPAWN_CONFIG,
} from './TrafficConfig';

export abstract class VehicleBase {
  protected group: THREE.Group;
  protected trail: TrailSystem;

  protected path: THREE.Vector3[] = [];
  protected pathLength = 0;
  protected pathProgress = 0;

  protected position: THREE.Vector3 = new THREE.Vector3();
  protected direction: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  protected targetDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

  protected speed: TrafficSpeed = 'normal';
  protected baseSpeed: number = BASE_VEHICLE_SPEED;
  protected active = true;
  protected disposing = false;

  protected animTime = 0;

  public readonly id: string;
  public readonly type: VehicleType;

  // Flag to indicate vehicle needs a new path
  public needsNewPath = false;

  constructor(type: VehicleType, trailColor: number) {
    this.id = `vehicle-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.type = type;

    this.group = new THREE.Group();
    this.group.name = `Vehicle_${this.id}`;

    this.trail = new TrailSystem(trailColor);
  }

  /**
   * Create the vehicle geometry (implemented by subclasses)
   */
  abstract createGeometry(): void;

  /**
   * Update vehicle-specific animations (implemented by subclasses)
   */
  abstract updateAnimation(deltaTime: number): void;

  /**
   * Initialize the vehicle and add geometry
   */
  initialize(): void {
    this.createGeometry();
  }

  /**
   * Get the vehicle's Three.js group
   */
  getObject(): THREE.Group {
    return this.group;
  }

  /**
   * Get the trail mesh
   */
  getTrailObject(): THREE.Mesh {
    return this.trail.getObject();
  }

  /**
   * Set the path for this vehicle to follow
   */
  setPath(path: THREE.Vector3[], pathGenerator: PathGenerator): void {
    this.path = path;
    this.pathLength = pathGenerator.calculatePathLength(path);
    this.pathProgress = 0;

    if (path.length > 0) {
      this.position.copy(path[0]);
      this.group.position.copy(this.position);
    }

    if (path.length > 1) {
      this.direction.subVectors(path[1], path[0]).normalize();
      this.targetDirection.copy(this.direction);
      this.updateRotation();
    }
  }

  /**
   * Set vehicle speed
   */
  setSpeed(speed: TrafficSpeed): void {
    this.speed = speed;
  }

  /**
   * Get current speed multiplier
   */
  getSpeedMultiplier(): number {
    return getSpeedMultiplier(this.speed);
  }

  /**
   * Update the vehicle (called each frame)
   */
  update(deltaTime: number, pathGenerator: PathGenerator): void {
    if (!this.active || this.path.length < 2) {return;}

    this.animTime += deltaTime;

    // Update path progress
    const speedMult = this.getSpeedMultiplier();
    const progressDelta = (this.baseSpeed * speedMult * deltaTime) / this.pathLength;
    this.pathProgress += progressDelta;

    // Check if reached end of path
    if (this.pathProgress >= 1 - SPAWN_CONFIG.despawnDistance) {
      this.onPathComplete();
      return;
    }

    // Get position and direction on path
    const newPosition = pathGenerator.getPointOnPath(this.path, this.pathProgress);
    const newDirection = pathGenerator.getDirectionOnPath(this.path, this.pathProgress);

    // Smooth direction changes
    this.targetDirection.copy(newDirection);
    this.direction.lerp(this.targetDirection, 0.1);
    this.direction.normalize();

    // Update position
    this.position.copy(newPosition);
    this.group.position.copy(this.position);

    // Update rotation
    this.updateRotation();

    // Add trail point
    this.trail.addPoint(this.position, this.direction);

    // Update trail
    this.trail.update(deltaTime);

    // Update vehicle-specific animation
    this.updateAnimation(deltaTime);
  }

  /**
   * Update vehicle rotation to face direction
   */
  protected updateRotation(): void {
    if (this.direction.length() < 0.001) {return;}

    // Calculate rotation to face direction
    const angle = Math.atan2(this.direction.x, this.direction.z);
    this.group.rotation.y = angle;
  }

  /**
   * Called when vehicle reaches end of path
   */
  protected onPathComplete(): void {
    // Mark as needing new path (TrafficManager will handle this)
    this.needsNewPath = true;
  }

  /**
   * Assign a new path to continue traveling
   */
  assignNewPath(path: THREE.Vector3[], pathGenerator: PathGenerator): void {
    if (path.length < 2) {
      this.active = false;
      this.trail.setActive(false);
      return;
    }

    this.path = path;
    this.pathLength = pathGenerator.calculatePathLength(path);
    this.pathProgress = 0;
    this.needsNewPath = false;

    // Keep current position, smoothly transition to new path
    if (path.length > 0) {
      this.position.copy(path[0]);
      this.group.position.copy(this.position);
    }

    if (path.length > 1) {
      this.targetDirection.subVectors(path[1], path[0]).normalize();
    }
  }

  /**
   * Check if vehicle is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Check if vehicle and trail are ready for disposal
   */
  isReadyForDisposal(): boolean {
    return !this.active && this.trail.isEmpty();
  }

  /**
   * Start the disposal process (fade out trail)
   */
  startDisposal(): void {
    this.disposing = true;
    this.active = false;
    this.trail.setActive(false);
    this.group.visible = false;
  }

  /**
   * Update during disposal (continue fading trail)
   */
  updateDisposal(deltaTime: number): void {
    this.trail.update(deltaTime);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.trail.dispose();

    // Dispose all children geometries and materials
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        }
      }
      if (child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * Reset vehicle for reuse (object pooling)
   */
  reset(): void {
    this.path = [];
    this.pathLength = 0;
    this.pathProgress = 0;
    this.position.set(0, 0, 0);
    this.direction.set(0, 0, 1);
    this.targetDirection.set(0, 0, 1);
    this.active = true;
    this.disposing = false;
    this.needsNewPath = false;
    this.animTime = 0;
    this.group.visible = true;
    this.trail.clear();
    this.trail.setActive(true);
  }
}
