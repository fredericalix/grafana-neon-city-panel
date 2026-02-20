import { PanelPlugin } from '@grafana/data';
import { CityOptions, DEFAULT_OPTIONS } from './types';
import { CityPanel } from './components/CityPanel';
import { LayoutEditor } from './components/editors/LayoutEditor';

export const plugin = new PanelPlugin<CityOptions>(CityPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      id: 'layout-editor',
      path: 'layout',
      name: 'City Layout',
      editor: LayoutEditor,
      defaultValue: DEFAULT_OPTIONS.layout,
    })
    .addTextInput({
      path: 'nameField',
      name: 'Name field',
      description: 'Column name that identifies each building',
      defaultValue: DEFAULT_OPTIONS.nameField,
    })
    .addTextInput({
      path: 'statusField',
      name: 'Status field',
      description: 'Column name for status text (online, warning, critical, offline)',
      defaultValue: DEFAULT_OPTIONS.statusField,
    })
    .addTextInput({
      path: 'valueField',
      name: 'Value field',
      description: 'Column name for numeric value (used with thresholds if no status field)',
      defaultValue: DEFAULT_OPTIONS.valueField,
    })
    .addNumberInput({
      path: 'thresholds.online',
      name: 'Online threshold',
      description: 'Value >= this = online (green)',
      defaultValue: DEFAULT_OPTIONS.thresholds.online,
    })
    .addNumberInput({
      path: 'thresholds.warning',
      name: 'Warning threshold',
      description: 'Value >= this = warning (orange)',
      defaultValue: DEFAULT_OPTIONS.thresholds.warning,
    })
    .addNumberInput({
      path: 'thresholds.critical',
      name: 'Critical threshold',
      description: 'Value >= this = critical (red). Below = offline.',
      defaultValue: DEFAULT_OPTIONS.thresholds.critical,
    })
    .addTextInput({
      path: 'trafficDensityField',
      name: 'Traffic density field',
      description: 'Column name for traffic density (0-100). Leave empty for default 50%.',
      defaultValue: '',
    })
    .addTextInput({
      path: 'trafficSpeedField',
      name: 'Traffic speed field',
      description: 'Column name for traffic speed (slow/normal/fast or 0-100 numeric)',
      defaultValue: '',
    })
    .addBooleanSwitch({
      path: 'enableInteraction',
      name: 'Enable interaction',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'showLabels',
      name: 'Show building labels',
      defaultValue: false,
    });
});
