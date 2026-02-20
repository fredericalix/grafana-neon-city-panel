import * as THREE from 'three';

/**
 * Pyramid Beam Shader - Creates a volumetric light beam effect
 * Inspired by the iconic light projectors from Blade Runner and Tron Legacy
 *
 * Features:
 * - Volumetric light cone with soft falloff
 * - Animated scanlines traveling upward
 * - Edge glow for depth
 * - Subtle pulsation and flicker
 * - Noise-based atmospheric distortion
 */

// Vertex shader - passes UV and position data
const pyramidBeamVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vPosition = position;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - creates the volumetric beam effect
const pyramidBeamFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uPulseSpeed;
  uniform float uScanlineSpeed;
  uniform float uScanlineDensity;
  uniform float uNoiseStrength;
  uniform float uEdgeGlowStrength;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  // Pseudo-random function
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Simple noise function
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // Height-based fade: bright at base, transparent at top
    float heightFade = 1.0 - vUv.y;
    heightFade = pow(heightFade, 1.8);

    // Edge fade: brighter in center of the cone
    float edgeFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
    edgeFade = pow(edgeFade, 0.6);

    // Primary scanlines - moving upward
    float scanlineY = vUv.y * uScanlineDensity - uTime * uScanlineSpeed;
    float scanline = sin(scanlineY * 6.28318) * 0.5 + 0.5;
    scanline = pow(scanline, 6.0);

    // Secondary finer scanlines for depth
    float fineScanline = sin(vUv.y * uScanlineDensity * 3.0 - uTime * uScanlineSpeed * 1.5) * 0.5 + 0.5;
    fineScanline = pow(fineScanline, 8.0) * 0.4;

    // Atmospheric noise distortion
    vec2 noiseCoord = vec2(vUv.x * 4.0, vUv.y * 8.0 + uTime * 0.5);
    float atmosphericNoise = noise(noiseCoord) * uNoiseStrength;

    // Subtle pulse effect
    float pulse = 0.85 + 0.15 * sin(uTime * uPulseSpeed);

    // Subtle flicker (random intensity variation)
    float flicker = 0.95 + 0.05 * rand(vec2(floor(uTime * 30.0), 0.0));

    // Edge glow effect
    float edgeGlow = (1.0 - edgeFade) * uEdgeGlowStrength * heightFade;

    // Combine all effects for final alpha
    float alpha = heightFade * edgeFade * uOpacity * pulse * flicker;
    alpha += scanline * 0.15 * heightFade * edgeFade;
    alpha += fineScanline * heightFade * edgeFade;
    alpha += atmosphericNoise * heightFade * 0.5;

    // Calculate final color with intensity and edge glow
    vec3 finalColor = uColor * uIntensity;
    finalColor += uColor * edgeGlow;

    // Add subtle color variation based on height
    float colorShift = heightFade * 0.1;
    finalColor.g += colorShift * 0.2;
    finalColor.b -= colorShift * 0.1;

    // Bright core line effect
    float coreLine = smoothstep(0.45, 0.5, vUv.x) * smoothstep(0.55, 0.5, vUv.x);
    coreLine = pow(coreLine, 0.5);
    finalColor += uColor * coreLine * 0.3 * heightFade;

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

/**
 * Shader configuration object following project pattern
 */
export const PyramidBeamShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x00ffff) },
    uOpacity: { value: 0.5 },
    uIntensity: { value: 1.2 },
    uPulseSpeed: { value: 1.5 },
    uScanlineSpeed: { value: 2.0 },
    uScanlineDensity: { value: 60.0 },
    uNoiseStrength: { value: 0.08 },
    uEdgeGlowStrength: { value: 0.4 },
  },
  vertexShader: pyramidBeamVertexShader,
  fragmentShader: pyramidBeamFragmentShader,
};

/**
 * Create a pyramid beam shader material with custom options
 */
export function createPyramidBeamMaterial(options: {
  color?: THREE.Color | number;
  opacity?: number;
  intensity?: number;
  pulseSpeed?: number;
  scanlineSpeed?: number;
  scanlineDensity?: number;
  noiseStrength?: number;
  edgeGlowStrength?: number;
} = {}): THREE.ShaderMaterial {
  const {
    color = 0x00ffff,
    opacity = 0.5,
    intensity = 1.2,
    pulseSpeed = 1.5,
    scanlineSpeed = 2.0,
    scanlineDensity = 60.0,
    noiseStrength = 0.08,
    edgeGlowStrength = 0.4,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uIntensity: { value: intensity },
      uPulseSpeed: { value: pulseSpeed },
      uScanlineSpeed: { value: scanlineSpeed },
      uScanlineDensity: { value: scanlineDensity },
      uNoiseStrength: { value: noiseStrength },
      uEdgeGlowStrength: { value: edgeGlowStrength },
    },
    vertexShader: pyramidBeamVertexShader,
    fragmentShader: pyramidBeamFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Update pyramid beam material time uniform
 */
export function updatePyramidBeamMaterial(material: THREE.ShaderMaterial, time: number): void {
  if (material.uniforms.uTime) {
    material.uniforms.uTime.value = time;
  }
}

/**
 * Beam color presets for different states
 */
export const BEAM_PRESETS = {
  // Default cyan - Tron Legacy style
  online: {
    color: 0x00ffff,
    opacity: 0.5,
    intensity: 1.2,
    pulseSpeed: 1.5,
    scanlineSpeed: 2.0,
    scanlineDensity: 60.0,
    noiseStrength: 0.08,
    edgeGlowStrength: 0.4,
  },
  // Warning orange
  warning: {
    color: 0xffaa00,
    opacity: 0.6,
    intensity: 1.4,
    pulseSpeed: 2.5,
    scanlineSpeed: 3.0,
    scanlineDensity: 50.0,
    noiseStrength: 0.12,
    edgeGlowStrength: 0.5,
  },
  // Critical red - pulsing alert
  critical: {
    color: 0xff4444,
    opacity: 0.7,
    intensity: 1.6,
    pulseSpeed: 5.0,
    scanlineSpeed: 4.0,
    scanlineDensity: 40.0,
    noiseStrength: 0.15,
    edgeGlowStrength: 0.6,
  },
  // Data stream - Ghost in the Shell style
  dataStream: {
    color: 0x00ff88,
    opacity: 0.45,
    intensity: 1.3,
    pulseSpeed: 1.0,
    scanlineSpeed: 5.0,
    scanlineDensity: 100.0,
    noiseStrength: 0.05,
    edgeGlowStrength: 0.3,
  },
};
