import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity, BuildingState } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS, createBuildingMaterial, createGlowMaterial, getStatusColor } from './materials';

const SCALE = 2;
const BODY_RADIUS = 0.18 * SCALE;
const BODY_HEIGHT = 0.8 * SCALE;
const DOME_RADIUS = 0.18 * SCALE;
const RING_RADIUS = 0.2 * SCALE;
const RING_TUBE = 0.015 * SCALE;
const BEACON_RADIUS = 0.06 * SCALE;
const FILL_RADIUS = 0.14 * SCALE;
const MAX_FILL_HEIGHT = 0.75 * SCALE;
const FILL_BASE_Y = 0.04 * SCALE;
const RING_POSITIONS = [0.12, 0.28, 0.44, 0.60, 0.76].map((y) => y * SCALE);
const RING_COLORS = [COLORS.glow.cyan, COLORS.glow.magenta, COLORS.glow.cyan, COLORS.glow.magenta, COLORS.glow.cyan];

const GAUGE_INTERPOLATION_SPEED = 2.0;

function getFillColor(level: number): number {
  if (level <= 33) {
    return COLORS.glow.green;
  }
  if (level <= 66) {
    return COLORS.glow.cyan;
  }
  return COLORS.glow.magenta;
}

export class FarmSiloPrefab extends BasePrefab {
  private rings: THREE.Mesh[] = [];
  private beacon!: THREE.Mesh;
  private fillCylinder!: THREE.Mesh;
  private fillMaterial!: THREE.MeshBasicMaterial;
  private ringMaterials: THREE.MeshBasicMaterial[] = [];

  private currentFillLevel = 0;
  private targetFillLevel = 0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Base platform
    const baseGeo = new THREE.CylinderGeometry(0.25 * SCALE, 0.25 * SCALE, 0.04 * SCALE, 16);
    const baseMat = createBuildingMaterial(COLORS.building.secondary);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.02 * SCALE;
    this.group.add(base);

    // Cylinder body
    const bodyGeo = new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS + 0.02 * SCALE, BODY_HEIGHT, 12);
    const bodyMat = createBuildingMaterial(COLORS.building.dark);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4 * SCALE;
    body.castShadow = true;
    this.group.add(body);

    // Fill cylinder (inside body)
    const fillGeo = new THREE.CylinderGeometry(FILL_RADIUS, FILL_RADIUS, 0.01, 12);
    this.fillMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.glow.green,
      transparent: true,
      opacity: 0.6,
    });
    this.fillCylinder = new THREE.Mesh(fillGeo, this.fillMaterial);
    this.fillCylinder.position.y = FILL_BASE_Y;
    this.fillCylinder.visible = false;
    this.group.add(this.fillCylinder);

    // 5 energy rings
    for (let i = 0; i < 5; i++) {
      const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 4, 24);
      const ringMat = createGlowMaterial(RING_COLORS[i], 0.8);
      this.ringMaterials.push(ringMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = RING_POSITIONS[i];
      ring.rotation.x = Math.PI / 2;
      this.rings.push(ring);
      this.group.add(ring);
    }

    // Dome top
    const domeGeo = new THREE.SphereGeometry(DOME_RADIUS, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = createBuildingMaterial(COLORS.building.dark);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.8 * SCALE;
    this.group.add(dome);

    // Beacon
    const beaconGeo = new THREE.SphereGeometry(BEACON_RADIUS, 8, 8);
    const beaconMat = createGlowMaterial(COLORS.glow.cyan, 0.9);
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.y = 0.92 * SCALE;
    this.addGlowMesh(this.beacon);
    this.group.add(this.beacon);

    // Status glow point at base
    const statusPoint = this.createGlowPoint(0, 0.05 * SCALE, 0.25 * SCALE, COLORS.state.online, 0.03 * SCALE);
    this.group.add(statusPoint);
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const statusColor = getStatusColor(status);

    // Dim/brighten rings
    for (const mat of this.ringMaterials) {
      mat.opacity = isOffline ? 0.1 : 0.8;
    }

    // Update fill cylinder color based on status override
    if (status === 'warning') {
      this.fillMaterial.color.setHex(COLORS.glow.orange);
    } else if (status === 'critical') {
      this.fillMaterial.color.setHex(COLORS.glow.red);
    } else if (status === 'offline') {
      this.fillMaterial.color.setHex(COLORS.state.offline);
      this.fillMaterial.opacity = 0.15;
    } else {
      this.fillMaterial.color.setHex(getFillColor(this.currentFillLevel));
      this.fillMaterial.opacity = 0.6;
    }

    // Beacon follows status color
    if (this.beacon.material instanceof THREE.MeshBasicMaterial) {
      this.beacon.material.color.setHex(isOffline ? COLORS.state.offline : statusColor);
      this.beacon.material.opacity = isOffline ? 0.15 : 0.9;
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity speed is read in update() via getActivitySpeed()
  }

  override updateData(state: BuildingState): void {
    if (state.siloFillLevel !== undefined) {
      this.targetFillLevel = Math.max(0, Math.min(100, state.siloFillLevel));
    }
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    const speed = this.getActivitySpeed();
    const isOffline = this.status === 'offline';

    // Rotate rings (alternating CW/CCW), stop when offline
    if (!isOffline) {
      for (let i = 0; i < this.rings.length; i++) {
        this.rings[i].rotation.z += deltaTime * speed * (i % 2 === 0 ? 1 : -1);
      }
    }

    // Smooth interpolation of fill level
    if (Math.abs(this.currentFillLevel - this.targetFillLevel) > 0.1) {
      this.currentFillLevel += (this.targetFillLevel - this.currentFillLevel) * GAUGE_INTERPOLATION_SPEED * deltaTime;
      this.updateFillGeometry();
    }
  }

  private updateFillGeometry(): void {
    const level = this.currentFillLevel;
    const height = (level / 100) * MAX_FILL_HEIGHT;

    if (height < 0.01) {
      this.fillCylinder.visible = false;
      return;
    }

    this.fillCylinder.visible = true;

    // Replace geometry with new height
    this.fillCylinder.geometry.dispose();
    this.fillCylinder.geometry = new THREE.CylinderGeometry(FILL_RADIUS, FILL_RADIUS, height, 12);
    this.fillCylinder.position.y = FILL_BASE_Y + height / 2;

    // Update color based on level (only when not warning/critical/offline)
    if (this.status === 'online') {
      this.fillMaterial.color.setHex(getFillColor(level));
      this.fillMaterial.opacity = 0.4 + 0.4 * (level / 100);
    }
  }

  override dispose(): void {
    this.fillCylinder.geometry.dispose();
    this.fillMaterial.dispose();
    for (const mat of this.ringMaterials) {
      mat.dispose();
    }
    super.dispose();
  }
}
