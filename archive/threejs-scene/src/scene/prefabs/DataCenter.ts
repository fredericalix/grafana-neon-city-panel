import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import {
  DATA_CENTER_COLORS,
  DATA_CENTER_PRESETS,
  createGridFloorMaterial,
  createHologramMaterial,
  createCylindricalGaugeMaterial,
  createTemperatureBarMaterial,
  createProjectionBeamMaterial,
  createAlertBeaconMaterial,
  createCoolingFanMaterial,
  createVaporMaterial,
  createDigitalDisplayTexture,
  createBinaryAtlasTexture,
  createBinaryParticleMaterial,
} from './DataCenterShader';

/**
 * Data Center Metrics Interface
 * All metrics that can be visualized in the data center
 */
export interface DataCenterMetrics {
  cpuUsage: number;          // 0-100
  ramUsage: number;          // 0-100
  networkTraffic: number;    // 0-100
  activeConnections: number; // integer count
  temperature: number;       // 0-100
  alertLevel: 'normal' | 'warning' | 'critical';
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Visual size (larger than 3x3 footprint for aesthetics)
  baseSize: 6.0,
  baseHeight: 0.1,

  // Server racks
  rack: {
    width: 0.4,
    depth: 0.3,
    height: 1.2,
    bladesPerRack: 8,
    bladeHeight: 0.12,
    bladeGap: 0.02,
    rowSpacing: 1.8,  // Distance between north and south rows
    rackSpacing: 1.0, // Distance between racks in a row
  },

  // Cooling towers
  cooling: {
    radius: 0.35,
    height: 1.4,
    fanRadius: 0.3,
  },

  // Central hologram
  hologram: {
    pedestalRadius: 0.8,
    pedestalHeight: 0.4,
    coreRadius: 0.8,
    coreHeight: 2.0,
    ringCount: 3,
  },

  // Alert beacons
  beacon: {
    radius: 0.1,
    height: 0.4,
  },

  // Particle systems
  particles: {
    dataFlowCount: 200,
    vaporCount: 50,
  },
};

/**
 * Data Center Prefab - Epic visualization of server infrastructure
 *
 * A 3x3 grid data center featuring:
 * - 10 server racks with animated LED cascade
 * - 4 corner cooling towers with rotating fans and vapor
 * - Central holographic core with live metrics display
 * - Data flow particle system
 * - Alert beacon system
 *
 * Inspired by Tron Legacy, Blade Runner, and cyberpunk aesthetics
 */
export class DataCenterPrefab extends BasePrefab {
  // Metrics state (target values for interpolation)
  private targetMetrics: DataCenterMetrics = {
    cpuUsage: 50,
    ramUsage: 50,
    networkTraffic: 50,
    activeConnections: 0,
    temperature: 50,
    alertLevel: 'normal',
  };

  // Current interpolated values
  private currentMetrics: DataCenterMetrics = { ...this.targetMetrics };

  // Animation time
  private animTime = 0;

  // ============= STRUCTURE COMPONENTS =============
  private basePlatform!: THREE.Mesh;
  private gridFloorMaterial!: THREE.ShaderMaterial;

  // Server racks
  private rackGroup!: THREE.Group;
  private serverBlades!: THREE.InstancedMesh;
  private bladeCount = 0;

  // LED strips (one per rack)
  private ledStrips: THREE.Mesh[] = [];
  private ledMaterials: THREE.MeshBasicMaterial[] = [];

  // Cooling towers
  private coolingTowers: THREE.Group[] = [];
  private fanMeshes: THREE.Mesh[] = [];
  private fanMaterials: THREE.ShaderMaterial[] = [];
  private vaporSystems: THREE.Points[] = [];
  private vaporMaterials: THREE.ShaderMaterial[] = [];
  private fanRings: THREE.Mesh[] = [];

  // Central hologram
  private hologramGroup!: THREE.Group;
  private hologramCore!: THREE.Mesh;
  private hologramMaterial!: THREE.ShaderMaterial;
  private projectionBeam!: THREE.Mesh;
  private projectionBeamMaterial!: THREE.ShaderMaterial;
  private orbitalRings: THREE.Mesh[] = [];
  private pedestal!: THREE.Mesh;

  // Gauge displays
  private cpuGauge!: THREE.Mesh;
  private cpuGaugeMaterial!: THREE.ShaderMaterial;
  private ramGauge!: THREE.Mesh;
  private ramGaugeMaterial!: THREE.ShaderMaterial;
  private temperatureBar!: THREE.Mesh;
  private temperatureBarMaterial!: THREE.ShaderMaterial;
  private connectionDisplay!: THREE.Mesh;
  private connectionTexture!: THREE.CanvasTexture;
  private networkGraph!: THREE.Line;
  private networkGraphPoints: number[] = [];

  // Alert beacons
  private alertBeacons: THREE.Mesh[] = [];
  private alertBeaconMaterials: THREE.ShaderMaterial[] = [];

  // Data flow particles (binary 0s and 1s)
  private dataFlowParticles!: THREE.Points;
  private binaryAtlasTexture!: THREE.CanvasTexture;
  private binaryParticleMaterial!: THREE.ShaderMaterial;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Build all components
    this.createBasePlatform();
    this.createServerRacks();
    this.createCoolingTowers();
    this.createCentralHologram();
    this.createGaugeDisplays();
    this.createAlertBeacons();
    this.createDataFlowParticles();

    // Initial metrics display
    this.updateAllMetrics(this.currentMetrics);
  }

  // ===========================================================================
  // COMPONENT CREATION
  // ===========================================================================

  /**
   * Create the base platform with animated grid
   */
  private createBasePlatform(): void {
    const size = CONFIG.baseSize;

    // Dark base platform
    const baseGeo = new THREE.BoxGeometry(size, CONFIG.baseHeight, size);
    const baseMat = new THREE.MeshStandardMaterial({
      color: DATA_CENTER_COLORS.darkMetal,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.basePlatform = new THREE.Mesh(baseGeo, baseMat);
    this.basePlatform.position.y = CONFIG.baseHeight / 2;
    this.basePlatform.receiveShadow = true;
    this.group.add(this.basePlatform);

    // Animated grid floor overlay
    const gridGeo = new THREE.PlaneGeometry(size * 0.95, size * 0.95);
    this.gridFloorMaterial = createGridFloorMaterial();
    const gridFloor = new THREE.Mesh(gridGeo, this.gridFloorMaterial);
    gridFloor.rotation.x = -Math.PI / 2;
    gridFloor.position.y = CONFIG.baseHeight + 0.01;
    this.group.add(gridFloor);

    // Neon border around base
    this.createBaseBorder(size);
  }

  /**
   * Create neon border around the base platform
   */
  private createBaseBorder(size: number): void {
    const hw = size / 2;
    const borderMat = new THREE.LineBasicMaterial({
      color: DATA_CENTER_COLORS.cyan,
      transparent: true,
      opacity: 0.8,
    });

    const borderPoints = [
      new THREE.Vector3(-hw, CONFIG.baseHeight + 0.02, -hw),
      new THREE.Vector3(hw, CONFIG.baseHeight + 0.02, -hw),
      new THREE.Vector3(hw, CONFIG.baseHeight + 0.02, hw),
      new THREE.Vector3(-hw, CONFIG.baseHeight + 0.02, hw),
      new THREE.Vector3(-hw, CONFIG.baseHeight + 0.02, -hw),
    ];

    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderLine = new THREE.Line(borderGeo, borderMat);
    this.group.add(borderLine);
  }

  /**
   * Create 10 server racks (5 north, 5 south rows)
   */
  private createServerRacks(): void {
    this.rackGroup = new THREE.Group();
    this.rackGroup.position.y = CONFIG.baseHeight;
    this.group.add(this.rackGroup);

    const { rack } = CONFIG;
    const racksPerRow = 5;
    const totalWidth = (racksPerRow - 1) * rack.rackSpacing;
    const startX = -totalWidth / 2;

    // Calculate total blades for instanced mesh
    this.bladeCount = racksPerRow * 2 * rack.bladesPerRack;

    // Create instanced mesh for all server blades
    const bladeGeo = new THREE.BoxGeometry(
      rack.width * 0.9,
      rack.bladeHeight,
      rack.depth * 0.8
    );
    const bladeMat = new THREE.MeshStandardMaterial({
      color: DATA_CENTER_COLORS.rackDark,
      metalness: 0.6,
      roughness: 0.4,
      emissive: new THREE.Color(DATA_CENTER_COLORS.cyan),
      emissiveIntensity: 0.1,
    });

    this.serverBlades = new THREE.InstancedMesh(bladeGeo, bladeMat, this.bladeCount);
    this.serverBlades.castShadow = true;
    this.serverBlades.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    let instanceIndex = 0;

    // Create racks in two rows (north and south)
    for (let row = 0; row < 2; row++) {
      const rowZ = row === 0 ? -rack.rowSpacing / 2 : rack.rowSpacing / 2;

      for (let i = 0; i < racksPerRow; i++) {
        const rackX = startX + i * rack.rackSpacing;

        // Create rack frame
        this.createRackFrame(rackX, rowZ);

        // Position blades within rack
        for (let blade = 0; blade < rack.bladesPerRack; blade++) {
          const bladeY = 0.1 + blade * (rack.bladeHeight + rack.bladeGap);
          matrix.setPosition(rackX, bladeY, rowZ);
          this.serverBlades.setMatrixAt(instanceIndex, matrix);
          instanceIndex++;
        }

        // Create LED strip for this rack
        this.createLedStrip(rackX, rowZ);
      }
    }

    this.serverBlades.instanceMatrix.needsUpdate = true;
    this.rackGroup.add(this.serverBlades);
  }

  /**
   * Create a single rack frame
   */
  private createRackFrame(x: number, z: number): void {
    const { rack } = CONFIG;

    // Rack frame (dark metal)
    const frameGeo = new THREE.BoxGeometry(rack.width, rack.height, rack.depth);
    const frameMat = new THREE.MeshStandardMaterial({
      color: DATA_CENTER_COLORS.metalGray,
      metalness: 0.7,
      roughness: 0.3,
      transparent: true,
      opacity: 0.3,
    });

    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(x, rack.height / 2, z);
    this.rackGroup.add(frame);

    // Neon edge at top
    const edgeMat = new THREE.LineBasicMaterial({
      color: DATA_CENTER_COLORS.cyan,
      transparent: true,
      opacity: 0.6,
    });

    const hw = rack.width / 2;
    const hd = rack.depth / 2;
    const edgePoints = [
      new THREE.Vector3(-hw, rack.height, -hd),
      new THREE.Vector3(hw, rack.height, -hd),
      new THREE.Vector3(hw, rack.height, hd),
      new THREE.Vector3(-hw, rack.height, hd),
      new THREE.Vector3(-hw, rack.height, -hd),
    ];

    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edge = new THREE.Line(edgeGeo, edgeMat);
    edge.position.set(x, 0, z);
    this.rackGroup.add(edge);
  }

  /**
   * Create LED strip on the side of a rack
   */
  private createLedStrip(x: number, z: number): void {
    const { rack } = CONFIG;

    const stripGeo = new THREE.PlaneGeometry(0.03, rack.height * 0.9);
    const stripMat = new THREE.MeshBasicMaterial({
      color: DATA_CENTER_COLORS.cyan,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(x + rack.width / 2 + 0.02, rack.height / 2, z);
    strip.rotation.y = Math.PI / 2;

    this.ledStrips.push(strip);
    this.ledMaterials.push(stripMat);
    this.rackGroup.add(strip);
  }

  /**
   * Create 4 corner cooling towers
   */
  private createCoolingTowers(): void {
    const cornerOffset = CONFIG.baseSize / 2 - 0.5;

    const corners = [
      { x: -cornerOffset, z: -cornerOffset },
      { x: cornerOffset, z: -cornerOffset },
      { x: cornerOffset, z: cornerOffset },
      { x: -cornerOffset, z: cornerOffset },
    ];

    for (const corner of corners) {
      this.createCoolingTower(corner.x, corner.z);
    }
  }

  /**
   * Create a single cooling tower
   */
  private createCoolingTower(x: number, z: number): void {
    const { cooling } = CONFIG;
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, CONFIG.baseHeight, z);

    // Tower cylinder body
    const bodyGeo = new THREE.CylinderGeometry(
      cooling.radius,
      cooling.radius * 1.1,
      cooling.height,
      16
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color: DATA_CENTER_COLORS.metalGray,
      metalness: 0.6,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = cooling.height / 2;
    body.castShadow = true;
    towerGroup.add(body);

    // Neon ring at base
    const baseRingGeo = new THREE.TorusGeometry(cooling.radius * 1.1, 0.03, 8, 24);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: DATA_CENTER_COLORS.cyan,
      transparent: true,
      opacity: 0.7,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.05;
    towerGroup.add(baseRing);

    // Fan at top with shader
    const fanGeo = new THREE.PlaneGeometry(cooling.fanRadius * 2, cooling.fanRadius * 2);
    const fanMat = createCoolingFanMaterial();
    const fan = new THREE.Mesh(fanGeo, fanMat);
    fan.rotation.x = -Math.PI / 2;
    fan.position.y = cooling.height + 0.02;
    towerGroup.add(fan);
    this.fanMeshes.push(fan);
    this.fanMaterials.push(fanMat);

    // Neon ring around fan
    const fanRingGeo = new THREE.TorusGeometry(cooling.fanRadius, 0.02, 8, 24);
    const fanRingMat = new THREE.MeshBasicMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0.8,
    });
    const fanRing = new THREE.Mesh(fanRingGeo, fanRingMat);
    fanRing.rotation.x = Math.PI / 2;
    fanRing.position.y = cooling.height + 0.02;
    towerGroup.add(fanRing);
    this.fanRings.push(fanRing);

    // Vapor particles
    this.createVaporSystem(towerGroup, cooling);

    this.coolingTowers.push(towerGroup);
    this.group.add(towerGroup);
  }

  /**
   * Create vapor particle system for cooling tower
   */
  private createVaporSystem(towerGroup: THREE.Group, cooling: typeof CONFIG.cooling): void {
    const particleCount = CONFIG.particles.vaporCount;

    const positions = new Float32Array(particleCount * 3);
    const indices = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Random position within fan area
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * cooling.fanRadius * 0.8;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = cooling.height + 0.1;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      indices[i] = i;
      sizes[i] = 3 + Math.random() * 4;
      phases[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('particleIndex', new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute('particleSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('particlePhase', new THREE.BufferAttribute(phases, 1));

    const material = createVaporMaterial();
    const particles = new THREE.Points(geometry, material);

    towerGroup.add(particles);
    this.vaporSystems.push(particles);
    this.vaporMaterials.push(material);
  }

  /**
   * Create the central holographic core
   */
  private createCentralHologram(): void {
    this.hologramGroup = new THREE.Group();
    this.hologramGroup.position.y = CONFIG.baseHeight;
    this.group.add(this.hologramGroup);

    const { hologram } = CONFIG;

    // Hexagonal pedestal base
    const pedestalGeo = new THREE.CylinderGeometry(
      hologram.pedestalRadius,
      hologram.pedestalRadius * 1.2,
      hologram.pedestalHeight,
      6
    );
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: DATA_CENTER_COLORS.darkMetal,
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(DATA_CENTER_COLORS.cyan),
      emissiveIntensity: 0.1,
    });
    this.pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    this.pedestal.position.y = hologram.pedestalHeight / 2;
    this.hologramGroup.add(this.pedestal);

    // Neon ring on pedestal
    const pedestalRingGeo = new THREE.TorusGeometry(hologram.pedestalRadius * 1.1, 0.02, 8, 6);
    const pedestalRingMat = new THREE.MeshBasicMaterial({
      color: DATA_CENTER_COLORS.cyan,
      transparent: true,
      opacity: 0.8,
    });
    const pedestalRing = new THREE.Mesh(pedestalRingGeo, pedestalRingMat);
    pedestalRing.rotation.x = Math.PI / 2;
    pedestalRing.position.y = hologram.pedestalHeight;
    this.addGlowMesh(pedestalRing);
    this.hologramGroup.add(pedestalRing);

    // Projection beam
    const beamGeo = new THREE.CylinderGeometry(0.02, hologram.pedestalRadius * 0.8, hologram.coreHeight, 16, 1, true);
    this.projectionBeamMaterial = createProjectionBeamMaterial();
    this.projectionBeam = new THREE.Mesh(beamGeo, this.projectionBeamMaterial);
    this.projectionBeam.position.y = hologram.pedestalHeight + hologram.coreHeight / 2;
    this.hologramGroup.add(this.projectionBeam);

    // Holographic core cylinder
    const coreGeo = new THREE.CylinderGeometry(
      hologram.coreRadius,
      hologram.coreRadius,
      hologram.coreHeight * 0.7,
      32,
      1,
      true
    );
    this.hologramMaterial = createHologramMaterial();
    this.hologramCore = new THREE.Mesh(coreGeo, this.hologramMaterial);
    this.hologramCore.position.y = hologram.pedestalHeight + hologram.coreHeight * 0.35 + 0.2;
    this.hologramGroup.add(this.hologramCore);

    // Orbital rings
    this.createOrbitalRings();
  }

  /**
   * Create orbital rings around the hologram core
   * Adjusted radii for larger core (0.8 radius)
   */
  private createOrbitalRings(): void {
    const { hologram } = CONFIG;
    // Orbital rings now positioned outside the larger core
    const ringRadii = [1.0, 1.25, 1.5];
    const ringColors = [DATA_CENTER_COLORS.cyan, DATA_CENTER_COLORS.magenta, DATA_CENTER_COLORS.cyan];

    for (let i = 0; i < hologram.ringCount; i++) {
      const ringGeo = new THREE.TorusGeometry(ringRadii[i], 0.02, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColors[i],
        transparent: true,
        opacity: 0.6,
      });

      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = hologram.pedestalHeight + hologram.coreHeight * 0.5;

      // Different initial rotations
      ring.rotation.x = Math.PI / 4 + i * 0.3;
      ring.rotation.z = i * Math.PI / 3;

      this.orbitalRings.push(ring);
      this.addGlowMesh(ring);
      this.hologramGroup.add(ring);
    }
  }

  /**
   * Create gauge displays for metrics
   * Uses cylindrical geometry for 360-degree visibility
   */
  private createGaugeDisplays(): void {
    const { hologram } = CONFIG;
    const displayY = hologram.pedestalHeight + hologram.coreHeight * 0.35;

    // Gauge cylinder dimensions (open cylinders visible from all angles)
    const gaugeRadius = 0.35;
    const gaugeHeight = 0.5;
    const gaugeSegments = 32;

    // CPU Gauge - inner cylinder orbiting the core
    const cpuGaugeGeo = new THREE.CylinderGeometry(
      gaugeRadius,
      gaugeRadius,
      gaugeHeight,
      gaugeSegments,
      1,
      true  // Open cylinder for transparency
    );
    this.cpuGaugeMaterial = createCylindricalGaugeMaterial();
    this.cpuGauge = new THREE.Mesh(cpuGaugeGeo, this.cpuGaugeMaterial);
    this.cpuGauge.position.set(-hologram.coreRadius - gaugeRadius - 0.15, displayY, 0);
    this.hologramGroup.add(this.cpuGauge);

    // RAM Gauge - second cylinder on the opposite side
    const ramGaugeGeo = new THREE.CylinderGeometry(
      gaugeRadius,
      gaugeRadius,
      gaugeHeight,
      gaugeSegments,
      1,
      true  // Open cylinder for transparency
    );
    this.ramGaugeMaterial = createCylindricalGaugeMaterial();
    this.ramGaugeMaterial.uniforms.uColorLow.value = new THREE.Color(DATA_CENTER_COLORS.green);
    this.ramGaugeMaterial.uniforms.uColorHigh.value = new THREE.Color(DATA_CENTER_COLORS.orange);
    this.ramGauge = new THREE.Mesh(ramGaugeGeo, this.ramGaugeMaterial);
    this.ramGauge.position.set(hologram.coreRadius + gaugeRadius + 0.15, displayY, 0);
    this.hologramGroup.add(this.ramGauge);

    // Temperature bar (back)
    const tempBarGeo = new THREE.PlaneGeometry(0.15, 0.7);
    this.temperatureBarMaterial = createTemperatureBarMaterial();
    this.temperatureBar = new THREE.Mesh(tempBarGeo, this.temperatureBarMaterial);
    this.temperatureBar.position.set(-0.5, displayY + 0.15, -hologram.coreRadius - 0.3);
    this.temperatureBar.rotation.y = Math.PI;
    this.hologramGroup.add(this.temperatureBar);

    // Connection counter display (back right)
    const connGeo = new THREE.PlaneGeometry(0.6, 0.18);
    this.connectionTexture = createDigitalDisplayTexture('0');
    const connMat = new THREE.MeshBasicMaterial({
      map: this.connectionTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.connectionDisplay = new THREE.Mesh(connGeo, connMat);
    this.connectionDisplay.position.set(0.5, displayY + 0.4, -hologram.coreRadius - 0.3);
    this.connectionDisplay.rotation.y = Math.PI;
    this.hologramGroup.add(this.connectionDisplay);

    // Network graph (in front) - adjusted for larger core
    this.createNetworkGraph();
  }

  /**
   * Create network traffic graph
   * Positioned in front of the enlarged hologram core
   */
  private createNetworkGraph(): void {
    const { hologram } = CONFIG;
    const graphWidth = 1.0;  // Wider graph for larger display
    const graphPoints = 20;

    // Initialize graph data
    this.networkGraphPoints = new Array(graphPoints).fill(0.5);

    const points: THREE.Vector3[] = [];
    for (let i = 0; i < graphPoints; i++) {
      const x = -graphWidth / 2 + (i / (graphPoints - 1)) * graphWidth;
      points.push(new THREE.Vector3(x, 0, 0));
    }

    const graphGeo = new THREE.BufferGeometry().setFromPoints(points);
    const graphMat = new THREE.LineBasicMaterial({
      color: DATA_CENTER_COLORS.cyan,
      transparent: true,
      opacity: 0.8,
    });

    this.networkGraph = new THREE.Line(graphGeo, graphMat);
    // Position in front of the larger core
    this.networkGraph.position.set(0, hologram.pedestalHeight + hologram.coreHeight * 0.2, hologram.coreRadius + 0.3);
    this.hologramGroup.add(this.networkGraph);
  }

  /**
   * Create alert beacons at corners
   */
  private createAlertBeacons(): void {
    const { beacon } = CONFIG;
    const offset = CONFIG.baseSize / 2 - 0.3;

    const corners = [
      { x: -offset, z: -offset },
      { x: offset, z: -offset },
      { x: offset, z: offset },
      { x: -offset, z: offset },
    ];

    for (const corner of corners) {
      // Beacon pole
      const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, beacon.height, 8);
      const poleMat = new THREE.MeshStandardMaterial({
        color: DATA_CENTER_COLORS.metalGray,
        metalness: 0.7,
        roughness: 0.3,
      });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(corner.x, CONFIG.baseHeight + beacon.height / 2, corner.z);
      this.group.add(pole);

      // Beacon light
      const lightGeo = new THREE.SphereGeometry(beacon.radius, 16, 16);
      const lightMat = createAlertBeaconMaterial();
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(corner.x, CONFIG.baseHeight + beacon.height + beacon.radius, corner.z);

      this.alertBeacons.push(light);
      this.alertBeaconMaterials.push(lightMat);
      this.addGlowMesh(light);
      this.group.add(light);
    }
  }

  /**
   * Create data flow particle system with binary 0s and 1s
   * Creates a digital data stream effect flowing through the data center
   */
  private createDataFlowParticles(): void {
    const particleCount = CONFIG.particles.dataFlowCount;

    const positions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const binaryIndices = new Float32Array(particleCount);

    // Create particles flowing between racks through center
    for (let i = 0; i < particleCount; i++) {
      // Random position in the data center space
      const t = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1.0;

      positions[i * 3] = Math.cos(angle) * radius * (1 - t * 0.5);
      positions[i * 3 + 1] = CONFIG.baseHeight + 0.3 + Math.random() * 0.8;
      positions[i * 3 + 2] = Math.sin(angle) * radius * (1 - t * 0.5);

      // Color: cyan to magenta gradient
      const color = new THREE.Color().lerpColors(
        new THREE.Color(DATA_CENTER_COLORS.cyan),
        new THREE.Color(DATA_CENTER_COLORS.magenta),
        Math.random()
      );
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;

      // Random binary index (0 or 1) for each particle
      binaryIndices[i] = Math.random() < 0.5 ? 0.0 : 1.0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('particleColor', new THREE.BufferAttribute(particleColors, 3));
    geometry.setAttribute('binaryIndex', new THREE.BufferAttribute(binaryIndices, 1));

    // Create the binary atlas texture and shader material
    this.binaryAtlasTexture = createBinaryAtlasTexture();
    this.binaryParticleMaterial = createBinaryParticleMaterial(this.binaryAtlasTexture);

    this.dataFlowParticles = new THREE.Points(geometry, this.binaryParticleMaterial);
    this.group.add(this.dataFlowParticles);
  }

  // ===========================================================================
  // PUBLIC API - METRICS UPDATES
  // ===========================================================================

  /**
   * Update all metrics at once
   */
  updateMetrics(metrics: Partial<DataCenterMetrics>): void {
    if (metrics.cpuUsage !== undefined) this.targetMetrics.cpuUsage = metrics.cpuUsage;
    if (metrics.ramUsage !== undefined) this.targetMetrics.ramUsage = metrics.ramUsage;
    if (metrics.networkTraffic !== undefined) this.targetMetrics.networkTraffic = metrics.networkTraffic;
    if (metrics.activeConnections !== undefined) this.targetMetrics.activeConnections = metrics.activeConnections;
    if (metrics.temperature !== undefined) this.targetMetrics.temperature = metrics.temperature;
    if (metrics.alertLevel !== undefined) this.targetMetrics.alertLevel = metrics.alertLevel;
  }

  /**
   * Update CPU usage (0-100)
   */
  updateCpuUsage(value: number): void {
    this.targetMetrics.cpuUsage = Math.max(0, Math.min(100, value));
  }

  /**
   * Update RAM usage (0-100)
   */
  updateRamUsage(value: number): void {
    this.targetMetrics.ramUsage = Math.max(0, Math.min(100, value));
  }

  /**
   * Update network traffic (0-100)
   */
  updateNetworkTraffic(value: number): void {
    this.targetMetrics.networkTraffic = Math.max(0, Math.min(100, value));
  }

  /**
   * Update active connections count
   */
  updateActiveConnections(value: number): void {
    this.targetMetrics.activeConnections = Math.max(0, Math.floor(value));
  }

  /**
   * Update temperature (0-100)
   */
  updateTemperature(value: number): void {
    this.targetMetrics.temperature = Math.max(0, Math.min(100, value));
  }

  /**
   * Update alert level
   */
  updateAlertLevel(level: 'normal' | 'warning' | 'critical'): void {
    this.targetMetrics.alertLevel = level;
  }

  // ===========================================================================
  // STATUS & ACTIVITY HANDLERS
  // ===========================================================================

  protected onStatusChange(status: BuildingStatus): void {
    const preset = status === 'offline' ? DATA_CENTER_PRESETS.offline :
                   status === 'critical' ? DATA_CENTER_PRESETS.critical :
                   status === 'warning' ? DATA_CENTER_PRESETS.warning :
                   DATA_CENTER_PRESETS.online;

    // Update hologram
    if (this.hologramMaterial) {
      this.hologramMaterial.uniforms.uOpacity.value = preset.hologramOpacity;
    }

    // Update projection beam
    if (this.projectionBeamMaterial) {
      this.projectionBeamMaterial.uniforms.uOpacity.value = preset.beamOpacity;
    }

    // Update alert beacons
    const alertLevel = status === 'critical' ? 2 : status === 'warning' ? 1 : 0;
    for (const mat of this.alertBeaconMaterials) {
      mat.uniforms.uAlertLevel.value = alertLevel;
      mat.uniforms.uColor.value = new THREE.Color(preset.alertColor);
      mat.uniforms.uIntensity.value = preset.ledIntensity;
    }

    // Update LED strip brightness
    const ledOpacity = status === 'offline' ? 0.1 : 0.8;
    for (const mat of this.ledMaterials) {
      mat.opacity = ledOpacity;
    }

    // Grid floor color change
    if (this.gridFloorMaterial) {
      const gridColor = status === 'critical' ? DATA_CENTER_COLORS.red :
                        status === 'warning' ? DATA_CENTER_COLORS.orange :
                        DATA_CENTER_COLORS.cyan;
      this.gridFloorMaterial.uniforms.uGridColor.value = new THREE.Color(gridColor);
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects animation speeds
    const speedMultiplier = this.getActivitySpeed();

    // Update grid floor pulse speed
    if (this.gridFloorMaterial) {
      this.gridFloorMaterial.uniforms.uPulseSpeed.value = 0.5 * speedMultiplier;
    }
  }

  // ===========================================================================
  // ANIMATION UPDATE
  // ===========================================================================

  override update(deltaTime: number): void {
    super.update(deltaTime);

    this.animTime += deltaTime;

    // Interpolate metrics toward targets
    this.interpolateMetrics(deltaTime);

    // Update all animated components
    this.updateLedStrips();
    this.updateCoolingTowers();
    this.updateHologram();
    this.updateGauges();
    this.updateDataFlow();
    this.updateShaderUniforms();
  }

  /**
   * Smoothly interpolate current metrics toward target values
   */
  private interpolateMetrics(deltaTime: number): void {
    const lerpSpeed = 2.0;
    const t = Math.min(1, lerpSpeed * deltaTime);

    this.currentMetrics.cpuUsage += (this.targetMetrics.cpuUsage - this.currentMetrics.cpuUsage) * t;
    this.currentMetrics.ramUsage += (this.targetMetrics.ramUsage - this.currentMetrics.ramUsage) * t;
    this.currentMetrics.networkTraffic += (this.targetMetrics.networkTraffic - this.currentMetrics.networkTraffic) * t;
    this.currentMetrics.temperature += (this.targetMetrics.temperature - this.currentMetrics.temperature) * t;

    // Instant update for discrete values
    this.currentMetrics.activeConnections = this.targetMetrics.activeConnections;
    this.currentMetrics.alertLevel = this.targetMetrics.alertLevel;
  }

  /**
   * Update LED strip animations
   */
  private updateLedStrips(): void {
    // Wave animation based on CPU usage
    const waveSpeed = 3.0 + this.currentMetrics.cpuUsage * 0.05;

    for (let i = 0; i < this.ledMaterials.length; i++) {
      const mat = this.ledMaterials[i];
      const wave = Math.sin(this.animTime * waveSpeed + i * 0.5) * 0.3 + 0.7;

      // Color shift based on CPU (cyan -> magenta)
      const cpuFactor = this.currentMetrics.cpuUsage / 100;
      const color = new THREE.Color().lerpColors(
        new THREE.Color(DATA_CENTER_COLORS.cyan),
        new THREE.Color(DATA_CENTER_COLORS.magenta),
        cpuFactor
      );

      mat.color = color;
      mat.opacity = wave * 0.8;
    }
  }

  /**
   * Update cooling tower animations
   */
  private updateCoolingTowers(): void {
    const temp = this.currentMetrics.temperature;
    const fanSpeed = 1.0 + temp * 0.04; // Faster when hot

    // Update fan shaders
    for (const mat of this.fanMaterials) {
      mat.uniforms.uTime.value = this.animTime;
      mat.uniforms.uRotationSpeed.value = fanSpeed;
      mat.uniforms.uTemperature.value = temp;
    }

    // Update vapor - synchronize color with temperature
    const vaporDensity = 0.3 + temp * 0.007;
    for (const mat of this.vaporMaterials) {
      mat.uniforms.uTime.value = this.animTime;
      mat.uniforms.uDensity.value = vaporDensity;
      mat.uniforms.uRiseSpeed.value = 0.2 + temp * 0.003;
      mat.uniforms.uTemperature.value = temp;  // Pass temperature for color interpolation
    }

    // Update fan ring color (blue -> orange based on temperature)
    for (const ring of this.fanRings) {
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        const color = new THREE.Color().lerpColors(
          new THREE.Color(0x0066ff),
          new THREE.Color(DATA_CENTER_COLORS.orange),
          temp / 100
        );
        ring.material.color = color;
      }
    }
  }

  /**
   * Update hologram core animations
   */
  private updateHologram(): void {
    // Hologram shader
    if (this.hologramMaterial) {
      this.hologramMaterial.uniforms.uTime.value = this.animTime;
    }

    // Projection beam
    if (this.projectionBeamMaterial) {
      this.projectionBeamMaterial.uniforms.uTime.value = this.animTime;
    }

    // Orbital rings rotation
    for (let i = 0; i < this.orbitalRings.length; i++) {
      const ring = this.orbitalRings[i];
      const speed = 0.3 + i * 0.1;
      ring.rotation.y += speed * 0.016; // Approximate deltaTime
      ring.rotation.x += speed * 0.008 * (i % 2 === 0 ? 1 : -1);
    }

    // Pedestal glow pulse
    if (this.pedestal?.material instanceof THREE.MeshStandardMaterial) {
      const pulse = 0.05 + 0.05 * Math.sin(this.animTime * 2);
      this.pedestal.material.emissiveIntensity = pulse;
    }
  }

  /**
   * Update gauge displays with current metrics
   */
  private updateGauges(): void {
    // CPU gauge
    if (this.cpuGaugeMaterial) {
      this.cpuGaugeMaterial.uniforms.uTime.value = this.animTime;
      this.cpuGaugeMaterial.uniforms.uValue.value = this.currentMetrics.cpuUsage;
    }

    // RAM gauge
    if (this.ramGaugeMaterial) {
      this.ramGaugeMaterial.uniforms.uTime.value = this.animTime;
      this.ramGaugeMaterial.uniforms.uValue.value = this.currentMetrics.ramUsage;
    }

    // Temperature bar
    if (this.temperatureBarMaterial) {
      this.temperatureBarMaterial.uniforms.uTime.value = this.animTime;
      this.temperatureBarMaterial.uniforms.uValue.value = this.currentMetrics.temperature;
    }

    // Connection counter (update texture periodically)
    this.updateConnectionDisplay();

    // Network graph
    this.updateNetworkGraph();
  }

  /**
   * Update connection counter display
   */
  private updateConnectionDisplay(): void {
    // Update every 0.5 seconds to avoid too frequent texture updates
    if (Math.floor(this.animTime * 2) !== Math.floor((this.animTime - 0.016) * 2)) {
      if (this.connectionTexture) {
        this.connectionTexture.dispose();
      }
      this.connectionTexture = createDigitalDisplayTexture(
        this.currentMetrics.activeConnections,
        256,
        64,
        DATA_CENTER_COLORS.cyan
      );
      if (this.connectionDisplay.material instanceof THREE.MeshBasicMaterial) {
        this.connectionDisplay.material.map = this.connectionTexture;
        this.connectionDisplay.material.needsUpdate = true;
      }
    }
  }

  /**
   * Update network traffic graph
   */
  private updateNetworkGraph(): void {
    // Shift graph points and add new value
    this.networkGraphPoints.shift();
    const newValue = this.currentMetrics.networkTraffic / 100 + (Math.random() - 0.5) * 0.1;
    this.networkGraphPoints.push(Math.max(0, Math.min(1, newValue)));

    // Update geometry
    const positions = this.networkGraph.geometry.attributes.position;
    const graphHeight = 0.3;

    for (let i = 0; i < this.networkGraphPoints.length; i++) {
      positions.setY(i, this.networkGraphPoints[i] * graphHeight);
    }
    positions.needsUpdate = true;
  }

  /**
   * Update data flow particle animation (binary 0s and 1s)
   */
  private updateDataFlow(): void {
    if (!this.dataFlowParticles) return;

    const positions = this.dataFlowParticles.geometry.attributes.position;
    const binaryIndices = this.dataFlowParticles.geometry.attributes.binaryIndex;
    const speed = 0.5 + this.currentMetrics.networkTraffic * 0.02;

    for (let i = 0; i < positions.count; i++) {
      // Spiral motion toward center
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);

      const angle = Math.atan2(z, x);
      const radius = Math.sqrt(x * x + z * z);

      // Move toward center with spiral
      const newRadius = radius - speed * 0.01;
      const newAngle = angle + speed * 0.02;

      if (newRadius < 0.2) {
        // Reset particle to outer edge with new random binary digit
        const resetAngle = Math.random() * Math.PI * 2;
        const resetRadius = 1.5 + Math.random() * 1.0;
        x = Math.cos(resetAngle) * resetRadius;
        z = Math.sin(resetAngle) * resetRadius;
        y = CONFIG.baseHeight + 0.3 + Math.random() * 0.8;

        // Randomize the binary digit when particle resets
        binaryIndices.setX(i, Math.random() < 0.5 ? 0.0 : 1.0);
      } else {
        x = Math.cos(newAngle) * newRadius;
        z = Math.sin(newAngle) * newRadius;
        // Slight vertical oscillation
        y += Math.sin(this.animTime * 5 + i * 0.3) * 0.002;
      }

      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
    binaryIndices.needsUpdate = true;

    // Update particle opacity based on network traffic using shader uniform
    if (this.binaryParticleMaterial) {
      this.binaryParticleMaterial.uniforms.uOpacity.value = 0.4 + this.currentMetrics.networkTraffic * 0.006;
    }
  }

  /**
   * Update all shader uniforms that need time
   */
  private updateShaderUniforms(): void {
    // Grid floor
    if (this.gridFloorMaterial) {
      this.gridFloorMaterial.uniforms.uTime.value = this.animTime;
    }

    // Alert beacons
    for (const mat of this.alertBeaconMaterials) {
      mat.uniforms.uTime.value = this.animTime;
    }
  }

  /**
   * Apply all current metrics to visual components
   */
  private updateAllMetrics(metrics: DataCenterMetrics): void {
    this.currentMetrics = { ...metrics };
    this.targetMetrics = { ...metrics };
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  override dispose(): void {
    // Dispose shader materials
    this.gridFloorMaterial?.dispose();
    this.hologramMaterial?.dispose();
    this.projectionBeamMaterial?.dispose();
    this.cpuGaugeMaterial?.dispose();
    this.ramGaugeMaterial?.dispose();
    this.temperatureBarMaterial?.dispose();
    this.binaryParticleMaterial?.dispose();

    for (const mat of this.fanMaterials) mat.dispose();
    for (const mat of this.vaporMaterials) mat.dispose();
    for (const mat of this.alertBeaconMaterials) mat.dispose();
    for (const mat of this.ledMaterials) mat.dispose();

    // Dispose textures
    this.connectionTexture?.dispose();
    this.binaryAtlasTexture?.dispose();

    // Dispose instanced mesh
    this.serverBlades?.dispose();

    super.dispose();
  }
}
