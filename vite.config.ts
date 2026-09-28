import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { HOST_PORT } from './shared/ports';

// 前端与本地宿主之间只有一条通道：localhost 上的 HTTP + SSE（DESIGN-SPEC §9.1.3）。
// 开发态由 Vite 把 /api 与 /events 代理到宿主，生产态由宿主自己托管 dist。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://127.0.0.1:${HOST_PORT}`,
      '/events': `http://127.0.0.1:${HOST_PORT}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
