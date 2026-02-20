import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * Bakery Prefab - Cyberpunk/Tron Style Futuristic Bakery
 * Features: Neon display window, energy smoke, holographic signage
 */
export class BakeryPrefab extends BasePrefab {
  private body!: THREE.Mesh;
  private smoke!: THREE.Points;
  private displayWindow!: THREE.Mesh;
  private neonEdges: THREE.LineSegments[] = [];
  private hologramRing!: THREE.Mesh;
  private smokeTime = 0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Dark metallic body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.8,
      roughness: 0.3,
    });

    // Main body - modern angular design
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.45, 0.5);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.225;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Accent panel on front
    const panelMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.secondary,
      metalness: 0.7,
      roughness: 0.4,
    });
    const panelGeo = new THREE.BoxGeometry(0.58, 0.15, 0.02);
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 0.38, 0.26);
    this.group.add(panel);

    // Roof - angular futuristic
    const roofGeo = new THREE.BoxGeometry(0.65, 0.06, 0.55);
    const roofMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.2,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.48;
    this.group.add(roof);

    // Neon edge lines (Tron style)
    this.addNeonEdges();

    // Holographic display window
    this.createDisplayWindow();

    // Futuristic door with neon frame
    this.createDoor();

    // Energy chimney with plasma smoke
    this.createEnergyChimney();

    // Holographic bread display
    this.createHologramDisplay();

    // Status light on roof
    const light = this.createGlowPoint(0.25, 0.52, 0, COLORS.state.online, 0.04);
    this.group.add(light);
  }

  private addNeonEdges(): void {
    const neonMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.orange,
      transparent: true,
      opacity: 0.9,
    });

    const width = 0.6;
    const height = 0.45;
    const depth = 0.5;
    const hw = width / 2;
    const hh = height;
    const hd = depth / 2;

    // Bottom edge rectangle
    const bottomPoints = [
      new THREE.Vector3(-hw, 0.01, hd),
      new THREE.Vector3(hw, 0.01, hd),
      new THREE.Vector3(hw, 0.01, hd),
      new THREE.Vector3(hw, 0.01, -hd),
      new THREE.Vector3(hw, 0.01, -hd),
      new THREE.Vector3(-hw, 0.01, -hd),
      new THREE.Vector3(-hw, 0.01, -hd),
      new THREE.Vector3(-hw, 0.01, hd),
    ];
    const bottomGeo = new THREE.BufferGeometry().setFromPoints(bottomPoints);
    const bottomLine = new THREE.LineSegments(bottomGeo, neonMat.clone());
    this.neonEdges.push(bottomLine);
    this.group.add(bottomLine);

    // Top edge (at roof level)
    const topPoints = bottomPoints.map(p => new THREE.Vector3(p.x, hh, p.z));
    const topGeo = new THREE.BufferGeometry().setFromPoints(topPoints);
    const topLine = new THREE.LineSegments(topGeo, neonMat.clone());
    this.neonEdges.push(topLine);
    this.group.add(topLine);

    // Vertical corners
    const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
    for (const [x, z] of corners) {
      const points = [
        new THREE.Vector3(x, 0.01, z),
        new THREE.Vector3(x, hh, z),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(geo, neonMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createDisplayWindow(): void {
    // Large holographic display window
    const windowGeo = new THREE.PlaneGeometry(0.35, 0.18);
    const windowMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.orange,
      transparent: true,
      opacity: 0.7,
    });
    this.displayWindow = new THREE.Mesh(windowGeo, windowMat);
    this.displayWindow.position.set(0.08, 0.28, 0.26);
    this.addGlowMesh(this.displayWindow);
    this.group.add(this.displayWindow);

    // Window frame (neon)
    const framePoints = [
      new THREE.Vector3(-0.18, -0.09, 0),
      new THREE.Vector3(0.18, -0.09, 0),
      new THREE.Vector3(0.18, -0.09, 0),
      new THREE.Vector3(0.18, 0.09, 0),
      new THREE.Vector3(0.18, 0.09, 0),
      new THREE.Vector3(-0.18, 0.09, 0),
      new THREE.Vector3(-0.18, 0.09, 0),
      new THREE.Vector3(-0.18, -0.09, 0),
    ];
    const frameMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const frameGeo = new THREE.BufferGeometry().setFromPoints(framePoints);
    const frame = new THREE.LineSegments(frameGeo, frameMat);
    frame.position.set(0.08, 0.28, 0.265);
    this.group.add(frame);
  }

  private createDoor(): void {
    // Door panel
    const doorGeo = new THREE.PlaneGeometry(0.12, 0.22);
    const doorMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(-0.18, 0.12, 0.26);
    this.group.add(door);

    // Neon door frame
    const frameMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.6,
    });
    const frameGeo = new THREE.PlaneGeometry(0.14, 0.24);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(-0.18, 0.12, 0.258);
    this.addGlowMesh(frame);
    this.group.add(frame);
  }

  private createEnergyChimney(): void {
    // Futuristic exhaust vent
    const chimneyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });

    const chimneyGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8);
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.2, 0.58, -0.15);
    this.group.add(chimney);

    // Neon ring at top
    const ringGeo = new THREE.TorusGeometry(0.065, 0.01, 4, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.orange,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0.2, 0.68, -0.15);
    ring.rotation.x = Math.PI / 2;
    this.addGlowMesh(ring);
    this.group.add(ring);

    // Energy/plasma smoke particles
    const particleCount = 25;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0.2 + (Math.random() - 0.5) * 0.08;
      positions[i * 3 + 1] = 0.7 + Math.random() * 0.3;
      positions[i * 3 + 2] = -0.15 + (Math.random() - 0.5) * 0.08;

      // Orange/yellow energy colors
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.5;
      colors[i * 3 + 2] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.smoke = new THREE.Points(geometry, material);
    this.group.add(this.smoke);
  }

  private createHologramDisplay(): void {
    // Floating holographic bread/pastry display
    const ringGeo = new THREE.TorusGeometry(0.08, 0.005, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.6,
    });
    this.hologramRing = new THREE.Mesh(ringGeo, ringMat);
    this.hologramRing.position.set(0.18, 0.06, 0.35);
    this.hologramRing.rotation.x = Math.PI / 2;
    this.addGlowMesh(this.hologramRing);
    this.group.add(this.hologramRing);

    // Holographic bread shape (wireframe)
    const breadGeo = new THREE.IcosahedronGeometry(0.04, 0);
    const breadMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.orange,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });
    const bread = new THREE.Mesh(breadGeo, breadMat);
    bread.position.set(0.18, 0.08, 0.35);
    this.group.add(bread);
  }

  protected onStatusChange(status: BuildingStatus): void {
    if (!this.body || !this.smoke) return;

    const isOffline = status === 'offline';

    // Dim neon edges when offline
    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
      }
    });

    // Control smoke visibility
    this.smoke.visible = !isOffline && status !== 'critical';

    // Dim display window
    if (this.displayWindow?.material instanceof THREE.MeshBasicMaterial) {
      this.displayWindow.material.opacity = isOffline ? 0.1 : 0.7;
    }

    // Change body emissive for warning/critical
    if (this.body.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        status === 'critical' ? 0x330000 : status === 'warning' ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects smoke density/speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.smokeTime += deltaTime;

    // Animate energy smoke
    if (this.smoke?.visible) {
      const speed = this.getActivitySpeed() * 0.4;
      const positions = this.smoke.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        y += deltaTime * speed;
        if (y > 1.1) {
          y = 0.7;
          positions.setX(i, 0.2 + (Math.random() - 0.5) * 0.08);
          positions.setZ(i, -0.15 + (Math.random() - 0.5) * 0.08);
        }
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    // Animate hologram ring rotation
    if (this.hologramRing && this.status !== 'offline') {
      this.hologramRing.rotation.z += deltaTime * 2;
    }

    // Pulse neon edges
    if (this.status !== 'offline') {
      const pulse = 0.7 + 0.3 * Math.sin(this.smokeTime * 3);
      this.neonEdges.forEach((edge) => {
        if (edge.material instanceof THREE.LineBasicMaterial) {
          edge.material.opacity = pulse;
        }
      });
    }
  }
}
