import { DataPacket } from './DataPacket';
import { TrailSystem } from './TrailSystem';

// THREE is auto-mocked via src/__mocks__/three.ts (moduleNameMapper).
// Each mock geometry/material instance carries its own dispose = jest.fn().

interface Disposable {
  dispose: jest.Mock;
}

describe('DataPacket dispose', () => {
  it('frees every geometry and material in the group, including the THREE.Points particle aura', () => {
    const packet = new DataPacket(0xff00ff);
    packet.initialize();

    // Collect resources before dispose. Regression: THREE.Points is neither
    // Mesh nor Line, so the old instanceof-based dispose() leaked the
    // particle aura's geometry and material on every vehicle destruction.
    const geometries: Disposable[] = [];
    const materials: Disposable[] = [];
    packet.getObject().traverse((child) => {
      const { geometry, material } = child as unknown as {
        geometry?: Disposable;
        material?: Disposable | Disposable[];
      };
      if (geometry?.dispose) {
        geometries.push(geometry);
      }
      if (Array.isArray(material)) {
        materials.push(...material);
      } else if (material?.dispose) {
        materials.push(material);
      }
    });

    expect(geometries.length).toBeGreaterThan(0);
    expect(materials.length).toBeGreaterThan(0);

    packet.dispose();

    for (const geometry of geometries) {
      expect(geometry.dispose).toHaveBeenCalledTimes(1);
    }
    for (const material of materials) {
      expect(material.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('frees the trail geometry and material too', () => {
    const packet = new DataPacket(0xff00ff);
    packet.initialize();

    const trail = (packet as unknown as { trail: TrailSystem }).trail;
    const trailGeometry = trail.getObject().geometry as unknown as Disposable;
    const trailMaterial = trail.getObject().material as unknown as Disposable;

    packet.dispose();

    expect(trailGeometry.dispose).toHaveBeenCalledTimes(1);
    expect(trailMaterial.dispose).toHaveBeenCalledTimes(1);
  });
});
