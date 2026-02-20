/**
 * TrafficManager - Spawn/despawn orchestrator for traffic vehicles
 *
 * Manages the lifecycle of all traffic vehicles, controls density and speed,
 * handles spawning/despawning based on configuration.
 */

import * as THREE from 'three';
import { PathGenerator } from './PathGenerator';
import { VehicleBase } from './VehicleBase';
import { LightCycle } from './LightCycle';
import { DataPacket } from './DataPacket';
import {
  TrafficConfig,
  TrafficSpeed,
  DEFAULT_TRAFFIC_CONFIG,
  SPAWN_CONFIG,
  calculateTargetVehicleCount,
} from './TrafficConfig';

export class TrafficManager {
  private scene: THREE.Scene;
  private vehicles: VehicleBase[] = [];
  private disposingVehicles: VehicleBase[] = [];
  private pathGenerator: PathGenerator;

  private config: TrafficConfig;
  private enabled: boolean = false;
  private roads: string[] | null = null;

  private spawnTimer: number = 0;
  private nextSpawnInterval: number = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.pathGenerator = new PathGenerator();
    this.config = { ...DEFAULT_TRAFFIC_CONFIG };
  }

  /**
   * Initialize with road data and origin offset
   */
  setRoads(roads: string[], origin: { x: number; z: number }): void {
    this.roads = roads;
    this.pathGenerator.parseRoads(roads, origin);

    // Clear existing vehicles when roads change
    this.clearAllVehicles();
  }

  /**
   * Set traffic density (0-100)
   */
  setDensity(density: number): void {
    this.config.density = Math.max(0, Math.min(100, density));
  }

  /**
   * Set traffic speed
   */
  setSpeed(speed: TrafficSpeed): void {
    this.config.speed = speed;

    // Update all existing vehicles
    for (const vehicle of this.vehicles) {
      vehicle.setSpeed(speed);
    }
  }

  /**
   * Enable/disable traffic system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      // Start disposing all vehicles
      for (const vehicle of this.vehicles) {
        vehicle.startDisposal();
        this.disposingVehicles.push(vehicle);
      }
      this.vehicles = [];
    }
  }

  /**
   * Check if traffic is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current vehicle count
   */
  getVehicleCount(): number {
    return this.vehicles.length;
  }

  /**
   * Update traffic system (called each frame)
   */
  update(deltaTime: number): void {
    // Update disposing vehicles (fade out trails)
    this.updateDisposingVehicles(deltaTime);

    // Skip if not enabled or no roads
    if (!this.enabled || !this.roads || this.pathGenerator.getRoadCellCount() === 0) {
      return;
    }

    // Calculate target vehicle count
    const targetCount = calculateTargetVehicleCount(
      this.config.density,
      this.pathGenerator.getRoadCellCount(),
      this.config.maxVehicles
    );

    // Manage vehicle count to match target
    this.spawnTimer += deltaTime;
    const vehicleDeficit = targetCount - this.vehicles.length;

    if (vehicleDeficit > 0) {
      // Need more vehicles - spawn them
      if (vehicleDeficit > 3 && this.spawnTimer >= 0.1) {
        // Spawn up to 3 vehicles at once to catch up faster
        const toSpawn = Math.min(3, vehicleDeficit);
        for (let i = 0; i < toSpawn; i++) {
          this.spawnVehicle();
        }
        this.spawnTimer = 0;
        this.nextSpawnInterval = 0.2;
      } else if (this.spawnTimer >= this.nextSpawnInterval) {
        this.spawnVehicle();
        this.spawnTimer = 0;
        this.nextSpawnInterval = this.calculateNextSpawnInterval();
      }
    } else if (vehicleDeficit < -1 && this.spawnTimer >= 0.5) {
      // Too many vehicles - remove one (oldest first)
      this.removeOldestVehicle();
      this.spawnTimer = 0;
    }

    // Update all active vehicles
    for (const vehicle of this.vehicles) {
      vehicle.update(deltaTime, this.pathGenerator);
    }

    // Handle inactive vehicles (reached end of path)
    this.handleInactiveVehicles();
  }

  /**
   * Spawn a new vehicle
   */
  private spawnVehicle(): void {
    // Determine vehicle type based on ratio
    const isLightCycle = Math.random() < this.config.lightCycleRatio;

    // Create vehicle
    let vehicle: VehicleBase;
    if (isLightCycle) {
      // Alternate between primary and secondary neon colors
      const useAltColor = Math.random() > 0.7;
      vehicle = new LightCycle(useAltColor);
    } else {
      vehicle = new DataPacket();
    }

    // Initialize and generate path
    vehicle.initialize();
    vehicle.setSpeed(this.config.speed);

    const path = this.pathGenerator.generateRandomPath(undefined, 8);
    if (path.length < 3) {
      vehicle.dispose();
      return;
    }

    vehicle.setPath(path, this.pathGenerator);

    // Add to scene
    this.scene.add(vehicle.getObject());
    this.scene.add(vehicle.getTrailObject());

    // Add to tracking
    this.vehicles.push(vehicle);
  }

  /**
   * Handle vehicles that need new paths or have become inactive
   */
  private handleInactiveVehicles(): void {
    const stillActive: VehicleBase[] = [];

    for (const vehicle of this.vehicles) {
      // If vehicle needs a new path, assign one
      if (vehicle.needsNewPath) {
        const newPath = this.pathGenerator.generateRandomPath(undefined, 8);
        if (newPath.length >= 3) {
          vehicle.assignNewPath(newPath, this.pathGenerator);
          stillActive.push(vehicle);
        } else {
          // Couldn't generate valid path, try again next frame
          stillActive.push(vehicle);
        }
      } else if (vehicle.isActive()) {
        stillActive.push(vehicle);
      } else {
        // Dispose truly inactive vehicles
        vehicle.startDisposal();
        this.disposingVehicles.push(vehicle);
      }
    }

    this.vehicles = stillActive;
  }

  /**
   * Update vehicles that are being disposed (fading out)
   */
  private updateDisposingVehicles(deltaTime: number): void {
    const stillDisposing: VehicleBase[] = [];

    for (const vehicle of this.disposingVehicles) {
      vehicle.updateDisposal(deltaTime);

      if (vehicle.isReadyForDisposal()) {
        // Fully remove from scene
        this.scene.remove(vehicle.getObject());
        this.scene.remove(vehicle.getTrailObject());
        vehicle.dispose();
      } else {
        stillDisposing.push(vehicle);
      }
    }

    this.disposingVehicles = stillDisposing;
  }

  /**
   * Remove the oldest vehicle (first in array) with fade-out
   */
  private removeOldestVehicle(): void {
    if (this.vehicles.length === 0) return;

    // Remove the first vehicle (oldest)
    const vehicle = this.vehicles.shift();
    if (vehicle) {
      vehicle.startDisposal();
      this.disposingVehicles.push(vehicle);
    }
  }

  /**
   * Calculate next spawn interval based on density
   */
  private calculateNextSpawnInterval(): number {
    // Higher density = shorter intervals
    const densityFactor = 1 - (this.config.density / 100) * 0.8;
    const baseInterval = SPAWN_CONFIG.minSpawnInterval +
      (SPAWN_CONFIG.maxSpawnInterval - SPAWN_CONFIG.minSpawnInterval) * densityFactor;

    // Add some randomness
    return baseInterval * (0.8 + Math.random() * 0.4);
  }

  /**
   * Clear all vehicles immediately
   */
  clearAllVehicles(): void {
    // Remove all active vehicles
    for (const vehicle of this.vehicles) {
      this.scene.remove(vehicle.getObject());
      this.scene.remove(vehicle.getTrailObject());
      vehicle.dispose();
    }
    this.vehicles = [];

    // Remove all disposing vehicles
    for (const vehicle of this.disposingVehicles) {
      this.scene.remove(vehicle.getObject());
      this.scene.remove(vehicle.getTrailObject());
      vehicle.dispose();
    }
    this.disposingVehicles = [];
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearAllVehicles();
  }
}
