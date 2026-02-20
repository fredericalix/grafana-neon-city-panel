import * as THREE from 'three';
import { Building } from '../types';
import { BasePrefab } from './prefabs';

export interface InteractionCallbacks {
  onHover?: (building: Building | null, prefab: BasePrefab | null, worldPosition: THREE.Vector3 | null) => void;
  onSelect?: (building: Building | null, prefab: BasePrefab | null, worldPosition: THREE.Vector3 | null) => void;
  onPopupToggle?: (building: Building | null, prefab: BasePrefab | null, worldPosition: THREE.Vector3 | null) => void;
}

/**
 * Manages raycasting and interaction with buildings in the 3D scene.
 * Detects hover and click events on building prefabs.
 */
export class InteractionManager {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private buildingPrefabs: Map<string, BasePrefab>;

  private hoveredPrefab: BasePrefab | null = null;
  private selectedPrefab: BasePrefab | null = null;
  private callbacks: InteractionCallbacks = {};

  // Track mouse state to differentiate click from drag
  private mouseDownPosition = { x: 0, y: 0 };
  private readonly CLICK_THRESHOLD = 5; // pixels

  // Enabled state
  private enabled = true;

  constructor(
    camera: THREE.PerspectiveCamera,
    _scene: THREE.Scene,
    domElement: HTMLElement,
    buildingPrefabs: Map<string, BasePrefab>
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.buildingPrefabs = buildingPrefabs;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Set raycaster parameters for better performance
    this.raycaster.near = 0.1;
    this.raycaster.far = 100;

    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onClick = this.onClick.bind(this);

    // Add event listeners
    // Left click = focus on building (onSelect)
    // Right click = toggle popup (onPopupToggle)
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('click', this.onClick);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  setCallbacks(callbacks: InteractionCallbacks): void {
    this.callbacks = callbacks;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Clear hover state when disabled
      if (this.hoveredPrefab) {
        this.hoveredPrefab = null;
        this.callbacks.onHover?.(null, null, null);
      }
      this.domElement.style.cursor = 'default';
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getHoveredBuilding(): Building | null {
    return this.hoveredPrefab?.getBuilding() || null;
  }

  getHoveredPrefab(): BasePrefab | null {
    return this.hoveredPrefab;
  }

  getSelectedBuilding(): Building | null {
    return this.selectedPrefab?.getBuilding() || null;
  }

  getSelectedPrefab(): BasePrefab | null {
    return this.selectedPrefab;
  }

  clearSelection(): void {
    if (this.selectedPrefab) {
      this.selectedPrefab = null;
      this.callbacks.onSelect?.(null, null, null);
    }
  }

  /**
   * Update method called in render loop.
   * Can be used for additional per-frame updates if needed.
   */
  update(): void {
    // Currently no per-frame updates needed
    // Hover detection is done on mouse move for better performance
  }

  dispose(): void {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('click', this.onClick);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycast(): { prefab: BasePrefab; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Get all objects from building prefabs
    const objects: THREE.Object3D[] = [];
    for (const prefab of this.buildingPrefabs.values()) {
      objects.push(prefab.getObject());
    }

    // Check intersections with recursive=true to hit child meshes
    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      // Find the prefab that owns this object
      const hitObject = intersects[0].object;
      const prefab = this.findPrefabForObject(hitObject);
      if (prefab) {
        return {
          prefab,
          point: intersects[0].point.clone(),
        };
      }
    }

    return null;
  }

  private findPrefabForObject(object: THREE.Object3D): BasePrefab | null {
    // Traverse up to find the group with buildingId
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.buildingId) {
        return this.buildingPrefabs.get(current.userData.buildingId) || null;
      }
      current = current.parent;
    }
    return null;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;

    this.updateMousePosition(event);
    const result = this.raycast();

    const newHoveredPrefab = result?.prefab || null;

    // Check if hover changed
    if (newHoveredPrefab !== this.hoveredPrefab) {
      this.hoveredPrefab = newHoveredPrefab;

      if (newHoveredPrefab) {
        this.domElement.style.cursor = 'pointer';
        const building = newHoveredPrefab.getBuilding();
        const position = newHoveredPrefab.getObject().position.clone();
        this.callbacks.onHover?.(building, newHoveredPrefab, position);
      } else {
        this.domElement.style.cursor = 'default';
        this.callbacks.onHover?.(null, null, null);
      }
    }
  }

  private onMouseDown(event: MouseEvent): void {
    // Track mouse down position for click vs drag detection (all buttons)
    this.mouseDownPosition = { x: event.clientX, y: event.clientY };
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.enabled) return;

    // Only handle right-click (button 2) for popup toggle
    if (event.button !== 2) return;

    // Check if this was a drag (not a click)
    const dx = event.clientX - this.mouseDownPosition.x;
    const dy = event.clientY - this.mouseDownPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.CLICK_THRESHOLD) {
      // This was a drag, not a click
      return;
    }

    this.updateMousePosition(event);
    const result = this.raycast();

    if (result) {
      // Right-clicked on a building - toggle popup
      const building = result.prefab.getBuilding();
      this.callbacks.onPopupToggle?.(building, result.prefab, result.point);
    }
  }

  private onClick(event: MouseEvent): void {
    if (!this.enabled) return;

    // Only handle left-click (button 0) for focus on building
    if (event.button !== 0) return;

    // Check if this was a drag (not a click)
    const dx = event.clientX - this.mouseDownPosition.x;
    const dy = event.clientY - this.mouseDownPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.CLICK_THRESHOLD) {
      // This was a drag, not a click
      return;
    }

    this.updateMousePosition(event);
    const result = this.raycast();

    if (result) {
      // Left-clicked on a building - focus camera
      this.selectedPrefab = result.prefab;
      const building = result.prefab.getBuilding();
      this.callbacks.onSelect?.(building, result.prefab, result.point);
    }
  }
}
