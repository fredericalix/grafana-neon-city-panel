import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';
import { createHologramMaterial, updateHologramMaterial, HOLOGRAM_PRESETS } from './HologramShader';

/**
 * TowerB Prefab - Octagonal tower with holographic text ring and cute rabbit hologram
 * Features: 3 units tall octagonal tower, rotating text ring, kawaii-style
 * holographic rabbit on top with custom shader effects (scanlines, chromatic aberration,
 * flicker, fresnel glow) and gentle bobbing/ear wiggling animation
 * Occupies 1x1 grid cell
 */
export class TowerBPrefab extends BasePrefab {
  private towerBody!: THREE.Mesh;
  private neonEdges: THREE.Line[] = [];
  private animTime = 0;

  // Text ring system (like DisplayA but larger)
  private textRing!: THREE.Group;
  private textCanvas!: HTMLCanvasElement;
  private textContext!: CanvasRenderingContext2D;
  private textTexture!: THREE.CanvasTexture;
  private ringText = 'WHOOKTOWN';
  private textMesh!: THREE.Mesh;

  // Rabbit hologram system with custom hologram shader
  private rabbitGroup!: THREE.Group;
  private hologramEnabled = true;
  private rabbitParts: Map<string, THREE.Mesh> = new Map();
  private rabbitMaterial!: THREE.ShaderMaterial;
  private projectionRing!: THREE.Mesh;
  private projectionBeam!: THREE.Mesh;
  private animPhase = 0;

  // Tower dimensions
  private readonly TOWER_HEIGHT = 3.0;
  private readonly TOWER_RADIUS = 0.4;
  private readonly TEXT_RING_HEIGHT = 0.4;
  private readonly RABBIT_HEIGHT = 1.2; // Cute compact proportions

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Base platform
    this.createBasePlatform();

    // Octagonal tower body
    this.createOctagonalTower();

    // Holographic text ring
    this.createTextRing();

    // Cute rabbit hologram with custom shader
    this.createRabbit();

    // Neon accents
    this.createNeonAccents();

    // Ground glow
    this.createGroundGlow();
  }

  private createBasePlatform(): void {
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Octagonal base
    const baseGeo = new THREE.CylinderGeometry(
      this.TOWER_RADIUS + 0.15,
      this.TOWER_RADIUS + 0.2,
      0.1,
      8
    );
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.05;
    base.castShadow = true;
    this.group.add(base);

    // Neon ring around base
    const ringGeo = new THREE.TorusGeometry(this.TOWER_RADIUS + 0.18, 0.02, 8, 8);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createOctagonalTower(): void {
    // Main octagonal tower body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.15,
    });

    const bodyGeo = new THREE.CylinderGeometry(
      this.TOWER_RADIUS - 0.02,
      this.TOWER_RADIUS,
      this.TOWER_HEIGHT,
      8
    );
    this.towerBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.towerBody.position.y = 0.1 + this.TOWER_HEIGHT / 2;
    this.towerBody.castShadow = true;
    this.group.add(this.towerBody);

    // Horizontal accent bands
    const bandHeights = [0.5, 1.5, 2.5];
    for (const h of bandHeights) {
      const bandGeo = new THREE.TorusGeometry(this.TOWER_RADIUS + 0.01, 0.015, 8, 8);
      const bandMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.6,
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.1 + h;
      this.addGlowMesh(band);
      this.group.add(band);
    }

    // Top cap
    const capGeo = new THREE.CylinderGeometry(
      this.TOWER_RADIUS + 0.05,
      this.TOWER_RADIUS - 0.02,
      0.15,
      8
    );
    const capMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.9,
      roughness: 0.1,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.1 + this.TOWER_HEIGHT + 0.075;
    this.group.add(cap);
  }

  private createTextRing(): void {
    this.textRing = new THREE.Group();
    this.textRing.position.y = 0.1 + this.TOWER_HEIGHT / 2;
    this.group.add(this.textRing);

    // Create canvas for text texture
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 128;
    this.textContext = this.textCanvas.getContext('2d')!;

    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.wrapS = THREE.RepeatWrapping;
    this.textTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Create curved text band
    const ringRadius = this.TOWER_RADIUS + 0.25;
    const ringGeo = new THREE.CylinderGeometry(
      ringRadius,
      ringRadius,
      this.TEXT_RING_HEIGHT,
      32,
      1,
      true
    );

    const ringMat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });

    this.textMesh = new THREE.Mesh(ringGeo, ringMat);
    this.textRing.add(this.textMesh);

    // Initial render
    this.updateTextTexture();
  }

  private updateTextTexture(): void {
    const ctx = this.textContext;
    const canvas = this.textCanvas;
    const text = this.ringText || 'WHOOKTOWN';

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background with slight transparency - darker blue tint
    ctx.fillStyle = 'rgba(0, 10, 40, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text styling
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Repeat text to fill the canvas width
    const textWidth = ctx.measureText(text + '   ').width;
    const repeats = Math.ceil(canvas.width / textWidth) + 1;
    const fullText = (text + '   ').repeat(repeats);

    // Glow effect - NEON BLUE
    ctx.shadowColor = '#0088ff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = 'rgba(0, 136, 255, 0.9)';
    ctx.fillText(fullText, 0, canvas.height / 2);

    // Bright center
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(200, 230, 255, 0.95)';
    ctx.fillText(fullText, 0, canvas.height / 2);

    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 0; y < canvas.height; y += 4) {
      ctx.fillRect(0, y, canvas.width, 2);
    }

    this.textTexture.needsUpdate = true;
  }

  private createRabbit(): void {
    this.rabbitGroup = new THREE.Group();
    this.rabbitGroup.position.y = 0.1 + this.TOWER_HEIGHT + 0.15;
    this.group.add(this.rabbitGroup);

    // Create holographic shader material with cute rabbit preset
    this.rabbitMaterial = createHologramMaterial(HOLOGRAM_PRESETS.rabbit);

    // Scale factor for rabbit - kawaii compact proportions
    const scale = this.RABBIT_HEIGHT;

    // Create the cute rabbit figure
    this.createRabbitBody(scale);

    // Projection system (base ring and beam)
    this.createProjectionSystem(scale);
  }

  /**
   * Creates a cute kawaii-style rabbit figure with round proportions
   */
  private createRabbitBody(scale: number): void {
    // BODY - large round body (kawaii style = big body, small head ratio inverted)
    const bodyGeo = new THREE.SphereGeometry(0.28 * scale, 24, 24);
    const body = new THREE.Mesh(bodyGeo, this.rabbitMaterial.clone());
    body.position.y = 0.32 * scale;
    body.scale.set(1.0, 0.9, 0.85); // Slightly flattened, chubby
    this.rabbitParts.set('body', body);
    this.rabbitGroup.add(body);

    // HEAD - large round head for kawaii proportions
    const headGeo = new THREE.SphereGeometry(0.22 * scale, 24, 24);
    const head = new THREE.Mesh(headGeo, this.rabbitMaterial.clone());
    head.position.y = 0.72 * scale;
    head.scale.set(1.0, 0.95, 0.9);
    this.rabbitParts.set('head', head);
    this.rabbitGroup.add(head);

    // CHEEKS - puffy cheeks for extra cuteness
    const cheekGeo = new THREE.SphereGeometry(0.08 * scale, 16, 16);
    const cheekL = new THREE.Mesh(cheekGeo, this.rabbitMaterial.clone());
    cheekL.position.set(-0.12 * scale, 0.65 * scale, 0.12 * scale);
    this.rabbitParts.set('cheekL', cheekL);
    this.rabbitGroup.add(cheekL);

    const cheekR = new THREE.Mesh(cheekGeo.clone(), this.rabbitMaterial.clone());
    cheekR.position.set(0.12 * scale, 0.65 * scale, 0.12 * scale);
    this.rabbitParts.set('cheekR', cheekR);
    this.rabbitGroup.add(cheekR);

    // SNOUT - small cute nose area
    const snoutGeo = new THREE.SphereGeometry(0.06 * scale, 16, 16);
    const snout = new THREE.Mesh(snoutGeo, this.rabbitMaterial.clone());
    snout.position.set(0, 0.65 * scale, 0.18 * scale);
    snout.scale.set(1.0, 0.8, 0.7);
    this.rabbitParts.set('snout', snout);
    this.rabbitGroup.add(snout);

    // NOSE - tiny pink-ish nose
    const noseGeo = new THREE.SphereGeometry(0.025 * scale, 12, 12);
    const nose = new THREE.Mesh(noseGeo, this.rabbitMaterial.clone());
    nose.position.set(0, 0.66 * scale, 0.22 * scale);
    nose.scale.set(1.2, 0.8, 0.6);
    this.rabbitParts.set('nose', nose);
    this.rabbitGroup.add(nose);

    // EARS - long floppy ears (signature rabbit feature)
    // Left ear base
    const earBaseGeo = new THREE.CapsuleGeometry(0.045 * scale, 0.25 * scale, 8, 12);
    const earL = new THREE.Mesh(earBaseGeo, this.rabbitMaterial.clone());
    earL.position.set(-0.1 * scale, 1.05 * scale, -0.02 * scale);
    earL.rotation.set(-0.15, 0, -0.2);
    this.rabbitParts.set('earL', earL);
    this.rabbitGroup.add(earL);

    // Left ear tip (thinner, longer)
    const earTipGeo = new THREE.CapsuleGeometry(0.035 * scale, 0.2 * scale, 8, 12);
    const earTipL = new THREE.Mesh(earTipGeo, this.rabbitMaterial.clone());
    earTipL.position.set(-0.12 * scale, 1.35 * scale, -0.06 * scale);
    earTipL.rotation.set(-0.2, 0, -0.25);
    this.rabbitParts.set('earTipL', earTipL);
    this.rabbitGroup.add(earTipL);

    // Right ear base
    const earR = new THREE.Mesh(earBaseGeo.clone(), this.rabbitMaterial.clone());
    earR.position.set(0.1 * scale, 1.05 * scale, -0.02 * scale);
    earR.rotation.set(-0.15, 0, 0.2);
    this.rabbitParts.set('earR', earR);
    this.rabbitGroup.add(earR);

    // Right ear tip
    const earTipR = new THREE.Mesh(earTipGeo.clone(), this.rabbitMaterial.clone());
    earTipR.position.set(0.12 * scale, 1.35 * scale, -0.06 * scale);
    earTipR.rotation.set(-0.2, 0, 0.25);
    this.rabbitParts.set('earTipR', earTipR);
    this.rabbitGroup.add(earTipR);

    // FRONT PAWS - small and cute
    const pawFrontGeo = new THREE.SphereGeometry(0.055 * scale, 12, 12);
    const pawFrontL = new THREE.Mesh(pawFrontGeo, this.rabbitMaterial.clone());
    pawFrontL.position.set(-0.12 * scale, 0.12 * scale, 0.15 * scale);
    pawFrontL.scale.set(0.8, 1.0, 1.2);
    this.rabbitParts.set('pawFrontL', pawFrontL);
    this.rabbitGroup.add(pawFrontL);

    const pawFrontR = new THREE.Mesh(pawFrontGeo.clone(), this.rabbitMaterial.clone());
    pawFrontR.position.set(0.12 * scale, 0.12 * scale, 0.15 * scale);
    pawFrontR.scale.set(0.8, 1.0, 1.2);
    this.rabbitParts.set('pawFrontR', pawFrontR);
    this.rabbitGroup.add(pawFrontR);

    // BACK PAWS - larger, powerful bunny feet
    const pawBackGeo = new THREE.CapsuleGeometry(0.05 * scale, 0.12 * scale, 8, 12);
    const pawBackL = new THREE.Mesh(pawBackGeo, this.rabbitMaterial.clone());
    pawBackL.position.set(-0.15 * scale, 0.06 * scale, -0.08 * scale);
    pawBackL.rotation.set(Math.PI / 2 - 0.3, 0, -0.2);
    this.rabbitParts.set('pawBackL', pawBackL);
    this.rabbitGroup.add(pawBackL);

    const pawBackR = new THREE.Mesh(pawBackGeo.clone(), this.rabbitMaterial.clone());
    pawBackR.position.set(0.15 * scale, 0.06 * scale, -0.08 * scale);
    pawBackR.rotation.set(Math.PI / 2 - 0.3, 0, 0.2);
    this.rabbitParts.set('pawBackR', pawBackR);
    this.rabbitGroup.add(pawBackR);

    // TAIL - fluffy round cotton tail
    const tailGeo = new THREE.SphereGeometry(0.08 * scale, 16, 16);
    const tail = new THREE.Mesh(tailGeo, this.rabbitMaterial.clone());
    tail.position.set(0, 0.25 * scale, -0.25 * scale);
    this.rabbitParts.set('tail', tail);
    this.rabbitGroup.add(tail);

    // INNER GLOW CORE - ethereal heart of the hologram
    const coreGeo = new THREE.SphereGeometry(0.08 * scale, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xaaffff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.4 * scale;
    this.rabbitGroup.add(core);
  }

  /**
   * Creates the holographic projection base and beam effect
   */
  private createProjectionSystem(_scale: number): void {
    // Projection ring at base - cyan glow to match rabbit
    const baseRingGeo = new THREE.TorusGeometry(0.25, 0.012, 12, 48);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: 0x66ffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.projectionRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    this.projectionRing.rotation.x = Math.PI / 2;
    this.projectionRing.position.y = 0.01;
    this.addGlowMesh(this.projectionRing);
    this.rabbitGroup.add(this.projectionRing);

    // Inner projection ring
    const innerRingGeo = new THREE.TorusGeometry(0.15, 0.008, 12, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.02;
    this.addGlowMesh(innerRing);
    this.rabbitGroup.add(innerRing);

    // Projection beam cone - subtle upward light
    const beamGeo = new THREE.ConeGeometry(0.28, 0.35, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.projectionBeam = new THREE.Mesh(beamGeo, beamMat);
    this.projectionBeam.position.y = -0.03;
    this.projectionBeam.rotation.x = Math.PI;
    this.rabbitGroup.add(this.projectionBeam);

    // Ground glow disc
    const glowDiscGeo = new THREE.CircleGeometry(0.35, 32);
    const glowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x66ffff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const glowDisc = new THREE.Mesh(glowDiscGeo, glowDiscMat);
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 0.005;
    this.rabbitGroup.add(glowDisc);
  }

  /**
   * Animate the cute rabbit hologram with gentle bobbing and ear wiggling
   */
  private animateRabbit(deltaTime: number): void {
    if (!this.hologramEnabled) {
      this.rabbitGroup.visible = false;
      return;
    }
    this.rabbitGroup.visible = true;

    const speed = this.getActivitySpeed();
    this.animPhase += deltaTime * 1.8 * speed;

    const scale = this.RABBIT_HEIGHT;
    const phase = this.animPhase;

    // Update hologram shader time for all parts
    this.rabbitParts.forEach((part) => {
      if (part.material instanceof THREE.ShaderMaterial) {
        updateHologramMaterial(part.material, this.animTime);
      }
    });

    // Slow gentle rotation - rabbit looking around
    this.rabbitGroup.rotation.y += deltaTime * 0.15 * speed;

    // --- BODY BOBBING ---
    // Gentle up-down breathing motion
    const breathe = Math.sin(phase * 1.2) * 0.015 * scale;
    const body = this.rabbitParts.get('body');
    if (body) {
      body.position.y = 0.32 * scale + breathe;
      // Subtle body squish when breathing
      body.scale.y = 0.9 + Math.sin(phase * 1.2) * 0.03;
    }

    // --- HEAD MOVEMENT ---
    // Cute head tilt and looking around
    const head = this.rabbitParts.get('head');
    if (head) {
      head.position.y = 0.72 * scale + breathe * 1.2;
      // Looking around curiously
      head.rotation.y = Math.sin(phase * 0.4) * 0.25;
      // Cute head tilt
      head.rotation.z = Math.sin(phase * 0.55) * 0.1;
      // Occasional nod
      head.rotation.x = Math.sin(phase * 0.3) * 0.08;
    }

    // Cheeks follow head
    const cheekL = this.rabbitParts.get('cheekL');
    const cheekR = this.rabbitParts.get('cheekR');
    if (cheekL && cheekR) {
      cheekL.position.y = 0.65 * scale + breathe * 1.1;
      cheekR.position.y = 0.65 * scale + breathe * 1.1;
      // Cute puffing cheeks
      cheekL.scale.setScalar(1 + Math.abs(Math.sin(phase * 2.5)) * 0.1);
      cheekR.scale.setScalar(1 + Math.abs(Math.sin(phase * 2.5)) * 0.1);
    }

    // Snout and nose follow head
    const snout = this.rabbitParts.get('snout');
    const nose = this.rabbitParts.get('nose');
    if (snout) {
      snout.position.y = 0.65 * scale + breathe * 1.1;
    }
    if (nose) {
      nose.position.y = 0.66 * scale + breathe * 1.1;
      // Nose twitch - classic cute rabbit behavior
      const twitch = Math.sin(phase * 8) * Math.sin(phase * 0.5) * 0.02 * scale;
      nose.position.z = 0.22 * scale + twitch;
      nose.scale.x = 1.2 + Math.sin(phase * 8) * 0.15;
    }

    // --- EAR WIGGLING ---
    // Left ear - gentle flopping motion
    const earL = this.rabbitParts.get('earL');
    const earTipL = this.rabbitParts.get('earTipL');
    if (earL) {
      // Base rotation with gentle sway
      earL.rotation.z = -0.2 + Math.sin(phase * 0.7) * 0.15;
      earL.rotation.x = -0.15 + Math.sin(phase * 0.5) * 0.1;
      // Occasional alert perk-up
      const alertL = Math.max(0, Math.sin(phase * 0.3)) * 0.1;
      earL.rotation.z -= alertL;
    }
    if (earTipL) {
      // Tip flops more than base (natural ear physics)
      earTipL.rotation.z = -0.25 + Math.sin(phase * 0.7 + 0.3) * 0.2;
      earTipL.rotation.x = -0.2 + Math.sin(phase * 0.5 + 0.2) * 0.12;
    }

    // Right ear - slightly offset timing for natural look
    const earR = this.rabbitParts.get('earR');
    const earTipR = this.rabbitParts.get('earTipR');
    if (earR) {
      earR.rotation.z = 0.2 + Math.sin(phase * 0.7 + 0.5) * 0.15;
      earR.rotation.x = -0.15 + Math.sin(phase * 0.5 + 0.3) * 0.1;
      const alertR = Math.max(0, Math.sin(phase * 0.3 + 0.2)) * 0.1;
      earR.rotation.z += alertR;
    }
    if (earTipR) {
      earTipR.rotation.z = 0.25 + Math.sin(phase * 0.7 + 0.8) * 0.2;
      earTipR.rotation.x = -0.2 + Math.sin(phase * 0.5 + 0.5) * 0.12;
    }

    // --- PAWS ---
    // Front paws - gentle kneading motion
    const pawFrontL = this.rabbitParts.get('pawFrontL');
    const pawFrontR = this.rabbitParts.get('pawFrontR');
    if (pawFrontL) {
      pawFrontL.position.y = 0.12 * scale + Math.sin(phase * 2 + Math.PI) * 0.01 * scale;
    }
    if (pawFrontR) {
      pawFrontR.position.y = 0.12 * scale + Math.sin(phase * 2) * 0.01 * scale;
    }

    // Back paws - subtle ready-to-hop tension
    const pawBackL = this.rabbitParts.get('pawBackL');
    const pawBackR = this.rabbitParts.get('pawBackR');
    if (pawBackL) {
      pawBackL.rotation.x = Math.PI / 2 - 0.3 + Math.sin(phase * 1.5) * 0.05;
    }
    if (pawBackR) {
      pawBackR.rotation.x = Math.PI / 2 - 0.3 + Math.sin(phase * 1.5 + Math.PI) * 0.05;
    }

    // --- TAIL ---
    // Fluffy tail wiggle
    const tail = this.rabbitParts.get('tail');
    if (tail) {
      tail.position.y = 0.25 * scale + breathe * 0.8;
      // Cute tail wiggle
      tail.position.x = Math.sin(phase * 3) * 0.015 * scale;
      tail.scale.setScalar(1 + Math.sin(phase * 2) * 0.08);
    }

    // --- PROJECTION SYSTEM ---
    // Projection ring - subtle pulsing rotation
    if (this.projectionRing) {
      this.projectionRing.rotation.z += deltaTime * 0.5;
      const ringMat = this.projectionRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0.7 + Math.sin(this.animTime * 4) * 0.15;
    }

    // Projection beam - breathing effect
    if (this.projectionBeam) {
      const beamMat = this.projectionBeam.material as THREE.MeshBasicMaterial;
      beamMat.opacity = 0.04 + Math.sin(this.animTime * 3) * 0.02;
      this.projectionBeam.scale.x = 1 + Math.sin(this.animTime * 2.5) * 0.08;
      this.projectionBeam.scale.z = 1 + Math.sin(this.animTime * 2.5) * 0.08;
    }
  }

  private createNeonAccents(): void {
    // Vertical neon lines on tower edges
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * this.TOWER_RADIUS;
      const z = Math.sin(angle) * this.TOWER_RADIUS;

      const points = [
        new THREE.Vector3(x, 0.1, z),
        new THREE.Vector3(x * 0.95, 0.1 + this.TOWER_HEIGHT, z * 0.95),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, edgeMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createGroundGlow(): void {
    const glowGeo = new THREE.CircleGeometry(0.7, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    this.group.add(glow);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  updateRingText(text: string): void {
    this.ringText = text || 'WHOOKTOWN';
    this.updateTextTexture();
  }

  updateHologramEnabled(enabled: boolean): void {
    this.hologramEnabled = enabled;
    this.rabbitGroup.visible = enabled;
  }

  // ---------------------------------------------------------------------------
  // STATUS & ACTIVITY
  // ---------------------------------------------------------------------------

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    // Dim neon edges
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.8;
        if (isCritical) {
          edge.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          edge.material.color.setHex(COLORS.glow.orange);
        } else {
          edge.material.color.setHex(COLORS.glow.cyan);
        }
      }
    });

    // Dim text ring
    if (this.textMesh?.material instanceof THREE.MeshBasicMaterial) {
      this.textMesh.material.opacity = isOffline ? 0.3 : 0.9;
    }

    // Hide rabbit hologram when offline
    if (isOffline) {
      this.rabbitGroup.visible = false;
    } else if (this.hologramEnabled) {
      this.rabbitGroup.visible = true;
    }

    // Update rabbit shader colors for warning/critical
    if (isCritical) {
      this.rabbitParts.forEach((part) => {
        if (part.material instanceof THREE.ShaderMaterial) {
          part.material.uniforms.uColor.value = new THREE.Color(0xff4444);
          part.material.uniforms.uGlowColor.value = new THREE.Color(0xff0000);
          part.material.uniforms.uGlitchIntensity.value = 0.3;
          part.material.uniforms.uFlickerIntensity.value = 0.35;
        }
      });
    } else if (isWarning) {
      this.rabbitParts.forEach((part) => {
        if (part.material instanceof THREE.ShaderMaterial) {
          part.material.uniforms.uColor.value = new THREE.Color(0xffaa00);
          part.material.uniforms.uGlowColor.value = new THREE.Color(0xff6600);
          part.material.uniforms.uGlitchIntensity.value = 0.15;
          part.material.uniforms.uFlickerIntensity.value = 0.2;
        }
      });
    } else {
      // Reset to default rabbit colors
      this.rabbitParts.forEach((part) => {
        if (part.material instanceof THREE.ShaderMaterial) {
          part.material.uniforms.uColor.value = new THREE.Color(HOLOGRAM_PRESETS.rabbit.color);
          part.material.uniforms.uGlowColor.value = new THREE.Color(HOLOGRAM_PRESETS.rabbit.glowColor);
          part.material.uniforms.uGlitchIntensity.value = HOLOGRAM_PRESETS.rabbit.glitchIntensity;
          part.material.uniforms.uFlickerIntensity.value = HOLOGRAM_PRESETS.rabbit.flickerIntensity;
        }
      });
    }

    // Body emissive for warning/critical
    if (this.towerBody?.material instanceof THREE.MeshStandardMaterial) {
      this.towerBody.material.emissive = new THREE.Color(
        isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects animation speed - handled in update()
  }

  // ---------------------------------------------------------------------------
  // ANIMATION
  // ---------------------------------------------------------------------------

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') return;

    this.animTime += deltaTime;
    const speed = this.getActivitySpeed();

    // Rotate text ring
    if (this.textRing) {
      this.textRing.rotation.y += deltaTime * 0.5 * speed;
    }

    // Scroll text texture (UV offset)
    if (this.textTexture) {
      this.textTexture.offset.x -= deltaTime * 0.1 * speed;
    }

    // Animate rabbit hologram
    this.animateRabbit(deltaTime);

    // Pulse neon edges
    const pulse = 0.6 + 0.4 * Math.sin(this.animTime * 3);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          edge.material.opacity = pulse * 0.8;
        }
      }
    });
  }

  override dispose(): void {
    // Dispose rabbit materials (shader materials need explicit disposal)
    this.rabbitParts.forEach((part) => {
      if (part.material instanceof THREE.ShaderMaterial) {
        part.material.dispose();
      }
    });

    // Dispose textures
    if (this.textTexture) {
      this.textTexture.dispose();
    }

    super.dispose();
  }
}
