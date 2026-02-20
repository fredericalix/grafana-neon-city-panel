import * as THREE from 'three';

/**
 * Hologram Shader - Creates a stunning cyberpunk holographic effect
 * Inspired by Blade Runner, Tron Legacy, and Ghost in the Shell
 *
 * Features:
 * - Scanline effect with customizable density
 * - Chromatic aberration for RGB edge separation
 * - Fresnel-based edge glow
 * - Animated flicker and glitch effects
 * - Pulsating inner glow
 */

// Vertex shader - passes position and normals for fresnel calculation
const hologramVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vFresnel;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    // Calculate fresnel for edge glow
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
    vFresnel = 1.0 - abs(dot(viewDirection, vNormal));
    vFresnel = pow(vFresnel, 2.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - creates the holographic effect
const hologramFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  uniform float uScanlineIntensity;
  uniform float uScanlineCount;
  uniform float uFlickerIntensity;
  uniform float uGlitchIntensity;
  uniform float uFresnelPower;
  uniform float uChromaticAberration;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vFresnel;

  // Pseudo-random function
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Noise function for glitch effect
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(rand(vec2(i, 0.0)), rand(vec2(i + 1.0, 0.0)), f);
  }

  void main() {
    // Base color with fresnel edge glow
    vec3 baseColor = uColor;
    vec3 glowColor = uGlowColor;

    // Fresnel edge effect - creates glowing edges
    float fresnel = pow(vFresnel, uFresnelPower);
    vec3 fresnelColor = mix(baseColor, glowColor, fresnel);

    // Scanline effect - horizontal lines scrolling upward
    float scanlineY = vWorldPosition.y * uScanlineCount + uTime * 2.0;
    float scanline = sin(scanlineY * 3.14159) * 0.5 + 0.5;
    scanline = pow(scanline, 8.0); // Sharpen the scanlines
    float scanlineEffect = 1.0 - scanline * uScanlineIntensity;

    // Secondary subtle scanlines (finer detail)
    float fineScanline = sin(vWorldPosition.y * uScanlineCount * 4.0 + uTime * 8.0) * 0.5 + 0.5;
    fineScanline = pow(fineScanline, 4.0) * 0.3;
    scanlineEffect *= (1.0 - fineScanline * uScanlineIntensity * 0.5);

    // Chromatic aberration - RGB color separation
    vec3 chromaticColor = fresnelColor;
    if (uChromaticAberration > 0.0) {
      float aberration = uChromaticAberration * (0.5 + 0.5 * sin(uTime * 3.0));
      float offsetR = fresnel * aberration;
      float offsetB = fresnel * aberration * -1.0;
      chromaticColor.r = mix(fresnelColor.r, glowColor.r, offsetR);
      chromaticColor.b = mix(fresnelColor.b, glowColor.b * 0.7, -offsetB);
    }

    // Flicker effect - random intensity variation
    float flicker = 1.0;
    if (uFlickerIntensity > 0.0) {
      float flickerNoise = noise(uTime * 15.0);
      float fastFlicker = rand(vec2(floor(uTime * 60.0), 0.0));
      flicker = 1.0 - uFlickerIntensity * (flickerNoise * 0.3 + fastFlicker * 0.1);

      // Occasional strong flicker
      float strongFlicker = step(0.97, rand(vec2(floor(uTime * 8.0), 0.0)));
      flicker *= 1.0 - strongFlicker * 0.4;
    }

    // Glitch effect - horizontal displacement bands
    float glitchBand = 0.0;
    if (uGlitchIntensity > 0.0) {
      float glitchTime = floor(uTime * 4.0);
      float glitchTrigger = step(0.92, rand(vec2(glitchTime, 0.0)));
      if (glitchTrigger > 0.5) {
        float bandY = rand(vec2(glitchTime, 1.0));
        float bandHeight = rand(vec2(glitchTime, 2.0)) * 0.1 + 0.02;
        float inBand = step(bandY - bandHeight * 0.5, vUv.y) *
                       step(vUv.y, bandY + bandHeight * 0.5);
        glitchBand = inBand * uGlitchIntensity;
      }
    }

    // Pulsing inner glow
    float pulse = 0.8 + 0.2 * sin(uTime * 2.5);
    float innerGlow = (1.0 - fresnel) * 0.3 * pulse;

    // Combine all effects
    vec3 finalColor = chromaticColor * scanlineEffect * flicker;
    finalColor += glowColor * innerGlow;
    finalColor += glowColor * glitchBand;

    // Add bright edge highlight
    float edgeHighlight = pow(fresnel, 4.0) * 0.8;
    finalColor += glowColor * edgeHighlight;

    // Calculate final opacity with fresnel boost at edges
    float finalOpacity = uOpacity * flicker;
    finalOpacity += fresnel * 0.3; // Brighter edges
    finalOpacity = clamp(finalOpacity, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, finalOpacity);
  }
`;

/**
 * Create a holographic shader material
 */
export function createHologramMaterial(options: {
  color?: THREE.Color | number;
  glowColor?: THREE.Color | number;
  opacity?: number;
  scanlineIntensity?: number;
  scanlineCount?: number;
  flickerIntensity?: number;
  glitchIntensity?: number;
  fresnelPower?: number;
  chromaticAberration?: number;
} = {}): THREE.ShaderMaterial {
  const {
    color = 0x00ffff,
    glowColor = 0xff00ff,
    opacity = 0.6,
    scanlineIntensity = 0.25,
    scanlineCount = 80.0,
    flickerIntensity = 0.15,
    glitchIntensity = 0.1,
    fresnelPower = 2.0,
    chromaticAberration = 0.3,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uOpacity: { value: opacity },
      uScanlineIntensity: { value: scanlineIntensity },
      uScanlineCount: { value: scanlineCount },
      uFlickerIntensity: { value: flickerIntensity },
      uGlitchIntensity: { value: glitchIntensity },
      uFresnelPower: { value: fresnelPower },
      uChromaticAberration: { value: chromaticAberration },
    },
    vertexShader: hologramVertexShader,
    fragmentShader: hologramFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Update hologram material time uniform
 */
export function updateHologramMaterial(material: THREE.ShaderMaterial, time: number): void {
  if (material.uniforms.uTime) {
    material.uniforms.uTime.value = time;
  }
}

/**
 * Hologram color presets for different moods
 */
export const HOLOGRAM_PRESETS = {
  // Blade Runner pink dancer
  dancer: {
    color: 0xff66cc,
    glowColor: 0xff00ff,
    opacity: 0.55,
    scanlineIntensity: 0.2,
    scanlineCount: 60.0,
    flickerIntensity: 0.12,
    glitchIntensity: 0.08,
    fresnelPower: 1.8,
    chromaticAberration: 0.4,
  },
  // Tron cyan data
  data: {
    color: 0x00ffff,
    glowColor: 0x00aaff,
    opacity: 0.5,
    scanlineIntensity: 0.3,
    scanlineCount: 100.0,
    flickerIntensity: 0.1,
    glitchIntensity: 0.15,
    fresnelPower: 2.5,
    chromaticAberration: 0.2,
  },
  // Warning orange
  warning: {
    color: 0xff8800,
    glowColor: 0xff4400,
    opacity: 0.6,
    scanlineIntensity: 0.4,
    scanlineCount: 50.0,
    flickerIntensity: 0.25,
    glitchIntensity: 0.2,
    fresnelPower: 2.0,
    chromaticAberration: 0.5,
  },
  // Ghost in the Shell green
  ghost: {
    color: 0x00ff88,
    glowColor: 0x00ffaa,
    opacity: 0.45,
    scanlineIntensity: 0.35,
    scanlineCount: 120.0,
    flickerIntensity: 0.08,
    glitchIntensity: 0.05,
    fresnelPower: 3.0,
    chromaticAberration: 0.25,
  },
  // Cute rabbit - soft cyan/white kawaii style
  rabbit: {
    color: 0x88ffff,
    glowColor: 0xaaffff,
    opacity: 0.6,
    scanlineIntensity: 0.15,
    scanlineCount: 40.0,
    flickerIntensity: 0.06,
    glitchIntensity: 0.03,
    fresnelPower: 1.6,
    chromaticAberration: 0.2,
  },
};
