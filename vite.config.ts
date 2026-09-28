import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 渲染器与宿主之间只有一条通道：IPC（DESIGN-SPEC §9.1.3 · ADR-0009）。
// **不再有 /api 代理** —— 没有 HTTP 服务了，也就没有什么要代理的（v1.5 删掉一整层）。
// 开发态这个 dev server 只负责给 Electron 窗口送页面与 HMR。
export default defineConfig({
  // 生产态窗口是用 file:// 加载 dist/index.html 的，资源必须用相对路径，
  // 否则 '/assets/…' 会被解析成文件系统根（详见 electron/main.ts 的 loadFile）
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
