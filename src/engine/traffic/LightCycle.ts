/**
 * LightCycle - Tron-style motorcycle vehicle
 *
 * A streamlined futuristic motorcycle with neon edges,
 * emissive wheels, and light trail.
 */

import * as THREE from 'three';
import { VehicleBase } from './VehicleBase';
import { TRAFFIC_COLORS, VEHICLE_DIMENSIONS, createNeonMaterial, createNeonLineMaterial } from './TrafficConfig';

export class LightCycle extends VehicleBase {
  private bodyMesh!: THREE.Mesh;
  private wheelFront!: THREE.Mesh;
  private wheelRear!: THREE.Mesh;
  private neonLines!: THREE.LineSegments;
  private glowCore!: THREE.Mesh;

  private wheelRotation = 0;
  private neonColor: number;

  constructor(useAltColor = false) {
    const neonColor = useAltColor
      ? TRAFFIC_COLORS.lightCycle.neonSecondary
      : TRAFFIC_COLORS.lightCycle.neonPrimary;

    super('lightCycle', neonColor);
    this.neonColor = neonColor;
  }

  createGeometry(): void {
    const dim = VEHICLE_DIMENSIONS.lightCycle;

    // === Body ===
    // Main body - tapered box
    const bodyGeometry = new THREE.BoxGeometry(dim.width, dim.height * 0.6, dim.length);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: TRAFFIC_COLORS.lightCycle.body,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.bodyMesh.position.y = dim.height * 0.4;
    this.group.add(this.bodyMesh);

    // === Canopy (rider area) ===
    const canopyGeometry = new THREE.BoxGeometry(dim.width * 0.8, dim.height * 0.4, dim.length * 0.5);
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0x111122,
      metalness: 0.9,
      roughness: 0.1,
    });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.position.y = dim.height * 0.7;
    canopy.position.z = -dim.length * 0.1;
    this.group.add(canopy);

    // === Front Fairing ===
    const fairingGeometry = new THREE.ConeGeometry(dim.width * 0.4, dim.length * 0.3, 4);
    fairingGeometry.rotateX(Math.PI / 2);
    const fairingMaterial = new THREE.MeshStandardMaterial({
      color: TRAFFIC_COLORS.lightCycle.body,
      metalness: 0.8,
      roughness: 0.2,
    });
    const fairing = new THREE.Mesh(fairingGeometry, fairingMaterial);
    fairing.position.z = dim.length * 0.55;
    fairing.position.y = dim.height * 0.35;
    this.group.add(fairing);

    // === Wheels ===
    const wheelGeometry = new THREE.TorusGeometry(dim.height * 0.35, dim.height * 0.08, 8, 16);
    const wheelMaterial = createNeonMaterial(this.neonColor, 0.8);

    // Front wheel
    this.wheelFront = new THREE.Mesh(wheelGeometry, wheelMaterial);
    this.wheelFront.rotation.y = Math.PI / 2;
    this.wheelFront.position.z = dim.length * 0.35;
    this.wheelFront.position.y = dim.height * 0.35;
    this.group.add(this.wheelFront);

    // Rear wheel
    this.wheelRear = new THREE.Mesh(wheelGeometry, wheelMaterial.clone());
    this.wheelRear.rotation.y = Math.PI / 2;
    this.wheelRear.position.z = -dim.length * 0.35;
    this.wheelRear.position.y = dim.height * 0.35;
    this.group.add(this.wheelRear);

    // === Neon Edge Lines ===
    const edgePoints: THREE.Vector3[] = [];

    // Bottom edges
    const hw = dim.width / 2;
    const hl = dim.length / 2;
    const hh = dim.height * 0.2;

    // Front bottom edge
    edgePoints.push(new THREE.Vector3(-hw, hh, hl));
    edgePoints.push(new THREE.Vector3(hw, hh, hl));

    // Side edges
    edgePoints.push(new THREE.Vector3(-hw, hh, hl));
    edgePoints.push(new THREE.Vector3(-hw, hh, -hl));
    edgePoints.push(new THREE.Vector3(hw, hh, hl));
    edgePoints.push(new THREE.Vector3(hw, hh, -hl));

    // Back edge
    edgePoints.push(new THREE.Vector3(-hw, hh, -hl));
    edgePoints.push(new THREE.Vector3(hw, hh, -hl));

    // Top edges
    const topH = dim.height * 0.7;
    edgePoints.push(new THREE.Vector3(-hw * 0.8, topH, hl * 0.3));
    edgePoints.push(new THREE.Vector3(hw * 0.8, topH, hl * 0.3));
    edgePoints.push(new THREE.Vector3(-hw * 0.8, topH, -hl * 0.4));
    edgePoints.push(new THREE.Vector3(hw * 0.8, topH, -hl * 0.4));

    const edgeGeometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMaterial = createNeonLineMaterial(this.neonColor);
    this.neonLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    this.group.add(this.neonLines);

    // === Glow Core (energy source) ===
    const glowGeometry = new THREE.SphereGeometry(dim.width * 0.15, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.neonColor,
      transparent: true,
      opacity: 0.9,
    });
    this.glowCore = new THREE.Mesh(glowGeometry, glowMaterial);
    this.glowCore.position.y = dim.height * 0.5;
    this.glowCore.position.z = -dim.length * 0.3;
    this.group.add(this.glowCore);

    // === Headlight ===
    const headlightGeometry = new THREE.CircleGeometry(dim.width * 0.12, 8);
    const headlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlight.position.z = dim.length * 0.5;
    headlight.position.y = dim.height * 0.35;
    this.group.add(headlight);

    // === Tail Light ===
    const taillightGeometry = new THREE.BoxGeometry(dim.width * 0.8, dim.height * 0.1, 0.01);
    const taillightMaterial = new THREE.MeshBasicMaterial({
      color: this.neonColor,
      transparent: true,
      opacity: 0.95,
    });
    const taillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    taillight.position.z = -dim.length * 0.5;
    taillight.position.y = dim.height * 0.3;
    this.group.add(taillight);
  }

  updateAnimation(deltaTime: number): void {
    // Rotate wheels based on speed
    const speedMult = this.getSpeedMultiplier();
    this.wheelRotation += deltaTime * 10 * speedMult;

    this.wheelFront.rotation.x = this.wheelRotation;
    this.wheelRear.rotation.x = this.wheelRotation;

    // Pulse glow core
    const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 5);
    if (this.glowCore.material instanceof THREE.MeshBasicMaterial) {
      this.glowCore.material.opacity = pulse;
    }

    // Subtle neon line pulse
    const neonPulse = 0.8 + 0.2 * Math.sin(this.animTime * 3);
    if (this.neonLines.material instanceof THREE.LineBasicMaterial) {
      this.neonLines.material.opacity = neonPulse;
    }
  }
}
