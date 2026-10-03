/**
 * 应用截图（`electron . --shots [--mock]`）。
 *
 * **与 `design/prototype/_shot.py` 是两件事，所以存两处**：
 *  · `design/prototype/shots/` —— **基准**。原型长这样，它定义"应该是什么样"
 *  · `design/app-shots/`       —— **实现**。我们的应用现在长这样，用来和基准比
 *
 * 混在一起会让"基准"这个词失效：改实现时不小心覆盖了基准，就再也没法比了。
 *
 * 截之前注入 `animation: none` —— 页面有淡入与错峰入场，不等它们跑完会拍到半透明的中间态。
 * **只禁 animation / transition，不碰 opacity**：`.page` 的显隐正是靠 `opacity:0`，
 * 强加 `opacity:1` 会让五个页面同时可见（原型截图脚本踩过这个坑，见 `_shot.py`）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';

const FREEZE = `
  (() => {
    /* 锁定亮色：应用默认跟随系统偏好，而这台机器是暗色 —— 不锁的话，
       我们拍的实现与无头浏览器拍的原型（默认亮色）根本没法比。
       两套截图要能叠在一起看，前提是同一个主题。 */
    document.documentElement.setAttribute('data-theme', 'light');
    try { localStorage.setItem('theme', 'light'); } catch (e) {}

    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.appendChild(s);
  })();
`;

/** 一个要拍的目标：先切 hash，再（可选）点一个标签按钮 */
interface Shot {
  label: string;
  hash: string;
  /** 要点的按钮文案。列表/关联图这种页内 tab 没有独立的 hash，只能点 */
  click?: string;
}

/** 等页面把数据取回来再拍。夹具是本地的，很快；这里只是给 IPC 往返留余量 */
const SETTLE_MS = 900;

/**
 * `suffix` 用来把两套截图分开存：带夹具的（空后缀）与**空态**的（`-empty`）。
 *
 * 为什么必须分开：空态**是另一套界面**，而"夹具下跑得通"证明不了它 ——
 * 这正是本期踩过的坑（四个 bug 里没有一个会被自检抓到）。固定文件名会让后跑的那次
 * 覆盖前一次，于是"两套都看过"变成"看过最后跑的那套"。
 */
export async function takeShots(
  win: BrowserWindow,
  outDir: string,
  shots: Shot[],
  suffix = '',
): Promise<string[]> {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];

  await win.webContents.executeJavaScript(FREEZE);

  for (const shot of shots) {
    await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(shot.hash)}`);
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    if (shot.click) {
      // 按文案找按钮。找不到就**报出来**，不要安静地拍一张错的 ——
      // 那样的截图比没有截图更糟，它会让人以为那个视图没问题
      const hit = await win.webContents.executeJavaScript(`
        (() => {
          const want = ${JSON.stringify(shot.click)};
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === want);
          if (!btn) return false;
          btn.click();
          return true;
        })()
      `);
      if (!hit) console.log(`[shots] ⚠ 没找到按钮「${shot.click}」，${shot.label} 拍的可能是别的视图`);
      await new Promise((r) => setTimeout(r, SETTLE_MS));
    }

    const image = await win.webContents.capturePage();
    const file = join(outDir, `${shot.label}${suffix}.png`);
    writeFileSync(file, image.toPNG());
    written.push(file);
    console.log(`[shots] ${shot.label}${suffix} → ${file}`);
  }

  return written;
}

/**
 * 要拍的页与页内视图。`label` 就是文件名。
 *
 * ⚠ **顺序有讲究**：页内状态（选了哪个胶囊、列表还是关联图）**在切换 hash 时保留**，
 * 所以后一张会继承前一张的选择。`files-know` 必须排在 `files-graph` 之前 ——
 * 否则它会停在关联图上，拍出来的是"知识点胶囊 + 关联图"，看不到知识点的列表。
 */
export const SHOT_LIST: Shot[] = [
  { label: 'chat', hash: 'chat' },
  { label: 'files-list', hash: 'files' },
  { label: 'files-know', hash: 'files', click: '知识点' },
  { label: 'files-graph', hash: 'files', click: '关联图' },
  { label: 'graph', hash: 'graph' },
  { label: 'summary', hash: 'summary' },
  { label: 'settings', hash: 'settings' },
];
