import { test, expect } from '@grafana/plugin-e2e';

test('should load the panel and display visualization name', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  // Verify the panel loaded with the correct visualization type
  await expect(panelEditPage.panel.locator).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change visualization' })).toContainText('Neon-City-Panel');
});
