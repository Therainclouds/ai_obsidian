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
 * 五个一级入口。名称、图标、一句话解释三者都与原型逐字一致（原则 2）。
 * 共 5 个页面 + 1 个全局层，不得随意增删（§1.3）。
 */
export interface RouteDef {
  key: RouteKey;
  name: string;
  /** 一句话解释——禁止只放名词让用户猜 */
  desc: string;
  Icon: ComponentType<{ size?: number }>;
  group: 'space' | 'system';
  Component: () => JSX.Element;
}

export const ROUTES: RouteDef[] = [
  {
    key: 'chat',
    name: '聊天',
    desc: '和 AI 对话，随手记录想法',
    Icon: IconChat,
    group: 'space',
    Component: ChatPage,
  },
  {
    key: 'files',
    name: '文件管理',
    desc: '素材、笔记与它们的关联',
    Icon: IconFiles,
    group: 'space',
    Component: FilesPage,
  },
  {
    key: 'graph',
    name: '进化图谱',
    desc: '信息如何一步步长成知识',
    Icon: IconGraph,
    group: 'space',
    Component: GraphPage,
  },
  {
    key: 'summary',
    name: '知识总结',
    desc: '数据回顾与 AI 自动总结',
    Icon: IconSummary,
    group: 'space',
    Component: SummaryPage,
  },
  {
    key: 'settings',
    name: '设置 & 我的',
    desc: '账户、外观与系统偏好',
    Icon: IconSettings,
    group: 'system',
    Component: SettingsPage,
  },
];
