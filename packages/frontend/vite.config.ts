import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm(), react()],
  server: { port: 3000 },
  optimizeDeps: {
    // Pre-bundle shared (CJS) and exclude the wasm package from dep optimisation
    // so Vite sees it as a plain ES module + binary asset.
    include: ['@tak/shared'],
    exclude: ['@tak/engine'],
  },
  worker: {
    // Ensure Web Workers are also processed by vite-plugin-wasm.
    plugins: () => [wasm()],
  },
});
