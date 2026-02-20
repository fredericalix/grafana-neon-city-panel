# Grafana Plugin Development — Complete Reference

Reference guide for developing, testing, signing, and publishing Grafana plugins.
Sourced from official docs (https://grafana.com/developers/plugin-tools/) and Grafana source code.

---

## A. Plugin Lifecycle

```
create → develop → test → build → sign → publish
```

**Prerequisites:** Node >= 22, Docker, npm. Grafana Cloud account required for signing.

**Scaffolding:** `npx @grafana/create-plugin@latest` generates the full project structure.
Config in `.cprc.json` tracks create-plugin settings. Run `npx @grafana/create-plugin@latest update` to update scaffolding (overwrites `.config/`).

---

## B. PanelPlugin API

The plugin entry point (`src/module.ts`) must export a `plugin` constant:

```ts
import { PanelPlugin } from '@grafana/data';

export const plugin = new PanelPlugin<MyOptions>(MyPanelComponent)
  .setPanelOptions(builder => { /* ... */ })
  .useFieldConfig({ /* ... */ })
  .setMigrationHandler(handler)
  .setNoPadding()
  .setDataSupport({ annotations: true, alertStates: true })
  .setSuggestionsSupplier(supplier);
```

### Options builder methods

```ts
.setPanelOptions((builder) => {
  builder
    .addTextInput({ path: 'text', name: 'Label', defaultValue: 'Hello' })
    .addNumberInput({ path: 'count', name: 'Count', defaultValue: 10 })
    .addBooleanSwitch({ path: 'enabled', name: 'Enabled', defaultValue: true })
    .addSelect({ path: 'mode', name: 'Mode', defaultValue: 'auto',
      settings: { options: [
        { value: 'auto', label: 'Auto' },
        { value: 'manual', label: 'Manual' },
      ]}
    })
    .addRadio({ path: 'align', name: 'Alignment', defaultValue: 'left',
      settings: { options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
      ]}
    })
    .addCustomEditor({ id: 'custom', path: 'custom', name: 'Custom',
      editor: MyCustomEditor,
    })
})
```

### Field config

```ts
.useFieldConfig({
  standardOptions: {
    [FieldConfigProperty.Unit]: {},
    [FieldConfigProperty.Min]: {},
    [FieldConfigProperty.Max]: {},
    [FieldConfigProperty.Thresholds]: {},
    [FieldConfigProperty.Color]: { settings: { byValueSupport: true } },
  },
  useCustomConfig: (builder) => {
    builder.addBooleanSwitch({ path: 'custom.showLabels', name: 'Show labels' });
  },
})
```

### Migration handler

Called when the installed plugin version differs from the stored dashboard version:

```ts
function migrationHandler(panel: PanelModel<Partial<MyOptions>>): Partial<MyOptions> {
  const options = { ...panel.options };

  // Add new options with defaults
  if (options.newFeature === undefined) {
    options.newFeature = 'defaultValue';
  }

  // Rename options
  if ((options as any).oldName) {
    options.newName = (options as any).oldName;
    delete (options as any).oldName;
  }

  // Version-specific logic
  const v = panel?.pluginVersion ?? '';
  if (v === '' || v.startsWith('1.')) {
    options.displayMode = 'compact';
  }

  return options;
}
```

Changes are NOT auto-persisted — user must save the dashboard manually.

---

## C. PanelProps — What Grafana Passes to Your Component

```ts
interface PanelProps<T = any> {
  id: number;                           // Unique panel ID in dashboard
  data: PanelData;                      // Query results
  timeRange: TimeRange;                 // Dashboard time range
  timeZone: TimeZone;
  options: T;                           // Your panel options
  transparent: boolean;
  width: number;                        // Panel width in px
  height: number;                       // Panel height in px
  fieldConfig: FieldConfigSource;
  renderCounter: number;                // Increments each render
  title: string;
  eventBus: EventBus;

  // Callbacks
  onOptionsChange: (options: T) => void;
  onFieldConfigChange: (config: FieldConfigSource) => void;
  replaceVariables: InterpolateFunction;  // Interpolate dashboard variables
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}
```

### PanelData

```ts
interface PanelData {
  state: LoadingState;          // loading | done | error | streaming
  series: DataFrame[];          // Data frames with field overrides applied
  structureRev?: number;        // Increments when structure changes
  annotations?: DataFrame[];
  alertState?: AlertStateInfo;
  request?: DataQueryRequest;
  timings?: DataQueryTimings;
  errors?: DataQueryError[];
  error?: DataQueryError;       // Legacy single error
  timeRange: TimeRange;
}
```

### Event bus

```tsx
import { RefreshEvent } from '@grafana/runtime';
import { DataHoverEvent } from '@grafana/data';

useEffect(() => {
  const sub = eventBus.getStream(RefreshEvent).subscribe((event) => {
    console.log('Dashboard refreshed');
  });
  return () => sub.unsubscribe();  // CRITICAL: prevent memory leaks
}, [eventBus]);
```

### Variable interpolation

```ts
const resolved = replaceVariables('SELECT * FROM $table WHERE host = ${host:csv}');
```

---

## D. Data Frames

A DataFrame is a columnar structure: `{ name, fields: [{ name, type, values }] }`.

### Access patterns

```ts
// Get first frame
const frame = data.series[0];

// Find fields by type
const timeField = frame.fields.find(f => f.type === FieldType.time);
const valueField = frame.fields.find(f => f.type === FieldType.number);

// Find fields by name
const cpu = frame.fields.find(f => f.name === 'cpu');

// Iterate with DataFrameView
import { DataFrameView } from '@grafana/data';
const view = new DataFrameView(frame);
view.forEach(row => console.log(row.name, row.status));

// Display formatted value with color
const displayValue = valueField.display!(rawValue);
// displayValue = { text: "95.3", suffix: "%", color: "#ff0000", ... }
```

### Field display names

Always use `getFieldDisplayName(field, frame)` instead of `field.name` — this respects user-defined display name overrides.

---

## E. Grafana Internals — Plugin Loading

### Discovery

1. On startup, Grafana scans plugin directories for `plugin.json`
2. If a `dist/` subfolder exists, Grafana mounts `dist/` instead of the root
3. Plugin metadata is validated via `ReadPluginJSON()`

### Frontend loading sequence

```
1. syncGetPanelPlugin(id)           — check in-memory cache
2. getPanelPluginMeta(id)           — get metadata from config.panels
3. SystemJS.import(modulePath)      — load module.js
4. module.plugin                    — extract PanelPlugin instance
5. plugin.meta = meta               — attach metadata
6. pluginsCache.set(id, plugin)     — cache for future use
```

### Rendering pipeline

```
PanelRenderer.tsx
  → Load plugin (sync cache → async import)
  → getPanelOptionsWithDefaults() — merge plugin defaults + saved options
  → applyFieldOverrides() — apply field config + overrides to data
  → PluginContextProvider wrapper
  → <PanelComponent {...panelProps} /> — render your component
  → ErrorBoundary for crash isolation
```

### Frontend sandbox

- Optional: isolates plugin code execution
- Distortion layer prevents direct access to sensitive browser APIs
- Enabled per-plugin by Grafana (not developer-controlled)

### Signature verification

Grafana checks `MANIFEST.txt` in the plugin directory:
- Contains SHA256 checksums of all plugin files
- Signed with a private key (Grafana, commercial, or community)
- Unsigned plugins only load if explicitly allowed in Grafana config:
  `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: whooktown-neoncity-panel`

### SRI (Subresource Integrity)

Webpack generates integrity hashes. Grafana can verify loaded scripts match expected hashes.

---

## F. plugin.json Reference

### Required fields

```json
{
  "$schema": "https://raw.githubusercontent.com/grafana/grafana/main/docs/sources/developers/plugins/plugin.schema.json",
  "type": "panel",
  "id": "orgslug-pluginname-panel",
  "name": "Display Name",
  "info": {
    "keywords": ["panel", "visualization"],
    "description": "What this plugin does",
    "author": { "name": "Author Name" },
    "logos": { "small": "img/logo.svg", "large": "img/logo.svg" },
    "version": "%VERSION%",
    "updated": "%TODAY%",
    "links": [],
    "screenshots": []
  },
  "dependencies": {
    "grafanaDependency": ">=12.3.0",
    "plugins": []
  }
}
```

### ID pattern

`^[0-9a-z]+\-([0-9a-z]+\-)?(app|panel|datasource)$`

For publishing, the ID must start with your Grafana Cloud org slug: `{slug}-{name}-panel`.

### Panel-specific options

| Field | Description |
|-------|-------------|
| `skipDataQuery` | Plugin doesn't issue queries (boolean) |
| `hideFromList` | Don't show in visualization picker (boolean) |
| `suggestions` | Plugin implements visualization suggestions (boolean) |
| `sort` | Sort order in visualization picker (number) |

### Placeholders

`%VERSION%` and `%TODAY%` are replaced at build time by the webpack config.

### Routes (data source / app plugins)

```json
"routes": [{
  "path": "api",
  "url": "https://api.example.com",
  "tokenAuth": { "url": "https://auth.example.com/token", "params": {} },
  "headers": [{ "name": "Authorization", "content": "Bearer {{.SecureJsonData.token}}" }]
}]
```

### Extensions (app plugins)

```json
"extensions": {
  "addedComponents": [{ "title": "My Component", "targets": ["grafana/dashboard/panel/menu/v1"] }],
  "addedLinks": [{ "title": "My Link", "targets": ["grafana/explore/toolbar/action/v1"] }],
  "exposedComponents": [{ "id": "myorg-myapp/component/v1", "title": "Shared Component" }]
}
```

---

## G. Build & Distribution

### Webpack

- Config at `.config/webpack/webpack.config.ts` — **do not modify**
- Uses SWC for TypeScript transpilation
- Output: AMD module format for Grafana compatibility
- Dev mode: source maps + LiveReload
- Prod mode: Terser minification + SRI hashes

### Extending webpack

1. Create `webpack.config.ts` at project root
2. Use `webpack-merge` to merge with the base config
3. Update `package.json` scripts to use `-c ./webpack.config.ts`

```ts
// webpack.config.ts (project root)
import { merge } from 'webpack-merge';
import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env: Record<string, unknown>) => {
  const baseConfig = await grafanaConfig(env);
  return merge(baseConfig, {
    // your customizations
  });
};

export default config;
```

### Packaging for distribution

```bash
npm run build
cd dist
zip -r whooktown-neoncity-panel-1.0.0.zip .
```

Expected ZIP structure:
```
whooktown-neoncity-panel/
├── module.js
├── module.js.map
├── plugin.json
├── img/
├── MANIFEST.txt (after signing)
└── README.md
```

Backend plugin binaries must have `0755` permissions (`-rwxr-xr-x`).

### Validation

```bash
npx @grafana/plugin-validator@latest -sourceCodeUri https://github.com/org/repo dist/
```

---

## H. Signing

### Prerequisites

1. Create a Grafana Cloud account
2. Go to **My Account > Security > Access Policies**
3. Create a policy with realm `<YOUR_ORG>` (all-stacks), scope `plugins:write`
4. Generate a token (set expiration for security)

### Public plugin signing

```bash
export GRAFANA_ACCESS_POLICY_TOKEN=<token>
npx @grafana/sign-plugin@latest
```

### Private plugin signing

```bash
export GRAFANA_ACCESS_POLICY_TOKEN=<token>
npx @grafana/sign-plugin@latest --rootUrls https://grafana.mycompany.com
```

The `--rootUrls` must match the Grafana instance's `root_url` config.

### MANIFEST.txt

Generated in `dist/`. Contains:
- Plugin metadata (id, version)
- SHA256 checksums of every file in the distribution
- Cryptographic signature

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Modified signature" (Windows) | Backslashes in MANIFEST.txt | Replace `\\` with `/` |
| "Field is required: rootUrls" (public) | No signature level assigned | Wait for Grafana team to assign level |
| "Field is required: rootUrls" (private) | Missing rootUrls | Add `--rootUrls` flag |

### Development mode (no signing needed)

The Docker dev environment already includes:
```yaml
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: whooktown-neoncity-panel
```

---

## I. Publishing to Marketplace

### Prerequisites

- Plugin built and packaged as ZIP
- Plugin passes `@grafana/plugin-validator`
- Sample dashboards and test data included (provisioning/)
- Public source code repository

### Submission

1. Sign into Grafana Cloud (admin role required)
2. Go to **Org Settings > My Plugins > Submit New Plugin**
3. Fill form:
   - Plugin ZIP URL (e.g., GitHub release asset)
   - Source code repository link
   - SHA1 hash of the ZIP
   - Testing instructions
   - Architecture: single or multiple

### Review process

1. Automated validation (structure, metadata, security checks)
2. Manual inspection by Grafana Plugins team (code review, functionality testing)
3. No guarantee of acceptance — evaluated case by case

### Updates

Same process. Faster review if test environment already established.

### Release automation (GitHub Actions)

The project has `.github/workflows/release.yml`:
- Triggered by version tags (`v*`)
- Builds plugin, optionally signs, creates GitHub release
- To enable signing: set `GRAFANA_ACCESS_POLICY_TOKEN` as a GitHub secret

Release workflow:
```bash
npm version patch   # or minor, major
git push origin main --follow-tags
```

---

## J. Testing

### Unit tests (Jest)

```bash
npm run test         # Watch mode (--onlyChanged)
npm run test:ci      # CI mode (--passWithNoTests --maxWorkers 4)
```

Config: `jest.config.js` extends `.config/jest.config` (SWC transformer, jsdom, TZ=UTC).

Fix ESM import errors:
```js
// jest.config.js
module.exports = {
  ...require('./.config/jest.config'),
  transformIgnorePatterns: [
    'node_modules/(?!(@grafana|someEsmPackage)/)',
  ],
};
```

### E2E tests (Playwright)

```bash
npm run server       # Start Grafana in Docker
npm run e2e          # Run Playwright tests
```

Framework: `@grafana/plugin-e2e` — provides fixtures for:
- Panel rendering
- Data source configuration
- Provisioned dashboards
- Authentication flow

Config: `playwright.config.ts` (Chrome, baseURL: `http://localhost:3000`).

### CI pipeline (`.github/workflows/ci.yml`)

```
checkout → setup Node 22 → npm ci
  → typecheck → lint → test:ci → build
  → [optional] sign → package ZIP → upload artifact
  → resolve Grafana versions → run E2E matrix
  → publish test report
```

---

## K. Extending Configurations

**Rule: always extend, never replace** configs from `.config/`.

| Tool | File to edit | Base config |
|------|-------------|-------------|
| Webpack | `webpack.config.ts` (root) | `.config/webpack/webpack.config.ts` |
| ESLint | `eslint.config.mjs` (root) | `.config/eslint.config.mjs` |
| Prettier | `.prettierrc.js` (root) | `.config/.prettierrc.js` |
| Jest | `jest.config.js` (root) | `.config/jest.config` |
| Jest setup | `jest-setup.js` (root) | `.config/jest-setup.js` |
| TypeScript | `tsconfig.json` (root) | `.config/tsconfig.json` |

The `npx @grafana/create-plugin@latest update` command overwrites everything in `.config/`.

---

## L. Troubleshooting

| Problem | Solution |
|---------|----------|
| Plugin doesn't load (WSL) | Must use WSL 2 terminal. Node must be installed inside WSL. |
| Webpack doesn't detect changes (WSL) | Add `watchOptions: { poll: true }` to webpack config |
| Jest "Cannot use import statement" | Extend `transformIgnorePatterns` in jest.config.js |
| Docker image mismatch (Apple Silicon) | `docker compose down && docker rmi <image> && docker compose up` |
| Plugin not reloading | Restart Grafana after plugin.json changes |
| "plugin not registered" | Check `dist/` exists and contains `module.js` + `plugin.json` |
| Stale cache after rebuild | Hard refresh browser (Cmd+Shift+R) or clear Grafana plugin cache |

---

## M. Documentation URLs

| Topic | URL |
|-------|-----|
| Full doc index | https://grafana.com/developers/plugin-tools/llms.txt |
| How-to guides | https://grafana.com/developers/plugin-tools/how-to-guides.md |
| Panel plugins | https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins.md |
| Data frames | https://grafana.com/developers/plugin-tools/key-concepts/data-frames.md |
| plugin.json ref | https://grafana.com/developers/plugin-tools/reference/plugin-json.md |
| Extend configs | https://grafana.com/developers/plugin-tools/how-to-guides/extend-configurations.md |
| Sign a plugin | https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin.md |
| Package a plugin | https://grafana.com/developers/plugin-tools/publish-a-plugin/package-a-plugin.md |
| Publish a plugin | https://grafana.com/developers/plugin-tools/publish-a-plugin/publish-a-plugin.md |
| Best practices | https://grafana.com/developers/plugin-tools/key-concepts/best-practices.md |
| Troubleshooting | https://grafana.com/developers/plugin-tools/troubleshooting.md |
| E2E testing | https://grafana.com/developers/plugin-tools/e2e-test-a-plugin.md |
| Plugin validator | https://github.com/grafana/plugin-validator |
| @grafana/ui | https://developers.grafana.com/ui/latest/index.html |
| Tutorials | https://grafana.com/developers/plugin-tools/tutorials.md |
| Plugin lifecycle | https://grafana.com/developers/plugin-tools/key-concepts/plugin-lifecycle.md |

Append `.md` to any page URL for plain-text markdown (e.g., `https://grafana.com/developers/plugin-tools/index.md`).
