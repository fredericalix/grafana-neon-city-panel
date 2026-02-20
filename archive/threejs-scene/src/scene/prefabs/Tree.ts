import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * Tree Prefab - Cyberpunk/Tron Style Holographic Tree
 * Features: Wireframe holographic canopy, neon trunk, data particles, pulsing glow
 */
export class TreePrefab extends BasePrefab {
  private trunk!: THREE.Mesh;
  private canopyLayers: THREE.Mesh[] = [];
  private neonRings: THREE.Mesh[] = [];
  private dataParticles!: THREE.Points;
  private projectorBase!: THREE.Mesh;
  private animTime = 0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Holographic projector base
    this.createProjectorBase();

    // Neon trunk beam
    this.createTrunk();

    // Holographic canopy layers
    this.createHolographicCanopy();

    // Floating data particles
    this.createDataParticles();

    // Status light at base
    const light = this.createGlowPoint(0.15, 0.02, 0, COLORS.state.online, 0.025);
    this.group.add(light);
  }

  private createProjectorBase(): void {
    // Dark metallic base platform
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Hexagonal base
    const baseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.04, 6);
    this.projectorBase = new THREE.Mesh(baseGeo, baseMat);
    this.projectorBase.position.y = 0.02;
    this.group.add(this.projectorBase);

    // Neon ring around base
    const ringGeo = new THREE.TorusGeometry(0.13, 0.01, 4, 12);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.04;
    ring.rotation.x = Math.PI / 2;
    this.neonRings.push(ring);
    this.addGlowMesh(ring);
    this.group.add(ring);

    // Inner projector glow
    const innerGeo = new THREE.CircleGeometry(0.08, 12);
    const innerMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.5,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 0.045;
    inner.rotation.x = -Math.PI / 2;
    this.addGlowMesh(inner);
    this.group.add(inner);
  }

  private createTrunk(): void {
    // Holographic trunk - wireframe cylinder with glow
    const trunkGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.35, 8, 4);
    const trunkMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });
    this.trunk = new THREE.Mesh(trunkGeo, trunkMat);
    this.trunk.position.y = 0.22;
    this.group.add(this.trunk);

    // Solid inner glow core
    const coreGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.35, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.4,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.22;
    this.addGlowMesh(core);
    this.group.add(core);

    // Neon rings along trunk
    for (let i = 0; i < 3; i++) {
      const y = 0.1 + i * 0.12;
      const ringGeo = new THREE.TorusGeometry(0.035 - i * 0.005, 0.005, 4, 12);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? COLORS.glow.cyan : COLORS.glow.magenta,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      this.neonRings.push(ring);
      this.addGlowMesh(ring);
      this.group.add(ring);
    }
  }

  private createHolographicCanopy(): void {
    // Multiple wireframe cone layers for holographic foliage
    const layers = [
      { y: 0.32, radius: 0.22, height: 0.25 },
      { y: 0.45, radius: 0.17, height: 0.22 },
      { y: 0.55, radius: 0.11, height: 0.18 },
    ];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];

      // Outer wireframe
      const outerGeo = new THREE.ConeGeometry(layer.radius, layer.height, 8, 2);
      const outerMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.green,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      });
      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.position.y = layer.y;
      this.canopyLayers.push(outer);
      this.group.add(outer);

      // Inner glow volume
      const innerGeo = new THREE.ConeGeometry(layer.radius * 0.7, layer.height * 0.8, 6, 1);
      const innerMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.green,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.position.y = layer.y;
      this.canopyLayers.push(inner);
      this.addGlowMesh(inner);
      this.group.add(inner);

      // Edge ring at base of each layer
      const edgeGeo = new THREE.TorusGeometry(layer.radius, 0.008, 4, 12);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: COLORS.glow.cyan,
        transparent: true,
        opacity: 0.7,
      });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.y = layer.y - layer.height / 2;
      edge.rotation.x = Math.PI / 2;
      this.neonRings.push(edge);
      this.addGlowMesh(edge);
      this.group.add(edge);
    }

    // Top beacon
    const beaconGeo = new THREE.OctahedronGeometry(0.03, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 0.68;
    this.canopyLayers.push(beacon);
    this.addGlowMesh(beacon);
    this.group.add(beacon);
  }

  private createDataParticles(): void {
    // Floating particles around the tree
    const particleCount = 40;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Distribute particles in a cone shape around tree
      const angle = Math.random() * Math.PI * 2;
      const height = Math.random() * 0.5 + 0.15;
      const radius = (0.6 - height) * 0.5 + 0.05;

      positions[i * 3] = Math.cos(angle) * radius * (0.5 + Math.random() * 0.5);
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius * (0.5 + Math.random() * 0.5);

      // Green/cyan particle colors
      const isGreen = Math.random() > 0.3;
      colors[i * 3] = isGreen ? 0 : 0;
      colors[i * 3 + 1] = isGreen ? 1 : 0.8;
      colors[i * 3 + 2] = isGreen ? 0.5 : 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.015,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.dataParticles = new THREE.Points(geometry, material);
    this.group.add(this.dataParticles);
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';

    // Dim/hide canopy layers
    this.canopyLayers.forEach((layer) => {
      if (layer.material instanceof THREE.MeshBasicMaterial) {
        layer.material.opacity = isOffline ? 0.05 : (layer.material.wireframe ? 0.5 : 0.15);
      }
    });

    // Dim neon rings
    this.neonRings.forEach((ring) => {
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.opacity = isOffline ? 0.1 : 0.7;
      }
    });

    // Dim trunk
    if (this.trunk?.material instanceof THREE.MeshBasicMaterial) {
      this.trunk.material.opacity = isOffline ? 0.1 : 0.6;
    }

    // Hide particles when offline
    if (this.dataParticles) {
      this.dataParticles.visible = !isOffline;
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Trees have subtle activity response
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    if (this.status === 'offline') return;

    this.animTime += deltaTime;

    // Gentle canopy sway and pulse
    this.canopyLayers.forEach((layer, i) => {
      const phase = this.animTime * 0.8 + i * 0.5;

      // Slight rotation sway
      layer.rotation.y = Math.sin(phase * 0.5) * 0.05;
      layer.rotation.x = Math.cos(phase * 0.3) * 0.02;

      // Opacity pulse for holographic effect
      if (layer.material instanceof THREE.MeshBasicMaterial) {
        const baseOpacity = layer.material.wireframe ? 0.5 : 0.15;
        layer.material.opacity = baseOpacity + 0.1 * Math.sin(phase * 2);
      }
    });

    // Rotate neon rings
    this.neonRings.forEach((ring, i) => {
      ring.rotation.z += deltaTime * (i % 2 === 0 ? 0.5 : -0.3);
    });

    // Animate floating particles
    if (this.dataParticles?.visible) {
      const positions = this.dataParticles.geometry.getAttribute('position');

      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        const x = positions.getX(i);
        const z = positions.getZ(i);

        // Upward spiral motion
        y += deltaTime * 0.1;
        const angle = Math.atan2(z, x) + deltaTime * 0.5;
        const radius = Math.sqrt(x * x + z * z);

        if (y > 0.7) {
          y = 0.15;
        }

        positions.setX(i, Math.cos(angle) * radius);
        positions.setY(i, y);
        positions.setZ(i, Math.sin(angle) * radius);
      }
      positions.needsUpdate = true;
    }

    // Trunk core pulse
    if (this.trunk?.material instanceof THREE.MeshBasicMaterial) {
      const pulse = 0.5 + 0.2 * Math.sin(this.animTime * 3);
      this.trunk.material.opacity = pulse;
    }
  }
}
