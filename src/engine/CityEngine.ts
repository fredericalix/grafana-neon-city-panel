import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, BuildingState, TrafficSpeed } from '../types';
import { BasePrefab, createPrefab, COLORS } from '../prefabs';
import { RoadNetwork } from './RoadNetwork';
import { TrafficManager } from './traffic';
import { InteractionManager } from './InteractionManager';
import { TooltipManager } from '../ui/TooltipManager';
import { LabelManager } from '../ui/LabelManager';

/**
 * CityEngine - Three.js scene manager for the Grafana panel.
 * Manages scene, renderer, camera, lights, ground, and building prefabs.
 */
export class CityEngine {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  private animationFrameId: number | null = null;

  private prefabs: Map<string, BasePrefab> = new Map();
  private buildings: Map<string, Building> = new Map();
  private buildingStates: Map<string, BuildingState> = new Map();
  private roadNetwork!: RoadNetwork;
  private trafficManager: TrafficManager | null = null;
  private isDisposed = false;

  // Interaction subsystems
  private interactionManager: InteractionManager | null = null;
  private tooltipManager: TooltipManager | null = null;
  private labelManager: LabelManager | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(COLORS.ground);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(COLORS.ground, 15, 50);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    this.camera.position.set(12, 10, 14);
    this.camera.lookAt(0, 0, 0);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 30;

    // Setup scene
    this.setupLighting();
    this.setupGround();

    // Handle WebGL context loss
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  // ---------------------------------------------------------------------------
  // SCENE SETUP
  // ---------------------------------------------------------------------------

  private setupLighting(): void {
    // Hemisphere light (sky/ground ambient)
    const hemiLight = new THREE.HemisphereLight(0x8899bb, 0x445566, 1.2);
    this.scene.add(hemiLight);

    // Ambient fill
    const ambient = new THREE.AmbientLight(0x666680, 1.0);
    this.scene.add(ambient);

    // Main directional (sun)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(10, 15, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this.scene.add(mainLight);

    // Fill light (cool blue)
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.8);
    fillLight.position.set(-5, 8, -5);
    this.scene.add(fillLight);

    // Rim light (cyan accent)
    const rimLight = new THREE.DirectionalLight(0x00ffff, 0.5);
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);
  }

  private setupGround(): void {
    // Void layer
    const voidGeo = new THREE.PlaneGeometry(100, 100);
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const voidPlane = new THREE.Mesh(voidGeo, voidMat);
    voidPlane.rotation.x = -Math.PI / 2;
    voidPlane.position.y = -0.5;
    this.scene.add(voidPlane);

    // Main ground
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshPhysicalMaterial({
      color: COLORS.ground,
      metalness: 0.1,
      roughness: 0.7,
      clearcoat: 0.2,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Tron-style ground grid (replaces static glow layer)
    this.roadNetwork = new RoadNetwork();
    this.roadNetwork.buildGroundGrid(30);
    this.scene.add(this.roadNetwork.getObject());
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  start(): void {
    if (this.isDisposed) {
      return;
    }
    this.animate();
  }

  private animate = (): void => {
    if (this.isDisposed) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();

    this.controls.update();

    for (const prefab of this.prefabs.values()) {
      prefab.update(deltaTime);
    }

    // Update road animations
    this.roadNetwork.update(deltaTime);

    // Update traffic system
    if (this.trafficManager) {
      this.trafficManager.update(deltaTime);
    }

    // Update interaction subsystems
    this.interactionManager?.update();
    this.tooltipManager?.update();
    this.labelManager?.update();

    this.renderer.render(this.scene, this.camera);
  };

  resize(width: number, height: number): void {
    if (this.isDisposed || width <= 0 || height <= 0) {
      return;
    }

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.tooltipManager?.resize();
  }

  dispose(): void {
    this.isDisposed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.interactionManager?.dispose();
    this.tooltipManager?.dispose();
    this.labelManager?.dispose();

    for (const prefab of this.prefabs.values()) {
      prefab.dispose();
    }
    this.prefabs.clear();

    this.roadNetwork.dispose();
    this.trafficManager?.dispose();

    this.controls.dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ---------------------------------------------------------------------------
  // INTERACTION
  // ---------------------------------------------------------------------------

  /**
   * Initialize interaction subsystems (InteractionManager, TooltipManager, LabelManager).
   * Call once after start().
   */
  setupInteraction(): void {
    const canvas = this.renderer.domElement;

    this.tooltipManager = new TooltipManager(this.container, this.camera, canvas);
    this.labelManager = new LabelManager(this.container, this.camera, canvas);

    this.interactionManager = new InteractionManager(this.camera, canvas, this.prefabs);
    this.interactionManager.setCallbacks({
      onHover: (buildingId, worldPos) => {
        if (!this.tooltipManager) {
          return;
        }
        if (buildingId && worldPos) {
          const building = this.buildings.get(buildingId);
          const state = this.buildingStates.get(buildingId) ?? null;
          if (building) {
            this.tooltipManager.showHoverTooltip(building, state, worldPos);
          }
        } else {
          this.tooltipManager.hideHoverTooltip();
        }
      },
      onSelect: (buildingId, worldPos) => {
        if (!this.tooltipManager || !buildingId || !worldPos) {
          return;
        }
        if (this.tooltipManager.isDetailVisibleForBuilding(buildingId)) {
          this.tooltipManager.hideDetailTooltip(buildingId);
        } else {
          const building = this.buildings.get(buildingId);
          const state = this.buildingStates.get(buildingId) ?? null;
          if (building) {
            this.tooltipManager.showDetailTooltip(building, state, worldPos);
          }
        }
      },
    });

    // Sync labels with current prefabs
    if (this.prefabs.size > 0) {
      this.labelManager.setBuildings(this.prefabs);
    }
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionManager?.setEnabled(enabled);
    if (!enabled) {
      this.tooltipManager?.hideHoverTooltip();
      this.tooltipManager?.hideAllDetailTooltips();
    }
  }

  setLabelsVisible(visible: boolean): void {
    this.labelManager?.setVisible(visible);
  }

  // ---------------------------------------------------------------------------
  // BUILDING MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Sync buildings to match the given layout.
   * Adds new buildings, removes old ones, updates positions.
   */
  setBuildings(buildings: Building[]): void {
    const newIds = new Set(buildings.map((b) => b.id));

    // Remove buildings not in the new layout
    for (const [id, prefab] of this.prefabs) {
      if (!newIds.has(id)) {
        this.scene.remove(prefab.getObject());
        prefab.dispose();
        this.prefabs.delete(id);
        this.buildings.delete(id);
      }
    }

    // Add/update buildings
    for (const building of buildings) {
      this.buildings.set(building.id, building);
      if (!this.prefabs.has(building.id)) {
        const prefab = createPrefab(building);
        const obj = prefab.getObject();
        obj.position.set(building.location.x, 0, building.location.y);
        this.scene.add(obj);
        this.prefabs.set(building.id, prefab);
      }
    }

    // Sync labels with updated prefabs
    this.labelManager?.setBuildings(this.prefabs);
  }

  /**
   * Update building states (status, activity) from Grafana data.
   */
  updateStates(states: BuildingState[]): void {
    for (const state of states) {
      this.buildingStates.set(state.id, state);
      const prefab = this.prefabs.get(state.id);
      if (prefab) {
        prefab.updateStatus(state.status);
        prefab.updateActivity(state.activity);
        prefab.updateData(state);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ROADS & TRAFFIC
  // ---------------------------------------------------------------------------

  /**
   * Set road network from grid definition.
   * Also initializes traffic system on those roads.
   */
  setRoads(roads: string[], origin: { x: number; z: number }): void {
    // Rebuild road meshes
    this.roadNetwork.build(roads, origin);

    // Initialize or update traffic system
    if (!this.trafficManager) {
      this.trafficManager = new TrafficManager(this.scene);
    }
    this.trafficManager.setRoads(roads, origin);
    this.trafficManager.setEnabled(true);
  }

  /**
   * Update traffic density and speed from Grafana data.
   */
  updateTraffic(density: number, speed: TrafficSpeed): void {
    if (this.trafficManager) {
      this.trafficManager.setDensity(density);
      this.trafficManager.setSpeed(speed);
    }
  }

  setTrafficEnabled(enabled: boolean): void {
    this.trafficManager?.setEnabled(enabled);
  }

  // ---------------------------------------------------------------------------
  // CONTEXT LOSS
  // ---------------------------------------------------------------------------

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  };

  private onContextRestored = (): void => {
    this.start();
  };
}
