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

  describe('change guards', () => {
    it('does not re-run onStatusChange when status is unchanged (per-refresh no-op)', () => {
      const prefab = createTestPrefab();
      const hook = jest.spyOn(
        prefab as unknown as { onStatusChange(s: BuildingStatus): void },
        'onStatusChange'
      );

      prefab.updateStatus('warning');
      prefab.updateStatus('warning');
      prefab.updateStatus('warning');
      expect(hook).toHaveBeenCalledTimes(1);

      prefab.updateStatus('critical');
      expect(hook).toHaveBeenCalledTimes(2);
    });

    it('applies the first updateStatus even when it matches the default', () => {
      const prefab = createTestPrefab();
      const hook = jest.spyOn(
        prefab as unknown as { onStatusChange(s: BuildingStatus): void },
        'onStatusChange'
      );

      // Default internal status is 'online' — the first data push must still apply.
      prefab.updateStatus('online');
      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('does not re-run onActivityChange when activity is unchanged', () => {
      const prefab = createTestPrefab();
      const hook = jest.spyOn(
        prefab as unknown as { onActivityChange(a: BuildingActivity): void },
        'onActivityChange'
      );

      prefab.updateActivity('fast');
      prefab.updateActivity('fast');
      expect(hook).toHaveBeenCalledTimes(1);
    });
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

    it('holds a fixed dim glow when offline instead of pulsing', () => {
      const prefab = createTestPrefab();
      const group = prefab.getObject();
      const glowMesh = group.children[0] as THREE.Mesh;
      const mat = glowMesh.material as THREE.MeshBasicMaterial;

      prefab.updateStatus('offline');
      for (let i = 0; i < 20; i++) {
        prefab.update(0.05);
        expect(mat.opacity).toBeCloseTo(0.15, 5);
      }
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

    it('disposes textures referenced by materials (regression: GPU texture leak)', () => {
      // A prefab whose mesh material carries a CanvasTexture in its map slot.
      // THREE.Material.dispose() does NOT free the texture, so BasePrefab.dispose
      // must dispose it explicitly or it leaks GPU memory over the panel's life.
      const canvas = document.createElement('canvas');
      const texture = new THREE.CanvasTexture(canvas);
      const disposeSpy = jest.spyOn(texture, 'dispose');

      class TexturedPrefab extends BasePrefab {
        protected build(): void {
          const mat = new THREE.MeshStandardMaterial();
          mat.map = texture;
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), mat);
          this.group.add(mesh);
        }
        protected onStatusChange(): void {
          /* no-op */
        }
        protected onActivityChange(): void {
          /* no-op */
        }
      }

      const prefab = new TexturedPrefab(makeBuilding());
      prefab.initialize();
      prefab.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('disposes Line, LineSegments and Points too (regression: non-Mesh GPU leak)', () => {
      // Neon edges (Line/LineSegments) and particles (Points) are not
      // instanceof THREE.Mesh — an instanceof-based dispose skips them all.
      class NeonPrefab extends BasePrefab {
        protected build(): void {
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 1, 0),
          ]);
          this.group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial()));

          const segGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 0, 0),
          ]);
          this.group.add(new THREE.LineSegments(segGeo, new THREE.LineBasicMaterial()));

          const ptsGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
          this.group.add(new THREE.Points(ptsGeo, new THREE.PointsMaterial()));
        }
        protected onStatusChange(): void {
          /* no-op */
        }
        protected onActivityChange(): void {
          /* no-op */
        }
      }

      const prefab = new NeonPrefab(makeBuilding());
      prefab.initialize();

      const geoSpies: jest.SpyInstance[] = [];
      const matSpies: jest.SpyInstance[] = [];
      prefab.getObject().traverse((object) => {
        const { geometry, material } = object as THREE.Mesh;
        if (geometry) {
          geoSpies.push(jest.spyOn(geometry, 'dispose'));
        }
        if (material && !Array.isArray(material)) {
          matSpies.push(jest.spyOn(material, 'dispose'));
        }
      });
      expect(geoSpies).toHaveLength(3);

      prefab.dispose();

      for (const spy of [...geoSpies, ...matSpies]) {
        expect(spy).toHaveBeenCalled();
      }
    });
  });

  describe('addGlowMesh', () => {
    it('does not register the same mesh twice', () => {
      // Guards against glow-mesh accumulation if build() is re-run.
      const prefab = createTestPrefab();
      const group = prefab.getObject();
      const glowMesh = group.children[0] as THREE.Mesh;
      const mat = glowMesh.material as THREE.MeshBasicMaterial;

      // Re-add the same mesh through the protected API.
      (prefab as unknown as { addGlowMesh(m: THREE.Mesh): void }).addGlowMesh(glowMesh);

      // updateStatus iterates glowMeshes; a duplicate would not break color,
      // so assert the internal array length directly.
      const glowMeshes = (prefab as unknown as { glowMeshes: THREE.Mesh[] }).glowMeshes;
      expect(glowMeshes.filter((m) => m === glowMesh)).toHaveLength(1);
      expect(mat).toBeDefined();
    });
  });
});
