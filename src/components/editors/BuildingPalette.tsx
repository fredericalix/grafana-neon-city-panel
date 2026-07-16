import React, { useState } from 'react';
import { BuildingType, IMPLEMENTED_BUILDING_TYPES } from '../../types';

const BUILDING_TYPES = IMPLEMENTED_BUILDING_TYPES;

interface BuildingPaletteProps {
  onAdd: (type: BuildingType) => void;
}

export const BuildingPalette: React.FC<BuildingPaletteProps> = ({ onAdd }) => {
  const [selectedType, setSelectedType] = useState<BuildingType>(BUILDING_TYPES[0].value);

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as BuildingType)}
        style={{
          flex: 1,
          background: '#1a1a2e',
          color: '#e0e0e0',
          border: '1px solid #333',
          borderRadius: 4,
          padding: '4px 6px',
          fontSize: 12,
        }}
      >
        {BUILDING_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => onAdd(selectedType)}
        style={{
          background: '#00e5ff22',
          color: '#00e5ff',
          border: '1px solid #00e5ff44',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        + Add
      </button>
    </div>
  );
};
