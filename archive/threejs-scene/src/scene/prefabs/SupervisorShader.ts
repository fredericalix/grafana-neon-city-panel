import * as THREE from 'three';

/**
 * Supervisor Shader - Giant Wireframe Face
 *
 * A massive floating wireframe face that watches over the city.
 * Uses barycentric coordinate technique for clean wireframe rendering
 * with glowing edges, energy pulses, and status-reactive colors.
 */

// ============================================================================
// WIREFRAME GLOW SHADER
// Uses barycentric coordinates for edge detection
// ============================================================================

const wireframeVertexShader = `
  attribute vec3 barycentric;

  varying vec3 vBarycentric;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vBarycentric = barycentric;
    vNormal = normalize(normalMatrix * normal);

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDirection = normalize(-mvPosition.xyz);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const wireframeFragmentShader = `
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uPulseSpeed;
  uniform float uEdgeThickness;
  uniform float uScanlineY;
  uniform float uScanlineIntensity;
  uniform float uOpacity;

  varying vec3 vBarycentric;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    // Edge detection using barycentric coordinates
    // Calculate the width of the edge based on screen-space derivatives
    vec3 afwidth = fwidth(vBarycentric);
    vec3 edge3 = smoothstep(
      (uEdgeThickness - 1.0) * afwidth,
      uEdgeThickness * afwidth,
      vBarycentric
    );
    float edge = 1.0 - min(min(edge3.x, edge3.y), edge3.z);

    // Discard interior fragments (not on edges)
    if (edge < 0.01) discard;

    // Energy pulse traveling upward along the wireframe
    float y = vWorldPosition.y;
    float pulse = smoothstep(0.0, 0.15, fract(y * 1.5 - uTime * uPulseSpeed));
    pulse *= smoothstep(0.35, 0.15, fract(y * 1.5 - uTime * uPulseSpeed));

    // Secondary faster pulse
    float pulse2 = smoothstep(0.0, 0.1, fract(y * 2.5 - uTime * uPulseSpeed * 1.5));
    pulse2 *= smoothstep(0.25, 0.1, fract(y * 2.5 - uTime * uPulseSpeed * 1.5));

    float combinedPulse = max(pulse * 0.6, pulse2 * 0.4);

    // Horizontal scanline effect
    float scanDist = abs(vWorldPosition.y - uScanlineY);
    float scanline = smoothstep(0.6, 0.0, scanDist) * uScanlineIntensity;

    // Fresnel rim glow - edges facing camera glow more
    float fresnel = pow(1.0 - abs(dot(vViewDirection, vNormal)), 2.5);

    // Subtle flicker
    float flicker = 0.95 + 0.05 * sin(uTime * 15.0 + vWorldPosition.x * 10.0);

    // Combine effects
    vec3 color = uBaseColor;
    color += uGlowColor * combinedPulse * 0.6;
    color += uGlowColor * scanline;
    color += uGlowColor * fresnel * 0.4;
    color *= uGlowIntensity * flicker;

    // Edge intensity modulation
    float edgeIntensity = 0.7 + edge * 0.3;
    color *= edgeIntensity;

    float alpha = edge * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// EYE/PUPIL GLOW SHADER
// Solid glowing spheres with energy effect
// ============================================================================

const pupilVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDirection = normalize(-mvPosition.xyz);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const pupilFragmentShader = `
  uniform float uTime;
  uniform vec3 uCoreColor;
  uniform vec3 uGlowColor;
  uniform float uIntensity;
  uniform vec2 uLookDirection;
  uniform float uPupilSize;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    // Offset center based on look direction
    vec2 center = vUv - 0.5 + uLookDirection * 0.15;
    float dist = length(center) * 2.0;

    // Pupil core - bright center
    float pupil = smoothstep(uPupilSize, uPupilSize * 0.3, dist);
    pupil = pow(pupil, 1.2);

    // Animated energy rings expanding outward
    float rings = sin(dist * 12.0 - uTime * 5.0) * 0.5 + 0.5;
    rings *= smoothstep(1.0, 0.2, dist);

    // Outer glow with fresnel effect
    float fresnel = pow(1.0 - abs(dot(vViewDirection, vNormal)), 2.0);

    // Subtle flicker for "alive" effect
    float flicker = 0.92 + 0.08 * sin(uTime * 12.0 + dist * 8.0);

    // Combine colors
    vec3 color = mix(uGlowColor, uCoreColor, pupil);
    color += uGlowColor * rings * 0.3;
    color += uGlowColor * fresnel * 0.35;
    color *= flicker * uIntensity;

    // Alpha falloff toward edges
    float alpha = smoothstep(1.0, 0.15, dist);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// STATUS-BASED PRESETS
// ============================================================================

export const SUPERVISOR_FACE_PRESETS: Record<string, {
  baseColor: number;
  glowColor: number;
  glowIntensity: number;
  pulseSpeed: number;
  eyeCoreColor: number;
  eyeGlowColor: number;
  pupilSize: number;
  scanlineIntensity: number;
}> = {
  online: {
    baseColor: 0x00ff88,      // Bright green wireframe
    glowColor: 0x00ffaa,      // Cyan-green glow
    glowIntensity: 1.0,
    pulseSpeed: 0.5,
    eyeCoreColor: 0xffffff,   // White eye core
    eyeGlowColor: 0x00ffcc,   // Cyan-green eye glow
    pupilSize: 0.4,
    scanlineIntensity: 0.4,
  },
  warning: {
    baseColor: 0xffaa00,      // Orange wireframe
    glowColor: 0xffcc00,      // Yellow-orange glow
    glowIntensity: 1.3,
    pulseSpeed: 1.2,
    eyeCoreColor: 0xffffee,   // Warm white core
    eyeGlowColor: 0xffdd00,   // Yellow eye glow
    pupilSize: 0.5,           // Slightly larger
    scanlineIntensity: 0.6,
  },
  critical: {
    baseColor: 0xff2200,      // Red wireframe
    glowColor: 0xff4400,      // Orange-red glow
    glowIntensity: 1.6,
    pulseSpeed: 2.5,
    eyeCoreColor: 0xffdddd,   // Reddish white core
    eyeGlowColor: 0xff3300,   // Red eye glow
    pupilSize: 0.6,           // Dilated pupils
    scanlineIntensity: 0.8,
  },
  offline: {
    baseColor: 0x333344,      // Dark grey-blue wireframe
    glowColor: 0x444455,      // Very dim glow
    glowIntensity: 0.25,
    pulseSpeed: 0.1,
    eyeCoreColor: 0x666677,   // Dim grey core
    eyeGlowColor: 0x555566,   // Dark eye glow
    pupilSize: 0.2,           // Constricted
    scanlineIntensity: 0.1,
  },
};

// Legacy export for compatibility
export const SUPERVISOR_PRESETS = SUPERVISOR_FACE_PRESETS;

// ============================================================================
// MATERIAL FACTORY FUNCTIONS
// ============================================================================

/**
 * Add barycentric coordinates to a geometry for wireframe rendering
 * This assigns (1,0,0), (0,1,0), (0,0,1) to each triangle's vertices
 */
export function setupBarycentricCoordinates(geometry: THREE.BufferGeometry): void {
  // For indexed geometry, we need to convert to non-indexed first
  if (geometry.index !== null) {
    const nonIndexedGeometry = geometry.toNonIndexed();
    // Copy attributes from non-indexed geometry
    geometry.setAttribute('position', nonIndexedGeometry.attributes.position);
    geometry.setAttribute('normal', nonIndexedGeometry.attributes.normal);
    if (nonIndexedGeometry.attributes.uv) {
      geometry.setAttribute('uv', nonIndexedGeometry.attributes.uv);
    }
    geometry.setIndex(null);
  }

  const positionCount = geometry.attributes.position.count;
  const barycentricArray = new Float32Array(positionCount * 3);

  // Barycentric coordinate vectors
  const vectors = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];

  for (let i = 0; i < positionCount; i++) {
    const vectorIndex = i % 3;
    barycentricArray[i * 3] = vectors[vectorIndex].x;
    barycentricArray[i * 3 + 1] = vectors[vectorIndex].y;
    barycentricArray[i * 3 + 2] = vectors[vectorIndex].z;
  }

  geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentricArray, 3));
}

/**
 * Create wireframe shader material for the face geometry
 */
export function createWireframeMaterial(options: {
  baseColor?: THREE.Color | number;
  glowColor?: THREE.Color | number;
  glowIntensity?: number;
  pulseSpeed?: number;
  edgeThickness?: number;
  opacity?: number;
} = {}): THREE.ShaderMaterial {
  const preset = SUPERVISOR_FACE_PRESETS.online;

  const {
    baseColor = preset.baseColor,
    glowColor = preset.glowColor,
    glowIntensity = preset.glowIntensity,
    pulseSpeed = preset.pulseSpeed,
    edgeThickness = 1.5,
    opacity = 1.0,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseColor) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uGlowIntensity: { value: glowIntensity },
      uPulseSpeed: { value: pulseSpeed },
      uEdgeThickness: { value: edgeThickness },
      uScanlineY: { value: 0 },
      uScanlineIntensity: { value: preset.scanlineIntensity },
      uOpacity: { value: opacity },
    },
    vertexShader: wireframeVertexShader,
    fragmentShader: wireframeFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });
}

/**
 * Create shader material for animated eye pupils
 */
export function createPupilShaderMaterial(options: {
  coreColor?: THREE.Color | number;
  glowColor?: THREE.Color | number;
  intensity?: number;
  pupilSize?: number;
} = {}): THREE.ShaderMaterial {
  const preset = SUPERVISOR_FACE_PRESETS.online;

  const {
    coreColor = preset.eyeCoreColor,
    glowColor = preset.eyeGlowColor,
    intensity = 1.0,
    pupilSize = preset.pupilSize,
  } = options;

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCoreColor: { value: new THREE.Color(coreColor) },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uIntensity: { value: intensity },
      uLookDirection: { value: new THREE.Vector2(0, 0) },
      uPupilSize: { value: pupilSize },
    },
    vertexShader: pupilVertexShader,
    fragmentShader: pupilFragmentShader,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility with other files)
// ============================================================================

export const MCP_COLORS = {
  base: 0x1a0808,
  faceBase: 0xe85820,
  faceHighlight: 0xff8c42,
  faceShadow: 0xb84318,
  eyeSocket: 0x0a0a0a,
  eyePupil: 0xfffae6,
  circuitPrimary: 0x00ff88,
  circuitSecondary: 0x00ffaa,
  rimGlow: 0x00ff66,
  laserRed: 0xff0022,
  laserCore: 0xff4444,
  mouthBar: 0x00dfff,
};

// Legacy function redirects for backward compatibility
export function createBodyMaterial(options: any = {}): THREE.ShaderMaterial {
  return createWireframeMaterial(options);
}

export function createRingMaterial(options: any = {}): THREE.ShaderMaterial {
  return createWireframeMaterial({
    ...options,
    edgeThickness: 2.0,
  });
}

export function createConeMaterial(options: any = {}): THREE.ShaderMaterial {
  return createWireframeMaterial(options);
}

export function createSupervisorMaterial(options: any = {}): THREE.ShaderMaterial {
  return createWireframeMaterial(options);
}

export function createLaserBeamMaterial(): THREE.ShaderMaterial {
  // Not used in new implementation
  return createWireframeMaterial();
}

export function createMouthBarMaterial(): THREE.ShaderMaterial {
  // Not used in new implementation
  return createWireframeMaterial();
}

export function createFaceMaterial(): THREE.MeshStandardMaterial {
  // Not used in new implementation - return placeholder
  return new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    metalness: 0.3,
    roughness: 0.6,
  });
}

export function createEyeSocketMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
  });
}

export function createPupilMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
}

// Legacy shader object export
export const SupervisorShader = {
  uniforms: {
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(0x00ff88) },
    uGlowColor: { value: new THREE.Color(0x00ffaa) },
    uGlowIntensity: { value: 1.0 },
    uPulseSpeed: { value: 0.5 },
  },
  vertexShader: '',
  fragmentShader: '',
};
