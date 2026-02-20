import './styles.css';
import { uiManager } from './ui';
import { authManager } from './auth/AuthManager';
import { wsClient } from './state/websocket';
import { store } from './state/store';
import { SceneManager } from './scene';
import { Building } from './types';
import { createLogger } from './utils/logger';

const log = createLogger('Main');

let sceneManager: SceneManager | null = null;
let currentLayoutId: string | null = null;
let currentBuildingSnapshots: Map<string, string> = new Map();
let currentRoadsHash: string | null = null;
let storeUnsubscribe: (() => void) | null = null;

/**
 * Create a snapshot string from a building for change detection
 * Includes position, orientation, type, name, and metadata
 */
function buildingSnapshot(building: Building): string {
  return JSON.stringify({
    x: building.location.x,
    y: building.location.y,
    orientation: building.orientation || 'N',
    type: building.type,
    name: building.name || '',
    description: building.description || '',
    tags: building.tags || [],
    notes: building.notes || '',
  });
}

/**
 * Create a simple hash from roads array for change detection
 */
function hashRoads(roads: string[] | undefined): string {
  return roads ? roads.join('|') : '';
}

/**
 * Verify authentication is still valid with the server
 * Returns false if account is locked or token revoked
 */
async function verifyAuth(): Promise<boolean> {
  try {
    const response = await fetch('/ui/layouts', {
      method: 'GET',
      credentials: 'include',
      headers: authManager.getAuthHeaders(),
    });

    if (response.status === 401 || response.status === 403) {
      log.log('Auth verification failed: account locked or token revoked');
      return false;
    }

    return response.ok;
  } catch (error) {
    log.error('Auth verification error:', error);
    return false;
  }
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  log.log('WhookTown Three.js Viewer starting...');

  // Initialize UI
  uiManager.init();

  // Watch for auth changes
  authManager.onAuthChange((authenticated) => {
    if (authenticated) {
      startApp();
    } else {
      stopApp();
    }
  });

  // Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const exchangeCode = urlParams.get('code');
  const layoutParam = urlParams.get('layout');

  // If a layout ID is specified in URL, save it to sessionStorage for the store to pick up
  if (layoutParam) {
    log.log('Layout specified in URL:', layoutParam);
    try {
      sessionStorage.setItem('whooktown_active_layout_id', layoutParam);
    } catch {
      // Ignore sessionStorage errors
    }
  }

  // Clean URL to prevent leaking exchange code via bookmarks/history
  if (exchangeCode || layoutParam) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // Redeem exchange code (SSO from web-ui-next)
  if (exchangeCode) {
    try {
      log.log('Redeeming exchange code...');
      await authManager.redeemExchangeCode(exchangeCode);
      // onAuthChange listener will call startApp()
      return;
    } catch (error) {
      log.error('Exchange code redemption failed:', error);
      // Fall through to normal auth check
    }
  }

  // If already authenticated, verify with server before starting
  if (authManager.isAuthenticated()) {
    verifyAuth().then((valid) => {
      if (valid) {
        startApp();
      } else {
        // Auth is no longer valid - clear cookies by notifying logout
        log.log('Auth invalid on load, forcing logout');
        authManager.notifyAuthChange(false);
      }
    });
  }
}

/**
 * Initialize the full scene
 */
function initializeScene(): void {
  log.log('Initializing scene...');

  // Initialize scene
  const container = uiManager.getSceneContainer();
  if (container && !sceneManager) {
    sceneManager = new SceneManager('scene-container');
    // Connect UIManager to SceneManager for labels toggle
    uiManager.setSceneManager(sceneManager);
  }

  // Connect WebSocket
  wsClient.connect();

  // Subscribe to store updates
  subscribeToStore();
}

/**
 * Start the application after authentication
 */
function startApp(): void {
  log.log('Starting application...');

  // Initialize scene directly
  initializeScene();
}

/**
 * Subscribe to store updates (called from initializeScene)
 */
function subscribeToStore(): void {
  // Unsubscribe from previous subscription if any (prevents duplicate listeners)
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }

  // Subscribe to store updates
  storeUnsubscribe = store.subscribe(() => {
    const layout = store.getActiveLayout();

    if (layout && sceneManager) {
      // Full reload if layout ID changed
      if (layout.id !== currentLayoutId) {
        currentLayoutId = layout.id;
        currentBuildingSnapshots = new Map(
          layout.buildings.map(b => [b.id, buildingSnapshot(b)])
        );
        currentRoadsHash = hashRoads(layout.roads);
        sceneManager.loadLayout(layout);

        // Restore labels visibility after layout is loaded
        if (store.getLabelsVisible()) {
          log.log('Restoring labels visibility after layout load');
          sceneManager.handlePopupCommand({
            command: 'labels',
            layout_id: layout.id,
            enabled: true,
          });
        }
      } else {
        // Incremental update for same layout - handle added/removed/updated buildings
        const newBuildingSnapshots = new Map<string, string>();

        // Process all buildings in the new layout
        for (const building of layout.buildings) {
          const newSnapshot = buildingSnapshot(building);
          newBuildingSnapshots.set(building.id, newSnapshot);

          const oldSnapshot = currentBuildingSnapshots.get(building.id);
          if (!oldSnapshot) {
            // New building - add with animation
            sceneManager.addBuilding(building);
          } else if (oldSnapshot !== newSnapshot) {
            // Existing building changed - update position/orientation
            sceneManager.updateBuilding(building);
          }
          // If snapshots match, no action needed
        }

        // Remove deleted buildings with animation
        for (const oldId of currentBuildingSnapshots.keys()) {
          if (!newBuildingSnapshots.has(oldId)) {
            sceneManager.removeBuilding(oldId);
          }
        }

        currentBuildingSnapshots = newBuildingSnapshots;

        // Check for road changes
        const newRoadsHash = hashRoads(layout.roads);
        if (newRoadsHash !== currentRoadsHash) {
          sceneManager.updateRoads(layout.roads);
          currentRoadsHash = newRoadsHash;
        }
      }
    }

    // Update building states
    if (sceneManager) {
      const states = store.getAllBuildingStates();
      states.forEach((state, buildingId) => {
        sceneManager!.updateBuildingState(
          buildingId,
          state.status,
          state.activity,
          state.quantity,
          state.amount,
          state.ringCount,
          state.text1,
          state.text2,
          state.text3,
          state.towerText,
          state.towerBText,
          state.dancerEnabled,
          state.faceRotationEnabled,
          // Arcade-specific
          state.musicEnabled,
          state.signText,
          // DataCenter-specific
          state.cpuUsage,
          state.ramUsage,
          state.networkTraffic,
          state.activeConnections,
          state.temperature,
          state.alertLevel,
          // MonitorTube-specific
          state.bandCount,
          state.bands
        );
      });

      // Update camera state if changed
      if (store.hasCameraStateChanged()) {
        const cameraState = store.getCameraState();
        sceneManager!.setCameraState(cameraState);
        store.clearCameraStateChanged();
      }

      // Handle camera commands (from remote control)
      if (store.hasCameraCommandChanged()) {
        const cmd = store.getCameraCommand();
        // Clear BEFORE processing to prevent re-entry
        store.clearCameraCommand();
        if (cmd) {
          log.log('Processing camera command:', cmd);
          sceneManager!.handleCameraCommand(cmd);
        }
      }

      // Handle traffic commands (from remote control)
      if (store.hasTrafficCommandChanged()) {
        const cmd = store.getTrafficCommand();
        // Clear BEFORE processing to prevent re-entry
        store.clearTrafficCommand();
        if (cmd) {
          log.log('Processing traffic command:', cmd);
          sceneManager!.handleTrafficCommand(cmd);
        }
      }

      // Handle popup commands (from remote control)
      if (store.hasPopupCommandChanged()) {
        const cmd = store.getPopupCommand();
        // Clear BEFORE processing to prevent re-entry (handlePopupCommand may call store.notify())
        store.clearPopupCommand();
        if (cmd) {
          log.log('Processing popup command:', cmd);
          sceneManager!.handlePopupCommand(cmd);
        }
      }

      // Handle asset type visibility changes (from backoffice)
      if (store.hasEnabledAssetTypesChanged()) {
        const enabledTypes = store.getEnabledAssetTypes();
        store.clearEnabledAssetTypesChanged();
        log.log('Updating asset type visibility, enabled types:', enabledTypes.size);
        sceneManager!.updateAssetTypeVisibility(enabledTypes);
      }

      // Handle scene identification request (firework effect)
      if (store.shouldTriggerIdentify()) {
        store.clearIdentifyTrigger();
        log.log('Triggering scene identify effect');
        sceneManager!.triggerIdentifyEffect();
      }
    }
  });
}

/**
 * Stop the application on logout
 */
function stopApp(): void {
  log.log('Stopping application...');

  // Unsubscribe from store updates
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }

  wsClient.disconnect();

  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null;
  }

  currentLayoutId = null;
  currentBuildingSnapshots.clear();
  currentRoadsHash = null;
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
