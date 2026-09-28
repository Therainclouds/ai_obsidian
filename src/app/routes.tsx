import type { ComponentType } from 'react';
import type { RouteKey } from '../../shared/types';
import ChatPage from '../features/chat';
import FilesPage from '../features/files';
import GraphPage from '../features/graph';
import SummaryPage from '../features/summary';
import SettingsPage from '../features/settings';
import {
  IconChat,
  IconFiles,
  IconGraph,
  IconSettings,
  IconSummary,
} from '../components/icons';

/**
 * 五个一级入口。名称与图标与原型逐字一致（原则 2）。
 * 共 5 个页面 + 1 个全局层，不得随意增删（§1.3）。
 *
 * ⚠ **文案有两份，别合并**：原型里侧栏 `.nav-text small` 与页头 `.p-desc` 是**两句不同的话**
 * （侧栏讲"这页是干什么的"，页头讲"你能在这里看到什么"）。曾经把它们压成一个 `desc`
 * 字段，结果页头显示的是侧栏那句 —— 四处里错了三处。
 */
export interface RouteDef {
  key: RouteKey;
  /** 侧栏用。一句话解释——禁止只放名词让用户猜 */
  desc: string;
  /** 页头用（原型的 .p-desc）。聊天页无页头，此值不显示 */
  pageDesc: string;
  name: string;
  Icon: ComponentType<{ size?: number }>;
  group: 'space' | 'system';
  Component: () => JSX.Element;
}

export const ROUTES: RouteDef[] = [
  {
    key: 'chat',
    name: '聊天',
    desc: '和 AI 对话，随手记录想法',
    pageDesc: '和 AI 对话，随手记录想法',
    Icon: IconChat,
    group: 'space',
    Component: ChatPage,
  },
  {
    key: 'files',
    name: '文件管理',
    desc: '素材、笔记与它们的关联',
    pageDesc: '你存进来的一切，以及它们之间的连接',
    Icon: IconFiles,
    group: 'space',
    Component: FilesPage,
  },
  {
    key: 'graph',
    name: '进化图谱',
    desc: '信息如何一步步长成知识',
    pageDesc: '信息如何被理解、连接、蒸馏成知识',
    Icon: IconGraph,
    group: 'space',
    Component: GraphPage,
  },
  {
    key: 'summary',
    name: '知识总结',
    /**
     * 侧栏这句原为「数据回顾与 AI 自动总结」，含 ADR-0007 明令弃用的「自动总结」，
     * 且"总结"一词同时指两边（该 ADR consequence 4 禁止）。ADR-0007 要求改名同步到原型，
     * 但原型只改了规格书、漏了这一处。**下面这句是本次新拟的提案**，命名取自本页自己的
     * 两个面板（知识资产 / 周期回顾），不含歧义词。
     */
    desc: '知识资产与周期回顾',
    pageDesc: '你和 AI 一起积累的一切，都在这里被看见',
    Icon: IconSummary,
    group: 'space',
    Component: SummaryPage,
  },
  {
    key: 'settings',
    name: '设置 & 我的',
    desc: '账户、外观与系统偏好',
    pageDesc: '账户、外观与系统偏好',
    Icon: IconSettings,
    group: 'system',
    Component: SettingsPage,
  },
];
