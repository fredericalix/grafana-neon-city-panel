/**
 * DataPacket - Glowing data packet vehicle
 *
 * A rotating geometric shape representing data moving through
 * the network. Features inner glow, wireframe shell, and particle aura.
 */

import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { VEHICLE_DIMENSIONS, getRandomPacketColor } from './TrafficConfig';

export class DataPacket extends VehicleBase {
  private coreMesh!: THREE.Mesh;
  private shellMesh!: THREE.LineSegments;
  private innerGlow!: THREE.Mesh;
  private particles!: THREE.Points;

  private rotationSpeed: THREE.Vector3;
  private packetColor: number;
  private pulsePhase: number;

  constructor(color?: number) {
    const packetColor = color ?? getRandomPacketColor();
    super('dataPacket', packetColor);

    this.packetColor = packetColor;
    this.rotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  createGeometry(): void {
    const size = VEHICLE_DIMENSIONS.dataPacket.size;

    // === Inner Glow Core ===
    const innerGeometry = new THREE.IcosahedronGeometry(size * 0.5, 0);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: this.packetColor,
      transparent: true,
      opacity: 0.6,
    });
    this.innerGlow = new THREE.Mesh(innerGeometry, innerMaterial);
    this.group.add(this.innerGlow);

    // === Main Core (Icosahedron) ===
    const coreGeometry = new THREE.IcosahedronGeometry(size * 0.7, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: this.packetColor,
      transparent: true,
      opacity: 0.8,
    });
    this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    this.group.add(this.coreMesh);

    // === Wireframe Shell ===
    const shellGeometry = new THREE.IcosahedronGeometry(size, 1);
    const wireframeGeometry = new THREE.WireframeGeometry(shellGeometry);
    const shellMaterial = new THREE.LineBasicMaterial({
      color: this.packetColor,
      transparent: true,
      opacity: 0.6,
      linewidth: 1,
    });
    this.shellMesh = new THREE.LineSegments(wireframeGeometry, shellMaterial);
    this.group.add(this.shellMesh);
    shellGeometry.dispose();

    // === Outer Ring ===
    const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.3, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.packetColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);

    // === Particle Aura ===
    const particleCount = 20;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = size * (1.3 + Math.random() * 0.5);

      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);
      particleSizes[i] = 2 + Math.random() * 3;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      color: this.packetColor,
      size: 0.02,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.group.add(this.particles);

    // Move everything up slightly so it floats above road
    this.group.position.y = size * 0.5;
  }

  updateAnimation(deltaTime: number): void {
    const speedMult = this.getSpeedMultiplier();

    // Rotate core and shell independently
    this.coreMesh.rotation.x += this.rotationSpeed.x * deltaTime * speedMult;
    this.coreMesh.rotation.y += this.rotationSpeed.y * deltaTime * speedMult;
    this.coreMesh.rotation.z += this.rotationSpeed.z * deltaTime * speedMult;

    this.shellMesh.rotation.x -= this.rotationSpeed.x * 0.5 * deltaTime * speedMult;
    this.shellMesh.rotation.y -= this.rotationSpeed.y * 0.5 * deltaTime * speedMult;

    // Rotate particles slowly in opposite direction
    this.particles.rotation.y += deltaTime * 0.5 * speedMult;

    // Pulse opacity
    const pulse = 0.6 + 0.4 * Math.sin(this.animTime * 4 + this.pulsePhase);
    const innerPulse = 0.4 + 0.3 * Math.sin(this.animTime * 6 + this.pulsePhase);

    if (this.coreMesh.material instanceof THREE.MeshBasicMaterial) {
      this.coreMesh.material.opacity = pulse;
    }
    if (this.innerGlow.material instanceof THREE.MeshBasicMaterial) {
      this.innerGlow.material.opacity = innerPulse;
    }
    if (this.shellMesh.material instanceof THREE.LineBasicMaterial) {
      this.shellMesh.material.opacity = 0.4 + 0.3 * Math.sin(this.animTime * 3);
    }

    // Scale pulsing
    const scale = 0.95 + 0.1 * Math.sin(this.animTime * 5 + this.pulsePhase);
    this.coreMesh.scale.setScalar(scale);
    this.innerGlow.scale.setScalar(scale * 0.8);
  }
}
