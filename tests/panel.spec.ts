import { test, expect } from '@grafana/plugin-e2e';

test('should render the panel with data', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  // The panel renders a Three.js canvas element
  await expect(panelEditPage.panel.locator.locator('canvas')).toBeVisible();
});

test('should display "No data" when panel has no query', async ({
  panelEditPage,
}) => {
  await panelEditPage.setVisualization('Neon-City-Panel');
  await expect(panelEditPage.panel.locator).toContainText('No data');
});
