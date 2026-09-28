/**
 * ACP over stdio 客户端（DESIGN-SPEC §9.3 / §9.6）
 *
 * 驱动 `hermes acp` 子进程（ADR-0008：agent 运行时是本地宿主拉起的子进程）。
 *
 * 两条实测得来的铁律，写在最前面，改动时别踩回去：
 *  1. 帧格式 = **换行分隔的裸 JSON**。不是 LSP 的 Content-Length ——
 *     证据：acp/connection.py 的 `readline()` + `json.loads(line)`。
 *  2. **必须等适配器打出 "ACP client connected" 之后再发**。早了会被启动阶段吞掉，
 *     而且症状极具迷惑性：连接已建立，initialize 却永远不回。
 *
 * 协议面实测记录见 DESIGN-SPEC §9.6（Hermes v0.21.5）。
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

export interface AgentInfo {
  name: string;
  version: string;
}

export interface AgentCapabilities {
  loadSession?: boolean;
  promptCapabilities?: { image?: boolean };
  sessionCapabilities?: { fork?: object; list?: object; resume?: object };
}

export interface InitializeResult {
  protocolVersion: number;
  agentInfo: AgentInfo;
  agentCapabilities: AgentCapabilities;
  authMethods?: Array<{ id: string; name?: string; type?: string }>;
}

/** agent 侧发来的通知，形如 `session/update` */
export interface SessionUpdate {
  sessionId?: string;
  update?: {
    sessionUpdate?: string;
    content?: { type?: string; text?: string };
    [k: string]: unknown;
  };
}

export interface AcpErrorShape {
  code: number;
  message: string;
  details?: string;
}

/** Hermes 的定位：优先读环境变量，其次用平台默认安装位置（ADR-0003 的 home 约定）。 */
export function resolveHermes(): { py: string; cli: string; home: string } {
  const home = process.env.HERMES_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'hermes');
  const root = join(home, 'hermes-agent');
  return {
    py: process.env.HERMES_PY ?? join(root, 'venv', 'Scripts', 'python.exe'),
    cli: process.env.HERMES_CLI ?? join(root, 'hermes'),
    home,
  };
}

export function hermesAvailable(): boolean {
  const { py, cli } = resolveHermes();
  return existsSync(py) && existsSync(cli);
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class AcpClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buf = '';
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readyResolve: (() => void) | null = null;
  private ready = new Promise<void>((r) => (this.readyResolve = r));
  private onUpdate: ((u: SessionUpdate) => void) | null = null;

  /** 拉起来并完成握手。返回 initialize 的结果。 */
  async start(): Promise<InitializeResult> {
    const { py, cli, home } = resolveHermes();
    this.child = spawn(py, [cli, 'acp'], {
      env: {
        ...process.env,
        HERMES_HOME: home,
        PYTHONDONTWRITEBYTECODE: '1', // 不写 .pyc，避免大批量 __pycache__ 清理
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (d: string) => this.onData(d));

    // 铁律 2：等这句日志出现，才认为读循环真的起来了
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (d: string) => {
      if (d.includes('ACP client connected')) this.readyResolve?.();
      if (process.env.ACP_DEBUG) process.stderr.write(`[hermes] ${d}`);
    });

    this.child.on('exit', (code) => {
      const err = new Error(`agent 运行时退出（code=${code}）`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });

    await this.ready;
    await new Promise((r) => setTimeout(r, 500)); // 就绪后再留一档，稳

    return (await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      clientInfo: { name: 'ai-obsidianlike', version: '0.1.0' },
    })) as InitializeResult;
  }

  /** 新建会话。`cwd` 是 per-session 字段 —— 这是 ADR-0006「切空间要不要重启」的关键。 */
  async newSession(cwd: string): Promise<{ sessionId: string }> {
    return (await this.request('session/new', { cwd, mcpServers: [] })) as { sessionId: string };
  }

  /** 发一轮对话。流式增量通过 onUpdate 回调出去。 */
  async prompt(sessionId: string, text: string): Promise<unknown> {
    return this.request('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  setUpdateHandler(fn: ((u: SessionUpdate) => void) | null): void {
    this.onUpdate = fn;
  }

  stop(): void {
    this.child?.kill();
    this.child = null;
  }

  // ---- 私有 ----

  private request(method: string, params: unknown): Promise<unknown> {
    if (!this.child) return Promise.reject(new Error('agent 运行时未启动'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child!.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let i: number;
    while ((i = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (!line) continue;

      let msg: {
        id?: number;
        method?: string;
        result?: unknown;
        error?: AcpErrorShape;
        params?: SessionUpdate;
      };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      // agent 主动推来的通知
      if (msg.method && msg.id === undefined) {
        if (msg.method === 'session/update' && msg.params) this.onUpdate?.(msg.params);
        continue;
      }

      if (msg.id === undefined) continue;
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      if (msg.error) {
        const e = new Error(msg.error.details ?? msg.error.message) as Error & AcpErrorShape;
        e.code = msg.error.code;
        e.details = msg.error.details;
        p.reject(e);
      } else {
        p.resolve(msg.result);
      }
    }
  }
}
