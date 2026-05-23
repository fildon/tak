import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  // Deploy to /tak/ on GitHub Pages; use / for local dev.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [wasm(), react()],
  server: { port: 3000 },
  optimizeDeps: {
    // Exclude the wasm package from dep optimisation so Vite sees it as a
    // plain ES module + binary asset.  @tak/shared now emits ESM so no
    // CJS pre-bundling workaround is needed.
    exclude: ['@tak/engine'],
  },
  worker: {
    // Ensure Web Workers are also processed by vite-plugin-wasm.
    plugins: () => [wasm()],
  },
});
