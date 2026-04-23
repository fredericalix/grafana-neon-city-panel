import React, { useEffect, useMemo, useRef } from 'react';
import { PanelProps } from '@grafana/data';
import { CityOptions, Building } from '../types';
import { CityEngine } from '../engine/CityEngine';
import { mapDataToStates, mapDataToTraffic } from '../data/dataMapper';
import { computeDiagnostics } from '../data/diagnostics';
import { DiagnosticOverlay } from './DiagnosticOverlay';

interface Props extends PanelProps<CityOptions> {}

export const CityPanel: React.FC<Props> = ({ data, options, width, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CityEngine | null>(null);

  // Derive building states and diagnostics from data (pure computation)
  const states = useMemo(() => mapDataToStates(data, options), [data, options]);
  const diagnostics = useMemo(() => computeDiagnostics(data, options, states), [data, options, states]);

  // Initialize Three.js engine once
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const engine = new CityEngine(containerRef.current);
    engine.start();
    engine.setupInteraction();
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Handle resize
  useEffect(() => {
    engineRef.current?.resize(width, height);
  }, [width, height]);

  // Sync buildings from layout config
  useEffect(() => {
    if (!engineRef.current || !options.layout?.buildings) {
      return;
    }

    // `name` is the join key with Grafana query rows (dataMapper emits state.id = name),
    // so duplicates silently merge state across distinct buildings. Warn early instead.
    const seenNames = new Set<string>();
    const duplicates = new Set<string>();
    for (const b of options.layout.buildings) {
      if (seenNames.has(b.name)) {
        duplicates.add(b.name);
      }
      seenNames.add(b.name);
    }
    if (duplicates.size > 0) {
      console.warn(
        `[neon-city-panel] Layout contains duplicate building names: ${Array.from(duplicates).join(', ')}. ` +
        `Tooltips, popups and data mapping will alias between them. Rename each building uniquely.`
      );
    }

    const buildings: Building[] = options.layout.buildings.map((b) => ({
      id: b.name,
      name: b.name,
      type: b.type,
      location: { x: b.x, y: b.z },
      orientation: rotationToOrientation(b.rotation),
      defaultText: b.defaultText,
      color: b.color,
    }));

    engineRef.current.setBuildings(buildings);
  }, [options.layout]);

  // Push building states to Three.js engine
  useEffect(() => {
    if (!engineRef.current) {
      return;
    }
    engineRef.current.updateStates(states);
  }, [states]);

  // Sync roads from layout config
  useEffect(() => {
    if (!engineRef.current || !options.layout?.roads) {
      return;
    }
    const origin = options.layout.roadOrigin ?? { x: 0, z: 0 };
    engineRef.current.setRoads(options.layout.roads, origin);
  }, [options.layout?.roads, options.layout?.roadOrigin]);

  // Update traffic state from Grafana data
  useEffect(() => {
    if (!engineRef.current) {
      return;
    }
    const trafficState = mapDataToTraffic(
      data,
      options.trafficDensityField ?? '',
      options.trafficSpeedField ?? ''
    );
    engineRef.current.updateTraffic(trafficState.density, trafficState.speed);
  }, [data, options.trafficDensityField, options.trafficSpeedField]);

  // Sync interaction, labels, and traffic options
  useEffect(() => {
    if (!engineRef.current) {
      return;
    }
    engineRef.current.setInteractionEnabled(options.enableInteraction !== false);
    engineRef.current.setLabelsVisible(options.showLabels === true);
    engineRef.current.setTrafficEnabled(options.enableTraffic !== false);
  }, [options.enableInteraction, options.showLabels, options.enableTraffic]);

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <DiagnosticOverlay messages={diagnostics} />
    </div>
  );
};

function rotationToOrientation(rotation: number): 'N' | 'S' | 'E' | 'W' {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized < 45 || normalized >= 315) {
    return 'N';
  }
  if (normalized < 135) {
    return 'E';
  }
  if (normalized < 225) {
    return 'S';
  }
  return 'W';
}
