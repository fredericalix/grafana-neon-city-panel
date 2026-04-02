import { FieldType, LoadingState, type PanelData, type Field, type DataFrame } from '@grafana/data';
import { computeDiagnostics } from './diagnostics';
import type { CityOptions } from '../types';

// ---------------------------------------------------------------------------
// Helpers (same patterns as dataMapper.test.ts)
// ---------------------------------------------------------------------------

function makeOptions(overrides: Partial<CityOptions> = {}): CityOptions {
  return {
    layout: {
      gridSize: 2,
      buildings: [
        { id: 'b1', name: 'database', type: 'tower_b', x: 0, z: 0, rotation: 0 },
        { id: 'b2', name: 'cache', type: 'pyramid', x: -7, z: -5, rotation: 0 },
        { id: 'b3', name: 'api-gateway', type: 'tower_a', x: 7, z: -5, rotation: 0 },
      ],
    },
    thresholds: { online: 90, warning: 70, critical: 0 },
    statusField: 'status',
    valueField: 'value',
    nameField: 'name',
    ...overrides,
  };
}

function field(name: string, type: FieldType, values: unknown[]): Field {
  return { name, type, values, config: {} } as Field;
}

function panelData(series: DataFrame[], state = LoadingState.Done): PanelData {
  return { state, series, timeRange: {} } as unknown as PanelData;
}

function tableFrame(columns: Record<string, { type: FieldType; values: unknown[] }>): DataFrame {
  const fields = Object.entries(columns).map(([name, col]) => field(name, col.type, col.values));
  return { fields, length: fields[0]?.values.length ?? 0 } as DataFrame;
}

// ===========================================================================
// computeDiagnostics
// ===========================================================================

describe('computeDiagnostics', () => {
  it('suppresses all messages during loading', () => {
    const data = panelData([], LoadingState.Loading);
    const result = computeDiagnostics(data, makeOptions(), []);
    expect(result).toEqual([]);
  });

  it('returns no-data message when series is empty', () => {
    const data = panelData([]);
    const result = computeDiagnostics(data, makeOptions(), []);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'no-data',
      severity: 'info',
      title: 'No data received',
    });
    expect(result[0].detail).toContain('"name"');
    expect(result[0].detail).toContain('"status"');
  });

  it('returns no-data message when frames have zero rows', () => {
    const frame = tableFrame({
      name: { type: FieldType.string, values: [] },
      status: { type: FieldType.string, values: [] },
    });
    const data = panelData([frame]);
    const result = computeDiagnostics(data, makeOptions(), []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('no-data');
  });

  it('returns name-column-missing warning when states are empty but data has rows', () => {
    const frame = tableFrame({
      hostname: { type: FieldType.string, values: ['db', 'cache'] },
      status: { type: FieldType.string, values: ['online', 'warning'] },
    });
    const data = panelData([frame]);
    const result = computeDiagnostics(data, makeOptions(), []);

    expect(result.some((m) => m.severity === 'warning')).toBe(true);
    const warning = result.find((m) => m.severity === 'warning')!;
    expect(warning.title).toContain('"name"');
    expect(warning.detail).toContain('Name field');
  });

  it('returns mismatch warning when no state IDs match layout buildings', () => {
    const states = [
      { id: 'api_gw', status: 'online' as const, activity: 'normal' as const },
      { id: 'cache-01', status: 'online' as const, activity: 'normal' as const },
      { id: 'db-primary', status: 'online' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['api_gw', 'cache-01', 'db-primary'] },
      status: { type: FieldType.string, values: ['online', 'online', 'online'] },
    });
    const data = panelData([frame]);
    const result = computeDiagnostics(data, makeOptions(), states);

    expect(result.some((m) => m.title === 'No buildings matched query data')).toBe(true);
    const warning = result.find((m) => m.title === 'No buildings matched query data')!;
    expect(warning.detail).toContain('api_gw');
    expect(warning.detail).toContain('database');
  });

  it('returns empty array when states match layout buildings', () => {
    const states = [
      { id: 'database', status: 'online' as const, activity: 'normal' as const },
      { id: 'cache', status: 'warning' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['database', 'cache'] },
      status: { type: FieldType.string, values: ['online', 'warning'] },
    });
    const data = panelData([frame]);
    const opts = makeOptions({ enableTraffic: false });
    const result = computeDiagnostics(data, opts, states);

    expect(result).toEqual([]);
  });

  it('does not warn on partial match (some buildings matched)', () => {
    const states = [
      { id: 'database', status: 'online' as const, activity: 'normal' as const },
      { id: 'unknown-service', status: 'online' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['database', 'unknown-service'] },
      status: { type: FieldType.string, values: ['online', 'online'] },
    });
    const data = panelData([frame]);
    const opts = makeOptions({ enableTraffic: false });
    const result = computeDiagnostics(data, opts, states);

    expect(result).toEqual([]);
  });

  it('matches layout names case-insensitively', () => {
    const states = [
      { id: 'Database', status: 'online' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['Database'] },
      status: { type: FieldType.string, values: ['online'] },
    });
    const data = panelData([frame]);
    const opts = makeOptions({ enableTraffic: false });
    const result = computeDiagnostics(data, opts, states);

    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Traffic hints
  // ---------------------------------------------------------------------------

  it('returns traffic hint when both traffic fields are empty and traffic is enabled', () => {
    const states = [
      { id: 'database', status: 'online' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['database'] },
      status: { type: FieldType.string, values: ['online'] },
    });
    const data = panelData([frame]);
    const result = computeDiagnostics(data, makeOptions(), states);

    const hint = result.find((m) => m.id === 'traffic-defaults');
    expect(hint).toBeDefined();
    expect(hint!.severity).toBe('hint');
    expect(hint!.detail).toContain('Traffic density field');
  });

  it('does not return traffic hint when density field is configured', () => {
    const states = [
      { id: 'database', status: 'online' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['database'] },
      status: { type: FieldType.string, values: ['online'] },
    });
    const data = panelData([frame]);
    const opts = makeOptions({ trafficDensityField: 'req_per_sec' });
    const result = computeDiagnostics(data, opts, states);

    expect(result.find((m) => m.id === 'traffic-defaults')).toBeUndefined();
  });

  it('does not return traffic hint when traffic is disabled', () => {
    const states = [
      { id: 'database', status: 'online' as const, activity: 'normal' as const },
    ];
    const frame = tableFrame({
      name: { type: FieldType.string, values: ['database'] },
      status: { type: FieldType.string, values: ['online'] },
    });
    const data = panelData([frame]);
    const opts = makeOptions({ enableTraffic: false });
    const result = computeDiagnostics(data, opts, states);

    expect(result.find((m) => m.id === 'traffic-defaults')).toBeUndefined();
  });

  it('does not include traffic hint in no-data scenario', () => {
    const data = panelData([]);
    const result = computeDiagnostics(data, makeOptions(), []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('no-data');
  });

  it('uses custom nameField and statusField in no-data detail message', () => {
    const data = panelData([]);
    const opts = makeOptions({ nameField: 'hostname', statusField: 'health' });
    const result = computeDiagnostics(data, opts, []);

    expect(result[0].detail).toContain('"hostname"');
    expect(result[0].detail).toContain('"health"');
  });
});
