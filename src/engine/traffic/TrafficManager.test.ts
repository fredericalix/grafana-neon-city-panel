import * as THREE from 'three';
import { TrafficManager } from './TrafficManager';
import { PathGenerator } from './PathGenerator';
import { VehicleBase } from './VehicleBase';

// THREE is auto-mocked via src/__mocks__/three.ts (moduleNameMapper).

const ORIGIN = { x: 0, z: 0 };
// One isolated road cell: no neighbors, so no path of >= 3 points can ever
// be generated.
const DEAD_END_ROADS = ['1'];
// 3x3 block: plenty of room for valid paths.
const CONNECTED_ROADS = ['111', '111', '111'];

describe('TrafficManager', () => {
  let scene: THREE.Scene;
  let warnSpy: jest.SpyInstance;
  let pathSpy: jest.SpyInstance;

  beforeEach(() => {
    scene = new THREE.Scene();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    pathSpy = jest.spyOn(PathGenerator.prototype, 'generateRandomPath');
  });

  afterEach(() => {
    warnSpy.mockRestore();
    pathSpy.mockRestore();
  });

  describe('spawn suspension on hopeless road networks', () => {
    it('gives up after MAX_SPAWN_FAILURES attempts, warns once, and stops allocating', () => {
      const manager = new TrafficManager(scene);
      manager.setRoads(DEAD_END_ROADS, ORIGIN);
      manager.setDensity(50);
      manager.setEnabled(true);

      // dt large enough that every update clears the spawn interval
      for (let i = 0; i < 30; i++) {
        manager.update(5);
      }

      // Exactly 10 path-generation attempts (MAX_SPAWN_FAILURES), then suspension
      expect(pathSpy).toHaveBeenCalledTimes(10);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('[neon-city-panel]');
      // No vehicle was ever allocated
      expect(manager.getVehicleCount()).toBe(0);
      expect(scene.children).toHaveLength(0);

      // More frames must not retry: allocation would churn GPU resources
      manager.update(5);
      manager.update(5);
      expect(pathSpy).toHaveBeenCalledTimes(10);
      manager.dispose();
    });

    it('setRoads() rearms spawning after a suspension', () => {
      const manager = new TrafficManager(scene);
      manager.setRoads(DEAD_END_ROADS, ORIGIN);
      manager.setDensity(50);
      manager.setEnabled(true);

      for (let i = 0; i < 30; i++) {
        manager.update(5);
      }
      expect(pathSpy).toHaveBeenCalledTimes(10);
      expect(manager.getVehicleCount()).toBe(0);

      manager.setRoads(CONNECTED_ROADS, ORIGIN);
      pathSpy.mockClear();

      manager.update(5);
      expect(manager.getVehicleCount()).toBeGreaterThan(0);
      manager.dispose();
    });
  });

  describe('resource disposal', () => {
    function spawnVehicles(manager: TrafficManager, frames: number): void {
      manager.setRoads(CONNECTED_ROADS, ORIGIN);
      manager.setDensity(100);
      manager.setEnabled(true);
      for (let i = 0; i < frames; i++) {
        manager.update(5);
      }
    }

    it('dispose() disposes every active vehicle and removes it from the scene', () => {
      const disposeSpy = jest.spyOn(VehicleBase.prototype, 'dispose');
      const manager = new TrafficManager(scene);
      spawnVehicles(manager, 3);

      const count = manager.getVehicleCount();
      expect(count).toBeGreaterThan(0);
      expect(scene.children.length).toBe(count * 2); // vehicle group + trail mesh

      manager.dispose();

      expect(disposeSpy).toHaveBeenCalledTimes(count);
      expect(manager.getVehicleCount()).toBe(0);
      expect(scene.children).toHaveLength(0);
      disposeSpy.mockRestore();
    });

    it('clearAllVehicles() also disposes vehicles mid fade-out (setEnabled(false) first)', () => {
      const disposeSpy = jest.spyOn(VehicleBase.prototype, 'dispose');
      const manager = new TrafficManager(scene);
      spawnVehicles(manager, 3);

      const count = manager.getVehicleCount();
      expect(count).toBeGreaterThan(0);

      // Moves active vehicles into the disposal (fade-out) queue
      manager.setEnabled(false);
      expect(manager.getVehicleCount()).toBe(0);

      manager.dispose();

      expect(disposeSpy).toHaveBeenCalledTimes(count);
      expect(scene.children).toHaveLength(0);
      disposeSpy.mockRestore();
    });
  });
});
