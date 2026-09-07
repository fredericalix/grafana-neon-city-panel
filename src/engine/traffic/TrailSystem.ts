/**
 * TrailSystem - Neon light trail rendering with shader-based fade
 *
 * Creates Tron-style light trails behind vehicles.
 * Uses a ribbon geometry with custom shader for smooth fade effect.
 */

import * as THREE from 'three';
import { TRAIL_CONFIG, TRAFFIC_COLORS } from './TrafficConfig';

// Vertex shader for trail
const trailVertexShader = `
  attribute float age;
  varying float vAge;
  varying vec2 vUv;

  void main() {
    vAge = age;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader for trail with glow fade
const trailFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAge;
  varying vec2 vUv;

  void main() {
    // Fade based on age (0 = oldest, 1 = newest)
    float fade = 1.0 - vAge;
    fade = pow(fade, 1.5); // Ease-out curve for smoother fade

    // Edge glow effect - brighter in center
    float edgeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
    edgeFade = pow(edgeFade, 0.5);

    // Leading edge glow
    float leadingGlow = smoothstep(0.7, 1.0, fade) * 0.5;

    // Final color with glow
    vec3 finalColor = uColor * (1.0 + leadingGlow);
    float alpha = uOpacity * fade * edgeFade;

    // Discard very faded fragments
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface TrailPoint {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  age: number; // 0 = newest, increases over time
}

export interface TrailOptions {
  color?: number;
  width?: number;
  maxPoints?: number;
  opacity?: number;
}

export class TrailSystem {
  // Fixed-size ring buffer of preallocated points: index 0 is the newest point,
  // older points follow at increasing logical indices (see pointAt)
  private readonly points: TrailPoint[];
  private head = -1; // physical index of the newest point
  private count = 0;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  private maxPoints: number;
  private trailWidth: number;
  private color: THREE.Color;
  private opacity: number;

  private positionAttribute: THREE.BufferAttribute;
  private ageAttribute: THREE.BufferAttribute;
  private uvAttribute: THREE.BufferAttribute;

  private active = true;

  // Reused temps for rebuildGeometry (called every frame while a trail is visible)
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly perpendicular = new THREE.Vector3();

  constructor(color: number = TRAFFIC_COLORS.lightCycle.trail, options: TrailOptions = {}) {
    this.maxPoints = options.maxPoints ?? TRAIL_CONFIG.maxPoints;
    this.trailWidth = options.width ?? TRAIL_CONFIG.width;
    this.color = new THREE.Color(color);
    this.opacity = options.opacity ?? 0.9;

    this.points = Array.from({ length: this.maxPoints }, () => ({
      position: new THREE.Vector3(),
      direction: new THREE.Vector3(0, 0, 1),
      age: 0,
    }));

    // Create geometry with max capacity
    this.geometry = new THREE.BufferGeometry();

    // Each point creates 2 vertices (left and right of ribbon)
    const maxVertices = this.maxPoints * 2;
    const maxTriangles = (this.maxPoints - 1) * 2;

    // Position buffer (3 floats per vertex)
    const positions = new Float32Array(maxVertices * 3);
    this.positionAttribute = new THREE.BufferAttribute(positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);

    // Age buffer (1 float per vertex)
    const ages = new Float32Array(maxVertices);
    this.ageAttribute = new THREE.BufferAttribute(ages, 1);
    this.ageAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('age', this.ageAttribute);

    // UV buffer (2 floats per vertex)
    const uvs = new Float32Array(maxVertices * 2);
    this.uvAttribute = new THREE.BufferAttribute(uvs, 2);
    this.uvAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('uv', this.uvAttribute);

    // Index buffer for triangles
    const indices = new Uint16Array(maxTriangles * 3);
    for (let i = 0; i < this.maxPoints - 1; i++) {
      const baseVertex = i * 2;
      const baseIndex = i * 6;

      // First triangle
      indices[baseIndex + 0] = baseVertex + 0;
      indices[baseIndex + 1] = baseVertex + 1;
      indices[baseIndex + 2] = baseVertex + 2;

      // Second triangle
      indices[baseIndex + 3] = baseVertex + 1;
      indices[baseIndex + 4] = baseVertex + 3;
      indices[baseIndex + 5] = baseVertex + 2;
    }
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.color },
        uOpacity: { value: this.opacity },
      },
      vertexShader: trailVertexShader,
      fragmentShader: trailFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; // Render after buildings

    // Initially hide until we have points
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Get the trail mesh to add to scene
   */
  getObject(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Add a new point to the trail
   */
  addPoint(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (!this.active) {return;}

    // Advance the ring buffer and overwrite the oldest slot in place —
    // no Vector3 clones or array shifts in the render loop
    this.head = (this.head + 1) % this.maxPoints;
    const point = this.points[this.head];
    point.position.copy(position);
    point.direction.copy(direction).normalize();
    point.age = 0;
    if (this.count < this.maxPoints) {
      this.count++;
    }
  }

  /**
   * Point at logical index i (0 = newest), resolving the ring buffer offset
   */
  private pointAt(i: number): TrailPoint {
    return this.points[(this.head - i + this.maxPoints) % this.maxPoints];
  }

  /**
   * Update trail animation (age points and rebuild geometry)
   */
  update(deltaTime: number): void {
    if (this.count === 0) {return;}

    // Age all points
    const ageIncrement = deltaTime * TRAIL_CONFIG.fadeSpeed;
    for (let i = 0; i < this.count; i++) {
      this.pointAt(i).age += ageIncrement;
    }

    // Remove fully faded points (always the oldest, i.e. the logical tail)
    while (this.count > 0 && this.pointAt(this.count - 1).age >= 1) {
      this.count--;
    }

    if (this.count === 0) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // Ages changed above, so the GPU buffers must be re-uploaded every frame —
    // otherwise the fade of an inactive (no new points) trail freezes between pops
    this.rebuildGeometry();
  }

  /**
   * Rebuild the trail geometry from current points
   */
  private rebuildGeometry(): void {
    const positions = this.positionAttribute.array as Float32Array;
    const ages = this.ageAttribute.array as Float32Array;
    const uvs = this.uvAttribute.array as Float32Array;

    const { up, perpendicular } = this;
    // Denominator so UV x spans the full 0-1 range (guarding single-point trails)
    const uvSpan = Math.max(1, this.count - 1);

    for (let i = 0; i < this.count; i++) {
      const point = this.pointAt(i);
      const vertexIndex = i * 2;

      // Calculate perpendicular direction for ribbon width
      perpendicular.crossVectors(point.direction, up).normalize();
      if (perpendicular.length() < 0.001) {
        perpendicular.set(1, 0, 0);
      }

      // Left vertex
      const leftX = point.position.x - perpendicular.x * this.trailWidth;
      const leftY = point.position.y;
      const leftZ = point.position.z - perpendicular.z * this.trailWidth;

      positions[vertexIndex * 3 + 0] = leftX;
      positions[vertexIndex * 3 + 1] = leftY;
      positions[vertexIndex * 3 + 2] = leftZ;
      ages[vertexIndex] = point.age;
      uvs[vertexIndex * 2 + 0] = i / uvSpan;
      uvs[vertexIndex * 2 + 1] = 0;

      // Right vertex
      const rightX = point.position.x + perpendicular.x * this.trailWidth;
      const rightY = point.position.y;
      const rightZ = point.position.z + perpendicular.z * this.trailWidth;

      positions[(vertexIndex + 1) * 3 + 0] = rightX;
      positions[(vertexIndex + 1) * 3 + 1] = rightY;
      positions[(vertexIndex + 1) * 3 + 2] = rightZ;
      ages[vertexIndex + 1] = point.age;
      uvs[(vertexIndex + 1) * 2 + 0] = i / uvSpan;
      uvs[(vertexIndex + 1) * 2 + 1] = 1;
    }

    // Mark attributes as needing update
    this.positionAttribute.needsUpdate = true;
    this.ageAttribute.needsUpdate = true;
    this.uvAttribute.needsUpdate = true;

    // Update draw range
    const numTriangles = Math.max(0, (this.count - 1) * 2);
    this.geometry.setDrawRange(0, numTriangles * 3);
  }

  /**
   * Set trail color
   */
  setColor(color: number): void {
    this.color.set(color);
    this.material.uniforms.uColor.value = this.color;
  }

  /**
   * Clear all trail points
   */
  clear(): void {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Set active state (stops adding new points when inactive)
   */
  setActive(active: boolean): void {
    this.active = active;
  }

  /**
   * Check if trail is empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
