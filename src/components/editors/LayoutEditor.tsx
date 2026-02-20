import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { CityLayout } from '../../types';
import { useLayoutEditor } from './useLayoutEditor';
import { LayoutGrid } from './LayoutGrid';
import { BuildingPalette } from './BuildingPalette';
import { BuildingProperties } from './BuildingProperties';

type Props = StandardEditorProps<CityLayout>;

export const LayoutEditor: React.FC<Props> = ({ value, onChange }) => {
  const editor = useLayoutEditor(value, onChange);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toolbar: mode toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => editor.setMode('building')}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 4,
            cursor: 'pointer',
            border: editor.mode === 'building' ? '1px solid #00e5ff' : '1px solid #333',
            background: editor.mode === 'building' ? '#00e5ff22' : '#1a1a2e',
            color: editor.mode === 'building' ? '#00e5ff' : '#888',
          }}
        >
          Buildings
        </button>
        <button
          onClick={() => {
            editor.setMode('road');
            editor.setSelectedBuildingId(null);
          }}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 11,
            borderRadius: 4,
            cursor: 'pointer',
            border: editor.mode === 'road' ? '1px solid #ffab00' : '1px solid #333',
            background: editor.mode === 'road' ? '#ffab0022' : '#1a1a2e',
            color: editor.mode === 'road' ? '#ffab00' : '#888',
          }}
        >
          Roads
        </button>
      </div>

      {/* SVG Grid */}
      <LayoutGrid
        layout={value}
        selectedBuildingId={editor.selectedBuildingId}
        mode={editor.mode}
        dragState={editor.dragState}
        onSelectBuilding={editor.setSelectedBuildingId}
        onStartDrag={editor.startDrag}
        onMoveDrag={editor.moveDrag}
        onEndDrag={editor.endDrag}
        onToggleRoad={editor.toggleRoadCell}
      />

      {/* Mode hint */}
      <div style={{ color: '#666', fontSize: 10, textAlign: 'center' }}>
        {editor.mode === 'building'
          ? 'Click to select \u2022 Drag to move'
          : 'Click cells to toggle roads'}
      </div>

      {/* Building palette (building mode) */}
      {editor.mode === 'building' && <BuildingPalette onAdd={editor.addBuilding} />}

      {/* Building properties (when selected) */}
      {editor.selectedBuilding && (
        <BuildingProperties
          building={editor.selectedBuilding}
          onUpdate={editor.updateBuilding}
          onDelete={editor.deleteBuilding}
        />
      )}

      {/* Stats */}
      <div style={{ color: '#555', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>{value.buildings.length} buildings</span>
        <span>{value.roads?.length ?? 0} road rows</span>
      </div>
    </div>
  );
};
