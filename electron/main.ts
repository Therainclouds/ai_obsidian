/**
 * 桌面壳入口 · boot（ADR-0009 · DESIGN-SPEC §9.1.3）
 *
 * **主进程就是本地宿主**。这一层只做组合与启动：建窗口、装 IPC、把方法表挂上去。
 * 业务在 `agent/services/`，方法表在 `agent/ipc.ts`，协议在 `agent/acp-client.ts`。
 *
 * 它也是**知识空间唯一的写入者**（M0 阶段还没有写任何文件）。
 * 之所以能直跑 TypeScript：Electron v44 内置 Node 24，`process.features.typescript === 'strip'`
 * —— 与 `node agent/index.ts` 是同一个机制，**不需要任何构建步骤**。
 *
 * 依赖克制：只用 electron 与 node 内置（ADR-0004 §1「内存是硬预算 · 白名单之外不再装依赖」）。
 */
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOST_CANCEL,
  HOST_INVOKE,
  HOST_STREAM,
  streamChannel,
  type StreamFrame,
} from '../shared/ipc.ts';
import { channelCoverage, INVOKE, STREAM } from '../agent/ipc.ts';
import { disposeAgent, getStatus } from '../agent/services/agent.service.ts';
import { describeStore } from '../agent/store/index.ts';
import { runSelfTest } from './selftest.ts';
import { SHOT_LIST, takeShots } from './shots.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

/**
 * 开发态：窗口去连 Vite dev server（HMR 照旧）；不带 `--dev` 即走生产路径（loadFile）。
 *
 * 用 argv 而不是环境变量，是为了**不在 Windows 上依赖 `cross-env` 之类的包**
 * （ADR-0004 §1：白名单之外不再装依赖）。开发时要两个终端：
 * 一个 `npm run dev`（渲染器的 dev server），一个 `npm run app`（这个壳）。
 */
const DEV = process.argv.includes('--dev');
const DEV_URL = DEV ? 'http://localhost:5173' : null;

/** 冒烟自检：跑一遍然后退出。见 electron/selftest.ts —— 桌面壳的问题多是静默失败 */
const SELFTEST = process.argv.includes('--selftest');

/** 逐页截图到 `design/app-shots/`。与原型截图分开放，那边是**基准**，这边是**实现** */
const SHOTS = process.argv.includes('--shots');

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'AI 知识系统',
    // 首帧是主题底色，避免白闪（配色见 tokens.css 的 --bg）
    backgroundColor: '#F5F6FA',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(ROOT, 'electron', 'preload.cjs'),
      // 三条一起决定能力面：渲染器没有 Node、没有文件系统、没有进程（ADR-0009）
      nodeIntegration: false,
      contextIsolation: true,
      // sandbox 保持默认（开）。preload 只用 contextBridge + ipcRenderer，够了
    },
  });

  // 准备好再显示：避免看到未样式化的首帧
  win.once('ready-to-show', () => win.show());

  // 外部链接交给系统浏览器，不在应用内开新窗口（应用只有这一个窗口）
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // 自检模式：页面加载完就跑一遍冒烟，然后退出（不起第二个终端，也不需要人看）
  if (SELFTEST) {
    win.webContents.once('did-finish-load', () => {
      void runSelfTest(win).then(() => app.quit());
    });
  }

  // 截图模式：跑完自检（若也带了 --selftest）再逐页拍，然后退出
  if (SHOTS) {
    win.webContents.once('did-finish-load', () => {
      void (async () => {
        if (SELFTEST) await runSelfTest(win);
        await takeShots(win, join(ROOT, 'design', 'app-shots'), SHOT_LIST);
        app.quit();
      })();
    });
  }

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(join(DIST, 'index.html'));

  return win;
}

function registerIpc(): void {
  ipcMain.handle(HOST_INVOKE, async (_e, channel: string, payload: unknown) => {
    const handle = INVOKE[channel];
    // 表外的方法直接抛 —— 这就是白名单（ADR-0009 §2）
    if (!handle) throw new Error(`未知方法：${channel}`);
    return await handle(payload);
  });

  ipcMain.handle(
    HOST_STREAM,
    async (e, channel: string, payload: unknown, reqId: string) => {
      const handle = STREAM[channel];
      if (!handle) throw new Error(`未知流方法：${channel}`);

      const emit = (event: string, data: unknown): void => {
        // 窗口已被关掉时别再推，否则主进程会抛
        if (e.sender.isDestroyed()) return;
        const frame: StreamFrame = { event, data };
        e.sender.send(streamChannel(reqId), frame);
      };

      await handle(payload, emit);
    },
  );

  // 取消只标记"别再往回推"。真正的"中途打断生成"要 ACP 支持（§6.3.1）
  ipcMain.handle(HOST_CANCEL, (_e, reqId: string) => {
    CANCELLED.add(reqId);
  });
}

const CANCELLED = new Set<string>();

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  const { installed, agentInfo } = getStatus();
  console.log(`[host] 桌面壳已启动（主进程即本地宿主）`);
  console.log(`[host] 前端产物: ${DEV_URL ?? DIST}`);
  console.log(
    `[host] agent 运行时: ${installed ? `已就绪（${agentInfo?.name ?? '已初始化'}）` : '未找到'}`,
  );

  // 接口面的账：已定名的方法全部注册了（未实现的抛"尚未实现"），打一行省得每次去数
  const cov = channelCoverage();
  console.log(`[host] 接口: 已实现 ${cov.done} / 已定名 ${cov.total}（留空清单见 docs/接口规范.md §4）`);
  // 数据源的账。夹具是"看不见就会变味"的东西，所以每次都报
  console.log(`[host] 数据源: ${describeStore()}`);

  // macOS 习惯：点 dock 图标且没有窗口时重建。目标机是 Linux，保留无害
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// 宿主退出 → agent 运行时（子进程）必须跟着退，避免"一个 home 两个 agent"（ADR-0002 §5）
app.on('before-quit', () => {
  disposeAgent();
});
