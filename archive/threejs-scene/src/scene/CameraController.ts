import * as THREE from 'three';
import type { CameraSequence, CameraPresetDB } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('CameraController');

export type CameraMode = 'orbit' | 'fps' | 'flyover';

export interface CameraState {
  mode: CameraMode;
  flyoverSpeed?: number;
}

export interface SequencePlaybackState {
  sequence: CameraSequence | null;
  playing: boolean;
  paused: boolean;
  currentKeyframeIndex: number;
  phase: 'transitioning' | 'holding' | 'idle';
  phaseStartTime: number;
}

/**
 * Camera controller with multiple modes:
 * - orbit: Traditional orbit controls
 * - fps: First-person shooter style WASD + mouse
 * - flyover: Automatic path following along roads
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private spherical: THREE.Spherical = new THREE.Spherical(15, Math.PI / 3, Math.PI / 4);

  // Mode
  private mode: CameraMode = 'orbit';

  // Orbit controls
  private isDragging = false;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastDragTime = 0;

  private minDistance = 5;
  private maxDistance = 50;
  private minPolarAngle = 0.1;
  private maxPolarAngle = Math.PI / 2 - 0.1;

  // Orbit damping/inertia
  private orbitVelocity = { theta: 0, phi: 0 };
  private panVelocity = new THREE.Vector3();
  private readonly DAMPING_FACTOR = 0.92;
  private readonly MIN_VELOCITY = 0.0001;
  private readonly VELOCITY_SCALE = 1.2;

  // Zoom animation
  private zoomAnimationActive = false;
  private zoomStartRadius = 0;
  private zoomTargetRadius = 0;
  private zoomStartTime = 0;
  private zoomDuration = 0;

  // Center animation (for recenter button)
  private centerAnimationActive = false;
  private centerStartTarget = new THREE.Vector3();
  private centerEndTarget = new THREE.Vector3();
  private centerStartTheta = 0;
  private centerEndTheta = Math.PI / 4;
  private centerStartPhi = 0;
  private centerEndPhi = Math.PI / 3;
  private centerStartRadius = 0;
  private centerEndRadius = 0;
  private centerAnimationStartTime = 0;
  private centerAnimationDuration = 0;

  // Focus animation (lookAt-based for smooth transitions)
  private focusAnimationActive = false;
  private focusStartPos = new THREE.Vector3();
  private focusEndPos = new THREE.Vector3();
  private focusStartLookAt = new THREE.Vector3();
  private focusEndLookAt = new THREE.Vector3();
  private focusStartTime = 0;
  private focusDuration = 0;

  // FPS controls
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;
  private isSprinting = false;
  private velocity = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private fpsSpeed = 0.3;        // Base walking speed (slow)
  private fpsSprintMultiplier = 4; // Sprint = 4x faster
  private mouseSensitivity = 0.002;
  private sensitivityMultiplier = 1.0; // Global sensitivity multiplier (0.25 - 4.0)
  private isPointerLocked = false;

  // Flyover controls
  private flyoverPath: THREE.Vector3[] = [];
  private flyoverProgress = 0;
  private flyoverSpeed = 2; // Units per second
  private flyoverHeight = 1.5; // Car-level view for immersive flyover
  private flyoverActive = false;
  private flyoverLookAhead = 2; // Look ahead distance for smooth orientation
  private flyoverYawOffset = 0; // Mouse look yaw offset (left/right)
  private flyoverPitchOffset = 0; // Mouse look pitch offset (up/down)
  private flyoverFreeLook = false; // Toggle for free mouse look in flyover (click to enable, Escape to exit)
  private flyoverBasePitch = -0.3; // Default downward tilt to see the ground

  // Sequence playback
  private sequenceState: SequencePlaybackState = {
    sequence: null,
    playing: false,
    paused: false,
    currentKeyframeIndex: 0,
    phase: 'idle',
    phaseStartTime: 0,
  };


  // Bound handlers for proper removal
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnPointerLockChange: () => void;

  constructor(private domElement: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(
      60,
      domElement.clientWidth / domElement.clientHeight,
      0.1,
      1000
    );

    // Bind handlers
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnPointerLockChange = this.onPointerLockChange.bind(this);

    this.updateCameraPosition();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Mouse events
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('mouseleave', this.onMouseUp.bind(this));
    this.domElement.addEventListener('wheel', this.onWheel.bind(this));
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Keyboard events for FPS mode
    document.addEventListener('keydown', this.boundOnKeyDown);
    document.addEventListener('keyup', this.boundOnKeyUp);

    // Pointer lock for FPS mode
    document.addEventListener('pointerlockchange', this.boundOnPointerLockChange);
  }

  // ===========================================================================
  // MODE MANAGEMENT
  // ===========================================================================

  setMode(mode: CameraMode): void {
    if (this.mode === mode) return;

    // Clear all motion state when changing modes
    this.orbitVelocity.theta = 0;
    this.orbitVelocity.phi = 0;
    this.panVelocity.set(0, 0, 0);
    this.zoomAnimationActive = false;
    this.focusAnimationActive = false;

    // Cleanup previous mode
    if (this.mode === 'fps' && this.isPointerLocked) {
      document.exitPointerLock();
    }
    if (this.mode === 'flyover') {
      this.flyoverActive = false;
    }

    this.mode = mode;

    if (mode === 'fps') {
      // Set camera to walking height
      this.camera.position.y = 1.7;
      this.euler.setFromQuaternion(this.camera.quaternion);
    } else if (mode === 'flyover') {
      this.startFlyover();
    } else if (mode === 'orbit') {
      // Reset to orbit position
      this.updateCameraPosition();
    }

    log.log(`Camera mode changed to: ${mode}`);
  }

  getMode(): CameraMode {
    return this.mode;
  }

  setCameraState(state: CameraState): void {
    if (state.flyoverSpeed !== undefined) {
      this.flyoverSpeed = state.flyoverSpeed;
    }
    this.setMode(state.mode);
  }

  // ===========================================================================
  // ORBIT MODE (existing)
  // ===========================================================================

  private onMouseDown(event: MouseEvent): void {
    if (this.mode === 'fps') {
      // Request pointer lock for FPS mode
      if (!this.isPointerLocked) {
        this.domElement.requestPointerLock();
      }
      return;
    }

    if (this.mode === 'flyover') {
      // Toggle free look mode on click
      if (event.button === 0 && !this.flyoverFreeLook) {
        this.flyoverFreeLook = true;
        log.log('Flyover free look enabled (press Escape to exit)');
      }
      return;
    }

    if (this.mode !== 'orbit') return;

    if (event.button === 0) {
      // Left click = PAN
      this.isPanning = true;
      this.lastDragTime = performance.now();
      // Clear pan velocity when starting new drag
      this.panVelocity.set(0, 0, 0);
    } else if (event.button === 2) {
      // Right click = ROTATE
      this.isDragging = true;
      this.lastDragTime = performance.now();
      // Clear rotation velocity when starting new drag
      this.orbitVelocity.theta = 0;
      this.orbitVelocity.phi = 0;
    }
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.mode === 'fps') {
      if (!this.isPointerLocked) return;

      // FPS look around
      const fpsSens = this.mouseSensitivity * this.sensitivityMultiplier;
      this.euler.y -= event.movementX * fpsSens;
      this.euler.x -= event.movementY * fpsSens;
      this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
      return;
    }

    if (this.mode === 'flyover') {
      if (!this.flyoverFreeLook) return;

      // Flyover free look (move mouse to look around)
      const flyoverSens = 0.003 * this.sensitivityMultiplier;
      this.flyoverYawOffset -= event.movementX * flyoverSens;
      this.flyoverPitchOffset -= event.movementY * flyoverSens;
      // Clamp pitch to avoid flipping (relative to base pitch)
      this.flyoverPitchOffset = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.flyoverPitchOffset));
      return;
    }

    if (this.mode !== 'orbit') return;
    if (!this.isDragging && !this.isPanning) return;

    const now = performance.now();
    const dt = (now - this.lastDragTime) / 1000;
    this.lastDragTime = now;

    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    if (this.isDragging) {
      // Rotate
      const orbitSens = 0.01 * this.sensitivityMultiplier;
      const deltaTheta = -deltaX * orbitSens;
      const deltaPhi = deltaY * orbitSens;

      this.spherical.theta += deltaTheta;
      this.spherical.phi = Math.max(
        this.minPolarAngle,
        Math.min(this.maxPolarAngle, this.spherical.phi + deltaPhi)
      );

      // Track velocity for inertia (only if reasonable dt to avoid spikes)
      if (dt > 0 && dt < 0.1) {
        this.orbitVelocity.theta = (deltaTheta / dt) * this.VELOCITY_SCALE;
        this.orbitVelocity.phi = (deltaPhi / dt) * this.VELOCITY_SCALE;
      }
    } else if (this.isPanning) {
      // Pan
      const panSpeed = 0.02 * this.spherical.radius;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);

      right.crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), up).normalize();
      const forward = new THREE.Vector3();
      forward.crossVectors(up, right).normalize();

      const panDelta = new THREE.Vector3();
      panDelta.addScaledVector(right, -deltaX * panSpeed);
      panDelta.addScaledVector(forward, deltaY * panSpeed);

      this.target.add(panDelta);

      // Track pan velocity for inertia
      if (dt > 0 && dt < 0.1) {
        this.panVelocity.copy(panDelta).multiplyScalar(this.VELOCITY_SCALE / dt);
      }
    }

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.updateCameraPosition();
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.isPanning = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();

    if (this.mode !== 'orbit') return;

    // Stop any existing inertia when zooming
    this.orbitVelocity.theta = 0;
    this.orbitVelocity.phi = 0;

    const zoomDirection = event.deltaY > 0 ? 1 : -1;
    const zoomFactor = 0.15; // 15% change per tick for smoother zoom

    const targetRadius = this.spherical.radius * (1 + zoomDirection * zoomFactor);
    const clampedRadius = Math.max(this.minDistance, Math.min(this.maxDistance, targetRadius));

    // Animate zoom smoothly over 150ms
    this.animateZoom(clampedRadius, 0.15);
  }

  private onTouchStart(event: TouchEvent): void {
    if (this.mode !== 'orbit') return;

    if (event.touches.length === 1) {
      this.isDragging = true;
      this.lastMouseX = event.touches[0].clientX;
      this.lastMouseY = event.touches[0].clientY;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.mode !== 'orbit') return;
    if (!this.isDragging || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - this.lastMouseX;
    const deltaY = event.touches[0].clientY - this.lastMouseY;

    this.spherical.theta -= deltaX * 0.01;
    this.spherical.phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, this.spherical.phi + deltaY * 0.01)
    );

    this.lastMouseX = event.touches[0].clientX;
    this.lastMouseY = event.touches[0].clientY;
    this.updateCameraPosition();
  }

  private onTouchEnd(): void {
    this.isDragging = false;
  }

  private updateCameraPosition(): void {
    if (this.mode !== 'orbit') return;

    const position = new THREE.Vector3();
    position.setFromSpherical(this.spherical);
    position.add(this.target);

    this.camera.position.copy(position);
    this.camera.lookAt(this.target);
  }

  private updateOrbitDamping(deltaTime: number): void {
    let needsUpdate = false;

    // Apply rotation inertia
    if (Math.abs(this.orbitVelocity.theta) > this.MIN_VELOCITY ||
        Math.abs(this.orbitVelocity.phi) > this.MIN_VELOCITY) {

      // Apply velocity
      this.spherical.theta += this.orbitVelocity.theta * deltaTime;
      this.spherical.phi += this.orbitVelocity.phi * deltaTime;

      // Clamp phi
      this.spherical.phi = Math.max(
        this.minPolarAngle,
        Math.min(this.maxPolarAngle, this.spherical.phi)
      );

      // Decay velocity
      this.orbitVelocity.theta *= this.DAMPING_FACTOR;
      this.orbitVelocity.phi *= this.DAMPING_FACTOR;

      // Stop if below threshold
      if (Math.abs(this.orbitVelocity.theta) < this.MIN_VELOCITY) {
        this.orbitVelocity.theta = 0;
      }
      if (Math.abs(this.orbitVelocity.phi) < this.MIN_VELOCITY) {
        this.orbitVelocity.phi = 0;
      }

      needsUpdate = true;
    }

    // Apply pan inertia
    if (this.panVelocity.lengthSq() > this.MIN_VELOCITY * this.MIN_VELOCITY) {
      this.target.add(this.panVelocity.clone().multiplyScalar(deltaTime));
      this.panVelocity.multiplyScalar(this.DAMPING_FACTOR);

      if (this.panVelocity.lengthSq() < this.MIN_VELOCITY * this.MIN_VELOCITY) {
        this.panVelocity.set(0, 0, 0);
      }

      needsUpdate = true;
    }

    if (needsUpdate) {
      this.updateCameraPosition();
    }
  }

  private updateZoomAnimation(): void {
    if (!this.zoomAnimationActive) return;

    const elapsed = performance.now() - this.zoomStartTime;
    const progress = Math.min(1, elapsed / this.zoomDuration);

    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);

    this.spherical.radius = this.zoomStartRadius +
      (this.zoomTargetRadius - this.zoomStartRadius) * eased;

    this.updateCameraPosition();

    if (progress >= 1) {
      this.zoomAnimationActive = false;
    }
  }

  private animateZoom(targetRadius: number, duration: number): void {
    // If already animating, update target smoothly
    if (this.zoomAnimationActive) {
      this.zoomTargetRadius = targetRadius;
      return;
    }

    this.zoomStartRadius = this.spherical.radius;
    this.zoomTargetRadius = targetRadius;
    this.zoomStartTime = performance.now();
    this.zoomDuration = duration * 1000;
    this.zoomAnimationActive = true;
  }

  private updateCenterAnimation(): void {
    if (!this.centerAnimationActive) return;

    const elapsed = performance.now() - this.centerAnimationStartTime;
    const progress = Math.min(1, elapsed / this.centerAnimationDuration);

    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3);

    // Interpolate all spherical coordinates and target
    this.target.lerpVectors(this.centerStartTarget, this.centerEndTarget, eased);
    this.spherical.theta = this.centerStartTheta + (this.centerEndTheta - this.centerStartTheta) * eased;
    this.spherical.phi = this.centerStartPhi + (this.centerEndPhi - this.centerStartPhi) * eased;
    this.spherical.radius = this.centerStartRadius + (this.centerEndRadius - this.centerStartRadius) * eased;

    this.updateCameraPosition();

    if (progress >= 1) {
      this.centerAnimationActive = false;
      log.log('Center animation complete');
    }
  }

  // ===========================================================================
  // FPS MODE
  // ===========================================================================

  private onKeyDown(event: KeyboardEvent): void {
    // Handle Escape for flyover free look exit
    if (this.mode === 'flyover' && event.code === 'Escape') {
      if (this.flyoverFreeLook) {
        this.flyoverFreeLook = false;
        log.log('Flyover free look disabled');
      }
      return;
    }

    if (this.mode !== 'fps') return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'Space':
        this.moveUp = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.moveDown = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = true;
        break;
      case 'Escape':
        if (this.isPointerLocked) {
          document.exitPointerLock();
        }
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (this.mode !== 'fps') return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
      case 'Space':
        this.moveUp = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.moveDown = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = false;
        break;
    }
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
  }

  private updateFPS(deltaTime: number): void {
    // Apply deceleration
    this.velocity.x -= this.velocity.x * 10 * deltaTime;
    this.velocity.z -= this.velocity.z * 10 * deltaTime;
    this.velocity.y -= this.velocity.y * 10 * deltaTime;

    // Calculate current speed (with sprint multiplier)
    const currentSpeed = this.isSprinting
      ? this.fpsSpeed * this.fpsSprintMultiplier
      : this.fpsSpeed;

    // Get movement direction based on camera orientation
    // In camera space: -Z is forward, +X is right
    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3(0, 0, Number(this.moveForward) - Number(this.moveBackward));
    const sideVector = new THREE.Vector3(Number(this.moveRight) - Number(this.moveLeft), 0, 0);
    const upVector = new THREE.Vector3(0, Number(this.moveUp) - Number(this.moveDown), 0);

    direction.addVectors(frontVector, sideVector);
    direction.normalize();

    // Apply movement in camera space (fixed: + instead of - for correct direction)
    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= direction.z * currentSpeed * deltaTime;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x += direction.x * currentSpeed * deltaTime;
    }
    if (this.moveUp || this.moveDown) {
      this.velocity.y += upVector.y * currentSpeed * deltaTime;
    }

    // Move camera
    const move = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    move.applyQuaternion(this.camera.quaternion);
    this.camera.position.add(move);
    this.camera.position.y += this.velocity.y * deltaTime;

    // Clamp height
    this.camera.position.y = Math.max(0.5, Math.min(20, this.camera.position.y));
  }

  // ===========================================================================
  // FLYOVER MODE
  // ===========================================================================

  generatePathFromRoads(roads: string[]): void {
    this.flyoverPath = [];

    if (!roads || roads.length === 0) {
      log.log('No roads provided for flyover path');
      return;
    }

    // Find all road cells
    const roadCells: { x: number; z: number }[] = [];
    for (let z = 0; z < roads.length; z++) {
      const row = roads[z];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '1') {
          roadCells.push({ x, z });
        }
      }
    }

    if (roadCells.length === 0) {
      log.log('No road cells found');
      return;
    }

    // Create a connected path using nearest neighbor algorithm
    const visited = new Set<string>();
    const path: { x: number; z: number }[] = [];

    // Start from first road cell
    let current = roadCells[0];
    path.push(current);
    visited.add(`${current.x},${current.z}`);

    // Build path by finding nearest unvisited neighbor
    while (visited.size < roadCells.length) {
      let nearestDist = Infinity;
      let nearest: { x: number; z: number } | null = null;

      for (const cell of roadCells) {
        const key = `${cell.x},${cell.z}`;
        if (visited.has(key)) continue;

        const dist = Math.abs(cell.x - current.x) + Math.abs(cell.z - current.z);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = cell;
        }
      }

      if (nearest) {
        path.push(nearest);
        visited.add(`${nearest.x},${nearest.z}`);
        current = nearest;
      } else {
        break;
      }
    }

    // Close the loop if possible
    if (path.length > 2) {
      const first = path[0];
      const last = path[path.length - 1];
      const dist = Math.abs(first.x - last.x) + Math.abs(first.z - last.z);
      if (dist <= 2) {
        path.push(first);
      }
    }

    // Convert to world coordinates with smooth curve
    this.flyoverPath = path.map((cell) => new THREE.Vector3(cell.x, this.flyoverHeight, cell.z));

    // Smooth the path with Catmull-Rom interpolation
    if (this.flyoverPath.length >= 2) {
      this.flyoverPath = this.smoothPath(this.flyoverPath, 3);
    }

    log.log(`Generated flyover path with ${this.flyoverPath.length} points`);
  }

  private smoothPath(points: THREE.Vector3[], segments: number): THREE.Vector3[] {
    if (points.length < 2) return points;

    const smoothed: THREE.Vector3[] = [];
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    const totalSegments = points.length * segments;
    for (let i = 0; i <= totalSegments; i++) {
      const t = i / totalSegments;
      smoothed.push(curve.getPoint(t));
    }

    return smoothed;
  }

  private startFlyover(): void {
    if (this.flyoverPath.length < 2) {
      log.log('Cannot start flyover: path too short');
      this.setMode('orbit');
      return;
    }

    this.flyoverActive = true;
    this.flyoverProgress = 0;
    // Reset mouse look state
    this.flyoverYawOffset = 0;
    this.flyoverPitchOffset = 0;
    this.flyoverFreeLook = false;
  }

  stopFlyover(): void {
    this.flyoverActive = false;
    if (this.mode === 'flyover') {
      this.setMode('orbit');
    }
  }

  setFlyoverSpeed(speed: number): void {
    this.flyoverSpeed = Math.max(0.5, Math.min(10, speed));
  }

  /**
   * Set the global mouse sensitivity multiplier (0.25 - 4.0).
   * Affects FPS, orbit, and flyover modes proportionally.
   */
  setMouseSensitivity(multiplier: number): void {
    this.sensitivityMultiplier = Math.max(0.25, Math.min(4.0, multiplier));
    log.log(`Mouse sensitivity set to ${this.sensitivityMultiplier}x`);
  }

  getMouseSensitivity(): number {
    return this.sensitivityMultiplier;
  }

  private updateFlyover(deltaTime: number): void {
    if (!this.flyoverActive || this.flyoverPath.length < 2) return;

    // Calculate total path length
    let totalLength = 0;
    for (let i = 0; i < this.flyoverPath.length - 1; i++) {
      totalLength += this.flyoverPath[i].distanceTo(this.flyoverPath[i + 1]);
    }

    // Advance progress
    const progressDelta = (this.flyoverSpeed * deltaTime) / totalLength;
    this.flyoverProgress += progressDelta;

    // Loop the path
    if (this.flyoverProgress >= 1) {
      this.flyoverProgress -= 1;
    }

    // Find current position on path
    const position = this.getPointOnPath(this.flyoverProgress);
    const lookAheadProgress = (this.flyoverProgress + this.flyoverLookAhead / totalLength) % 1;
    const lookAt = this.getPointOnPath(lookAheadProgress);

    this.camera.position.copy(position);

    // First set the base orientation looking at the path ahead
    this.camera.lookAt(lookAt);

    // Apply base pitch (tilt downward to see the ground)
    this.camera.rotateX(this.flyoverBasePitch);

    // Then apply mouse look offset (yaw and pitch) if in free look mode
    if (this.flyoverYawOffset !== 0 || this.flyoverPitchOffset !== 0) {
      // Apply yaw (rotation around Y axis)
      this.camera.rotateY(this.flyoverYawOffset);
      // Apply pitch (rotation around local X axis)
      this.camera.rotateX(this.flyoverPitchOffset);
    }

    // Gradually return to center when not in free look mode (smooth auto-reset)
    if (!this.flyoverFreeLook) {
      this.flyoverYawOffset *= 0.95;
      this.flyoverPitchOffset *= 0.95;
      // Snap to zero when close enough
      if (Math.abs(this.flyoverYawOffset) < 0.001) this.flyoverYawOffset = 0;
      if (Math.abs(this.flyoverPitchOffset) < 0.001) this.flyoverPitchOffset = 0;
    }
  }

  private getPointOnPath(t: number): THREE.Vector3 {
    if (this.flyoverPath.length < 2) return new THREE.Vector3();

    const totalSegments = this.flyoverPath.length - 1;
    const scaledT = t * totalSegments;
    const segmentIndex = Math.floor(scaledT);
    const segmentT = scaledT - segmentIndex;

    const p1 = this.flyoverPath[segmentIndex % this.flyoverPath.length];
    const p2 = this.flyoverPath[(segmentIndex + 1) % this.flyoverPath.length];

    return new THREE.Vector3().lerpVectors(p1, p2, segmentT);
  }

  // ===========================================================================
  // UPDATE (called each frame)
  // ===========================================================================

  update(deltaTime: number): void {
    // Handle focus animation first (lookAt-based, highest priority)
    if (this.updateFocusAnimation()) {
      return; // Skip other updates while focus animating
    }

    // Handle camera command animations
    if (this.updateAnimation()) {
      // Update sequence state even during animation
      this.updateSequence();
      return; // Skip other updates while animating to a command target
    }

    // Update sequence playback (handles hold phase and transitions)
    this.updateSequence();

    switch (this.mode) {
      case 'fps':
        this.updateFPS(deltaTime);
        break;
      case 'flyover':
        this.updateFlyover(deltaTime);
        break;
      case 'orbit':
        // Handle center animation (recenter button)
        this.updateCenterAnimation();
        // Handle orbit damping when not dragging
        if (!this.isDragging && !this.isPanning && !this.centerAnimationActive) {
          this.updateOrbitDamping(deltaTime);
        }
        // Handle zoom animation
        this.updateZoomAnimation();
        break;
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  centerOnGrid(width: number, height: number, animate = false): void {
    const targetPos = new THREE.Vector3((width - 1) / 2, 0, (height - 1) / 2);
    const targetRadius = Math.max(width, height) * 1.5;

    if (animate) {
      // Stop any ongoing animations
      this.zoomAnimationActive = false;
      this.focusAnimationActive = false;
      this.animationActive = false;

      // Set up center animation
      this.centerStartTarget.copy(this.target);
      this.centerEndTarget.copy(targetPos);
      this.centerStartTheta = this.spherical.theta;
      this.centerEndTheta = Math.PI / 4;
      this.centerStartPhi = this.spherical.phi;
      this.centerEndPhi = Math.PI / 3;
      this.centerStartRadius = this.spherical.radius;
      this.centerEndRadius = targetRadius;
      this.centerAnimationStartTime = performance.now();
      this.centerAnimationDuration = 800; // 800ms animation
      this.centerAnimationActive = true;

      log.log('Starting center animation');
    } else {
      this.target.copy(targetPos);
      this.spherical.radius = targetRadius;
      this.updateCameraPosition();
    }
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ===========================================================================
  // REMOTE CONTROL API
  // ===========================================================================

  /**
   * Get current camera position
   */
  getPosition(): { x: number; y: number; z: number } {
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
    };
  }

  /**
   * Get current camera rotation (euler angles)
   */
  getRotation(): { x: number; y: number; z: number } {
    return {
      x: this.camera.rotation.x,
      y: this.camera.rotation.y,
      z: this.camera.rotation.z,
    };
  }

  /**
   * Set camera position directly
   */
  setPosition(x: number, y: number, z: number, animate = true, duration = 1.5): void {
    log.log(`CameraController.setPosition(${x}, ${y}, ${z}, animate=${animate}, duration=${duration})`);
    log.log('Current camera pos:', this.camera.position.toArray());
    if (animate && duration > 0) {
      log.log('Starting position animation to:', [x, y, z]);
      this.animatePosition(new THREE.Vector3(x, y, z), duration);
      log.log('Animation start/end:', this.animationStartPos.toArray(), '->', this.animationEndPos.toArray());
    } else {
      log.log('Setting position directly (no animation)');
      this.camera.position.set(x, y, z);
      // Update target to be in front of camera
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(this.camera.quaternion);
      this.target.copy(this.camera.position).add(direction.multiplyScalar(10));
      this.updateSphericalFromCamera();
      log.log('New camera pos:', this.camera.position.toArray());
    }
  }

  /**
   * Set camera rotation directly (euler angles in radians)
   */
  setRotation(x: number, y: number, z: number, animate = true, duration = 1.5): void {
    if (animate && duration > 0) {
      this.animateRotation(new THREE.Euler(x, y, z, 'YXZ'), duration);
    } else {
      this.camera.rotation.set(x, y, z, 'YXZ');
    }
  }

  /**
   * Set camera FOV
   */
  setFOV(fov: number, animate = true, duration = 0.5): void {
    if (animate && duration > 0) {
      this.animateFOV(fov, duration);
    } else {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Apply a camera preset (position, rotation, fov, mode)
   */
  applyPreset(preset: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    fov: number;
    mode: CameraMode;
  }, animate = true, duration = 1.5): void {
    // Switch to the preset mode
    if (preset.mode) {
      this.setMode(preset.mode);
    }

    // Apply position and rotation
    if (animate && duration > 0) {
      this.animateToPreset(preset, duration);
    } else {
      this.camera.position.set(preset.position.x, preset.position.y, preset.position.z);
      this.camera.rotation.set(preset.rotation.x, preset.rotation.y, preset.rotation.z, 'YXZ');
      if (preset.fov) {
        this.camera.fov = preset.fov;
        this.camera.updateProjectionMatrix();
      }
      this.updateSphericalFromCamera();
    }
  }

  // ---------------------------------------------------------------------------
  // Animation helpers
  // ---------------------------------------------------------------------------

  private animationActive = false;
  private animationStartTime = 0;
  private animationDuration = 0;
  private animationStartPos = new THREE.Vector3();
  private animationEndPos = new THREE.Vector3();
  private animationStartRot = new THREE.Euler();
  private animationEndRot = new THREE.Euler();
  private animationStartFOV = 60;
  private animationEndFOV = 60;

  private animatePosition(endPos: THREE.Vector3, duration: number): void {
    this.animationStartPos.copy(this.camera.position);
    this.animationEndPos.copy(endPos);
    this.animationStartRot.copy(this.camera.rotation);
    this.animationEndRot.copy(this.camera.rotation);
    this.animationStartFOV = this.camera.fov;
    this.animationEndFOV = this.camera.fov;
    this.animationStartTime = performance.now();
    this.animationDuration = duration * 1000;
    this.animationActive = true;
  }

  private animateRotation(endRot: THREE.Euler, duration: number): void {
    this.animationStartPos.copy(this.camera.position);
    this.animationEndPos.copy(this.camera.position);
    this.animationStartRot.copy(this.camera.rotation);
    this.animationEndRot.copy(endRot);
    this.animationStartFOV = this.camera.fov;
    this.animationEndFOV = this.camera.fov;
    this.animationStartTime = performance.now();
    this.animationDuration = duration * 1000;
    this.animationActive = true;
  }

  private animateFOV(endFOV: number, duration: number): void {
    this.animationStartPos.copy(this.camera.position);
    this.animationEndPos.copy(this.camera.position);
    this.animationStartRot.copy(this.camera.rotation);
    this.animationEndRot.copy(this.camera.rotation);
    this.animationStartFOV = this.camera.fov;
    this.animationEndFOV = endFOV;
    this.animationStartTime = performance.now();
    this.animationDuration = duration * 1000;
    this.animationActive = true;
  }

  private animateToPreset(preset: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    fov: number;
  }, duration: number): void {
    this.animationStartPos.copy(this.camera.position);
    this.animationEndPos.set(preset.position.x, preset.position.y, preset.position.z);
    this.animationStartRot.copy(this.camera.rotation);
    this.animationEndRot.set(preset.rotation.x, preset.rotation.y, preset.rotation.z, 'YXZ');
    this.animationStartFOV = this.camera.fov;
    this.animationEndFOV = preset.fov || this.camera.fov;
    this.animationStartTime = performance.now();
    this.animationDuration = duration * 1000;
    this.animationActive = true;
  }

  /**
   * Animate to a command target (position, rotation, and/or FOV combined)
   * This handles all properties in one call to avoid overwriting animation state.
   */
  animateToCommand(options: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    fov?: number;
    duration: number;
  }): void {
    log.log('animateToCommand:', options);

    // Capture current state as start
    this.animationStartPos.copy(this.camera.position);
    this.animationStartRot.copy(this.camera.rotation);
    this.animationStartFOV = this.camera.fov;

    // Set end state (use current if not specified)
    if (options.position) {
      this.animationEndPos.set(options.position.x, options.position.y, options.position.z);
    } else {
      this.animationEndPos.copy(this.camera.position);
    }

    if (options.rotation) {
      this.animationEndRot.set(options.rotation.x, options.rotation.y, options.rotation.z, 'YXZ');
    } else {
      this.animationEndRot.copy(this.camera.rotation);
    }

    this.animationEndFOV = options.fov !== undefined ? options.fov : this.camera.fov;

    // Start animation
    this.animationStartTime = performance.now();
    this.animationDuration = options.duration * 1000;
    this.animationActive = true;

    log.log('Animation configured:', {
      startPos: this.animationStartPos.toArray(),
      endPos: this.animationEndPos.toArray(),
      duration: this.animationDuration
    });
  }

  /**
   * Update animation (call from update loop)
   */
  updateAnimation(): boolean {
    if (!this.animationActive) return false;

    const now = performance.now();
    const elapsed = now - this.animationStartTime;
    const progress = Math.min(elapsed / this.animationDuration, 1);

    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);

    // Interpolate position
    this.camera.position.lerpVectors(this.animationStartPos, this.animationEndPos, eased);

    // Debug log (only first and last frame)
    if (progress < 0.05 || progress >= 1) {
      log.log(`Animation progress: ${(progress * 100).toFixed(1)}%, eased=${eased.toFixed(3)}, pos:`, this.camera.position.toArray().map(v => v.toFixed(2)));
      log.log('  lerp from:', this.animationStartPos.toArray().map(v => v.toFixed(2)), 'to:', this.animationEndPos.toArray().map(v => v.toFixed(2)));
    }

    // Interpolate rotation (using quaternions for smooth rotation)
    const startQuat = new THREE.Quaternion().setFromEuler(this.animationStartRot);
    const endQuat = new THREE.Quaternion().setFromEuler(this.animationEndRot);
    const currentQuat = new THREE.Quaternion().slerpQuaternions(startQuat, endQuat, eased);
    this.camera.quaternion.copy(currentQuat);

    // Interpolate FOV
    this.camera.fov = this.animationStartFOV + (this.animationEndFOV - this.animationStartFOV) * eased;
    this.camera.updateProjectionMatrix();

    if (progress >= 1) {
      this.animationActive = false;
      this.updateSphericalFromCamera();
    }

    return true;
  }

  /**
   * Focus camera on a building, positioning it in front of the building's orientation.
   * Uses lookAt-based animation for smooth, natural camera movement.
   * @param focusPoint - Center point of the building to focus on
   * @param boundingRadius - Approximate size of the building
   * @param orientation - Building orientation (N/S/E/W) to determine camera position
   * @param duration - Animation duration in seconds
   */
  focusOnBuilding(
    focusPoint: THREE.Vector3,
    boundingRadius: number = 1.5,
    orientation: 'N' | 'S' | 'E' | 'W' | undefined,
    duration: number = 1.2
  ): void {
    // Don't interrupt sequence playback
    if (this.sequenceState.playing) {
      log.log('Ignoring focus request during sequence playback');
      return;
    }

    // Stop any ongoing motion
    this.orbitVelocity.theta = 0;
    this.orbitVelocity.phi = 0;
    this.panVelocity.set(0, 0, 0);
    this.zoomAnimationActive = false;
    this.animationActive = false;

    // Calculate distance based on building size (closer for context)
    const distance = Math.max(this.minDistance, Math.min(this.maxDistance, boundingRadius * 4));
    const height = Math.max(1.5, boundingRadius * 1.2);

    // Calculate camera position based on building orientation
    // Camera goes OPPOSITE to building's facing direction
    const offset = new THREE.Vector3();
    switch (orientation || 'S') {
      case 'N': offset.set(0, height, distance); break;   // Building faces N, camera at S
      case 'S': offset.set(0, height, -distance); break;  // Building faces S, camera at N
      case 'E': offset.set(-distance, height, 0); break;  // Building faces E, camera at W
      case 'W': offset.set(distance, height, 0); break;   // Building faces W, camera at E
    }

    const targetCameraPos = focusPoint.clone().add(offset);

    log.log(`Focusing on building:`, focusPoint.toArray(), `orientation: ${orientation || 'S'}, distance: ${distance}`);

    // Start lookAt-based animation
    this.focusStartPos.copy(this.camera.position);
    this.focusEndPos.copy(targetCameraPos);

    // Calculate where camera is currently looking (point in front of camera)
    const currentDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.focusStartLookAt.copy(this.camera.position).add(currentDirection.multiplyScalar(10));

    // End looking at the building
    this.focusEndLookAt.copy(focusPoint);

    this.focusStartTime = performance.now();
    this.focusDuration = duration * 1000;
    this.focusAnimationActive = true;
  }

  /**
   * Update focus animation (lookAt-based for smooth movement)
   */
  private updateFocusAnimation(): boolean {
    if (!this.focusAnimationActive) return false;

    const elapsed = performance.now() - this.focusStartTime;
    const progress = Math.min(1, elapsed / this.focusDuration);

    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3);

    // Interpolate camera position
    this.camera.position.lerpVectors(this.focusStartPos, this.focusEndPos, eased);

    // Interpolate lookAt target for smooth rotation
    const currentLookAt = new THREE.Vector3().lerpVectors(
      this.focusStartLookAt,
      this.focusEndLookAt,
      eased
    );
    this.camera.lookAt(currentLookAt);

    if (progress >= 1) {
      this.focusAnimationActive = false;

      // Update orbit target to the building center for subsequent orbiting
      this.target.copy(this.focusEndLookAt);
      this.updateSphericalFromCamera();

      log.log('Focus animation complete, target updated for orbiting');
    }

    return true;
  }

  private updateSphericalFromCamera(): void {
    // Update spherical coordinates from camera position for orbit mode
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.spherical.setFromVector3(offset);
  }

  // ===========================================================================
  // SEQUENCE PLAYBACK
  // ===========================================================================

  /**
   * Start playing a camera sequence
   */
  playSequence(sequence: CameraSequence): void {
    if (!sequence.keyframes || sequence.keyframes.length === 0) {
      log.warn('Cannot play sequence: no keyframes');
      return;
    }

    log.log(`Starting sequence playback: ${sequence.name} (${sequence.keyframes.length} keyframes, loop=${sequence.loop})`);

    // Stop any existing sequence
    this.stopSequence();

    // Set mode to orbit for smooth camera control
    this.setMode('orbit');

    this.sequenceState = {
      sequence,
      playing: true,
      paused: false,
      currentKeyframeIndex: 0,
      phase: 'transitioning',
      phaseStartTime: performance.now(),
    };

    // Start transition to first keyframe
    this.transitionToKeyframe(0);
  }

  /**
   * Pause sequence playback
   */
  pauseSequence(): void {
    if (!this.sequenceState.playing) return;

    this.sequenceState.paused = true;
    log.log('Sequence paused');
  }

  /**
   * Resume sequence playback
   */
  resumeSequence(): void {
    if (!this.sequenceState.playing || !this.sequenceState.paused) return;

    this.sequenceState.paused = false;
    // Adjust phase start time to account for pause duration
    this.sequenceState.phaseStartTime = performance.now();
    log.log('Sequence resumed');
  }

  /**
   * Stop sequence playback
   */
  stopSequence(): void {
    if (!this.sequenceState.playing) return;

    log.log('Sequence stopped');
    this.sequenceState = {
      sequence: null,
      playing: false,
      paused: false,
      currentKeyframeIndex: 0,
      phase: 'idle',
      phaseStartTime: 0,
    };
    this.animationActive = false;
  }

  /**
   * Check if a sequence is currently playing
   */
  isSequencePlaying(): boolean {
    return this.sequenceState.playing && !this.sequenceState.paused;
  }

  /**
   * Update sequence playback (call from update loop)
   */
  updateSequence(): void {
    if (!this.sequenceState.playing || this.sequenceState.paused || !this.sequenceState.sequence) return;

    const now = performance.now();
    const elapsed = (now - this.sequenceState.phaseStartTime) / 1000;
    const keyframe = this.sequenceState.sequence.keyframes[this.sequenceState.currentKeyframeIndex];

    if (!keyframe) {
      this.stopSequence();
      return;
    }

    if (this.sequenceState.phase === 'transitioning') {
      // Animation is handled by updateAnimation()
      // Check if animation is complete
      if (!this.animationActive) {
        // Transition complete, start holding
        this.sequenceState.phase = 'holding';
        this.sequenceState.phaseStartTime = now;
        log.log(`Keyframe ${this.sequenceState.currentKeyframeIndex + 1}: holding for ${keyframe.hold_duration}s`);
      }
    } else if (this.sequenceState.phase === 'holding') {
      if (elapsed >= keyframe.hold_duration) {
        // Hold complete, advance to next keyframe
        this.advanceToNextKeyframe();
      }
    }
  }

  private advanceToNextKeyframe(): void {
    if (!this.sequenceState.sequence) return;

    const nextIndex = this.sequenceState.currentKeyframeIndex + 1;

    if (nextIndex >= this.sequenceState.sequence.keyframes.length) {
      if (this.sequenceState.sequence.loop) {
        // Loop back to first keyframe
        log.log('Sequence looping...');
        this.sequenceState.currentKeyframeIndex = 0;
        this.transitionToKeyframe(0);
      } else {
        // Sequence complete
        log.log('Sequence playback complete');
        this.stopSequence();
      }
    } else {
      this.sequenceState.currentKeyframeIndex = nextIndex;
      this.transitionToKeyframe(nextIndex);
    }
  }

  private transitionToKeyframe(index: number): void {
    if (!this.sequenceState.sequence) return;

    const keyframe = this.sequenceState.sequence.keyframes[index];
    if (!keyframe || !keyframe.preset) {
      console.warn(`Keyframe ${index} has no preset data`);
      this.advanceToNextKeyframe();
      return;
    }

    const preset = keyframe.preset as CameraPresetDB;
    log.log(`Transitioning to keyframe ${index + 1}: ${preset.name} (${keyframe.transition_duration}s)`);

    this.animateToCommand({
      position: { x: preset.position_x, y: preset.position_y, z: preset.position_z },
      rotation: { x: preset.rotation_x, y: preset.rotation_y, z: preset.rotation_z },
      fov: preset.fov,
      duration: keyframe.transition_duration,
    });

    this.sequenceState.phase = 'transitioning';
    this.sequenceState.phaseStartTime = performance.now();
  }

  dispose(): void {
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
    document.removeEventListener('pointerlockchange', this.boundOnPointerLockChange);

    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
  }
}
