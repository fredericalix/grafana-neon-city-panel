import { CityLayout, SensorData, BuildingState, CameraState, CameraMode, CameraCommand, TrafficState, TrafficCommand, PopupCommand, CameraPath } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('Store');

type Listener = () => void;

// SessionStorage key for persisting active layout (per-tab, cleared on new session)
const ACTIVE_LAYOUT_KEY = 'whooktown_active_layout_id';

/**
 * Simple reactive store for application state
 */
class Store {
  // Connection state
  private connected = false;
  private connecting = false;
  private error: string | null = null;

  // City data
  private layouts: Map<string, CityLayout> = new Map();
  private activeLayoutId: string | null = this.loadSavedLayoutId();
  private buildingStates: Map<string, BuildingState> = new Map();

  /**
   * Load saved layout ID from sessionStorage
   */
  private loadSavedLayoutId(): string | null {
    try {
      return sessionStorage.getItem(ACTIVE_LAYOUT_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Save layout ID to sessionStorage
   */
  private saveLayoutId(layoutId: string | null): void {
    try {
      if (layoutId) {
        sessionStorage.setItem(ACTIVE_LAYOUT_KEY, layoutId);
      } else {
        sessionStorage.removeItem(ACTIVE_LAYOUT_KEY);
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }

  // Camera state
  private cameraState: CameraState = { mode: 'orbit' };
  private cameraStateChanged = false;
  private cameraCommand: CameraCommand | null = null;
  private cameraCommandChanged = false;

  // Traffic state
  private trafficState: TrafficState = { density: 50, speed: 'normal', enabled: true };
  private trafficCommand: TrafficCommand | null = null;
  private trafficCommandChanged = false;

  // Popup state
  private popupCommand: PopupCommand | null = null;
  private popupCommandChanged = false;
  private labelsVisible = false;

  // Asset type filtering
  private enabledAssetTypes: Set<string> = new Set();
  private enabledAssetTypesChanged = false;

  // Listeners
  private listeners: Set<Listener> = new Set();

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION
  // ---------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ---------------------------------------------------------------------------
  // CONNECTION STATE
  // ---------------------------------------------------------------------------

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.notify();
  }

  setConnecting(connecting: boolean): void {
    this.connecting = connecting;
    this.notify();
  }

  setError(error: string | null): void {
    this.error = error;
    this.notify();
  }

  isConnected(): boolean {
    return this.connected;
  }

  isConnecting(): boolean {
    return this.connecting;
  }

  getError(): string | null {
    return this.error;
  }

  // ---------------------------------------------------------------------------
  // LAYOUT MANAGEMENT
  // ---------------------------------------------------------------------------

  setLayout(layout: CityLayout): void {
    this.layouts.set(layout.id, layout);

    // If we have a saved layout ID and this is that layout, select it
    // Otherwise, auto-select first layout if none selected
    if (!this.activeLayoutId) {
      const savedLayoutId = this.loadSavedLayoutId();
      if (savedLayoutId && layout.id === savedLayoutId) {
        this.activeLayoutId = savedLayoutId;
      } else if (!savedLayoutId) {
        this.activeLayoutId = layout.id;
        this.saveLayoutId(layout.id);
      }
    } else if (this.activeLayoutId === layout.id) {
      // This is the active layout being updated, keep it selected
    }

    // If saved layout exists and we just received it, activate it
    const savedLayoutId = this.loadSavedLayoutId();
    if (savedLayoutId && layout.id === savedLayoutId && this.activeLayoutId !== savedLayoutId) {
      this.activeLayoutId = savedLayoutId;
    }

    // Fallback: if activeLayoutId is set but doesn't exist in layouts (stale from another account),
    // auto-select the first available layout
    if (this.activeLayoutId && !this.layouts.has(this.activeLayoutId)) {
      this.activeLayoutId = layout.id;
      this.saveLayoutId(layout.id);
    }

    // Initialize building states for new buildings
    for (const building of layout.buildings) {
      if (!this.buildingStates.has(building.id)) {
        this.buildingStates.set(building.id, {
          id: building.id,
          status: 'online',
          activity: 'normal',
        });
      }
    }

    this.notify();
  }

  removeLayout(layoutId: string): void {
    this.layouts.delete(layoutId);
    if (this.activeLayoutId === layoutId) {
      this.activeLayoutId = this.layouts.keys().next().value || null;
      this.saveLayoutId(this.activeLayoutId);
    }
    this.notify();
  }

  getLayouts(): CityLayout[] {
    return Array.from(this.layouts.values());
  }

  getActiveLayout(): CityLayout | null {
    if (!this.activeLayoutId) return null;
    return this.layouts.get(this.activeLayoutId) || null;
  }

  setActiveLayout(layoutId: string): void {
    if (this.layouts.has(layoutId)) {
      this.activeLayoutId = layoutId;
      this.saveLayoutId(layoutId);
      this.notify();
    }
  }

  // ---------------------------------------------------------------------------
  // SENSOR / BUILDING STATE
  // ---------------------------------------------------------------------------

  updateSensor(sensor: SensorData): void {
    const existing = this.buildingStates.get(sensor.id);
    const newState: BuildingState = {
      id: sensor.id,
      status: sensor.status || existing?.status || 'online',
      activity: sensor.activity || existing?.activity || 'normal',
    };

    // Handle bank-specific properties
    if (sensor.quantity !== undefined) {
      newState.quantity = sensor.quantity;
    } else if (existing?.quantity !== undefined) {
      newState.quantity = existing.quantity;
    }

    if (sensor.amount !== undefined) {
      newState.amount = sensor.amount;
    } else if (existing?.amount !== undefined) {
      newState.amount = existing.amount;
    }

    // Handle display_a-specific properties
    if (sensor.ringCount !== undefined) {
      newState.ringCount = sensor.ringCount;
    } else if (existing?.ringCount !== undefined) {
      newState.ringCount = existing.ringCount;
    }

    if (sensor.text1 !== undefined) {
      newState.text1 = sensor.text1;
    } else if (existing?.text1 !== undefined) {
      newState.text1 = existing.text1;
    }

    if (sensor.text2 !== undefined) {
      newState.text2 = sensor.text2;
    } else if (existing?.text2 !== undefined) {
      newState.text2 = existing.text2;
    }

    if (sensor.text3 !== undefined) {
      newState.text3 = sensor.text3;
    } else if (existing?.text3 !== undefined) {
      newState.text3 = existing.text3;
    }

    // Handle tower_a-specific properties
    if (sensor.towerText !== undefined) {
      newState.towerText = sensor.towerText;
    } else if (existing?.towerText !== undefined) {
      newState.towerText = existing.towerText;
    }

    // Handle tower_b-specific properties
    if (sensor.towerBText !== undefined) {
      newState.towerBText = sensor.towerBText;
    } else if (existing?.towerBText !== undefined) {
      newState.towerBText = existing.towerBText;
    }

    if (sensor.dancerEnabled !== undefined) {
      newState.dancerEnabled = sensor.dancerEnabled;
    } else if (existing?.dancerEnabled !== undefined) {
      newState.dancerEnabled = existing.dancerEnabled;
    }

    // Handle supervisor-specific properties
    if (sensor.faceRotationEnabled !== undefined) {
      newState.faceRotationEnabled = sensor.faceRotationEnabled;
    } else if (existing?.faceRotationEnabled !== undefined) {
      newState.faceRotationEnabled = existing.faceRotationEnabled;
    }

    // Handle arcade-specific properties
    if (sensor.musicEnabled !== undefined) {
      newState.musicEnabled = sensor.musicEnabled;
    } else if (existing?.musicEnabled !== undefined) {
      newState.musicEnabled = existing.musicEnabled;
    }

    if (sensor.signText !== undefined) {
      newState.signText = sensor.signText;
    } else if (existing?.signText !== undefined) {
      newState.signText = existing.signText;
    }

    // Handle data_center-specific properties
    if (sensor.cpuUsage !== undefined) {
      newState.cpuUsage = sensor.cpuUsage;
    } else if (existing?.cpuUsage !== undefined) {
      newState.cpuUsage = existing.cpuUsage;
    }

    if (sensor.ramUsage !== undefined) {
      newState.ramUsage = sensor.ramUsage;
    } else if (existing?.ramUsage !== undefined) {
      newState.ramUsage = existing.ramUsage;
    }

    if (sensor.networkTraffic !== undefined) {
      newState.networkTraffic = sensor.networkTraffic;
    } else if (existing?.networkTraffic !== undefined) {
      newState.networkTraffic = existing.networkTraffic;
    }

    if (sensor.activeConnections !== undefined) {
      newState.activeConnections = sensor.activeConnections;
    } else if (existing?.activeConnections !== undefined) {
      newState.activeConnections = existing.activeConnections;
    }

    if (sensor.temperature !== undefined) {
      newState.temperature = sensor.temperature;
    } else if (existing?.temperature !== undefined) {
      newState.temperature = existing.temperature;
    }

    if (sensor.alertLevel !== undefined) {
      newState.alertLevel = sensor.alertLevel;
    } else if (existing?.alertLevel !== undefined) {
      newState.alertLevel = existing.alertLevel;
    }

    // Handle monitor_tube-specific properties
    if (sensor.bandCount !== undefined) {
      newState.bandCount = sensor.bandCount;
    } else if (existing?.bandCount !== undefined) {
      newState.bandCount = existing.bandCount;
    }

    if (sensor.bands !== undefined) {
      newState.bands = sensor.bands;
    } else if (existing?.bands !== undefined) {
      newState.bands = existing.bands;
    }

    this.buildingStates.set(sensor.id, newState);
    this.notify();
  }

  getBuildingState(buildingId: string): BuildingState | null {
    return this.buildingStates.get(buildingId) || null;
  }

  getAllBuildingStates(): Map<string, BuildingState> {
    return this.buildingStates;
  }

  // ---------------------------------------------------------------------------
  // CAMERA STATE
  // ---------------------------------------------------------------------------

  setCameraState(state: CameraState): void {
    this.cameraState = { ...this.cameraState, ...state };
    this.cameraStateChanged = true;
    this.notify();
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraState.mode = mode;
    this.cameraStateChanged = true;
    this.notify();
  }

  setFlyoverSpeed(speed: number): void {
    this.cameraState.flyoverSpeed = speed;
    this.cameraStateChanged = true;
    this.notify();
  }

  getCameraState(): CameraState {
    return this.cameraState;
  }

  hasCameraStateChanged(): boolean {
    return this.cameraStateChanged;
  }

  clearCameraStateChanged(): void {
    this.cameraStateChanged = false;
  }

  // ---------------------------------------------------------------------------
  // CAMERA COMMANDS
  // ---------------------------------------------------------------------------

  setCameraCommand(command: CameraCommand): void {
    this.cameraCommand = command;
    this.cameraCommandChanged = true;
    this.notify();
  }

  getCameraCommand(): CameraCommand | null {
    return this.cameraCommand;
  }

  hasCameraCommandChanged(): boolean {
    return this.cameraCommandChanged;
  }

  clearCameraCommand(): void {
    this.cameraCommand = null;
    this.cameraCommandChanged = false;
  }

  // ---------------------------------------------------------------------------
  // TRAFFIC STATE & COMMANDS
  // ---------------------------------------------------------------------------

  setTrafficState(state: Partial<TrafficState>): void {
    this.trafficState = { ...this.trafficState, ...state };
    this.notify();
  }

  getTrafficState(): TrafficState {
    return this.trafficState;
  }

  setTrafficCommand(command: TrafficCommand): void {
    this.trafficCommand = command;
    this.trafficCommandChanged = true;
    this.notify();
  }

  getTrafficCommand(): TrafficCommand | null {
    return this.trafficCommand;
  }

  hasTrafficCommandChanged(): boolean {
    return this.trafficCommandChanged;
  }

  clearTrafficCommand(): void {
    this.trafficCommand = null;
    this.trafficCommandChanged = false;
  }

  // ---------------------------------------------------------------------------
  // POPUP STATE & COMMANDS
  // ---------------------------------------------------------------------------

  setPopupCommand(command: PopupCommand): void {
    this.popupCommand = command;
    this.popupCommandChanged = true;
    this.notify();
  }

  getPopupCommand(): PopupCommand | null {
    return this.popupCommand;
  }

  hasPopupCommandChanged(): boolean {
    return this.popupCommandChanged;
  }

  clearPopupCommand(): void {
    this.popupCommand = null;
    this.popupCommandChanged = false;
  }

  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    this.notify();
  }

  getLabelsVisible(): boolean {
    return this.labelsVisible;
  }

  // ---------------------------------------------------------------------------
  // ASSET TYPE FILTERING
  // ---------------------------------------------------------------------------

  /**
   * Set all enabled asset types (initial state from WebSocket)
   */
  setEnabledAssetTypes(types: string[]): void {
    this.enabledAssetTypes = new Set(types);
    this.enabledAssetTypesChanged = true;
    this.notify();
  }

  /**
   * Update a single asset type enabled state (real-time update)
   */
  updateAssetTypeEnabled(typeName: string, enabled: boolean): void {
    if (enabled) {
      this.enabledAssetTypes.add(typeName);
    } else {
      this.enabledAssetTypes.delete(typeName);
    }
    this.enabledAssetTypesChanged = true;
    this.notify();
  }

  /**
   * Check if an asset type is enabled
   */
  isAssetTypeEnabled(typeName: string): boolean {
    // If no types are loaded yet (empty set), show all
    if (this.enabledAssetTypes.size === 0) return true;
    return this.enabledAssetTypes.has(typeName);
  }

  /**
   * Get all enabled asset types
   */
  getEnabledAssetTypes(): Set<string> {
    return this.enabledAssetTypes;
  }

  /**
   * Check if enabled asset types changed
   */
  hasEnabledAssetTypesChanged(): boolean {
    return this.enabledAssetTypesChanged;
  }

  /**
   * Clear enabled asset types changed flag
   */
  clearEnabledAssetTypesChanged(): void {
    this.enabledAssetTypesChanged = false;
  }

  // ---------------------------------------------------------------------------
  // SCENE STATE (flyover & path persistence)
  // ---------------------------------------------------------------------------

  /**
   * Apply scene state received from backend
   * This handles flyover and path auto-play on scene reload
   */
  applySceneState(state: {
    flyover_enabled?: boolean;
    flyover_speed?: number;
    active_path_id?: string | null;
    layout_id: string;
    path?: CameraPath;
  }): void {
    // Check if this state is for our active layout
    const activeLayout = this.getActiveLayout();
    if (activeLayout && activeLayout.id !== state.layout_id) {
      log.log('Scene state for different layout, ignoring');
      return;
    }

    // Flyover and path are mutually exclusive
    if (state.flyover_enabled) {
      const isAlreadyInFlyover = this.cameraState.mode === 'flyover';
      const newSpeed = state.flyover_speed || 2.0;
      const speedChanged = this.cameraState.flyoverSpeed !== newSpeed;

      if (isAlreadyInFlyover && speedChanged) {
        // Already in flyover - just update speed without mode transition
        log.log('Updating flyover speed:', newSpeed);
        this.setFlyoverSpeed(newSpeed);
      } else if (!isAlreadyInFlyover) {
        // Switch to flyover mode
        log.log('Applying flyover mode with speed:', newSpeed);
        this.setCameraState({
          mode: 'flyover',
          flyoverSpeed: newSpeed,
        });
      }
      // If already in flyover and speed hasn't changed, do nothing
    } else if (state.active_path_id) {
      log.log('Applying active path:', state.active_path_id);
      if (state.path) {
        // Use inline path (no fetch needed)
        log.log('Using inline path object');
        const command: CameraCommand = {
          command: 'path',
          layout_id: state.layout_id,
          action: 'play',
          path: state.path,
        };
        this.setCameraCommand(command);
      } else {
        // Fallback: fetch path from API
        this.fetchAndPlayPath(state.active_path_id, state.layout_id);
      }
    }
  }

  /**
   * Fetch a path from the API and trigger playback
   */
  private async fetchAndPlayPath(pathId: string, layoutId: string): Promise<void> {
    try {
      const { authManager } = await import('../auth/AuthManager');
      const response = await fetch(`/ui/paths/${layoutId}/${pathId}`, {
        method: 'GET',
        credentials: 'include',
        headers: authManager.getAuthHeaders(),
      });

      if (!response.ok) {
        log.warn('Failed to fetch path:', response.status);
        return;
      }

      const path = await response.json() as CameraPath;
      if (path && path.checkpoints && path.checkpoints.length > 0) {
        log.log('Playing path:', path.name, 'with', path.checkpoints.length, 'checkpoints');
        // Create a camera command to play the path
        const command: CameraCommand = {
          command: 'path',
          layout_id: layoutId,
          action: 'play',
          path: path,
        };
        this.setCameraCommand(command);
      }
    } catch (error) {
      log.error('Error fetching path:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // SCENE IDENTIFICATION
  // ---------------------------------------------------------------------------

  private identifyTriggered = false;

  /**
   * Trigger the scene identification effect (fireworks)
   */
  triggerIdentify(): void {
    log.log('Scene identify triggered');
    this.identifyTriggered = true;
    this.notify();
  }

  /**
   * Check if identify effect should be triggered
   */
  shouldTriggerIdentify(): boolean {
    return this.identifyTriggered;
  }

  /**
   * Clear identify trigger flag
   */
  clearIdentifyTrigger(): void {
    this.identifyTriggered = false;
  }

  // ---------------------------------------------------------------------------
  // RESET (for logout)
  // ---------------------------------------------------------------------------

  /**
   * Reset all state on logout to prevent data leakage between accounts
   */
  reset(): void {
    this.connected = false;
    this.connecting = false;
    this.error = null;
    this.layouts.clear();
    this.activeLayoutId = null;
    this.buildingStates.clear();
    this.cameraState = { mode: 'orbit' };
    this.cameraStateChanged = false;
    this.cameraCommand = null;
    this.cameraCommandChanged = false;
    this.trafficState = { density: 50, speed: 'normal', enabled: true };
    this.trafficCommand = null;
    this.trafficCommandChanged = false;
    this.popupCommand = null;
    this.popupCommandChanged = false;
    this.labelsVisible = false;
    this.enabledAssetTypes = new Set();
    this.enabledAssetTypesChanged = false;
    // Clear all persisted data
    try {
      sessionStorage.removeItem(ACTIVE_LAYOUT_KEY);
      // Clear scene identity to force re-registration on next login
      sessionStorage.removeItem('whooktown_scene_id');
      sessionStorage.removeItem('whooktown_scene_name');
    } catch {
      // Ignore sessionStorage errors
    }
    this.notify();
  }
}

export const store = new Store();
