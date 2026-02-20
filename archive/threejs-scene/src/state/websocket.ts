import { WSMessage, CityLayout, SensorData, CameraState, CameraCommand, TrafficCommand, PopupCommand, SceneStateUpdate } from '../types';
import { store } from './store';
import { authManager } from '../auth/AuthManager';
import { createLogger } from '../utils/logger';

const log = createLogger('WebSocket');

// UUID helper with fallback for HTTP (crypto.randomUUID only works in secure contexts)
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

const SCENE_ID_KEY = 'whooktown_scene_id';
const SCENE_NAME_KEY = 'whooktown_scene_name';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * WebSocket client for WhookTown backend
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private sceneId: string;
  private sceneName: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private currentLayoutId: string | null = null;

  constructor() {
    this.sceneId = this.getOrCreateSceneId();
    this.sceneName = this.getSceneName();
  }

  private getOrCreateSceneId(): string {
    // Use sessionStorage so each browser tab gets a unique scene ID
    // (localStorage would share the same ID across all tabs)
    let id = sessionStorage.getItem(SCENE_ID_KEY);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(SCENE_ID_KEY, id);
    }
    return id;
  }

  private getSceneName(): string {
    return sessionStorage.getItem(SCENE_NAME_KEY) || `Scene-${this.sceneId.slice(0, 6)}`;
  }

  setSceneName(name: string): void {
    this.sceneName = name;
    sessionStorage.setItem(SCENE_NAME_KEY, name);
    // Re-register with new name if connected
    if (this.isConnected()) {
      this.registerScene();
    }
  }

  getSceneId(): string {
    return this.sceneId;
  }

  connect(): void {
    if (!authManager.isAuthenticated()) {
      log.error('Not authenticated');
      return;
    }

    // WebSocket URL - use env var if set, otherwise auto-detect from window.location
    const envWsUrl = import.meta.env.VITE_WS_URL;
    let wsUrl: string;
    if (envWsUrl) {
      wsUrl = envWsUrl;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }
    // Cookie session_token est envoye automatiquement lors du handshake WebSocket

    log.log('Connecting to WebSocket:', wsUrl);
    store.setConnecting(true);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      log.log('WebSocket connected');
      this.reconnectAttempts = 0;
      store.setConnected(true);
      store.setConnecting(false);

      // Register scene with backend
      this.registerScene();

      // Start heartbeat
      this.startHeartbeat();

      // Send an early heartbeat after 2 seconds to catch layout changes
      // (layouts are received via WebSocket after connection, so initial register has empty layout)
      setTimeout(() => {
        if (this.isConnected()) {
          this.sendHeartbeat();
        }
      }, 2000);

      // Fetch initial camera and traffic states
      this.fetchInitialCameraStates();
      this.fetchInitialTrafficStates();
    };

    this.ws.onclose = (event) => {
      log.log('WebSocket closed:', event.code, event.reason);
      store.setConnected(false);
      store.setConnecting(false);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      log.error('WebSocket error:', error);
      store.setError('WebSocket connection error');
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    store.setConnected(false);
  }

  private send(message: { event: string; data: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private registerScene(): void {
    const activeLayout = store.getActiveLayout();
    this.currentLayoutId = activeLayout?.id || null;

    this.send({
      event: 'scene.register',
      data: {
        scene_id: this.sceneId,
        name: this.sceneName,
        layout_id: this.currentLayoutId,
      },
    });

    log.log('Scene registered:', this.sceneId, this.sceneName);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    const activeLayout = store.getActiveLayout();
    const layoutId = activeLayout?.id || null;

    // Check if layout changed
    if (layoutId !== this.currentLayoutId) {
      this.notifyLayoutChange(layoutId);
    }

    this.send({
      event: 'scene.heartbeat',
      data: {
        scene_id: this.sceneId,
        layout_id: layoutId,
      },
    });
  }

  notifyLayoutChange(layoutId: string | null): void {
    if (layoutId === this.currentLayoutId) return;

    this.currentLayoutId = layoutId;
    this.send({
      event: 'scene.layout_change',
      data: {
        scene_id: this.sceneId,
        layout_id: layoutId,
      },
    });

    log.log('Layout change notified:', layoutId);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error('Max reconnect attempts reached');
      store.setError('Unable to connect to server');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (authManager.isAuthenticated()) {
        this.connect();
      }
    }, delay);
  }

  private handleMessage(data: string): void {
    // Debug: log raw data length and first 100 chars
    console.log(`[WS RAW] len=${data.length} preview=${data.substring(0, 100)}`);
    try {
      const message: WSMessage = JSON.parse(data);
      log.log('WS Message:', message.event);

      switch (message.event) {
        case 'ui.layout': {
          const layout = message.data as CityLayout;
          if (layout && layout.id) {
            store.setLayout(layout);
          }
          break;
        }

        case 'ui.layout.delete': {
          const layoutId = message.data as string;
          store.removeLayout(layoutId);
          break;
        }

        case 'sensors': {
          const sensor = message.data as SensorData;
          if (sensor && sensor.id) {
            store.updateSensor(sensor);
          }
          break;
        }

        case 'heartbeat':
          // Ignore heartbeat
          break;

        case 'scenes':
          // Ignore - this event is for admin dashboards (web-ui-next)
          break;

        case 'camera': {
          // Backend sends: {layout_id, data: CameraCommand or legacy {mode, flyover_speed}}
          const wrapper = message.data as { layout_id?: string; data?: CameraCommand | { mode?: string; flyover_speed?: number } };
          const activeLayout = store.getActiveLayout();

          // Only respond if we're displaying the target layout
          if (wrapper?.layout_id && wrapper.layout_id !== activeLayout?.id) {
            log.log('Camera event for different layout, ignoring');
            break;
          }

          const rawData = wrapper?.data;
          if (!rawData) break;

          // Check if this is a new CameraCommand or legacy format
          if ('command' in rawData) {
            // New CameraCommand format
            const cmd = rawData as CameraCommand;
            log.log('Camera command received:', cmd);
            store.setCameraCommand(cmd);
          } else if (rawData.mode) {
            // Legacy format: {mode, flyover_speed}
            const cameraState: CameraState = {
              mode: rawData.mode as CameraState['mode'],
              flyoverSpeed: rawData.flyover_speed,
            };
            log.log('Camera state received:', cameraState);
            store.setCameraState(cameraState);
          }
          break;
        }

        case 'traffic': {
          // Backend sends: {layout_id, data: TrafficCommand}
          const wrapper = message.data as { layout_id?: string; data?: TrafficCommand };
          const activeLayout = store.getActiveLayout();

          // Only respond if we're displaying the target layout
          if (wrapper?.layout_id && wrapper.layout_id !== activeLayout?.id) {
            log.log('Traffic event for different layout, ignoring');
            break;
          }

          const trafficCmd = wrapper?.data;
          if (trafficCmd) {
            log.log('Traffic command received:', trafficCmd);
            store.setTrafficCommand(trafficCmd);
          }
          break;
        }

        case 'popup': {
          // Backend sends: {layout_id, data: PopupCommand}
          const wrapper = message.data as { layout_id?: string; data?: PopupCommand };
          const activeLayout = store.getActiveLayout();

          // Only respond if we're displaying the target layout
          if (wrapper?.layout_id && wrapper.layout_id !== activeLayout?.id) {
            log.log('Popup event for different layout, ignoring');
            break;
          }

          const popupCmd = wrapper?.data;
          if (popupCmd) {
            log.log('Popup command received:', popupCmd);
            store.setPopupCommand(popupCmd);
          }
          break;
        }

        case 'scene.state': {
          // Scene state update from backend (flyover, path settings)
          const stateUpdate = message.data as SceneStateUpdate;
          if (stateUpdate?.scene_id === this.sceneId && stateUpdate?.data) {
            log.log('Scene state received:', stateUpdate.data);
            store.applySceneState(stateUpdate.data);
          }
          break;
        }

        case 'auth.locked': {
          // Account has been locked by admin - force logout
          const lockData = message.data as { reason?: string };
          log.log('Account locked by admin:', lockData?.reason || 'no reason provided');
          store.setError('Your account has been locked');
          this.disconnect();
          // Trigger logout - this will switch to login screen
          authManager.notifyAuthChange(false);
          break;
        }

        case 'asset_types': {
          // Initial state: list of enabled asset types
          const assetTypesData = message.data as { enabled_types?: string[] };
          if (assetTypesData?.enabled_types && Array.isArray(assetTypesData.enabled_types)) {
            log.log('Asset types received:', assetTypesData.enabled_types.length, 'enabled types');
            store.setEnabledAssetTypes(assetTypesData.enabled_types);
          }
          break;
        }

        case 'asset_types.update': {
          // Real-time update: single asset type toggled
          const updateData = message.data as { type_name?: string; enabled?: boolean };
          if (updateData?.type_name && typeof updateData.enabled === 'boolean') {
            log.log('Asset type update:', updateData.type_name, 'enabled:', updateData.enabled);
            store.updateAssetTypeEnabled(updateData.type_name, updateData.enabled);
          }
          break;
        }

        case 'scene.identify': {
          // Scene identification request - trigger firework effect
          const identifyData = message.data as { scene_id?: string };
          if (identifyData?.scene_id === this.sceneId) {
            log.log('Scene identify request received');
            store.triggerIdentify();
          }
          break;
        }

        default:
          log.log('Unknown event:', message.event);
      }
    } catch (error) {
      log.error('Failed to parse WebSocket message:', error);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private async fetchInitialCameraStates(): Promise<void> {
    try {
      const response = await fetch('/camera', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('Failed to fetch camera states:', response.status);
        return;
      }

      const states = await response.json() as Array<{
        layout_id: string;
        mode: string;
        flyover_speed: number;
      }>;

      if (states && states.length > 0) {
        // Use the most recently updated camera state (first in the list)
        const latest = states[0];
        log.log('Restoring camera state:', latest);
        store.setCameraState({
          mode: latest.mode as CameraState['mode'],
          flyoverSpeed: latest.flyover_speed,
        });
      }
    } catch (error) {
      log.error('Error fetching camera states:', error);
    }
  }

  private async fetchInitialTrafficStates(): Promise<void> {
    try {
      const response = await fetch('/ui/traffic', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('Failed to fetch traffic states:', response.status);
        return;
      }

      const states = await response.json() as Array<{
        layout_id: string;
        density: number;
        speed: string;
        enabled: boolean;
        labels_visible: boolean;
      }>;

      if (states && states.length > 0) {
        // Find traffic state for active layout, or use most recent
        const activeLayout = store.getActiveLayout();
        const matching = activeLayout
          ? states.find(s => s.layout_id === activeLayout.id)
          : null;
        const stateToUse = matching || states[0];

        log.log('Restoring traffic state:', stateToUse);
        store.setTrafficCommand({
          layout_id: stateToUse.layout_id,
          density: stateToUse.density,
          speed: stateToUse.speed as TrafficCommand['speed'],
          enabled: stateToUse.enabled,
        });

        // Restore labels visibility state by sending a popup command
        if (stateToUse.labels_visible !== undefined && stateToUse.labels_visible) {
          log.log('Restoring labels visibility:', stateToUse.labels_visible);
          store.setLabelsVisible(stateToUse.labels_visible);
          // Send popup command to actually show the labels
          store.setPopupCommand({
            command: 'labels',
            layout_id: stateToUse.layout_id,
            enabled: stateToUse.labels_visible,
          });
        }
      }
    } catch (error) {
      log.error('Error fetching traffic states:', error);
    }
  }
}

export const wsClient = new WebSocketClient();
