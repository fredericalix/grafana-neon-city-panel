import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

type HouseVariant = 'a' | 'b' | 'c';

/**
 * House Prefab - Cyberpunk/Tron style
 * A: Small habitation module
 * B: Medium skyscraper
 * C: Tall skyscraper
 */
export class HousePrefab extends BasePrefab {
  private variant: HouseVariant;
  private body!: THREE.Mesh;
  private windows: THREE.Mesh[] = [];
  private neonEdges: THREE.LineSegments[] = [];
  private windowPulseTime = 0;

  constructor(building: Building, variant: HouseVariant = 'a') {
    super(building);
    this.variant = variant;
  }

  protected build(): void {
    switch (this.variant) {
      case 'a':
        this.buildHabitationModule();
        break;
      case 'b':
        this.buildMediumSkyscraper();
        break;
      case 'c':
        this.buildTallSkyscraper();
        break;
    }
  }

  /**
   * House A: Compact habitation module - futuristic pod
   */
  private buildHabitationModule(): void {
    // Dark metallic base
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Main hexagonal body
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 6);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Top dome
    const domeGeo = new THREE.SphereGeometry(0.28, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, bodyMat);
    dome.position.y = 0.4;
    this.group.add(dome);

    // Neon edge ring at base
    this.addNeonRing(0, 0.02, 0.36, COLORS.glow.cyan);
    this.addNeonRing(0, 0.4, 0.29, COLORS.glow.cyan);

    // Window strip (glowing band around middle)
    const windowGeo = new THREE.TorusGeometry(0.32, 0.03, 4, 6);
    const windowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const windowRing = new THREE.Mesh(windowGeo, windowMat);
    windowRing.position.y = 0.25;
    windowRing.rotation.x = Math.PI / 2;
    this.windows.push(windowRing);
    this.addGlowMesh(windowRing);
    this.group.add(windowRing);

    // Door (glowing panel)
    const doorGeo = new THREE.PlaneGeometry(0.12, 0.2);
    const doorMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.6,
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.12, 0.35);
    this.windows.push(door);
    this.group.add(door);

    // Status light on top
    const light = this.createGlowPoint(0, 0.55, 0, COLORS.state.online, 0.04);
    this.group.add(light);
  }

  /**
   * House B: Medium cyberpunk skyscraper (8 floors)
   */
  private buildMediumSkyscraper(): void {
    const height = 1.2;
    const width = 0.5;
    const depth = 0.4;

    this.buildSkyscraper(width, height, depth, 8, COLORS.glow.cyan);
  }

  /**
   * House C: Tall cyberpunk skyscraper (15 floors)
   */
  private buildTallSkyscraper(): void {
    const height = 2.0;
    const width = 0.6;
    const depth = 0.5;

    this.buildSkyscraper(width, height, depth, 15, COLORS.glow.magenta);
  }

  /**
   * Generic skyscraper builder
   */
  private buildSkyscraper(width: number, height: number, depth: number, floors: number, accentColor: number): void {
    // Dark metallic body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Main tower
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = height / 2;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Accent panels on sides
    const panelMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.7,
      roughness: 0.4,
    });

    // Side accent strips
    const stripGeo = new THREE.BoxGeometry(0.02, height, depth * 0.8);
    const leftStrip = new THREE.Mesh(stripGeo, panelMat);
    leftStrip.position.set(-width / 2 + 0.05, height / 2, 0);
    this.group.add(leftStrip);

    const rightStrip = new THREE.Mesh(stripGeo, panelMat);
    rightStrip.position.set(width / 2 - 0.05, height / 2, 0);
    this.group.add(rightStrip);

    // Neon edge lines (Tron style)
    this.addNeonEdges(width, height, depth, accentColor);

    // Windows grid
    this.createWindowGrid(width, height, depth, floors, accentColor);

    // Rooftop structures
    this.createRooftop(width, height, depth, accentColor);

    // Status light
    const light = this.createGlowPoint(0, height + 0.15, 0, COLORS.state.online, 0.05);
    this.group.add(light);
  }

  private addNeonEdges(width: number, height: number, depth: number, color: number): void {
    const neonMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });

    // Create edge geometry for Tron-style lines
    const hw = width / 2;
    const hd = depth / 2;

    // Vertical corner edges
    const corners = [
      [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]
    ];

    for (const [x, z] of corners) {
      const points = [
        new THREE.Vector3(x, 0.01, z),
        new THREE.Vector3(x, height, z),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(geo, neonMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }

    // Horizontal edges at bottom and top
    const bottomPoints = [
      new THREE.Vector3(-hw, 0.01, -hd),
      new THREE.Vector3(hw, 0.01, -hd),
      new THREE.Vector3(hw, 0.01, -hd),
      new THREE.Vector3(hw, 0.01, hd),
      new THREE.Vector3(hw, 0.01, hd),
      new THREE.Vector3(-hw, 0.01, hd),
      new THREE.Vector3(-hw, 0.01, hd),
      new THREE.Vector3(-hw, 0.01, -hd),
    ];
    const bottomGeo = new THREE.BufferGeometry().setFromPoints(bottomPoints);
    const bottomLine = new THREE.LineSegments(bottomGeo, neonMat.clone());
    this.neonEdges.push(bottomLine);
    this.group.add(bottomLine);

    const topPoints = bottomPoints.map(p => new THREE.Vector3(p.x, height, p.z));
    const topGeo = new THREE.BufferGeometry().setFromPoints(topPoints);
    const topLine = new THREE.LineSegments(topGeo, neonMat.clone());
    this.neonEdges.push(topLine);
    this.group.add(topLine);
  }

  private createWindowGrid(width: number, height: number, depth: number, floors: number, color: number): void {
    const windowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });

    const floorHeight = height / floors;
    const windowsPerFloor = 3;
    const windowWidth = width / (windowsPerFloor + 1) * 0.6;
    const windowHeight = floorHeight * 0.5;

    // Front and back windows
    for (let floor = 0; floor < floors; floor++) {
      const y = floor * floorHeight + floorHeight * 0.6;

      for (let w = 0; w < windowsPerFloor; w++) {
        const x = (w - (windowsPerFloor - 1) / 2) * (width / (windowsPerFloor + 0.5));

        // Randomly light some windows (cyberpunk effect)
        const isLit = Math.random() > 0.3;
        if (!isLit) continue;

        // Front window
        const frontGeo = new THREE.PlaneGeometry(windowWidth, windowHeight);
        const frontWin = new THREE.Mesh(frontGeo, windowMat.clone());
        frontWin.position.set(x, y, depth / 2 + 0.01);
        this.windows.push(frontWin);
        this.group.add(frontWin);

        // Back window
        const backWin = new THREE.Mesh(frontGeo.clone(), windowMat.clone());
        backWin.position.set(x, y, -depth / 2 - 0.01);
        backWin.rotation.y = Math.PI;
        this.windows.push(backWin);
        this.group.add(backWin);
      }
    }

    // Side windows (fewer)
    for (let floor = 0; floor < floors; floor++) {
      const y = floor * floorHeight + floorHeight * 0.6;

      if (Math.random() > 0.5) {
        const sideGeo = new THREE.PlaneGeometry(depth * 0.3, windowHeight);

        // Left side
        const leftWin = new THREE.Mesh(sideGeo, windowMat.clone());
        leftWin.position.set(-width / 2 - 0.01, y, 0);
        leftWin.rotation.y = -Math.PI / 2;
        this.windows.push(leftWin);
        this.group.add(leftWin);

        // Right side
        const rightWin = new THREE.Mesh(sideGeo.clone(), windowMat.clone());
        rightWin.position.set(width / 2 + 0.01, y, 0);
        rightWin.rotation.y = Math.PI / 2;
        this.windows.push(rightWin);
        this.group.add(rightWin);
      }
    }
  }

  private createRooftop(width: number, height: number, depth: number, color: number): void {
    // Antenna/spire
    const antennaMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });

    const antennaGeo = new THREE.CylinderGeometry(0.01, 0.02, 0.2, 8);
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = height + 0.1;
    this.group.add(antenna);

    // Glowing antenna tip
    const tipGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = height + 0.22;
    this.windows.push(tip);
    this.addGlowMesh(tip);
    this.group.add(tip);

    // Rooftop box (AC unit style)
    const boxMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.8,
      roughness: 0.3,
    });
    const boxGeo = new THREE.BoxGeometry(width * 0.3, 0.08, depth * 0.3);
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(width * 0.2, height + 0.04, -depth * 0.2);
    this.group.add(box);
  }

  private addNeonRing(x: number, y: number, radius: number, color: number): void {
    const neonMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });

    const points: THREE.Vector3[] = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        x + Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      ));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const ring = new THREE.Line(geo, neonMat);
    this.neonEdges.push(ring as unknown as THREE.LineSegments);
    this.group.add(ring);
  }

  protected onStatusChange(status: BuildingStatus): void {
    if (!this.body) return;

    const isOffline = status === 'offline';

    // Dim windows when offline
    this.windows.forEach((w) => {
      if (w.material instanceof THREE.MeshBasicMaterial) {
        w.material.opacity = isOffline ? 0.1 : 0.7;
      }
    });

    // Dim neon edges when offline
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
      }
    });

    // Change body color based on status
    if (this.body.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        status === 'critical' ? 0x330000 : status === 'warning' ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity could affect window animation speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    // Animate windows with subtle flicker (cyberpunk effect)
    if (this.status !== 'offline') {
      this.windowPulseTime += deltaTime;

      this.windows.forEach((w, i) => {
        if (w.material instanceof THREE.MeshBasicMaterial) {
          // Each window has slightly different phase
          const phase = this.windowPulseTime * 2 + i * 0.5;
          const flicker = 0.6 + 0.3 * Math.sin(phase) + 0.1 * Math.sin(phase * 3.7);
          w.material.opacity = Math.min(0.9, flicker);
        }
      });
    }
  }
}
