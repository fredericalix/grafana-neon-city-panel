import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import {
  SUPERVISOR_FACE_PRESETS,
  createWireframeMaterial,
  createPupilShaderMaterial,
  setupBarycentricCoordinates,
} from './SupervisorShader';

/**
 * Face configuration - giant wireframe face floating above the city
 */
const FACE_CONFIG = {
  // Scale
  headWidth: 6,           // ~6 units wide
  headHeight: 8,          // ~8 units tall (elongated)
  headDepth: 5,

  // Position (floating above city)
  floatHeight: 10,        // Base height above ground
  floatAmplitude: 0.3,    // Vertical bob range

  // Orientation - tilted 45 degrees to look down at city
  tiltAngle: -Math.PI / 4,

  // Grid footprint (maintain 4x4 for compatibility)
  gridSize: 4,

  // Eye configuration
  eyeSpacing: 1.4,
  eyeY: 0.8,
  eyeZ: 2.2,
  pupilRadius: 0.35,
  eyeGlowRadius: 0.55,
};

/**
 * Animation state for the supervisor
 */
interface SupervisorAnimationState {
  // Head movement
  headRotationY: number;
  headRotationX: number;
  headTargetRotY: number;
  headTargetRotX: number;

  // Eye tracking
  eyeLookX: number;
  eyeLookY: number;
  eyeTargetX: number;
  eyeTargetY: number;

  // Floating animation
  floatPhase: number;
  breathPhase: number;

  // Watching behavior state machine
  watchingState: 'idle' | 'scanning' | 'tracking';
  watchTimer: number;
  scanPhase: 'left' | 'center' | 'right' | 'pause';

  // Scanline shader
  scanlineY: number;
  scanlineDirection: 1 | -1;

  // Time
  animTime: number;
}

/**
 * SupervisorPrefab - Giant Wireframe Face
 *
 * A massive floating wireframe face that watches over the city.
 * Features:
 * - Procedural low-poly geometric face rendered in pure wireframe
 * - Glowing eyes that track activity
 * - Status-reactive colors (green/orange/red/grey)
 * - Floating/breathing animation
 * - Scanning behavior state machine
 * - Energy pulses along wireframe edges
 */
export class SupervisorPrefab extends BasePrefab {
  // Face geometry group
  private faceGroup!: THREE.Group;
  private faceMeshes: THREE.Mesh[] = [];

  // Wireframe material
  private wireframeMaterial!: THREE.ShaderMaterial;

  // Eyes
  private leftPupil!: THREE.Mesh;
  private rightPupil!: THREE.Mesh;
  private leftPupilMaterial!: THREE.ShaderMaterial;
  private rightPupilMaterial!: THREE.ShaderMaterial;
  private leftEyeGlow!: THREE.Mesh;
  private rightEyeGlow!: THREE.Mesh;

  // Ambient light
  private faceLight!: THREE.PointLight;

  // Face rotation control (public API)
  public faceRotationEnabled = true;

  // Eye look direction (public for external access)
  public eyeLookX = 0;
  public eyeLookY = 0;

  // Current status preset
  private currentPreset = SUPERVISOR_FACE_PRESETS.online;

  // Animation state
  private animState: SupervisorAnimationState = {
    headRotationY: 0,
    headRotationX: FACE_CONFIG.tiltAngle,
    headTargetRotY: 0,
    headTargetRotX: FACE_CONFIG.tiltAngle,
    eyeLookX: 0,
    eyeLookY: 0,
    eyeTargetX: 0,
    eyeTargetY: 0,
    floatPhase: 0,
    breathPhase: 0,
    watchingState: 'idle',
    watchTimer: 0,
    scanPhase: 'center',
    scanlineY: 0,
    scanlineDirection: 1,
    animTime: 0,
  };

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Create main face group
    this.faceGroup = new THREE.Group();
    this.faceGroup.position.y = FACE_CONFIG.floatHeight;
    this.faceGroup.rotation.x = FACE_CONFIG.tiltAngle;
    this.group.add(this.faceGroup);

    // Create wireframe material
    this.wireframeMaterial = createWireframeMaterial();

    // Build face geometry
    this.createFaceGeometry();

    // Create eyes
    this.createEyes();

    // Create ambient light
    this.createAmbientLight();
  }

  /**
   * Create the procedural geometric face using low-poly shapes
   */
  private createFaceGeometry(): void {
    // === SKULL (main head shape) ===
    // Using icosahedron for angular low-poly look
    const skullGeo = new THREE.IcosahedronGeometry(3, 1);

    // Elongate vertically and stretch forward
    const skullPositions = skullGeo.attributes.position;
    for (let i = 0; i < skullPositions.count; i++) {
      const y = skullPositions.getY(i);
      const z = skullPositions.getZ(i);
      skullPositions.setY(i, y * 1.3); // 30% taller
      // Push front vertices forward for face area
      if (z > 0) {
        skullPositions.setZ(i, z * 1.1);
      }
    }
    skullGeo.computeVertexNormals();
    setupBarycentricCoordinates(skullGeo);

    const skullMesh = new THREE.Mesh(skullGeo, this.wireframeMaterial);
    this.faceGroup.add(skullMesh);
    this.faceMeshes.push(skullMesh);

    // === BROW RIDGE ===
    const browGeo = new THREE.TorusGeometry(1.4, 0.18, 4, 12, Math.PI);
    setupBarycentricCoordinates(browGeo);
    const browMesh = new THREE.Mesh(browGeo, this.wireframeMaterial);
    browMesh.rotation.x = -Math.PI / 2;
    browMesh.rotation.z = Math.PI;
    browMesh.position.set(0, 1.3, 2.4);
    this.faceGroup.add(browMesh);
    this.faceMeshes.push(browMesh);

    // === EYE SOCKETS (concave areas) ===
    const socketGeo = new THREE.OctahedronGeometry(0.7, 0);
    setupBarycentricCoordinates(socketGeo);

    const leftSocket = new THREE.Mesh(socketGeo, this.wireframeMaterial);
    leftSocket.position.set(-FACE_CONFIG.eyeSpacing, FACE_CONFIG.eyeY, FACE_CONFIG.eyeZ - 0.3);
    leftSocket.scale.set(1.2, 0.8, 0.5);
    this.faceGroup.add(leftSocket);
    this.faceMeshes.push(leftSocket);

    const rightSocketGeo = new THREE.OctahedronGeometry(0.7, 0);
    setupBarycentricCoordinates(rightSocketGeo);
    const rightSocket = new THREE.Mesh(rightSocketGeo, this.wireframeMaterial);
    rightSocket.position.set(FACE_CONFIG.eyeSpacing, FACE_CONFIG.eyeY, FACE_CONFIG.eyeZ - 0.3);
    rightSocket.scale.set(1.2, 0.8, 0.5);
    this.faceGroup.add(rightSocket);
    this.faceMeshes.push(rightSocket);

    // === NOSE BRIDGE ===
    const noseGeo = new THREE.ConeGeometry(0.35, 1.5, 4);
    setupBarycentricCoordinates(noseGeo);
    const noseMesh = new THREE.Mesh(noseGeo, this.wireframeMaterial);
    noseMesh.position.set(0, 0.1, 2.8);
    noseMesh.rotation.x = -Math.PI / 5;
    this.faceGroup.add(noseMesh);
    this.faceMeshes.push(noseMesh);

    // === CHEEKBONES ===
    const cheekGeo = new THREE.TetrahedronGeometry(0.8, 0);
    setupBarycentricCoordinates(cheekGeo);

    const leftCheek = new THREE.Mesh(cheekGeo, this.wireframeMaterial);
    leftCheek.position.set(-2.0, -0.2, 1.8);
    leftCheek.rotation.set(0.3, 0.5, 0.2);
    leftCheek.scale.set(1.3, 0.7, 0.9);
    this.faceGroup.add(leftCheek);
    this.faceMeshes.push(leftCheek);

    const rightCheekGeo = new THREE.TetrahedronGeometry(0.8, 0);
    setupBarycentricCoordinates(rightCheekGeo);
    const rightCheek = new THREE.Mesh(rightCheekGeo, this.wireframeMaterial);
    rightCheek.position.set(2.0, -0.2, 1.8);
    rightCheek.rotation.set(0.3, -0.5, -0.2);
    rightCheek.scale.set(1.3, 0.7, 0.9);
    this.faceGroup.add(rightCheek);
    this.faceMeshes.push(rightCheek);

    // === JAW ===
    const jawGeo = new THREE.CylinderGeometry(2.0, 1.4, 1.8, 6, 1, true);
    setupBarycentricCoordinates(jawGeo);
    const jawMesh = new THREE.Mesh(jawGeo, this.wireframeMaterial);
    jawMesh.position.set(0, -2.0, 0.3);
    this.faceGroup.add(jawMesh);
    this.faceMeshes.push(jawMesh);

    // === CHIN ===
    const chinGeo = new THREE.OctahedronGeometry(0.6, 0);
    setupBarycentricCoordinates(chinGeo);
    const chinMesh = new THREE.Mesh(chinGeo, this.wireframeMaterial);
    chinMesh.position.set(0, -3.0, 1.6);
    chinMesh.scale.set(1.2, 0.9, 0.7);
    this.faceGroup.add(chinMesh);
    this.faceMeshes.push(chinMesh);

    // === FOREHEAD DETAIL ===
    const foreheadGeo = new THREE.TetrahedronGeometry(0.5, 0);
    setupBarycentricCoordinates(foreheadGeo);
    const foreheadMesh = new THREE.Mesh(foreheadGeo, this.wireframeMaterial);
    foreheadMesh.position.set(0, 2.5, 2.0);
    foreheadMesh.rotation.x = 0.3;
    this.faceGroup.add(foreheadMesh);
    this.faceMeshes.push(foreheadMesh);

    // === TEMPLE DETAILS ===
    const templeGeo = new THREE.TetrahedronGeometry(0.4, 0);
    setupBarycentricCoordinates(templeGeo);

    const leftTemple = new THREE.Mesh(templeGeo, this.wireframeMaterial);
    leftTemple.position.set(-2.5, 1.5, 0.8);
    leftTemple.rotation.set(0, 0.5, 0.3);
    this.faceGroup.add(leftTemple);
    this.faceMeshes.push(leftTemple);

    const rightTempleGeo = new THREE.TetrahedronGeometry(0.4, 0);
    setupBarycentricCoordinates(rightTempleGeo);
    const rightTemple = new THREE.Mesh(rightTempleGeo, this.wireframeMaterial);
    rightTemple.position.set(2.5, 1.5, 0.8);
    rightTemple.rotation.set(0, -0.5, -0.3);
    this.faceGroup.add(rightTemple);
    this.faceMeshes.push(rightTemple);
  }

  /**
   * Create the glowing eyes
   */
  private createEyes(): void {
    const pupilGeo = new THREE.SphereGeometry(FACE_CONFIG.pupilRadius, 16, 16);

    // Left pupil
    this.leftPupilMaterial = createPupilShaderMaterial();
    this.leftPupil = new THREE.Mesh(pupilGeo, this.leftPupilMaterial);
    this.leftPupil.position.set(-FACE_CONFIG.eyeSpacing, FACE_CONFIG.eyeY, FACE_CONFIG.eyeZ);
    this.faceGroup.add(this.leftPupil);
    this.addGlowMesh(this.leftPupil);

    // Right pupil
    this.rightPupilMaterial = createPupilShaderMaterial();
    const rightPupilGeo = new THREE.SphereGeometry(FACE_CONFIG.pupilRadius, 16, 16);
    this.rightPupil = new THREE.Mesh(rightPupilGeo, this.rightPupilMaterial);
    this.rightPupil.position.set(FACE_CONFIG.eyeSpacing, FACE_CONFIG.eyeY, FACE_CONFIG.eyeZ);
    this.faceGroup.add(this.rightPupil);
    this.addGlowMesh(this.rightPupil);

    // Outer glow spheres (additive blending for bloom effect)
    const glowGeo = new THREE.SphereGeometry(FACE_CONFIG.eyeGlowRadius, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.currentPreset.eyeGlowColor,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });

    this.leftEyeGlow = new THREE.Mesh(glowGeo, glowMat);
    this.leftEyeGlow.position.copy(this.leftPupil.position);
    this.faceGroup.add(this.leftEyeGlow);

    const rightGlowMat = glowMat.clone();
    this.rightEyeGlow = new THREE.Mesh(glowGeo.clone(), rightGlowMat);
    this.rightEyeGlow.position.copy(this.rightPupil.position);
    this.faceGroup.add(this.rightEyeGlow);

    // Store base positions for animation
    (this.leftPupil as any).baseX = -FACE_CONFIG.eyeSpacing;
    (this.leftPupil as any).baseY = FACE_CONFIG.eyeY;
    (this.rightPupil as any).baseX = FACE_CONFIG.eyeSpacing;
    (this.rightPupil as any).baseY = FACE_CONFIG.eyeY;
  }

  /**
   * Create ambient light emanating from the face
   */
  private createAmbientLight(): void {
    this.faceLight = new THREE.PointLight(
      this.currentPreset.glowColor,
      1.5,
      25,
      2
    );
    this.faceLight.position.set(0, FACE_CONFIG.floatHeight, 0);
    this.group.add(this.faceLight);
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Make the eyes look at a target position
   */
  public lookAt(target: THREE.Vector3): void {
    const faceWorldPos = new THREE.Vector3();
    this.faceGroup.getWorldPosition(faceWorldPos);

    const direction = target.clone().sub(faceWorldPos).normalize();

    // Set head rotation targets
    this.animState.headTargetRotY = Math.atan2(direction.x, direction.z) * 0.5;
    this.animState.headTargetRotX = FACE_CONFIG.tiltAngle + Math.asin(-direction.y) * 0.3;

    // Set eye targets
    this.animState.eyeTargetX = THREE.MathUtils.clamp(direction.x * 1.5, -1, 1);
    this.animState.eyeTargetY = THREE.MathUtils.clamp(-direction.y * 0.8, -0.5, 0.5);

    // Enter tracking state
    this.animState.watchingState = 'tracking';
    this.animState.watchTimer = 0;
  }

  /**
   * Set eye/pupil glow intensity
   */
  public setEyeGlow(intensity: number): void {
    if (this.leftPupilMaterial) {
      this.leftPupilMaterial.uniforms.uIntensity.value = intensity;
    }
    if (this.rightPupilMaterial) {
      this.rightPupilMaterial.uniforms.uIntensity.value = intensity;
    }
  }

  /**
   * Set whether the face can rotate autonomously
   */
  public setFaceRotation(enabled: boolean): void {
    this.faceRotationEnabled = enabled;
    if (!enabled) {
      // Reset to default orientation
      this.animState.headTargetRotY = 0;
      this.animState.headTargetRotX = FACE_CONFIG.tiltAngle;
    }
  }

  // ===========================================================================
  // STATUS & ACTIVITY HANDLERS
  // ===========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    const preset = SUPERVISOR_FACE_PRESETS[status] || SUPERVISOR_FACE_PRESETS.online;
    this.currentPreset = preset;

    // Update wireframe shader
    if (this.wireframeMaterial) {
      this.wireframeMaterial.uniforms.uBaseColor.value.setHex(preset.baseColor);
      this.wireframeMaterial.uniforms.uGlowColor.value.setHex(preset.glowColor);
      this.wireframeMaterial.uniforms.uGlowIntensity.value = preset.glowIntensity;
      this.wireframeMaterial.uniforms.uPulseSpeed.value = preset.pulseSpeed;
      this.wireframeMaterial.uniforms.uScanlineIntensity.value = preset.scanlineIntensity;
    }

    // Update eye shaders
    const eyeIntensity = status === 'offline' ? 0.3 : 1.2;
    if (this.leftPupilMaterial) {
      this.leftPupilMaterial.uniforms.uIntensity.value = eyeIntensity;
      this.leftPupilMaterial.uniforms.uCoreColor.value.setHex(preset.eyeCoreColor);
      this.leftPupilMaterial.uniforms.uGlowColor.value.setHex(preset.eyeGlowColor);
      this.leftPupilMaterial.uniforms.uPupilSize.value = preset.pupilSize;
    }
    if (this.rightPupilMaterial) {
      this.rightPupilMaterial.uniforms.uIntensity.value = eyeIntensity;
      this.rightPupilMaterial.uniforms.uCoreColor.value.setHex(preset.eyeCoreColor);
      this.rightPupilMaterial.uniforms.uGlowColor.value.setHex(preset.eyeGlowColor);
      this.rightPupilMaterial.uniforms.uPupilSize.value = preset.pupilSize;
    }

    // Update eye glow spheres
    if (this.leftEyeGlow?.material instanceof THREE.MeshBasicMaterial) {
      this.leftEyeGlow.material.color.setHex(preset.eyeGlowColor);
      this.leftEyeGlow.material.opacity = status === 'offline' ? 0.08 : 0.25;
    }
    if (this.rightEyeGlow?.material instanceof THREE.MeshBasicMaterial) {
      this.rightEyeGlow.material.color.setHex(preset.eyeGlowColor);
      this.rightEyeGlow.material.opacity = status === 'offline' ? 0.08 : 0.25;
    }

    // Update ambient light
    if (this.faceLight) {
      this.faceLight.color.setHex(preset.glowColor);
      this.faceLight.intensity = status === 'offline' ? 0.3 : 1.5;
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    const speedMultiplier = this.getActivitySpeed();

    // Adjust animation speeds based on activity
    if (this.wireframeMaterial) {
      this.wireframeMaterial.uniforms.uPulseSpeed.value = this.currentPreset.pulseSpeed * speedMultiplier;
    }

    // Higher activity = more scanning behavior
    if (_activity === 'fast' && this.animState.watchingState === 'idle') {
      this.animState.watchingState = 'scanning';
      this.animState.watchTimer = 0;
    }
  }

  // ===========================================================================
  // ANIMATION UPDATE
  // ===========================================================================

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animState.animTime += deltaTime;

    // Update shader time uniforms
    if (this.wireframeMaterial) {
      this.wireframeMaterial.uniforms.uTime.value = this.animState.animTime;
    }
    if (this.leftPupilMaterial) {
      this.leftPupilMaterial.uniforms.uTime.value = this.animState.animTime;
    }
    if (this.rightPupilMaterial) {
      this.rightPupilMaterial.uniforms.uTime.value = this.animState.animTime;
    }

    // Always update floating animation (even when offline, just slower)
    this.updateFloatingAnimation(deltaTime * (this.status === 'offline' ? 0.2 : 1.0));

    // Skip detailed animation when offline
    if (this.status === 'offline') {
      return;
    }

    // Update watching behavior state machine
    if (this.faceRotationEnabled) {
      this.updateWatchingBehavior(deltaTime);
    }

    // Update eye tracking
    this.updateEyeTracking(deltaTime);

    // Update scanline
    this.updateScanline(deltaTime);

    // Update ambient light
    this.updateAmbientLight();
  }

  /**
   * Update floating/breathing animation
   */
  private updateFloatingAnimation(deltaTime: number): void {
    this.animState.floatPhase += deltaTime * 0.5;
    this.animState.breathPhase += deltaTime * 0.3;

    // Vertical bob
    const floatY = Math.sin(this.animState.floatPhase) * FACE_CONFIG.floatAmplitude;

    // Subtle breathing scale
    const breathScale = 1.0 + Math.sin(this.animState.breathPhase) * 0.008;

    // Apply
    this.faceGroup.position.y = FACE_CONFIG.floatHeight + floatY;
    this.faceGroup.scale.setScalar(breathScale);
  }

  /**
   * Update watching behavior state machine
   */
  private updateWatchingBehavior(deltaTime: number): void {
    this.animState.watchTimer += deltaTime;

    switch (this.animState.watchingState) {
      case 'idle':
        this.updateIdleScan(deltaTime);

        // Random chance to start scanning
        if (Math.random() < 0.001) {
          this.animState.watchingState = 'scanning';
          this.animState.watchTimer = 0;
          this.animState.scanPhase = Math.random() > 0.5 ? 'left' : 'right';
        }
        break;

      case 'scanning':
        this.updateScanning(deltaTime);

        if (this.animState.watchTimer > 8) {
          this.animState.watchingState = 'idle';
          this.animState.watchTimer = 0;
        }
        break;

      case 'tracking':
        // Look at specific target (set via lookAt() method)
        // Auto-return to idle after timeout
        if (this.animState.watchTimer > 5) {
          this.animState.watchingState = 'idle';
          this.animState.watchTimer = 0;
        }
        break;
    }

    // Smooth interpolation of head rotation
    const lerpSpeed = 1.2 * deltaTime;
    this.animState.headRotationY += (this.animState.headTargetRotY - this.animState.headRotationY) * lerpSpeed;
    this.animState.headRotationX += (this.animState.headTargetRotX - this.animState.headRotationX) * lerpSpeed;

    // Apply to face group (Y rotation only, X is the tilt)
    this.faceGroup.rotation.y = this.animState.headRotationY;
    this.faceGroup.rotation.x = this.animState.headRotationX;
  }

  /**
   * Idle scan - very slow sinusoidal head movement
   */
  private updateIdleScan(_deltaTime: number): void {
    this.animState.headTargetRotY = Math.sin(this.animState.animTime * 0.08) * 0.2;
    this.animState.headTargetRotX = FACE_CONFIG.tiltAngle + Math.sin(this.animState.animTime * 0.05) * 0.05;

    // Eyes follow head slightly
    this.animState.eyeTargetX = Math.sin(this.animState.animTime * 0.12) * 0.3;
    this.animState.eyeTargetY = Math.sin(this.animState.animTime * 0.08) * 0.1;
  }

  /**
   * Active scanning - quick left-center-right sweep
   */
  private updateScanning(_deltaTime: number): void {
    switch (this.animState.scanPhase) {
      case 'left':
        this.animState.headTargetRotY = -0.35;
        this.animState.eyeTargetX = -0.7;
        if (this.animState.watchTimer > 2) {
          this.animState.scanPhase = 'center';
        }
        break;

      case 'center':
        this.animState.headTargetRotY = 0;
        this.animState.eyeTargetX = 0;
        if (this.animState.watchTimer > 4) {
          this.animState.scanPhase = 'right';
        }
        break;

      case 'right':
        this.animState.headTargetRotY = 0.35;
        this.animState.eyeTargetX = 0.7;
        if (this.animState.watchTimer > 6) {
          this.animState.scanPhase = 'pause';
        }
        break;

      case 'pause':
        // Hold briefly before returning to idle
        this.animState.headTargetRotY = 0;
        this.animState.eyeTargetX = 0;
        break;
    }
  }

  /**
   * Update eye tracking - smooth interpolation
   */
  private updateEyeTracking(deltaTime: number): void {
    const lerpSpeed = 2.0 * deltaTime;

    // Smooth eye movement
    this.animState.eyeLookX += (this.animState.eyeTargetX - this.animState.eyeLookX) * lerpSpeed;
    this.animState.eyeLookY += (this.animState.eyeTargetY - this.animState.eyeLookY) * lerpSpeed;

    // Update public values
    this.eyeLookX = this.animState.eyeLookX;
    this.eyeLookY = this.animState.eyeLookY;

    // Update shader uniforms for look direction
    if (this.leftPupilMaterial) {
      this.leftPupilMaterial.uniforms.uLookDirection.value.set(
        this.animState.eyeLookX,
        this.animState.eyeLookY
      );
    }
    if (this.rightPupilMaterial) {
      this.rightPupilMaterial.uniforms.uLookDirection.value.set(
        this.animState.eyeLookX,
        this.animState.eyeLookY
      );
    }

    // Move glow spheres with pupils slightly
    const glowOffset = 0.1;
    if (this.leftEyeGlow && (this.leftPupil as any).baseX !== undefined) {
      this.leftEyeGlow.position.x = (this.leftPupil as any).baseX + this.animState.eyeLookX * glowOffset;
      this.leftEyeGlow.position.y = (this.leftPupil as any).baseY + this.animState.eyeLookY * glowOffset;
    }
    if (this.rightEyeGlow && (this.rightPupil as any).baseX !== undefined) {
      this.rightEyeGlow.position.x = (this.rightPupil as any).baseX + this.animState.eyeLookX * glowOffset;
      this.rightEyeGlow.position.y = (this.rightPupil as any).baseY + this.animState.eyeLookY * glowOffset;
    }

    // Pupil pulsing for "alive" effect
    const pulseScale = 1.0 + 0.06 * Math.sin(this.animState.animTime * 2.5);
    if (this.leftPupil) {
      this.leftPupil.scale.setScalar(pulseScale);
    }
    if (this.rightPupil) {
      this.rightPupil.scale.setScalar(pulseScale);
    }
  }

  /**
   * Update scanline effect
   */
  private updateScanline(deltaTime: number): void {
    // Scanline sweeps up and down through the face
    const scanSpeed = 0.25 * this.getActivitySpeed();
    this.animState.scanlineY += deltaTime * scanSpeed * this.animState.scanlineDirection;

    // Reverse direction at bounds
    if (this.animState.scanlineY > 1.0) {
      this.animState.scanlineY = 1.0;
      this.animState.scanlineDirection = -1;
    } else if (this.animState.scanlineY < 0) {
      this.animState.scanlineY = 0;
      this.animState.scanlineDirection = 1;
    }

    // Convert to world Y position (face spans roughly -3 to +3 in local Y)
    if (this.wireframeMaterial) {
      const worldY = FACE_CONFIG.floatHeight - 3 + this.animState.scanlineY * 6;
      this.wireframeMaterial.uniforms.uScanlineY.value = worldY;
    }
  }

  /**
   * Update ambient light
   */
  private updateAmbientLight(): void {
    if (this.faceLight) {
      // Light follows face position
      this.faceLight.position.y = this.faceGroup.position.y;

      // Subtle intensity pulse
      const pulse = 1.2 + 0.3 * Math.sin(this.animState.animTime * 1.5);
      this.faceLight.intensity = pulse * (this.status === 'offline' ? 0.2 : 1.0);
    }
  }

  // ===========================================================================
  // CONSTRUCTION/DECONSTRUCTION ANIMATIONS
  // ===========================================================================

  override playConstructAnimation(): Promise<void> {
    return new Promise((resolve) => {
      // Make visible but start with low opacity
      this.group.visible = true;

      if (this.wireframeMaterial) {
        this.wireframeMaterial.uniforms.uOpacity.value = 0;
      }

      // Hide eyes initially
      if (this.leftPupil) this.leftPupil.visible = false;
      if (this.rightPupil) this.rightPupil.visible = false;
      if (this.leftEyeGlow) this.leftEyeGlow.visible = false;
      if (this.rightEyeGlow) this.rightEyeGlow.visible = false;

      const duration = 5000; // 5 seconds
      const eyeStartTime = 4000; // Eyes appear at 4s
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Wireframe reveal from bottom to top
        if (this.wireframeMaterial) {
          // Opacity ramps up with holographic flicker
          const flicker = 0.85 + 0.15 * Math.sin(elapsed * 0.03);
          this.wireframeMaterial.uniforms.uOpacity.value = progress * flicker;

          // Scanline sweeps up during construction
          const scanY = FACE_CONFIG.floatHeight - 4 + progress * 10;
          this.wireframeMaterial.uniforms.uScanlineY.value = scanY;
          this.wireframeMaterial.uniforms.uScanlineIntensity.value = 0.8;
        }

        // Eyes power up near the end
        if (elapsed > eyeStartTime) {
          const eyeProgress = (elapsed - eyeStartTime) / (duration - eyeStartTime);

          if (this.leftPupil) this.leftPupil.visible = true;
          if (this.rightPupil) this.rightPupil.visible = true;
          if (this.leftEyeGlow) this.leftEyeGlow.visible = true;
          if (this.rightEyeGlow) this.rightEyeGlow.visible = true;

          const eyeIntensity = eyeProgress * 1.2;
          if (this.leftPupilMaterial) {
            this.leftPupilMaterial.uniforms.uIntensity.value = eyeIntensity;
          }
          if (this.rightPupilMaterial) {
            this.rightPupilMaterial.uniforms.uIntensity.value = eyeIntensity;
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Reset scanline intensity to normal
          if (this.wireframeMaterial) {
            this.wireframeMaterial.uniforms.uScanlineIntensity.value = this.currentPreset.scanlineIntensity;
          }
          resolve();
        }
      };

      animate();
    });
  }

  override playDeconstructAnimation(): Promise<void> {
    return new Promise((resolve) => {
      const duration = 2000; // 2 seconds
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Eyes dim first
        const eyeIntensity = Math.max(0, 1.2 - progress * 3);
        if (this.leftPupilMaterial) {
          this.leftPupilMaterial.uniforms.uIntensity.value = eyeIntensity;
        }
        if (this.rightPupilMaterial) {
          this.rightPupilMaterial.uniforms.uIntensity.value = eyeIntensity;
        }

        // Wireframe fades with red tint
        if (this.wireframeMaterial) {
          this.wireframeMaterial.uniforms.uOpacity.value = 1 - progress;

          // Shift to red during deconstruction
          const redShift = progress;
          const baseColor = new THREE.Color(this.currentPreset.baseColor);
          baseColor.lerp(new THREE.Color(0xff2200), redShift);
          this.wireframeMaterial.uniforms.uBaseColor.value = baseColor;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.visible = false;
          resolve();
        }
      };

      animate();
    });
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  override dispose(): void {
    // Dispose wireframe material
    if (this.wireframeMaterial) {
      this.wireframeMaterial.dispose();
    }

    // Dispose pupil materials
    if (this.leftPupilMaterial) {
      this.leftPupilMaterial.dispose();
    }
    if (this.rightPupilMaterial) {
      this.rightPupilMaterial.dispose();
    }

    // Dispose eye glow materials
    if (this.leftEyeGlow?.material instanceof THREE.Material) {
      this.leftEyeGlow.material.dispose();
    }
    if (this.rightEyeGlow?.material instanceof THREE.Material) {
      this.rightEyeGlow.material.dispose();
    }

    // Dispose face mesh geometries
    for (const mesh of this.faceMeshes) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
    }

    super.dispose();
  }
}
