import * as THREE from 'three';

/**
 * Data Center Shader Collection
 *
 * Shaders for the Data Center prefab featuring:
 * - LED Cascade Shader: Animated server rack LED strips with wave effects
 * - Hologram Core Shader: Central display with scanlines and flicker
 * - Cooling Tower Shader: Fan ring glow with temperature-based coloring
 * - Data Flow Particle Shader: Flowing data particles between racks
 * - Alert Beacon Shader: Pulsing warning lights
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const DATA_CENTER_COLORS = {
  // Primary neon colors
  cyan: 0x00ffff,
  magenta: 0xff00ff,
  orange: 0xffaa00,
  red: 0xff4444,
  green: 0x00ff88,

  // Background/structure colors
  darkMetal: 0x0a0a12,
  metalGray: 0x1a1a2e,
  rackDark: 0x151520,
  gridLine: 0x2a2a4a,

  // Alert colors
  alertOrange: 0xff6600,
  alertRed: 0xff2222,

  // Hologram colors
  holoCore: 0x00ffff,
  holoScan: 0x00ffff,
  holoRing: 0xff00ff,
};

// =============================================================================
// LED CASCADE SHADER
// Animated vertical wave effect for server rack LEDs
// =============================================================================

const ledCascadeVertexShader = `
  attribute float instanceIndex;
  varying vec2 vUv;
  varying float vInstanceIndex;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vInstanceIndex = instanceIndex;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const ledCascadeFragmentShader = `
  uniform float uTime;
  uniform float uCpuUsage;    // 0-100, affects wave speed
  uniform vec3 uColorLow;     // Cyan (low CPU)
  uniform vec3 uColorHigh;    // Magenta (high CPU)
  uniform float uWaveSpeed;
  uniform float uIntensity;

  varying vec2 vUv;
  varying float vInstanceIndex;
  varying vec3 vPosition;

  void main() {
    // Wave phase based on vertical position and time
    float wavePhase = vPosition.y * 4.0 + uTime * uWaveSpeed * (0.5 + uCpuUsage * 0.02);

    // LED brightness wave
    float wave = sin(wavePhase) * 0.5 + 0.5;
    wave = pow(wave, 2.0);

    // Add random flicker
    float flicker = 0.85 + 0.15 * sin(uTime * 15.0 + vInstanceIndex * 7.3);

    // Color based on CPU usage (low = cyan, high = magenta)
    float cpuFactor = uCpuUsage / 100.0;
    vec3 color = mix(uColorLow, uColorHigh, cpuFactor);

    // Final brightness
    float brightness = wave * flicker * uIntensity;

    // Add glow effect at edges
    float edgeGlow = 1.0 - abs(vUv.x - 0.5) * 2.0;
    brightness += edgeGlow * 0.3;

    gl_FragColor = vec4(color * brightness, brightness * 0.9);
  }
`;

export function createLedCascadeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCpuUsage: { value: 50 },
      uColorLow: { value: new THREE.Color(DATA_CENTER_COLORS.cyan) },
      uColorHigh: { value: new THREE.Color(DATA_CENTER_COLORS.magenta) },
      uWaveSpeed: { value: 3.0 },
      uIntensity: { value: 1.0 },
    },
    vertexShader: ledCascadeVertexShader,
    fragmentShader: ledCascadeFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// HOLOGRAM CORE SHADER
// Central display with scanlines, flicker, and data visualization
// =============================================================================

const hologramVertexShader = `
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

const hologramFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uScanlineSpeed;
  uniform float uScanlineDensity;
  uniform float uFlickerIntensity;
  uniform float uGlitchIntensity;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Scanline effect
    float scanline = sin(vUv.y * uScanlineDensity - uTime * uScanlineSpeed);
    scanline = smoothstep(0.0, 0.1, scanline) * 0.3 + 0.7;

    // Horizontal flicker
    float flicker = 0.9 + 0.1 * sin(uTime * 20.0 + rand(vec2(floor(uTime * 30.0), 0.0)) * 6.28);

    // Glitch effect (occasional horizontal displacement)
    float glitchLine = step(0.98, rand(vec2(floor(vUv.y * 50.0), floor(uTime * 10.0))));
    float glitch = glitchLine * uGlitchIntensity;

    // Edge glow based on normal angle (Fresnel-like)
    float edgeFactor = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    edgeFactor = pow(edgeFactor, 2.0) * 0.5;

    // Combine effects
    float alpha = uOpacity * scanline * flicker;
    alpha += edgeFactor;
    alpha *= 1.0 + glitch * 0.5;

    // Color with slight variation
    vec3 finalColor = uColor;
    finalColor += vec3(0.0, 0.1, 0.2) * sin(uTime * 2.0) * 0.1;

    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

export function createHologramMaterial(options: {
  color?: THREE.Color | number;
  opacity?: number;
} = {}): THREE.ShaderMaterial {
  const { color = DATA_CENTER_COLORS.cyan, opacity = 0.7 } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uScanlineSpeed: { value: 5.0 },
      uScanlineDensity: { value: 100.0 },
      uFlickerIntensity: { value: 0.1 },
      uGlitchIntensity: { value: 0.05 },
    },
    vertexShader: hologramVertexShader,
    fragmentShader: hologramFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// GAUGE RING SHADER
// Circular progress gauge for CPU/RAM display
// =============================================================================

const gaugeRingVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const gaugeRingFragmentShader = `
  uniform float uTime;
  uniform float uValue;       // 0-100, fills the ring
  uniform vec3 uColorLow;     // Green for low values
  uniform vec3 uColorHigh;    // Red for high values
  uniform float uThickness;
  uniform float uGlowStrength;

  varying vec2 vUv;
  varying vec3 vPosition;

  #define PI 3.14159265359

  void main() {
    // Convert UV to polar coordinates (centered)
    vec2 center = vUv - 0.5;
    float angle = atan(center.y, center.x);
    float dist = length(center);

    // Normalize angle to 0-1 range (starting from top, going clockwise)
    float normalizedAngle = (angle + PI) / (2.0 * PI);
    normalizedAngle = fract(normalizedAngle + 0.25); // Start from top

    // Ring mask
    float innerRadius = 0.35;
    float outerRadius = 0.5;
    float ringMask = smoothstep(innerRadius - 0.02, innerRadius, dist);
    ringMask *= smoothstep(outerRadius, outerRadius - 0.02, dist);

    // Fill based on value
    float fillAngle = uValue / 100.0;
    float fill = step(normalizedAngle, fillAngle);

    // Color gradient based on value
    vec3 color = mix(uColorLow, uColorHigh, uValue / 100.0);

    // Glow at the leading edge
    float edgeGlow = smoothstep(fillAngle - 0.02, fillAngle, normalizedAngle);
    edgeGlow *= smoothstep(fillAngle + 0.02, fillAngle, normalizedAngle);
    edgeGlow *= fill;

    // Pulse animation
    float pulse = 0.8 + 0.2 * sin(uTime * 3.0);

    // Background track
    vec3 trackColor = vec3(0.1, 0.1, 0.15);
    vec3 finalColor = mix(trackColor, color * pulse, fill);
    finalColor += color * edgeGlow * uGlowStrength;

    float alpha = ringMask * (0.3 + fill * 0.7);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createGaugeRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uValue: { value: 50 },
      uColorLow: { value: new THREE.Color(DATA_CENTER_COLORS.cyan) },
      uColorHigh: { value: new THREE.Color(DATA_CENTER_COLORS.magenta) },
      uThickness: { value: 0.15 },
      uGlowStrength: { value: 0.5 },
    },
    vertexShader: gaugeRingVertexShader,
    fragmentShader: gaugeRingFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// CYLINDRICAL GAUGE SHADER
// 360-degree visible gauge that wraps around a cylinder
// =============================================================================

const cylindricalGaugeVertexShader = `
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

const cylindricalGaugeFragmentShader = `
  uniform float uTime;
  uniform float uValue;       // 0-100, fills the gauge
  uniform vec3 uColorLow;     // Color for low values
  uniform vec3 uColorHigh;    // Color for high values
  uniform float uGlowStrength;
  uniform float uTrackOpacity;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  #define PI 3.14159265359

  void main() {
    // On a cylinder, UV.x wraps around (0-1 = full circumference)
    // UV.y goes along the height
    float angle = vUv.x;  // 0 to 1 represents full 360 degrees

    // Create a band in the middle of the cylinder for the gauge
    float bandCenter = 0.5;
    float bandWidth = 0.3;
    float bandMask = smoothstep(bandCenter - bandWidth, bandCenter - bandWidth + 0.05, vUv.y);
    bandMask *= smoothstep(bandCenter + bandWidth, bandCenter + bandWidth - 0.05, vUv.y);

    // Fill based on value (angle from 0 to fillAngle is filled)
    float fillAngle = uValue / 100.0;
    float fill = step(angle, fillAngle);

    // Color gradient based on current value
    vec3 color = mix(uColorLow, uColorHigh, uValue / 100.0);

    // Glow at the leading edge
    float edgeGlow = smoothstep(fillAngle - 0.03, fillAngle, angle);
    edgeGlow *= smoothstep(fillAngle + 0.03, fillAngle, angle);
    edgeGlow *= fill;

    // Pulse animation
    float pulse = 0.8 + 0.2 * sin(uTime * 3.0);

    // Tick marks around the gauge
    float tickCount = 10.0;
    float tick = step(0.95, fract(angle * tickCount));
    tick *= bandMask;

    // Background track
    vec3 trackColor = vec3(0.1, 0.1, 0.15);
    vec3 finalColor = mix(trackColor, color * pulse, fill);
    finalColor += color * edgeGlow * uGlowStrength;
    finalColor += vec3(0.3) * tick;  // Tick marks

    // Edge highlighting (Fresnel effect)
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    finalColor += color * fresnel * 0.2 * fill;

    float alpha = bandMask * (uTrackOpacity + fill * 0.6 + edgeGlow * 0.3);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createCylindricalGaugeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uValue: { value: 50 },
      uColorLow: { value: new THREE.Color(DATA_CENTER_COLORS.cyan) },
      uColorHigh: { value: new THREE.Color(DATA_CENTER_COLORS.magenta) },
      uGlowStrength: { value: 0.5 },
      uTrackOpacity: { value: 0.3 },
    },
    vertexShader: cylindricalGaugeVertexShader,
    fragmentShader: cylindricalGaugeFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// COOLING FAN SHADER
// Rotating fan blades with glow ring
// =============================================================================

const coolingFanVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coolingFanFragmentShader = `
  uniform float uTime;
  uniform float uRotationSpeed;
  uniform float uTemperature;  // 0-100
  uniform vec3 uColorCool;     // Blue for cool
  uniform vec3 uColorHot;      // Orange for hot

  varying vec2 vUv;
  varying vec3 vPosition;

  #define PI 3.14159265359

  void main() {
    vec2 center = vUv - 0.5;
    float angle = atan(center.y, center.x) + uTime * uRotationSpeed;
    float dist = length(center);

    // Fan blade pattern (4 blades)
    float bladeCount = 4.0;
    float blade = sin(angle * bladeCount);
    blade = smoothstep(0.0, 0.3, blade);

    // Radial mask (fan shape)
    float fanMask = smoothstep(0.1, 0.15, dist) * smoothstep(0.5, 0.4, dist);

    // Hub in center
    float hub = smoothstep(0.12, 0.1, dist);

    // Color based on temperature
    vec3 color = mix(uColorCool, uColorHot, uTemperature / 100.0);

    // Glow ring around the fan
    float ring = smoothstep(0.45, 0.48, dist) * smoothstep(0.52, 0.48, dist);
    float ringGlow = ring * (0.5 + 0.5 * sin(uTime * 5.0));

    // Motion blur effect
    float blur = 0.8 + 0.2 * (uRotationSpeed / 5.0);

    vec3 finalColor = color * (blade * fanMask * blur + hub * 0.3);
    finalColor += color * ringGlow;

    float alpha = (blade * fanMask + hub * 0.5 + ring) * 0.9;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createCoolingFanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRotationSpeed: { value: 2.0 },
      uTemperature: { value: 50 },
      uColorCool: { value: new THREE.Color(0x0066ff) },
      uColorHot: { value: new THREE.Color(DATA_CENTER_COLORS.orange) },
    },
    vertexShader: coolingFanVertexShader,
    fragmentShader: coolingFanFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// DATA FLOW PARTICLE SHADER
// Flowing particles representing data transfer
// =============================================================================

const dataFlowVertexShader = `
  uniform float uTime;
  uniform float uSpeed;

  attribute float particleIndex;
  attribute vec3 pathStart;
  attribute vec3 pathEnd;
  attribute float pathOffset;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Calculate position along path with offset
    float t = fract(uTime * uSpeed + pathOffset);

    // Bezier curve through center (curved path)
    vec3 midPoint = (pathStart + pathEnd) * 0.5;
    midPoint.y += 0.5; // Curve upward through center

    // Quadratic Bezier
    vec3 pos = mix(mix(pathStart, midPoint, t), mix(midPoint, pathEnd, t), t);

    // Fade at start and end
    vAlpha = sin(t * 3.14159);

    // Color varies with position
    vColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.0, 1.0), t);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 4.0 * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const dataFlowFragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Circular particle
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;

    gl_FragColor = vec4(vColor, alpha);
  }
`;

export function createDataFlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.5 },
    },
    vertexShader: dataFlowVertexShader,
    fragmentShader: dataFlowFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// =============================================================================
// ALERT BEACON SHADER
// Pulsing warning beacon
// =============================================================================

const alertBeaconVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const alertBeaconFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPulseSpeed;
  uniform float uIntensity;
  uniform int uAlertLevel; // 0 = normal, 1 = warning, 2 = critical

  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    // Pulse pattern
    float pulse;
    if (uAlertLevel == 2) {
      // Critical: Fast strobe
      pulse = step(0.5, fract(uTime * uPulseSpeed));
    } else if (uAlertLevel == 1) {
      // Warning: Smooth pulse
      pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);
    } else {
      // Normal: Dim glow
      pulse = 0.2;
    }

    // Radial glow
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float glow = smoothstep(0.5, 0.0, dist);

    vec3 finalColor = uColor * pulse * uIntensity;
    float alpha = glow * pulse;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createAlertBeaconMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(DATA_CENTER_COLORS.green) },
      uPulseSpeed: { value: 2.0 },
      uIntensity: { value: 1.0 },
      uAlertLevel: { value: 0 },
    },
    vertexShader: alertBeaconVertexShader,
    fragmentShader: alertBeaconFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// GRID FLOOR SHADER
// Animated grid with pulse effects
// =============================================================================

const gridFloorVertexShader = `
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

const gridFloorFragmentShader = `
  uniform float uTime;
  uniform vec3 uGridColor;
  uniform float uGridSize;
  uniform float uPulseSpeed;
  uniform float uPulseOriginX;
  uniform float uPulseOriginZ;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    // Grid lines
    vec2 grid = fract(vUv * uGridSize);
    float lineWidth = 0.05;
    float gridLine = step(1.0 - lineWidth, grid.x) + step(1.0 - lineWidth, grid.y);
    gridLine = clamp(gridLine, 0.0, 1.0);

    // Pulse wave from center
    float distFromCenter = length(vec2(vUv.x - 0.5, vUv.y - 0.5));
    float pulseWave = fract(distFromCenter * 2.0 - uTime * uPulseSpeed);
    pulseWave = smoothstep(0.0, 0.1, pulseWave) * smoothstep(0.2, 0.1, pulseWave);

    // Combine grid and pulse
    vec3 finalColor = uGridColor * (gridLine * 0.6 + 0.1);
    finalColor += uGridColor * pulseWave * 0.4;

    float alpha = gridLine * 0.8 + pulseWave * 0.3 + 0.1;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createGridFloorMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGridColor: { value: new THREE.Color(DATA_CENTER_COLORS.cyan) },
      uGridSize: { value: 12.0 },
      uPulseSpeed: { value: 0.5 },
      uPulseOriginX: { value: 0.5 },
      uPulseOriginZ: { value: 0.5 },
    },
    vertexShader: gridFloorVertexShader,
    fragmentShader: gridFloorFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// PROJECTION BEAM SHADER
// Vertical hologram projection beam
// =============================================================================

const projectionBeamVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const projectionBeamFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uScanSpeed;

  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    // Vertical gradient (brighter at bottom)
    float heightFade = 1.0 - vUv.y;
    heightFade = pow(heightFade, 1.5);

    // Edge fade
    float edgeFade = 1.0 - abs(vUv.x - 0.5) * 2.0;
    edgeFade = pow(edgeFade, 0.5);

    // Scanning lines
    float scan = sin(vUv.y * 40.0 - uTime * uScanSpeed);
    scan = scan * 0.5 + 0.5;
    scan = pow(scan, 4.0) * 0.3;

    // Flicker
    float flicker = 0.9 + 0.1 * sin(uTime * 25.0);

    float alpha = heightFade * edgeFade * uOpacity * flicker;
    alpha += scan * heightFade * edgeFade;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createProjectionBeamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(DATA_CENTER_COLORS.cyan) },
      uOpacity: { value: 0.4 },
      uScanSpeed: { value: 8.0 },
    },
    vertexShader: projectionBeamVertexShader,
    fragmentShader: projectionBeamFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// TEMPERATURE BAR SHADER
// Vertical thermometer-style bar
// =============================================================================

const temperatureBarVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const temperatureBarFragmentShader = `
  uniform float uTime;
  uniform float uValue;      // 0-100
  uniform vec3 uColorLow;    // Blue/green
  uniform vec3 uColorMid;    // Yellow
  uniform vec3 uColorHigh;   // Red

  varying vec2 vUv;

  void main() {
    // Fill level
    float fillLevel = uValue / 100.0;
    float fill = step(vUv.y, fillLevel);

    // Color gradient based on height
    vec3 color;
    if (vUv.y < 0.5) {
      color = mix(uColorLow, uColorMid, vUv.y * 2.0);
    } else {
      color = mix(uColorMid, uColorHigh, (vUv.y - 0.5) * 2.0);
    }

    // Edge glow at top of fill
    float edgeGlow = smoothstep(fillLevel - 0.05, fillLevel, vUv.y);
    edgeGlow *= smoothstep(fillLevel + 0.05, fillLevel, vUv.y);
    edgeGlow *= fill;

    // Bubble animation
    float bubble = sin(vUv.y * 20.0 - uTime * 3.0) * 0.5 + 0.5;
    bubble = pow(bubble, 8.0) * 0.2 * fill;

    // Track background
    vec3 trackColor = vec3(0.1, 0.1, 0.15);
    vec3 finalColor = mix(trackColor, color, fill);
    finalColor += color * (edgeGlow + bubble);

    float alpha = 0.3 + fill * 0.6 + edgeGlow * 0.3;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createTemperatureBarMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uValue: { value: 50 },
      uColorLow: { value: new THREE.Color(0x00ff88) },
      uColorMid: { value: new THREE.Color(0xffff00) },
      uColorHigh: { value: new THREE.Color(0xff4444) },
    },
    vertexShader: temperatureBarVertexShader,
    fragmentShader: temperatureBarFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// =============================================================================
// VAPOR PARTICLE SHADER
// Rising vapor/steam effect for cooling towers
// =============================================================================

const vaporVertexShader = `
  uniform float uTime;
  uniform float uRiseSpeed;
  uniform float uSpread;

  attribute float particleIndex;
  attribute float particleSize;
  attribute float particlePhase;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    vPhase = particlePhase;

    // Particle rises and spreads
    float t = fract(uTime * uRiseSpeed + particlePhase);
    vec3 pos = position;

    // Rise with time
    pos.y += t * 2.0;

    // Spread outward as rising
    float spread = t * uSpread;
    pos.x += sin(particlePhase * 6.28 + uTime) * spread;
    pos.z += cos(particlePhase * 6.28 + uTime * 0.7) * spread;

    // Fade in and out
    vAlpha = sin(t * 3.14159);
    vAlpha *= 0.6;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = particleSize * (200.0 / -mvPosition.z) * (1.0 + t * 0.5);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const vaporFragmentShader = `
  uniform vec3 uColorCool;
  uniform vec3 uColorHot;
  uniform float uTemperature;
  uniform float uDensity;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);

    // Soft circular particle
    float alpha = smoothstep(0.5, 0.0, dist) * vAlpha * uDensity;

    // Interpolate color based on temperature (0-100)
    vec3 baseColor = mix(uColorCool, uColorHot, uTemperature / 100.0);

    // Slight color variation based on particle phase
    vec3 color = baseColor + vec3(0.1, 0.1, 0.15) * sin(vPhase * 6.28);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createVaporMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorCool: { value: new THREE.Color(0x4488ff) },  // Cool blue vapor
      uColorHot: { value: new THREE.Color(DATA_CENTER_COLORS.orange) },  // Hot orange vapor
      uTemperature: { value: 50 },  // 0-100 temperature value
      uRiseSpeed: { value: 0.3 },
      uSpread: { value: 0.3 },
      uDensity: { value: 0.5 },
    },
    vertexShader: vaporVertexShader,
    fragmentShader: vaporFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// =============================================================================
// DIGITAL DISPLAY SHADER
// For showing numbers/text with digital effect
// =============================================================================

export function createDigitalDisplayTexture(
  value: string | number,
  width: number = 256,
  height: number = 64,
  color: number = DATA_CENTER_COLORS.cyan
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  // Text
  const colorObj = new THREE.Color(color);
  const cssColor = `rgb(${Math.floor(colorObj.r * 255)}, ${Math.floor(colorObj.g * 255)}, ${Math.floor(colorObj.b * 255)})`;

  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = cssColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), width / 2, height / 2);

  // Scanline overlay
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  for (let y = 0; y < height; y += 2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// =============================================================================
// BINARY PARTICLE SHADER
// Custom shader for rendering 0s and 1s as data flow particles
// =============================================================================

const binaryParticleVertexShader = `
  attribute float binaryIndex;  // 0 or 1 to select which digit to display
  attribute vec3 particleColor;

  varying float vBinaryIndex;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vBinaryIndex = binaryIndex;
    vColor = particleColor;
    vAlpha = 1.0;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 0.2 * (300.0 / -mvPosition.z);  // Tiny binary digits
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const binaryParticleFragmentShader = `
  uniform sampler2D uAtlas;
  uniform float uOpacity;

  varying float vBinaryIndex;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Sample from the correct half of the atlas based on binaryIndex
    // Top half (0-0.5 in V) is "0", bottom half (0.5-1.0 in V) is "1"
    vec2 uv = gl_PointCoord;

    // Scale and offset UV to select the right character from atlas
    // binaryIndex 0 -> sample from top half (V: 0 to 0.5)
    // binaryIndex 1 -> sample from bottom half (V: 0.5 to 1.0)
    uv.y = uv.y * 0.5 + vBinaryIndex * 0.5;

    vec4 texColor = texture2D(uAtlas, uv);

    // Apply particle color to the white text
    vec3 finalColor = vColor * texColor.rgb;

    // Use texture alpha for transparency
    float alpha = texColor.a * uOpacity * vAlpha;

    if (alpha < 0.1) discard;  // Discard nearly transparent pixels

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createBinaryParticleMaterial(atlas: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas },
      uOpacity: { value: 0.8 },
    },
    vertexShader: binaryParticleVertexShader,
    fragmentShader: binaryParticleFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// =============================================================================
// BINARY ATLAS TEXTURE
// Creates a texture atlas with "0" and "1" characters for data flow particles
// =============================================================================

/**
 * Creates a 2-row texture atlas for binary digits (0 and 1)
 * Top half: "0" character
 * Bottom half: "1" character
 * Used for data flow particles to create a digital data stream effect
 */
export function createBinaryAtlasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size * 2;  // 2 rows: top for "0", bottom for "1"
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Configure text style - bold monospace for digital look
  ctx.font = `bold ${size * 0.7}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw "0" in the top half (white on transparent)
  ctx.fillStyle = '#ffffff';
  ctx.fillText('0', size / 2, size / 2);

  // Draw "1" in the bottom half (white on transparent)
  ctx.fillText('1', size / 2, size + size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;

  return texture;
}

// =============================================================================
// PRESETS
// =============================================================================

export const DATA_CENTER_PRESETS = {
  online: {
    ledIntensity: 1.0,
    hologramOpacity: 0.7,
    alertLevel: 0,
    alertColor: DATA_CENTER_COLORS.green,
    beamOpacity: 0.4,
  },
  warning: {
    ledIntensity: 1.2,
    hologramOpacity: 0.8,
    alertLevel: 1,
    alertColor: DATA_CENTER_COLORS.orange,
    beamOpacity: 0.5,
  },
  critical: {
    ledIntensity: 1.5,
    hologramOpacity: 0.9,
    alertLevel: 2,
    alertColor: DATA_CENTER_COLORS.red,
    beamOpacity: 0.6,
  },
  offline: {
    ledIntensity: 0.1,
    hologramOpacity: 0.2,
    alertLevel: 0,
    alertColor: 0x333344,
    beamOpacity: 0.1,
  },
};
