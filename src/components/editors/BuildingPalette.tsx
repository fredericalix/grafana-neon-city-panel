import React, { useState } from 'react';

/** The 11 implemented building types */
const BUILDING_TYPES = [
  { value: 'windmill', label: 'Windmill' },
  { value: 'tower_a', label: 'Tower A' },
  { value: 'tower_b', label: 'Tower B' },
  { value: 'pyramid', label: 'Pyramid' },
  { value: 'led_facade', label: 'LED Facade' },
  { value: 'monitor_tube', label: 'Monitor Tube' },
  { value: 'monitor_tube_giant', label: 'Monitor Tube Giant' },
  { value: 'bank', label: 'Bank' },
  { value: 'display_a', label: 'Display A' },
  { value: 'display_a_giant', label: 'Display A Giant' },
  { value: 'farm_silo', label: 'Farm Silo' },
];

interface BuildingPaletteProps {
  onAdd: (type: string) => void;
}

export const BuildingPalette: React.FC<BuildingPaletteProps> = ({ onAdd }) => {
  const [selectedType, setSelectedType] = useState(BUILDING_TYPES[0].value);

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
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
