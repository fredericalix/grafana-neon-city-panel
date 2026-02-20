/**
 * FireworkManager - Tron-style neon firework effect for scene identification
 *
 * Creates a spectacular multi-color firework burst to help identify
 * which 3D scene corresponds to which connected viewer in the control center.
 */

import * as THREE from 'three';
import { createLogger } from '../../utils/logger';

const log = createLogger('FireworkManager');

// Tron-style neon colors
const FIREWORK_COLORS = [
  0x00ffff, // Cyan
  0xff00ff, // Magenta
  0xff8800, // Orange
];

// Configuration
const FIREWORK_CONFIG = {
  duration: 5000,           // Total duration in ms
  particlesPerBurst: 150,   // Particles per explosion
  burstCount: 5,            // Number of bursts over duration
  burstInterval: 800,       // Ms between bursts
  maxParticleSpeed: 8,      // Initial velocity
  gravity: 2,               // Downward acceleration
  particleSize: 0.5,        // Base particle size (increased for visibility)
  fadeSpeed: 0.4,           // How fast particles fade
  sparkleFrequency: 0.3,    // Chance of sparkle per frame
};

// Vertex shader for firework particles
const fireworkVertexShader = `
  attribute float size;
  attribute float age;
  attribute vec3 customColor;

  varying float vAge;
  varying vec3 vColor;

  void main() {
    vAge = age;
    vColor = customColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Size attenuation based on distance
    float sizeAttenuation = 500.0 / -mvPosition.z;
    gl_PointSize = max(2.0, size * sizeAttenuation * (1.0 - age * 0.5));

    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader for firework particles with glow
const fireworkFragmentShader = `
  uniform float uTime;

  varying float vAge;
  varying vec3 vColor;

  void main() {
    // Circular particle shape
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Radial gradient for glow
    float glow = 1.0 - dist * 2.0;
    glow = pow(glow, 1.5);

    // Core brightness
    float core = smoothstep(0.3, 0.0, dist);

    // Age-based fade
    float fade = 1.0 - vAge;
    fade = pow(fade, 0.8);

    // Sparkle effect
    float sparkle = sin(uTime * 20.0 + gl_PointCoord.x * 10.0 + gl_PointCoord.y * 10.0) * 0.5 + 0.5;
    sparkle = mix(1.0, sparkle, 0.3);

    // Final color with bloom effect
    vec3 color = vColor * (glow + core * 2.0) * sparkle;
    float alpha = glow * fade;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  age: number;
  maxAge: number;
}

interface FireworkBurst {
  particles: Particle[];
  startTime: number;
}

export class FireworkManager {
  private scene: THREE.Scene;
  private activeBursts: FireworkBurst[] = [];
  private isActive = false;
  private startTime = 0;
  private nextBurstTime = 0;
  private burstCount = 0;

  // Shared geometry and material for all particles
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private points: THREE.Points | null = null;

  // Buffer attributes
  private maxParticles = FIREWORK_CONFIG.particlesPerBurst * FIREWORK_CONFIG.burstCount;
  private positionAttribute: THREE.BufferAttribute;
  private sizeAttribute: THREE.BufferAttribute;
  private ageAttribute: THREE.BufferAttribute;
  private colorAttribute: THREE.BufferAttribute;

  // City center for positioning
  private center: THREE.Vector3 = new THREE.Vector3(0, 5, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create geometry
    this.geometry = new THREE.BufferGeometry();

    // Initialize buffers
    const positions = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);
    const ages = new Float32Array(this.maxParticles);
    const colors = new Float32Array(this.maxParticles * 3);

    this.positionAttribute = new THREE.BufferAttribute(positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);

    this.sizeAttribute = new THREE.BufferAttribute(sizes, 1);
    this.sizeAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('size', this.sizeAttribute);

    this.ageAttribute = new THREE.BufferAttribute(ages, 1);
    this.ageAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('age', this.ageAttribute);

    this.colorAttribute = new THREE.BufferAttribute(colors, 3);
    this.colorAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('customColor', this.colorAttribute);

    // Create material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: fireworkVertexShader,
      fragmentShader: fireworkFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Create points object but don't add to scene yet
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 100; // Render on top

    // Initially no particles
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Set the center position for fireworks (usually city center)
   */
  setCenter(x: number, y: number, z: number): void {
    this.center.set(x, y, z);
    log.log('Firework center set to:', x, y, z);
  }

  /**
   * Trigger the firework effect
   */
  trigger(): void {
    if (this.isActive) {
      log.log('Firework already active, ignoring trigger');
      return;
    }

    log.log('Triggering identification firework effect');

    this.isActive = true;
    this.startTime = performance.now();
    this.nextBurstTime = this.startTime;
    this.burstCount = 0;
    this.activeBursts = [];

    // Add to scene
    if (this.points && !this.points.parent) {
      this.scene.add(this.points);
    }
  }

  /**
   * Create a single burst of particles
   */
  private createBurst(): void {
    const burst: FireworkBurst = {
      particles: [],
      startTime: performance.now(),
    };

    // Random position around center with some variation
    const burstPos = this.center.clone();
    burstPos.x += (Math.random() - 0.5) * 10;
    burstPos.y += Math.random() * 5 + 3; // Between 3-8 units above center
    burstPos.z += (Math.random() - 0.5) * 10;

    // Select random color for this burst
    const colorIndex = Math.floor(Math.random() * FIREWORK_COLORS.length);
    const baseColor = new THREE.Color(FIREWORK_COLORS[colorIndex]);

    for (let i = 0; i < FIREWORK_CONFIG.particlesPerBurst; i++) {
      // Spherical distribution for explosion
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(2 * Math.random() - 1);
      const speed = FIREWORK_CONFIG.maxParticleSpeed * (0.3 + Math.random() * 0.7);

      const velocity = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi) * speed,
        Math.sin(theta) * Math.sin(phi) * speed + 2, // Slight upward bias
        Math.cos(theta) * speed
      );

      // Slight color variation per particle
      const particleColor = baseColor.clone();
      particleColor.r += (Math.random() - 0.5) * 0.2;
      particleColor.g += (Math.random() - 0.5) * 0.2;
      particleColor.b += (Math.random() - 0.5) * 0.2;

      burst.particles.push({
        position: burstPos.clone(),
        velocity,
        color: particleColor,
        size: FIREWORK_CONFIG.particleSize * (0.5 + Math.random()),
        age: 0,
        maxAge: 1.5 + Math.random() * 1.0, // 1.5 to 2.5 seconds
      });
    }

    this.activeBursts.push(burst);
    log.log(`Burst ${this.burstCount + 1}/${FIREWORK_CONFIG.burstCount} created at`, burstPos.toArray());
    this.burstCount++;
  }

  /**
   * Update firework animation
   */
  update(deltaTime: number): void {
    if (!this.isActive) return;

    const now = performance.now();
    const elapsed = now - this.startTime;

    // Check if effect should end
    if (elapsed >= FIREWORK_CONFIG.duration && this.activeBursts.length === 0) {
      this.stop();
      return;
    }

    // Create new bursts at intervals
    if (this.burstCount < FIREWORK_CONFIG.burstCount && now >= this.nextBurstTime) {
      this.createBurst();
      this.nextBurstTime = now + FIREWORK_CONFIG.burstInterval;
    }

    // Update all particles
    for (const burst of this.activeBursts) {
      for (const particle of burst.particles) {
        // Apply velocity
        particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

        // Apply gravity
        particle.velocity.y -= FIREWORK_CONFIG.gravity * deltaTime;

        // Air resistance
        particle.velocity.multiplyScalar(0.98);

        // Age particle
        particle.age += deltaTime / particle.maxAge;
      }

      // Remove dead particles
      burst.particles = burst.particles.filter(p => p.age < 1);
    }

    // Remove empty bursts
    this.activeBursts = this.activeBursts.filter(b => b.particles.length > 0);

    // Update buffers
    this.updateBuffers();

    // Update time uniform
    this.material.uniforms.uTime.value = elapsed / 1000;
  }

  /**
   * Update GPU buffers with current particle state
   */
  private updateBuffers(): void {
    const positions = this.positionAttribute.array as Float32Array;
    const sizes = this.sizeAttribute.array as Float32Array;
    const ages = this.ageAttribute.array as Float32Array;
    const colors = this.colorAttribute.array as Float32Array;

    let particleIndex = 0;

    for (const burst of this.activeBursts) {
      for (const particle of burst.particles) {
        if (particleIndex >= this.maxParticles) break;

        // Position
        positions[particleIndex * 3] = particle.position.x;
        positions[particleIndex * 3 + 1] = particle.position.y;
        positions[particleIndex * 3 + 2] = particle.position.z;

        // Size
        sizes[particleIndex] = particle.size;

        // Age
        ages[particleIndex] = particle.age;

        // Color
        colors[particleIndex * 3] = particle.color.r;
        colors[particleIndex * 3 + 1] = particle.color.g;
        colors[particleIndex * 3 + 2] = particle.color.b;

        particleIndex++;
      }
    }

    // Mark attributes as needing update
    this.positionAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
    this.ageAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;

    // Update draw range
    this.geometry.setDrawRange(0, particleIndex);
  }

  /**
   * Stop the firework effect
   */
  private stop(): void {
    log.log('Firework effect complete');
    this.isActive = false;
    this.activeBursts = [];

    // Remove from scene
    if (this.points && this.points.parent) {
      this.scene.remove(this.points);
    }

    // Clear draw range
    this.geometry.setDrawRange(0, 0);
  }

  /**
   * Check if firework is currently active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.geometry.dispose();
    this.material.dispose();
  }
}
