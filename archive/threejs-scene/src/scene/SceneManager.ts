import * as THREE from 'three';
import { CityLayout, Building, BuildingStatus, BuildingActivity, BankQuantity, DisplayRingCount, CameraCommand, BuildingState, CameraPath, CompassDirection, CameraSequence, CameraSequenceKeyframe, PopupCommand } from '../types';
import { store } from '../state/store';
import { CameraController, CameraMode, CameraState } from './CameraController';
import { BasePrefab, createPrefab, COLORS } from './prefabs';
import { BankPrefab } from './prefabs/Bank';
import { DisplayAPrefab } from './prefabs/DisplayA';
import { TowerAPrefab } from './prefabs/TowerA';
import { TowerBPrefab } from './prefabs/TowerB';
import { SupervisorPrefab } from './prefabs/Supervisor';
import { ArcadePrefab } from './prefabs/Arcade';
import { DataCenterPrefab, DataCenterMetrics } from './prefabs/DataCenter';
import { MonitorTubePrefab, MonitorTubeMetrics } from './prefabs/MonitorTube';
import { TrafficManager, TrafficSpeed } from './traffic';
import { FireworkManager } from './effects';
import { InteractionManager } from './InteractionManager';
import { TooltipManager } from '../ui/TooltipManager';
import { LabelManager } from '../ui/LabelManager';
import { createLogger } from '../utils/logger';

const log = createLogger('SceneManager');

// Road animation interfaces
interface RoadCellInfo {
  surfaceMesh: THREE.Mesh;
  wireframeMesh: THREE.LineSegments;
  edgeLines: THREE.Line[];
  markingMesh?: THREE.Mesh;
  originalSurfaceColor: THREE.Color;
  worldX: number;
}

interface RoadAnimationState {
  isConstructing: boolean;
  isDeconstructing: boolean;
  progress: number;
  animTime: number;
  minX: number;
  maxX: number;
  cellInfos: RoadCellInfo[];
  resolveCallback?: () => void;
}

// Holographic red color for road construction
const ROAD_HOLO_RED = 0xcc0033;

/**
 * Manages the Three.js scene for WhookTown visualization
 */
export class SceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: CameraController;

  private buildingPrefabs: Map<string, BasePrefab> = new Map();
  private animatingPrefabs: Set<BasePrefab> = new Set(); // Prefabs being constructed/deconstructed
  private gridHelper: THREE.GridHelper | null = null;
  private groundPlane: THREE.Mesh | null = null;
  private groundGlow: THREE.Mesh | null = null;
  private groundNeonGrid: THREE.LineSegments | null = null;
  private roadMeshes: THREE.Object3D[] = [];
  private neonLines: THREE.Line[] = [];
  private neonPulseTime = 0;
  private roadWireframeMeshes: THREE.LineSegments[] = [];
  private roadAnimationState: RoadAnimationState | null = null;

  // Traffic system
  private trafficManager: TrafficManager;

  // Firework effect for scene identification
  private fireworkManager: FireworkManager;

  // Interaction and UI systems
  private interactionManager: InteractionManager | null = null;
  private tooltipManager: TooltipManager | null = null;
  private labelManager: LabelManager | null = null;
  private buildingStates: Map<string, BuildingState> = new Map();

  // Intro animation state
  private isPlayingIntroAnimation = false;
  private introAnimationPhase: 'dark' | 'grid' | 'dawn' | 'roads' | 'buildings' | 'complete' = 'complete';
  private introAnimTime = 0;
  private originalLightIntensities: Map<THREE.Light, number> = new Map();
  private horizonGlowMesh: THREE.Mesh | null = null;
  private gridFlashMeshes: THREE.Mesh[] = [];
  private pendingLayout: CityLayout | null = null;
  private introBuildingsReady = false;
  private introRoadsReady = false;

  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element not found: ${containerId}`);
    }
    this.container = container;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(COLORS.ground); // Cyberpunk dark background
    container.appendChild(this.renderer.domElement);

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(COLORS.ground, 20, 60);

    // Create traffic manager
    this.trafficManager = new TrafficManager(this.scene);

    // Create firework manager for scene identification
    this.fireworkManager = new FireworkManager(this.scene);

    // Create camera controller
    this.cameraController = new CameraController(this.container);

    // Setup lighting
    this.setupLighting();

    // Setup interaction and UI systems
    this.setupInteractionSystems();

    // Setup resize handler
    window.addEventListener('resize', this.onResize.bind(this));

    // Start render loop
    this.animate();
  }

  private setupInteractionSystems(): void {
    const camera = this.cameraController.getCamera();
    const canvas = this.renderer.domElement;

    // Create tooltip manager
    this.tooltipManager = new TooltipManager(this.container, camera, canvas);

    // Create label manager
    this.labelManager = new LabelManager(this.container, camera, canvas);

    // Create interaction manager
    this.interactionManager = new InteractionManager(
      camera,
      this.scene,
      canvas,
      this.buildingPrefabs
    );

    // Setup interaction callbacks
    this.interactionManager.setCallbacks({
      onHover: (building, _prefab, position) => {
        if (building && position) {
          const state = this.buildingStates.get(building.id) || null;
          this.tooltipManager?.showHoverTooltip(building, state, position);
        } else {
          this.tooltipManager?.hideHoverTooltip();
        }
      },
      // LEFT click = focus camera on building only
      onSelect: (building, prefab, _position) => {
        if (building && prefab) {
          const focusPoint = prefab.getFocusPoint();
          const boundingRadius = prefab.getBoundingRadius();
          const orientation = building.orientation;
          this.cameraController.focusOnBuilding(focusPoint, boundingRadius, orientation, 1.2);
        }
      },
      // RIGHT click = toggle popup only
      onPopupToggle: (building, prefab, position) => {
        if (building && position && prefab) {
          // Toggle: if popup open for this building, close it; else open it
          if (this.tooltipManager?.isDetailVisibleForBuilding(building.id)) {
            this.tooltipManager?.hideDetailTooltip(building.id);
          } else {
            const state = this.buildingStates.get(building.id) || null;
            this.tooltipManager?.showDetailTooltip(building, state, position);
          }
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Get the camera for external use
   */
  getCamera(): THREE.Camera {
    return this.cameraController.getCamera();
  }

  loadLayout(layout: CityLayout): void {
    this.clearLayout();

    // Store layout for intro animation
    this.pendingLayout = layout;

    // Dim all lights before creating anything
    this.dimAllLights();

    // Set fog to black initially
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setHex(0x000000);
    }

    // Create ground and grid (grid starts invisible for matrix animation)
    this.createGround(layout.grid.width, layout.grid.height);
    this.createGridForIntro(layout.grid.width, layout.grid.height);

    // Create roads but keep them invisible
    if (layout.roads) {
      this.createRoadsHidden(layout.roads);
      // Generate flyover path from roads for camera
      this.cameraController.generatePathFromRoads(layout.roads);
      // Initialize traffic system with roads
      this.trafficManager.setRoads(layout.roads);
    }

    // Create buildings but keep them invisible
    for (const building of layout.buildings) {
      this.addBuildingHidden(building);
    }

    // Update labels with new buildings
    this.labelManager?.setBuildings(this.buildingPrefabs);

    // Center camera
    this.cameraController.centerOnGrid(layout.grid.width, layout.grid.height);

    // Start cinematic intro animation
    this.playIntroAnimation();
  }

  clearLayout(): void {
    // Remove all building prefabs
    for (const prefab of this.buildingPrefabs.values()) {
      this.scene.remove(prefab.getObject());
      prefab.dispose();
    }
    this.buildingPrefabs.clear();

    // Also clear animating prefabs
    for (const prefab of this.animatingPrefabs) {
      this.scene.remove(prefab.getObject());
      prefab.dispose();
    }
    this.animatingPrefabs.clear();

    // Remove roads
    for (const road of this.roadMeshes) {
      this.scene.remove(road);
      if (road instanceof THREE.Mesh) {
        road.geometry.dispose();
        (road.material as THREE.Material).dispose();
      }
    }
    this.roadMeshes = [];

    // Remove neon lines
    for (const line of this.neonLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.neonLines = [];

    // Remove ground and grid
    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry.dispose();
      (this.groundPlane.material as THREE.Material).dispose();
      this.groundPlane = null;
    }

    if (this.groundGlow) {
      this.scene.remove(this.groundGlow);
      this.groundGlow.geometry.dispose();
      (this.groundGlow.material as THREE.Material).dispose();
      this.groundGlow = null;
    }

    if (this.groundNeonGrid) {
      this.scene.remove(this.groundNeonGrid);
      this.groundNeonGrid.geometry.dispose();
      (this.groundNeonGrid.material as THREE.Material).dispose();
      this.groundNeonGrid = null;
    }

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper = null;
    }

    // Clear building states and labels
    this.buildingStates.clear();
    this.labelManager?.setBuildings(this.buildingPrefabs);
  }

  // ---------------------------------------------------------------------------
  // LABELS API
  // ---------------------------------------------------------------------------

  /**
   * Toggle floating labels visibility
   */
  toggleLabels(): void {
    this.labelManager?.toggle();
  }

  /**
   * Set floating labels visibility
   */
  setLabelsVisible(visible: boolean): void {
    this.labelManager?.setVisible(visible);
  }

  /**
   * Check if labels are visible
   */
  isLabelsVisible(): boolean {
    return this.labelManager?.isVisible() ?? false;
  }

  // ---------------------------------------------------------------------------
  // BUILDING STATE API
  // ---------------------------------------------------------------------------

  updateBuildingState(
    buildingId: string,
    status: BuildingStatus,
    activity: BuildingActivity,
    quantity?: BankQuantity,
    amount?: number | null,
    ringCount?: DisplayRingCount,
    text1?: string,
    text2?: string,
    text3?: string,
    towerText?: string,
    towerBText?: string,
    dancerEnabled?: boolean,
    faceRotationEnabled?: boolean,
    // Arcade-specific
    musicEnabled?: boolean,
    signText?: string,
    // DataCenter-specific
    cpuUsage?: number,
    ramUsage?: number,
    networkTraffic?: number,
    activeConnections?: number,
    temperature?: number,
    alertLevel?: 'normal' | 'warning' | 'critical',
    // MonitorTube-specific
    bandCount?: number,
    bands?: Array<{ name: string; value: number }>
  ): void {
    const prefab = this.buildingPrefabs.get(buildingId);
    if (prefab) {
      prefab.updateStatus(status);
      prefab.updateActivity(activity);

      // Handle bank-specific properties
      if (prefab instanceof BankPrefab) {
        if (quantity !== undefined) {
          prefab.updateQuantity(quantity);
        }
        if (amount !== undefined) {
          prefab.updateAmount(amount);
        }
      }

      // Handle display_a-specific properties
      if (prefab instanceof DisplayAPrefab) {
        if (ringCount !== undefined) {
          prefab.updateRingCount(ringCount);
        }
        if (text1 !== undefined) {
          prefab.updateText1(text1);
        }
        if (text2 !== undefined) {
          prefab.updateText2(text2);
        }
        if (text3 !== undefined) {
          prefab.updateText3(text3);
        }
      }

      // Handle tower_a-specific properties
      if (prefab instanceof TowerAPrefab) {
        if (towerText !== undefined) {
          prefab.updateTowerText(towerText);
        }
      }

      // Handle tower_b-specific properties
      if (prefab instanceof TowerBPrefab) {
        if (towerBText !== undefined) {
          prefab.updateRingText(towerBText);
        }
        if (dancerEnabled !== undefined) {
          prefab.updateHologramEnabled(dancerEnabled);
        }
      }

      // Handle supervisor-specific properties
      if (prefab instanceof SupervisorPrefab) {
        if (faceRotationEnabled !== undefined) {
          prefab.setFaceRotation(faceRotationEnabled);
        }
      }

      // Handle arcade-specific properties
      if (prefab instanceof ArcadePrefab) {
        if (musicEnabled !== undefined) {
          prefab.updateMusicEnabled(musicEnabled);
        }
        if (signText !== undefined) {
          prefab.updateSignText(signText);
        }
      }

      // Handle data_center-specific properties
      if (prefab instanceof DataCenterPrefab) {
        const metrics: Partial<DataCenterMetrics> = {};
        if (cpuUsage !== undefined) metrics.cpuUsage = cpuUsage;
        if (ramUsage !== undefined) metrics.ramUsage = ramUsage;
        if (networkTraffic !== undefined) metrics.networkTraffic = networkTraffic;
        if (activeConnections !== undefined) metrics.activeConnections = activeConnections;
        if (temperature !== undefined) metrics.temperature = temperature;
        if (alertLevel !== undefined) metrics.alertLevel = alertLevel;

        if (Object.keys(metrics).length > 0) {
          prefab.updateMetrics(metrics);
        }
      }

      // Handle monitor_tube-specific properties
      if (prefab instanceof MonitorTubePrefab) {
        const metrics: Partial<MonitorTubeMetrics> = {};
        if (bandCount !== undefined) {
          metrics.bandCount = Math.max(3, Math.min(7, bandCount)) as 3 | 4 | 5 | 6 | 7;
        }
        if (bands !== undefined && bands.length > 0) {
          metrics.bands = bands.map(b => ({ name: b.name, value: b.value }));
        }

        if (Object.keys(metrics).length > 0) {
          prefab.updateMetrics(metrics);
        }
      }

      // Store building state for tooltips
      this.buildingStates.set(buildingId, {
        id: buildingId,
        status,
        activity,
        quantity,
        amount: amount ?? undefined,
        ringCount,
        text1,
        text2,
        text3,
        towerText,
        towerBText,
        dancerEnabled,
        faceRotationEnabled,
        musicEnabled,
        signText,
        cpuUsage,
        ramUsage,
        networkTraffic,
        activeConnections,
        temperature,
        alertLevel,
        bandCount: bandCount as 3 | 4 | 5 | 6 | 7 | undefined,
        bands,
      });
    }
  }

  addBuilding(building: Building): void {
    const prefab = createPrefab(building);
    const object = prefab.getObject();

    // Position based on grid location
    // Multi-cell buildings need offset to center on their footprint
    const offset = this.getMultiCellOffset(building.type);
    object.position.set(building.location.x + offset, 0, building.location.y + offset);

    // Apply orientation
    if (building.orientation) {
      switch (building.orientation) {
        case 'N':
          object.rotation.y = 0;
          break;
        case 'E':
          object.rotation.y = -Math.PI / 2;
          break;
        case 'S':
          object.rotation.y = Math.PI;
          break;
        case 'W':
          object.rotation.y = Math.PI / 2;
          break;
      }
    }

    this.buildingPrefabs.set(building.id, prefab);
    this.scene.add(object);

    // Play construction animation (holographic Tron style)
    this.animatingPrefabs.add(prefab);
    prefab.playConstructAnimation().then(() => {
      this.animatingPrefabs.delete(prefab);
    });
  }

  removeBuilding(buildingId: string): void {
    const prefab = this.buildingPrefabs.get(buildingId);
    if (prefab) {
      // Remove from active map immediately so we don't try to update state
      this.buildingPrefabs.delete(buildingId);

      // Add to animating set for continued updates during animation
      this.animatingPrefabs.add(prefab);

      // Play deconstruction animation, then remove from scene
      prefab.playDeconstructAnimation().then(() => {
        this.animatingPrefabs.delete(prefab);
        this.scene.remove(prefab.getObject());
        prefab.dispose();
      });
    }
  }

  updateBuilding(building: Building): void {
    const prefab = this.buildingPrefabs.get(building.id);
    if (!prefab) {
      // Building not found, add it instead
      this.addBuilding(building);
      return;
    }

    const object = prefab.getObject();

    // Update building data in prefab (for tooltips, labels, etc.)
    prefab.updateBuildingData(building);

    // Notify label manager of building data change
    this.labelManager?.updateBuilding(building.id, building);

    // Notify tooltip manager to update open detail tooltips
    this.tooltipManager?.updateBuilding(building);

    // Calculate new position
    // Multi-cell buildings need offset to center on their footprint
    const offset = this.getMultiCellOffset(building.type);
    const newX = building.location.x + offset;
    const newZ = building.location.y + offset;

    // Calculate new rotation based on orientation
    let newRotationY = 0;
    switch (building.orientation) {
      case 'N':
        newRotationY = 0;
        break;
      case 'E':
        newRotationY = -Math.PI / 2;
        break;
      case 'S':
        newRotationY = Math.PI;
        break;
      case 'W':
        newRotationY = Math.PI / 2;
        break;
    }

    // Apply position and rotation changes
    object.position.set(newX, object.position.y, newZ);
    object.rotation.y = newRotationY;
  }

  /**
   * Calculate position offset for multi-cell buildings to center them on their footprint
   * @param buildingType - The building type string
   * @returns Offset value: 0 for 1x1, 0.5 for 2x2, 1.0 for 3x3
   */
  private getMultiCellOffset(buildingType: string): number {
    const MULTI_CELL_SIZES: Record<string, number> = {
      tower_a: 2,
      pyramid: 3,
      supervisor: 4,
      data_center: 7,    // 7x7 grid footprint
      monitor_tube: 7,   // 7x7 grid footprint
      arcade: 2,         // 2x2 grid (disabled in UI)
    };
    const size = MULTI_CELL_SIZES[buildingType.toLowerCase()] || 1;
    return (size - 1) / 2;
  }

  updateRoads(roads: string[] | undefined): void {
    // Skip if animation already in progress
    if (this.roadAnimationState) {
      console.warn('Road animation already in progress, skipping update');
      return;
    }

    // Play deconstruction animation, then rebuild with construction animation
    this.playRoadDeconstructAnimation().then(() => {
      this.clearRoads();
      if (roads && roads.length > 0) {
        this.createRoads(roads, true); // animate = true
        // Update flyover path when roads change
        this.cameraController.generatePathFromRoads(roads);
      }
    });
  }

  private clearRoads(): void {
    // Remove road meshes
    for (const road of this.roadMeshes) {
      this.scene.remove(road);
      if (road instanceof THREE.Mesh) {
        road.geometry.dispose();
        (road.material as THREE.Material).dispose();
      }
    }
    this.roadMeshes = [];

    // Remove wireframe meshes
    for (const wireframe of this.roadWireframeMeshes) {
      this.scene.remove(wireframe);
      wireframe.geometry.dispose();
      (wireframe.material as THREE.Material).dispose();
    }
    this.roadWireframeMeshes = [];

    // Remove neon lines
    for (const line of this.neonLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.neonLines = [];

    // Clear animation state
    this.roadAnimationState = null;
  }

  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.clearLayout();
    this.trafficManager.dispose();
    this.fireworkManager.dispose();
    this.cameraController.dispose();
    this.renderer.dispose();

    window.removeEventListener('resize', this.onResize.bind(this));

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ---------------------------------------------------------------------------
  // CAMERA CONTROL API
  // ---------------------------------------------------------------------------

  setCameraMode(mode: CameraMode): void {
    this.cameraController.setMode(mode);
  }

  setCameraState(state: CameraState): void {
    this.cameraController.setCameraState(state);
  }

  getCameraMode(): CameraMode {
    return this.cameraController.getMode();
  }

  setFlyoverSpeed(speed: number): void {
    this.cameraController.setFlyoverSpeed(speed);
  }

  setMouseSensitivity(multiplier: number): void {
    this.cameraController.setMouseSensitivity(multiplier);
  }

  getMouseSensitivity(): number {
    return this.cameraController.getMouseSensitivity();
  }

  /**
   * Recenter camera to the middle of the current layout
   */
  recenterCamera(): void {
    const layout = store.getActiveLayout();
    if (layout) {
      this.cameraController.centerOnGrid(layout.grid.width, layout.grid.height, true);
    }
  }

  /**
   * Trigger the identification firework effect
   * Used to visually identify this scene when multiple scenes are connected
   */
  triggerIdentifyEffect(): void {
    // Set firework center to layout center
    const layout = store.getActiveLayout();
    if (layout) {
      const centerX = (layout.grid.width - 1) / 2;
      const centerZ = (layout.grid.height - 1) / 2;
      this.fireworkManager.setCenter(centerX, 5, centerZ);
    }
    this.fireworkManager.trigger();
  }

  /**
   * Handle camera command from remote control (backoffice)
   */
  handleCameraCommand(cmd: CameraCommand): void {
    log.log('[Camera] handleCameraCommand called with:', JSON.stringify(cmd));
    const animate = cmd.animate !== false; // Default to animate
    const duration = cmd.duration || 1.5;

    switch (cmd.command) {
      case 'position':
        // Direct position control - use combined animation to avoid overwriting state
        if (animate && duration > 0) {
          this.cameraController.animateToCommand({
            position: cmd.position,
            rotation: cmd.rotation,
            fov: cmd.fov,
            duration,
          });
        } else {
          // No animation - set directly
          if (cmd.position) {
            this.cameraController.setPosition(cmd.position.x, cmd.position.y, cmd.position.z, false, 0);
          }
          if (cmd.rotation) {
            this.cameraController.setRotation(cmd.rotation.x, cmd.rotation.y, cmd.rotation.z, false, 0);
          }
          if (cmd.fov !== undefined) {
            this.cameraController.setFOV(cmd.fov, false, 0);
          }
        }
        break;

      case 'preset':
        // Apply a saved preset (preset data should be fetched by backoffice and sent)
        // The command should include the full preset data, not just the ID
        if (cmd.position && cmd.rotation) {
          this.cameraController.applyPreset({
            position: cmd.position,
            rotation: cmd.rotation,
            fov: cmd.fov || 60,
            mode: cmd.mode || 'orbit',
          }, animate, duration);
        }
        break;

      case 'mode':
        // Change camera mode
        if (cmd.mode) {
          this.cameraController.setMode(cmd.mode);
        }
        if (cmd.flyover_speed !== undefined) {
          this.cameraController.setFlyoverSpeed(cmd.flyover_speed);
        }
        if (cmd.mouse_sensitivity !== undefined) {
          this.cameraController.setMouseSensitivity(cmd.mouse_sensitivity);
        }
        break;

      case 'sequence':
        // Control sequence playback
        switch (cmd.sequence_action) {
          case 'play':
            if (cmd.sequence) {
              this.cameraController.playSequence(cmd.sequence);
            }
            break;
          case 'pause':
            this.cameraController.pauseSequence();
            break;
          case 'resume':
            this.cameraController.resumeSequence();
            break;
          case 'stop':
            this.cameraController.stopSequence();
            break;
          default:
            console.warn('Unknown sequence action:', cmd.sequence_action);
        }
        break;

      case 'path':
        // Handle new camera path system
        log.log('[Camera] path command, action:', cmd.action, 'path:', cmd.path, 'path_id:', cmd.path_id, 'layout_id:', cmd.layout_id);
        switch (cmd.action) {
          case 'play':
            if (cmd.path) {
              // Full path object provided
              log.log('[Camera] Using full path object');
              const sequence = this.convertPathToSequence(cmd.path);
              if (sequence) {
                this.cameraController.playSequence(sequence);
              }
            } else if (cmd.path_id && cmd.layout_id) {
              // Only path_id provided - fetch the path from API
              log.log('[Camera] Fetching path by ID:', cmd.path_id);
              this.fetchAndPlayPath(cmd.path_id, cmd.layout_id);
            } else {
              console.warn('[Camera] play action but no path or path_id');
            }
            break;
          case 'pause':
            this.cameraController.pauseSequence();
            break;
          case 'stop':
            this.cameraController.stopSequence();
            break;
          default:
            console.warn('Unknown path action:', cmd.action);
        }
        break;

      default:
        console.warn('Unknown camera command:', cmd.command);
    }
  }

  /**
   * Fetch a camera path by ID and play it
   */
  private async fetchAndPlayPath(pathId: string, layoutId: string): Promise<void> {
    try {
      log.log(`Fetching camera path ${pathId} for layout ${layoutId}`);
      const { authManager } = await import('../auth/AuthManager');
      const response = await fetch(`/ui/paths/${layoutId}/${pathId}`, {
        method: 'GET',
        credentials: 'include',
        headers: authManager.getAuthHeaders(),
      });

      if (!response.ok) {
        console.warn('Failed to fetch camera path:', response.status);
        return;
      }

      const path = await response.json() as CameraPath;
      if (path && path.checkpoints && path.checkpoints.length > 0) {
        log.log(`Playing path "${path.name}" with ${path.checkpoints.length} checkpoints`);
        const sequence = this.convertPathToSequence(path);
        if (sequence) {
          this.cameraController.playSequence(sequence);
        }
      }
    } catch (error) {
      console.error('Error fetching camera path:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // CAMERA PATH CONVERSION
  // ---------------------------------------------------------------------------

  /**
   * Convert compass direction to rotation Y in radians
   */
  private compassToRotation(direction: CompassDirection): number {
    const rotations: Record<CompassDirection, number> = {
      'N': 0,
      'NE': Math.PI / 4,
      'E': Math.PI / 2,
      'SE': (3 * Math.PI) / 4,
      'S': Math.PI,
      'SW': (5 * Math.PI) / 4,
      'W': (3 * Math.PI) / 2,
      'NW': (7 * Math.PI) / 4,
    };
    return rotations[direction] || 0;
  }

  /**
   * Convert altitude (0-100) to camera Y position
   * 0 = ground level (2 units), 100 = aerial (25 units)
   */
  private altitudeToHeight(altitude: number): number {
    const minHeight = 2;
    const maxHeight = 25;
    const normalized = Math.max(0, Math.min(100, altitude)) / 100;
    return minHeight + normalized * (maxHeight - minHeight);
  }

  /**
   * Convert CameraPath (grid-based) to CameraSequence (world coordinates)
   */
  private convertPathToSequence(path: CameraPath): CameraSequence | null {
    if (!path.checkpoints || path.checkpoints.length === 0) {
      console.warn('Cannot convert path: no checkpoints');
      return null;
    }

    // Sort checkpoints by order_index
    const sortedCheckpoints = [...path.checkpoints].sort(
      (a, b) => a.order_index - b.order_index
    );

    log.log(`Converting path "${path.name}" with ${sortedCheckpoints.length} checkpoints`);

    const keyframes: CameraSequenceKeyframe[] = sortedCheckpoints.map((cp, index) => {
      // Convert grid coordinates to world position
      // Grid coordinates are 1:1 with world units, centered on the cell
      const worldX = cp.grid_x + 0.5;
      const worldZ = cp.grid_y + 0.5;
      const worldY = this.altitudeToHeight(cp.altitude);

      // Convert compass direction to rotation Y
      const rotationY = this.compassToRotation(cp.orientation);

      // Convert tilt from degrees (-90 to +90) to radians
      // Note: negative tilt = looking down, positive = looking up
      const tiltValue = cp.tilt ?? 0;
      const tiltAngle = (tiltValue * Math.PI) / 180;

      // Use checkpoint's zoom value for FOV (30-120)
      const fov = cp.zoom ?? 60;

      return {
        id: cp.id,
        sequence_id: path.id,
        preset_id: cp.id, // Use checkpoint id as pseudo-preset id
        order_index: index,
        transition_duration: cp.transition_duration || 2,
        hold_duration: cp.hold_duration || 1,
        preset: {
          id: cp.id,
          account_id: path.account_id,
          layout_id: path.layout_id,
          name: `Checkpoint ${index + 1}`,
          position_x: worldX,
          position_y: worldY,
          position_z: worldZ,
          rotation_x: tiltAngle,
          rotation_y: rotationY,
          rotation_z: 0,
          fov: fov,
          mode: 'orbit',
          is_default: false,
          created_at: cp.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
    });

    return {
      id: path.id,
      account_id: path.account_id,
      layout_id: path.layout_id,
      name: path.name,
      description: path.description,
      loop: path.loop,
      keyframes,
      created_at: path.created_at,
      updated_at: path.updated_at,
    };
  }

  // ---------------------------------------------------------------------------
  // TRAFFIC CONTROL API
  // ---------------------------------------------------------------------------

  /**
   * Set traffic density (0-100)
   */
  setTrafficDensity(density: number): void {
    this.trafficManager.setDensity(density);
  }

  /**
   * Set traffic speed
   */
  setTrafficSpeed(speed: TrafficSpeed): void {
    this.trafficManager.setSpeed(speed);
  }

  /**
   * Enable or disable traffic
   */
  setTrafficEnabled(enabled: boolean): void {
    this.trafficManager.setEnabled(enabled);
  }

  /**
   * Get current traffic vehicle count
   */
  getTrafficVehicleCount(): number {
    return this.trafficManager.getVehicleCount();
  }

  /**
   * Handle traffic command from remote control
   */
  handleTrafficCommand(cmd: { density?: number; speed?: TrafficSpeed; enabled?: boolean }): void {
    if (cmd.density !== undefined) {
      this.setTrafficDensity(cmd.density);
    }
    if (cmd.speed !== undefined) {
      this.setTrafficSpeed(cmd.speed);
    }
    if (cmd.enabled !== undefined) {
      this.setTrafficEnabled(cmd.enabled);
    }
  }

  // ---------------------------------------------------------------------------
  // POPUP CONTROL API
  // ---------------------------------------------------------------------------

  /**
   * Handle popup command from remote control
   */
  handlePopupCommand(cmd: PopupCommand): void {
    switch (cmd.command) {
      case 'labels':
        if (cmd.enabled !== undefined) {
          this.setLabelsVisible(cmd.enabled);
          store.setLabelsVisible(cmd.enabled);
        }
        break;

      case 'detail':
        if (cmd.building_ids && cmd.building_ids.length > 0) {
          for (const buildingId of cmd.building_ids) {
            this.showPopupForBuilding(buildingId);
          }
        }
        break;

      case 'close':
        if (cmd.building_ids && cmd.building_ids.length > 0) {
          this.tooltipManager?.closeDetailTooltips(cmd.building_ids);
        }
        break;

      case 'close_all':
        this.tooltipManager?.hideAllDetailTooltips();
        break;
    }
  }

  /**
   * Show popup for a specific building by ID
   */
  showPopupForBuilding(buildingId: string): void {
    const prefab = this.buildingPrefabs.get(buildingId);
    if (!prefab) {
      console.warn(`Building not found: ${buildingId}`);
      return;
    }

    const building = prefab.getBuilding();
    const state = this.buildingStates.get(buildingId) || null;
    const position = prefab.getObject().position.clone();

    this.tooltipManager?.showDetailTooltip(building, state, position);
  }

  /**
   * Close popup for a specific building by ID
   */
  closePopupForBuilding(buildingId: string): void {
    this.tooltipManager?.hideDetailTooltip(buildingId);
  }

  /**
   * Close all popups
   */
  closeAllPopups(): void {
    this.tooltipManager?.hideAllDetailTooltips();
  }

  // ---------------------------------------------------------------------------
  // ASSET TYPE FILTERING API
  // ---------------------------------------------------------------------------

  /**
   * Update visibility of all buildings based on enabled asset types
   * Buildings with disabled types are hidden with a fade-out effect
   */
  updateAssetTypeVisibility(enabledTypes: Set<string>): void {
    // If no types specified (empty set), show all buildings
    const showAll = enabledTypes.size === 0;

    for (const [_buildingId, prefab] of this.buildingPrefabs) {
      const building = prefab.getBuilding();
      const isEnabled = showAll || enabledTypes.has(building.type);
      const object = prefab.getObject();

      if (isEnabled && !object.visible) {
        // Show building with construction animation
        object.visible = true;
        this.animatingPrefabs.add(prefab);
        prefab.playConstructAnimation().then(() => {
          this.animatingPrefabs.delete(prefab);
        });
      } else if (!isEnabled && object.visible) {
        // Hide building with deconstruction animation
        this.animatingPrefabs.add(prefab);
        prefab.playDeconstructAnimation().then(() => {
          this.animatingPrefabs.delete(prefab);
          object.visible = false;
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private setupLighting(): void {
    // Hemisphere light (sky/ground ambient)
    const hemiLight = new THREE.HemisphereLight(0x8899bb, 0x445566, 1.2);
    this.scene.add(hemiLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x666680, 1.0);
    this.scene.add(ambientLight);

    // Main directional light (sun-like)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this.scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.8);
    fillLight.position.set(-5, 8, -5);
    this.scene.add(fillLight);

    // Rim light (cyan accent)
    const rimLight = new THREE.DirectionalLight(0x00ffff, 0.5);
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);

    // Front fill light
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontLight.position.set(0, 10, 15);
    this.scene.add(frontLight);
  }

  private createGround(width: number, height: number): void {
    const padding = 2;
    const groundWidth = width + padding * 2;
    const groundHeight = height + padding * 2;
    const centerX = (width - 1) / 2;
    const centerZ = (height - 1) / 2;

    // Deep void layer underneath (gives depth illusion)
    const voidGeo = new THREE.PlaneGeometry(groundWidth * 2, groundHeight * 2);
    const voidMat = new THREE.MeshBasicMaterial({
      color: 0x000008,
    });
    const voidPlane = new THREE.Mesh(voidGeo, voidMat);
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.set(centerX, -0.5, centerZ);
    this.scene.add(voidPlane);

    // Subtle glow layer underneath the glass
    const glowGeo = new THREE.PlaneGeometry(groundWidth, groundHeight);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.03,
    });
    this.groundGlow = new THREE.Mesh(glowGeo, glowMat);
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.position.set(centerX, -0.02, centerZ);
    this.scene.add(this.groundGlow);

    // Main ground plane with subtle wet effect (reduced reflections)
    const geometry = new THREE.PlaneGeometry(groundWidth, groundHeight);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x080c12,
      metalness: 0.1,
      roughness: 0.7,
      transparent: true,
      opacity: 0.7,
      reflectivity: 0.2,
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.3,
    });

    this.groundPlane = new THREE.Mesh(geometry, material);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.set(centerX, -0.01, centerZ);
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    // Neon grid lines on the ground (Tron style)
    this.createGroundNeonGrid(width, height, centerX, centerZ);
  }

  private createGroundNeonGrid(width: number, height: number, centerX: number, centerZ: number): void {
    const gridSize = Math.max(width, height) + 4;
    const halfGrid = gridSize / 2;
    const points: THREE.Vector3[] = [];

    // Create grid lines
    for (let i = -halfGrid; i <= halfGrid; i++) {
      // Lines along X axis
      points.push(new THREE.Vector3(centerX - halfGrid, 0.002, centerZ + i));
      points.push(new THREE.Vector3(centerX + halfGrid, 0.002, centerZ + i));
      // Lines along Z axis
      points.push(new THREE.Vector3(centerX + i, 0.002, centerZ - halfGrid));
      points.push(new THREE.Vector3(centerX + i, 0.002, centerZ + halfGrid));
    }

    const gridGeo = new THREE.BufferGeometry().setFromPoints(points);
    const gridMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.15,
    });

    this.groundNeonGrid = new THREE.LineSegments(gridGeo, gridMat);
    this.scene.add(this.groundNeonGrid);
  }

  private createRoads(roads: string[], animate: boolean = false): void {
    const height = roads.length;
    const width = roads[0]?.length || 0;

    // Helper to check if a cell is a road
    const isRoad = (x: number, y: number): boolean => {
      if (y < 0 || y >= height || x < 0 || x >= width) return false;
      return roads[y][x] === '1';
    };

    // Initial opacity depends on animation mode
    const initialOpacity = animate ? 0 : 1.0;
    const initialNeonOpacity = animate ? 0 : 0.9;

    // Track bounds and cell infos for animation
    let minX = Infinity;
    let maxX = -Infinity;
    const cellInfos: RoadCellInfo[] = [];

    // Map to track edge segments per cell for association
    const cellEdgeSegments = new Map<string, Array<{ start: THREE.Vector3; end: THREE.Vector3 }>>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isRoad(x, y)) continue;

        // Track bounds
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);

        // Road surface material (dark with slight reflection)
        const roadMaterial = new THREE.MeshStandardMaterial({
          color: animate ? ROAD_HOLO_RED : COLORS.road,
          metalness: 0.4,
          roughness: 0.6,
          transparent: true,
          opacity: initialOpacity,
        });

        // Create road surface (slightly larger to connect with neighbors)
        const roadGeo = new THREE.PlaneGeometry(1.02, 1.02);
        const road = new THREE.Mesh(roadGeo, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, 0.005, y);
        road.receiveShadow = true;
        this.roadMeshes.push(road);
        this.scene.add(road);

        // Create wireframe for holographic effect
        const wireframe = this.createRoadWireframe(x, y);
        this.roadWireframeMeshes.push(wireframe);
        this.scene.add(wireframe);

        // Initialize cell info
        const cellKey = `${x},${y}`;
        cellEdgeSegments.set(cellKey, []);

        const cellInfo: RoadCellInfo = {
          surfaceMesh: road,
          wireframeMesh: wireframe,
          originalSurfaceColor: new THREE.Color(COLORS.road),
          edgeLines: [],
          worldX: x,
        };
        cellInfos.push(cellInfo);

        // Check each edge for neon line (only add if neighbor is NOT a road)
        const halfSize = 0.5;
        const neonY = 0.02;

        // Top edge (y - 1)
        if (!isRoad(x, y - 1)) {
          cellEdgeSegments.get(cellKey)!.push({
            start: new THREE.Vector3(x - halfSize, neonY, y - halfSize),
            end: new THREE.Vector3(x + halfSize, neonY, y - halfSize),
          });
        }

        // Bottom edge (y + 1)
        if (!isRoad(x, y + 1)) {
          cellEdgeSegments.get(cellKey)!.push({
            start: new THREE.Vector3(x - halfSize, neonY, y + halfSize),
            end: new THREE.Vector3(x + halfSize, neonY, y + halfSize),
          });
        }

        // Left edge (x - 1)
        if (!isRoad(x - 1, y)) {
          cellEdgeSegments.get(cellKey)!.push({
            start: new THREE.Vector3(x - halfSize, neonY, y - halfSize),
            end: new THREE.Vector3(x - halfSize, neonY, y + halfSize),
          });
        }

        // Right edge (x + 1)
        if (!isRoad(x + 1, y)) {
          cellEdgeSegments.get(cellKey)!.push({
            start: new THREE.Vector3(x + halfSize, neonY, y - halfSize),
            end: new THREE.Vector3(x + halfSize, neonY, y + halfSize),
          });
        }
      }
    }

    // Create neon lines and associate with cells
    for (const [cellKey, segments] of cellEdgeSegments) {
      const [cx, cy] = cellKey.split(',').map(Number);
      const cellInfo = cellInfos.find(c => c.worldX === cx && c.surfaceMesh.position.z === cy);

      for (const segment of segments) {
        // Neon line material (cyan glow)
        const neonMaterial = new THREE.LineBasicMaterial({
          color: COLORS.roadNeon,
          transparent: true,
          opacity: initialNeonOpacity,
        });

        const geometry = new THREE.BufferGeometry().setFromPoints([segment.start, segment.end]);
        const line = new THREE.Line(geometry, neonMaterial);
        this.neonLines.push(line);
        this.scene.add(line);

        if (cellInfo) {
          cellInfo.edgeLines.push(line);
        }
      }
    }

    // Add center line markings for long straight roads
    this.addRoadMarkings(roads, isRoad, animate, cellInfos);

    // Initialize animation state if animating
    if (animate && cellInfos.length > 0) {
      this.roadAnimationState = {
        isConstructing: true,
        isDeconstructing: false,
        progress: 0,
        animTime: 0,
        minX,
        maxX,
        cellInfos,
      };
    }
  }

  private addRoadMarkings(
    roads: string[],
    isRoad: (x: number, y: number) => boolean,
    animate: boolean = false,
    cellInfos: RoadCellInfo[] = []
  ): void {
    const height = roads.length;
    const width = roads[0]?.length || 0;
    const initialOpacity = animate ? 0 : 0.6;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isRoad(x, y)) continue;

        // Check if this is a horizontal or vertical road segment
        const hasHorizontalNeighbors = isRoad(x - 1, y) || isRoad(x + 1, y);
        const hasVerticalNeighbors = isRoad(x, y - 1) || isRoad(x, y + 1);

        // Only add markings for straight roads, not intersections
        if (hasHorizontalNeighbors !== hasVerticalNeighbors) {
          // Dashed center line
          if (Math.random() > 0.3) {
            const markingMaterial = new THREE.MeshBasicMaterial({
              color: COLORS.roadNeonAlt,
              transparent: true,
              opacity: initialOpacity,
            });

            const isHorizontal = hasHorizontalNeighbors;
            const markingGeo = new THREE.PlaneGeometry(
              isHorizontal ? 0.3 : 0.05,
              isHorizontal ? 0.05 : 0.3
            );
            const marking = new THREE.Mesh(markingGeo, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(x, 0.008, y);
            this.roadMeshes.push(marking);
            this.scene.add(marking);

            // Associate with cell info if animating
            if (animate) {
              const cellInfo = cellInfos.find(c => c.worldX === x && c.surfaceMesh.position.z === y);
              if (cellInfo) {
                cellInfo.markingMesh = marking;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Create a wireframe grid overlay for holographic road construction effect
   */
  private createRoadWireframe(x: number, z: number): THREE.LineSegments {
    const size = 0.5;
    const divisions = 4;
    const step = 1.0 / divisions;
    const points: THREE.Vector3[] = [];

    // Horizontal lines
    for (let i = 0; i <= divisions; i++) {
      const zPos = -size + i * step;
      points.push(new THREE.Vector3(-size, 0.015, zPos));
      points.push(new THREE.Vector3(size, 0.015, zPos));
    }

    // Vertical lines
    for (let i = 0; i <= divisions; i++) {
      const xPos = -size + i * step;
      points.push(new THREE.Vector3(xPos, 0.015, -size));
      points.push(new THREE.Vector3(xPos, 0.015, size));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: ROAD_HOLO_RED,
      transparent: true,
      opacity: 0,
    });
    const wireframe = new THREE.LineSegments(geometry, material);
    wireframe.position.set(x, 0, z);
    return wireframe;
  }

  /**
   * Update road construction/deconstruction animation
   */
  private updateRoadAnimation(deltaTime: number): void {
    if (!this.roadAnimationState) return;

    const state = this.roadAnimationState;
    state.animTime += deltaTime;

    // Duration: 0.15s per cell
    const gridWidth = state.maxX - state.minX + 1;
    const totalDuration = Math.max(1.5, gridWidth * 0.15); // Minimum 1.5s
    const progressSpeed = 1 / totalDuration;

    if (state.isConstructing) {
      state.progress += deltaTime * progressSpeed;
      this.updateConstructionEffect(state);
      if (state.progress >= 1) {
        this.finalizeRoadConstruction(state);
      }
    } else if (state.isDeconstructing) {
      state.progress -= deltaTime * progressSpeed * 1.2; // Slightly faster
      this.updateDeconstructionEffect(state);
      if (state.progress <= 0) {
        this.finalizeRoadDeconstruction(state);
      }
    }
  }

  /**
   * Update construction visual effect (scan left to right)
   */
  private updateConstructionEffect(state: RoadAnimationState): void {
    const scanX = state.minX + (state.maxX - state.minX + 1) * state.progress;
    const holoRed = new THREE.Color(ROAD_HOLO_RED);
    const finalColor = new THREE.Color(COLORS.road);

    for (const cell of state.cellInfos) {
      const cellProgress = Math.max(0, Math.min(1, (scanX - cell.worldX) / 1.0));
      const flicker = 0.7 + 0.3 * Math.sin(state.animTime * 20);

      // Wireframe: visible during transition, fades as construction completes
      const wireframeMat = cell.wireframeMesh.material as THREE.LineBasicMaterial;
      if (cellProgress > 0 && cellProgress < 1) {
        wireframeMat.opacity = (1 - cellProgress) * flicker;
      } else if (cellProgress >= 1) {
        wireframeMat.opacity = 0;
      } else {
        wireframeMat.opacity = 0;
      }

      // Surface: fade in + color transition red → final
      const surfaceMat = cell.surfaceMesh.material as THREE.MeshStandardMaterial;
      surfaceMat.transparent = true;
      surfaceMat.opacity = cellProgress * flicker;
      surfaceMat.color.lerpColors(holoRed, finalColor, cellProgress);

      // Edge neon lines: fade in
      for (const line of cell.edgeLines) {
        const lineMat = line.material as THREE.LineBasicMaterial;
        lineMat.opacity = cellProgress * 0.9 * flicker;
      }

      // Road markings
      if (cell.markingMesh) {
        const markMat = cell.markingMesh.material as THREE.MeshBasicMaterial;
        markMat.transparent = true;
        markMat.opacity = cellProgress * 0.6;
      }
    }
  }

  /**
   * Update deconstruction visual effect (scan right to left)
   */
  private updateDeconstructionEffect(state: RoadAnimationState): void {
    const scanX = state.minX + (state.maxX - state.minX + 1) * state.progress;
    const holoRed = new THREE.Color(ROAD_HOLO_RED);
    const finalColor = new THREE.Color(COLORS.road);

    for (const cell of state.cellInfos) {
      // For deconstruction, fade out cells ahead of scan line
      const fadeProgress = Math.max(0, Math.min(1, (cell.worldX - scanX) / 1.0));
      const flicker = 0.7 + 0.3 * Math.sin(state.animTime * 25);

      // Wireframe: appears during fade out
      const wireframeMat = cell.wireframeMesh.material as THREE.LineBasicMaterial;
      if (fadeProgress > 0 && fadeProgress < 1) {
        wireframeMat.opacity = fadeProgress * flicker;
      } else {
        wireframeMat.opacity = 0;
      }

      // Surface: fade out + color transition final → red
      const surfaceMat = cell.surfaceMesh.material as THREE.MeshStandardMaterial;
      surfaceMat.transparent = true;
      surfaceMat.opacity = (1 - fadeProgress) * flicker;
      surfaceMat.color.lerpColors(finalColor, holoRed, fadeProgress);

      // Edge neon lines: fade out
      for (const line of cell.edgeLines) {
        const lineMat = line.material as THREE.LineBasicMaterial;
        lineMat.opacity = (1 - fadeProgress) * 0.9 * flicker;
      }

      // Road markings
      if (cell.markingMesh) {
        const markMat = cell.markingMesh.material as THREE.MeshBasicMaterial;
        markMat.transparent = true;
        markMat.opacity = (1 - fadeProgress) * 0.6;
      }
    }
  }

  /**
   * Finalize road construction - restore materials to final state
   */
  private finalizeRoadConstruction(state: RoadAnimationState): void {
    for (const cell of state.cellInfos) {
      const surfaceMat = cell.surfaceMesh.material as THREE.MeshStandardMaterial;
      surfaceMat.opacity = 1;
      surfaceMat.color.copy(cell.originalSurfaceColor);
      surfaceMat.transparent = true;

      const wireframeMat = cell.wireframeMesh.material as THREE.LineBasicMaterial;
      wireframeMat.opacity = 0;

      for (const line of cell.edgeLines) {
        const lineMat = line.material as THREE.LineBasicMaterial;
        lineMat.opacity = 0.9;
      }

      if (cell.markingMesh) {
        const markMat = cell.markingMesh.material as THREE.MeshBasicMaterial;
        markMat.opacity = 0.6;
      }
    }

    state.resolveCallback?.();
    this.roadAnimationState = null;
  }

  /**
   * Finalize road deconstruction - all roads now invisible
   */
  private finalizeRoadDeconstruction(state: RoadAnimationState): void {
    for (const cell of state.cellInfos) {
      const surfaceMat = cell.surfaceMesh.material as THREE.MeshStandardMaterial;
      surfaceMat.opacity = 0;

      const wireframeMat = cell.wireframeMesh.material as THREE.LineBasicMaterial;
      wireframeMat.opacity = 0;

      for (const line of cell.edgeLines) {
        const lineMat = line.material as THREE.LineBasicMaterial;
        lineMat.opacity = 0;
      }

      if (cell.markingMesh) {
        const markMat = cell.markingMesh.material as THREE.MeshBasicMaterial;
        markMat.opacity = 0;
      }
    }

    state.resolveCallback?.();
    this.roadAnimationState = null;
  }

  /**
   * Play road deconstruction animation for existing roads
   */
  private playRoadDeconstructAnimation(): Promise<void> {
    return new Promise((resolve) => {
      if (this.roadMeshes.length === 0) {
        resolve();
        return;
      }

      // Build cell infos from existing roads
      const cellInfos: RoadCellInfo[] = [];
      let minX = Infinity;
      let maxX = -Infinity;

      // Match surfaces with wireframes by position
      for (let i = 0; i < this.roadMeshes.length; i++) {
        const mesh = this.roadMeshes[i];
        if (!(mesh instanceof THREE.Mesh)) continue;
        if (mesh.geometry.type !== 'PlaneGeometry') continue;

        // Skip road markings (they're smaller planes)
        const geo = mesh.geometry as THREE.PlaneGeometry;
        if (geo.parameters.width < 1) continue;

        const x = mesh.position.x;
        const z = mesh.position.z;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);

        // Find corresponding wireframe
        const wireframe = this.roadWireframeMeshes.find(
          w => Math.abs(w.position.x - x) < 0.01 && Math.abs(w.position.z - z) < 0.01
        );

        if (wireframe) {
          const cellInfo: RoadCellInfo = {
            surfaceMesh: mesh,
            wireframeMesh: wireframe,
            originalSurfaceColor: new THREE.Color(COLORS.road),
            edgeLines: [],
            worldX: x,
          };

          // Find associated neon lines (within 0.6 units of cell center)
          for (const line of this.neonLines) {
            const positions = line.geometry.getAttribute('position');
            const lineX = (positions.getX(0) + positions.getX(1)) / 2;
            const lineZ = (positions.getZ(0) + positions.getZ(1)) / 2;
            if (Math.abs(Math.round(lineX) - x) < 0.6 && Math.abs(Math.round(lineZ) - z) < 0.6) {
              cellInfo.edgeLines.push(line);
            }
          }

          // Find associated marking mesh
          for (const roadObj of this.roadMeshes) {
            if (roadObj instanceof THREE.Mesh && roadObj !== mesh) {
              const markGeo = roadObj.geometry as THREE.PlaneGeometry;
              if (markGeo.parameters.width < 1 &&
                  Math.abs(roadObj.position.x - x) < 0.1 &&
                  Math.abs(roadObj.position.z - z) < 0.1) {
                cellInfo.markingMesh = roadObj;
                break;
              }
            }
          }

          cellInfos.push(cellInfo);
        }
      }

      if (cellInfos.length === 0) {
        resolve();
        return;
      }

      this.roadAnimationState = {
        isConstructing: false,
        isDeconstructing: true,
        progress: 1,
        animTime: 0,
        minX,
        maxX,
        cellInfos,
        resolveCallback: resolve,
      };
    });
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    const deltaTime = this.clock.getDelta();

    // Update camera controller (handles FPS/flyover modes and command animations)
    this.cameraController.update(deltaTime);

    // Update intro animation if playing
    if (this.isPlayingIntroAnimation) {
      this.updateIntroAnimation(deltaTime);
    }

    // Update all building animations
    for (const prefab of this.buildingPrefabs.values()) {
      prefab.update(deltaTime);
    }

    // Update animating prefabs (construction/deconstruction)
    for (const prefab of this.animatingPrefabs) {
      prefab.update(deltaTime);
    }

    // Update road animation
    this.updateRoadAnimation(deltaTime);

    // Animate neon road lines (subtle pulse) - only when not animating and intro complete
    if (!this.roadAnimationState && !this.isPlayingIntroAnimation) {
      this.neonPulseTime += deltaTime;
      const neonPulse = 0.7 + 0.3 * Math.sin(this.neonPulseTime * 2);
      for (const line of this.neonLines) {
        if (line.material instanceof THREE.LineBasicMaterial) {
          line.material.opacity = neonPulse;
        }
      }
    }

    // Animate ground glow (slow breathing effect) - only after intro complete
    if (!this.isPlayingIntroAnimation && this.groundGlow?.material instanceof THREE.MeshBasicMaterial) {
      const glowPulse = 0.02 + 0.02 * Math.sin(this.neonPulseTime * 0.5);
      this.groundGlow.material.opacity = glowPulse;
    }

    // Animate ground neon grid (subtle pulse) - only after intro complete
    if (!this.isPlayingIntroAnimation && this.groundNeonGrid?.material instanceof THREE.LineBasicMaterial) {
      const gridPulse = 0.1 + 0.08 * Math.sin(this.neonPulseTime * 1.5);
      this.groundNeonGrid.material.opacity = gridPulse;
    }

    // Update traffic system - only after intro complete
    if (!this.isPlayingIntroAnimation) {
      this.trafficManager.update(deltaTime);
    }

    // Update firework effect
    this.fireworkManager.update(deltaTime);

    // Update interaction and UI systems - only after intro complete
    if (!this.isPlayingIntroAnimation) {
      this.interactionManager?.update();
      this.tooltipManager?.update();
      this.labelManager?.update();
    }

    // Render
    this.renderer.render(this.scene, this.cameraController.getCamera());
  }

  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.cameraController.resize(width, height);
    this.renderer.setSize(width, height);
  }

  // ---------------------------------------------------------------------------
  // INTRO ANIMATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Dim all lights to 0 for intro animation
   */
  private dimAllLights(): void {
    this.originalLightIntensities.clear();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Light) {
        this.originalLightIntensities.set(obj, obj.intensity);
        obj.intensity = 0;
      }
    });
  }

  /**
   * Restore lights to original intensity with progress factor
   */
  private restoreLightsProgress(progress: number): void {
    for (const [light, originalIntensity] of this.originalLightIntensities) {
      light.intensity = originalIntensity * progress;
    }
  }

  /**
   * Create grid for intro animation (starts invisible, reveals cell by cell)
   */
  private createGridForIntro(width: number, height: number): void {
    const size = Math.max(width, height);

    // Create invisible grid initially
    this.gridHelper = new THREE.GridHelper(
      size,
      size,
      COLORS.gridLine,
      COLORS.grid
    );
    this.gridHelper.position.set(
      (width - 1) / 2,
      0.001,
      (height - 1) / 2
    );

    // Start with grid invisible - GridHelper uses array of materials
    const materials = Array.isArray(this.gridHelper.material)
      ? this.gridHelper.material
      : [this.gridHelper.material];
    for (const mat of materials) {
      (mat as THREE.LineBasicMaterial).transparent = true;
      (mat as THREE.LineBasicMaterial).opacity = 0;
    }

    this.scene.add(this.gridHelper);

    // Also hide ground elements initially
    if (this.groundPlane) {
      (this.groundPlane.material as THREE.MeshPhysicalMaterial).transparent = true;
      (this.groundPlane.material as THREE.MeshPhysicalMaterial).opacity = 0;
    }
    if (this.groundGlow) {
      (this.groundGlow.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    if (this.groundNeonGrid) {
      (this.groundNeonGrid.material as THREE.LineBasicMaterial).opacity = 0;
    }
  }

  /**
   * Create roads but keep them hidden for intro animation
   */
  private createRoadsHidden(roads: string[]): void {
    // Use existing createRoads but with animate=true so they start invisible
    this.createRoads(roads, true);
    // Pause the animation - we'll control it during intro
    if (this.roadAnimationState) {
      this.roadAnimationState.isConstructing = false;
      this.introRoadsReady = true;
    }
  }

  /**
   * Add building but keep it hidden for intro animation
   */
  private addBuildingHidden(building: Building): void {
    const prefab = createPrefab(building);
    const object = prefab.getObject();

    // Position based on grid location
    // Multi-cell buildings need offset to center on their footprint
    const offset = this.getMultiCellOffset(building.type);
    object.position.set(building.location.x + offset, 0, building.location.y + offset);

    // Apply orientation
    if (building.orientation) {
      switch (building.orientation) {
        case 'N':
          object.rotation.y = 0;
          break;
        case 'E':
          object.rotation.y = -Math.PI / 2;
          break;
        case 'S':
          object.rotation.y = Math.PI;
          break;
        case 'W':
          object.rotation.y = Math.PI / 2;
          break;
      }
    }

    // Hide entire object - preserves original material opacities for construction animation
    object.visible = false;

    this.buildingPrefabs.set(building.id, prefab);
    this.scene.add(object);
    this.introBuildingsReady = true;
  }

  /**
   * Create horizon glow effect for cyberpunk dawn
   */
  private createHorizonGlow(width: number, height: number): void {
    const centerX = (width - 1) / 2;
    const centerZ = (height - 1) / 2;

    // Create a large glowing plane beneath the scene
    const glowSize = Math.max(width, height) * 3;
    const geometry = new THREE.PlaneGeometry(glowSize, glowSize);
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.horizonGlowMesh = new THREE.Mesh(geometry, material);
    this.horizonGlowMesh.rotation.x = -Math.PI / 2;
    this.horizonGlowMesh.position.set(centerX, -3, centerZ);
    this.scene.add(this.horizonGlowMesh);
  }

  /**
   * Remove horizon glow after intro
   */
  private removeHorizonGlow(): void {
    if (this.horizonGlowMesh) {
      this.scene.remove(this.horizonGlowMesh);
      this.horizonGlowMesh.geometry.dispose();
      (this.horizonGlowMesh.material as THREE.Material).dispose();
      this.horizonGlowMesh = null;
    }

    // Remove grid flash meshes
    for (const mesh of this.gridFlashMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.gridFlashMeshes = [];
  }

  /**
   * Orchestrate the cinematic intro animation
   */
  private async playIntroAnimation(): Promise<void> {
    if (!this.pendingLayout) return;

    this.isPlayingIntroAnimation = true;
    this.introAnimTime = 0;
    this.introAnimationPhase = 'dark';

    const layout = this.pendingLayout;

    // Create horizon glow
    this.createHorizonGlow(layout.grid.width, layout.grid.height);

    // Phase 1: Dark (0.5s)
    await this.delay(500);

    // Phase 2: Grid matrix (2.5s)
    this.introAnimationPhase = 'grid';
    await this.animateGridMatrix(2500);

    // Phase 3: Dawn (3s) - lights and fog fade in
    this.introAnimationPhase = 'dawn';
    await this.animateDawn(3000);

    // Phase 4: Roads (proportional duration)
    if (this.introRoadsReady && this.roadAnimationState) {
      this.introAnimationPhase = 'roads';
      await this.animateRoadsIntro();
    }

    // Pause 1s after roads - moment of calm before buildings emerge
    await this.delay(1000);

    // Phase 5: Buildings (staggered start, ~9s each)
    if (this.introBuildingsReady) {
      this.introAnimationPhase = 'buildings';
      await this.animateBuildingsIntro();
    }

    // Complete
    this.introAnimationPhase = 'complete';
    this.isPlayingIntroAnimation = false;
    this.pendingLayout = null;

    // Cleanup
    this.removeHorizonGlow();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Animate grid matrix effect - cells light up one by one
   */
  private async animateGridMatrix(duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Reveal grid lines progressively with flicker
        if (this.gridHelper) {
          const flicker = 0.7 + 0.3 * Math.sin(elapsed * 0.02);
          const targetOpacity = progress * 0.5 * flicker;

          const mats = Array.isArray(this.gridHelper.material)
            ? this.gridHelper.material
            : [this.gridHelper.material];
          for (const mat of mats) {
            (mat as THREE.LineBasicMaterial).opacity = targetOpacity;
          }
        }

        // Reveal ground neon grid with cyan flashes
        if (this.groundNeonGrid) {
          const neonFlicker = 0.1 + 0.15 * Math.sin(elapsed * 0.03);
          (this.groundNeonGrid.material as THREE.LineBasicMaterial).opacity = progress * neonFlicker;
        }

        // Create occasional cyan flash effects
        if (Math.random() < 0.05 && this.pendingLayout) {
          this.createGridFlash(this.pendingLayout.grid.width, this.pendingLayout.grid.height);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  /**
   * Create a temporary cyan flash at a random grid position
   */
  private createGridFlash(width: number, height: number): void {
    const x = Math.floor(Math.random() * width);
    const z = Math.floor(Math.random() * height);

    const geometry = new THREE.PlaneGeometry(0.8, 0.8);
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const flash = new THREE.Mesh(geometry, material);
    flash.rotation.x = -Math.PI / 2;
    flash.position.set(x, 0.02, z);
    this.scene.add(flash);
    this.gridFlashMeshes.push(flash);

    // Fade out and remove
    const startTime = performance.now();
    const fadeOut = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / 300; // 300ms fade
      material.opacity = 0.6 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(fadeOut);
      } else {
        this.scene.remove(flash);
        const idx = this.gridFlashMeshes.indexOf(flash);
        if (idx >= 0) this.gridFlashMeshes.splice(idx, 1);
        geometry.dispose();
        material.dispose();
      }
    };
    fadeOut();
  }

  /**
   * Animate cyberpunk dawn - lights fade in, horizon glow rises
   */
  private async animateDawn(duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Ease in cubic
        const eased = progress * progress * progress;

        // Restore lights progressively
        this.restoreLightsProgress(eased);

        // Fade fog from black to final color
        if (this.scene.fog instanceof THREE.Fog) {
          const blackColor = new THREE.Color(0x000000);
          const finalFogColor = new THREE.Color(COLORS.ground);
          this.scene.fog.color.lerpColors(blackColor, finalFogColor, eased);
        }

        // Animate horizon glow - rises and pulses
        if (this.horizonGlowMesh) {
          const mat = this.horizonGlowMesh.material as THREE.MeshBasicMaterial;
          // Glow intensity rises then falls slightly
          const glowCurve = Math.sin(progress * Math.PI) * 0.4;
          mat.opacity = glowCurve;

          // Color shifts from cyan to magenta and back
          const colorProgress = Math.sin(progress * Math.PI * 2);
          const cyan = new THREE.Color(COLORS.glow.cyan);
          const magenta = new THREE.Color(COLORS.glow.magenta);
          mat.color.lerpColors(cyan, magenta, (colorProgress + 1) / 2);

          // Rise up
          this.horizonGlowMesh.position.y = -3 + eased * 2;
        }

        // Fade in ground plane
        if (this.groundPlane) {
          (this.groundPlane.material as THREE.MeshPhysicalMaterial).opacity = eased * 0.7;
        }
        if (this.groundGlow) {
          (this.groundGlow.material as THREE.MeshBasicMaterial).opacity = eased * 0.03;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  /**
   * Animate roads intro - trigger construction animation
   */
  private async animateRoadsIntro(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.roadAnimationState) {
        resolve();
        return;
      }

      // Start the construction animation
      this.roadAnimationState.isConstructing = true;
      this.roadAnimationState.progress = 0;
      this.roadAnimationState.animTime = 0;

      // Wait for completion
      this.roadAnimationState.resolveCallback = resolve;
    });
  }

  /**
   * Animate all buildings with staggered random start
   */
  private async animateBuildingsIntro(): Promise<void> {
    const promises: Promise<void>[] = [];
    const prefabs = Array.from(this.buildingPrefabs.values());

    for (const prefab of prefabs) {
      // Random delay between 0.5 and 1.5 seconds for each building
      const randomDelay = 500 + Math.random() * 1000;

      const promise = this.delay(randomDelay).then(() => {
        // Make visible just before starting construction animation
        prefab.getObject().visible = true;
        this.animatingPrefabs.add(prefab);
        return prefab.playConstructAnimation().then(() => {
          this.animatingPrefabs.delete(prefab);
        });
      });

      promises.push(promise);
    }

    await Promise.all(promises);
  }

  /**
   * Update intro animation effects in the render loop
   */
  private updateIntroAnimation(deltaTime: number): void {
    this.introAnimTime += deltaTime;

    // Additional per-frame effects based on phase
    switch (this.introAnimationPhase) {
      case 'grid':
        // Extra grid pulse effects handled in animateGridMatrix
        break;
      case 'dawn':
        // Dawn handled in animateDawn
        break;
    }
  }
}
