// 前后端共用类型（DESIGN-SPEC §9.3：shared/）。
// M0 只放骨架需要的部分，数据模型（`kind` / 来源关系 / 关联 / 边类型）待定，见 §10.2 C。

/** 五个一级入口 + 全局 AI 层。命名与图标固定，不得随意增删（§1.3）。 */
export type RouteKey = 'chat' | 'files' | 'graph' | 'summary' | 'settings';

/** 本地宿主的健康检查响应。 */
export interface HealthPayload {
  ok: boolean;
  /** 宿主进程启动至今的秒数 */
  uptimeSec: number;
  /** 是否已接入 agent 运行时。M0 恒为 false —— ACP 接入在 M5（§9.4）。 */
  agentConnected: boolean;
  /** 当前知识空间。M0 只有一个占位值。 */
  space: string;
}
