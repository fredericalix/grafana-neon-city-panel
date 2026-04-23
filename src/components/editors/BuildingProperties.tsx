import React from 'react';
import { BuildingType, LayoutBuilding } from '../../types';

const BUILDING_TYPES: Array<{ value: BuildingType; label: string }> = [
  { value: 'windmill', label: 'Windmill' },
  { value: 'tower_a', label: 'Tower A' },
  { value: 'tower_b', label: 'Tower B' },
  { value: 'pyramid', label: 'Pyramid' },
  { value: 'led_facade', label: 'LED Facade' },
  { value: 'monitor_tube', label: 'Monitor Tube' },
  { value: 'bank', label: 'Bank' },
  { value: 'display_a', label: 'Display A' },
];

const NEON_COLOR_PRESETS = [
  { value: '', label: 'Cyan (default)' },
  { value: '#ff00ff', label: 'Magenta' },
  { value: '#33ff66', label: 'Green' },
  { value: '#4488ff', label: 'Blue' },
  { value: '#ffaa00', label: 'Orange' },
  { value: '#ff4444', label: 'Red' },
];

const ROTATION_PRESETS = [
  { value: 0, label: '0° (N)' },
  { value: 90, label: '90° (E)' },
  { value: 180, label: '180° (S)' },
  { value: 270, label: '270° (W)' },
];

interface BuildingPropertiesProps {
  building: LayoutBuilding;
  onUpdate: (id: string, patch: Partial<LayoutBuilding>) => void;
  onDelete: (id: string) => void;
}

const inputStyle: React.CSSProperties = {
  background: '#1a1a2e',
  color: '#e0e0e0',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 12,
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 10,
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const rowStyle: React.CSSProperties = {
  marginBottom: 6,
};

export const BuildingProperties: React.FC<BuildingPropertiesProps> = ({ building, onUpdate, onDelete }) => {
  return (
    <div
      style={{
        background: '#0a0a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: 8,
      }}
    >
      <div style={{ color: '#00e5ff', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
        Selected: {building.name}
      </div>

      {/* Name */}
      <div style={rowStyle}>
        <div style={labelStyle}>Name</div>
        <input
          type="text"
          value={building.name}
          onChange={(e) => onUpdate(building.id, { name: e.target.value })}
          style={inputStyle}
        />
      </div>

      {/* Display Text — only for text-capable building types */}
      {['tower_a', 'tower_b', 'display_a'].includes(building.type) && (
        <div style={rowStyle}>
          <div style={labelStyle}>Display Text</div>
          <input
            type="text"
            value={building.defaultText || ''}
            placeholder="WHOOKTOWN"
            onChange={(e) => onUpdate(building.id, { defaultText: e.target.value || undefined })}
            style={inputStyle}
          />
        </div>
      )}

      {/* Neon Color — only for MonitorTubeGiant */}
      {['monitor_tube_giant', 'display_a_giant'].includes(building.type) && (
        <div style={rowStyle}>
          <div style={labelStyle}>Neon Color</div>
          <select
            value={building.color || ''}
            onChange={(e) => onUpdate(building.id, { color: e.target.value || undefined })}
            style={inputStyle}
          >
            {NEON_COLOR_PRESETS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Type */}
      <div style={rowStyle}>
        <div style={labelStyle}>Type</div>
        <select
          value={building.type}
          onChange={(e) => onUpdate(building.id, { type: e.target.value as BuildingType })}
          style={inputStyle}
        >
          {BUILDING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Position */}
      <div style={{ ...rowStyle, display: 'flex', gap: 4 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>X</div>
          <input
            type="number"
            value={building.x}
            onChange={(e) => onUpdate(building.id, { x: parseInt(e.target.value, 10) || 0 })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Z</div>
          <input
            type="number"
            value={building.z}
            onChange={(e) => onUpdate(building.id, { z: parseInt(e.target.value, 10) || 0 })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Rotation */}
      <div style={rowStyle}>
        <div style={labelStyle}>Rotation</div>
        <select
          value={building.rotation}
          onChange={(e) => onUpdate(building.id, { rotation: parseInt(e.target.value, 10) })}
          style={inputStyle}
        >
          {ROTATION_PRESETS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(building.id)}
        style={{
          background: '#ff404122',
          color: '#ff4041',
          border: '1px solid #ff404144',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 11,
          width: '100%',
          marginTop: 4,
        }}
      >
        Delete Building
      </button>
    </div>
  );
};
