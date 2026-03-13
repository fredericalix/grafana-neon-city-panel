// =============================================================================
// BUILDING TYPES
// =============================================================================

export type BuildingType =
  | 'windmill'
  | 'bakery'
  | 'bank'
  | 'farm_building_a'
  | 'farm_building_b'
  | 'farm_silo'
  | 'farm_field_a'
  | 'farm_field_b'
  | 'farm_cattle_a'
  | 'tree'
  | 'grass'
  | 'display_a'
  | 'tower_a'
  | 'tower_b'
  | 'pyramid'
  | 'supervisor'
  | 'arcade'
  | 'monitor_tube'
  | 'monitor_tube_giant'
  | 'spire'
  | 'led_facade'
  | 'twin_towers'
  | 'diamond_tower';

export type DisplayRingCount = 2 | 3;

// =============================================================================
// BUILDING STATUS & ACTIVITY
// =============================================================================

export type BuildingStatus = 'online' | 'offline' | 'warning' | 'critical';
export type BuildingActivity = 'slow' | 'normal' | 'fast';
export type BankQuantity = 'none' | 'low' | 'medium' | 'full';

// =============================================================================
// TRAFFIC
// =============================================================================

export type TrafficSpeed = 'slow' | 'normal' | 'fast';

export interface TrafficState {
  density: number; // 0-100
  speed: TrafficSpeed;
}

// =============================================================================
// BUILDING
// =============================================================================

export interface Building {
  id: string;
  name?: string;
  type: BuildingType | string;
  location: { x: number; y: number };
  orientation?: 'N' | 'S' | 'E' | 'W';
  defaultText?: string;
}

export interface BuildingState {
  id: string;
  status: BuildingStatus;
  activity: BuildingActivity;
  text1?: string;
  text2?: string;
  text3?: string;
  cpuUsage?: number;
  ramUsage?: number;
  networkTraffic?: number;
  activeConnections?: number;
  temperature?: number;
  alertLevel?: 'normal' | 'warning' | 'critical';
  bankQuantity?: BankQuantity;
  bankAmount?: number;
  ringCount?: DisplayRingCount;
  monitorBands?: { value: number; label?: string }[];
  monitorMessages?: string[];
}

// =============================================================================
// GRAFANA PANEL OPTIONS
// =============================================================================

export interface LayoutBuilding {
  id: string;
  name: string;
  type: BuildingType | string;
  x: number;
  z: number;
  rotation: number;
  defaultText?: string;
}

export interface CityLayout {
  gridSize: number;
  buildings: LayoutBuilding[];
  roads?: string[];
  roadOrigin?: { x: number; z: number };
}

export interface ThresholdConfig {
  online: number;
  warning: number;
  critical: number;
}

export interface CityOptions {
  layout: CityLayout;
  thresholds: ThresholdConfig;
  statusField: string;
  valueField: string;
  nameField: string;
  trafficDensityField?: string;
  trafficSpeedField?: string;
  enableInteraction?: boolean;
  showLabels?: boolean;
}

export const DEFAULT_OPTIONS: CityOptions = {
  layout: {
    gridSize: 2,
    buildings: [
      { id: 'b1', name: 'database', type: 'tower_b', x: 0, z: 0, rotation: 0 },
      { id: 'b2', name: 'cache', type: 'pyramid', x: -7, z: -5, rotation: 0 },
      { id: 'b3', name: 'api-gateway', type: 'tower_a', x: 7, z: -5, rotation: 0 },
      { id: 'b4', name: 'web-server', type: 'windmill', x: -5, z: 5, rotation: 0 },
      { id: 'b5', name: 'display', type: 'display_a', x: 0, z: 6, rotation: 0 },
      { id: 'b6', name: 'cdn', type: 'led_facade', x: -8, z: 0, rotation: 0 },
      { id: 'b7', name: 'monitoring', type: 'monitor_tube', x: 8, z: 0, rotation: 0 },
      { id: 'b8', name: 'vault', type: 'bank', x: 0, z: -8, rotation: 0 },
    ],
    roads: [
      '000000000010000000000', // z=-9
      '000000000010000000000', // z=-8  vault
      '000000000010000000000', // z=-7
      '000000000010000000000', // z=-6
      '000111111111111111000', // z=-5  cache, api-gateway
      '000100000010000001000', // z=-4
      '000100000010000001000', // z=-3
      '000100000010000001000', // z=-2
      '000100000010000001000', // z=-1
      '111111111111111111111', // z= 0  cdn, database, monitoring
      '000100000010000001000', // z= 1
      '000100000010000001000', // z= 2
      '000100000010000001000', // z= 3
      '000100000010000001000', // z= 4
      '000111111111111111000', // z= 5  web-server
      '000000000010000000000', // z= 6  display
      '000000000010000000000', // z= 7
      '000000000010000000000', // z= 8
      '000000000010000000000', // z= 9
    ],
    roadOrigin: { x: -10, z: -9 },
  },
  thresholds: {
    online: 90,
    warning: 70,
    critical: 0,
  },
  statusField: 'status',
  valueField: 'value',
  nameField: 'name',
};
