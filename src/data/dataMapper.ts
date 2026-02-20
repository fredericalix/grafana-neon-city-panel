import { PanelData, Field } from '@grafana/data';
import { BuildingState, BuildingStatus, BuildingActivity, CityOptions } from '../types';

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
      });
    }
  }

  return states;
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
