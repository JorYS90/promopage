import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4010',
        changeOrigin: true,
        // Timeout 5min — buscar-lote com muitos produtos consulta Bing/Google/etc.
        timeout: 300000,
        proxyTimeout: 300000,
      },
      '/uploads': {
        target: 'http://localhost:4010',
        changeOrigin: true,
        timeout: 60000,
      },
    },
  },
});
