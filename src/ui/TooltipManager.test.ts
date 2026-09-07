import * as THREE from 'three';
import { TooltipManager } from './TooltipManager';
import { LabelManager } from './LabelManager';
import { BasePrefab } from '../prefabs';
import { Building, BuildingState } from '../types';

// THREE is auto-mocked via src/__mocks__/three.ts (moduleNameMapper).
// XSS contract: building names and data-field texts come straight from Grafana
// query results and must never be parsed as HTML — only textContent is allowed.

const IMG_PAYLOAD = '<img src=x onerror="window.__xss = true">';
const SCRIPT_PAYLOAD = '<script>window.__xss = true</script>';

function makeBuilding(name: string): Building {
  return { id: 'b1', name, type: 'tower_a', location: { x: 0, y: 0 } };
}

function expectNoInjectedNodes(container: HTMLElement): void {
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('script')).toBeNull();
}

describe('TooltipManager (XSS safety)', () => {
  let container: HTMLElement;
  let camera: THREE.PerspectiveCamera;
  let canvas: HTMLCanvasElement;
  let manager: TooltipManager;
  const worldPos = new THREE.Vector3(0, 0, 0);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    camera = new THREE.PerspectiveCamera();
    canvas = document.createElement('canvas');
    manager = new TooltipManager(container, camera, canvas);
  });

  afterEach(() => {
    manager.dispose();
    container.remove();
  });

  it('renders a malicious building name in the hover tooltip as plain text', () => {
    manager.showHoverTooltip(makeBuilding(IMG_PAYLOAD), null, worldPos);

    expectNoInjectedNodes(container);
    expect(container.textContent).toContain(IMG_PAYLOAD);
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('renders malicious building name and data texts in the detail tooltip as plain text', () => {
    const state: BuildingState = {
      id: 'b1',
      status: 'warning',
      activity: 'normal',
      text1: SCRIPT_PAYLOAD,
      text2: IMG_PAYLOAD,
    };
    manager.showDetailTooltip(makeBuilding(SCRIPT_PAYLOAD), state, worldPos);

    expectNoInjectedNodes(container);
    expect(container.textContent).toContain(SCRIPT_PAYLOAD);
    expect(container.textContent).toContain(IMG_PAYLOAD);
  });

  it('keeps the XSS contract when a detail tooltip is refreshed with new data', () => {
    manager.showDetailTooltip(makeBuilding('web-1'), null, worldPos);

    const states = new Map<string, BuildingState>([
      ['b1', { id: 'b1', status: 'critical', activity: 'fast', text1: IMG_PAYLOAD }],
    ]);
    manager.refreshDetailTooltips(states);

    expectNoInjectedNodes(container);
    expect(container.textContent).toContain(IMG_PAYLOAD);
  });
});

describe('LabelManager (XSS safety)', () => {
  it('renders a malicious building name in floating labels as plain text', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const camera = new THREE.PerspectiveCamera();
    const canvas = document.createElement('canvas');
    const manager = new LabelManager(container, camera, canvas);

    const building = makeBuilding(IMG_PAYLOAD);
    const fakePrefab = {
      getBuilding: () => building,
      getObject: () => new THREE.Group(),
    } as unknown as BasePrefab;
    const prefabs = new Map<string, BasePrefab>([['b1', fakePrefab]]);

    manager.setBuildings(prefabs);

    expectNoInjectedNodes(container);
    expect(container.textContent).toContain(IMG_PAYLOAD);

    // The rename path (same id set, refreshed text) must hold the line too
    building.name = SCRIPT_PAYLOAD;
    manager.setBuildings(prefabs);
    expectNoInjectedNodes(container);
    expect(container.textContent).toContain(SCRIPT_PAYLOAD);

    manager.dispose();
    container.remove();
  });
});
