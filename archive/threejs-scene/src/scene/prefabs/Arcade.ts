import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

// Fixed color palette (previously from MOOD_COLORS.calm)
const PRIMARY_COLOR = 0x00ffff;   // Cyan
const SECONDARY_COLOR = 0x0066ff; // Blue
import { SnakeGame, InvadersGame } from './ArcadeSideGames';

/**
 * Arcade Prefab - Cyberpunk Storefront Style
 *
 * A 1x2 grid building shaped like an arcade storefront featuring:
 * - Neon "ARCADE" sign at top with pulse effect
 * - LED FFT band (32 bars) across the facade
 * - Glass storefront with 3 arcade cabinet silhouettes (each with mini-FFT)
 * - Neon-framed entrance door
 * - Mood-based color palette (calm=blue, active=green, tension=orange, critical=red, epic=gold)
 *
 * Inspired by Blade Runner / Cyberpunk aesthetics
 */

// ============================================================================
// ARCADE STATE INTERFACE
// ============================================================================

export interface ArcadeState {
  musicEnabled: boolean;
  signText: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Building dimensions (1x2 footprint)
const WIDTH = 1.0;
const DEPTH = 2.0;
const TOTAL_HEIGHT = 3.5;

// Vertical sections
const BASE_HEIGHT = 0.1;
const STOREFRONT_HEIGHT = 1.8;
const LED_BAND_HEIGHT = 0.3;
const SIGN_SECTION_HEIGHT = 0.8;

// LED band config
const LED_BAR_COUNT = 32;
const LED_BAR_WIDTH = (WIDTH - 0.1) / LED_BAR_COUNT;
const LED_MAX_HEIGHT = 0.25;
const LED_MIN_HEIGHT = 0.03;

// Cabinet silhouettes in storefront
const CABINET_COUNT = 3;
const CABINET_WIDTH = 0.22;
const CABINET_HEIGHT = 0.9;
const CABINET_DEPTH = 0.15;
const MINI_FFT_BARS = 6;

// ============================================================================
// ARCADE PREFAB CLASS
// ============================================================================

export class ArcadePrefab extends BasePrefab {
  // Building structure
  private buildingBody!: THREE.Mesh;
  private storefrontGlass!: THREE.Mesh;
  private ledBandGroup!: THREE.Group;
  private signGroup!: THREE.Group;
  private doorFrame!: THREE.Group;

  // LED FFT bars (32)
  private ledBars!: THREE.InstancedMesh;
  private ledDummy = new THREE.Object3D();
  private ledHeights: number[] = [];
  private ledTargetHeights: number[] = [];

  // Cabinet silhouettes (3)
  private cabinets: THREE.Group[] = [];
  private cabinetScreens: THREE.Mesh[][] = []; // Mini-FFT screens per cabinet

  // Neon sign
  private signLetterMeshes: THREE.Mesh[] = [];
  private signText = "FAX'S ARCADE";
  private signGlitchTimer = 0;
  private signGlitchActive = false;

  // Neon edges
  private neonEdges: THREE.Line[] = [];

  // Side panel games
  private snakeGame: SnakeGame | null = null;
  private invadersGame: InvadersGame | null = null;

  // Windows above sign
  private windowFrames: THREE.Mesh[] = [];

  // Elevator on back wall
  private elevatorTrack!: THREE.Line;
  private elevatorCursor!: THREE.Mesh;
  private elevatorPosition = 0;

  // State
  private musicEnabled = true;
  private animTime = 0;

  // Fixed colors
  private primaryColor = PRIMARY_COLOR;
  private secondaryColor = SECONDARY_COLOR;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBuildingStructure();
    this.createStorefront();
    this.createLEDBand();
    this.createCabinetSilhouettes();
    this.createNeonSign();
    this.createDoorFrame();
    this.createNeonEdges();
    this.createSideGames();
    this.createWindows();
    this.createElevator();

    // Status indicator on top
    const statusLight = this.createGlowPoint(0, TOTAL_HEIGHT + 0.1, DEPTH * 0.3, COLORS.state.online, 0.06);
    this.group.add(statusLight);
  }

  // ==========================================================================
  // BUILDING STRUCTURE
  // ==========================================================================

  private createBuildingStructure(): void {
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      metalness: 0.7,
      roughness: 0.3,
    });

    // Main building body (back wall and sides)
    const bodyGeo = new THREE.BoxGeometry(WIDTH, TOTAL_HEIGHT, DEPTH);
    this.buildingBody = new THREE.Mesh(bodyGeo, darkMetal);
    this.buildingBody.position.y = TOTAL_HEIGHT / 2;
    this.buildingBody.castShadow = true;
    this.buildingBody.receiveShadow = true;
    this.group.add(this.buildingBody);

    // Base platform (slightly larger)
    const baseGeo = new THREE.BoxGeometry(WIDTH + 0.1, BASE_HEIGHT, DEPTH + 0.1);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.9,
      roughness: 0.1,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = BASE_HEIGHT / 2;
    base.receiveShadow = true;
    this.group.add(base);
  }

  // ==========================================================================
  // STOREFRONT (Glass with tint)
  // ==========================================================================

  private createStorefront(): void {
    // Glass panel (front face)
    const glassGeo = new THREE.PlaneGeometry(WIDTH - 0.1, STOREFRONT_HEIGHT);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      transparent: true,
      opacity: 0.4,
      metalness: 0.2,
      roughness: 0.1,
      side: THREE.DoubleSide,
    });

    this.storefrontGlass = new THREE.Mesh(glassGeo, glassMat);
    this.storefrontGlass.position.set(0, BASE_HEIGHT + STOREFRONT_HEIGHT / 2, DEPTH / 2 + 0.01);
    this.group.add(this.storefrontGlass);

    // Glass frame (neon outline)
    this.addGlassFrame();
  }

  private addGlassFrame(): void {
    const frameMat = new THREE.MeshBasicMaterial({
      color: this.primaryColor,
      transparent: true,
      opacity: 0.7,
    });

    const frameWidth = 0.02;
    const hw = (WIDTH - 0.1) / 2;
    const hh = STOREFRONT_HEIGHT / 2;
    const z = DEPTH / 2 + 0.02;
    const cy = BASE_HEIGHT + STOREFRONT_HEIGHT / 2;

    // Horizontal bars
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(WIDTH - 0.1, frameWidth, frameWidth), frameMat);
    topBar.position.set(0, cy + hh, z);
    this.group.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(WIDTH - 0.1, frameWidth, frameWidth), frameMat.clone());
    bottomBar.position.set(0, cy - hh, z);
    this.group.add(bottomBar);

    // Vertical bars
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, STOREFRONT_HEIGHT, frameWidth), frameMat.clone());
    leftBar.position.set(-hw, cy, z);
    this.group.add(leftBar);

    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, STOREFRONT_HEIGHT, frameWidth), frameMat.clone());
    rightBar.position.set(hw, cy, z);
    this.group.add(rightBar);
  }

  // ==========================================================================
  // LED FFT BAND (32 vertical bars)
  // ==========================================================================

  private createLEDBand(): void {
    this.ledBandGroup = new THREE.Group();
    this.ledBandGroup.position.y = BASE_HEIGHT + STOREFRONT_HEIGHT;
    this.ledBandGroup.position.z = DEPTH / 2;
    this.group.add(this.ledBandGroup);

    // Background panel
    const bgGeo = new THREE.BoxGeometry(WIDTH, LED_BAND_HEIGHT, 0.05);
    const bgMat = new THREE.MeshStandardMaterial({
      color: 0x050508,
      metalness: 0.8,
      roughness: 0.2,
    });
    const bgPanel = new THREE.Mesh(bgGeo, bgMat);
    bgPanel.position.y = LED_BAND_HEIGHT / 2;
    this.ledBandGroup.add(bgPanel);

    // LED bars (instanced mesh)
    const barGeo = new THREE.BoxGeometry(LED_BAR_WIDTH * 0.8, 1, 0.02);
    const barMat = new THREE.MeshBasicMaterial({
      color: this.primaryColor,
      transparent: true,
      opacity: 0.9,
    });

    this.ledBars = new THREE.InstancedMesh(barGeo, barMat, LED_BAR_COUNT);
    this.ledBars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize bars
    for (let i = 0; i < LED_BAR_COUNT; i++) {
      this.ledHeights[i] = LED_MIN_HEIGHT;
      this.ledTargetHeights[i] = LED_MIN_HEIGHT;

      // Set gradient color
      this.setLEDBarColor(i, i / (LED_BAR_COUNT - 1));
    }

    this.updateLEDMatrices();
    this.ledBandGroup.add(this.ledBars);
  }

  private setLEDBarColor(index: number, t: number): void {
    const color = new THREE.Color();
    color.lerpColors(new THREE.Color(this.primaryColor), new THREE.Color(this.secondaryColor), t);
    this.ledBars.setColorAt(index, color);
  }

  private updateLEDMatrices(): void {
    const startX = -WIDTH / 2 + LED_BAR_WIDTH / 2 + 0.05;
    for (let i = 0; i < LED_BAR_COUNT; i++) {
      const x = startX + i * LED_BAR_WIDTH;
      const h = this.ledHeights[i];

      this.ledDummy.position.set(x, 0.02 + h / 2, 0.03);
      this.ledDummy.scale.set(1, h, 1);
      this.ledDummy.updateMatrix();
      this.ledBars.setMatrixAt(i, this.ledDummy.matrix);
    }
    this.ledBars.instanceMatrix.needsUpdate = true;
  }

  // ==========================================================================
  // CABINET SILHOUETTES (3 with mini-FFT)
  // ==========================================================================

  private createCabinetSilhouettes(): void {
    const spacing = (WIDTH - 0.2) / CABINET_COUNT;
    const startX = -WIDTH / 2 + spacing / 2 + 0.1;
    const cabinetY = BASE_HEIGHT + 0.1;
    const cabinetZ = DEPTH / 2 - CABINET_DEPTH / 2 - 0.1;

    for (let c = 0; c < CABINET_COUNT; c++) {
      const cabinet = this.createCabinetSilhouette();
      cabinet.position.set(startX + c * spacing, cabinetY, cabinetZ);
      this.cabinets.push(cabinet);
      this.group.add(cabinet);
    }
  }

  private createCabinetSilhouette(): THREE.Group {
    const cabinet = new THREE.Group();

    // Cabinet body (dark silhouette)
    const bodyMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a15,
      transparent: true,
      opacity: 0.95,
    });

    // Main body
    const bodyGeo = new THREE.BoxGeometry(CABINET_WIDTH, CABINET_HEIGHT, CABINET_DEPTH);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = CABINET_HEIGHT / 2;
    cabinet.add(body);

    // Screen area (glowing)
    const screenWidth = CABINET_WIDTH * 0.7;
    const screenHeight = CABINET_HEIGHT * 0.4;
    const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const screenMat = new THREE.MeshBasicMaterial({
      color: this.secondaryColor,
      transparent: true,
      opacity: 0.6,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, CABINET_HEIGHT * 0.6, CABINET_DEPTH / 2 + 0.01);
    this.addGlowMesh(screen);
    cabinet.add(screen);

    // Mini-FFT bars on screen
    const miniFFTBars: THREE.Mesh[] = [];
    const barWidth = screenWidth / (MINI_FFT_BARS + 1);
    const barStartX = -screenWidth / 2 + barWidth;

    for (let i = 0; i < MINI_FFT_BARS; i++) {
      const barGeo = new THREE.BoxGeometry(barWidth * 0.7, 0.01, 0.01);
      const barMat = new THREE.MeshBasicMaterial({
        color: this.primaryColor,
        transparent: true,
        opacity: 0.9,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(barStartX + i * barWidth, CABINET_HEIGHT * 0.5, CABINET_DEPTH / 2 + 0.02);
      bar.userData.baseY = bar.position.y;
      bar.userData.index = i;
      miniFFTBars.push(bar);
      cabinet.add(bar);
    }

    this.cabinetScreens.push(miniFFTBars);

    // Backlight glow
    const glowGeo = new THREE.PlaneGeometry(CABINET_WIDTH * 0.9, CABINET_HEIGHT * 0.5);
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.secondaryColor,
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, CABINET_HEIGHT * 0.55, CABINET_DEPTH / 2 - 0.02);
    cabinet.add(glow);

    return cabinet;
  }

  // ==========================================================================
  // NEON SIGN ("FAX'S ARCADE") - 3D Text
  // ==========================================================================

  private createNeonSign(): void {
    this.signGroup = new THREE.Group();
    this.signGroup.position.set(0, BASE_HEIGHT + STOREFRONT_HEIGHT + LED_BAND_HEIGHT + SIGN_SECTION_HEIGHT / 2, DEPTH / 2 + 0.1);
    this.group.add(this.signGroup);

    // Create rounded frame first (behind text)
    this.createSignFrame();

    // Then create text on top
    this.createNeonText3D(this.signText);
  }

  private createSignFrame(): void {
    // Dimensions of the rounded frame
    const frameWidth = 0.95;
    const frameHeight = 0.22;
    const cornerRadius = 0.04;

    // Fixed orange neon color (Tron style)
    const frameColor = 0xff6600;

    // Create rounded rectangle shape
    const shape = new THREE.Shape();
    const x = -frameWidth / 2;
    const y = -frameHeight / 2;
    const r = cornerRadius;

    // Draw rounded rectangle path
    shape.moveTo(x + r, y);
    shape.lineTo(x + frameWidth - r, y);
    shape.quadraticCurveTo(x + frameWidth, y, x + frameWidth, y + r);
    shape.lineTo(x + frameWidth, y + frameHeight - r);
    shape.quadraticCurveTo(x + frameWidth, y + frameHeight, x + frameWidth - r, y + frameHeight);
    shape.lineTo(x + r, y + frameHeight);
    shape.quadraticCurveTo(x, y + frameHeight, x, y + frameHeight - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    // Layer 1: Outer glow (large, soft)
    const outerGlowGeo = new THREE.ShapeGeometry(shape);
    const outerGlowMat = new THREE.MeshBasicMaterial({
      color: frameColor,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    outerGlow.scale.set(1.2, 1.5, 1);
    outerGlow.position.z = -0.03;
    this.signGroup.add(outerGlow);

    // Layer 2: Medium glow
    const midGlowGeo = new THREE.ShapeGeometry(shape);
    const midGlowMat = new THREE.MeshBasicMaterial({
      color: frameColor,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const midGlow = new THREE.Mesh(midGlowGeo, midGlowMat);
    midGlow.scale.set(1.08, 1.2, 1);
    midGlow.position.z = -0.025;
    this.signGroup.add(midGlow);

    // Layer 3: Neon border outline (using LineLoop for the stroke)
    const points = shape.getPoints(48);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: frameColor,
      transparent: true,
      opacity: 0.9,
    });
    const frameLine = new THREE.LineLoop(lineGeo, lineMat);
    frameLine.position.z = -0.015;
    this.signGroup.add(frameLine);

    // Layer 4: Inner bright line (slightly smaller for depth effect)
    const innerLineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const innerLineMat = new THREE.LineBasicMaterial({
      color: 0xffaa44, // Brighter orange/yellow for inner glow
      transparent: true,
      opacity: 0.7,
    });
    const innerLine = new THREE.LineLoop(innerLineGeo, innerLineMat);
    innerLine.scale.set(0.98, 0.95, 1);
    innerLine.position.z = -0.01;
    this.signGroup.add(innerLine);

    // Layer 5: Thick border using boxes for each segment (visible thickness)
    this.createThickBorder(frameWidth, frameHeight, cornerRadius, frameColor);
  }

  private createThickBorder(width: number, height: number, radius: number, color: number): void {
    const thickness = 0.02;
    const depth = 0.015;

    const borderMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85,
    });

    // Top segment
    const topGeo = new THREE.BoxGeometry(width - radius * 2, thickness, depth);
    const top = new THREE.Mesh(topGeo, borderMat);
    top.position.set(0, height / 2, -0.005);
    this.signGroup.add(top);

    // Bottom segment
    const bottom = new THREE.Mesh(topGeo, borderMat.clone());
    bottom.position.set(0, -height / 2, -0.005);
    this.signGroup.add(bottom);

    // Left segment
    const sideGeo = new THREE.BoxGeometry(thickness, height - radius * 2, depth);
    const left = new THREE.Mesh(sideGeo, borderMat.clone());
    left.position.set(-width / 2, 0, -0.005);
    this.signGroup.add(left);

    // Right segment
    const right = new THREE.Mesh(sideGeo, borderMat.clone());
    right.position.set(width / 2, 0, -0.005);
    this.signGroup.add(right);

    // Corner arcs using TorusGeometry segments
    const cornerMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85,
    });

    // Top-right corner
    const cornerGeo = new THREE.TorusGeometry(radius, thickness / 2, 8, 12, Math.PI / 2);
    const tr = new THREE.Mesh(cornerGeo, cornerMat);
    tr.position.set(width / 2 - radius, height / 2 - radius, -0.005);
    tr.rotation.z = 0;
    this.signGroup.add(tr);

    // Top-left corner
    const tl = new THREE.Mesh(cornerGeo, cornerMat.clone());
    tl.position.set(-width / 2 + radius, height / 2 - radius, -0.005);
    tl.rotation.z = Math.PI / 2;
    this.signGroup.add(tl);

    // Bottom-left corner
    const bl = new THREE.Mesh(cornerGeo, cornerMat.clone());
    bl.position.set(-width / 2 + radius, -height / 2 + radius, -0.005);
    bl.rotation.z = Math.PI;
    this.signGroup.add(bl);

    // Bottom-right corner
    const br = new THREE.Mesh(cornerGeo, cornerMat.clone());
    br.position.set(width / 2 - radius, -height / 2 + radius, -0.005);
    br.rotation.z = -Math.PI / 2;
    this.signGroup.add(br);
  }

  private createNeonText3D(text: string): void {
    // Clear existing text meshes
    for (const mesh of this.signLetterMeshes) {
      this.signGroup.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    this.signLetterMeshes = [];

    // Create canvas texture for crisp neon text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[Arcade] Could not get canvas context');
      return;
    }

    // Canvas size (high res for crisp text)
    const canvasWidth = 512;
    const canvasHeight = 64;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // FIXED COLORS - Tron style (does NOT change with mood)
    const glowColor = '#00ffff'; // Cyan electric
    const textColor = '#ffffff'; // Pure white

    // Draw glow (multiple passes for soft glow effect)
    ctx.font = 'bold 36px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outer glow (cyan, more spread)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 25;
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = 0.4;
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

    // Inner glow
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.7;
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

    // Main text (pure white center)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = textColor;
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Create plane mesh for the sign
    const aspectRatio = canvasWidth / canvasHeight;
    const planeHeight = 0.15;
    const planeWidth = planeHeight * aspectRatio;

    const planeGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const signMesh = new THREE.Mesh(planeGeo, planeMat);
    signMesh.userData.canvas = canvas;
    signMesh.userData.ctx = ctx;
    signMesh.userData.texture = texture;

    this.signLetterMeshes.push(signMesh);
    this.signGroup.add(signMesh);
  }

  // Sign uses FIXED colors (white + cyan) - no redraw needed on mood change

  private createNeonLetters(text: string): void {
    // Wrapper for compatibility - uses 3D text
    this.createNeonText3D(text);
  }

  // ==========================================================================
  // DOOR FRAME (Neon outline)
  // ==========================================================================

  private createDoorFrame(): void {
    this.doorFrame = new THREE.Group();
    this.doorFrame.position.set(0, BASE_HEIGHT, DEPTH / 2 + 0.02);
    this.group.add(this.doorFrame);

    const doorWidth = 0.35;
    const doorHeight = 0.8;
    const frameThickness = 0.025;

    const frameMat = new THREE.MeshBasicMaterial({
      color: this.primaryColor,
      transparent: true,
      opacity: 0.8,
    });

    // Top
    const top = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + frameThickness * 2, frameThickness, frameThickness), frameMat);
    top.position.y = doorHeight;
    this.addGlowMesh(top);
    this.doorFrame.add(top);

    // Left
    const left = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, doorHeight, frameThickness), frameMat.clone());
    left.position.set(-doorWidth / 2 - frameThickness / 2, doorHeight / 2, 0);
    this.addGlowMesh(left);
    this.doorFrame.add(left);

    // Right
    const right = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, doorHeight, frameThickness), frameMat.clone());
    right.position.set(doorWidth / 2 + frameThickness / 2, doorHeight / 2, 0);
    this.addGlowMesh(right);
    this.doorFrame.add(right);

    // Door panel (dark)
    const doorGeo = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0x050510,
      transparent: true,
      opacity: 0.9,
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.y = doorHeight / 2;
    door.position.z = -0.01;
    this.doorFrame.add(door);
  }

  // ==========================================================================
  // NEON EDGES (Building outline)
  // ==========================================================================

  private createNeonEdges(): void {
    const hw = WIDTH / 2;
    const hd = DEPTH / 2;

    // Front vertical edges
    this.addNeonLine([
      new THREE.Vector3(-hw, BASE_HEIGHT, hd),
      new THREE.Vector3(-hw, TOTAL_HEIGHT, hd),
    ]);
    this.addNeonLine([
      new THREE.Vector3(hw, BASE_HEIGHT, hd),
      new THREE.Vector3(hw, TOTAL_HEIGHT, hd),
    ]);

    // Top front edge
    this.addNeonLine([
      new THREE.Vector3(-hw, TOTAL_HEIGHT, hd),
      new THREE.Vector3(hw, TOTAL_HEIGHT, hd),
    ]);

    // LED band top edge (accent)
    const ledTop = BASE_HEIGHT + STOREFRONT_HEIGHT + LED_BAND_HEIGHT;
    this.addNeonLine([
      new THREE.Vector3(-hw, ledTop, hd),
      new THREE.Vector3(hw, ledTop, hd),
    ], this.secondaryColor);
  }

  private addNeonLine(points: THREE.Vector3[], color: number = this.primaryColor): void {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });
    const line = new THREE.Line(geo, mat);
    this.neonEdges.push(line);
    this.group.add(line);
  }

  // ==========================================================================
  // SIDE PANEL GAMES (Snake left, Invaders right)
  // ==========================================================================

  private createSideGames(): void {
    const hw = WIDTH / 2;
    const gameY = BASE_HEIGHT + TOTAL_HEIGHT / 2;

    // Snake game on left side (X-)
    this.snakeGame = new SnakeGame();
    const snakeObj = this.snakeGame.getObject();
    snakeObj.position.set(-hw - 0.02, gameY, 0);
    snakeObj.rotation.y = Math.PI / 2; // Face outward
    this.snakeGame.setColor(this.primaryColor);
    this.group.add(snakeObj);

    // Invaders game on right side (X+)
    this.invadersGame = new InvadersGame();
    const invadersObj = this.invadersGame.getObject();
    invadersObj.position.set(hw + 0.02, gameY, 0);
    invadersObj.rotation.y = -Math.PI / 2; // Face outward
    this.invadersGame.setColor(this.primaryColor);
    this.group.add(invadersObj);
  }

  // ==========================================================================
  // WINDOWS (Above sign)
  // ==========================================================================

  private createWindows(): void {
    const windowWidth = 0.18;
    const windowHeight = 0.2;
    const windowsPerRow = 3;
    const rows = 2;
    const rowSpacing = 0.25;
    const colSpacing = 0.25;

    // Start position (above sign section)
    const startY = BASE_HEIGHT + STOREFRONT_HEIGHT + LED_BAND_HEIGHT + SIGN_SECTION_HEIGHT + 0.15;
    const startX = -((windowsPerRow - 1) * colSpacing) / 2;
    const z = DEPTH / 2 + 0.01;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < windowsPerRow; col++) {
        const x = startX + col * colSpacing;
        const y = startY + row * rowSpacing;

        // Window interior (dark with slight glow)
        const interiorGeo = new THREE.PlaneGeometry(windowWidth - 0.02, windowHeight - 0.02);
        const interiorMat = new THREE.MeshBasicMaterial({
          color: 0x0a0a1a,
          transparent: true,
          opacity: 0.9,
        });
        const interior = new THREE.Mesh(interiorGeo, interiorMat);
        interior.position.set(x, y, z);
        this.group.add(interior);

        // Window frame (neon outline)
        const frameGeo = new THREE.PlaneGeometry(windowWidth, windowHeight);
        const frameMat = new THREE.MeshBasicMaterial({
          color: this.primaryColor,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(x, y, z - 0.005);
        this.windowFrames.push(frame);
        this.group.add(frame);

        // Inner glow effect
        const glowGeo = new THREE.PlaneGeometry(windowWidth * 0.6, windowHeight * 0.6);
        const glowMat = new THREE.MeshBasicMaterial({
          color: this.secondaryColor,
          transparent: true,
          opacity: 0.15,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(x, y, z + 0.005);
        this.group.add(glow);
      }
    }
  }

  // ==========================================================================
  // ELEVATOR (Back wall)
  // ==========================================================================

  private createElevator(): void {
    const z = -DEPTH / 2 - 0.01;
    const minY = BASE_HEIGHT + 0.2;
    const maxY = TOTAL_HEIGHT - 0.3;

    // Elevator track (vertical line)
    const trackPoints = [
      new THREE.Vector3(0, minY, z),
      new THREE.Vector3(0, maxY, z),
    ];
    const trackGeo = new THREE.BufferGeometry().setFromPoints(trackPoints);
    const trackMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });
    this.elevatorTrack = new THREE.Line(trackGeo, trackMat);
    this.group.add(this.elevatorTrack);

    // Elevator cursor (glowing rectangle)
    const cursorGeo = new THREE.BoxGeometry(0.15, 0.08, 0.02);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
    this.elevatorCursor = new THREE.Mesh(cursorGeo, cursorMat);
    this.elevatorCursor.position.set(0, minY, z);
    this.addGlowMesh(this.elevatorCursor);
    this.group.add(this.elevatorCursor);
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  updateMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;

    if (!enabled) {
      for (let i = 0; i < LED_BAR_COUNT; i++) {
        this.ledTargetHeights[i] = LED_MIN_HEIGHT;
      }
    }
  }

  updateSignText(text: string): void {
    if (text !== this.signText && text.length > 0) {
      this.signText = text.toUpperCase();
      this.createNeonLetters(this.signText);
    }
  }

  // ==========================================================================
  // STATUS HANDLERS
  // ==========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';

    // Dim everything when offline
    const opacity = isOffline ? 0.2 : 0.9;

    // LED bars
    if (this.ledBars.material instanceof THREE.MeshBasicMaterial) {
      this.ledBars.material.opacity = opacity;
    }

    // Sign (canvas texture)
    if (this.signLetterMeshes.length > 0) {
      const signMesh = this.signLetterMeshes[0];
      if (signMesh.material instanceof THREE.MeshBasicMaterial) {
        signMesh.material.opacity = isOffline ? 0.2 : 1.0;
      }
    }

    // Neon edges
    for (const edge of this.neonEdges) {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.15 : 0.8;
      }
    }

    // Building body emissive for warning/critical
    if (this.buildingBody.material instanceof THREE.MeshStandardMaterial) {
      this.buildingBody.material.emissive = new THREE.Color(
        status === 'critical' ? 0x330000 : status === 'warning' ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects animation speed
  }

  // ==========================================================================
  // ANIMATION UPDATE
  // ==========================================================================

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    if (this.status === 'offline') {
      return;
    }

    const activitySpeed = this.getActivitySpeed();

    // Update LED FFT band
    if (this.musicEnabled) {
      this.updateLEDBand(deltaTime, activitySpeed);
    }

    // Update cabinet mini-FFTs
    this.updateCabinetScreens(deltaTime, activitySpeed);

    // Update neon sign
    this.updateNeonSign(deltaTime);

    // Update neon edges pulse
    this.updateNeonEdges(deltaTime);

    // Update side panel games
    this.snakeGame?.update(deltaTime, activitySpeed);
    this.invadersGame?.update(deltaTime, activitySpeed);

    // Update elevator
    this.updateElevator();
  }

  private updateLEDBand(deltaTime: number, activitySpeed: number): void {
    for (let i = 0; i < LED_BAR_COUNT; i++) {
      // Pseudo-rhythm animation
      const freqMultiplier = 0.5 + (i / LED_BAR_COUNT) * 1.5;
      const amplitudeScale = 1.2 - (i / LED_BAR_COUNT) * 0.5;

      const phase = (i * 0.3) + this.animTime * freqMultiplier * activitySpeed * 3;
      const rhythm = Math.sin(phase) * Math.sin(phase * 0.7) * Math.sin(phase * 1.3);
      const normalizedValue = ((rhythm + 1) / 2) * amplitudeScale;

      this.ledTargetHeights[i] = LED_MIN_HEIGHT + normalizedValue * (LED_MAX_HEIGHT - LED_MIN_HEIGHT);

      // Smooth interpolation
      this.ledHeights[i] += (this.ledTargetHeights[i] - this.ledHeights[i]) * deltaTime * 15;
    }

    this.updateLEDMatrices();
  }

  private updateCabinetScreens(deltaTime: number, activitySpeed: number): void {
    for (let c = 0; c < this.cabinetScreens.length; c++) {
      const bars = this.cabinetScreens[c];
      const phaseOffset = c * 0.5;

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];

        // Pseudo-rhythm animation
        const phase = (i * 0.4) + phaseOffset + this.animTime * activitySpeed * 2;
        const rhythm = (Math.sin(phase) + 1) / 2;
        const height = 0.02 + rhythm * 0.12;

        // Smooth interpolation
        const currentScale = bar.scale.y;
        const targetScale = height / 0.01;
        bar.scale.y = currentScale + (targetScale - currentScale) * deltaTime * 15;

        // Update position so bar grows upward
        bar.position.y = bar.userData.baseY + (bar.scale.y * 0.01) / 2;
      }
    }
  }

  private updateNeonSign(deltaTime: number): void {
    if (this.signLetterMeshes.length === 0) return;

    const signMesh = this.signLetterMeshes[0];
    if (!(signMesh.material instanceof THREE.MeshBasicMaterial)) return;

    // Gentle pulse animation
    const pulseIntensity = 0.9 + 0.1 * Math.sin(this.animTime * Math.PI);

    let opacity = pulseIntensity;

    // Glitch effect - whole sign flickers
    if (this.signGlitchActive) {
      opacity *= Math.random() > 0.5 ? 1 : 0.3;
    }

    signMesh.material.opacity = opacity * (this.status === 'offline' ? 0.2 : 1.0);

    // Random glitch trigger
    this.signGlitchTimer += deltaTime;
    if (this.signGlitchTimer > 3 + Math.random() * 5) {
      this.signGlitchTimer = 0;
      this.signGlitchActive = true;
      setTimeout(() => {
        this.signGlitchActive = false;
      }, 100 + Math.random() * 200);
    }
  }

  private updateNeonEdges(_deltaTime: number): void {
    // Subtle pulse based on status
    const pulse =
      this.status === 'critical'
        ? 0.5 + 0.5 * Math.sin(this.animTime * 8)
        : this.status === 'warning'
          ? 0.6 + 0.4 * Math.sin(this.animTime * 4)
          : 0.7 + 0.3 * Math.sin(this.animTime * 1.5);

    for (const edge of this.neonEdges) {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = pulse * (this.status === 'offline' ? 0.2 : 1);
      }
    }
  }

  private updateElevator(): void {
    if (!this.elevatorCursor) return;

    // Smooth sinusoidal animation (up and down)
    this.elevatorPosition = (Math.sin(this.animTime * 0.5) + 1) / 2;

    const minY = BASE_HEIGHT + 0.2;
    const maxY = TOTAL_HEIGHT - 0.3;
    this.elevatorCursor.position.y = minY + this.elevatorPosition * (maxY - minY);

    // Pulse the cursor brightness
    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
    if (this.elevatorCursor.material instanceof THREE.MeshBasicMaterial) {
      this.elevatorCursor.material.opacity = pulse;
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  override dispose(): void {
    // Dispose LED bars
    if (this.ledBars) {
      this.ledBars.geometry.dispose();
      if (this.ledBars.material instanceof THREE.Material) {
        this.ledBars.material.dispose();
      }
    }

    // Dispose cabinet screens
    for (const bars of this.cabinetScreens) {
      for (const bar of bars) {
        bar.geometry.dispose();
        if (bar.material instanceof THREE.Material) {
          bar.material.dispose();
        }
      }
    }

    // Dispose sign (canvas texture)
    for (const mesh of this.signLetterMeshes) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        if (mesh.material.map) {
          mesh.material.map.dispose();
        }
        mesh.material.dispose();
      }
    }

    // Dispose side games
    this.snakeGame?.dispose();
    this.invadersGame?.dispose();

    super.dispose();
  }
}
