import { Building } from '../../types';
import { BasePrefab } from './BasePrefab';
import { WindmillPrefab } from './Windmill';
import { HousePrefab } from './House';
import { BakeryPrefab } from './Bakery';
import { BankPrefab } from './Bank';
import { FarmPrefab } from './Farm';
import { TreePrefab } from './Tree';
import { TrafficLightPrefab } from './TrafficLight';
import { DisplayAPrefab } from './DisplayA';
import { TowerAPrefab } from './TowerA';
import { TowerBPrefab } from './TowerB';
import { PyramidPrefab } from './Pyramid';
import { SupervisorPrefab } from './Supervisor';
import { ArcadePrefab } from './Arcade';
import { DataCenterPrefab } from './DataCenter';
import { MonitorTubePrefab } from './MonitorTube';
// Shenzhen-inspired skyscrapers
import { SpirePrefab } from './Spire';
import { LedFacadePrefab } from './LedFacade';
import { DiamondTowerPrefab } from './DiamondTower';
import { TwinTowersPrefab } from './TwinTowers';

export { BasePrefab } from './BasePrefab';
export { COLORS, getStatusColor, createBuildingMaterial } from './materials';
export { WindmillPrefab } from './Windmill';
export { HousePrefab } from './House';
export { BakeryPrefab } from './Bakery';
export { BankPrefab } from './Bank';
export { FarmPrefab } from './Farm';
export { TreePrefab } from './Tree';
export { TrafficLightPrefab } from './TrafficLight';
export { DisplayAPrefab } from './DisplayA';
export { TowerAPrefab } from './TowerA';
export { TowerBPrefab } from './TowerB';
export { PyramidPrefab } from './Pyramid';
export { SupervisorPrefab } from './Supervisor';
export { ArcadePrefab } from './Arcade';
export type { ArcadeState } from './Arcade';
export { DataCenterPrefab } from './DataCenter';
export type { DataCenterMetrics } from './DataCenter';
export { MonitorTubePrefab } from './MonitorTube';
export type { MonitorTubeMetrics, BandData } from './MonitorTube';
// Shenzhen-inspired skyscrapers
export { SpirePrefab } from './Spire';
export { LedFacadePrefab } from './LedFacade';
export { DiamondTowerPrefab } from './DiamondTower';
export { TwinTowersPrefab } from './TwinTowers';
export {
  PyramidBeamShader,
  createPyramidBeamMaterial,
  updatePyramidBeamMaterial,
  BEAM_PRESETS,
} from './PyramidBeamShader';
export {
  SupervisorShader,
  createSupervisorMaterial,
  createBodyMaterial,
  createConeMaterial,
  createRingMaterial,
  createFaceMaterial,
  createEyeSocketMaterial,
  createPupilMaterial,
  MCP_COLORS,
  SUPERVISOR_PRESETS,
} from './SupervisorShader';
export {
  DATA_CENTER_COLORS,
  DATA_CENTER_PRESETS,
  createGridFloorMaterial,
  createHologramMaterial,
  createGaugeRingMaterial,
  createTemperatureBarMaterial,
  createProjectionBeamMaterial,
  createAlertBeaconMaterial,
  createCoolingFanMaterial,
  createVaporMaterial,
  createDigitalDisplayTexture,
} from './DataCenterShader';
export {
  MONITOR_TUBE_COLORS,
  MONITOR_TUBE_PRESETS,
  createRingBandMaterial,
  createMonitorHologramMaterial,
  createHaloMaterial,
  createMonitorGridMaterial,
  createOuterShellMaterial,
  createCapMaterial,
} from './MonitorTubeShader';

/**
 * Factory function to create the appropriate prefab based on building type
 */
export function createPrefab(building: Building): BasePrefab {
  const type = building.type.toLowerCase();
  let prefab: BasePrefab;

  switch (type) {
    case 'windmill':
      prefab = new WindmillPrefab(building);
      break;

    case 'bakery':
      prefab = new BakeryPrefab(building);
      break;

    case 'bank':
      prefab = new BankPrefab(building);
      break;

    case 'house_a':
      prefab = new HousePrefab(building, 'a');
      break;

    case 'house_b':
      prefab = new HousePrefab(building, 'b');
      break;

    case 'house_c':
      prefab = new HousePrefab(building, 'c');
      break;

    case 'farm_building_a':
      prefab = new FarmPrefab(building, 'building_a');
      break;

    case 'farm_building_b':
      prefab = new FarmPrefab(building, 'building_b');
      break;

    case 'farm_silo':
      prefab = new FarmPrefab(building, 'silo');
      break;

    case 'farm_field_a':
      prefab = new FarmPrefab(building, 'field_a');
      break;

    case 'farm_field_b':
      prefab = new FarmPrefab(building, 'field_b');
      break;

    case 'farm_cattle_a':
      prefab = new FarmPrefab(building, 'cattle');
      break;

    case 'tree':
      prefab = new TreePrefab(building);
      break;

    case 'traffic_light':
    case 'feu_circul': // Legacy layouts in DB
      prefab = new TrafficLightPrefab(building);
      break;

    case 'display_a':
    case 'displaya': // Legacy layouts in DB (displayA.toLowerCase())
      prefab = new DisplayAPrefab(building);
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

    case 'supervisor':
      prefab = new SupervisorPrefab(building);
      break;

    case 'arcade':
      prefab = new ArcadePrefab(building);
      break;

    case 'data_center':
      prefab = new DataCenterPrefab(building);
      break;

    case 'monitor_tube':
      prefab = new MonitorTubePrefab(building);
      break;

    // Shenzhen-inspired skyscrapers
    case 'spire':
      prefab = new SpirePrefab(building);
      break;

    case 'led_facade':
      prefab = new LedFacadePrefab(building);
      break;

    case 'diamond_tower':
      prefab = new DiamondTowerPrefab(building);
      break;

    case 'twin_towers':
      prefab = new TwinTowersPrefab(building);
      break;

    default:
      // Default to a simple house for unknown types
      console.warn(`Unknown building type: ${type}, using default`);
      prefab = new HousePrefab(building, 'a');
      break;
  }

  // Call initialize() after construction to build 3D objects
  // This avoids JavaScript class field initialization overwriting values
  prefab.initialize();
  return prefab;
}
