import * as THREE from 'three';
import { BasePrefab } from '../prefabs';

export interface InteractionCallbacks {
  onHover?: (buildingId: string | null, worldPos: THREE.Vector3 | null) => void;
  onSelect?: (buildingId: string | null, worldPos: THREE.Vector3 | null) => void;
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

  private hoveredId: string | null = null;
  private callbacks: InteractionCallbacks = {};

  // Track mouse state to differentiate click from drag
  private mouseDownPosition = { x: 0, y: 0 };
  private readonly CLICK_THRESHOLD = 5;

  private enabled = true;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    buildingPrefabs: Map<string, BasePrefab>
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.buildingPrefabs = buildingPrefabs;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0.1;
    this.raycaster.far = 100;
    this.mouse = new THREE.Vector2();

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onClick = this.onClick.bind(this);

    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('click', this.onClick);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  setCallbacks(cb: InteractionCallbacks): void {
    this.callbacks = cb;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      if (this.hoveredId) {
        this.hoveredId = null;
        this.callbacks.onHover?.(null, null);
      }
      this.domElement.style.cursor = 'default';
    }
  }

  update(): void {
    // Hover detection is event-driven; nothing needed per frame
  }

  dispose(): void {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('click', this.onClick);
    this.domElement.style.cursor = 'default';
  }

  // ---------------------------------------------------------------------------
  // PRIVATE
  // ---------------------------------------------------------------------------

  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycast(): { id: string; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const objects: THREE.Object3D[] = [];
    for (const prefab of this.buildingPrefabs.values()) {
      objects.push(prefab.getObject());
    }

    const intersects = this.raycaster.intersectObjects(objects, true);
    if (intersects.length > 0) {
      const id = this.findBuildingId(intersects[0].object);
      if (id) {
        return { id, point: intersects[0].point.clone() };
      }
    }
    return null;
  }

  private findBuildingId(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const id: unknown = current.userData.buildingId;
      if (typeof id === 'string' && id.length > 0) {
        return id;
      }
      current = current.parent;
    }
    return null;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.enabled) {
      return;
    }

    this.updateMousePosition(event);
    const result = this.raycast();
    const newId = result?.id ?? null;

    if (newId !== this.hoveredId) {
      this.hoveredId = newId;
      if (newId) {
        this.domElement.style.cursor = 'pointer';
        const prefab = this.buildingPrefabs.get(newId)!;
        this.callbacks.onHover?.(newId, prefab.getObject().position.clone());
      } else {
        this.domElement.style.cursor = 'default';
        this.callbacks.onHover?.(null, null);
      }
    }
  }

  private onMouseDown(event: MouseEvent): void {
    this.mouseDownPosition = { x: event.clientX, y: event.clientY };
  }

  private onClick(event: MouseEvent): void {
    if (!this.enabled || event.button !== 0) {
      return;
    }

    const dx = event.clientX - this.mouseDownPosition.x;
    const dy = event.clientY - this.mouseDownPosition.y;
    if (Math.sqrt(dx * dx + dy * dy) > this.CLICK_THRESHOLD) {
      return;
    }

    this.updateMousePosition(event);
    const result = this.raycast();

    if (result) {
      this.callbacks.onSelect?.(result.id, result.point);
    }
  }
}
