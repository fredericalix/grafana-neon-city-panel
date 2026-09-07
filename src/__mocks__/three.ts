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

  distanceToSquared(v: MockVector3) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
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

  crossVectors(a: MockVector3, b: MockVector3) {
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const bx = b.x;
    const by = b.y;
    const bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  // Simplified projection: keeps x/y as NDC and forces z into the visible
  // range so callers never see "behind camera" unless they set z themselves.
  project(_camera: unknown) {
    this.z = 0;
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
  copy(v: MockVector2) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  clone() {
    return new MockVector2(this.x, this.y);
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

  // Local position is enough for tests: no matrix composition in the mock.
  getWorldPosition(target: MockVector3) {
    return target.copy(this.position);
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
  attributes: Record<string, any> = {};
  index: any = null;
  dispose = jest.fn();
  rotateX = jest.fn().mockReturnThis();
  rotateY = jest.fn().mockReturnThis();
  rotateZ = jest.fn().mockReturnThis();
  translate = jest.fn().mockReturnThis();
  scale = jest.fn().mockReturnThis();
  computeVertexNormals = jest.fn();
  toNonIndexed = jest.fn().mockReturnThis();
  center = jest.fn().mockReturnThis();
  setIndex = jest.fn();
  setFromPoints = jest.fn().mockReturnThis();
  setDrawRange = jest.fn();
  copy = jest.fn().mockReturnThis();

  setAttribute(name: string, attribute: any) {
    this.attributes[name] = attribute;
    return this;
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? { array: new Float32Array(0), count: 0 };
  }

  deleteAttribute(name: string) {
    delete this.attributes[name];
    return this;
  }

  // A clone is a NEW instance with its own dispose spy and its own attribute
  // table — returning `this` would make dispose tests blind to double-dispose
  // and leaked clones.
  clone() {
    const clone = new MockBoxGeometry();
    clone.attributes = { ...this.attributes };
    clone.index = this.index;
    return clone;
  }
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
const MockIcosahedronGeometry = MockBoxGeometry;
const MockWireframeGeometry = MockBoxGeometry;

// --- Materials ---
// Every clone() returns a NEW instance with its own dispose spy and copied
// properties — mockReturnThis() would make dispose tests blind to
// double-dispose bugs and leaked clones.
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

  clone(): this {
    const m = new (this.constructor as new (params?: Record<string, any>) => this)();
    m.color = this.color.clone();
    m.opacity = this.opacity;
    m.transparent = this.transparent;
    m.metalness = this.metalness;
    m.roughness = this.roughness;
    m.emissive = this.emissive.clone();
    m.emissiveIntensity = this.emissiveIntensity;
    m.side = this.side;
    m.map = this.map;
    m.visible = this.visible;
    m.depthWrite = this.depthWrite;
    m.needsUpdate = this.needsUpdate;
    return m;
  }
}

class MockMeshPhysicalMaterial extends MockMeshStandardMaterial {
  clearcoat: number;
  clearcoatRoughness: number;

  constructor(params?: Record<string, any>) {
    super(params);
    this.clearcoat = params?.clearcoat ?? 0;
    this.clearcoatRoughness = params?.clearcoatRoughness ?? 0;
  }

  clone(): this {
    const m = super.clone();
    (m as MockMeshPhysicalMaterial).clearcoat = this.clearcoat;
    (m as MockMeshPhysicalMaterial).clearcoatRoughness = this.clearcoatRoughness;
    return m;
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

  clone(): this {
    const m = new (this.constructor as new (params?: Record<string, any>) => this)();
    m.color = this.color.clone();
    m.opacity = this.opacity;
    m.transparent = this.transparent;
    m.side = this.side;
    m.map = this.map;
    m.visible = this.visible;
    m.depthWrite = this.depthWrite;
    m.blending = this.blending;
    m.needsUpdate = this.needsUpdate;
    return m;
  }
}

class MockLineBasicMaterial {
  color: MockColor;
  opacity: number;
  transparent: boolean;
  linewidth: number;
  dispose = jest.fn();

  constructor(params?: Record<string, any>) {
    this.color = new MockColor(params?.color);
    this.opacity = params?.opacity ?? 1;
    this.transparent = params?.transparent ?? false;
    this.linewidth = params?.linewidth ?? 1;
  }

  clone(): this {
    const m = new (this.constructor as new (params?: Record<string, any>) => this)();
    m.color = this.color.clone();
    m.opacity = this.opacity;
    m.transparent = this.transparent;
    m.linewidth = this.linewidth;
    return m;
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

  clone(): this {
    const m = new (this.constructor as new (params?: Record<string, any>) => this)();
    // Clone uniform values when possible so a clone doesn't alias the
    // original's Vector3/Color instances.
    m.uniforms = Object.fromEntries(
      Object.entries(this.uniforms).map(([key, uniform]) => [
        key,
        { ...uniform, value: uniform?.value?.clone ? uniform.value.clone() : uniform?.value },
      ])
    );
    m.vertexShader = this.vertexShader;
    m.fragmentShader = this.fragmentShader;
    m.transparent = this.transparent;
    m.side = this.side;
    m.depthWrite = this.depthWrite;
    m.blending = this.blending;
    m.needsUpdate = this.needsUpdate;
    return m;
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

  clone(): this {
    const m = new (this.constructor as new (params?: Record<string, any>) => this)();
    m.color = this.color.clone();
    m.size = this.size;
    m.transparent = this.transparent;
    m.opacity = this.opacity;
    m.sizeAttenuation = this.sizeAttenuation;
    m.depthWrite = this.depthWrite;
    m.blending = this.blending;
    return m;
  }
}

const MockMeshPhongMaterial = MockMeshStandardMaterial;

// --- BufferAttribute ---
class MockBufferAttribute {
  array: ArrayLike<number>;
  count: number;
  itemSize: number;
  needsUpdate = false;

  constructor(array: ArrayLike<number>, itemSize: number) {
    this.array = array;
    this.count = array.length / itemSize;
    this.itemSize = itemSize;
  }

  setUsage = jest.fn().mockReturnThis();

  getX(i: number) {
    return this.array[i * this.itemSize];
  }
  getY(i: number) {
    return this.array[i * this.itemSize + 1];
  }
  getZ(i: number) {
    return this.array[i * this.itemSize + 2];
  }
  setX(i: number, x: number) {
    (this.array as Float32Array)[i * this.itemSize] = x;
    return this;
  }
  setY(i: number, y: number) {
    (this.array as Float32Array)[i * this.itemSize + 1] = y;
    return this;
  }
  setZ(i: number, z: number) {
    (this.array as Float32Array)[i * this.itemSize + 2] = z;
    return this;
  }
}

class MockFloat32BufferAttribute extends MockBufferAttribute {
  constructor(array: ArrayLike<number>, itemSize: number) {
    super(new Float32Array(array), itemSize);
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
  dispose = jest.fn();
  constructor(color?: number, intensity?: number) {
    super();
    this.color = new MockColor(color);
    this.intensity = intensity ?? 1;
  }
}

class MockAmbientLight extends MockLight {}
class MockDirectionalLight extends MockLight {
  shadow = {
    mapSize: {
      width: 512,
      height: 512,
      set(width: number, height: number) {
        this.width = width;
        this.height = height;
      },
    },
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
  dispose = jest.fn();
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
  forceContextLoss = jest.fn();
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
  offset = new MockVector2(0, 0);
  repeat = new MockVector2(1, 1);
  center = new MockVector2(0, 0);
  dispose = jest.fn();

  clone(): this {
    const m = new (this.constructor as new () => this)();
    m.image = this.image;
    m.needsUpdate = this.needsUpdate;
    m.minFilter = this.minFilter;
    m.magFilter = this.magFilter;
    m.wrapS = this.wrapS;
    m.wrapT = this.wrapT;
    m.offset = this.offset.clone();
    m.repeat = this.repeat.clone();
    m.center = this.center.clone();
    return m;
  }
}

class MockCanvasTexture extends MockTexture {
  constructor(_canvas?: any) {
    super();
  }
}

// --- Fog ---
class MockFog {
  color: MockColor;
  near: number;
  far: number;
  constructor(color?: number | string, near = 1, far = 1000) {
    this.color = new MockColor(color as number | undefined);
    this.near = near;
    this.far = far;
  }
}

// --- Misc ---
class MockShape {
  moveTo = jest.fn().mockReturnThis();
  lineTo = jest.fn().mockReturnThis();
  absarc = jest.fn().mockReturnThis();
  closePath = jest.fn().mockReturnThis();
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
const DynamicDrawUsage = 35048;

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
  MockFog as Fog,

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
  MockIcosahedronGeometry as IcosahedronGeometry,
  MockWireframeGeometry as WireframeGeometry,

  // Textures
  MockTexture as Texture,
  MockCanvasTexture as CanvasTexture,

  // Materials
  MockMeshStandardMaterial as MeshStandardMaterial,
  MockMeshPhysicalMaterial as MeshPhysicalMaterial,
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
  DynamicDrawUsage,

  // Utils
  MathUtils,
};
