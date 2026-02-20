import React, { useEffect, useRef } from 'react';
import { PanelProps } from '@grafana/data';
import { CityOptions, Building } from '../types';
import { CityEngine } from '../engine/CityEngine';
import { mapDataToStates, mapDataToTraffic } from '../data/dataMapper';

interface Props extends PanelProps<CityOptions> {}

export const CityPanel: React.FC<Props> = ({ data, options, width, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CityEngine | null>(null);

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

    const buildings: Building[] = options.layout.buildings.map((b) => ({
      id: b.name, // Use name as ID for data matching
      name: b.name,
      type: b.type,
      location: { x: b.x, y: b.z },
      orientation: rotationToOrientation(b.rotation),
    }));

    engineRef.current.setBuildings(buildings);
  }, [options.layout]);

  // Update building states from Grafana data
  useEffect(() => {
    if (!engineRef.current) {
      return;
    }

    const states = mapDataToStates(data, options);
    engineRef.current.updateStates(states);
  }, [data, options]);

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

  // Sync interaction and labels options
  useEffect(() => {
    if (!engineRef.current) {
      return;
    }
    engineRef.current.setInteractionEnabled(options.enableInteraction !== false);
    engineRef.current.setLabelsVisible(options.showLabels === true);
  }, [options.enableInteraction, options.showLabels]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
      }}
    />
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
