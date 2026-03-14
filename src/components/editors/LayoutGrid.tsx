import React, { useCallback, useMemo, useRef } from 'react';
import { CityLayout } from '../../types';
import { EditorMode, DragState } from './useLayoutEditor';

/** Color per building type for the SVG grid */
const TYPE_COLORS: Record<string, string> = {
  windmill: '#00e5ff',
  tower_a: '#ff4081',
  tower_b: '#7c4dff',
  pyramid: '#ffab00',
  led_facade: '#00e676',
  monitor_tube: '#448aff',
  monitor_tube_giant: '#2979ff',
  bank: '#ffd740',
  display_a: '#ea80fc',
  display_a_giant: '#ce93d8',
};

const CELL = 16; // px per grid unit
const PADDING = 2; // grid units padding around content
const ROAD_COLOR = '#1a1a2e';
const ROAD_BORDER = '#00e5ff';
const GRID_LINE_COLOR = '#ffffff10';
const SELECTED_GLOW = '#00e5ff';

interface LayoutGridProps {
  layout: CityLayout;
  selectedBuildingId: string | null;
  mode: EditorMode;
  dragState: DragState | null;
  onSelectBuilding: (id: string | null) => void;
  onStartDrag: (id: string, svgX: number, svgZ: number) => void;
  onMoveDrag: (svgX: number, svgZ: number) => void;
  onEndDrag: () => void;
  onToggleRoad: (worldX: number, worldZ: number) => void;
}

export const LayoutGrid: React.FC<LayoutGridProps> = ({
  layout,
  selectedBuildingId,
  mode,
  dragState,
  onSelectBuilding,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
  onToggleRoad,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Compute grid bounds from buildings + roads
  const bounds = useMemo(() => {
    let minX = -5, maxX = 5, minZ = -5, maxZ = 5;

    for (const b of layout.buildings) {
      minX = Math.min(minX, b.x - 1);
      maxX = Math.max(maxX, b.x + 1);
      minZ = Math.min(minZ, b.z - 1);
      maxZ = Math.max(maxZ, b.z + 1);
    }

    if (layout.roads && layout.roadOrigin) {
      const o = layout.roadOrigin;
      minX = Math.min(minX, o.x);
      maxX = Math.max(maxX, o.x + (layout.roads[0]?.length ?? 0));
      minZ = Math.min(minZ, o.z);
      maxZ = Math.max(maxZ, o.z + layout.roads.length);
    }

    return {
      minX: minX - PADDING,
      maxX: maxX + PADDING,
      minZ: minZ - PADDING,
      maxZ: maxZ + PADDING,
    };
  }, [layout]);

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;
  const svgWidth = width * CELL;
  const svgHeight = height * CELL;

  // Convert SVG pixel coordinates to world coordinates
  const svgToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) {
        return { x: 0, z: 0 };
      }
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * width + bounds.minX;
      const z = ((clientY - rect.top) / rect.height) * height + bounds.minZ;
      return { x, z };
    },
    [bounds, width, height]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode === 'road') {
        const { x, z } = svgToWorld(e.clientX, e.clientY);
        onToggleRoad(Math.round(x), Math.round(z));
        return;
      }
      // In building mode: click on empty space deselects
      onSelectBuilding(null);
    },
    [mode, svgToWorld, onToggleRoad, onSelectBuilding]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragState) {
        const { x, z } = svgToWorld(e.clientX, e.clientY);
        onMoveDrag(x, z);
      }
    },
    [dragState, svgToWorld, onMoveDrag]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState) {
      onEndDrag();
    }
  }, [dragState, onEndDrag]);

  const handleBuildingMouseDown = useCallback(
    (e: React.MouseEvent, buildingId: string) => {
      if (mode !== 'building') {
        return;
      }
      e.stopPropagation();
      const { x, z } = svgToWorld(e.clientX, e.clientY);
      onStartDrag(buildingId, x, z);
    },
    [mode, svgToWorld, onStartDrag]
  );

  // Road cells from layout
  const roadCells = useMemo(() => {
    const cells: Array<{ x: number; z: number }> = [];
    if (!layout.roads || !layout.roadOrigin) {
      return cells;
    }
    const o = layout.roadOrigin;
    for (let rz = 0; rz < layout.roads.length; rz++) {
      const row = layout.roads[rz];
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === '1') {
          cells.push({ x: o.x + rx, z: o.z + rz });
        }
      }
    }
    return cells;
  }, [layout.roads, layout.roadOrigin]);

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: React.ReactElement[] = [];
    for (let x = Math.ceil(bounds.minX); x <= Math.floor(bounds.maxX); x++) {
      const px = (x - bounds.minX) * CELL;
      lines.push(
        <line key={`v${x}`} x1={px} y1={0} x2={px} y2={svgHeight} stroke={GRID_LINE_COLOR} strokeWidth={0.5} />
      );
    }
    for (let z = Math.ceil(bounds.minZ); z <= Math.floor(bounds.maxZ); z++) {
      const py = (z - bounds.minZ) * CELL;
      lines.push(
        <line key={`h${z}`} x1={0} y1={py} x2={svgWidth} y2={py} stroke={GRID_LINE_COLOR} strokeWidth={0.5} />
      );
    }
    return lines;
  }, [bounds, svgWidth, svgHeight]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{
        width: '100%',
        maxHeight: 400,
        background: '#0a0a1a',
        borderRadius: 4,
        cursor: mode === 'road' ? 'crosshair' : dragState ? 'grabbing' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid lines */}
      {gridLines}

      {/* Origin crosshair */}
      <line
        x1={(0 - bounds.minX) * CELL - 4}
        y1={(0 - bounds.minZ) * CELL}
        x2={(0 - bounds.minX) * CELL + 4}
        y2={(0 - bounds.minZ) * CELL}
        stroke="#ffffff40"
        strokeWidth={1}
      />
      <line
        x1={(0 - bounds.minX) * CELL}
        y1={(0 - bounds.minZ) * CELL - 4}
        x2={(0 - bounds.minX) * CELL}
        y2={(0 - bounds.minZ) * CELL + 4}
        stroke="#ffffff40"
        strokeWidth={1}
      />

      {/* Road cells */}
      {roadCells.map((cell) => {
        const px = (cell.x - bounds.minX) * CELL;
        const pz = (cell.z - bounds.minZ) * CELL;
        return (
          <rect
            key={`road-${cell.x}-${cell.z}`}
            x={px - CELL / 2}
            y={pz - CELL / 2}
            width={CELL}
            height={CELL}
            fill={ROAD_COLOR}
            stroke={ROAD_BORDER}
            strokeWidth={0.5}
            strokeOpacity={0.4}
          />
        );
      })}

      {/* Buildings */}
      {layout.buildings.map((b) => {
        const px = (b.x - bounds.minX) * CELL;
        const pz = (b.z - bounds.minZ) * CELL;
        const isSelected = b.id === selectedBuildingId;
        const color = TYPE_COLORS[b.type] ?? '#888888';
        const size = CELL * 0.8;

        return (
          <g
            key={b.id}
            onMouseDown={(e) => handleBuildingMouseDown(e, b.id)}
            style={{ cursor: mode === 'building' ? 'grab' : undefined }}
          >
            {/* Selection glow */}
            {isSelected && (
              <rect
                x={px - size / 2 - 2}
                y={pz - size / 2 - 2}
                width={size + 4}
                height={size + 4}
                fill="none"
                stroke={SELECTED_GLOW}
                strokeWidth={1.5}
                rx={2}
                opacity={0.8}
              />
            )}
            {/* Building rect */}
            <rect
              x={px - size / 2}
              y={pz - size / 2}
              width={size}
              height={size}
              fill={color}
              fillOpacity={0.7}
              stroke={color}
              strokeWidth={1}
              rx={2}
            />
            {/* Label */}
            <text
              x={px}
              y={pz + size / 2 + 10}
              textAnchor="middle"
              fill="#ffffffcc"
              fontSize={7}
              fontFamily="monospace"
            >
              {b.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
