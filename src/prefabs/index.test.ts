import { BasePrefab } from './BasePrefab';
import { Building } from '../types';

// Prevent build() from running — we only test the factory dispatch, not geometry construction.
jest.spyOn(BasePrefab.prototype, 'initialize').mockImplementation(function (this: BasePrefab) {
  // Skip build() entirely
});

// Import after mock so the spy is in place
import { createPrefab } from './index';
import { WindmillPrefab } from './Windmill';
import { TowerAPrefab } from './TowerA';
import { TowerBPrefab } from './TowerB';
import { PyramidPrefab } from './Pyramid';
import { LedFacadePrefab } from './LedFacade';
import { MonitorTubePrefab } from './MonitorTube';
import { MonitorTubeGiantPrefab } from './MonitorTubeGiant';
import { BankPrefab } from './Bank';
import { DisplayAPrefab } from './DisplayA';
import { DisplayAGiantPrefab } from './DisplayAGiant';
import { FarmSiloPrefab } from './FarmSilo';

function makeBuilding(type: string, id = 'test-1'): Building {
  return { id, name: 'Test', type: type as any, location: { x: 0, y: 0 } };
}

describe('createPrefab', () => {
  it.each([
    ['windmill', WindmillPrefab],
    ['tower_a', TowerAPrefab],
    ['tower_b', TowerBPrefab],
    ['pyramid', PyramidPrefab],
    ['led_facade', LedFacadePrefab],
    ['monitor_tube', MonitorTubePrefab],
    ['monitor_tube_giant', MonitorTubeGiantPrefab],
    ['bank', BankPrefab],
    ['display_a', DisplayAPrefab],
    ['display_a_giant', DisplayAGiantPrefab],
    ['farm_silo', FarmSiloPrefab],
  ])('creates %s prefab of correct class', (type, expectedClass) => {
    const prefab = createPrefab(makeBuilding(type));
    expect(prefab).toBeInstanceOf(expectedClass);
  });

  it('defaults to WindmillPrefab for unknown type', () => {
    const prefab = createPrefab(makeBuilding('unknown_type'));
    expect(prefab).toBeInstanceOf(WindmillPrefab);
  });

  it('is case-insensitive', () => {
    const prefab = createPrefab(makeBuilding('TOWER_A'));
    expect(prefab).toBeInstanceOf(TowerAPrefab);
  });

  it('sets buildingId in group userData', () => {
    const prefab = createPrefab(makeBuilding('windmill', 'my-id'));
    expect(prefab.getObject().userData.buildingId).toBe('my-id');
  });

  it('calls initialize on created prefab', () => {
    createPrefab(makeBuilding('windmill'));
    expect(BasePrefab.prototype.initialize).toHaveBeenCalled();
  });
});
