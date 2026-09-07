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
  // Cached layout size; only re-measured when the content changes, so the
  // per-frame positioning pass never forces a synchronous reflow.
  size: { width: number; height: number };
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

    this.hoverTooltip.replaceChildren();

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
      size: { width: 250, height: 150 },
    };
    entry.size = this.measureDetailSize(entry);

    this.detailTooltips.set(building.id, entry);
    this.setupDragHandlers(building.id, element);
    this.positionDetailTooltip(entry);
    this.lineManager.addConnection(building.id, position);
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
        // Content changed: the cached size is stale
        entry.size = this.measureDetailSize(entry);
      }
    }
  }

  update(): void {
    // Read pass: a single layout query up front. The canvas is inset:0 in the
    // container, so its client size is the container's positioning space.
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    const hover = this.hoverPosition ? this.projectToScreen(this.hoverPosition, width, height) : null;
    const detailPositions = new Map<string, { left: number; top: number } | null>();
    for (const [id, entry] of this.detailTooltips) {
      detailPositions.set(id, this.computeDetailPosition(entry, width, height));
    }

    // Write pass: no layout reads below this point
    if (this.hoverPosition) {
      this.applyHoverPosition(hover);
    }
    for (const [id, entry] of this.detailTooltips) {
      this.applyDetailPosition(id, entry, detailPositions.get(id) ?? null);
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
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', 'M18 6L6 18M6 6l12 12');
    svg.appendChild(path);
    closeBtn.appendChild(svg);
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
    this.applyHoverPosition(
      this.projectToScreen(this.hoverPosition, this.canvas.clientWidth, this.canvas.clientHeight)
    );
  }

  private applyHoverPosition(coords: { x: number; y: number; behindCamera: boolean } | null): void {
    if (coords && !coords.behindCamera) {
      this.hoverTooltip.style.left = `${coords.x}px`;
      this.hoverTooltip.style.top = `${coords.y}px`;
      this.hoverTooltip.style.opacity = '1';
    } else {
      this.hoverTooltip.style.opacity = '0';
    }
  }

  private positionDetailTooltip(entry: DetailTooltipEntry): void {
    const pos = this.computeDetailPosition(entry, this.canvas.clientWidth, this.canvas.clientHeight);
    this.applyDetailPosition(entry.building.id, entry, pos);
  }

  private computeDetailPosition(
    entry: DetailTooltipEntry,
    containerWidth: number,
    containerHeight: number
  ): { left: number; top: number } | null {
    const coords = this.projectToScreen(entry.position, containerWidth, containerHeight);
    if (!coords || coords.behindCamera) {
      return null;
    }

    const tooltipWidth = entry.size.width;
    const tooltipHeight = entry.size.height;
    const margin = 10;

    let baseLeft = coords.x - tooltipWidth / 2;
    let baseTop = coords.y - tooltipHeight - 15;

    if (baseTop < margin) {
      baseTop = coords.y + 15;
    }

    let left = baseLeft + entry.offset.x;
    let top = baseTop + entry.offset.y;

    left = Math.max(margin, Math.min(left, containerWidth - tooltipWidth - margin));
    top = Math.max(margin, Math.min(top, containerHeight - tooltipHeight - margin));

    return { left, top };
  }

  private applyDetailPosition(
    buildingId: string,
    entry: DetailTooltipEntry,
    pos: { left: number; top: number } | null
  ): void {
    if (!pos) {
      // Hide entirely, consistent with PopupLineManager which hides its line
      // (clamped edge coordinates are meaningless behind the camera)
      entry.element.style.display = 'none';
      this.lineManager.setPopupAnchor(buildingId, null);
      return;
    }

    entry.element.style.opacity = '1';
    entry.element.style.left = `${pos.left}px`;
    entry.element.style.top = `${pos.top}px`;
    entry.element.style.transform = 'none';
    entry.element.style.display = 'block';

    // Bottom-center of the popup, already in canvas coordinates (canvas is inset:0)
    this.lineManager.setPopupAnchor(buildingId, {
      x: pos.left + entry.size.width / 2,
      y: pos.top + entry.size.height,
    });
  }

  private measureDetailSize(entry: DetailTooltipEntry): { width: number; height: number } {
    return {
      width: entry.element.offsetWidth || 250,
      height: entry.element.offsetHeight || 150,
    };
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

  private projectToScreen(
    worldPosition: THREE.Vector3,
    width: number,
    height: number
  ): { x: number; y: number; behindCamera: boolean } | null {
    this.tempV.copy(worldPosition);
    this.tempV.project(this.camera);

    const behindCamera = this.tempV.z > 1;

    let x = (this.tempV.x * 0.5 + 0.5) * width;
    let y = (this.tempV.y * -0.5 + 0.5) * height;

    x = Math.max(0, Math.min(width, x));
    y = Math.max(0, Math.min(height, y));

    return { x, y, behindCamera };
  }
}
