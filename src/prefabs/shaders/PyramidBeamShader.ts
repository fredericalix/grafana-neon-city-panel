import * as THREE from 'three';

/**
 * Pyramid Beam Shader - Volumetric light beam effect
 * Inspired by Blade Runner and Tron Legacy
 * Ported from whooktown/threejs-scene
 */

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

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

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
    float heightFade = 1.0 - vUv.y;
    heightFade = pow(heightFade, 1.8);

    float edgeFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
    edgeFade = pow(edgeFade, 0.6);

    float scanlineY = vUv.y * uScanlineDensity - uTime * uScanlineSpeed;
    float scanline = sin(scanlineY * 6.28318) * 0.5 + 0.5;
    scanline = pow(scanline, 6.0);

    float fineScanline = sin(vUv.y * uScanlineDensity * 3.0 - uTime * uScanlineSpeed * 1.5) * 0.5 + 0.5;
    fineScanline = pow(fineScanline, 8.0) * 0.4;

    vec2 noiseCoord = vec2(vUv.x * 4.0, vUv.y * 8.0 + uTime * 0.5);
    float atmosphericNoise = noise(noiseCoord) * uNoiseStrength;

    float pulse = 0.85 + 0.15 * sin(uTime * uPulseSpeed);
    float flicker = 0.95 + 0.05 * rand(vec2(floor(uTime * 30.0), 0.0));
    float edgeGlow = (1.0 - edgeFade) * uEdgeGlowStrength * heightFade;

    float alpha = heightFade * edgeFade * uOpacity * pulse * flicker;
    alpha += scanline * 0.15 * heightFade * edgeFade;
    alpha += fineScanline * heightFade * edgeFade;
    alpha += atmosphericNoise * heightFade * 0.5;

    vec3 finalColor = uColor * uIntensity;
    finalColor += uColor * edgeGlow;

    float colorShift = heightFade * 0.1;
    finalColor.g += colorShift * 0.2;
    finalColor.b -= colorShift * 0.1;

    float coreLine = smoothstep(0.45, 0.5, vUv.x) * smoothstep(0.55, 0.5, vUv.x);
    coreLine = pow(coreLine, 0.5);
    finalColor += uColor * coreLine * 0.3 * heightFade;

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

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

export const BEAM_PRESETS = {
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
};
