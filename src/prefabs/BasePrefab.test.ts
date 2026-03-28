import * as THREE from 'three';
import { BasePrefab } from './BasePrefab';
import { Building, BuildingStatus, BuildingActivity } from '../types';
import { getStatusColor } from './materials';

// Concrete test subclass — minimal build() to test BasePrefab logic without heavy geometry
class TestPrefab extends BasePrefab {
  protected build(): void {
    // Create a simple glow mesh so we can test status color and pulse updates
    const geo = new THREE.SphereGeometry(0.1, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
    this.addGlowMesh(mesh);
  }

  protected onStatusChange(_status: BuildingStatus): void {
    // no-op for test
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // no-op for test
  }
}

function makeBuilding(id = 'test-1'): Building {
  return { id, name: 'Test', type: 'windmill', location: { x: 0, y: 0 } };
}

function createTestPrefab(id?: string): TestPrefab {
  const prefab = new TestPrefab(makeBuilding(id));
  prefab.initialize();
  return prefab;
}

describe('BasePrefab', () => {
  describe('getObject / getBuilding', () => {
    it('returns the Three.js group with buildingId', () => {
      const prefab = createTestPrefab('b-42');
      const group = prefab.getObject();
      expect(group).toBeDefined();
      expect(group.userData.buildingId).toBe('b-42');
    });

    it('returns the building config', () => {
      const building = makeBuilding('b-99');
      const prefab = new TestPrefab(building);
      prefab.initialize();
      expect(prefab.getBuilding()).toBe(building);
    });
  });

  describe('updateStatus', () => {
    it.each<BuildingStatus>(['online', 'offline', 'warning', 'critical'])(
      'updates glow mesh color for status "%s"',
      (status) => {
        const prefab = createTestPrefab();
        prefab.updateStatus(status);

        // Verify the glow mesh color was set to the status color
        const group = prefab.getObject();
        const glowMesh = group.children[0] as THREE.Mesh;
        const mat = glowMesh.material as THREE.MeshBasicMaterial;
        const expectedColor = new THREE.Color(getStatusColor(status));
        expect(mat.color.r).toBeCloseTo(expectedColor.r, 2);
        expect(mat.color.g).toBeCloseTo(expectedColor.g, 2);
        expect(mat.color.b).toBeCloseTo(expectedColor.b, 2);
      }
    );
  });

  describe('updateActivity', () => {
    it.each<BuildingActivity>(['slow', 'normal', 'fast'])(
      'accepts activity "%s" without error',
      (activity) => {
        const prefab = createTestPrefab();
        expect(() => prefab.updateActivity(activity)).not.toThrow();
      }
    );
  });

  describe('update (animation tick)', () => {
    it('updates glow mesh opacity via pulse', () => {
      const prefab = createTestPrefab();
      const group = prefab.getObject();
      const glowMesh = group.children[0] as THREE.Mesh;
      const mat = glowMesh.material as THREE.MeshBasicMaterial;

      // Run several ticks to ensure the pulse changes
      for (let i = 0; i < 20; i++) {
        prefab.update(0.05);
      }
      // Opacity should have changed from the initial value at some point
      // (it oscillates between 0.3 and 0.9)
      expect(mat.opacity).toBeGreaterThanOrEqual(0.3);
      expect(mat.opacity).toBeLessThanOrEqual(0.9);
    });

    it('does not throw with zero deltaTime', () => {
      const prefab = createTestPrefab();
      expect(() => prefab.update(0)).not.toThrow();
    });
  });

  describe('updateData', () => {
    it('does not throw (base implementation is no-op)', () => {
      const prefab = createTestPrefab();
      expect(() =>
        prefab.updateData({ id: 'test-1', status: 'online', activity: 'normal' })
      ).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('calls dispose on geometry and materials', () => {
      const prefab = createTestPrefab();
      const group = prefab.getObject();
      const glowMesh = group.children[0] as THREE.Mesh;

      prefab.dispose();

      expect(glowMesh.geometry.dispose).toHaveBeenCalled();
      expect((glowMesh.material as THREE.MeshBasicMaterial).dispose).toHaveBeenCalled();
    });
  });
});
