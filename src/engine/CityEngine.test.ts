import { CityEngine } from './CityEngine';
import { BasePrefab } from '../prefabs';
import { Building, BuildingState } from '../types';

// THREE is auto-mocked via src/__mocks__/three.ts; OrbitControls via
// src/__mocks__/three/examples/jsm/controls/OrbitControls.js.ts.

// Test seams into engine internals (private fields)
interface EngineInternals {
  prefabs: Map<string, BasePrefab>;
  animationFrameId: number | null;
  renderer: { dispose: jest.Mock; forceContextLoss: jest.Mock; domElement: HTMLCanvasElement };
  controls: { dispose: jest.Mock; update: jest.Mock };
}

// Captures the callbacks CityEngine registers on IntersectionObserver
let intersectionCallbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void>;

class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    intersectionCallbacks.push(callback);
  }
}

function makeBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: 'b1',
    name: 'Web-1',
    type: 'tower_a',
    location: { x: 0, y: 0 },
    orientation: 'N',
    ...overrides,
  };
}

function makeState(overrides: Partial<BuildingState> = {}): BuildingState {
  return { id: 'web-1', status: 'critical', activity: 'fast', ...overrides };
}

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('CityEngine', () => {
  let container: HTMLDivElement;
  let rafSpy: jest.SpyInstance;
  let cancelSpy: jest.SpyInstance;

  beforeEach(() => {
    intersectionCallbacks = [];
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
    setDocumentHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    container.remove();
  });

  describe('lifecycle', () => {
    it('start() is re-entrant: a second call does not fork a second animation chain', () => {
      const engine = new CityEngine(container);
      engine.start();
      engine.start();
      engine.start();

      expect(rafSpy).toHaveBeenCalledTimes(1);
      engine.dispose();
    });

    it('start() after dispose() is a no-op', () => {
      const engine = new CityEngine(container);
      engine.dispose();
      engine.start();

      expect(rafSpy).not.toHaveBeenCalled();
    });

    it('dispose() is idempotent (double call does not crash) and frees renderer/controls', () => {
      const engine = new CityEngine(container);
      const internals = engine as unknown as EngineInternals;

      expect(() => {
        engine.dispose();
        engine.dispose();
      }).not.toThrow();

      expect(internals.renderer.dispose).toHaveBeenCalled();
      expect(internals.renderer.forceContextLoss).toHaveBeenCalled();
      expect(internals.controls.dispose).toHaveBeenCalled();
      expect(container.contains(internals.renderer.domElement)).toBe(false);
    });

    it('pauses the render loop when the tab is hidden and resumes when visible again', () => {
      const engine = new CityEngine(container);
      engine.start();
      expect(rafSpy).toHaveBeenCalledTimes(1);

      setDocumentHidden(true);
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect((engine as unknown as EngineInternals).animationFrameId).toBeNull();

      setDocumentHidden(false);
      expect(rafSpy).toHaveBeenCalledTimes(2);
      engine.dispose();
    });

    it('pauses the render loop when the panel leaves the viewport and resumes on re-entry', () => {
      const engine = new CityEngine(container);
      engine.start();
      expect(rafSpy).toHaveBeenCalledTimes(1);
      expect(intersectionCallbacks).toHaveLength(1);

      intersectionCallbacks[0]([{ isIntersecting: false }]);
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect((engine as unknown as EngineInternals).animationFrameId).toBeNull();

      intersectionCallbacks[0]([{ isIntersecting: true }]);
      expect(rafSpy).toHaveBeenCalledTimes(2);
      engine.dispose();
    });
  });

  describe('name-based data join', () => {
    it('resolves state.id case-insensitively against building names', () => {
      const engine = new CityEngine(container);
      engine.setBuildings([makeBuilding()]);

      const prefab = (engine as unknown as EngineInternals).prefabs.get('b1');
      expect(prefab).toBeDefined();
      const statusSpy = jest.spyOn(prefab!, 'updateStatus');
      const activitySpy = jest.spyOn(prefab!, 'updateActivity');

      // Query reports 'web-1', layout names the building 'Web-1'
      engine.updateStates([makeState()]);

      expect(statusSpy).toHaveBeenCalledWith('critical');
      expect(activitySpy).toHaveBeenCalledWith('fast');
      engine.dispose();
    });

    it('ignores states with no matching building, without throwing', () => {
      const engine = new CityEngine(container);
      engine.setBuildings([makeBuilding()]);
      const prefab = (engine as unknown as EngineInternals).prefabs.get('b1')!;
      const statusSpy = jest.spyOn(prefab, 'updateStatus');

      expect(() => engine.updateStates([makeState({ id: 'unknown-service' })])).not.toThrow();
      expect(statusSpy).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('a rename keeps the prefab instance and re-points the name join', () => {
      const engine = new CityEngine(container);
      engine.setBuildings([makeBuilding()]);
      const prefab = (engine as unknown as EngineInternals).prefabs.get('b1')!;
      const disposeSpy = jest.spyOn(prefab, 'dispose');

      engine.setBuildings([makeBuilding({ name: 'Web-2' })]);
      const internals = engine as unknown as EngineInternals;

      // Same id, same type: no rebuild
      expect(internals.prefabs.get('b1')).toBe(prefab);
      expect(disposeSpy).not.toHaveBeenCalled();

      // The join follows the new name, not the old one
      const statusSpy = jest.spyOn(prefab, 'updateStatus');
      engine.updateStates([makeState({ id: 'web-2', status: 'warning' })]);
      expect(statusSpy).toHaveBeenCalledWith('warning');

      statusSpy.mockClear();
      engine.updateStates([makeState({ id: 'web-1', status: 'online' })]);
      expect(statusSpy).not.toHaveBeenCalled();
      engine.dispose();
    });

    it('a type change rebuilds the prefab (old instance disposed, new instance created)', () => {
      const engine = new CityEngine(container);
      engine.setBuildings([makeBuilding()]);
      const prefab = (engine as unknown as EngineInternals).prefabs.get('b1')!;
      const disposeSpy = jest.spyOn(prefab, 'dispose');

      engine.setBuildings([makeBuilding({ type: 'pyramid' })]);
      const rebuilt = (engine as unknown as EngineInternals).prefabs.get('b1')!;

      expect(disposeSpy).toHaveBeenCalledTimes(1);
      expect(rebuilt).not.toBe(prefab);

      // The name join still resolves after the rebuild
      const statusSpy = jest.spyOn(rebuilt, 'updateStatus');
      engine.updateStates([makeState({ id: 'web-1', status: 'offline' })]);
      expect(statusSpy).toHaveBeenCalledWith('offline');
      engine.dispose();
    });
  });
});
