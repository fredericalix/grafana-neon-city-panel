import * as THREE from 'three';
import { BuildingStatus } from '../../types';

/**
 * Color palette - Cyberpunk / Retrofuturistic theme
 */
export const COLORS = {
  // Environment (dark cyberpunk)
  ground: 0x0a0a12, // Very dark blue-black
  road: 0x1a1a2a, // Dark purple-gray
  roadNeon: 0x00ffff, // Cyan neon for road edges
  roadNeonAlt: 0xff00ff, // Magenta neon alternate
  gridLine: 0x2a2a4a,
  grid: 0x151520,

  // Building materials (metallic cyberpunk)
  building: {
    primary: 0x556677, // Blue-gray metal
    secondary: 0x445566, // Darker blue-gray
    accent: 0x667788, // Lighter accent
    metal: 0x8899aa, // Bright metal
    roof: 0x334455, // Dark roof
    white: 0xaabbcc, // Light panels
    dark: 0x222233, // Dark panels
  },

  // Status colors (neon style)
  state: {
    online: 0x00ff88, // Neon green
    offline: 0x666688, // Muted purple-gray
    warning: 0xffaa00, // Neon orange
    critical: 0xff4444, // Neon red
    unknown: 0xaaaaaa, // Gray
  },

  // Glow effects (bright neon)
  glow: {
    cyan: 0x00ffff,
    green: 0x00ff88,
    red: 0xff4444,
    orange: 0xffaa00,
    magenta: 0xff00ff,
    yellow: 0xffff00,
    // New colors for Shenzhen-inspired buildings
    gold: 0xffaa00,      // spire
    violet: 0xaa00ff,    // twin_towers
    pink: 0xff0088,      // diamond_tower
  },

  // Fire/smoke
  fire: {
    flame: 0xff4500,
    smoke: 0x333344,
  },
};

/**
 * Get color based on building status
 */
export function getStatusColor(status: BuildingStatus): number {
  switch (status) {
    case 'online':
      return COLORS.state.online;
    case 'offline':
      return COLORS.state.offline;
    case 'warning':
      return COLORS.state.warning;
    case 'critical':
      return COLORS.state.critical;
    default:
      return COLORS.state.unknown;
  }
}

/**
 * Get pulse speed based on status
 */
export function getStatusPulseSpeed(status: BuildingStatus): number {
  switch (status) {
    case 'online':
      return 0.5;
    case 'offline':
      return 0.1;
    case 'warning':
      return 1.0;
    case 'critical':
      return 2.0;
    default:
      return 0.3;
  }
}

/**
 * Create standard building material
 */
export function createBuildingMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.8,
  });
}

/**
 * Create metal material
 */
export function createMetalMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: COLORS.building.metal,
    metalness: 0.7,
    roughness: 0.3,
  });
}

/**
 * Create glow material
 */
export function createGlowMaterial(color: number, opacity = 0.8): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
}

/**
 * Create gray version of material (for offline state)
 */
export function createGrayMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.1,
    roughness: 0.9,
  });
}
