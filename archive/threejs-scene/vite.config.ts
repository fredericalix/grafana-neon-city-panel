import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/auth': 'http://localhost:8981',
      '/ws': {
        target: 'ws://localhost:8082',
        ws: true,
      },
      '/ui': 'http://localhost:8083',
      '/sensors': 'http://localhost:8081',
      '/camera': 'http://localhost:8081',
      '/account': 'http://localhost:8981',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  esbuild: {
    // Only drop console/debugger when not in debug mode
    drop: process.env.VITE_DEBUG === 'true' ? [] : ['console', 'debugger'],
  },
});
