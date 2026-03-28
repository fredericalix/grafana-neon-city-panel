/**
 * Manual Jest mock for Three.js
 * Provides minimal implementations of Three.js classes used across the codebase.
 * No actual WebGL rendering — just enough shape to test logic.
 */

// --- Vector3 ---
class MockVector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new MockVector3(this.x, this.y, this.z);
  }

  copy(v: MockVector3) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  add(v: MockVector3) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: MockVector3) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  subVectors(a: MockVector3, b: MockVector3) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }

  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  dot(v: MockVector3) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  distanceTo(v: MockVector3) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  lerp(v: MockVector3, t: number) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }

  lerpVectors(a: MockVector3, b: MockVector3, t: number) {
    this.x = a.x + (b.x - a.x) * t;
    this.y = a.y + (b.y - a.y) * t;
    this.z = a.z + (b.z - a.z) * t;
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  applyAxisAngle() {
    return this;
  }
}

// --- Vector2 ---
class MockVector2 {
  x: number;
  y: number;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

// --- Color ---
class MockColor {
  r: number;
  g: number;
  b: number;
  constructor(color?: number | string) {
    this.r = 1;
    this.g = 1;
    this.b = 1;
    if (typeof color === 'number') {
      this.setHex(color);
    }
  }
  setHex(hex: number) {
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
  set(color: number | string | MockColor) {
    if (typeof color === 'number') {
      this.setHex(color);
    }
    return this;
  }
  clone() {
    const c = new MockColor();
    c.r = this.r;
    c.g = this.g;
    c.b = this.b;
    return c;
  }
  getHex() {
    return ((this.r * 255) << 16) ^ ((this.g * 255) << 8) ^ (this.b * 255);
  }
}

// --- Object3D / Group / Mesh ---
function makePosition() {
  return new MockVector3();
}
function makeRotation() {
  return { x: 0, y: 0, z: 0, set: jest.fn() };
}
function makeScale() {
  return { x: 1, y: 1, z: 1, set: jest.fn().mockReturnThis(), setScalar: jest.fn().mockReturnThis() };
}

class MockObject3D {
  position = makePosition();
  rotation = makeRotation();
  scale = makeScale();
  userData: Record<string, unknown> = {};
  name = '';
  visible = true;
  children: MockObject3D[] = [];
  parent: MockObject3D | null = null;

  add(...objects: MockObject3D[]) {
    for (const obj of objects) {
      this.children.push(obj);
      obj.parent = this;
    }
    return this;
  }

  remove(...objects: MockObject3D[]) {
    for (const obj of objects) {
      const idx = this.children.indexOf(obj);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        obj.parent = null;
      }
    }
    return this;
  }

  traverse(callback: (obj: MockObject3D) => void) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  clear() {
    this.children = [];
    return this;
  }

  lookAt() {
    return this;
  }
}

class MockGroup extends MockObject3D {}

class MockMesh extends MockObject3D {
  geometry: any;
  material: any;
  castShadow = false;
  receiveShadow = false;

  constructor(geometry?: any, material?: any) {
    super();
    this.geometry = geometry || {};
    this.material = material || {};
  }
}

class MockLine extends MockObject3D {
  geometry: any;
  material: any;
  constructor(geometry?: any, material?: any) {
    super();
    this.geometry = geometry || {};
    this.material = material || {};
  }
}

class MockLineSegments extends MockLine {}
class MockPoints extends MockObject3D {
  geometry: any;
  material: any;
  constructor(geometry?: any, material?: any) {
    super();
    this.geometry = geometry || {};
    this.material = material || {};
  }
}

// --- Geometries ---
class MockBoxGeometry {
  dispose = jest.fn();
  setAttribute = jest.fn();
  getAttribute = jest.fn().mockReturnValue({ array: new Float32Array(0), count: 0 });
  rotateX = jest.fn().mockReturnThis();
  rotateY = jest.fn().mockReturnThis();
  rotateZ = jest.fn().mockReturnThis();
  translate = jest.fn().mockReturnThis();
  scale = jest.fn().mockReturnThis();
  computeVertexNormals = jest.fn();
  toNonIndexed = jest.fn().mockReturnThis();
  clone = jest.fn().mockReturnThis();
  center = jest.fn().mockReturnThis();
  setIndex = jest.fn();
  deleteAttribute = jest.fn();
  attributes = {};
  index = null;
  setFromPoints = jest.fn();
  copy = jest.fn().mockReturnThis();
}

const MockCylinderGeometry = MockBoxGeometry;
const MockSphereGeometry = MockBoxGeometry;
const MockTorusGeometry = MockBoxGeometry;
const MockPlaneGeometry = MockBoxGeometry;
const MockRingGeometry = MockBoxGeometry;
const MockCircleGeometry = MockBoxGeometry;
const MockConeGeometry = MockBoxGeometry;
const MockBufferGeometry = MockBoxGeometry;
const MockEdgesGeometry = MockBoxGeometry;
const MockExtrudeGeometry = MockBoxGeometry;
const MockShapeGeometry = MockBoxGeometry;
const MockTubeGeometry = MockBoxGeometry;
const MockLatheGeometry = MockBoxGeometry;
const MockOctahedronGeometry = MockBoxGeometry;
const MockCapsuleGeometry = MockBoxGeometry;

// --- Materials ---
class MockMeshStandardMaterial {
  color: MockColor;
  opacity: number;
  transparent: boolean;
  metalness: number;
  roughness: number;
  emissive: MockColor;
  emissiveIntensity: number;
  side: number;
  map: null;
  visible: boolean;
  depthWrite: boolean;
  needsUpdate: boolean;
  dispose = jest.fn();
  clone = jest.fn().mockReturnThis();

  constructor(params?: Record<string, any>) {
    this.color = new MockColor(params?.color);
    this.opacity = params?.opacity ?? 1;
    this.transparent = params?.transparent ?? false;
    this.metalness = params?.metalness ?? 0;
    this.roughness = params?.roughness ?? 1;
    this.emissive = new MockColor(params?.emissive ?? 0);
    this.emissiveIntensity = params?.emissiveIntensity ?? 0;
    this.side = params?.side ?? 0;
    this.map = null;
    this.visible = true;
    this.depthWrite = params?.depthWrite ?? true;
    this.needsUpdate = false;
  }
}

class MockMeshBasicMaterial {
  color: MockColor;
  opacity: number;
  transparent: boolean;
  side: number;
  map: null;
  visible: boolean;
  depthWrite: boolean;
  blending: number;
  needsUpdate: boolean;
  dispose = jest.fn();
  clone = jest.fn().mockReturnThis();

  constructor(params?: Record<string, any>) {
    this.color = new MockColor(params?.color);
    this.opacity = params?.opacity ?? 1;
    this.transparent = params?.transparent ?? false;
    this.side = params?.side ?? 0;
    this.map = null;
    this.visible = true;
    this.depthWrite = params?.depthWrite ?? true;
    this.blending = params?.blending ?? 1;
    this.needsUpdate = false;
  }
}

class MockLineBasicMaterial {
  color: MockColor;
  opacity: number;
  transparent: boolean;
  linewidth: number;
  dispose = jest.fn();
  clone = jest.fn().mockReturnThis();

  constructor(params?: Record<string, any>) {
    this.color = new MockColor(params?.color);
    this.opacity = params?.opacity ?? 1;
    this.transparent = params?.transparent ?? false;
    this.linewidth = params?.linewidth ?? 1;
  }
}

class MockShaderMaterial {
  uniforms: Record<string, any>;
  vertexShader: string;
  fragmentShader: string;
  transparent: boolean;
  side: number;
  depthWrite: boolean;
  blending: number;
  needsUpdate: boolean;
  dispose = jest.fn();
  clone = jest.fn().mockReturnThis();

  constructor(params?: Record<string, any>) {
    this.uniforms = params?.uniforms ?? {};
    this.vertexShader = params?.vertexShader ?? '';
    this.fragmentShader = params?.fragmentShader ?? '';
    this.transparent = params?.transparent ?? false;
    this.side = params?.side ?? 0;
    this.depthWrite = params?.depthWrite ?? true;
    this.blending = params?.blending ?? 1;
    this.needsUpdate = false;
  }
}

class MockPointsMaterial {
  color: MockColor;
  size: number;
  transparent: boolean;
  opacity: number;
  sizeAttenuation: boolean;
  depthWrite: boolean;
  blending: number;
  dispose = jest.fn();

  constructor(params?: Record<string, any>) {
    this.color = new MockColor(params?.color);
    this.size = params?.size ?? 1;
    this.transparent = params?.transparent ?? false;
    this.opacity = params?.opacity ?? 1;
    this.sizeAttenuation = params?.sizeAttenuation ?? true;
    this.depthWrite = params?.depthWrite ?? true;
    this.blending = params?.blending ?? 1;
  }
}

const MockMeshPhongMaterial = MockMeshStandardMaterial;

// --- BufferAttribute ---
class MockFloat32BufferAttribute {
  array: Float32Array;
  count: number;
  itemSize: number;

  constructor(array: ArrayLike<number>, itemSize: number) {
    this.array = new Float32Array(array);
    this.count = this.array.length / itemSize;
    this.itemSize = itemSize;
  }
}

class MockBufferAttribute {
  array: ArrayLike<number>;
  count: number;
  itemSize: number;

  constructor(array: ArrayLike<number>, itemSize: number) {
    this.array = array;
    this.count = array.length / itemSize;
    this.itemSize = itemSize;
  }
}

// --- Raycaster ---
class MockRaycaster {
  setFromCamera = jest.fn();
  intersectObjects = jest.fn().mockReturnValue([]);
  ray = { origin: new MockVector3(), direction: new MockVector3() };
}

// --- Camera ---
class MockPerspectiveCamera extends MockObject3D {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  updateProjectionMatrix = jest.fn();

  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
  }
}

// --- Scene ---
class MockScene extends MockObject3D {
  background: any = null;
  fog: any = null;
}

// --- Lights ---
class MockLight extends MockObject3D {
  color: MockColor;
  intensity: number;
  constructor(color?: number, intensity?: number) {
    super();
    this.color = new MockColor(color);
    this.intensity = intensity ?? 1;
  }
}

class MockAmbientLight extends MockLight {}
class MockDirectionalLight extends MockLight {
  shadow = {
    mapSize: { width: 512, height: 512 },
    camera: { near: 0.5, far: 500, left: -10, right: 10, top: 10, bottom: -10 },
    bias: 0,
  };
  target = new MockObject3D();
}
class MockPointLight extends MockLight {
  distance: number;
  decay: number;
  constructor(color?: number, intensity?: number, distance?: number, decay?: number) {
    super(color, intensity);
    this.distance = distance ?? 0;
    this.decay = decay ?? 2;
  }
}
class MockHemisphereLight extends MockObject3D {
  color: MockColor;
  groundColor: MockColor;
  intensity: number;
  constructor(skyColor?: number, groundColor?: number, intensity?: number) {
    super();
    this.color = new MockColor(skyColor);
    this.groundColor = new MockColor(groundColor);
    this.intensity = intensity ?? 1;
  }
}

// --- Clock ---
class MockClock {
  running = false;
  elapsedTime = 0;
  getDelta = jest.fn().mockReturnValue(0.016);
  getElapsedTime = jest.fn().mockReturnValue(0);
  start = jest.fn();
  stop = jest.fn();
}

// --- Renderer ---
class MockWebGLRenderer {
  domElement = document.createElement('canvas');
  setSize = jest.fn();
  setPixelRatio = jest.fn();
  setClearColor = jest.fn();
  render = jest.fn();
  dispose = jest.fn();
  shadowMap = { enabled: false, type: 0 };
  toneMapping = 0;
  toneMappingExposure = 1;
  outputColorSpace = '';
  getSize = jest.fn().mockReturnValue({ width: 800, height: 600 });
  setAnimationLoop = jest.fn();
  info = { render: { triangles: 0 } };

  constructor(_params?: Record<string, any>) {}
}

// --- Texture ---
class MockTexture {
  image: any = null;
  needsUpdate = false;
  minFilter = 1006;
  magFilter = 1006;
  wrapS = 1001;
  wrapT = 1001;
  dispose = jest.fn();
  clone = jest.fn().mockReturnThis();
}

class MockCanvasTexture extends MockTexture {
  constructor(_canvas?: any) {
    super();
  }
}

// --- Misc ---
class MockShape {
  moveTo = jest.fn().mockReturnThis();
  lineTo = jest.fn().mockReturnThis();
  absarc = jest.fn().mockReturnThis();
  closePath = jest.fn().mockReturnThis();
}

class MockCatmullRomCurve3 {
  points: MockVector3[];
  constructor(points: MockVector3[] = []) {
    this.points = points;
  }
  getPoints = jest.fn().mockReturnValue([]);
  getPoint = jest.fn().mockReturnValue(new MockVector3());
}

// --- Constants ---
const FrontSide = 0;
const BackSide = 1;
const DoubleSide = 2;
const NormalBlending = 1;
const AdditiveBlending = 2;
const SubtractiveBlending = 3;
const MultiplyBlending = 4;
const CustomBlending = 5;
const LinearSRGBColorSpace = 'srgb-linear';
const SRGBColorSpace = 'srgb';
const PCFSoftShadowMap = 2;
const ACESFilmicToneMapping = 4;
const LinearToneMapping = 1;
const NoToneMapping = 0;
const RepeatWrapping = 1000;
const ClampToEdgeWrapping = 1001;
const LinearFilter = 1006;
const NearestFilter = 1003;
const LinearMipmapLinearFilter = 1008;

// --- MathUtils ---
const MathUtils = {
  clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  degToRad: (deg: number) => (deg * Math.PI) / 180,
  radToDeg: (rad: number) => (rad * 180) / Math.PI,
};

// --- Exports ---
export {
  // Core
  MockVector3 as Vector3,
  MockVector2 as Vector2,
  MockColor as Color,
  MockObject3D as Object3D,
  MockGroup as Group,
  MockMesh as Mesh,
  MockLine as Line,
  MockLineSegments as LineSegments,
  MockPoints as Points,
  MockScene as Scene,
  MockPerspectiveCamera as PerspectiveCamera,
  MockWebGLRenderer as WebGLRenderer,
  MockRaycaster as Raycaster,
  MockClock as Clock,

  // Geometries
  MockBoxGeometry as BoxGeometry,
  MockCylinderGeometry as CylinderGeometry,
  MockSphereGeometry as SphereGeometry,
  MockTorusGeometry as TorusGeometry,
  MockPlaneGeometry as PlaneGeometry,
  MockRingGeometry as RingGeometry,
  MockCircleGeometry as CircleGeometry,
  MockConeGeometry as ConeGeometry,
  MockBufferGeometry as BufferGeometry,
  MockEdgesGeometry as EdgesGeometry,
  MockExtrudeGeometry as ExtrudeGeometry,
  MockShapeGeometry as ShapeGeometry,
  MockTubeGeometry as TubeGeometry,
  MockLatheGeometry as LatheGeometry,
  MockOctahedronGeometry as OctahedronGeometry,
  MockCapsuleGeometry as CapsuleGeometry,

  // Textures
  MockTexture as Texture,
  MockCanvasTexture as CanvasTexture,

  // Materials
  MockMeshStandardMaterial as MeshStandardMaterial,
  MockMeshBasicMaterial as MeshBasicMaterial,
  MockLineBasicMaterial as LineBasicMaterial,
  MockShaderMaterial as ShaderMaterial,
  MockPointsMaterial as PointsMaterial,
  MockMeshPhongMaterial as MeshPhongMaterial,

  // Attributes
  MockFloat32BufferAttribute as Float32BufferAttribute,
  MockBufferAttribute as BufferAttribute,

  // Lights
  MockAmbientLight as AmbientLight,
  MockDirectionalLight as DirectionalLight,
  MockPointLight as PointLight,
  MockHemisphereLight as HemisphereLight,

  // Misc
  MockShape as Shape,
  MockCatmullRomCurve3 as CatmullRomCurve3,

  // Constants
  FrontSide,
  BackSide,
  DoubleSide,
  NormalBlending,
  AdditiveBlending,
  SubtractiveBlending,
  MultiplyBlending,
  CustomBlending,
  LinearSRGBColorSpace,
  SRGBColorSpace,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  LinearToneMapping,
  NoToneMapping,
  RepeatWrapping,
  ClampToEdgeWrapping,
  LinearFilter,
  NearestFilter,
  LinearMipmapLinearFilter,

  // Utils
  MathUtils,
};
