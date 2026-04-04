import * as THREE from 'three';
import { Building, BuildingState, BuildingStatus } from '../types';
import { PopupLineManager } from './PopupLineManager';
import {
  STATUS_COLORS,
  applyStyle,
  HOVER_TOOLTIP_STYLE,
  DETAIL_TOOLTIP_STYLE,
  DETAIL_HEADER_STYLE,
  DETAIL_BODY_STYLE,
  DETAIL_SECTION_STYLE,
  DETAIL_LABEL_STYLE,
  DETAIL_VALUE_STYLE,
  DETAIL_CLOSE_STYLE,
  STATUS_DOT_STYLE,
} from './styles';

interface DetailTooltipEntry {
  element: HTMLElement;
  building: Building;
  state: BuildingState | null;
  position: THREE.Vector3;
  createdAt: number;
  offset: { x: number; y: number };
}

/**
 * Manages HTML tooltips that appear on hover and click on buildings.
 * - Hover tooltip: Mini tooltip with name + status
 * - Detail tooltip: Extended tooltip with status, activity, data fields (max 4 simultaneous)
 */
export class TooltipManager {
  private container: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  private hoverTooltip: HTMLElement;
  private hoverPosition: THREE.Vector3 | null = null;

  private detailTooltips: Map<string, DetailTooltipEntry> = new Map();
  private maxDetailTooltips = 4;

  private tempV = new THREE.Vector3();
  private lineManager: PopupLineManager;
  private clock = new THREE.Clock();

  private dragCleanupMap: Map<string, () => void> = new Map();

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.container = container;
    this.camera = camera;
    this.canvas = canvas;

    this.hoverTooltip = document.createElement('div');
    applyStyle(this.hoverTooltip, HOVER_TOOLTIP_STYLE);
    container.appendChild(this.hoverTooltip);

    this.lineManager = new PopupLineManager(container, camera, canvas);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  showHoverTooltip(building: Building, state: BuildingState | null, worldPosition: THREE.Vector3): void {
    this.hoverPosition = worldPosition.clone();
    this.hoverPosition.y += 2.5;

    const name = building.name || building.type;
    const status: BuildingStatus = state?.status || 'online';
    const color = STATUS_COLORS[status];

    this.hoverTooltip.innerHTML = '';

    const nameEl = document.createElement('div');
    nameEl.style.fontWeight = '600';
    nameEl.style.marginBottom = '2px';
    nameEl.textContent = name;

    const statusRow = document.createElement('div');
    statusRow.style.display = 'flex';
    statusRow.style.alignItems = 'center';

    const dot = document.createElement('span');
    applyStyle(dot, STATUS_DOT_STYLE);
    dot.style.backgroundColor = color;

    const statusText = document.createElement('span');
    statusText.textContent = status;

    statusRow.appendChild(dot);
    statusRow.appendChild(statusText);

    this.hoverTooltip.appendChild(nameEl);
    this.hoverTooltip.appendChild(statusRow);

    this.hoverTooltip.style.display = 'block';
    this.updateHoverPosition();
  }

  hideHoverTooltip(): void {
    this.hoverPosition = null;
    this.hoverTooltip.style.display = 'none';
  }

  showDetailTooltip(building: Building, state: BuildingState | null, worldPosition: THREE.Vector3): void {
    this.hideHoverTooltip();

    if (this.detailTooltips.has(building.id)) {
      return;
    }

    if (this.detailTooltips.size >= this.maxDetailTooltips) {
      this.removeOldestDetailTooltip();
    }

    const position = worldPosition.clone();
    position.y += 2.5;

    const element = this.createDetailElement(building, state);
    this.container.appendChild(element);

    const entry: DetailTooltipEntry = {
      element,
      building,
      state,
      position,
      createdAt: Date.now(),
      offset: { x: 0, y: 0 },
    };

    this.detailTooltips.set(building.id, entry);
    this.setupDragHandlers(building.id, element);
    this.updateDetailPosition(building.id);
    this.lineManager.addConnection(building.id, position, element);
  }

  hideDetailTooltip(buildingId: string): void {
    const entry = this.detailTooltips.get(buildingId);
    if (!entry) {
      return;
    }
    const cleanup = this.dragCleanupMap.get(buildingId);
    if (cleanup) {
      cleanup();
      this.dragCleanupMap.delete(buildingId);
    }
    entry.element.remove();
    this.detailTooltips.delete(buildingId);
    this.lineManager.removeConnection(buildingId);
  }

  hideAllDetailTooltips(): void {
    for (const [, cleanup] of this.dragCleanupMap) {
      cleanup();
    }
    this.dragCleanupMap.clear();
    for (const [, entry] of this.detailTooltips) {
      entry.element.remove();
    }
    this.detailTooltips.clear();
    this.lineManager.clearAll();
  }

  isDetailVisibleForBuilding(buildingId: string): boolean {
    return this.detailTooltips.has(buildingId);
  }

  refreshDetailTooltips(states: Map<string, BuildingState>): void {
    for (const [buildingId, entry] of this.detailTooltips) {
      const newState = states.get(buildingId);
      if (newState !== undefined) {
        // Update status dot color in the header
        const header = entry.element.firstElementChild as HTMLElement | null;
        if (header) {
          const dot = header.querySelector('span') as HTMLElement | null;
          if (dot) {
            const status: BuildingStatus = newState.status || 'online';
            dot.style.backgroundColor = STATUS_COLORS[status];
          }
        }
        // Replace body content with updated data
        const oldBody = entry.element.children[1] as HTMLElement | undefined;
        if (oldBody) {
          oldBody.remove();
        }
        entry.element.appendChild(this.buildBody(newState));
        entry.state = newState;
      }
    }
  }

  update(): void {
    if (this.hoverPosition) {
      this.updateHoverPosition();
    }
    for (const [id] of this.detailTooltips) {
      this.updateDetailPosition(id);
    }
    const dt = this.clock.getDelta();
    this.lineManager.update(dt);
  }

  resize(): void {
    this.lineManager.resize();
  }

  dispose(): void {
    this.hoverTooltip.remove();
    this.hideAllDetailTooltips();
    this.lineManager.dispose();
  }

  // ---------------------------------------------------------------------------
  // DRAG HANDLING
  // ---------------------------------------------------------------------------

  private setupDragHandlers(buildingId: string, element: HTMLElement): void {
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let offsetStartX = 0;
    let offsetStartY = 0;

    const header = element.firstElementChild as HTMLElement | null;
    const dragTarget = header || element;

    const onMouseDown = (e: MouseEvent): void => {
      if ((e.target as HTMLElement).closest('[data-close]')) {
        return;
      }
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const entry = this.detailTooltips.get(buildingId);
      if (entry) {
        offsetStartX = entry.offset.x;
        offsetStartY = entry.offset.y;
      }
      dragTarget.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (!isDragging) {
        return;
      }
      const entry = this.detailTooltips.get(buildingId);
      if (entry) {
        entry.offset.x = offsetStartX + (e.clientX - dragStartX);
        entry.offset.y = offsetStartY + (e.clientY - dragStartY);
      }
      e.stopPropagation();
    };

    const onMouseUp = (): void => {
      if (isDragging) {
        isDragging = false;
        dragTarget.style.cursor = 'grab';
      }
    };

    dragTarget.style.cursor = 'grab';
    dragTarget.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    this.dragCleanupMap.set(buildingId, () => {
      dragTarget.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    });
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — TOOLTIP CREATION
  // ---------------------------------------------------------------------------

  private createDetailElement(building: Building, state: BuildingState | null): HTMLElement {
    const el = document.createElement('div');
    applyStyle(el, DETAIL_TOOLTIP_STYLE);

    // Header
    const header = document.createElement('div');
    applyStyle(header, DETAIL_HEADER_STYLE);

    const headerLeft = document.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.alignItems = 'center';
    headerLeft.style.gap = '6px';
    headerLeft.style.overflow = 'hidden';

    const status: BuildingStatus = state?.status || 'online';
    const dot = document.createElement('span');
    applyStyle(dot, STATUS_DOT_STYLE);
    dot.style.backgroundColor = STATUS_COLORS[status];
    dot.style.flexShrink = '0';

    const nameSpan = document.createElement('span');
    nameSpan.style.fontWeight = '600';
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.textContent = building.name || building.type;

    const typeSpan = document.createElement('span');
    typeSpan.style.color = '#888';
    typeSpan.style.fontSize = '10px';
    typeSpan.style.flexShrink = '0';
    typeSpan.textContent = building.type;

    headerLeft.appendChild(dot);
    headerLeft.appendChild(nameSpan);
    headerLeft.appendChild(typeSpan);

    const closeBtn = document.createElement('button');
    applyStyle(closeBtn, DETAIL_CLOSE_STYLE);
    closeBtn.setAttribute('data-close', 'true');
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideDetailTooltip(building.id);
    });

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    el.appendChild(header);

    el.appendChild(this.buildBody(state));
    return el;
  }

  private buildBody(state: BuildingState | null): HTMLElement {
    const body = document.createElement('div');
    applyStyle(body, DETAIL_BODY_STYLE);

    const status: BuildingStatus = state?.status || 'online';
    this.addSection(body, 'Status', status);
    if (state?.activity) {
      this.addSection(body, 'Activity', state.activity);
    }
    if (state?.text1) {
      this.addSection(body, 'Info', state.text1);
    }
    if (state?.text2) {
      this.addSection(body, 'Detail', state.text2);
    }
    if (state?.text3) {
      this.addSection(body, 'Extra', state.text3);
    }
    if (state?.cpuUsage !== undefined) {
      this.addSection(body, 'CPU', `${state.cpuUsage.toFixed(1)}%`);
    }
    if (state?.ramUsage !== undefined) {
      this.addSection(body, 'RAM', `${state.ramUsage.toFixed(1)}%`);
    }

    return body;
  }

  private addSection(parent: HTMLElement, label: string, value: string): void {
    const section = document.createElement('div');
    applyStyle(section, DETAIL_SECTION_STYLE);

    const labelEl = document.createElement('div');
    applyStyle(labelEl, DETAIL_LABEL_STYLE);
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    applyStyle(valueEl, DETAIL_VALUE_STYLE);
    valueEl.textContent = value;

    section.appendChild(labelEl);
    section.appendChild(valueEl);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — POSITIONING
  // ---------------------------------------------------------------------------

  private updateHoverPosition(): void {
    if (!this.hoverPosition) {
      return;
    }
    const coords = this.projectToScreen(this.hoverPosition);
    if (coords && !coords.behindCamera) {
      this.hoverTooltip.style.left = `${coords.x}px`;
      this.hoverTooltip.style.top = `${coords.y}px`;
      this.hoverTooltip.style.opacity = '1';
    } else {
      this.hoverTooltip.style.opacity = '0';
    }
  }

  private updateDetailPosition(buildingId: string): void {
    const entry = this.detailTooltips.get(buildingId);
    if (!entry) {
      return;
    }

    const coords = this.projectToScreen(entry.position);
    if (!coords) {
      entry.element.style.opacity = '0.3';
      return;
    }

    const containerRect = this.container.getBoundingClientRect();
    const tooltipWidth = entry.element.offsetWidth || 250;
    const tooltipHeight = entry.element.offsetHeight || 150;
    const margin = 10;

    let baseLeft = coords.x - tooltipWidth / 2;
    let baseTop = coords.y - tooltipHeight - 15;

    if (baseTop < margin) {
      baseTop = coords.y + 15;
    }

    let left = baseLeft + entry.offset.x;
    let top = baseTop + entry.offset.y;

    left = Math.max(margin, Math.min(left, containerRect.width - tooltipWidth - margin));
    top = Math.max(margin, Math.min(top, containerRect.height - tooltipHeight - margin));

    entry.element.style.opacity = coords.behindCamera ? '0.4' : '1';
    entry.element.style.left = `${left}px`;
    entry.element.style.top = `${top}px`;
    entry.element.style.transform = 'none';
    entry.element.style.display = 'block';
  }

  private removeOldestDetailTooltip(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, entry] of this.detailTooltips) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestId = id;
      }
    }
    if (oldestId) {
      this.hideDetailTooltip(oldestId);
    }
  }

  private projectToScreen(worldPosition: THREE.Vector3): { x: number; y: number; behindCamera: boolean } | null {
    this.tempV.copy(worldPosition);
    this.tempV.project(this.camera);

    const behindCamera = this.tempV.z > 1;

    let x = (this.tempV.x * 0.5 + 0.5) * this.canvas.clientWidth;
    let y = (this.tempV.y * -0.5 + 0.5) * this.canvas.clientHeight;

    x = Math.max(0, Math.min(this.canvas.clientWidth, x));
    y = Math.max(0, Math.min(this.canvas.clientHeight, y));

    return { x, y, behindCamera };
  }
}
