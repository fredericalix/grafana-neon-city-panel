import { FieldType, LoadingState } from '@grafana/data';
import type { PanelData, Field, DataFrame } from '@grafana/data';
import { mapDataToStates, mapDataToTraffic } from './dataMapper';
import type { CityOptions } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal CityOptions sufficient for the mapper. */
function makeOptions(overrides: Partial<CityOptions> = {}): CityOptions {
  return {
    layout: { gridSize: 2, buildings: [] },
    thresholds: { online: 90, warning: 70, critical: 0 },
    statusField: 'status',
    valueField: 'value',
    nameField: 'name',
    ...overrides,
  };
}

/** Build a simple Field object. */
function field(name: string, type: FieldType, values: unknown[], labels?: Record<string, string>): Field {
  return { name, type, values, config: {}, labels } as Field;
}

/** Wrap an array of frames into a minimal PanelData shape. */
function panelData(series: DataFrame[]): PanelData {
  return { state: LoadingState.Done, series, timeRange: {} } as unknown as PanelData;
}

/** Create a table-format DataFrame with the given columns. */
function tableFrame(
  columns: Record<string, { type: FieldType; values: unknown[] }>,
  refId?: string
): DataFrame {
  const fields = Object.entries(columns).map(([name, col]) => field(name, col.type, col.values));
  return { fields, length: fields[0]?.values.length ?? 0, ...(refId ? { refId } : {}) } as DataFrame;
}

// ===========================================================================
// mapDataToStates — TABLE FORMAT (first pass)
// ===========================================================================

describe('mapDataToStates', () => {
  describe('table format (first pass)', () => {
    it('maps a basic table with name + status fields', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['db', 'cache', 'api'] },
        status: { type: FieldType.string, values: ['online', 'warning', 'critical'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());

      expect(states).toHaveLength(3);
      expect(states[0]).toMatchObject({ id: 'db', status: 'online', activity: 'normal' });
      expect(states[1]).toMatchObject({ id: 'cache', status: 'warning', activity: 'normal' });
      expect(states[2]).toMatchObject({ id: 'api', status: 'critical', activity: 'normal' });
    });

    it('resolves status from a numeric value field when no status field is present', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc-a', 'svc-b', 'svc-c', 'svc-d'] },
        value: { type: FieldType.number, values: [95, 80, 50, -1] },
      });

      const opts = makeOptions({ thresholds: { online: 90, warning: 70, critical: 0 } });
      const states = mapDataToStates(panelData([frame]), opts);

      expect(states).toHaveLength(4);
      expect(states[0].status).toBe('online');   // 95 >= 90
      expect(states[1].status).toBe('warning');   // 80 >= 70
      expect(states[2].status).toBe('critical');  // 50 >= 0
      expect(states[3].status).toBe('offline');   // -1 < 0
    });

    it('uses status text over value field when both are present', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['critical'] },
        value: { type: FieldType.number, values: [100] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('critical');
    });

    it('maps all text-status synonyms correctly', () => {
      const synonyms: Record<string, string> = {
        online: 'online', up: 'online', ok: 'online', healthy: 'online', running: 'online', '1': 'online',
        warning: 'warning', warn: 'warning', degraded: 'warning',
        critical: 'critical', error: 'critical', failure: 'critical', down: 'critical',
        offline: 'offline', stopped: 'offline', '0': 'offline',
      };

      const names = Object.keys(synonyms);
      const frame = tableFrame({
        name: { type: FieldType.string, values: names },
        status: { type: FieldType.string, values: names },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      for (let i = 0; i < names.length; i++) {
        expect(states[i].status).toBe(synonyms[names[i]]);
      }
    });

    it('treats unrecognised status text as offline', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['banana'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('offline');
    });

    it('is case-insensitive for status text', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['a', 'b', 'c'] },
        status: { type: FieldType.string, values: ['ONLINE', 'Warning', 'CrItIcAl'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('online');
      expect(states[1].status).toBe('warning');
      expect(states[2].status).toBe('critical');
    });

    it('trims whitespace from status text', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['  online  '] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('online');
    });

    it('resolves activity field values (slow / normal / fast)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['a', 'b', 'c'] },
        status: { type: FieldType.string, values: ['online', 'online', 'online'] },
        activity: { type: FieldType.string, values: ['slow', 'normal', 'fast'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].activity).toBe('slow');
      expect(states[1].activity).toBe('normal');
      expect(states[2].activity).toBe('fast');
    });

    it('defaults activity to normal for unrecognised values', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
        activity: { type: FieldType.string, values: ['turbo'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].activity).toBe('normal');
    });

    it('defaults activity to normal when activity field is absent', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].activity).toBe('normal');
    });

    it('maps optional text fields (text1, text2, text3)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
        text1: { type: FieldType.string, values: ['hello'] },
        text2: { type: FieldType.string, values: ['world'] },
        text3: { type: FieldType.string, values: ['!'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].text1).toBe('hello');
      expect(states[0].text2).toBe('world');
      expect(states[0].text3).toBe('!');
    });

    it('leaves text fields undefined when columns are absent', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].text1).toBeUndefined();
      expect(states[0].text2).toBeUndefined();
      expect(states[0].text3).toBeUndefined();
    });

    it('maps cpu and ram usage fields', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
        cpu: { type: FieldType.number, values: [42.5] },
        ram: { type: FieldType.number, values: [78.1] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].cpuUsage).toBe(42.5);
      expect(states[0].ramUsage).toBe(78.1);
    });

    it('leaves cpu/ram undefined when fields are absent', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].cpuUsage).toBeUndefined();
      expect(states[0].ramUsage).toBeUndefined();
    });

    it('maps bankQuantity from quantity field', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
        status: { type: FieldType.string, values: ['online', 'online', 'online', 'online', 'online'] },
        quantity: { type: FieldType.string, values: ['none', 'low', 'medium', 'full', 'invalid'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].bankQuantity).toBe('none');
      expect(states[1].bankQuantity).toBe('low');
      expect(states[2].bankQuantity).toBe('medium');
      expect(states[3].bankQuantity).toBe('full');
      expect(states[4].bankQuantity).toBe('none'); // invalid → none
    });

    it('maps bankAmount from amount field', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
        amount: { type: FieldType.number, values: [123456] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].bankAmount).toBe(123456);
    });

    it('maps ringCount (2 stays 2, anything else becomes 3)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['a', 'b', 'c'] },
        status: { type: FieldType.string, values: ['online', 'online', 'online'] },
        ringCount: { type: FieldType.number, values: [2, 3, 5] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].ringCount).toBe(2);
      expect(states[1].ringCount).toBe(3);
      expect(states[2].ringCount).toBe(3); // not 2 → 3
    });

    it('maps monitorBands from band1..bandN fields', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['tube'] },
        status: { type: FieldType.string, values: ['online'] },
        band1: { type: FieldType.number, values: [10] },
        band2: { type: FieldType.number, values: [50] },
        band3: { type: FieldType.number, values: [90] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].monitorBands).toEqual([
        { value: 10 },
        { value: 50 },
        { value: 90 },
      ]);
    });

    it('clamps band values to 0-100', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['tube'] },
        status: { type: FieldType.string, values: ['online'] },
        band1: { type: FieldType.number, values: [-20] },
        band2: { type: FieldType.number, values: [150] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].monitorBands![0].value).toBe(0);
      expect(states[0].monitorBands![1].value).toBe(100);
    });

    it('treats NaN band values as 0', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['tube'] },
        status: { type: FieldType.string, values: ['online'] },
        band1: { type: FieldType.number, values: [NaN] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].monitorBands![0].value).toBe(0);
    });

    it('stops reading bands at the first gap (e.g. band1 + band3 but no band2)', () => {
      // Build frame manually to control field order
      const fields: Field[] = [
        field('name', FieldType.string, ['tube']),
        field('status', FieldType.string, ['online']),
        field('band1', FieldType.number, [10]),
        // band2 is intentionally absent
        field('band3', FieldType.number, [90]),
      ];
      const frame = { fields, length: 1 } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      // Only band1 should be included because band2 is missing, breaking the loop
      expect(states[0].monitorBands).toEqual([{ value: 10 }]);
    });

    it('maps monitorMessages from msg1..msgN fields', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['tube'] },
        status: { type: FieldType.string, values: ['online'] },
        msg1: { type: FieldType.string, values: ['hello'] },
        msg2: { type: FieldType.string, values: ['world'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].monitorMessages).toEqual(['hello', 'world']);
    });

    it('stops reading messages at the first gap', () => {
      const fields: Field[] = [
        field('name', FieldType.string, ['tube']),
        field('status', FieldType.string, ['online']),
        field('msg1', FieldType.string, ['hello']),
        // msg2 absent
        field('msg3', FieldType.string, ['!']),
      ];
      const frame = { fields, length: 1 } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].monitorMessages).toEqual(['hello']);
    });

    it('leaves monitorBands/monitorMessages undefined when no band/msg fields exist', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].monitorBands).toBeUndefined();
      expect(states[0].monitorMessages).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // Silo fill level
    // -----------------------------------------------------------------------

    it('maps siloFillLevel from "fill" column', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['silo'] },
        status: { type: FieldType.string, values: ['online'] },
        fill: { type: FieldType.number, values: [75] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].siloFillLevel).toBe(75);
    });

    it('maps siloFillLevel from "level" column', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['silo'] },
        status: { type: FieldType.string, values: ['online'] },
        level: { type: FieldType.number, values: [42] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].siloFillLevel).toBe(42);
    });

    it('clamps siloFillLevel to 0-100', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['a', 'b'] },
        status: { type: FieldType.string, values: ['online', 'online'] },
        fill: { type: FieldType.number, values: [-10, 150] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].siloFillLevel).toBe(0);
      expect(states[1].siloFillLevel).toBe(100);
    });

    it('leaves siloFillLevel undefined when NaN', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['silo'] },
        status: { type: FieldType.string, values: ['online'] },
        fill: { type: FieldType.number, values: [NaN] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].siloFillLevel).toBeUndefined();
    });

    it('leaves siloFillLevel undefined when no fill/level field exists', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['silo'] },
        status: { type: FieldType.string, values: ['online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].siloFillLevel).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // Field discovery / case insensitivity
    // -----------------------------------------------------------------------

    it('uses case-insensitive field name matching', () => {
      const fields: Field[] = [
        field('Name', FieldType.string, ['svc']),
        field('STATUS', FieldType.string, ['online']),
      ];
      const frame = { fields, length: 1 } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({ id: 'svc', status: 'online' });
    });

    it('respects custom nameField / statusField / valueField option names', () => {
      const frame = tableFrame({
        hostname: { type: FieldType.string, values: ['web01'] },
        health: { type: FieldType.string, values: ['up'] },
      });

      const opts = makeOptions({ nameField: 'hostname', statusField: 'health' });
      const states = mapDataToStates(panelData([frame]), opts);

      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({ id: 'web01', status: 'online' });
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    it('returns empty array for empty PanelData (no series)', () => {
      const states = mapDataToStates(panelData([]), makeOptions());
      expect(states).toEqual([]);
    });

    it('returns empty array when frame has no name field', () => {
      const frame = tableFrame({
        status: { type: FieldType.string, values: ['online'] },
        value: { type: FieldType.number, values: [100] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toEqual([]);
    });

    it('skips rows where name is empty string', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc', '', 'api'] },
        status: { type: FieldType.string, values: ['online', 'online', 'online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toHaveLength(2);
      expect(states[0].id).toBe('svc');
      expect(states[1].id).toBe('api');
    });

    it('skips rows where name is null/undefined', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: [null, undefined, 'api'] },
        status: { type: FieldType.string, values: ['online', 'online', 'online'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toHaveLength(1);
      expect(states[0].id).toBe('api');
    });

    it('handles null status gracefully (defaults to offline)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: [null] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('offline');
    });

    it('handles NaN numeric value (resolves to offline)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        value: { type: FieldType.number, values: [NaN] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('offline');
    });

    it('handles null value in value field (resolves to offline via NaN)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        value: { type: FieldType.number, values: [null] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      // Number(null) === 0 which is >= critical(0), so it's 'critical'
      expect(states[0].status).toBe('critical');
    });

    it('defaults status to offline when neither status nor value field exists', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].status).toBe('offline');
    });

    it('handles null text values gracefully', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
        text1: { type: FieldType.string, values: [null] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].text1).toBe('');
    });

    it('handles null activity gracefully (defaults to normal)', () => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        status: { type: FieldType.string, values: ['online'] },
        activity: { type: FieldType.string, values: [null] },
      });

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states[0].activity).toBe('normal');
    });

    it('combines states from multiple frames', () => {
      const frame1 = tableFrame({
        name: { type: FieldType.string, values: ['db'] },
        status: { type: FieldType.string, values: ['online'] },
      });
      const frame2 = tableFrame({
        name: { type: FieldType.string, values: ['cache'] },
        status: { type: FieldType.string, values: ['warning'] },
      });

      const states = mapDataToStates(panelData([frame1, frame2]), makeOptions());
      expect(states).toHaveLength(2);
      expect(states[0].id).toBe('db');
      expect(states[1].id).toBe('cache');
    });
  });

  // =========================================================================
  // NUMERIC THRESHOLD RESOLUTION
  // =========================================================================

  describe('numeric threshold resolution', () => {
    const opts = makeOptions({ thresholds: { online: 90, warning: 70, critical: 50 } });

    it.each([
      [100, 'online'],
      [90, 'online'],       // exactly at online threshold
      [89, 'warning'],
      [70, 'warning'],      // exactly at warning threshold
      [69, 'critical'],
      [50, 'critical'],     // exactly at critical threshold
      [49, 'offline'],      // below critical
      [0, 'offline'],
      [-1, 'offline'],
    ])('value %d → status %s', (value, expected) => {
      const frame = tableFrame({
        name: { type: FieldType.string, values: ['svc'] },
        value: { type: FieldType.number, values: [value] },
      });

      const states = mapDataToStates(panelData([frame]), opts);
      expect(states[0].status).toBe(expected);
    });
  });

  // =========================================================================
  // PROMETHEUS FORMAT (second pass)
  // =========================================================================

  describe('Prometheus multi-query format', () => {
    it('extracts states from table-column Prometheus format with refId routing', () => {
      const healthFrame: DataFrame = {
        refId: 'A',
        fields: [
          field('instance', FieldType.string, ['web01', 'web02']),
          field('Value', FieldType.number, [95, 60]),
        ],
        length: 2,
      } as DataFrame;

      const cpuFrame: DataFrame = {
        refId: 'B',
        fields: [
          field('instance', FieldType.string, ['web01', 'web02']),
          field('Value', FieldType.number, [45, 78]),
        ],
        length: 2,
      } as DataFrame;

      const ramFrame: DataFrame = {
        refId: 'C',
        fields: [
          field('instance', FieldType.string, ['web01', 'web02']),
          field('Value', FieldType.number, [30, 92]),
        ],
        length: 2,
      } as DataFrame;

      const opts = makeOptions({ thresholds: { online: 90, warning: 70, critical: 0 } });
      const states = mapDataToStates(panelData([healthFrame, cpuFrame, ramFrame]), opts);

      expect(states).toHaveLength(2);

      const web01 = states.find((s) => s.id === 'web01')!;
      expect(web01.status).toBe('online');  // 95 >= 90
      expect(web01.cpuUsage).toBe(45);
      expect(web01.ramUsage).toBe(30);

      const web02 = states.find((s) => s.id === 'web02')!;
      expect(web02.status).toBe('critical'); // 60 >= 0, < 70
      expect(web02.cpuUsage).toBe(78);
      expect(web02.ramUsage).toBe(92);
    });

    it('extracts states from labeled-numeric Prometheus format', () => {
      const healthA: DataFrame = {
        refId: 'A',
        fields: [
          field('Value', FieldType.number, [95], { instance: 'web01' }),
        ],
        length: 1,
      } as DataFrame;

      const healthA2: DataFrame = {
        refId: 'A',
        fields: [
          field('Value', FieldType.number, [60], { instance: 'web02' }),
        ],
        length: 1,
      } as DataFrame;

      const cpuB: DataFrame = {
        refId: 'B',
        fields: [
          field('Value', FieldType.number, [55], { instance: 'web01' }),
        ],
        length: 1,
      } as DataFrame;

      const opts = makeOptions({ thresholds: { online: 90, warning: 70, critical: 0 } });
      const states = mapDataToStates(panelData([healthA, healthA2, cpuB]), opts);

      expect(states).toHaveLength(2);
      const web01 = states.find((s) => s.id === 'web01')!;
      expect(web01.status).toBe('online');
      expect(web01.cpuUsage).toBe(55);

      const web02 = states.find((s) => s.id === 'web02')!;
      expect(web02.status).toBe('critical');
    });

    it('routes refId D to monitorBands', () => {
      const diskFrame: DataFrame = {
        refId: 'D',
        fields: [
          field('instance', FieldType.string, ['svc']),
          field('Value', FieldType.number, [75]),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([diskFrame]), makeOptions());
      expect(states).toHaveLength(1);
      expect(states[0].monitorBands).toEqual([{ value: 75 }]);
    });

    it('clamps refId D monitorBand values to 0-100', () => {
      const diskFrame: DataFrame = {
        refId: 'D',
        fields: [
          field('instance', FieldType.string, ['svc']),
          field('Value', FieldType.number, [200]),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([diskFrame]), makeOptions());
      expect(states[0].monitorBands![0].value).toBe(100);
    });

    it('instances seen only in B/C/D (not in A) get offline status', () => {
      const cpuFrame: DataFrame = {
        refId: 'B',
        fields: [
          field('instance', FieldType.string, ['orphan-svc']),
          field('Value', FieldType.number, [88]),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([cpuFrame]), makeOptions());
      expect(states).toHaveLength(1);
      expect(states[0].id).toBe('orphan-svc');
      expect(states[0].status).toBe('offline');
      expect(states[0].cpuUsage).toBe(88);
    });

    it('skips frames with empty instance name in labels', () => {
      const frame: DataFrame = {
        refId: 'A',
        fields: [
          field('Value', FieldType.number, [95], { instance: '' }),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toEqual([]);
    });

    it('uses custom nameField as label key for Prometheus format', () => {
      const frame: DataFrame = {
        refId: 'A',
        fields: [
          field('Value', FieldType.number, [95], { host: 'myhost' }),
        ],
        length: 1,
      } as DataFrame;

      const opts = makeOptions({ nameField: 'host' });
      const states = mapDataToStates(panelData([frame]), opts);
      expect(states).toHaveLength(1);
      expect(states[0].id).toBe('myhost');
    });
  });

  // =========================================================================
  // GENERIC FALLBACK FORMAT (third pass)
  // =========================================================================

  describe('generic fallback format (last resort)', () => {
    it('extracts states from labeled numeric fields', () => {
      const frame1: DataFrame = {
        fields: [
          field('Value', FieldType.number, [95], { instance: 'db01' }),
        ],
        length: 1,
      } as DataFrame;

      const frame2: DataFrame = {
        fields: [
          field('Value', FieldType.number, [40], { instance: 'db02' }),
        ],
        length: 1,
      } as DataFrame;

      const opts = makeOptions({ thresholds: { online: 90, warning: 70, critical: 0 } });
      const states = mapDataToStates(panelData([frame1, frame2]), opts);

      expect(states).toHaveLength(2);
      expect(states.find((s) => s.id === 'db01')!.status).toBe('online');
      expect(states.find((s) => s.id === 'db02')!.status).toBe('critical');
    });

    it('deduplicates by instance name (last value wins)', () => {
      const frame1: DataFrame = {
        fields: [
          field('metric1', FieldType.number, [95], { instance: 'db01' }),
        ],
        length: 1,
      } as DataFrame;

      const frame2: DataFrame = {
        fields: [
          field('metric2', FieldType.number, [10], { instance: 'db01' }),
        ],
        length: 1,
      } as DataFrame;

      const opts = makeOptions({ thresholds: { online: 90, warning: 70, critical: 0 } });
      const states = mapDataToStates(panelData([frame1, frame2]), opts);

      expect(states).toHaveLength(1);
      expect(states[0].status).toBe('critical'); // last frame's value wins
    });

    it('uses custom nameField as label key', () => {
      const frame: DataFrame = {
        fields: [
          field('Value', FieldType.number, [95], { host: 'myhost' }),
        ],
        length: 1,
      } as DataFrame;

      const opts = makeOptions({ nameField: 'host' });
      const states = mapDataToStates(panelData([frame]), opts);
      expect(states).toHaveLength(1);
      expect(states[0].id).toBe('myhost');
    });

    it('skips numeric fields without labels', () => {
      const frame: DataFrame = {
        fields: [
          field('Value', FieldType.number, [95]),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toEqual([]);
    });

    it('skips numeric fields with empty values', () => {
      const frame: DataFrame = {
        fields: [
          field('Value', FieldType.number, [], { instance: 'db01' }),
        ],
        length: 0,
      } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toEqual([]);
    });

    it('skips fields that are not numeric type', () => {
      const frame: DataFrame = {
        fields: [
          field('Value', FieldType.string, ['hello'], { instance: 'db01' }),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([frame]), makeOptions());
      expect(states).toEqual([]);
    });
  });

  // =========================================================================
  // FORMAT PRIORITY
  // =========================================================================

  describe('format priority', () => {
    it('prefers table format over Prometheus when table has results', () => {
      // Table frame with name field
      const tableF = tableFrame({
        name: { type: FieldType.string, values: ['table-svc'] },
        status: { type: FieldType.string, values: ['online'] },
      });

      // Prometheus frame with labeled numeric
      const promFrame: DataFrame = {
        refId: 'A',
        fields: [
          field('Value', FieldType.number, [95], { instance: 'prom-svc' }),
        ],
        length: 1,
      } as DataFrame;

      const states = mapDataToStates(panelData([tableF, promFrame]), makeOptions());
      // Table format matched, so only table-svc should appear
      expect(states).toHaveLength(1);
      expect(states[0].id).toBe('table-svc');
    });
  });
});

// ===========================================================================
// mapDataToTraffic
// ===========================================================================

describe('mapDataToTraffic', () => {
  it('returns defaults when both field names are empty strings', () => {
    const frame = tableFrame({
      density: { type: FieldType.number, values: [80] },
      speed: { type: FieldType.string, values: ['fast'] },
    });

    const result = mapDataToTraffic(panelData([frame]), '', '');
    expect(result).toEqual({ density: 50, speed: 'normal' });
  });

  it('reads density from the last value in the field', () => {
    const frame = tableFrame({
      traffic_density: { type: FieldType.number, values: [10, 20, 75] },
    });

    const result = mapDataToTraffic(panelData([frame]), 'traffic_density', '');
    expect(result.density).toBe(75);
  });

  it('clamps density to 0-100', () => {
    const frameLow = tableFrame({
      d: { type: FieldType.number, values: [-50] },
    });
    const frameHigh = tableFrame({
      d: { type: FieldType.number, values: [200] },
    });

    expect(mapDataToTraffic(panelData([frameLow]), 'd', '').density).toBe(0);
    expect(mapDataToTraffic(panelData([frameHigh]), 'd', '').density).toBe(100);
  });

  it('ignores NaN density values and keeps default', () => {
    const frame = tableFrame({
      d: { type: FieldType.number, values: [NaN] },
    });

    const result = mapDataToTraffic(panelData([frame]), 'd', '');
    expect(result.density).toBe(50);
  });

  it('reads speed as text (slow, normal, fast)', () => {
    for (const val of ['slow', 'normal', 'fast'] as const) {
      const frame = tableFrame({
        s: { type: FieldType.string, values: [val] },
      });
      expect(mapDataToTraffic(panelData([frame]), '', 's').speed).toBe(val);
    }
  });

  it('is case-insensitive and trims speed text', () => {
    const frame = tableFrame({
      s: { type: FieldType.string, values: ['  FAST  '] },
    });
    expect(mapDataToTraffic(panelData([frame]), '', 's').speed).toBe('fast');
  });

  it('interprets numeric speed values (< 33 = slow, 33-66 = normal, > 66 = fast)', () => {
    const makeFrame = (val: number) =>
      tableFrame({ s: { type: FieldType.number, values: [val] } });

    expect(mapDataToTraffic(panelData([makeFrame(10)]), '', 's').speed).toBe('slow');
    expect(mapDataToTraffic(panelData([makeFrame(32)]), '', 's').speed).toBe('slow');
    expect(mapDataToTraffic(panelData([makeFrame(33)]), '', 's').speed).toBe('normal');
    expect(mapDataToTraffic(panelData([makeFrame(50)]), '', 's').speed).toBe('normal');
    expect(mapDataToTraffic(panelData([makeFrame(66)]), '', 's').speed).toBe('normal');
    expect(mapDataToTraffic(panelData([makeFrame(67)]), '', 's').speed).toBe('fast');
    expect(mapDataToTraffic(panelData([makeFrame(100)]), '', 's').speed).toBe('fast');
  });

  it('keeps default speed for non-numeric non-keyword values', () => {
    const frame = tableFrame({
      s: { type: FieldType.string, values: ['banana'] },
    });
    expect(mapDataToTraffic(panelData([frame]), '', 's').speed).toBe('normal');
  });

  it('reads both density and speed from the same frame', () => {
    const frame = tableFrame({
      d: { type: FieldType.number, values: [85] },
      s: { type: FieldType.string, values: ['fast'] },
    });

    const result = mapDataToTraffic(panelData([frame]), 'd', 's');
    expect(result).toEqual({ density: 85, speed: 'fast' });
  });

  it('takes data from the first frame that has a matching field', () => {
    const frame1 = tableFrame({
      d: { type: FieldType.number, values: [20] },
    });
    const frame2 = tableFrame({
      d: { type: FieldType.number, values: [99] },
    });

    const result = mapDataToTraffic(panelData([frame1, frame2]), 'd', '');
    expect(result.density).toBe(20); // first frame wins
  });

  it('returns defaults for empty PanelData', () => {
    const result = mapDataToTraffic(panelData([]), 'd', 's');
    expect(result).toEqual({ density: 50, speed: 'normal' });
  });

  it('returns defaults when field name does not match any field', () => {
    const frame = tableFrame({
      other: { type: FieldType.number, values: [99] },
    });

    const result = mapDataToTraffic(panelData([frame]), 'missing_field', 'missing_speed');
    expect(result).toEqual({ density: 50, speed: 'normal' });
  });

  it('handles density field with empty values array', () => {
    const fields: Field[] = [field('d', FieldType.number, [])];
    const frame = { fields, length: 0 } as DataFrame;

    const result = mapDataToTraffic(panelData([frame]), 'd', '');
    expect(result.density).toBe(50); // default unchanged
  });

  it('field name matching is case-insensitive', () => {
    const frame = tableFrame({
      Density: { type: FieldType.number, values: [70] },
      SPEED: { type: FieldType.string, values: ['slow'] },
    });

    const result = mapDataToTraffic(panelData([frame]), 'density', 'speed');
    expect(result).toEqual({ density: 70, speed: 'slow' });
  });
});
