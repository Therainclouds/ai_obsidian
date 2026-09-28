import type { RouteKey } from '../../shared/types';
import ChatPage from '../features/chat';
import FilesPage from '../features/files';
import GraphPage from '../features/graph';
import SummaryPage from '../features/summary';
import SettingsPage from '../features/settings';

/**
 * 五个一级入口。命名、图标、一句话解释三者固定（DESIGN-SPEC 原则 2）。
 * 共 5 个页面 + 1 个全局层，不得随意增删（§1.3）。
 */
export interface RouteDef {
  key: RouteKey;
  name: string;
  /** 一句话解释——禁止只放名词让用户猜 */
  desc: string;
  icon: string;
  group: 'space' | 'system';
  Component: () => JSX.Element;
}

export const ROUTES: RouteDef[] = [
  { key: 'chat', name: '聊天', desc: '和 AI 对话，随手记录想法', icon: '◍', group: 'space', Component: ChatPage },
  { key: 'files', name: '文件管理', desc: '你投进来的素材，按自己的文件夹整理', icon: '▤', group: 'space', Component: FilesPage },
  { key: 'graph', name: '进化图谱', desc: '看信息怎么一步步长成知识', icon: '◈', group: 'space', Component: GraphPage },
  { key: 'summary', name: '知识总结', desc: '按日 / 周 / 月 / 年回看你的知识点', icon: '◔', group: 'space', Component: SummaryPage },
  { key: 'settings', name: '设置 & 我的', desc: '知识空间、AI 模型与技能都在这里', icon: '⚙', group: 'system', Component: SettingsPage },
];
