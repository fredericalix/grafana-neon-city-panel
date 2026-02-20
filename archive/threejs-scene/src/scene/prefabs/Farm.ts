import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

type FarmVariant = 'building_a' | 'building_b' | 'silo' | 'field_a' | 'field_b' | 'cattle';

/**
 * Farm Prefab - Cyberpunk/Tron Style Futuristic Agriculture
 * Building A: Main hydroponic greenhouse
 * Building B: Processing facility
 * Silo: Energy storage tower
 * Field A: Holographic crop field
 * Field B: Neon plant pods
 * Cattle: Synthetic livestock pen
 */
export class FarmPrefab extends BasePrefab {
  private variant: FarmVariant;
  private body!: THREE.Mesh;
  private neonEdges: THREE.LineSegments[] = [];
  private glowElements: THREE.Mesh[] = [];
  private animatedParts: THREE.Object3D[] = [];
  private dataParticles!: THREE.Points;
  private animTime = 0;

  constructor(building: Building, variant: FarmVariant = 'building_a') {
    super(building);
    this.variant = variant;
  }

  protected build(): void {
    switch (this.variant) {
      case 'building_a':
        this.buildHydroponicGreenhouse();
        break;
      case 'building_b':
        this.buildProcessingFacility();
        break;
      case 'silo':
        this.buildEnergySilo();
        break;
      case 'field_a':
        this.buildHolographicField();
        break;
      case 'field_b':
        this.buildNeonPodField();
        break;
      case 'cattle':
        this.buildSyntheticPen();
        break;
    }

    // Status light
    const light = this.createGlowPoint(0, 0.05, 0.3, COLORS.state.online, 0.03);
    this.group.add(light);
  }

  private buildHydroponicGreenhouse(): void {
    // Dark metallic frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Main structure frame
    const width = 0.7;
    const height = 0.45;
    const depth = 0.5;

    // Base platform
    const baseGeo = new THREE.BoxGeometry(width + 0.05, 0.05, depth + 0.05);
    const base = new THREE.Mesh(baseGeo, frameMat);
    base.position.y = 0.025;
    this.group.add(base);

    // Transparent dome/greenhouse panels
    const glassMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });

    // Main greenhouse body (rounded top)
    const bodyGeo = new THREE.BoxGeometry(width, height * 0.7, depth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.7,
      roughness: 0.4,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = height * 0.35 + 0.05;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Glass dome top
    const domeGeo = new THREE.CylinderGeometry(depth / 2 - 0.02, depth / 2, height * 0.3, 8, 1, false);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.position.y = height * 0.85;
    dome.rotation.x = Math.PI / 2;
    dome.rotation.y = Math.PI / 8;
    dome.scale.set(width / depth, 1, 1);
    this.glowElements.push(dome);
    this.group.add(dome);

    // Neon frame edges
    this.addGreenhouseNeonEdges(width, height, depth);

    // Interior grow lights (horizontal neon strips)
    for (let i = 0; i < 3; i++) {
      const lightGeo = new THREE.BoxGeometry(width * 0.8, 0.02, 0.02);
      const lightMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.magenta,
        transparent: true,
        opacity: 0.8,
      });
      const growLight = new THREE.Mesh(lightGeo, lightMat);
      growLight.position.set(0, height * 0.5, (i - 1) * depth * 0.3);
      this.glowElements.push(growLight);
      this.addGlowMesh(growLight);
      this.group.add(growLight);
    }

    // Hydroponic plant rows
    this.createHydroponicRows(width, depth);

    // Data particles (nutrient flow)
    this.createDataParticles(0.4, 0.3, COLORS.glow.green);
  }

  private addGreenhouseNeonEdges(width: number, height: number, depth: number): void {
    const neonMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });

    const hw = width / 2;
    const hd = depth / 2;
    const baseY = 0.05;

    // Vertical corner edges
    const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
    for (const [x, z] of corners) {
      const points = [
        new THREE.Vector3(x, baseY, z),
        new THREE.Vector3(x, height, z),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(geo, neonMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }

    // Bottom rectangle
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
  }

  private createHydroponicRows(width: number, depth: number): void {
    const plantMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.6,
    });

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const x = (col - 2) * (width / 6);
        const z = (row - 1) * (depth / 4);

        // Plant pod
        const podGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.08, 6);
        const pod = new THREE.Mesh(podGeo, plantMat);
        pod.position.set(x, 0.12, z);
        this.animatedParts.push(pod);
        this.group.add(pod);
      }
    }
  }

  private buildProcessingFacility(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.25,
    });

    // Main structure
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.35, 0.4);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Roof with antenna array
    const roofMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });
    const roofGeo = new THREE.BoxGeometry(0.5, 0.04, 0.45);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.395;
    this.group.add(roof);

    // Neon edges
    this.addBoxNeonEdges(0.45, 0.35, 0.4, 0.025, COLORS.glow.cyan);

    // Processing window
    const windowGeo = new THREE.PlaneGeometry(0.25, 0.15);
    const windowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.orange,
      transparent: true,
      opacity: 0.6,
    });
    const window = new THREE.Mesh(windowGeo, windowMat);
    window.position.set(0, 0.22, 0.21);
    this.glowElements.push(window);
    this.addGlowMesh(window);
    this.group.add(window);

    // Exhaust vents
    for (let i = 0; i < 2; i++) {
      const ventGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 6);
      const vent = new THREE.Mesh(ventGeo, roofMat);
      vent.position.set((i - 0.5) * 0.2, 0.43, -0.1);
      this.group.add(vent);

      const ringGeo = new THREE.TorusGeometry(0.045, 0.008, 4, 12);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.orange,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set((i - 0.5) * 0.2, 0.47, -0.1);
      ring.rotation.x = Math.PI / 2;
      this.glowElements.push(ring);
      this.addGlowMesh(ring);
      this.group.add(ring);
    }

    this.createDataParticles(0.3, 0.25, COLORS.glow.orange);
  }

  private buildEnergySilo(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.15,
    });

    // Cylindrical energy storage
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.8, 12);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.4;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Energy rings (animated)
    for (let i = 0; i < 5; i++) {
      const y = 0.12 + i * 0.16;
      const ringGeo = new THREE.TorusGeometry(0.2, 0.015, 4, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      this.animatedParts.push(ring);
      this.glowElements.push(ring);
      this.addGlowMesh(ring);
      this.group.add(ring);
    }

    // Dome top - use separate material to avoid construction animation issues
    const domeGeo = new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.15,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.8;
    this.group.add(dome);

    // Top energy beacon
    const beaconGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 0.92;
    this.glowElements.push(beacon);
    this.addGlowMesh(beacon);
    this.group.add(beacon);

    // Energy level indicator (vertical strip)
    const indicatorGeo = new THREE.PlaneGeometry(0.03, 0.6);
    const indicatorMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.7,
    });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(0.21, 0.4, 0);
    this.glowElements.push(indicator);
    this.addGlowMesh(indicator);
    this.group.add(indicator);
  }

  private buildHolographicField(): void {
    // Ground platform
    const groundMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.5,
      roughness: 0.7,
    });
    const groundGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    this.group.add(ground);

    // Grid lines on ground
    const gridMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.4,
    });

    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * 0.2;
      // Horizontal
      const hPoints = [
        new THREE.Vector3(-0.4, 0.015, offset),
        new THREE.Vector3(0.4, 0.015, offset),
      ];
      const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
      const hLine = new THREE.Line(hGeo, gridMat);
      this.group.add(hLine);

      // Vertical
      const vPoints = [
        new THREE.Vector3(offset, 0.015, -0.4),
        new THREE.Vector3(offset, 0.015, 0.4),
      ];
      const vGeo = new THREE.BufferGeometry().setFromPoints(vPoints);
      const vLine = new THREE.Line(vGeo, gridMat);
      this.group.add(vLine);
    }

    // Holographic crop stalks
    const stalkMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });

    for (let i = 0; i < 25; i++) {
      const x = (Math.random() - 0.5) * 0.7;
      const z = (Math.random() - 0.5) * 0.7;
      const height = 0.1 + Math.random() * 0.1;

      const stalkGeo = new THREE.ConeGeometry(0.02, height, 4);
      const stalk = new THREE.Mesh(stalkGeo, stalkMat.clone());
      stalk.position.set(x, height / 2, z);
      this.animatedParts.push(stalk);
      this.group.add(stalk);
    }

    // Invisible body for raycasting
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.01, 0.8);
    this.body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.body.position.y = 0.1;
    this.group.add(this.body);
  }

  private buildNeonPodField(): void {
    // Ground with neon border
    const groundMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.6,
      roughness: 0.5,
    });
    const groundGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    this.group.add(ground);

    // Neon border
    const borderPoints = [
      new THREE.Vector3(-0.4, 0.02, -0.4),
      new THREE.Vector3(0.4, 0.02, -0.4),
      new THREE.Vector3(0.4, 0.02, -0.4),
      new THREE.Vector3(0.4, 0.02, 0.4),
      new THREE.Vector3(0.4, 0.02, 0.4),
      new THREE.Vector3(-0.4, 0.02, 0.4),
      new THREE.Vector3(-0.4, 0.02, 0.4),
      new THREE.Vector3(-0.4, 0.02, -0.4),
    ];
    const borderMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.8,
    });
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const border = new THREE.LineSegments(borderGeo, borderMat);
    this.neonEdges.push(border);
    this.group.add(border);

    // Neon plant pods in grid
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = (col - 1.5) * 0.18;
        const z = (row - 1.5) * 0.18;

        // Pod base
        const podGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.06, 6);
        const podMat = new THREE.MeshStandardMaterial({
          color: COLORS.building.secondary,
          metalness: 0.8,
          roughness: 0.3,
        });
        const pod = new THREE.Mesh(podGeo, podMat);
        pod.position.set(x, 0.04, z);
        this.group.add(pod);

        // Glowing plant
        const plantGeo = new THREE.SphereGeometry(0.03, 6, 6);
        const plantMat = new THREE.MeshBasicMaterial({
          color: (row + col) % 2 === 0 ? COLORS.glow.green : COLORS.glow.cyan,
          transparent: true,
          opacity: 0.7,
        });
        const plant = new THREE.Mesh(plantGeo, plantMat);
        plant.position.set(x, 0.1, z);
        this.animatedParts.push(plant);
        this.glowElements.push(plant);
        this.addGlowMesh(plant);
        this.group.add(plant);
      }
    }

    // Invisible body for raycasting
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.01, 0.8);
    this.body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.body.position.y = 0.1;
    this.group.add(this.body);
  }

  private buildSyntheticPen(): void {
    // Dark platform
    const groundMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.5,
      roughness: 0.6,
    });
    const groundGeo = new THREE.PlaneGeometry(0.75, 0.75);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    this.group.add(ground);

    // Energy fence posts
    const postMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });

    const postPositions = [
      [-0.35, -0.35], [-0.35, 0], [-0.35, 0.35],
      [0.35, -0.35], [0.35, 0], [0.35, 0.35],
      [0, -0.35], [0, 0.35],
    ];

    for (const [x, z] of postPositions) {
      const postGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.25, 6);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0.125, z);
      this.group.add(post);

      // Post top glow
      const topGeo = new THREE.SphereGeometry(0.02, 6, 6);
      const topMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.8,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.set(x, 0.26, z);
      this.glowElements.push(top);
      this.addGlowMesh(top);
      this.group.add(top);
    }

    // Energy fence beams
    const beamMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.6,
    });

    // Front and back beams
    for (const z of [-0.35, 0.35]) {
      for (const y of [0.1, 0.2]) {
        const points = [
          new THREE.Vector3(-0.35, y, z),
          new THREE.Vector3(0.35, y, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, beamMat);
        this.neonEdges.push(line as unknown as THREE.LineSegments);
        this.group.add(line);
      }
    }

    // Synthetic livestock (geometric shapes)
    const cowPositions = [[-0.1, 0], [0.1, 0.1], [0, -0.1]];
    for (const [x, z] of cowPositions) {
      // Body - geometric futuristic cow
      const bodyGeo = new THREE.BoxGeometry(0.12, 0.06, 0.08);
      const bodyMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      });
      const cowBody = new THREE.Mesh(bodyGeo, bodyMat);
      cowBody.position.set(x, 0.06, z);
      this.animatedParts.push(cowBody);
      this.group.add(cowBody);

      // Head
      const headGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const head = new THREE.Mesh(headGeo, bodyMat.clone());
      head.position.set(x + 0.08, 0.07, z);
      this.group.add(head);

      // Core glow
      const coreGeo = new THREE.SphereGeometry(0.02, 6, 6);
      const coreMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.green,
        transparent: true,
        opacity: 0.8,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(x, 0.06, z);
      this.glowElements.push(core);
      this.addGlowMesh(core);
      this.group.add(core);
    }

    // Invisible body for raycasting
    const bodyGeo = new THREE.BoxGeometry(0.75, 0.01, 0.75);
    this.body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.body.position.y = 0.1;
    this.group.add(this.body);
  }

  private addBoxNeonEdges(width: number, height: number, depth: number, baseY: number, color: number): void {
    const neonMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });

    const hw = width / 2;
    const hd = depth / 2;

    // Bottom
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

    // Top
    const topY = baseY + height;
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
  }

  private createDataParticles(width: number, height: number, color: number): void {
    const particleCount = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * width;
      positions[i * 3 + 1] = Math.random() * height + 0.1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * width;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.02,
      color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.dataParticles = new THREE.Points(geometry, material);
    this.group.add(this.dataParticles);
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';

    // Dim neon edges
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
      }
    });

    // Dim glow elements
    this.glowElements.forEach((elem) => {
      if (elem.material instanceof THREE.MeshBasicMaterial) {
        elem.material.opacity = isOffline ? 0.1 : elem.material.opacity > 0.5 ? 0.7 : 0.4;
      }
    });

    // Hide particles when offline
    if (this.dataParticles) {
      this.dataParticles.visible = !isOffline;
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects animation speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    if (this.status === 'offline') return;

    const speed = this.getActivitySpeed();

    // Animate based on variant
    if (this.variant === 'silo') {
      // Rotate energy rings
      this.animatedParts.forEach((part, i) => {
        part.rotation.z += deltaTime * speed * (i % 2 === 0 ? 1 : -1);
      });
    } else if (this.variant === 'field_a') {
      // Holographic crop sway
      this.animatedParts.forEach((part, i) => {
        const phase = this.animTime * speed + i * 0.5;
        part.rotation.x = Math.sin(phase) * 0.1;
        part.rotation.z = Math.cos(phase * 0.7) * 0.08;
        // Holographic flicker
        if (part instanceof THREE.Mesh && part.material instanceof THREE.MeshBasicMaterial) {
          part.material.opacity = 0.4 + 0.2 * Math.sin(phase * 2);
        }
      });
    } else if (this.variant === 'field_b') {
      // Neon pod pulse
      this.animatedParts.forEach((part, i) => {
        const phase = this.animTime * speed * 2 + i * 0.3;
        const scale = 1 + 0.1 * Math.sin(phase);
        part.scale.setScalar(scale);
      });
    } else if (this.variant === 'cattle') {
      // Synthetic livestock movement
      this.animatedParts.forEach((part, i) => {
        part.position.x += Math.sin(this.animTime * speed * 0.5 + i) * deltaTime * 0.02;
      });
    } else {
      // Hydroponic plant growth pulse
      this.animatedParts.forEach((part, i) => {
        const phase = this.animTime * speed + i * 0.2;
        const scale = 1 + 0.15 * Math.sin(phase);
        part.scale.y = scale;
      });
    }

    // Animate data particles
    if (this.dataParticles?.visible) {
      const positions = this.dataParticles.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        y += deltaTime * speed * 0.3;
        if (y > 0.5) {
          y = 0.1;
        }
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    // Pulse neon edges
    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = pulse;
      }
    });
  }
}
