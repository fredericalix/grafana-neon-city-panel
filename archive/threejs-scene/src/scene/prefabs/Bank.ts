import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BankQuantity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

// Gold color for holographic bars
const GOLD_COLOR = 0xffd700;
const GOLD_GLOW = 0xffaa00;

/**
 * Bank Prefab - Cyberpunk/Tron Style High-Tech Vault
 * Features: Holographic displays, data flow particles, security shields, neon accents
 * Additional: Gold quantity indicator, amount holographic display
 */
export class BankPrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private dataFlow!: THREE.Points;
  private neonEdges: THREE.LineSegments[] = [];
  private securityShield!: THREE.Mesh;
  private hologramRings: THREE.Mesh[] = [];
  private vaultDoor!: THREE.Mesh;
  private animTime = 0;

  // Gold quantity hologram system (above bank)
  private quantityHologram!: THREE.Group;
  private holoGoldBars: THREE.Mesh[] = [];
  private quantityProjectionCone!: THREE.Mesh;
  private quantityRing!: THREE.Mesh;
  private quantity: BankQuantity = 'none';

  // Epic holographic amount display system
  private displayPanel!: THREE.Group;
  private amountCanvas!: HTMLCanvasElement;
  private amountContext!: CanvasRenderingContext2D;
  private amountMesh!: THREE.Mesh;
  private projectionCone!: THREE.Mesh;
  private goldParticles!: THREE.Points;
  private frameGlowBars: THREE.Mesh[] = [];
  private scanLineOffset = 0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Dark metallic fortress body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Elevated base platform
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.8,
      roughness: 0.3,
    });
    const baseGeo = new THREE.BoxGeometry(0.75, 0.08, 0.55);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.04;
    base.castShadow = true;
    this.group.add(base);

    // Main vault body - fortified design
    const bodyGeo = new THREE.BoxGeometry(0.65, 0.55, 0.45);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.355;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Angular roof structure
    this.createRoof();

    // Neon edge lines (Tron style)
    this.addNeonEdges();

    // Holographic security columns
    this.createSecurityColumns();

    // Vault door with hologram
    this.createVaultDoor();

    // Security shield effect
    this.createSecurityShield();

    // Data flow particles (transactions)
    this.createDataFlow();

    // Holographic projector rings
    this.createHologramProjectors();

    // Status light
    const light = this.createGlowPoint(0, 0.78, 0, COLORS.state.online, 0.05);
    this.group.add(light);

    // Gold quantity hologram (above bank)
    this.createQuantityHologram();

    // Amount holographic display (above bank)
    this.createAmountDisplay();
  }

  private createRoof(): void {
    // Flat fortified roof
    const roofMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });

    const roofGeo = new THREE.BoxGeometry(0.7, 0.05, 0.5);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.655;
    this.group.add(roof);

    // Central spire/antenna
    const spireGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.15, 6);
    const spire = new THREE.Mesh(spireGeo, roofMat);
    spire.position.y = 0.75;
    this.group.add(spire);

    // Glowing tip
    const tipGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.84;
    this.addGlowMesh(tip);
    this.group.add(tip);
  }

  private addNeonEdges(): void {
    const neonMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });

    const width = 0.65;
    const height = 0.55;
    const depth = 0.45;
    const hw = width / 2;
    const baseY = 0.08;
    const topY = baseY + height;
    const hd = depth / 2;

    // Bottom edge rectangle
    const bottomPoints = [
      new THREE.Vector3(-hw, baseY, hd),
      new THREE.Vector3(hw, baseY, hd),
      new THREE.Vector3(hw, baseY, hd),
      new THREE.Vector3(hw, baseY, -hd),
      new THREE.Vector3(hw, baseY, -hd),
      new THREE.Vector3(-hw, baseY, -hd),
      new THREE.Vector3(-hw, baseY, -hd),
      new THREE.Vector3(-hw, baseY, hd),
    ];
    const bottomGeo = new THREE.BufferGeometry().setFromPoints(bottomPoints);
    const bottomLine = new THREE.LineSegments(bottomGeo, neonMat.clone());
    this.neonEdges.push(bottomLine);
    this.group.add(bottomLine);

    // Top edge
    const topPoints = bottomPoints.map(p => new THREE.Vector3(p.x, topY, p.z));
    const topGeo = new THREE.BufferGeometry().setFromPoints(topPoints);
    const topLine = new THREE.LineSegments(topGeo, neonMat.clone());
    this.neonEdges.push(topLine);
    this.group.add(topLine);

    // Vertical corners
    const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
    for (const [x, z] of corners) {
      const points = [
        new THREE.Vector3(x, baseY, z),
        new THREE.Vector3(x, topY, z),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(geo, neonMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }

    // Mid-height accent line
    const midY = baseY + height * 0.6;
    const midPoints = [
      new THREE.Vector3(-hw - 0.01, midY, hd + 0.01),
      new THREE.Vector3(hw + 0.01, midY, hd + 0.01),
      new THREE.Vector3(hw + 0.01, midY, hd + 0.01),
      new THREE.Vector3(hw + 0.01, midY, -hd - 0.01),
      new THREE.Vector3(hw + 0.01, midY, -hd - 0.01),
      new THREE.Vector3(-hw - 0.01, midY, -hd - 0.01),
      new THREE.Vector3(-hw - 0.01, midY, -hd - 0.01),
      new THREE.Vector3(-hw - 0.01, midY, hd + 0.01),
    ];
    const midMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.8,
    });
    const midGeo = new THREE.BufferGeometry().setFromPoints(midPoints);
    const midLine = new THREE.LineSegments(midGeo, midMat);
    this.neonEdges.push(midLine);
    this.group.add(midLine);
  }

  private createSecurityColumns(): void {
    const columnMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });

    const positions = [-0.28, 0.28];

    for (const x of positions) {
      // Column body
      const columnGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
      const column = new THREE.Mesh(columnGeo, columnMat);
      column.position.set(x, 0.33, 0.24);
      column.castShadow = true;
      this.group.add(column);

      // Neon ring on column
      const ringGeo = new THREE.TorusGeometry(0.045, 0.008, 4, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, 0.5, 0.24);
      ring.rotation.x = Math.PI / 2;
      this.addGlowMesh(ring);
      this.group.add(ring);

      // Column top glow
      const topGeo = new THREE.SphereGeometry(0.025, 8, 8);
      const topMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.7,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.set(x, 0.58, 0.24);
      this.addGlowMesh(top);
      this.group.add(top);
    }
  }

  private createVaultDoor(): void {
    // Vault door - circular high-tech design
    const doorGeo = new THREE.CircleGeometry(0.12, 16);
    const doorMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.95,
      roughness: 0.1,
    });
    this.vaultDoor = new THREE.Mesh(doorGeo, doorMat);
    this.vaultDoor.position.set(0, 0.3, 0.23);
    this.group.add(this.vaultDoor);

    // Vault door frame glow
    const frameGeo = new THREE.TorusGeometry(0.13, 0.015, 8, 24);
    const frameMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.8,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 0.3, 0.235);
    this.addGlowMesh(frame);
    this.group.add(frame);

    // Inner ring detail
    const innerGeo = new THREE.TorusGeometry(0.08, 0.01, 8, 16);
    const inner = new THREE.Mesh(innerGeo, frameMat.clone());
    inner.position.set(0, 0.3, 0.232);
    this.group.add(inner);

    // Center lock indicator
    const lockGeo = new THREE.OctahedronGeometry(0.03, 0);
    const lockMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.9,
    });
    const lock = new THREE.Mesh(lockGeo, lockMat);
    lock.position.set(0, 0.3, 0.24);
    this.addGlowMesh(lock);
    this.group.add(lock);
  }

  private createSecurityShield(): void {
    // Transparent security shield dome
    const shieldGeo = new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    this.securityShield = new THREE.Mesh(shieldGeo, shieldMat);
    this.securityShield.position.y = 0.08;
    this.group.add(this.securityShield);

    // Shield edge ring
    const edgeGeo = new THREE.TorusGeometry(0.5, 0.005, 4, 32);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.4,
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = 0.08;
    edge.rotation.x = Math.PI / 2;
    this.addGlowMesh(edge);
    this.group.add(edge);
  }

  private createDataFlow(): void {
    // Vertical data particles representing transactions
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = Math.random() * 0.5 + 0.1;
      positions[i * 3 + 2] = -0.2;

      // Cyan/green data colors
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.dataFlow = new THREE.Points(geometry, material);
    this.group.add(this.dataFlow);
  }

  private createHologramProjectors(): void {
    // Floating holographic rings
    const positions = [
      { x: -0.25, y: 0.68, z: 0.1 },
      { x: 0.25, y: 0.68, z: 0.1 },
    ];

    for (const pos of positions) {
      const ringGeo = new THREE.TorusGeometry(0.06, 0.005, 4, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.magenta,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, pos.y, pos.z);
      ring.rotation.x = Math.PI / 2;
      this.hologramRings.push(ring);
      this.addGlowMesh(ring);
      this.group.add(ring);

      // Hologram beam
      const beamGeo = new THREE.CylinderGeometry(0.005, 0.04, 0.1, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.magenta,
        transparent: true,
        opacity: 0.3,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(pos.x, pos.y + 0.05, pos.z);
      this.group.add(beam);
    }
  }

  private createQuantityHologram(): void {
    // Holographic gold quantity display above the bank (6x size - tripled)
    this.quantityHologram = new THREE.Group();
    this.quantityHologram.position.set(0, 1.5, 0); // Higher to accommodate larger bars

    // Projection cone (light beam projecting the hologram) - 3x size
    const coneGeo = new THREE.ConeGeometry(0.8, 1.2, 12, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: GOLD_GLOW,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    this.quantityProjectionCone = new THREE.Mesh(coneGeo, coneMat);
    this.quantityProjectionCone.position.y = -0.9;
    this.quantityProjectionCone.rotation.x = Math.PI;
    this.quantityHologram.add(this.quantityProjectionCone);

    // Circular platform ring - 3x size
    const ringGeo = new THREE.TorusGeometry(0.7, 0.05, 4, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: GOLD_COLOR,
      transparent: true,
      opacity: 0.7,
    });
    this.quantityRing = new THREE.Mesh(ringGeo, ringMat);
    this.quantityRing.rotation.x = Math.PI / 2;
    this.quantityRing.position.y = -0.4;
    this.addGlowMesh(this.quantityRing);
    this.quantityHologram.add(this.quantityRing);

    // Inner ring - 3x size
    const innerRingGeo = new THREE.TorusGeometry(0.4, 0.03, 4, 16);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat.clone());
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.35;
    this.quantityHologram.add(innerRing);

    // Create holographic gold bars
    this.createHoloGoldBars();

    this.group.add(this.quantityHologram);
  }

  private createHoloGoldBars(): void {
    // 3D holographic gold bars in pyramid formation (6x size - tripled from 2x)
    const barWidth = 0.48;   // 3x original (was 0.16)
    const barHeight = 0.24;  // 3x original (was 0.08)
    const barDepth = 0.30;   // 3x original (was 0.10)

    // Pyramid positions with levels for quantity display (3x positions)
    const barPositions = [
      // Bottom layer (level 1-2: 6 bars)
      { x: -0.36, y: 0, z: -0.18, level: 1 },
      { x: 0.36, y: 0, z: -0.18, level: 1 },
      { x: -0.36, y: 0, z: 0.18, level: 2 },
      { x: 0.36, y: 0, z: 0.18, level: 2 },
      { x: 0, y: 0, z: -0.18, level: 2 },
      { x: 0, y: 0, z: 0.18, level: 2 },
      // Middle layer (level 3: 4 bars)
      { x: -0.18, y: 0.3, z: 0, level: 3 },
      { x: 0.18, y: 0.3, z: 0, level: 3 },
      { x: 0, y: 0.3, z: -0.15, level: 3 },
      { x: 0, y: 0.3, z: 0.15, level: 3 },
      // Top layer (level 4: 2 bars)
      { x: -0.09, y: 0.6, z: 0, level: 4 },
      { x: 0.09, y: 0.6, z: 0, level: 4 },
    ];

    for (const pos of barPositions) {
      // Wireframe gold bar
      const barGeo = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
      const barMat = new THREE.MeshBasicMaterial({
        color: GOLD_COLOR,
        transparent: true,
        opacity: 0.8,
        wireframe: true,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(pos.x, pos.y, pos.z);
      bar.userData.level = pos.level;
      bar.visible = false;
      this.holoGoldBars.push(bar);
      this.quantityHologram.add(bar);

      // Inner glow
      const innerGeo = new THREE.BoxGeometry(barWidth * 0.7, barHeight * 0.7, barDepth * 0.7);
      const innerMat = new THREE.MeshBasicMaterial({
        color: GOLD_GLOW,
        transparent: true,
        opacity: 0.4,
      });
      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.position.set(pos.x, pos.y, pos.z);
      inner.userData.level = pos.level;
      inner.userData.isInner = true;
      inner.visible = false;
      this.holoGoldBars.push(inner);
      this.quantityHologram.add(inner);
    }
  }

  private createAmountDisplay(): void {
    // Epic holographic display panel group - positioned in front of the bank
    this.displayPanel = new THREE.Group();
    this.displayPanel.position.set(0, 0.35, 0.55);

    // 1. Projection cone (light beam projecting the hologram - pointing back to bank)
    const coneGeo = new THREE.ConeGeometry(0.35, 0.6, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: GOLD_GLOW,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    this.projectionCone = new THREE.Mesh(coneGeo, coneMat);
    this.projectionCone.position.z = -0.4; // Behind the panel
    this.projectionCone.rotation.x = Math.PI / 2; // Point towards bank (-Z)
    this.displayPanel.add(this.projectionCone);

    // 2. Holographic panel background (dark with scan line effect)
    const panelGeo = new THREE.PlaneGeometry(1.6, 0.5);
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x001a33,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    this.displayPanel.add(panel);

    // 3. Glowing frame (4 edges with corner accents)
    this.createGlowingFrame(1.6, 0.5);

    // 4. Canvas texture for the amount digits
    this.amountCanvas = document.createElement('canvas');
    this.amountCanvas.width = 1024;
    this.amountCanvas.height = 320;
    this.amountContext = this.amountCanvas.getContext('2d')!;

    const texture = new THREE.CanvasTexture(this.amountCanvas);
    texture.needsUpdate = true;

    const displayMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const displayGeo = new THREE.PlaneGeometry(1.5, 0.45);
    this.amountMesh = new THREE.Mesh(displayGeo, displayMat);
    this.amountMesh.position.z = 0.01;
    this.displayPanel.add(this.amountMesh);

    // 5. Gold coin particles orbiting the display
    this.createGoldParticles();

    // 6. Projection rings (vertical, behind the panel pointing toward bank)
    const baseRingGeo = new THREE.TorusGeometry(0.25, 0.02, 4, 24);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: GOLD_COLOR,
      transparent: true,
      opacity: 0.8,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.position.z = -0.35;
    // No rotation - vertical ring facing the bank
    this.addGlowMesh(baseRing);
    this.displayPanel.add(baseRing);

    // Inner projection ring
    const innerRingGeo = new THREE.TorusGeometry(0.15, 0.015, 4, 16);
    const innerRing = new THREE.Mesh(innerRingGeo, baseRingMat.clone());
    innerRing.position.z = -0.25;
    this.displayPanel.add(innerRing);

    this.displayPanel.visible = false; // Hidden by default
    this.group.add(this.displayPanel);
  }

  private createGlowingFrame(width: number, height: number): void {
    const hw = width / 2;
    const hh = height / 2;
    const thickness = 0.035;
    const depth = 0.02;

    const glowMat = new THREE.MeshBasicMaterial({
      color: GOLD_COLOR,
      transparent: true,
      opacity: 0.9,
    });

    // Top bar
    const topBarGeo = new THREE.BoxGeometry(width + 0.15, thickness, depth);
    const topBar = new THREE.Mesh(topBarGeo, glowMat.clone());
    topBar.position.y = hh + thickness / 2;
    this.frameGlowBars.push(topBar);
    this.displayPanel.add(topBar);

    // Bottom bar
    const bottomBar = new THREE.Mesh(topBarGeo, glowMat.clone());
    bottomBar.position.y = -hh - thickness / 2;
    this.frameGlowBars.push(bottomBar);
    this.displayPanel.add(bottomBar);

    // Left bar
    const sideBarGeo = new THREE.BoxGeometry(thickness, height + 0.1, depth);
    const leftBar = new THREE.Mesh(sideBarGeo, glowMat.clone());
    leftBar.position.x = -hw - thickness / 2;
    this.frameGlowBars.push(leftBar);
    this.displayPanel.add(leftBar);

    // Right bar
    const rightBar = new THREE.Mesh(sideBarGeo, glowMat.clone());
    rightBar.position.x = hw + thickness / 2;
    this.frameGlowBars.push(rightBar);
    this.displayPanel.add(rightBar);

    // Corner accents (diamond shapes)
    const corners = [
      { x: -hw, y: hh },
      { x: hw, y: hh },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
    ];

    const diamondMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });

    for (const corner of corners) {
      const diamondGeo = new THREE.OctahedronGeometry(0.05, 0);
      const diamond = new THREE.Mesh(diamondGeo, diamondMat.clone());
      diamond.position.set(corner.x, corner.y, 0.02);
      diamond.rotation.z = Math.PI / 4;
      diamond.scale.set(1, 1, 0.3);
      this.displayPanel.add(diamond);
    }
  }

  private createGoldParticles(): void {
    // 40 gold particles orbiting around the display
    const particleCount = 40;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.85 + Math.random() * 0.2;
      const yOffset = (Math.random() - 0.5) * 0.4;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = yOffset;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.3;

      // Gold color variations
      const goldIntensity = 0.7 + Math.random() * 0.3;
      colors[i * 3] = 1.0 * goldIntensity;
      colors[i * 3 + 1] = 0.8 * goldIntensity;
      colors[i * 3 + 2] = 0.2 * goldIntensity;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    this.goldParticles = new THREE.Points(geometry, material);
    this.displayPanel.add(this.goldParticles);
  }

  private updateAmountTexture(amount: number): void {
    const ctx = this.amountContext;
    const canvas = this.amountCanvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient (subtle dark blue)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, 'rgba(0, 26, 51, 0.3)');
    bgGradient.addColorStop(0.5, 'rgba(0, 13, 26, 0.4)');
    bgGradient.addColorStop(1, 'rgba(0, 26, 51, 0.3)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated scan lines effect
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.08)';
    ctx.lineWidth = 1;
    for (let y = this.scanLineOffset % 6; y < canvas.height; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Format amount (raw value without currency symbol)
    const formattedAmount = amount.toLocaleString();

    // Main text setup
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outer intense glow
    ctx.font = 'bold 140px "Courier New", monospace';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 60;
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(formattedAmount, canvas.width / 2, canvas.height / 2);
    ctx.fillText(formattedAmount, canvas.width / 2, canvas.height / 2);

    // Middle glow layer
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(formattedAmount, canvas.width / 2, canvas.height / 2);

    // Bright core
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffcc';
    ctx.fillText(formattedAmount, canvas.width / 2, canvas.height / 2);

    // White hot center
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formattedAmount, canvas.width / 2, canvas.height / 2);

    // Add horizontal accent lines
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(canvas.width - 50, 50);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, canvas.height - 50);
    ctx.lineTo(canvas.width - 50, canvas.height - 50);
    ctx.stroke();

    // Update texture
    if (this.amountMesh?.material instanceof THREE.MeshBasicMaterial) {
      this.amountMesh.material.map!.needsUpdate = true;
    }
  }

  private updateQuantityHologram(): void {
    // Determine max level based on quantity
    let maxLevel: number;
    switch (this.quantity) {
      case 'none':
        maxLevel = 0; // No bars visible
        break;
      case 'low':
        maxLevel = 1; // 2 bars (level 1)
        break;
      case 'medium':
        maxLevel = 2; // 6 bars (levels 1-2)
        break;
      case 'full':
        maxLevel = 4; // All bars (levels 1-4)
        break;
      default:
        maxLevel = 0;
    }

    // Update visibility of each bar based on level
    this.holoGoldBars.forEach((bar) => {
      const level = bar.userData.level as number;
      bar.visible = level <= maxLevel;
    });
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS FOR QUANTITY AND AMOUNT
  // ---------------------------------------------------------------------------

  updateQuantity(quantity: BankQuantity): void {
    this.quantity = quantity;
    this.updateQuantityHologram();
  }

  updateAmount(amount: number | null): void {
    if (amount === null || amount === undefined) {
      this.displayPanel.visible = false;
    } else {
      this.displayPanel.visible = true;
      this.updateAmountTexture(amount);
    }
  }

  protected onStatusChange(status: BuildingStatus): void {
    if (!this.body || !this.dataFlow) return;

    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    // Control data flow visibility
    this.dataFlow.visible = !isOffline;

    // Dim neon edges when offline
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
        if (isCritical) {
          edge.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          edge.material.color.setHex(COLORS.glow.orange);
        } else {
          edge.material.color.setHex(COLORS.glow.cyan);
        }
      }
    });

    // Security shield visibility
    if (this.securityShield?.material instanceof THREE.MeshBasicMaterial) {
      this.securityShield.material.opacity = isOffline ? 0 : 0.05;
      if (isCritical) {
        this.securityShield.material.color.setHex(COLORS.glow.red);
        this.securityShield.material.opacity = 0.15;
      } else if (isWarning) {
        this.securityShield.material.color.setHex(COLORS.glow.orange);
        this.securityShield.material.opacity = 0.1;
      }
    }

    // Change body emissive for warning/critical
    if (this.body.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
      );
    }

    // Dim quantity hologram when offline
    if (this.quantityProjectionCone?.material instanceof THREE.MeshBasicMaterial) {
      this.quantityProjectionCone.material.opacity = isOffline ? 0.03 : 0.1;
    }
    this.holoGoldBars.forEach((bar) => {
      if (bar.material instanceof THREE.MeshBasicMaterial) {
        const isInner = bar.userData.isInner;
        const baseOpacity = isInner ? 0.4 : 0.8;
        bar.material.opacity = isOffline ? baseOpacity * 0.3 : baseOpacity;
      }
    });

    // Dim amount display when offline
    if (this.displayPanel) {
      // Dim projection cone
      if (this.projectionCone?.material instanceof THREE.MeshBasicMaterial) {
        this.projectionCone.material.opacity = isOffline ? 0.03 : 0.12;
      }
      // Dim frame bars
      this.frameGlowBars.forEach((bar) => {
        if (bar.material instanceof THREE.MeshBasicMaterial) {
          bar.material.opacity = isOffline ? 0.3 : 0.9;
        }
      });
      // Dim gold particles
      if (this.goldParticles?.material instanceof THREE.PointsMaterial) {
        this.goldParticles.material.opacity = isOffline ? 0.3 : 0.9;
      }
      // Dim amount mesh
      if (this.amountMesh?.material instanceof THREE.MeshBasicMaterial) {
        this.amountMesh.material.opacity = isOffline ? 0.4 : 1.0;
      }
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects data flow speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    // Animate data flow
    if (this.dataFlow?.visible) {
      const speed = this.getActivitySpeed() * 0.6;
      const positions = this.dataFlow.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        y += deltaTime * speed * (i % 2 === 0 ? 1 : -1);
        if (y > 0.65) y = 0.1;
        if (y < 0.1) y = 0.65;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    // Rotate hologram rings
    if (this.status !== 'offline') {
      this.hologramRings.forEach((ring, i) => {
        ring.rotation.z += deltaTime * (i % 2 === 0 ? 2 : -2);
      });
    }

    // Pulse security shield
    if (this.securityShield?.material instanceof THREE.MeshBasicMaterial) {
      if (this.status !== 'offline') {
        const pulse = 0.03 + 0.02 * Math.sin(this.animTime * 2);
        this.securityShield.material.opacity = this.status === 'critical' ? 0.15 : this.status === 'warning' ? 0.1 : pulse;
      }
    }

    // Pulse neon edges
    if (this.status !== 'offline') {
      const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
      this.neonEdges.forEach((edge, i) => {
        if (edge.material instanceof THREE.LineBasicMaterial) {
          edge.material.opacity = pulse * (i === this.neonEdges.length - 1 ? 0.8 : 1);
        }
      });
    }

    // Animate quantity hologram (pulse effect and floating)
    if (this.quantityHologram && this.status !== 'offline') {
      // Gentle floating motion (2x amplitude for 2x size)
      this.quantityHologram.position.y = 1.2 + 0.06 * Math.sin(this.animTime * 1.5);

      // Pulse projection cone
      if (this.quantityProjectionCone?.material instanceof THREE.MeshBasicMaterial) {
        const conePulse = 0.07 + 0.05 * Math.sin(this.animTime * 2.5);
        this.quantityProjectionCone.material.opacity = conePulse;
      }

      // Pulse gold bars
      if (this.quantity !== 'none') {
        this.holoGoldBars.forEach((bar, i) => {
          if (bar.visible && bar.material instanceof THREE.MeshBasicMaterial) {
            const isInner = bar.userData.isInner;
            const baseOpacity = isInner ? 0.4 : 0.8;
            // Stagger pulse by bar index for wave effect
            const phase = this.animTime * 2.5 + i * 0.3;
            const individualPulse = 0.7 + 0.3 * Math.sin(phase);
            bar.material.opacity = baseOpacity * individualPulse;
          }
        });
      }
    }

    // Animate epic holographic amount display
    if (this.displayPanel?.visible && this.status !== 'offline') {
      // Gentle floating motion
      this.displayPanel.position.y = 0.35 + 0.02 * Math.sin(this.animTime * 1.2);

      // Rotate gold particles orbit
      if (this.goldParticles) {
        const positions = this.goldParticles.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const z = positions.getZ(i);
          const angle = Math.atan2(z, x / 0.3) + deltaTime * 0.8;
          const radius = Math.sqrt(x * x + (z / 0.3) * (z / 0.3));
          positions.setX(i, Math.cos(angle) * radius);
          positions.setZ(i, Math.sin(angle) * radius * 0.3);
        }
        positions.needsUpdate = true;
      }

      // Pulse frame glow bars
      this.frameGlowBars.forEach((bar, i) => {
        if (bar.material instanceof THREE.MeshBasicMaterial) {
          const staggeredPulse = 0.7 + 0.3 * Math.sin(this.animTime * 3 + i * 0.5);
          bar.material.opacity = staggeredPulse;
        }
      });

      // Pulse projection cone
      if (this.projectionCone?.material instanceof THREE.MeshBasicMaterial) {
        const conePulse = 0.08 + 0.06 * Math.sin(this.animTime * 2);
        this.projectionCone.material.opacity = conePulse;
      }

      // Animate scan lines (update texture periodically)
      this.scanLineOffset += deltaTime * 30;
      // Re-render texture every few frames for scan line animation
      if (Math.floor(this.animTime * 10) % 3 === 0) {
        const amountMat = this.amountMesh?.material as THREE.MeshBasicMaterial | undefined;
        if (amountMat?.map) {
          // Get current amount from texture (we need to re-render with new scan line offset)
          // This is handled by storing the amount and calling updateAmountTexture
        }
      }

      // Holographic flicker effect (subtle)
      if (this.amountMesh?.material instanceof THREE.MeshBasicMaterial) {
        const flicker = 0.85 + 0.15 * Math.sin(this.animTime * 15) * Math.sin(this.animTime * 7);
        this.amountMesh.material.opacity = flicker;
      }
    }
  }
}
