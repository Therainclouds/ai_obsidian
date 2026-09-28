/**
 * ACP 握手探针（M0a · 冒烟验证）
 *
 * 目的：在写任何产品代码之前，用最小代价确认 `hermes acp` 的协议面。
 * 这份脚本是 agent/acp-client.ts 的种子（DESIGN-SPEC §9.3）。
 *
 * 两个已踩到的坑（都是实测出来的，不是查文档得到的）：
 *  1. 帧格式 = **换行分隔的裸 JSON**，不是 LSP 的 Content-Length。
 *     证据：venv/Lib/site-packages/acp/connection.py 的 `readline()` + `json.loads(line)`。
 *  2. **必须等适配器就绪后再发** —— 早于读循环写入的消息会被启动阶段吞掉，
 *     适配器连上（"ACP client connected"）却永远不回 initialize。
 *
 * 用法（Windows）：
 *   $env:HERMES_HOME="$env:TEMP\acp-scratch"
 *   $env:HERMES_PY="$env:LOCALAPPDATA\hermes\hermes-agent\venv\Scripts\python.exe"
 *   $env:HERMES_CLI="$env:LOCALAPPDATA\hermes\hermes-agent\hermes"
 *   node scripts/acp-probe.mjs
 *
 * 安全：HERMES_HOME 必须指向临时目录 —— 绝不碰用户真实 home。
 * 参考 ADR-0002（编排分治）与 ADR-0008（进程拓扑）。
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const HERMES_HOME = process.env.HERMES_HOME;
const PY = process.env.HERMES_PY;
const CLI = process.env.HERMES_CLI;
const TIMEOUT_MS = Number(process.env.ACP_TIMEOUT_MS ?? 45_000);

if (!HERMES_HOME || !PY || !CLI) {
  console.error('缺少环境变量：需要 HERMES_HOME / HERMES_PY / HERMES_CLI');
  process.exit(2);
}

const child = spawn(PY, [CLI, 'acp'], {
  env: {
    ...process.env,
    HERMES_HOME,
    PYTHONDONTWRITEBYTECODE: '1', // 不写 .pyc，避免触发大批量 __pycache__ 清理
    PYTHONUNBUFFERED: '1',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

child.on('error', (e) => console.error('[spawn-error]', e.message));
child.on('exit', (code) => console.log(`[exit] code=${code}`));

function send(msg) {
  child.stdin.write(JSON.stringify(msg) + '\n'); // <- 换行分隔，不是 Content-Length
  console.log(`[send] ${JSON.stringify(msg)}`);
}

let sent = false;
function sendInitializeOnce() {
  if (sent) return;
  sent = true;
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      clientInfo: { name: 'ai-obsidianlike-probe', version: '0.0.1' },
    },
  });
}

child.stderr.on('data', (d) => {
  const s = d.toString('utf8');
  process.stdout.write(`[stderr] ${s}`);
  // 等适配器真的把读循环跑起来，再发
  if (s.includes('ACP client connected')) {
    console.log('--- 检测到 client connected，延迟 500ms 后发包 ---');
    setTimeout(sendInitializeOnce, 500);
  }
});

let buf = '';
child.stdout.on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.log(`[recv-raw] ${line}`);
      continue;
    }
    console.log(`[recv] ${JSON.stringify(msg, null, 2)}`);

    if (msg.id === 1 && msg.result) {
      console.log('=== initialize OK ===');
      console.log('--- 继续发 session/new 探形状（不带 model，预期会因 provider 缺失而失败）---');
      send({
        jsonrpc: '2.0',
        id: 2,
        method: 'session/new',
        params: { cwd: process.cwd(), mcpServers: [] },
      });
    }
    if (msg.id === 2) {
      console.log(`=== session/new 回应 === ${msg.error ? 'ERROR' : 'OK'}`);
    }
  }
});

// 兜底：若没等到那句日志，8 秒后也发一次
setTimeout(sendInitializeOnce, 8000);

setTimeout(() => {
  console.log('[probe] 超时，关闭');
  child.kill();
  process.exit(0);
}, TIMEOUT_MS);
