/**
 * 素材的类型徽章。**纯展示层** —— 数据层给的是 `mimeType`（一个事实），
 * 派生成"用什么字母、什么颜色"是界面的事。
 *
 * ⚠ **一处对原型的补充，需要设计确认**：原型只演示了 4 种（Markdown / PDF / 图片 /
 * 网页剪藏，加上知识点的"知"共 5 种），而真实素材会有别的类型（`.docx` / `.txt` /
 * 音视频……）。这里给未知类型派了一个 `other`（中性色，**取自 `.b-url` 用的同一对
 * token**，没有发明新颜色）。**这是原型没覆盖的口子，不是重新设计** —— 但它确实是
 * 一份新拟的东西，应当被看见、被确认或改掉。
 */

export type BadgeKey = 'md' | 'pdf' | 'img' | 'url' | 'other';

export interface MaterialKind {
  /** CSS 类后缀：`.b-<key>` */
  badge: BadgeKey;
  /** 徽章里那个字（英文单词首字母的惯例，与原型一致） */
  letter: string;
  /** 列表的「类型」列 */
  label: string;
}

const KIND: MaterialKind = { badge: 'other', letter: '?', label: '文件' };

export function materialKind(mimeType: string | null, title = ''): MaterialKind {
  const mime = (mimeType ?? '').toLowerCase();

  if (mime === 'text/markdown' || /\.(md|markdown)$/i.test(title)) {
    return { badge: 'md', letter: 'M', label: 'Markdown' };
  }
  if (mime === 'application/pdf' || /\.pdf$/i.test(title)) {
    return { badge: 'pdf', letter: 'P', label: 'PDF' };
  }
  if (mime.startsWith('image/')) {
    return { badge: 'img', letter: 'I', label: '图片' };
  }
  if (mime.startsWith('text/html') || /^https?:/i.test(title)) {
    return { badge: 'url', letter: 'L', label: '网页剪藏' };
  }
  if (mime.startsWith('video/')) return { ...KIND, label: '视频' };
  if (mime.startsWith('audio/')) return { ...KIND, label: '音频' };
  if (mime.startsWith('text/') || mime === 'application/json') {
    return { ...KIND, letter: 'T', label: '文本' };
  }
  return KIND;
}
