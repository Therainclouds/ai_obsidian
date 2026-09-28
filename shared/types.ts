// 前后端共用类型（DESIGN-SPEC §9.3：shared/）。
// M0 只放骨架需要的部分，数据模型（`kind` / 来源关系 / 关联 / 边类型）待定，见 §10.2 C。

/** 五个一级入口 + 全局 AI 层。命名与图标固定，不得随意增删（§1.3）。 */
export type RouteKey = 'chat' | 'files' | 'graph' | 'summary' | 'settings';

/** 本地宿主的健康检查响应。 */
export interface HealthPayload {
  ok: boolean;
  /** 宿主进程启动至今的秒数 */
  uptimeSec: number;
  /** 是否已建立会话（不是"装没装"——那是 agentStatus 的事） */
  agentConnected: boolean;
  /** 当前知识空间。M0 只有一个占位值。 */
  space: string;
}

/**
 * agent 运行时的能力面。**形状归 shared/**：它是宿主与渲染器之间的线上形状，
 * 不属于宿主实现（`agent/services/` 只是它的产出者）。
 *
 * 字段是 ACP `initialize` 结果的一个**子集**——只带渲染器真会用的那些，
 * 不把整个 InitializeResult 漏出去（那是宿主的内部协议）。
 */
export interface AgentStatus {
  /** 本机找不找得到 agent 运行时的可执行文件 */
  installed: boolean;
  /** 定位结果，供设置页显示"它在哪" */
  resolved: { py: string; cli: string; home: string };
  /** 是否已握手（懒启动：第一次真要用时才拉起） */
  initialized: boolean;
  agentInfo: { name: string; version: string } | null;
  capabilities: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean };
    sessionCapabilities?: { fork?: object; list?: object; resume?: object };
  } | null;
  hasSession: boolean;
  /** 上一次失败的原始消息。**渲染器不得直接显示它** —— 要过 §6.3.3 的五型翻译 */
  error: string | null;
}
