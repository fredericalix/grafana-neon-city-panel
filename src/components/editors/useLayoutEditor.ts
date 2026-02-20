import { useState, useCallback } from 'react';
import { CityLayout, LayoutBuilding } from '../../types';

export type EditorMode = 'building' | 'road';

export interface DragState {
  buildingId: string;
  startX: number;
  startZ: number;
  offsetX: number;
  offsetZ: number;
}

export interface LayoutEditorState {
  selectedBuildingId: string | null;
  mode: EditorMode;
  dragState: DragState | null;
}

export function useLayoutEditor(value: CityLayout, onChange: (layout: CityLayout) => void) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('building');
  const [dragState, setDragState] = useState<DragState | null>(null);

  const selectedBuilding = value.buildings.find((b) => b.id === selectedBuildingId) ?? null;

  // ---- Building operations ----

  const addBuilding = useCallback(
    (type: string) => {
      const id = `b${Date.now()}`;
      const name = `${type}-${value.buildings.length + 1}`;
      const newBuilding: LayoutBuilding = { id, name, type, x: 0, z: 0, rotation: 0 };
      onChange({
        ...value,
        buildings: [...value.buildings, newBuilding],
      });
      setSelectedBuildingId(id);
    },
    [value, onChange]
  );

  const updateBuilding = useCallback(
    (id: string, patch: Partial<LayoutBuilding>) => {
      onChange({
        ...value,
        buildings: value.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      });
    },
    [value, onChange]
  );

  const deleteBuilding = useCallback(
    (id: string) => {
      onChange({
        ...value,
        buildings: value.buildings.filter((b) => b.id !== id),
      });
      if (selectedBuildingId === id) {
        setSelectedBuildingId(null);
      }
    },
    [value, onChange, selectedBuildingId]
  );

  // ---- Road operations ----

  const toggleRoadCell = useCallback(
    (worldX: number, worldZ: number) => {
      const roads = value.roads ? [...value.roads] : [];
      const origin = value.roadOrigin ?? { x: 0, z: 0 };

      const gridX = worldX - origin.x;
      const gridZ = worldZ - origin.z;

      // Expand grid if needed
      const minGridX = Math.min(0, gridX);
      const minGridZ = Math.min(0, gridZ);
      const maxGridX = Math.max(gridX, roads.length > 0 ? roads[0].length - 1 : 0);
      const maxGridZ = Math.max(gridZ, roads.length - 1);

      // Recalculate origin if we need to expand in negative direction
      const newOriginX = origin.x + minGridX;
      const newOriginZ = origin.z + minGridZ;
      const width = maxGridX - minGridX + 1;
      const height = maxGridZ - minGridZ + 1;

      // Rebuild road grid with new bounds
      const newRoads: string[] = [];
      for (let z = 0; z < height; z++) {
        let row = '';
        for (let x = 0; x < width; x++) {
          const oldGridX = x + minGridX;
          const oldGridZ = z + minGridZ;
          if (oldGridX >= 0 && oldGridX < (roads[0]?.length ?? 0) && oldGridZ >= 0 && oldGridZ < roads.length) {
            row += roads[oldGridZ][oldGridX];
          } else {
            row += '0';
          }
        }
        newRoads.push(row);
      }

      // Toggle the target cell
      const targetX = worldX - newOriginX;
      const targetZ = worldZ - newOriginZ;
      if (targetZ >= 0 && targetZ < newRoads.length && targetX >= 0 && targetX < newRoads[0].length) {
        const row = newRoads[targetZ];
        const current = row[targetX];
        newRoads[targetZ] = row.substring(0, targetX) + (current === '1' ? '0' : '1') + row.substring(targetX + 1);
      }

      onChange({
        ...value,
        roads: newRoads,
        roadOrigin: { x: newOriginX, z: newOriginZ },
      });
    },
    [value, onChange]
  );

  // ---- Drag operations ----

  const startDrag = useCallback(
    (buildingId: string, svgX: number, svgZ: number) => {
      const building = value.buildings.find((b) => b.id === buildingId);
      if (!building) {
        return;
      }
      setDragState({
        buildingId,
        startX: building.x,
        startZ: building.z,
        offsetX: svgX - building.x,
        offsetZ: svgZ - building.z,
      });
      setSelectedBuildingId(buildingId);
    },
    [value]
  );

  const moveDrag = useCallback(
    (svgX: number, svgZ: number) => {
      if (!dragState) {
        return;
      }
      const newX = Math.round(svgX - dragState.offsetX);
      const newZ = Math.round(svgZ - dragState.offsetZ);
      updateBuilding(dragState.buildingId, { x: newX, z: newZ });
    },
    [dragState, updateBuilding]
  );

  const endDrag = useCallback(() => {
    setDragState(null);
  }, []);

  return {
    // State
    selectedBuildingId,
    selectedBuilding,
    mode,
    dragState,
    // Setters
    setSelectedBuildingId,
    setMode,
    // Building ops
    addBuilding,
    updateBuilding,
    deleteBuilding,
    // Road ops
    toggleRoadCell,
    // Drag ops
    startDrag,
    moveDrag,
    endDrag,
  };
}
