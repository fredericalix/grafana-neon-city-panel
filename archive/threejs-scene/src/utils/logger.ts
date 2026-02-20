/**
 * Centralized logging utility with module filtering
 *
 * By default, all logs are DISABLED in production.
 * To enable logs, build with: VITE_DEBUG=true npm run build
 * Or at runtime: window.enableAllLogs()
 */

// Debug mode detection at compile time (Vite replaces import.meta.env.VITE_*)
const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true';

// Debug modules list (for selective debugging)
const DEBUG_MODULES: string[] = [];

// Configuration: 'all' enables everything, empty array disables all
// DEBUG_MODE enables all logs, otherwise logs are disabled
let enabledModules: string[] | 'all' = DEBUG_MODE ? 'all' : [];

/**
 * Configure which modules can log
 * @param modules - 'all' for all modules, or array of module names
 */
export function setEnabledModules(modules: string[] | 'all'): void {
  enabledModules = modules;
  // Only log if we're enabling something
  if (modules === 'all' || modules.length > 0) {
    console.log('[Logger] Enabled modules:', modules);
  }
}

/**
 * Get currently enabled modules
 */
export function getEnabledModules(): string[] | 'all' {
  return enabledModules;
}

/**
 * Enable all modules (useful for full debugging)
 */
export function enableAllLogs(): void {
  setEnabledModules('all');
}

/**
 * Enable only debug modules
 */
export function enableDebugLogsOnly(): void {
  setEnabledModules(DEBUG_MODULES);
}

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a logger for a specific module
 * @param module - Module name (e.g., 'AudioManager', 'WebSocket')
 */
export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;

  const shouldLog = (): boolean =>
    enabledModules === 'all' || enabledModules.includes(module);

  return {
    log: (...args: unknown[]): void => {
      if (shouldLog()) console.log(prefix, ...args);
    },
    warn: (...args: unknown[]): void => {
      if (shouldLog()) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]): void => {
      // Errors are always logged regardless of filter
      console.error(prefix, ...args);
    },
  };
}

// Expose to window for runtime debugging
if (typeof window !== 'undefined') {
  (window as any).enableAllLogs = enableAllLogs;
  (window as any).enableDebugLogsOnly = enableDebugLogsOnly;
  (window as any).setEnabledModules = setEnabledModules;
}
