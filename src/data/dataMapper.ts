import { PanelData, Field } from '@grafana/data';
import { BuildingState, BuildingStatus, BuildingActivity, BankQuantity, DisplayRingCount, TrafficState, TrafficSpeed, CityOptions } from '../types';

/**
 * Maps Grafana table data to BuildingState array.
 *
 * Expected table format:
 * | name | status | value | activity | text1 | text2 | cpu | ram | ... |
 */
export function mapDataToStates(data: PanelData, options: CityOptions): BuildingState[] {
  const states: BuildingState[] = [];

  for (const frame of data.series) {
    const nameField = findField(frame.fields, options.nameField);
    if (!nameField) {
      continue;
    }

    const statusField = findField(frame.fields, options.statusField);
    const valueField = findField(frame.fields, options.valueField);
    const activityField = findField(frame.fields, 'activity');
    const text1Field = findField(frame.fields, 'text1');
    const text2Field = findField(frame.fields, 'text2');
    const text3Field = findField(frame.fields, 'text3');
    const cpuField = findField(frame.fields, 'cpu');
    const ramField = findField(frame.fields, 'ram');
    const quantityField = findField(frame.fields, 'quantity');
    const amountField = findField(frame.fields, 'amount');
    const ringCountField = findField(frame.fields, 'ringCount');

    const rowCount = nameField.values.length;

    for (let i = 0; i < rowCount; i++) {
      const name = String(nameField.values[i] ?? '');
      if (!name) {
        continue;
      }

      // Resolve status
      let status: BuildingStatus = 'offline';
      if (statusField) {
        status = resolveStatusFromText(String(statusField.values[i] ?? ''));
      } else if (valueField) {
        const value = Number(valueField.values[i]);
        status = resolveStatusFromValue(value, options.thresholds);
      }

      // Resolve activity
      let activity: BuildingActivity = 'normal';
      if (activityField) {
        const raw = String(activityField.values[i] ?? 'normal');
        if (raw === 'slow' || raw === 'normal' || raw === 'fast') {
          activity = raw;
        }
      }

      states.push({
        id: name,
        status,
        activity,
        text1: text1Field ? String(text1Field.values[i] ?? '') : undefined,
        text2: text2Field ? String(text2Field.values[i] ?? '') : undefined,
        text3: text3Field ? String(text3Field.values[i] ?? '') : undefined,
        cpuUsage: cpuField ? Number(cpuField.values[i]) : undefined,
        ramUsage: ramField ? Number(ramField.values[i]) : undefined,
        bankQuantity: quantityField ? resolveBankQuantity(String(quantityField.values[i] ?? '')) : undefined,
        bankAmount: amountField ? Number(amountField.values[i]) : undefined,
        ringCount: ringCountField ? resolveRingCount(Number(ringCountField.values[i])) : undefined,
      });
    }
  }

  return states;
}

/**
 * Extract global traffic metrics from Grafana query data.
 * Looks for density/speed field names and returns the most recent values.
 */
export function mapDataToTraffic(
  data: PanelData,
  densityField: string,
  speedField: string
): TrafficState {
  let density = 50; // default
  let speed: TrafficSpeed = 'normal';

  if (!densityField && !speedField) {
    return { density, speed };
  }

  for (const frame of data.series) {
    const dField = densityField ? findField(frame.fields, densityField) : undefined;
    const sField = speedField ? findField(frame.fields, speedField) : undefined;

    if (dField && dField.values.length > 0) {
      const val = Number(dField.values[dField.values.length - 1]);
      if (!isNaN(val)) {
        density = Math.max(0, Math.min(100, val));
      }
    }

    if (sField && sField.values.length > 0) {
      const raw = String(sField.values[sField.values.length - 1]).toLowerCase().trim();
      if (raw === 'slow' || raw === 'normal' || raw === 'fast') {
        speed = raw;
      } else {
        // Numeric interpretation: <33 = slow, 34-66 = normal, >66 = fast
        const num = Number(raw);
        if (!isNaN(num)) {
          speed = num < 33 ? 'slow' : num < 67 ? 'normal' : 'fast';
        }
      }
    }

    // Take first frame with data
    if (dField || sField) {
      break;
    }
  }

  return { density, speed };
}

function findField(fields: Field[], name: string): Field | undefined {
  return fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

function resolveStatusFromText(text: string): BuildingStatus {
  const lower = text.toLowerCase().trim();
  switch (lower) {
    case 'online':
    case 'up':
    case 'ok':
    case 'healthy':
    case 'running':
    case '1':
      return 'online';
    case 'warning':
    case 'warn':
    case 'degraded':
      return 'warning';
    case 'critical':
    case 'error':
    case 'failure':
    case 'down':
      return 'critical';
    case 'offline':
    case 'stopped':
    case '0':
      return 'offline';
    default:
      return 'offline';
  }
}

function resolveStatusFromValue(
  value: number,
  thresholds: { online: number; warning: number; critical: number }
): BuildingStatus {
  if (isNaN(value)) {
    return 'offline';
  }
  if (value >= thresholds.online) {
    return 'online';
  }
  if (value >= thresholds.warning) {
    return 'warning';
  }
  if (value >= thresholds.critical) {
    return 'critical';
  }
  return 'offline';
}

function resolveBankQuantity(text: string): BankQuantity {
  const lower = text.toLowerCase().trim();
  if (lower === 'none' || lower === 'low' || lower === 'medium' || lower === 'full') {
    return lower;
  }
  return 'none';
}

function resolveRingCount(value: number): DisplayRingCount {
  return value === 2 ? 2 : 3;
}
