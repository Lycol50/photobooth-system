import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  publicDir: resolve(import.meta.dirname, 'resources'),
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
  },
});
