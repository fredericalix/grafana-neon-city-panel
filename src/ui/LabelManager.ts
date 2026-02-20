import * as THREE from 'three';
import { BasePrefab } from '../prefabs';
import { applyStyle, LABEL_STYLE, LABELS_CONTAINER_STYLE } from './styles';

interface LabelInfo {
  element: HTMLElement;
  prefab: BasePrefab;
}

/**
 * Manages floating labels that appear above each building.
 * Labels can be toggled on/off and show the building name.
 * Distance-culled with fade from 25-30 units.
 */
export class LabelManager {
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private labelsContainer: HTMLElement;
  private labels: Map<string, LabelInfo> = new Map();
  private visible = false;

  private readonly MAX_DISTANCE = 30;
  private readonly FADE_START = 25;

  private tempV = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    this.labelsContainer = document.createElement('div');
    applyStyle(this.labelsContainer, LABELS_CONTAINER_STYLE);
    this.labelsContainer.style.display = 'none';
    container.appendChild(this.labelsContainer);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  setBuildings(prefabs: Map<string, BasePrefab>): void {
    this.clearLabels();

    for (const [id, prefab] of prefabs) {
      const building = prefab.getBuilding();
      const el = document.createElement('div');
      applyStyle(el, LABEL_STYLE);
      el.textContent = building.name || building.type;
      this.labelsContainer.appendChild(el);
      this.labels.set(id, { element: el, prefab });
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.labelsContainer.style.display = visible ? 'block' : 'none';
  }

  update(): void {
    if (!this.visible) {
      return;
    }

    this.camera.getWorldPosition(this.cameraPosition);

    for (const labelInfo of this.labels.values()) {
      this.updateLabelPosition(labelInfo);
    }
  }

  dispose(): void {
    this.clearLabels();
    this.labelsContainer.remove();
  }

  // ---------------------------------------------------------------------------
  // PRIVATE
  // ---------------------------------------------------------------------------

  private updateLabelPosition(labelInfo: LabelInfo): void {
    const el = labelInfo.element;
    const worldPos = labelInfo.prefab.getObject().position.clone();
    worldPos.y += 2.8;

    const distance = worldPos.distanceTo(this.cameraPosition);

    if (distance > this.MAX_DISTANCE) {
      el.style.visibility = 'hidden';
      return;
    }

    this.tempV.copy(worldPos);
    this.tempV.project(this.camera);

    if (Math.abs(this.tempV.z) > 1) {
      el.style.visibility = 'hidden';
      return;
    }

    const x = (this.tempV.x * 0.5 + 0.5) * this.canvas.clientWidth;
    const y = (this.tempV.y * -0.5 + 0.5) * this.canvas.clientHeight;

    let opacity = 1;
    if (distance > this.FADE_START) {
      opacity = 1 - (distance - this.FADE_START) / (this.MAX_DISTANCE - this.FADE_START);
    }

    el.style.visibility = 'visible';
    el.style.opacity = String(opacity);
    el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    el.style.zIndex = String(Math.floor(1000 - distance * 10));
  }

  private clearLabels(): void {
    for (const info of this.labels.values()) {
      info.element.remove();
    }
    this.labels.clear();
  }
}
