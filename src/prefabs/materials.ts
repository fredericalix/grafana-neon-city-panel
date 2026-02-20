import * as THREE from 'three';
import { BuildingStatus } from '../types';

/**
 * Color palette - Cyberpunk / Retrofuturistic theme
 */
export const COLORS = {
  ground: 0x0a0a12,
  road: 0x1a1a2a,
  roadNeon: 0x00ffff,
  gridLine: 0x2a2a4a,

  building: {
    primary: 0x556677,
    secondary: 0x445566,
    accent: 0x667788,
    metal: 0x8899aa,
    roof: 0x334455,
    white: 0xaabbcc,
    dark: 0x222233,
  },

  state: {
    online: 0x00ff88,
    offline: 0x666688,
    warning: 0xffaa00,
    critical: 0xff4444,
    unknown: 0xaaaaaa,
  },

  glow: {
    cyan: 0x00ffff,
    green: 0x00ff88,
    red: 0xff4444,
    orange: 0xffaa00,
    magenta: 0xff00ff,
    yellow: 0xffff00,
    gold: 0xffaa00,
    violet: 0xaa00ff,
    pink: 0xff0088,
  },
};

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

export function createBuildingMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.8,
  });
}

export function createGlowMaterial(color: number, opacity = 0.8): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
}

export function createMetalMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: COLORS.building.metal,
    metalness: 0.7,
    roughness: 0.3,
  });
}
