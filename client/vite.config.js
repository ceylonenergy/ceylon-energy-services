import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pdfjsAssets from './vite-plugin-pdfjs-assets.js';

export default defineConfig({
  plugins: [react(), pdfjsAssets()],
  build: {
    outDir: 'dist',
    // Hashed bundles go in /static so the server can cache them forever
    // without also caching the un-hashed images in /assets.
    assetsDir: 'static',
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    // In development the API runs separately (npm run dev starts both);
    // this forwards /api calls to it so the browser sees one origin.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:5050' },
    },
  },
});
