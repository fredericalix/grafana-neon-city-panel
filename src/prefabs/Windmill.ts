import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';

/**
 * Windmill Prefab - Cyberpunk Energy Turbine
 * Ported from whooktown/threejs-scene
 */
export class WindmillPrefab extends BasePrefab {
  private blades!: THREE.Group;
  private energyParticles!: THREE.Points;
  private body!: THREE.Mesh;
  private neonRings: THREE.Mesh[] = [];
  private energyCore!: THREE.Mesh;
  private neonEdges: THREE.LineSegments[] = [];
  private animTime = 0;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createBasePlatform();
    this.createTurbineTower();
    this.createEnergyBlades();
    this.createNeonRings();
    this.createEnergyCore();

    const topLight = this.createGlowPoint(0, 1.55, 0, COLORS.state.online, 0.06);
    this.group.add(topLight);

    this.createEnergyParticles();
  }

  private createBasePlatform(): void {
    const baseMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.9,
      roughness: 0.2,
    });

    const baseGeo = new THREE.CylinderGeometry(0.45, 0.52, 0.12, 6);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.06;
    base.castShadow = true;
    this.group.add(base);

    const ringGeo = new THREE.TorusGeometry(0.5, 0.02, 4, 12);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.12;
    ring.rotation.x = Math.PI / 2;
    this.neonRings.push(ring);
    this.addGlowMesh(ring);
    this.group.add(ring);
  }

  private createTurbineTower(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.dark,
      metalness: 0.85,
      roughness: 0.2,
    });

    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.33, 1.05, 8);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 0.645;
    this.body.castShadow = true;
    this.group.add(this.body);

    const domeMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.1,
    });
    const domeGeo = new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.17;
    this.group.add(dome);

    const spireGeo = new THREE.CylinderGeometry(0.015, 0.03, 0.3, 6);
    const spire = new THREE.Mesh(spireGeo, domeMat);
    spire.position.y = 1.42;
    this.group.add(spire);

    this.addTowerNeonEdges();
  }

  private addTowerNeonEdges(): void {
    const neonMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
      const topRadius = 0.18;
      const bottomRadius = 0.33;

      const points = [
        new THREE.Vector3(Math.cos(angle) * bottomRadius, 0.12, Math.sin(angle) * bottomRadius),
        new THREE.Vector3(Math.cos(angle) * topRadius, 1.17, Math.sin(angle) * topRadius),
      ];

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(geo, neonMat.clone());
      this.neonEdges.push(line);
      this.group.add(line);
    }
  }

  private createNeonRings(): void {
    const heights = [0.3, 0.6, 0.9];
    const colors = [COLORS.glow.cyan, COLORS.glow.magenta, COLORS.glow.cyan];

    for (let i = 0; i < heights.length; i++) {
      const y = heights[i];
      const radius = 0.33 - (y / 1.05) * 0.15;

      const ringGeo = new THREE.TorusGeometry(radius + 0.03, 0.018, 4, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colors[i],
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      this.neonRings.push(ring);
      this.addGlowMesh(ring);
      this.group.add(ring);
    }
  }

  private createEnergyBlades(): void {
    this.blades = new THREE.Group();

    const hubMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.95,
      roughness: 0.1,
    });

    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    this.blades.add(hub);

    const hubRingGeo = new THREE.TorusGeometry(0.135, 0.0225, 4, 16);
    const hubRingMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const hubRing = new THREE.Mesh(hubRingGeo, hubRingMat);
    hubRing.position.z = 0.06;
    this.addGlowMesh(hubRing);
    this.blades.add(hubRing);

    for (let i = 0; i < 3; i++) {
      const blade = this.createEnergyBlade();
      blade.rotation.z = (i * Math.PI * 2) / 3;
      this.blades.add(blade);
    }

    this.blades.position.set(0, 0.85, 0.27);
    this.group.add(this.blades);
  }

  private createEnergyBlade(): THREE.Group {
    const bladeGroup = new THREE.Group();

    const armMat = new THREE.MeshStandardMaterial({
      color: COLORS.building.metal,
      metalness: 0.9,
      roughness: 0.15,
    });

    const armGeo = new THREE.BoxGeometry(0.525, 0.0375, 0.0225);
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.x = 0.27;
    bladeGroup.add(arm);

    const panelMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    const panelGeo = new THREE.PlaneGeometry(0.42, 0.12);
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0.3, 0, 0.015);
    panel.rotation.x = Math.PI * 0.05;
    this.addGlowMesh(panel);
    bladeGroup.add(panel);

    const tipGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const tipMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.9,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.x = 0.54;
    this.addGlowMesh(tip);
    bladeGroup.add(tip);

    const edgePoints = [new THREE.Vector3(0.03, 0, 0.03), new THREE.Vector3(0.525, 0, 0.03)];
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edge = new THREE.Line(edgeGeo, edgeMat);
    bladeGroup.add(edge);

    return bladeGroup;
  }

  private createEnergyCore(): void {
    const coreGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.cyan,
      transparent: true,
      opacity: 0.8,
    });
    this.energyCore = new THREE.Mesh(coreGeo, coreMat);
    this.energyCore.position.set(0, 0.85, 0.2);
    this.addGlowMesh(this.energyCore);
    this.group.add(this.energyCore);

    const outerGeo = new THREE.TorusGeometry(0.12, 0.012, 4, 16);
    const outerMat = new THREE.MeshBasicMaterial({
      color: COLORS.glow.magenta,
      transparent: true,
      opacity: 0.7,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.set(0, 0.85, 0.18);
    this.neonRings.push(outer);
    this.addGlowMesh(outer);
    this.group.add(outer);
  }

  private createEnergyParticles(): void {
    const particleCount = 40;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.225;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.45 + Math.random() * 0.75;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const isCyan = Math.random() > 0.3;
      colors[i * 3] = isCyan ? 0 : 1;
      colors[i * 3 + 1] = isCyan ? 1 : 0;
      colors[i * 3 + 2] = 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    this.energyParticles = new THREE.Points(geometry, material);
    this.energyParticles.visible = true;
    this.group.add(this.energyParticles);
  }

  protected onStatusChange(status: BuildingStatus): void {
    if (!this.body || !this.energyParticles) {
      return;
    }

    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    this.neonRings.forEach((ring) => {
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.opacity = isOffline ? 0.15 : 0.8;
        if (isCritical) {
          ring.material.color.setHex(COLORS.glow.red);
        } else if (isWarning) {
          ring.material.color.setHex(COLORS.glow.orange);
        } else {
          ring.material.color.setHex(COLORS.glow.cyan);
        }
      }
    });

    this.neonEdges.forEach((edge) => {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = isOffline ? 0.2 : 0.9;
      }
    });

    if (this.energyCore?.material instanceof THREE.MeshBasicMaterial) {
      this.energyCore.material.opacity = isOffline ? 0.2 : 0.8;
      if (isCritical) {
        this.energyCore.material.color.setHex(COLORS.glow.red);
      } else if (isWarning) {
        this.energyCore.material.color.setHex(COLORS.glow.orange);
      } else {
        this.energyCore.material.color.setHex(COLORS.glow.cyan);
      }
    }

    this.energyParticles.visible = !isOffline;

    if (this.body.material instanceof THREE.MeshStandardMaterial) {
      this.body.material.emissive = new THREE.Color(
        isCritical ? 0x330000 : isWarning ? 0x331a00 : 0x000000
      );
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects rotation speed, handled in update()
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    if (this.blades && this.status !== 'offline') {
      const speed = this.getActivitySpeed();
      this.blades.rotation.z += deltaTime * speed * 3;
    }

    if (this.energyParticles?.visible) {
      const positions = this.energyParticles.geometry.getAttribute('position');
      const speed = this.getActivitySpeed();

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        let y = positions.getY(i);
        const z = positions.getZ(i);

        const angle = Math.atan2(z, x) + deltaTime * speed * 2;
        const radius = Math.sqrt(x * x + z * z);

        y += deltaTime * speed * 0.45;
        if (y > 1.35) {
          y = 0.45;
        }

        positions.setX(i, Math.cos(angle) * radius);
        positions.setY(i, y);
        positions.setZ(i, Math.sin(angle) * radius);
      }
      positions.needsUpdate = true;
    }

    if (this.energyCore?.material instanceof THREE.MeshBasicMaterial) {
      if (this.status !== 'offline') {
        const pulse = 0.6 + 0.3 * Math.sin(this.animTime * 4);
        this.energyCore.material.opacity = pulse;
      }
    }

    if (this.status !== 'offline') {
      const ringPulse = 0.6 + 0.3 * Math.sin(this.animTime * 3);
      this.neonRings.forEach((ring, i) => {
        if (ring.material instanceof THREE.MeshBasicMaterial) {
          ring.material.opacity = ringPulse * (i % 2 === 0 ? 1 : 0.8);
        }
      });
    }
  }
}
