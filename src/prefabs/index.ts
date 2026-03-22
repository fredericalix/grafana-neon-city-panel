import { Building } from '../types';
import { BasePrefab } from './BasePrefab';
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

export { BasePrefab } from './BasePrefab';
export { COLORS, getStatusColor, createBuildingMaterial, createMetalMaterial } from './materials';
export { WindmillPrefab } from './Windmill';
export { TowerAPrefab } from './TowerA';
export { TowerBPrefab } from './TowerB';
export { PyramidPrefab } from './Pyramid';
export { LedFacadePrefab } from './LedFacade';
export { MonitorTubePrefab } from './MonitorTube';
export { MonitorTubeGiantPrefab } from './MonitorTubeGiant';
export { BankPrefab } from './Bank';
export { DisplayAPrefab } from './DisplayA';
export { DisplayAGiantPrefab } from './DisplayAGiant';
export { FarmSiloPrefab } from './FarmSilo';

/**
 * Factory function to create the appropriate prefab based on building type.
 */
export function createPrefab(building: Building): BasePrefab {
  const type = building.type.toLowerCase();
  let prefab: BasePrefab;

  switch (type) {
    case 'windmill':
      prefab = new WindmillPrefab(building);
      break;

    case 'tower_a':
      prefab = new TowerAPrefab(building);
      break;

    case 'tower_b':
      prefab = new TowerBPrefab(building);
      break;

    case 'pyramid':
      prefab = new PyramidPrefab(building);
      break;

    case 'led_facade':
      prefab = new LedFacadePrefab(building);
      break;

    case 'monitor_tube':
      prefab = new MonitorTubePrefab(building);
      break;

    case 'monitor_tube_giant':
      prefab = new MonitorTubeGiantPrefab(building);
      break;

    case 'bank':
      prefab = new BankPrefab(building);
      break;

    case 'display_a':
      prefab = new DisplayAPrefab(building);
      break;

    case 'display_a_giant':
      prefab = new DisplayAGiantPrefab(building);
      break;

    case 'farm_silo':
      prefab = new FarmSiloPrefab(building);
      break;

    default:
      // Default to windmill for unknown types
      prefab = new WindmillPrefab(building);
      break;
  }

  prefab.initialize();
  return prefab;
}
