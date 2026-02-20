import * as THREE from 'three';

interface LineConnection {
  buildingId: string;
  buildingWorldPos: THREE.Vector3;
  popupElement: HTMLElement;
}

/**
 * Manages Tron-style neon lines connecting popups to their buildings.
 * Uses a Canvas 2D overlay for rendering glowing animated lines.
 */
export class PopupLineManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: THREE.PerspectiveCamera;
  private threeCanvas: HTMLCanvasElement;
  private connections: Map<string, LineConnection> = new Map();
  private animTime = 0;
  private tempV = new THREE.Vector3();

  // Tron colors
  private readonly CYAN = '#4fc3f7';
  private readonly MAGENTA = '#e040fb';

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera, threeCanvas: HTMLCanvasElement) {
    this.camera = camera;
    this.threeCanvas = threeCanvas;

    // Create canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'popup-lines-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 999;
    `;
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context for popup lines canvas');
    }
    this.ctx = ctx;
    this.resize();

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.resize();
  };

  resize(): void {
    this.canvas.width = this.threeCanvas.clientWidth;
    this.canvas.height = this.threeCanvas.clientHeight;
  }

  addConnection(buildingId: string, worldPos: THREE.Vector3, popupElement: HTMLElement): void {
    // worldPos comes with Y+2.5 offset (popup anchor point above building)
    // We want to connect to the actual building top, so subtract the offset
    const actualBuildingPos = worldPos.clone();
    actualBuildingPos.y -= 2.5;

    this.connections.set(buildingId, {
      buildingId,
      buildingWorldPos: actualBuildingPos,
      popupElement,
    });
  }

  removeConnection(buildingId: string): void {
    this.connections.delete(buildingId);
  }

  clearAll(): void {
    this.connections.clear();
  }

  update(deltaTime: number): void {
    this.animTime += deltaTime;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const conn of this.connections.values()) {
      this.drawLine(conn);
    }
  }

  private drawLine(conn: LineConnection): void {
    // Project building position to screen
    const buildingScreen = this.projectToScreen(conn.buildingWorldPos);
    if (!buildingScreen) return;

    // Get popup bottom center position
    const rect = conn.popupElement.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const popupX = rect.left + rect.width / 2 - canvasRect.left;
    const popupY = rect.bottom - canvasRect.top;

    // Draw glowing Tron line
    this.drawTronLine(
      buildingScreen.x,
      buildingScreen.y,
      popupX,
      popupY
    );
  }

  private drawTronLine(x1: number, y1: number, x2: number, y2: number): void {
    const ctx = this.ctx;

    // Animated pulse position (0-1)
    const pulsePos = (this.animTime * 0.8) % 1;

    // Create gradient for pulse effect
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, this.CYAN);
    gradient.addColorStop(Math.max(0, pulsePos - 0.15), this.CYAN);
    gradient.addColorStop(pulsePos, this.MAGENTA);
    gradient.addColorStop(Math.min(1, pulsePos + 0.15), this.CYAN);
    gradient.addColorStop(1, this.CYAN);

    // Draw outer glow (larger, more transparent)
    ctx.save();
    ctx.strokeStyle = this.CYAN;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.25;
    ctx.shadowColor = this.CYAN;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    // Draw main line with gradient pulse
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = this.CYAN;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    // Draw endpoint circles
    this.drawEndpoint(x1, y1, 6); // Building endpoint (larger)
    this.drawEndpoint(x2, y2, 4); // Popup endpoint (smaller)
  }

  private drawEndpoint(x: number, y: number, radius: number): void {
    const ctx = this.ctx;

    // Outer glow
    ctx.save();
    ctx.fillStyle = this.CYAN;
    ctx.globalAlpha = 0.3;
    ctx.shadowColor = this.CYAN;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner circle
    ctx.save();
    ctx.fillStyle = this.CYAN;
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = this.CYAN;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private projectToScreen(worldPosition: THREE.Vector3): { x: number; y: number } | null {
    this.tempV.copy(worldPosition);
    this.tempV.project(this.camera);

    // Hide if behind camera
    if (this.tempV.z > 1) return null;

    return {
      x: (this.tempV.x * 0.5 + 0.5) * this.canvas.width,
      y: (this.tempV.y * -0.5 + 0.5) * this.canvas.height,
    };
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.canvas.remove();
  }
}
