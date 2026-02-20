import * as THREE from 'three';
import { Building, BuildingState } from '../types';
import { store } from '../state/store';
import { PopupLineManager } from './PopupLineManager';
import { authManager } from '../auth/AuthManager';

// BuildingState is used for status display in tooltips

interface PopupPositionResponse {
  building_id: string;
  offset_x: number;
  offset_y: number;
}

interface DetailTooltipEntry {
  element: HTMLElement;
  building: Building;
  position: THREE.Vector3;
  createdAt: number;
  offset: { x: number; y: number };
}

/**
 * Manages HTML tooltips that appear on hover and click on buildings.
 * - Hover tooltip: Mini tooltip with name + status
 * - Detail tooltip: Extended tooltip with description, tags, notes (max 4 simultaneous)
 */
export class TooltipManager {
  private container: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  private hoverTooltip: HTMLElement;

  // Multi-popup support: Map of buildingId -> tooltip entry
  private detailTooltips: Map<string, DetailTooltipEntry> = new Map();
  private maxDetailTooltips = 4;

  private hoverPosition: THREE.Vector3 | null = null;

  // Temporary vector for projections
  private tempV = new THREE.Vector3();

  // Line manager for Tron-style connections
  private lineManager: PopupLineManager;
  private clock = new THREE.Clock();

  // Cached popup positions per layout
  private cachedPositions: Map<string, { x: number; y: number }> = new Map();
  private loadedLayoutId: string | null = null;

  // Cleanup functions for drag event listeners
  private dragCleanupMap: Map<string, () => void> = new Map();

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.container = container;
    this.camera = camera;
    this.canvas = canvas;

    // Create hover tooltip element
    this.hoverTooltip = this.createHoverTooltip();
    container.appendChild(this.hoverTooltip);

    // Create line manager for popup-building connections
    this.lineManager = new PopupLineManager(container, camera, canvas);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  showHoverTooltip(building: Building, buildingState: BuildingState | null, worldPosition: THREE.Vector3): void {
    this.hoverPosition = worldPosition.clone();
    this.hoverPosition.y += 2.5; // Offset above building

    // Build content
    const name = building.name || building.type;
    const status = buildingState?.status || 'online';
    const statusColor = this.getStatusColor(status);

    this.hoverTooltip.innerHTML = `
      <div class="tooltip-name">${this.escapeHtml(name)}</div>
      <div class="tooltip-status">
        <span class="tooltip-status-dot" style="background-color: ${statusColor}"></span>
        <span>${status}</span>
      </div>
    `;

    this.hoverTooltip.style.display = 'block';
    this.updateHoverPosition();
  }

  hideHoverTooltip(): void {
    this.hoverPosition = null;
    this.hoverTooltip.style.display = 'none';
  }

  /**
   * Show detail tooltip for a building. Supports up to 4 simultaneous tooltips.
   * If already showing for this building, does nothing.
   * If 4 tooltips are shown, removes the oldest one.
   */
  async showDetailTooltip(building: Building, buildingState: BuildingState | null, worldPosition: THREE.Vector3): Promise<void> {
    // Hide hover tooltip when showing detail
    this.hideHoverTooltip();

    // Check if already showing for this building
    if (this.detailTooltips.has(building.id)) {
      return;
    }

    // If at max capacity, remove the oldest tooltip
    if (this.detailTooltips.size >= this.maxDetailTooltips) {
      this.removeOldestDetailTooltip();
    }

    // Load positions for current layout if not already loaded
    const layout = store.getActiveLayout();
    if (layout && layout.id !== this.loadedLayoutId) {
      await this.loadPositionsForLayout(layout.id);
    }

    const position = worldPosition.clone();
    position.y += 2.5;

    const element = this.createDetailTooltipElement(building, buildingState);
    this.container.appendChild(element);

    // Get cached position offset if available
    const cachedOffset = this.cachedPositions.get(building.id);
    const offset = cachedOffset ? { x: cachedOffset.x, y: cachedOffset.y } : { x: 0, y: 0 };

    const entry: DetailTooltipEntry = {
      element,
      building,
      position,
      createdAt: Date.now(),
      offset,
    };

    this.detailTooltips.set(building.id, entry);

    // Setup drag handlers
    this.setupDragHandlers(building.id, element);

    this.updateDetailPosition(building.id);

    // Add line connection from popup to building
    this.lineManager.addConnection(building.id, position, element);
  }

  /**
   * Hide detail tooltip for a specific building
   */
  hideDetailTooltip(buildingId?: string): void {
    if (buildingId) {
      // Hide specific tooltip
      const entry = this.detailTooltips.get(buildingId);
      if (entry) {
        // Cleanup drag listeners before removing element
        const cleanup = this.dragCleanupMap.get(buildingId);
        if (cleanup) {
          cleanup();
          this.dragCleanupMap.delete(buildingId);
        }
        entry.element.remove();
        this.detailTooltips.delete(buildingId);
        this.lineManager.removeConnection(buildingId);
      }
    } else {
      // Legacy: hide all (for backwards compatibility with click elsewhere)
      this.hideAllDetailTooltips();
    }
  }

  /**
   * Hide all detail tooltips
   */
  hideAllDetailTooltips(): void {
    // Cleanup all drag listeners
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

  /**
   * Close tooltips by building IDs
   */
  closeDetailTooltips(buildingIds: string[]): void {
    for (const id of buildingIds) {
      this.hideDetailTooltip(id);
    }
  }

  isDetailVisible(): boolean {
    return this.detailTooltips.size > 0;
  }

  isDetailVisibleForBuilding(buildingId: string): boolean {
    return this.detailTooltips.has(buildingId);
  }

  getDetailBuilding(): Building | null {
    // Legacy: return first building for backwards compatibility
    const first = this.detailTooltips.values().next().value;
    return first?.building || null;
  }

  getOpenDetailBuildingIds(): string[] {
    return Array.from(this.detailTooltips.keys());
  }

  /**
   * Update an existing detail tooltip when building data changes (name, description, tags, notes).
   * Called by SceneManager when layout updates are received via WebSocket.
   */
  updateBuilding(building: Building): void {
    const entry = this.detailTooltips.get(building.id);
    if (!entry) return; // No tooltip open for this building

    // Update stored building reference
    entry.building = building;

    // Get current state for status display
    const buildingState = store.getBuildingState(building.id);

    // Regenerate tooltip content
    const newElement = this.createDetailTooltipElement(building, buildingState);

    // Copy position styles from old element
    newElement.style.left = entry.element.style.left;
    newElement.style.top = entry.element.style.top;
    newElement.style.opacity = entry.element.style.opacity;
    newElement.style.display = entry.element.style.display;

    // Replace old element with new one
    entry.element.replaceWith(newElement);
    entry.element = newElement;
  }

  /**
   * Update tooltip positions based on camera. Call in render loop.
   */
  update(): void {
    if (this.hoverPosition) {
      this.updateHoverPosition();
    }
    for (const [buildingId] of this.detailTooltips) {
      this.updateDetailPosition(buildingId);
    }

    // Update line animations
    const deltaTime = this.clock.getDelta();
    this.lineManager.update(deltaTime);
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

    const onMouseDown = (e: MouseEvent): void => {
      // Don't drag if clicking close button
      if ((e.target as HTMLElement).closest('.tooltip-close')) return;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const entry = this.detailTooltips.get(buildingId);
      if (entry) {
        offsetStartX = entry.offset.x;
        offsetStartY = entry.offset.y;
      }

      element.style.cursor = 'grabbing';
      element.classList.add('dragging');
      e.preventDefault();
      e.stopPropagation(); // Prevent camera from panning
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (!isDragging) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      const entry = this.detailTooltips.get(buildingId);
      if (entry) {
        entry.offset.x = offsetStartX + dx;
        entry.offset.y = offsetStartY + dy;
      }

      e.stopPropagation(); // Prevent camera from panning
    };

    const onMouseUp = (): void => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'grab';
        element.classList.remove('dragging');

        // Save position to backend (will be implemented with persistence)
        this.savePopupPosition(buildingId);
      }
    };

    // Setup cursor
    element.style.cursor = 'grab';

    // Add listeners
    element.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store cleanup function to remove listeners when tooltip is closed
    const cleanup = (): void => {
      element.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    this.dragCleanupMap.set(buildingId, cleanup);
  }

  private async savePopupPosition(buildingId: string): Promise<void> {
    const entry = this.detailTooltips.get(buildingId);
    if (!entry) return;

    const layout = store.getActiveLayout();
    if (!layout) return;

    // Update cache
    this.cachedPositions.set(buildingId, { x: entry.offset.x, y: entry.offset.y });

    // Send to backend API
    try {
      const response = await fetch('/ui/popup/position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeaders(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          layout_id: layout.id,
          building_id: buildingId,
          offset_x: entry.offset.x,
          offset_y: entry.offset.y,
        }),
      });

      if (!response.ok) {
        console.error(`[TooltipManager] Failed to save popup position: ${response.status}`);
      }
    } catch (error) {
      console.error('[TooltipManager] Error saving popup position:', error);
    }
  }

  /**
   * Load popup positions for a layout from the backend
   */
  private async loadPositionsForLayout(layoutId: string): Promise<void> {
    this.loadedLayoutId = layoutId;
    this.cachedPositions.clear();

    try {
      const response = await fetch(`/ui/popup/positions/${layoutId}`, {
        method: 'GET',
        headers: authManager.getAuthHeaders(),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        console.error(`[TooltipManager] Failed to load popup positions: ${response.status}`);
        return;
      }

      const positions: PopupPositionResponse[] = await response.json();
      for (const pos of positions) {
        this.cachedPositions.set(pos.building_id, { x: pos.offset_x, y: pos.offset_y });
      }
    } catch (error) {
      console.error('[TooltipManager] Error loading popup positions:', error);
    }
  }

  /**
   * Clear cached positions (call when layout changes)
   */
  clearPositionCache(): void {
    this.cachedPositions.clear();
    this.loadedLayoutId = null;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private createHoverTooltip(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tooltip-hover';
    el.style.display = 'none';
    return el;
  }

  private createDetailTooltipElement(building: Building, buildingState: BuildingState | null): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tooltip-detail';
    el.dataset.buildingId = building.id;

    const name = building.name || building.type;
    const status = buildingState?.status || 'online';
    const statusColor = this.getStatusColor(status);
    const description = building.description || '';
    const tags = building.tags || [];
    const notes = building.notes || '';

    let tagsHtml = '';
    if (tags.length > 0) {
      tagsHtml = `
        <div class="tooltip-section">
          <div class="tooltip-label">Tags</div>
          <div class="tooltip-tags">
            ${tags.map(tag => `<span class="tooltip-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    let descriptionHtml = '';
    if (description) {
      descriptionHtml = `
        <div class="tooltip-section">
          <div class="tooltip-label">Description</div>
          <div class="tooltip-text">${this.escapeHtml(description)}</div>
        </div>
      `;
    }

    let notesHtml = '';
    if (notes) {
      notesHtml = `
        <div class="tooltip-section">
          <div class="tooltip-label">Notes</div>
          <div class="tooltip-text tooltip-notes">${this.escapeHtml(notes)}</div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="tooltip-header">
        <div class="tooltip-header-left">
          <span class="tooltip-name">${this.escapeHtml(name)}</span>
          <span class="tooltip-type">${building.type}</span>
        </div>
        <div class="tooltip-header-right">
          <span class="tooltip-status-dot" style="background-color: ${statusColor}"></span>
          <button class="tooltip-close" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      ${descriptionHtml}
      ${tagsHtml}
      ${notesHtml}
      ${!description && tags.length === 0 && !notes ? '<div class="tooltip-empty">No additional information</div>' : ''}
    `;

    // Add close button handler
    const closeBtn = el.querySelector('.tooltip-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideDetailTooltip(building.id);
      });
    }

    return el;
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

  private updateHoverPosition(): void {
    if (!this.hoverPosition) return;

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
    if (!entry) return;

    const coords = this.projectToScreen(entry.position);
    if (!coords) {
      entry.element.style.opacity = '0.3';
      return;
    }

    const containerRect = this.container.getBoundingClientRect();
    const tooltipWidth = entry.element.offsetWidth || 280;
    const tooltipHeight = entry.element.offsetHeight || 150;
    const margin = 10;

    // Base position: center horizontally on building position
    let baseLeft = coords.x - tooltipWidth / 2;
    let baseTop = coords.y - tooltipHeight - 15;

    // If would go above screen, place below the building position
    if (baseTop < margin) {
      baseTop = coords.y + 15;
    }

    // Apply drag offset
    let left = baseLeft + entry.offset.x;
    let top = baseTop + entry.offset.y;

    // Clamp to screen bounds
    left = Math.max(margin, Math.min(left, containerRect.width - tooltipWidth - margin));
    top = Math.max(margin, Math.min(top, containerRect.height - tooltipHeight - margin));

    // If building is behind camera, reduce opacity
    if (coords.behindCamera) {
      entry.element.style.opacity = '0.4';
    } else {
      entry.element.style.opacity = '1';
    }

    entry.element.style.left = `${left}px`;
    entry.element.style.top = `${top}px`;
    entry.element.style.transform = 'none';
    entry.element.style.display = 'block';
  }

  private projectToScreen(worldPosition: THREE.Vector3): { x: number; y: number; behindCamera: boolean } | null {
    this.tempV.copy(worldPosition);
    this.tempV.project(this.camera);

    const behindCamera = this.tempV.z > 1;

    // Even if behind camera, calculate screen coords (clamped to edges)
    let x = (this.tempV.x * 0.5 + 0.5) * this.canvas.clientWidth;
    let y = (this.tempV.y * -0.5 + 0.5) * this.canvas.clientHeight;

    // Clamp to viewport for off-screen positions
    x = Math.max(0, Math.min(this.canvas.clientWidth, x));
    y = Math.max(0, Math.min(this.canvas.clientHeight, y));

    return { x, y, behindCamera };
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'online':
        return '#00ff88';
      case 'offline':
        return '#666688';
      case 'warning':
        return '#ffaa00';
      case 'critical':
        return '#ff4444';
      default:
        return '#00ff88';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
