import * as THREE from 'three';
import { Building } from '../types';
import { BasePrefab } from '../scene/prefabs';

interface LabelInfo {
  element: HTMLElement;
  building: Building;
  prefab: BasePrefab;
}

/**
 * Manages floating labels that appear above each building.
 * Labels can be toggled on/off and show the building name.
 */
export class LabelManager {
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  private labelsContainer: HTMLElement;
  private labels: Map<string, LabelInfo> = new Map();
  private visible = false;

  // Distance culling
  private readonly MAX_DISTANCE = 30;
  private readonly FADE_START = 25;

  // Temporary vector for projections
  private tempV = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    // Create labels container
    this.labelsContainer = document.createElement('div');
    this.labelsContainer.className = 'labels-container';
    this.labelsContainer.style.display = 'none';
    container.appendChild(this.labelsContainer);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Set the buildings to display labels for.
   * Call this when the layout changes.
   */
  setBuildings(buildingPrefabs: Map<string, BasePrefab>): void {
    // Clear existing labels
    this.clearLabels();

    // Create label for each building
    for (const [id, prefab] of buildingPrefabs) {
      const building = prefab.getBuilding();
      this.createLabel(id, building, prefab);
    }
  }

  /**
   * Add a single building label.
   */
  addBuilding(id: string, prefab: BasePrefab): void {
    const building = prefab.getBuilding();
    this.createLabel(id, building, prefab);
  }

  /**
   * Remove a single building label.
   */
  removeBuilding(id: string): void {
    const labelInfo = this.labels.get(id);
    if (labelInfo) {
      labelInfo.element.remove();
      this.labels.delete(id);
    }
  }

  /**
   * Update label for a building (e.g., when name changes).
   */
  updateBuilding(id: string, building: Building): void {
    const labelInfo = this.labels.get(id);
    if (labelInfo) {
      labelInfo.building = building;
      const nameSpan = labelInfo.element.querySelector('.label-name');
      if (nameSpan) {
        nameSpan.textContent = building.name || building.type;
      }
    }
  }

  /**
   * Toggle labels visibility.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.labelsContainer.style.display = visible ? 'block' : 'none';
  }

  /**
   * Check if labels are visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Toggle visibility.
   */
  toggle(): void {
    this.setVisible(!this.visible);
  }

  /**
   * Update label positions based on camera. Call in render loop.
   */
  update(): void {
    if (!this.visible) return;

    this.camera.getWorldPosition(this.cameraPosition);

    for (const [_id, labelInfo] of this.labels) {
      this.updateLabelPosition(labelInfo);
    }
  }

  dispose(): void {
    this.clearLabels();
    this.labelsContainer.remove();
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private createLabel(id: string, building: Building, prefab: BasePrefab): void {
    const element = document.createElement('div');
    element.className = 'floating-label';
    element.innerHTML = `
      <span class="label-name">${this.escapeHtml(building.name || building.type)}</span>
    `;

    this.labelsContainer.appendChild(element);

    this.labels.set(id, {
      element,
      building,
      prefab,
    });
  }

  private updateLabelPosition(labelInfo: LabelInfo): void {
    const prefab = labelInfo.prefab;
    const element = labelInfo.element;

    // Get world position of building
    const worldPos = prefab.getObject().position.clone();
    worldPos.y += 2.8; // Offset above building

    // Calculate distance from camera
    const distance = worldPos.distanceTo(this.cameraPosition);

    // Hide if too far
    if (distance > this.MAX_DISTANCE) {
      element.style.visibility = 'hidden';
      return;
    }

    // Project to screen
    this.tempV.copy(worldPos);
    this.tempV.project(this.camera);

    // Hide if behind camera
    if (Math.abs(this.tempV.z) > 1) {
      element.style.visibility = 'hidden';
      return;
    }

    // Convert to CSS coordinates
    const x = (this.tempV.x * 0.5 + 0.5) * this.canvas.clientWidth;
    const y = (this.tempV.y * -0.5 + 0.5) * this.canvas.clientHeight;

    // Calculate opacity based on distance (fade out at distance)
    let opacity = 1;
    if (distance > this.FADE_START) {
      opacity = 1 - (distance - this.FADE_START) / (this.MAX_DISTANCE - this.FADE_START);
    }

    // Apply position and opacity
    element.style.visibility = 'visible';
    element.style.opacity = String(opacity);
    element.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;

    // Z-index based on distance (closer = higher z-index)
    element.style.zIndex = String(Math.floor(1000 - distance * 10));
  }

  private clearLabels(): void {
    for (const labelInfo of this.labels.values()) {
      labelInfo.element.remove();
    }
    this.labels.clear();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
