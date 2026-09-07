/**
 * Manual Jest mock for three/examples/jsm/controls/OrbitControls.js
 * No DOM event wiring — just the shape CityEngine interacts with.
 */
export class OrbitControls {
  object: unknown;
  domElement: unknown;
  enableDamping = false;
  dampingFactor = 0.05;
  maxPolarAngle = Math.PI;
  minDistance = 0;
  maxDistance = Infinity;
  enabled = true;

  update = jest.fn().mockReturnValue(true);
  dispose = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();

  constructor(object?: unknown, domElement?: unknown) {
    this.object = object;
    this.domElement = domElement;
  }
}
