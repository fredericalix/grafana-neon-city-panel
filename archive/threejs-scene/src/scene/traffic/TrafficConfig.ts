/**
 * Traffic System Configuration
 * Types, constants, and configuration for the Tron-style traffic visualization
 */

import * as THREE from 'three';
import { COLORS } from '../prefabs/materials';

// ============================================================================
// Types
// ============================================================================

export type TrafficSpeed = 'slow' | 'normal' | 'fast';
export type VehicleType = 'lightCycle' | 'dataPacket';

export interface TrafficState {
  density: number;   // 0-100
  speed: TrafficSpeed;
  enabled: boolean;
}

export interface TrafficConfig {
  density: number;        // 0-100%, controls vehicle count
  speed: TrafficSpeed;
  maxVehicles: number;    // Hard limit for performance
  lightCycleRatio: number; // Ratio of cycles vs packets (0-1)
  enabled: boolean;
}

export interface RoadCell {
  x: number;
  z: number;
  worldX: number;
  worldZ: number;
  neighbors: RoadCell[];
  isIntersection: boolean;
}

export interface PathSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
}

// ============================================================================
// Constants
// ============================================================================

// Default traffic configuration
export const DEFAULT_TRAFFIC_CONFIG: TrafficConfig = {
  density: 50,
  speed: 'normal',
  maxVehicles: 30,
  lightCycleRatio: 0.6,
  enabled: true,
};

// Speed multipliers for vehicle movement
export const SPEED_MULTIPLIERS: Record<TrafficSpeed, number> = {
  slow: 0.5,
  normal: 1.0,
  fast: 2.0,
};

// Base speed in units per second
export const BASE_VEHICLE_SPEED = 1.5;

// Vehicle dimensions
export const VEHICLE_DIMENSIONS = {
  lightCycle: {
    length: 0.5,
    width: 0.15,
    height: 0.2,
  },
  dataPacket: {
    size: 0.15,
  },
};

// Trail configuration
export const TRAIL_CONFIG = {
  maxPoints: 50,         // Maximum trail points
  width: 0.06,           // Trail ribbon width
  fadeSpeed: 2.0,        // How fast trail fades
  updateInterval: 2,     // Update every N frames (optimization)
};

// Colors for vehicles and trails
export const TRAFFIC_COLORS = {
  // Light Cycle colors
  lightCycle: {
    body: COLORS.building.dark,      // 0x222233
    neonPrimary: COLORS.glow.cyan,   // 0x00ffff
    neonSecondary: COLORS.glow.magenta, // 0xff00ff
    trail: COLORS.glow.cyan,
  },
  // Data Packet colors (variety for visual interest)
  dataPacket: [
    COLORS.glow.cyan,    // 0x00ffff
    COLORS.glow.magenta, // 0xff00ff
    COLORS.glow.green,   // 0x00ff88
  ],
};

// Vehicle height above road
export const VEHICLE_HEIGHT = 0.05;

// Spawn/despawn configuration
export const SPAWN_CONFIG = {
  minSpawnInterval: 0.5,  // Minimum seconds between spawns
  maxSpawnInterval: 2.0,  // Maximum seconds between spawns
  despawnDistance: 0.1,   // Distance from path end to despawn
};

// Performance limits
export const PERFORMANCE_LIMITS = {
  maxVehiclesDefault: 30,
  maxVehiclesHigh: 50,
  maxTrailPointsPerVehicle: 50,
  lodDistanceSimplified: 15,
  lodDistancePoint: 30,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get speed multiplier for given traffic speed setting
 */
export function getSpeedMultiplier(speed: TrafficSpeed): number {
  return SPEED_MULTIPLIERS[speed] ?? SPEED_MULTIPLIERS.normal;
}

/**
 * Calculate target vehicle count based on density and road cells
 */
export function calculateTargetVehicleCount(
  density: number,
  roadCellCount: number,
  maxVehicles: number
): number {
  // Minimum 1 vehicle at any non-zero density
  if (density <= 0) return 0;

  // Max vehicles based on road coverage (30% of road cells)
  const maxByRoads = Math.floor(roadCellCount * 0.3);

  // Use exponential curve for more noticeable density changes
  // At 1% = ~2 vehicles, at 50% = ~15 vehicles, at 100% = maxVehicles
  const normalizedDensity = density / 100;
  const targetByDensity = Math.max(1, Math.floor(normalizedDensity * maxVehicles));

  // Return the minimum of all limits, but at least 1 if density > 0
  return Math.max(1, Math.min(targetByDensity, maxByRoads, maxVehicles));
}

/**
 * Get random data packet color
 */
export function getRandomPacketColor(): number {
  const colors = TRAFFIC_COLORS.dataPacket;
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Create emissive material for neon effect
 */
export function createNeonMaterial(color: number, intensity: number = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9 * intensity,
  });
}

/**
 * Create line material for neon edges
 */
export function createNeonLineMaterial(color: number, opacity: number = 0.9): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: 2,
  });
}
