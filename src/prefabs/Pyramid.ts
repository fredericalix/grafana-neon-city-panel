import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../types';
import { BasePrefab } from './BasePrefab';
import { COLORS } from './materials';
import { createPyramidBeamMaterial, BEAM_PRESETS } from './shaders/PyramidBeamShader';

/**
 * 15-tier configuration matching STL analysis (3:1 width:height ratio)
 * Base ~2.9, total height ~2.2 units
 * Occupies 3x3 grid cells
 */
const TIER_CONFIG = [
  { size: 2.90, height: 0.08 }, // Base platform
  { size: 2.75, height: 0.12 }, // Tier 1
  { size: 2.60, height: 0.12 }, // Tier 2
  { size: 2.45, height: 0.12 }, // Tier 3
  { size: 2.30, height: 0.12 }, // Tier 4
  { size: 2.15, height: 0.12 }, // Tier 5
  { size: 2.00, height: 0.14 }, // Tier 6
  { size: 1.85, height: 0.14 }, // Tier 7
  { size: 1.70, height: 0.14 }, // Tier 8
  { size: 1.55, height: 0.14 }, // Tier 9
  { size: 1.40, height: 0.16 }, // Tier 10
  { size: 1.20, height: 0.16 }, // Tier 11
  { size: 1.00, height: 0.18 }, // Tier 12
  { size: 0.75, height: 0.20 }, // Tier 13
  { size: 0.50, height: 0.22 }, // Apex (Tier 14)
];

function getTotalHeight(): number {
  return TIER_CONFIG.reduce((sum, t) => sum + t.height, 0);
}

function createWindowTexture(
  glowColor: number,
  windowRows: number,
  windowCols: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const marginX = 8;
  const marginY = 6;
  const gapX = 4;
  const gapY = 4;
  const windowWidth = (canvas.width - marginX * 2 - gapX * (windowCols - 1)) / windowCols;
  const windowHeight = (canvas.height - marginY * 2 - gapY * (windowRows - 1)) / windowRows;

  const color = new THREE.Color(glowColor);
  const cssColor = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`;

  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      const x = marginX + col * (windowWidth + gapX);
      const y = marginY + row * (windowHeight + gapY);

      const isLit = Math.random() > 0.3;

      if (isLit) {
        const gradient = ctx.createRadialGradient(
          x + windowWidth / 2, y + windowHeight / 2, 0,
          x + windowWidth / 2, y + windowHeight / 2, windowWidth * 0.8
        );
        gradient.addColorStop(0, cssColor);
        gradient.addColorStop(0.6, cssColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x - 2, y - 2, windowWidth + 4, windowHeight + 4);

        ctx.fillStyle = cssColor;
        ctx.fillRect(x, y, windowWidth, windowHeight);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x + 2, y + 2, windowWidth - 4, windowHeight - 4);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = '#222233';
        ctx.fillRect(x, y, windowWidth, windowHeight);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

/**
 * Pyramid Prefab - Tron-style ziggurat with volumetric light beam
 * Ported from whooktown/threejs-scene
 */
export class PyramidPrefab extends BasePrefab {
  private tierMeshes: THREE.Mesh[] = [];
  private tierTextures: THREE.CanvasTexture[] = [];
  private neonEdges: THREE.Line[] = [];
  private accentBands: THREE.Mesh[] = [];
  private apexBeacon!: THREE.Mesh;
  private apexGlow!: THREE.Mesh;
  private groundGlow!: THREE.Mesh;

  private lightBeam!: THREE.Mesh;
  private lightBeamMaterial!: THREE.ShaderMaterial;

  private animTime = 0;
  private currentGlowColor = COLORS.glow.cyan;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    this.createZiggurat();
    this.createNeonEdges();
    this.createAccentBands();
    this.createApexBeacon();
    this.createLightBeam();
    this.createGroundGlow();
    this.createBaseBorder();
  }

  private createZiggurat(): void {
    let currentY = 0;

    for (let i = 0; i < TIER_CONFIG.length; i++) {
      const tier = TIER_CONFIG[i];
      const isBase = i === 0;
      const isApex = i === TIER_CONFIG.length - 1;

      const geometry = new THREE.BoxGeometry(tier.size, tier.height, tier.size);

      let material: THREE.MeshStandardMaterial;

      if (!isBase && !isApex && tier.size > 0.6) {
        const windowRows = tier.height > 0.15 ? 2 : 1;
        const windowCols = Math.max(3, Math.floor(tier.size * 4));

        const windowTexture = createWindowTexture(
          this.currentGlowColor,
          windowRows,
          windowCols
        );
        this.tierTextures.push(windowTexture);

        windowTexture.repeat.set(4, 1);

        material = new THREE.MeshStandardMaterial({
          color: COLORS.building.dark,
          metalness: 0.85,
          roughness: 0.15,
          map: windowTexture,
          emissive: new THREE.Color(this.currentGlowColor),
          emissiveIntensity: 0.05,
          emissiveMap: windowTexture,
        });
      } else {
        material = new THREE.MeshStandardMaterial({
          color: COLORS.building.dark,
          metalness: 0.85,
          roughness: 0.15,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = currentY + tier.height / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.tierMeshes.push(mesh);
      this.group.add(mesh);

      currentY += tier.height;
    }
  }

  private createNeonEdges(): void {
    let actualY = 0;

    for (let i = 0; i < TIER_CONFIG.length; i++) {
      const tier = TIER_CONFIG[i];
      const hw = tier.size / 2;

      actualY += tier.height;

      const edgeMat = new THREE.LineBasicMaterial({
        color: this.currentGlowColor,
        transparent: true,
        opacity: 0.9,
      });

      const edgePoints = [
        new THREE.Vector3(-hw, actualY, -hw),
        new THREE.Vector3(hw, actualY, -hw),
        new THREE.Vector3(hw, actualY, hw),
        new THREE.Vector3(-hw, actualY, hw),
        new THREE.Vector3(-hw, actualY, -hw),
      ];

      const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
      const edgeLine = new THREE.Line(edgeGeo, edgeMat);
      this.neonEdges.push(edgeLine);
      this.group.add(edgeLine);

      if (i === 0) {
        const bottomEdgePoints = [
          new THREE.Vector3(-hw, 0, -hw),
          new THREE.Vector3(hw, 0, -hw),
          new THREE.Vector3(hw, 0, hw),
          new THREE.Vector3(-hw, 0, hw),
          new THREE.Vector3(-hw, 0, -hw),
        ];

        const bottomEdgeGeo = new THREE.BufferGeometry().setFromPoints(bottomEdgePoints);
        const bottomEdgeLine = new THREE.Line(bottomEdgeGeo, edgeMat.clone());
        this.neonEdges.push(bottomEdgeLine);
        this.group.add(bottomEdgeLine);
      }
    }
  }

  private createAccentBands(): void {
    const bandTiers = [2, 5, 8, 11, 13];

    for (const tierIndex of bandTiers) {
      if (tierIndex >= TIER_CONFIG.length) continue;

      const tier = TIER_CONFIG[tierIndex];
      let yPos = 0;
      for (let j = 0; j <= tierIndex; j++) {
        yPos += TIER_CONFIG[j].height;
      }
      yPos -= 0.01;

      const bandMat = new THREE.MeshBasicMaterial({
        color: this.currentGlowColor,
        transparent: true,
        opacity: 0.6,
      });

      const bandGeo = new THREE.BoxGeometry(
        tier.size + 0.02,
        0.03,
        tier.size + 0.02
      );
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = yPos;
      this.addGlowMesh(band);
      this.accentBands.push(band);
      this.group.add(band);
    }
  }

  private createApexBeacon(): void {
    const totalHeight = getTotalHeight();

    const beaconGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: this.currentGlowColor,
      transparent: true,
      opacity: 0.9,
    });

    this.apexBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.apexBeacon.position.y = totalHeight + 0.1;
    this.addGlowMesh(this.apexBeacon);
    this.group.add(this.apexBeacon);

    const glowGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.currentGlowColor,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    this.apexGlow = new THREE.Mesh(glowGeo, glowMat);
    this.apexGlow.position.copy(this.apexBeacon.position);
    this.group.add(this.apexGlow);
  }

  private createLightBeam(): void {
    const totalHeight = getTotalHeight();

    const beamBaseRadius = 0.15;
    const beamTopRadius = 0.6;
    const beamHeight = 6.0;

    const beamGeometry = new THREE.CylinderGeometry(
      beamTopRadius,
      beamBaseRadius,
      beamHeight,
      32,
      1,
      true
    );

    this.lightBeamMaterial = createPyramidBeamMaterial({
      color: this.currentGlowColor,
      opacity: 0.5,
      intensity: 1.2,
      pulseSpeed: 1.5,
      scanlineSpeed: 2.0,
      scanlineDensity: 60.0,
      noiseStrength: 0.08,
      edgeGlowStrength: 0.4,
    });

    this.lightBeam = new THREE.Mesh(beamGeometry, this.lightBeamMaterial);
    this.lightBeam.position.y = totalHeight + 0.1 + beamHeight / 2;

    this.group.add(this.lightBeam);
  }

  private createGroundGlow(): void {
    const baseTier = TIER_CONFIG[0];
    const glowSize = baseTier.size + 0.5;

    const glowGeo = new THREE.PlaneGeometry(glowSize, glowSize);
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.currentGlowColor,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });

    this.groundGlow = new THREE.Mesh(glowGeo, glowMat);
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.position.y = 0.01;
    this.group.add(this.groundGlow);
  }

  private createBaseBorder(): void {
    const baseTier = TIER_CONFIG[0];
    const hw = baseTier.size / 2 + 0.1;

    const borderMat = new THREE.LineBasicMaterial({
      color: this.currentGlowColor,
      transparent: true,
      opacity: 0.7,
    });

    const borderPoints = [
      new THREE.Vector3(-hw, 0.02, -hw),
      new THREE.Vector3(hw, 0.02, -hw),
      new THREE.Vector3(hw, 0.02, hw),
      new THREE.Vector3(-hw, 0.02, hw),
      new THREE.Vector3(-hw, 0.02, -hw),
    ];

    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderLine = new THREE.Line(borderGeo, borderMat);
    this.neonEdges.push(borderLine);
    this.group.add(borderLine);
  }

  private updateGlowColors(color: number): void {
    this.currentGlowColor = color;
    const threeColor = new THREE.Color(color);

    for (const edge of this.neonEdges) {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.color.setHex(color);
      }
    }

    for (const band of this.accentBands) {
      if (band.material instanceof THREE.MeshBasicMaterial) {
        band.material.color.setHex(color);
      }
    }

    if (this.apexBeacon?.material instanceof THREE.MeshBasicMaterial) {
      this.apexBeacon.material.color.setHex(color);
    }

    if (this.apexGlow?.material instanceof THREE.MeshBasicMaterial) {
      this.apexGlow.material.color.setHex(color);
    }

    if (this.lightBeamMaterial) {
      this.lightBeamMaterial.uniforms.uColor.value = threeColor;
    }

    if (this.groundGlow?.material instanceof THREE.MeshBasicMaterial) {
      this.groundGlow.material.color.setHex(color);
    }

    for (const mesh of this.tierMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.emissive = threeColor;
      }
    }
  }

  private regenerateWindowTextures(color: number): void {
    let textureIndex = 0;

    for (let i = 0; i < TIER_CONFIG.length; i++) {
      const tier = TIER_CONFIG[i];
      const isBase = i === 0;
      const isApex = i === TIER_CONFIG.length - 1;

      if (!isBase && !isApex && tier.size > 0.6) {
        const mesh = this.tierMeshes[i];
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          if (this.tierTextures[textureIndex]) {
            this.tierTextures[textureIndex].dispose();
          }

          const windowRows = tier.height > 0.15 ? 2 : 1;
          const windowCols = Math.max(3, Math.floor(tier.size * 4));
          const newTexture = createWindowTexture(color, windowRows, windowCols);
          newTexture.repeat.set(4, 1);

          this.tierTextures[textureIndex] = newTexture;
          mesh.material.map = newTexture;
          mesh.material.emissiveMap = newTexture;
          mesh.material.needsUpdate = true;
        }
        textureIndex++;
      }
    }
  }

  protected onStatusChange(status: BuildingStatus): void {
    const isOffline = status === 'offline';
    const isWarning = status === 'warning';
    const isCritical = status === 'critical';

    let glowColor: number;
    let edgeOpacity: number;
    let beamPreset: typeof BEAM_PRESETS.online;

    if (isOffline) {
      glowColor = 0x333344;
      edgeOpacity = 0.2;
      beamPreset = BEAM_PRESETS.online;
    } else if (isWarning) {
      glowColor = COLORS.glow.orange;
      edgeOpacity = 0.9;
      beamPreset = BEAM_PRESETS.warning;
    } else if (isCritical) {
      glowColor = COLORS.glow.red;
      edgeOpacity = 0.9;
      beamPreset = BEAM_PRESETS.critical;
    } else {
      glowColor = COLORS.glow.cyan;
      edgeOpacity = 0.9;
      beamPreset = BEAM_PRESETS.online;
    }

    this.updateGlowColors(glowColor);

    if (!isOffline) {
      this.regenerateWindowTextures(glowColor);
    }

    for (const edge of this.neonEdges) {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = edgeOpacity;
      }
    }

    for (const mesh of this.tierMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        if (isCritical) {
          mesh.material.emissive = new THREE.Color(0x330000);
          mesh.material.emissiveIntensity = 0.3;
        } else if (isWarning) {
          mesh.material.emissive = new THREE.Color(0x331a00);
          mesh.material.emissiveIntensity = 0.2;
        } else if (isOffline) {
          mesh.material.emissive = new THREE.Color(0x000000);
          mesh.material.emissiveIntensity = 0;
        } else {
          mesh.material.emissive = new THREE.Color(glowColor);
          mesh.material.emissiveIntensity = 0.05;
        }
      }
    }

    if (this.lightBeam && this.lightBeamMaterial) {
      this.lightBeam.visible = !isOffline;

      if (!isOffline) {
        this.lightBeamMaterial.uniforms.uOpacity.value = beamPreset.opacity;
        this.lightBeamMaterial.uniforms.uIntensity.value = beamPreset.intensity;
        this.lightBeamMaterial.uniforms.uPulseSpeed.value = beamPreset.pulseSpeed;
        this.lightBeamMaterial.uniforms.uScanlineSpeed.value = beamPreset.scanlineSpeed;
        this.lightBeamMaterial.uniforms.uScanlineDensity.value = beamPreset.scanlineDensity;
        this.lightBeamMaterial.uniforms.uNoiseStrength.value = beamPreset.noiseStrength;
        this.lightBeamMaterial.uniforms.uEdgeGlowStrength.value = beamPreset.edgeGlowStrength;
      }
    }

    if (this.apexBeacon) {
      this.apexBeacon.visible = !isOffline;
    }
    if (this.apexGlow) {
      this.apexGlow.visible = !isOffline;
    }

    if (this.groundGlow?.material instanceof THREE.MeshBasicMaterial) {
      this.groundGlow.material.opacity = isOffline ? 0.02 : 0.12;
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity could affect animation speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    if (this.lightBeamMaterial && this.status !== 'offline') {
      this.lightBeamMaterial.uniforms.uTime.value = this.animTime;
    }

    if (this.status === 'offline') {
      return;
    }

    const edgePulse = this.status === 'critical'
      ? 0.5 + 0.5 * Math.sin(this.animTime * 8)
      : this.status === 'warning'
        ? 0.6 + 0.4 * Math.sin(this.animTime * 4)
        : 0.75 + 0.25 * Math.sin(this.animTime * 1.5);

    for (const edge of this.neonEdges) {
      if (edge.material instanceof THREE.LineBasicMaterial) {
        edge.material.opacity = edgePulse;
      }
    }

    const bandPulse = 0.4 + 0.3 * Math.sin(this.animTime * 2 + Math.PI / 3);
    for (const band of this.accentBands) {
      if (band.material instanceof THREE.MeshBasicMaterial) {
        band.material.opacity = bandPulse;
      }
    }

    if (this.apexBeacon?.material instanceof THREE.MeshBasicMaterial) {
      const beaconPulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
      this.apexBeacon.material.opacity = beaconPulse;
    }

    if (this.apexGlow) {
      const scale = 1.0 + 0.2 * Math.sin(this.animTime * 2);
      this.apexGlow.scale.setScalar(scale);
    }

    if (this.groundGlow?.material instanceof THREE.MeshBasicMaterial) {
      const haloPulse = 0.08 + 0.06 * Math.sin(this.animTime * 1.5);
      this.groundGlow.material.opacity = haloPulse;
    }

    const emissivePulse = 0.03 + 0.03 * Math.sin(this.animTime * 1.2);
    for (const mesh of this.tierMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        if (this.status !== 'critical' && this.status !== 'warning') {
          mesh.material.emissiveIntensity = emissivePulse;
        }
      }
    }
  }

  override dispose(): void {
    for (const texture of this.tierTextures) {
      texture.dispose();
    }
    this.tierTextures = [];

    if (this.lightBeamMaterial) {
      this.lightBeamMaterial.dispose();
    }

    super.dispose();
  }
}
