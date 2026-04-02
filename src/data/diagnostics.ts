import { LoadingState, PanelData } from '@grafana/data';
import { BuildingState, CityOptions } from '../types';

export interface DiagnosticMessage {
  id: string;
  severity: 'info' | 'warning' | 'hint';
  title: string;
  detail: string;
}

/**
 * Compute diagnostic messages based on the current data, options, and mapped states.
 * Returns at most 2 messages. Returns [] during loading to avoid flash on initial render.
 */
export function computeDiagnostics(
  data: PanelData,
  options: CityOptions,
  states: BuildingState[]
): DiagnosticMessage[] {
  // Suppress during loading to avoid flash before first query completes
  if (data.state === LoadingState.Loading) {
    return [];
  }

  const hasData = dataHasRows(data);

  if (!hasData) {
    return [
      {
        id: 'no-data',
        severity: 'info',
        title: 'No data received',
        detail: `Configure a query returning columns: "${options.nameField}", "${options.statusField}". Building names must match the city layout.`,
      },
    ];
  }

  const messages: DiagnosticMessage[] = [];
  const layoutNames = options.layout?.buildings?.map((b) => b.name) ?? [];

  if (states.length === 0) {
    // Data has rows but mapper returned nothing — name column likely missing
    messages.push({
      id: `name-missing:${options.nameField}`,
      severity: 'warning',
      title: `Column "${options.nameField}" not found in query data`,
      detail: `Your query has no column named "${options.nameField}". Check the "Name field" panel option, or rename your query column.`,
    });
  } else if (layoutNames.length > 0) {
    // Check if any states match layout buildings
    const layoutSet = new Set(layoutNames.map((n) => n.toLowerCase()));
    const matched = states.some((s) => layoutSet.has(s.id.toLowerCase()));

    if (!matched) {
      const queryNames = states.slice(0, 3).map((s) => s.id);
      const displayLayout = layoutNames.slice(0, 3);
      const queryExtra = states.length > 3 ? ', ...' : '';
      const layoutExtra = layoutNames.length > 3 ? ', ...' : '';

      messages.push({
        id: `mismatch:${queryNames.join(',')}`,
        severity: 'warning',
        title: 'No buildings matched query data',
        detail: `Query returned: ${queryNames.join(', ')}${queryExtra}\nLayout expects: ${displayLayout.join(', ')}${layoutExtra}\nEnsure column values match building names in the layout editor.`,
      });
    }
  }

  // Traffic hint: only when data is present and both fields are unconfigured
  if (
    options.enableTraffic !== false &&
    !(options.trafficDensityField ?? '') &&
    !(options.trafficSpeedField ?? '')
  ) {
    messages.push({
      id: 'traffic-defaults',
      severity: 'hint',
      title: 'Traffic running on defaults',
      detail: 'Set "Traffic density field" and "Traffic speed field" in panel options to drive traffic from your query data.',
    });
  }

  return messages;
}

function dataHasRows(data: PanelData): boolean {
  for (const frame of data.series) {
    if (frame.fields.length > 0 && frame.fields[0].values.length > 0) {
      return true;
    }
  }
  return false;
}
