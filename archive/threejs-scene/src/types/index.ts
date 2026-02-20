/**
 * Types matching WhookTown backend format
 */

// =============================================================================
// BUILDING TYPES
// =============================================================================

export type BuildingType =
  | 'windmill'
  | 'bakery'
  | 'bank'
  | 'house_a'
  | 'house_b'
  | 'house_c'
  | 'farm_building_a'
  | 'farm_building_b'
  | 'farm_silo'
  | 'farm_field_a'
  | 'farm_field_b'
  | 'farm_cattle_a'
  | 'traffic_light'
  | 'tree'
  | 'grass'
  | 'display_a'
  | 'tower_a'
  | 'tower_b'
  | 'pyramid'
  | 'supervisor'
  | 'arcade'
  | 'data_center'
  | 'monitor_tube'
  // Shenzhen-inspired skyscrapers
  | 'spire'          // KK100-style ovoidal tower
  | 'led_facade'     // LED animated facade tower
  | 'twin_towers'    // Twin towers with electric arcs
  | 'diamond_tower'; // Crystalline faceted tower

// =============================================================================
// BUILDING STATUS & ACTIVITY
// =============================================================================

export type BuildingStatus = 'online' | 'offline' | 'warning' | 'critical';
export type BuildingActivity = 'slow' | 'normal' | 'fast';
export type BankQuantity = 'none' | 'low' | 'medium' | 'full';
export type DisplayRingCount = 2 | 3;

// =============================================================================
// LOCATION & GRID
// =============================================================================

export interface Location {
  x: number;
  y: number;
}

export interface GridConfig {
  width: number;
  height: number;
}

// =============================================================================
// BUILDING
// =============================================================================

export interface Building {
  id: string;
  name?: string;
  type: BuildingType | string;
  roles?: string[];
  location: Location;
  orientation?: 'N' | 'S' | 'E' | 'W';
  // Metadata for display in 3D scene
  description?: string;
  tags?: string[];
  notes?: string;
}

export interface BuildingState {
  id: string;
  status: BuildingStatus;
  activity: BuildingActivity;
  // Bank-specific properties
  quantity?: BankQuantity;
  amount?: number | null;
  // DisplayA-specific properties
  ringCount?: DisplayRingCount;
  text1?: string;
  text2?: string;
  text3?: string;
  // TowerA-specific properties
  towerText?: string;
  // TowerB-specific properties
  towerBText?: string;
  dancerEnabled?: boolean;
  // Supervisor-specific properties
  faceRotationEnabled?: boolean;
  // Arcade-specific properties
  musicEnabled?: boolean;
  signText?: string;
  // DataCenter-specific properties
  cpuUsage?: number;
  ramUsage?: number;
  networkTraffic?: number;
  activeConnections?: number;
  temperature?: number;
  alertLevel?: 'normal' | 'warning' | 'critical';
  // MonitorTube-specific properties
  bandCount?: 3 | 4 | 5 | 6 | 7;
  bands?: Array<{ name: string; value: number }>;
}

// =============================================================================
// CITY LAYOUT
// =============================================================================

export interface CityLayout {
  id: string;
  name: string;
  grid: GridConfig;
  buildings: Building[];
  roads: string[]; // Array of strings like "00100" where 1 = road
}

// =============================================================================
// SENSOR DATA
// =============================================================================

export interface SensorData {
  id: string;
  status?: BuildingStatus;
  activity?: BuildingActivity;
  // Bank-specific
  quantity?: BankQuantity;
  amount?: number;
  // DisplayA-specific
  ringCount?: DisplayRingCount;
  text1?: string;
  text2?: string;
  text3?: string;
  // TowerA-specific
  towerText?: string;
  // TowerB-specific
  towerBText?: string;
  dancerEnabled?: boolean;
  // Supervisor-specific
  faceRotationEnabled?: boolean;
  // Arcade-specific
  musicEnabled?: boolean;
  signText?: string;
  // DataCenter-specific
  cpuUsage?: number;
  ramUsage?: number;
  networkTraffic?: number;
  activeConnections?: number;
  temperature?: number;
  alertLevel?: 'normal' | 'warning' | 'critical';
  // MonitorTube-specific
  bandCount?: 3 | 4 | 5 | 6 | 7;
  bands?: Array<{ name: string; value: number }>;
  [key: string]: unknown;
}

// =============================================================================
// CAMERA MODES
// =============================================================================

export type CameraMode = 'orbit' | 'fps' | 'flyover';

export interface CameraState {
  mode: CameraMode;
  flyoverSpeed?: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraCommand {
  command: 'position' | 'preset' | 'mode' | 'sequence' | 'path';
  layout_id: string;
  position?: Vector3;
  rotation?: Vector3;
  fov?: number;
  animate?: boolean;
  duration?: number;
  preset_id?: string;
  mode?: CameraMode;
  flyover_speed?: number;
  // Sequence control
  sequence_action?: 'play' | 'pause' | 'resume' | 'stop';
  sequence?: CameraSequence;
  // Path control (new grid-based system)
  action?: 'play' | 'pause' | 'stop';
  path?: CameraPath;
  path_id?: string;  // Alternative to full path - scene will fetch by ID
  // Mouse sensitivity
  mouse_sensitivity?: number;
}

export interface CameraPreset {
  id: string;
  layout_id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  fov: number;
  mode: CameraMode;
  is_default: boolean;
}

// Camera Sequence types
export interface CameraSequence {
  id: string;
  account_id: string;
  layout_id: string;
  name: string;
  description?: string;
  loop: boolean;
  keyframes: CameraSequenceKeyframe[];
  created_at: string;
  updated_at: string;
}

export interface CameraSequenceKeyframe {
  id: string;
  sequence_id: string;
  preset_id: string;
  preset?: CameraPresetDB;
  order_index: number;
  transition_duration: number;  // seconds
  hold_duration: number;        // seconds
  created_at?: string;
}

// Camera Path types (new grid-based system)
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface CameraCheckpoint {
  id: string;
  path_id: string;
  grid_x: number;
  grid_y: number;
  order_index: number;
  orientation: CompassDirection;
  altitude: number;          // 0-100
  tilt: number;              // -90 to +90 (vertical tilt)
  zoom: number;              // 30 to 120 (FOV)
  transition_duration: number;  // seconds
  hold_duration: number;        // seconds
  created_at?: string;
}

export interface CameraPath {
  id: string;
  account_id: string;
  layout_id: string;
  name: string;
  description?: string;
  loop: boolean;
  checkpoints: CameraCheckpoint[];
  created_at: string;
  updated_at: string;
}

// Camera preset as stored in DB (flat structure)
export interface CameraPresetDB {
  id: string;
  account_id: string;
  layout_id: string;
  name: string;
  position_x: number;
  position_y: number;
  position_z: number;
  rotation_x: number;
  rotation_y: number;
  rotation_z: number;
  fov: number;
  mode: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TRAFFIC CONTROL
// =============================================================================

export type TrafficSpeed = 'slow' | 'normal' | 'fast';

export interface TrafficCommand {
  layout_id: string;
  density?: number;   // 0-100
  speed?: TrafficSpeed;
  enabled?: boolean;
}

export interface TrafficState {
  density: number;
  speed: TrafficSpeed;
  enabled: boolean;
}

// =============================================================================
// POPUP CONTROL
// =============================================================================

export interface PopupCommand {
  layout_id: string;
  command: 'labels' | 'detail' | 'close' | 'close_all';
  building_ids?: string[];  // For "detail" and "close" commands
  enabled?: boolean;        // For "labels" toggle
}

// =============================================================================
// SCENE STATE (flyover & path persistence)
// =============================================================================

export interface SceneStateUpdate {
  scene_id: string;
  data: {
    flyover_enabled: boolean;
    flyover_speed: number;
    active_path_id: string | null;
    layout_id: string;
  };
}

// =============================================================================
// WEBSOCKET MESSAGES (WhookTown format)
// =============================================================================

export type WSEventType = 'ui.layout' | 'ui.layout.delete' | 'sensors' | 'heartbeat' | 'camera' | 'scenes' | 'traffic' | 'popup' | 'scene.state' | 'scene.identify' | 'auth.locked' | 'asset_types' | 'asset_types.update';

export interface WSMessage {
  event: WSEventType;
  data: unknown;
}

// =============================================================================
// AUTH
// =============================================================================

export interface AuthResponse {
  app_token: string;
  validation_pending?: boolean;
  name?: string;
  type?: string;
  roles?: Record<string, string>;
  account_id?: string;
  account?: {
    id: string;
    email: string;
    validated: boolean;
    created_at: string;
  };
  created_at?: string;
  updated_at?: string;
  expired_at?: string;
}

export interface ValidationStatusResponse {
  validated: boolean;
  expired: boolean;
}

export interface AuthRequest {
  email: string;
  type: string;
  name: string;
  app_id?: string;
}
