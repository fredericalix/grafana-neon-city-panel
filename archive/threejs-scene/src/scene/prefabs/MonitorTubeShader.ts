import * as THREE from 'three';

/**
 * Monitor Tube Shader Collection
 *
 * Shaders for the MonitorTube prefab - a cylindrical structure with 3-7 horizontal
 * ring bands that display gauge values (0-100%). Designed with Tron-style neon
 * aesthetics and cyberpunk visual language.
 *
 * Features:
 * - Ring Band Gauge Shader: Circular gauges that fill 0-360 degrees
 * - Hologram Core Shader: Central cylinder with scanlines and flicker
 * - Halo Pulse Shader: Glowing ring at the base with activity-based pulsing
 * - Grid Floor Shader: Animated neon grid with pulse waves
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const MONITOR_TUBE_COLORS = {
  cyan: 0x00ffff,
  magenta: 0xff00ff,
  orange: 0xffaa00,
  yellow: 0xffdd00,      // Warm yellow/gold for normal mode
  green: 0x00ff88,
  red: 0xff4444,
  darkMetal: 0x0a0a12,
  metalGray: 0x1a1a2e,
};

// =============================================================================
// RING BAND GAUGE SHADER
// Circular gauge that fills from 0 to 360 degrees based on uValue (0-100)
// =============================================================================

const ringBandVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringBandFragmentShader = `
  uniform float uTime;
  uniform float uValue;           // 0-100 fill percentage
  uniform vec3 uColorLow;         // Color at 0% (cyan)
  uniform vec3 uColorMid;         // Color at 50% (green)
  uniform vec3 uColorHigh;        // Color at 100% (red)
  uniform float uGlowStrength;    // Edge glow intensity
  uniform float uRotationOffset;  // Rotation animation offset
  uniform float uScanlineIntensity; // Scanline effect strength

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  // Pseudo-random function
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // On a cylinder, UV.x wraps around (0-1 = full 360 degree circumference)
    // Add rotation offset for animation
    float angle = fract(vUv.x + uRotationOffset);

    // Fill based on value (0-100 maps to 0-1 of the circumference)
    float fillAngle = uValue / 100.0;
    float fill = step(angle, fillAngle);

    // Color gradient based on value (three-way blend)
    vec3 color;
    float normalizedValue = uValue / 100.0;
    if (normalizedValue < 0.5) {
      // Low to mid (cyan to green)
      color = mix(uColorLow, uColorMid, normalizedValue * 2.0);
    } else {
      // Mid to high (green to red)
      color = mix(uColorMid, uColorHigh, (normalizedValue - 0.5) * 2.0);
    }

    // Glowing edge at fill boundary
    float edgeWidth = 0.04;
    float edgeGlow = smoothstep(fillAngle - edgeWidth, fillAngle, angle);
    edgeGlow *= smoothstep(fillAngle + edgeWidth, fillAngle, angle);
    edgeGlow *= fill;

    // Add bright leading edge pulse
    float leadingEdgePulse = edgeGlow * (0.8 + 0.4 * sin(uTime * 8.0));

    // Scanlines for Tron aesthetic (horizontal bands)
    float scanlineFreq = 30.0;
    float scanline = sin(vUv.y * scanlineFreq * PI + uTime * 2.0);
    scanline = scanline * 0.5 + 0.5;
    scanline = pow(scanline, 4.0);
    float scanlineEffect = 1.0 - scanline * uScanlineIntensity;

    // Vertical scanlines (radial from center)
    float radialScanline = sin(angle * 60.0 * PI);
    radialScanline = radialScanline * 0.5 + 0.5;
    radialScanline = pow(radialScanline, 6.0) * 0.15;

    // Pulse animation
    float pulse = 0.85 + 0.15 * sin(uTime * 3.0);

    // Tick marks around the gauge (every 10%)
    float tickCount = 10.0;
    float tick = step(0.97, fract(angle * tickCount));
    tick *= 0.5;

    // Background track (dark with subtle glow)
    vec3 trackColor = vec3(0.08, 0.08, 0.12);
    vec3 trackGlow = color * 0.1;

    // Combine filled and unfilled regions
    vec3 filledColor = color * pulse * scanlineEffect;
    filledColor += color * radialScanline * fill;
    vec3 finalColor = mix(trackColor + trackGlow, filledColor, fill);

    // Add leading edge glow
    finalColor += color * leadingEdgePulse * uGlowStrength * 2.0;

    // Add tick marks
    finalColor += vec3(0.4) * tick;

    // Fresnel edge highlighting
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    finalColor += color * fresnel * 0.25 * fill;

    // Calculate alpha
    float alpha = 0.4 + fill * 0.5 + leadingEdgePulse * 0.3 + tick * 0.2;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createRingBandMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uValue: { value: 50 },
      uColorLow: { value: new THREE.Color(MONITOR_TUBE_COLORS.cyan) },
      uColorMid: { value: new THREE.Color(MONITOR_TUBE_COLORS.green) },
      uColorHigh: { value: new THREE.Color(MONITOR_TUBE_COLORS.red) },
      uGlowStrength: { value: 0.6 },
      uRotationOffset: { value: 0 },
      uScanlineIntensity: { value: 0.3 },
    },
    vertexShader: ringBandVertexShader,
    fragmentShader: ringBandFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// HOLOGRAM CORE SHADER
// Central cylinder with scanlines, flicker, and Fresnel edge glow
// =============================================================================

const monitorHologramVertexShader = `
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

const monitorHologramFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uScanlineSpeed;
  uniform float uScanlineDensity;
  uniform float uFlickerIntensity;
  uniform float uActivityLevel; // 0-1
  // CRT distortion effects
  uniform float uCrtDistortion;      // 0-1 distortion amount
  uniform float uNoiseIntensity;     // 0-1 noise/static amount
  uniform float uChromaticAberration; // chromatic aberration offset

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vFresnel;

  #define PI 3.14159265359

  // Pseudo-random function
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Simple noise
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(rand(vec2(i, 0.0)), rand(vec2(i + 1.0, 0.0)), smoothstep(0.0, 1.0, f));
  }

  // 2D noise for CRT static
  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;

    // CRT horizontal distortion (wavy lines like old TV)
    if (uCrtDistortion > 0.0) {
      // Rolling band distortion
      float rollBand = sin(vWorldPosition.y * 2.0 - uTime * 3.0) * 0.5 + 0.5;
      rollBand = pow(rollBand, 8.0);
      float distortAmount = rollBand * uCrtDistortion * 0.1;

      // Random horizontal jitter (like tracking errors)
      float jitter = rand(vec2(floor(vWorldPosition.y * 30.0), floor(uTime * 15.0)));
      jitter = step(0.92, jitter) * (rand(vec2(uTime, vWorldPosition.y)) - 0.5) * uCrtDistortion * 0.15;

      // Apply horizontal displacement
      uv.x += distortAmount + jitter;

      // Vertical sync issues (occasional frame tear)
      float tearLine = step(0.97, rand(vec2(floor(uTime * 8.0), 0.0)));
      float tearY = rand(vec2(floor(uTime * 8.0), 1.0));
      if (tearLine > 0.5 && abs(vUv.y - tearY) < 0.02) {
        uv.x += 0.1 * uCrtDistortion;
      }
    }

    // Moving scanlines (vertical movement) - thicker when distorted
    float scanlineDensityMod = uScanlineDensity * (1.0 - uCrtDistortion * 0.3);
    float scanlineY = vWorldPosition.y * scanlineDensityMod - uTime * uScanlineSpeed;
    float scanline = sin(scanlineY * PI);
    scanline = scanline * 0.5 + 0.5;
    // Make scanlines more visible and less clean when CRT distortion is on
    float scanlinePow = mix(6.0, 2.0, uCrtDistortion);
    scanline = pow(scanline, scanlinePow);
    float scanlineEffect = 0.7 + 0.3 * (1.0 - scanline * (0.5 + uCrtDistortion * 0.3));

    // Secondary finer scanlines - more prominent with CRT
    float fineScanline = sin(vWorldPosition.y * scanlineDensityMod * 3.0 - uTime * uScanlineSpeed * 2.0);
    fineScanline = fineScanline * 0.5 + 0.5;
    fineScanline = pow(fineScanline, 4.0) * (0.2 + uCrtDistortion * 0.2);

    // Flicker effect - more erratic with CRT
    float flicker = 1.0;
    float flickerMod = uFlickerIntensity + uCrtDistortion * 0.2;
    if (flickerMod > 0.0) {
      float flickerNoise = noise(uTime * 20.0);
      float fastFlicker = rand(vec2(floor(uTime * 60.0), 0.0));
      flicker = 1.0 - flickerMod * (flickerNoise * 0.3 + fastFlicker * 0.15);

      // Occasional strong flicker - more frequent with CRT
      float flickerThreshold = 0.96 - uCrtDistortion * 0.1;
      float strongFlicker = step(flickerThreshold, rand(vec2(floor(uTime * 10.0), 0.0)));
      flicker *= 1.0 - strongFlicker * (0.3 + uCrtDistortion * 0.2);
    }

    // CRT noise/static effect
    float staticNoise = 0.0;
    if (uNoiseIntensity > 0.0) {
      // Fine grain static
      float fineStatic = noise2D(vWorldPosition.xy * 200.0 + uTime * 100.0);
      // Coarse static bands
      float coarseStatic = noise2D(vec2(vWorldPosition.y * 50.0, uTime * 30.0));
      staticNoise = mix(fineStatic, coarseStatic, 0.3) * uNoiseIntensity;
    }

    // Activity-based intensity boost
    float activityBoost = 1.0 + uActivityLevel * 0.5;

    // Fresnel edge glow
    float fresnel = pow(vFresnel, 1.5);
    vec3 edgeGlow = uColor * fresnel * 0.8;

    // Inner pulsing glow based on activity
    float innerPulse = 0.5 + 0.5 * sin(uTime * 3.0 + uActivityLevel * 4.0);
    float innerGlow = (1.0 - fresnel) * 0.2 * innerPulse * activityBoost;

    // Data stream effect (vertical bands of brighter areas)
    float dataStream = sin(uv.x * 20.0 + uTime * 2.0) * 0.5 + 0.5;
    dataStream = pow(dataStream, 8.0) * 0.15 * uActivityLevel;

    // Combine effects
    vec3 finalColor = uColor * scanlineEffect * flicker * activityBoost;
    finalColor -= uColor * fineScanline;
    finalColor += edgeGlow;
    finalColor += uColor * innerGlow;
    finalColor += uColor * dataStream;

    // Apply chromatic aberration (RGB split) for CRT effect
    if (uChromaticAberration > 0.0) {
      vec3 aberrationColor;
      aberrationColor.r = finalColor.r * (1.0 + sin(uv.x * 50.0) * uChromaticAberration * 2.0);
      aberrationColor.g = finalColor.g;
      aberrationColor.b = finalColor.b * (1.0 - sin(uv.x * 50.0) * uChromaticAberration * 2.0);
      finalColor = mix(finalColor, aberrationColor, uCrtDistortion);
    }

    // Add static noise
    finalColor += vec3(staticNoise) * uColor;

    // Calculate opacity with fresnel boost at edges
    float finalOpacity = uOpacity * flicker;
    finalOpacity += fresnel * 0.4;
    finalOpacity *= activityBoost;
    finalOpacity = clamp(finalOpacity, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, finalOpacity);
  }
`;

export function createMonitorHologramMaterial(options: {
  color?: THREE.Color | number;
  opacity?: number;
} = {}): THREE.ShaderMaterial {
  // Default to orange for the warm Tron look
  const { color = MONITOR_TUBE_COLORS.orange, opacity = 0.6 } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uScanlineSpeed: { value: 5.0 },
      uScanlineDensity: { value: 80.0 },
      uFlickerIntensity: { value: 0.08 },
      uActivityLevel: { value: 0.6 },
      // CRT distortion uniforms
      uCrtDistortion: { value: 0.0 },
      uNoiseIntensity: { value: 0.0 },
      uChromaticAberration: { value: 0.0 },
    },
    vertexShader: monitorHologramVertexShader,
    fragmentShader: monitorHologramFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// HALO PULSE SHADER
// Glowing ring at the base with activity-based pulsing
// =============================================================================

const haloPulseVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloPulseFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPulseSpeed;
  uniform float uIntensity;
  uniform float uActivityLevel; // 0-1

  varying vec2 vUv;
  varying vec3 vPosition;

  #define PI 3.14159265359

  void main() {
    // Convert UV to polar coordinates (centered)
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Ring shape with soft edges
    float innerRadius = 0.3;
    float outerRadius = 0.5;
    float ringMask = smoothstep(innerRadius - 0.05, innerRadius + 0.02, dist);
    ringMask *= smoothstep(outerRadius + 0.05, outerRadius - 0.02, dist);

    // Pulsing brightness based on activity
    float basePulse = sin(uTime * uPulseSpeed) * 0.5 + 0.5;
    float activityPulse = sin(uTime * uPulseSpeed * 2.0 + uActivityLevel * PI) * 0.5 + 0.5;
    float pulse = mix(basePulse, activityPulse, uActivityLevel);
    pulse = 0.6 + pulse * 0.4;

    // Rotating highlight
    float rotationSpeed = 1.0 + uActivityLevel * 2.0;
    float rotatingHighlight = sin(angle * 2.0 + uTime * rotationSpeed) * 0.5 + 0.5;
    rotatingHighlight = pow(rotatingHighlight, 3.0) * 0.3;

    // Soft glow falloff
    float glowFalloff = 1.0 - smoothstep(0.0, 0.5, dist);
    glowFalloff = pow(glowFalloff, 2.0);

    // Inner bright core
    float innerCore = smoothstep(innerRadius + 0.1, innerRadius - 0.05, dist);
    innerCore *= 0.5;

    // Combine effects
    float brightness = ringMask * pulse * uIntensity;
    brightness += rotatingHighlight * ringMask;
    brightness += innerCore * pulse;

    // Activity-based color shift (more magenta when active)
    vec3 activeColor = mix(uColor, vec3(1.0, 0.0, 1.0), uActivityLevel * 0.3);
    vec3 finalColor = activeColor * brightness;

    // Add outer glow
    float outerGlow = smoothstep(outerRadius + 0.15, outerRadius, dist);
    outerGlow *= smoothstep(innerRadius - 0.1, innerRadius, dist);
    outerGlow *= (1.0 - ringMask) * 0.3 * pulse;
    finalColor += uColor * outerGlow;

    float alpha = brightness + outerGlow * 0.5;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createHaloMaterial(options: {
  color?: THREE.Color | number;
  intensity?: number;
} = {}): THREE.ShaderMaterial {
  const { color = MONITOR_TUBE_COLORS.cyan, intensity = 0.8 } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uPulseSpeed: { value: 2.0 },
      uIntensity: { value: intensity },
      uActivityLevel: { value: 0.5 },
    },
    vertexShader: haloPulseVertexShader,
    fragmentShader: haloPulseFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// GRID FLOOR SHADER
// Animated neon grid with pulse waves from center
// =============================================================================

const monitorGridVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const monitorGridFragmentShader = `
  uniform float uTime;
  uniform vec3 uGridColor;
  uniform vec3 uPulseColor;
  uniform float uGridSize;
  uniform float uPulseSpeed;
  uniform float uPulseIntensity;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  #define PI 3.14159265359

  void main() {
    // Grid lines
    vec2 grid = fract(vUv * uGridSize);
    float lineWidth = 0.08;

    // Create neon grid lines with glow
    float gridLineX = smoothstep(lineWidth, lineWidth * 0.3, grid.x) +
                      smoothstep(1.0 - lineWidth, 1.0 - lineWidth * 0.3, grid.x);
    float gridLineY = smoothstep(lineWidth, lineWidth * 0.3, grid.y) +
                      smoothstep(1.0 - lineWidth, 1.0 - lineWidth * 0.3, grid.y);
    float gridLine = max(gridLineX, gridLineY);
    gridLine = clamp(gridLine, 0.0, 1.0);

    // Intersection points (brighter)
    float intersection = gridLineX * gridLineY;

    // Pulse wave from center
    float distFromCenter = length(vUv - 0.5);
    float pulseWave = fract(distFromCenter * 3.0 - uTime * uPulseSpeed);
    pulseWave = smoothstep(0.0, 0.15, pulseWave) * smoothstep(0.3, 0.15, pulseWave);

    // Secondary faster pulse
    float fastPulse = fract(distFromCenter * 5.0 - uTime * uPulseSpeed * 1.5);
    fastPulse = smoothstep(0.0, 0.1, fastPulse) * smoothstep(0.2, 0.1, fastPulse);
    fastPulse *= 0.3;

    // Radial fade (brighter in center)
    float radialFade = 1.0 - smoothstep(0.0, 0.7, distFromCenter);
    radialFade = 0.3 + radialFade * 0.7;

    // Combine grid and pulse
    vec3 gridCol = uGridColor * gridLine * 0.6;
    gridCol += uGridColor * intersection * 0.4; // Brighter intersections
    vec3 pulseCol = uPulseColor * (pulseWave + fastPulse) * uPulseIntensity;

    vec3 finalColor = (gridCol + pulseCol) * radialFade;

    // Add subtle ambient glow
    finalColor += uGridColor * 0.05 * radialFade;

    float alpha = gridLine * 0.8 + pulseWave * 0.4 + fastPulse * 0.2 + 0.1;
    alpha *= radialFade;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createMonitorGridMaterial(options: {
  gridColor?: THREE.Color | number;
  pulseColor?: THREE.Color | number;
} = {}): THREE.ShaderMaterial {
  const {
    gridColor = MONITOR_TUBE_COLORS.cyan,
    pulseColor = MONITOR_TUBE_COLORS.magenta,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGridColor: { value: new THREE.Color(gridColor) },
      uPulseColor: { value: new THREE.Color(pulseColor) },
      uGridSize: { value: 10.0 },
      uPulseSpeed: { value: 0.5 },
      uPulseIntensity: { value: 0.6 },
    },
    vertexShader: monitorGridVertexShader,
    fragmentShader: monitorGridFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// OUTER SHELL SHADER
// Semi-transparent cylindrical shell with circuit pattern
// =============================================================================

const outerShellVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vFresnel;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
    vFresnel = 1.0 - abs(dot(viewDirection, vNormal));
    vFresnel = pow(vFresnel, 2.5);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const outerShellFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uCircuitIntensity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vFresnel;

  #define PI 3.14159265359

  // Simple hash function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Circuit pattern - horizontal and vertical lines
    float circuitGridX = 12.0;
    float circuitGridY = 20.0;

    vec2 gridUv = vec2(vUv.x * circuitGridX, vUv.y * circuitGridY);
    vec2 gridId = floor(gridUv);
    vec2 gridFract = fract(gridUv);

    // Random circuit lines
    float hLine = step(0.7, hash(gridId)) * step(0.45, gridFract.y) * step(gridFract.y, 0.55);
    float vLine = step(0.7, hash(gridId + 100.0)) * step(0.45, gridFract.x) * step(gridFract.x, 0.55);

    // Circuit nodes at intersections
    float node = step(0.85, hash(gridId + 200.0));
    float nodeDist = length(gridFract - 0.5);
    node *= smoothstep(0.15, 0.05, nodeDist);

    float circuit = (hLine + vLine + node) * uCircuitIntensity;

    // Animated data flow along circuits
    float dataFlow = sin(vUv.y * 40.0 - uTime * 3.0) * 0.5 + 0.5;
    dataFlow = pow(dataFlow, 8.0);
    float flowMask = hLine + vLine;
    circuit += dataFlow * flowMask * 0.5;

    // Fresnel edge glow
    vec3 edgeColor = uColor * vFresnel * 0.6;

    // Combine
    vec3 finalColor = uColor * circuit;
    finalColor += edgeColor;

    float alpha = uOpacity * vFresnel + circuit * 0.5;
    alpha = clamp(alpha, 0.0, 0.8);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createOuterShellMaterial(options: {
  color?: THREE.Color | number;
  opacity?: number;
} = {}): THREE.ShaderMaterial {
  const { color = MONITOR_TUBE_COLORS.cyan, opacity = 0.15 } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uCircuitIntensity: { value: 0.4 },
    },
    vertexShader: outerShellVertexShader,
    fragmentShader: outerShellFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// CAP SHADER
// Top and bottom caps with radial pattern
// =============================================================================

const capVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const capFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec2 vUv;
  varying vec3 vPosition;

  #define PI 3.14159265359

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Radial segments
    float segments = 8.0;
    float segmentPattern = sin(angle * segments) * 0.5 + 0.5;
    segmentPattern = pow(segmentPattern, 2.0);

    // Concentric rings
    float rings = sin(dist * 30.0 - uTime * 2.0) * 0.5 + 0.5;
    rings = pow(rings, 4.0);

    // Center glow
    float centerGlow = smoothstep(0.5, 0.0, dist);
    centerGlow = pow(centerGlow, 2.0);

    // Edge ring
    float edgeRing = smoothstep(0.45, 0.48, dist) * smoothstep(0.52, 0.48, dist);

    // Combine
    float pattern = segmentPattern * 0.2 + rings * 0.3 + centerGlow * 0.5 + edgeRing * 0.8;

    vec3 finalColor = uColor * pattern * uIntensity;

    float alpha = pattern * 0.6 + edgeRing * 0.4;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createCapMaterial(options: {
  color?: THREE.Color | number;
  intensity?: number;
} = {}): THREE.ShaderMaterial {
  const { color = MONITOR_TUBE_COLORS.cyan, intensity = 0.8 } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    },
    vertexShader: capVertexShader,
    fragmentShader: capFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Update all MonitorTube shader materials with the current time
 */
export function updateMonitorTubeMaterials(
  materials: THREE.ShaderMaterial[],
  time: number
): void {
  for (const material of materials) {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = time;
    }
  }
}

/**
 * Set the value for a ring band gauge (0-100)
 */
export function setRingBandValue(
  material: THREE.ShaderMaterial,
  value: number
): void {
  if (material.uniforms.uValue) {
    material.uniforms.uValue.value = Math.max(0, Math.min(100, value));
  }
}

/**
 * Set the activity level for hologram and halo (0-1)
 */
export function setActivityLevel(
  material: THREE.ShaderMaterial,
  level: number
): void {
  if (material.uniforms.uActivityLevel) {
    material.uniforms.uActivityLevel.value = Math.max(0, Math.min(1, level));
  }
}

// =============================================================================
// PRESETS
// =============================================================================

export const MONITOR_TUBE_PRESETS = {
  online: {
    hologramOpacity: 0.4,      // Reduced brightness
    haloIntensity: 0.6,        // Reduced halo
    glowStrength: 0.5,         // Reduced glow
    flickerIntensity: 0.0,     // NO flicker in normal mode
    scanlineIntensity: 0.2,    // Subtle scanlines
    activityLevel: 0.5,
    // CRT effects (clean for normal mode)
    crtDistortion: 0.0,
    noiseIntensity: 0.0,
    chromaticAberration: 0.0,
  },
  warning: {
    hologramOpacity: 0.5,      // Slightly brighter
    haloIntensity: 0.8,
    glowStrength: 0.7,
    flickerIntensity: 0.2,     // Flicker ON for warning
    scanlineIntensity: 0.45,
    activityLevel: 0.7,
    // CRT effects (old TV distortion for warning)
    crtDistortion: 0.4,
    noiseIntensity: 0.15,
    chromaticAberration: 0.008,
  },
  critical: {
    hologramOpacity: 0.6,
    haloIntensity: 1.0,
    glowStrength: 0.9,
    flickerIntensity: 0.35,    // Heavy flicker for critical
    scanlineIntensity: 0.6,
    activityLevel: 1.0,
    // CRT effects (heavy distortion for critical)
    crtDistortion: 0.7,
    noiseIntensity: 0.25,
    chromaticAberration: 0.015,
  },
  offline: {
    hologramOpacity: 0.1,
    haloIntensity: 0.15,
    glowStrength: 0.1,
    flickerIntensity: 0.0,     // No flicker when offline
    scanlineIntensity: 0.1,
    activityLevel: 0.0,
    // CRT effects (minimal for offline)
    crtDistortion: 0.0,
    noiseIntensity: 0.0,
    chromaticAberration: 0.0,
  },
};

/**
 * Apply a preset to all MonitorTube materials
 */
export function applyMonitorTubePreset(
  materials: {
    ringBands?: THREE.ShaderMaterial[];
    hologram?: THREE.ShaderMaterial;
    halo?: THREE.ShaderMaterial;
  },
  presetName: keyof typeof MONITOR_TUBE_PRESETS
): void {
  const preset = MONITOR_TUBE_PRESETS[presetName];

  if (materials.ringBands) {
    for (const mat of materials.ringBands) {
      if (mat.uniforms.uGlowStrength) {
        mat.uniforms.uGlowStrength.value = preset.glowStrength;
      }
      if (mat.uniforms.uScanlineIntensity) {
        mat.uniforms.uScanlineIntensity.value = preset.scanlineIntensity;
      }
    }
  }

  if (materials.hologram) {
    if (materials.hologram.uniforms.uOpacity) {
      materials.hologram.uniforms.uOpacity.value = preset.hologramOpacity;
    }
    if (materials.hologram.uniforms.uFlickerIntensity) {
      materials.hologram.uniforms.uFlickerIntensity.value = preset.flickerIntensity;
    }
    if (materials.hologram.uniforms.uActivityLevel) {
      materials.hologram.uniforms.uActivityLevel.value = preset.activityLevel;
    }
  }

  if (materials.halo) {
    if (materials.halo.uniforms.uIntensity) {
      materials.halo.uniforms.uIntensity.value = preset.haloIntensity;
    }
    if (materials.halo.uniforms.uActivityLevel) {
      materials.halo.uniforms.uActivityLevel.value = preset.activityLevel;
    }
  }
}
