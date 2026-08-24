import * as THREE from 'three';
import { RoadNetwork } from './RoadNetwork';

// THREE is auto-mocked via src/__mocks__/three.ts (moduleNameMapper).
// Each mock material instance carries its own dispose = jest.fn().

describe('RoadNetwork', () => {
  const origin = { x: 0, z: 0 };

  it('builds without throwing for a simple grid', () => {
    const road = new RoadNetwork();
    expect(() => road.build(['111', '101', '111'], origin)).not.toThrow();
  });

  it('disposes each shared material exactly once (regression: double-dispose of shared materials)', () => {
    const road = new RoadNetwork();
    road.build(['111', '101', '111'], origin);

    // Capture the shared material instances before dispose nulls them out.
    const r = road as unknown as {
      roadMaterial: { dispose: jest.Mock } | null;
      neonEdgeMaterial: { dispose: jest.Mock } | null;
      centerLineMaterial: { dispose: jest.Mock } | null;
    };
    const roadMat = r.roadMaterial;
    const neonMat = r.neonEdgeMaterial;
    const centerMat = r.centerLineMaterial;

    expect(roadMat).not.toBeNull();
    expect(neonMat).not.toBeNull();
    expect(centerMat).not.toBeNull();

    road.dispose();

    // Shared across many lines, but must be disposed only once each.
    expect(roadMat!.dispose).toHaveBeenCalledTimes(1);
    expect(neonMat!.dispose).toHaveBeenCalledTimes(1);
    expect(centerMat!.dispose).toHaveBeenCalledTimes(1);

    // Fields cleared so a later dispose() is a no-op.
    expect(r.roadMaterial).toBeNull();
    expect(r.neonEdgeMaterial).toBeNull();
    expect(r.centerLineMaterial).toBeNull();
  });

  it('rebuilding disposes the previous materials before creating new ones', () => {
    const road = new RoadNetwork();
    road.build(['11'], origin);
    const firstNeon = (road as unknown as { neonEdgeMaterial: { dispose: jest.Mock } }).neonEdgeMaterial;

    road.build(['11'], origin); // triggers disposeRoads() on the first set

    expect(firstNeon.dispose).toHaveBeenCalledTimes(1);
  });

  it('merges neon edges and center dashes into one LineSegments each (draw-call regression)', () => {
    const road = new RoadNetwork();
    // Single straight row: every cell boundary gets neon edges and the three
    // middle cells get horizontal center dashes — still only 3 draw calls.
    road.build(['11111'], origin);

    const children = road.getObject().children;
    const meshes = children.filter((c) => c instanceof THREE.Mesh);
    const lines = children.filter((c) => c instanceof THREE.Line);

    expect(meshes).toHaveLength(1); // merged road surfaces
    expect(lines).toHaveLength(2); // 1 neon-edge + 1 center-dash LineSegments
    for (const line of lines) {
      expect(line).toBeInstanceOf(THREE.LineSegments);
    }
  });
});
