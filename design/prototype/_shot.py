#!/usr/bin/env python3
"""原型实机截图：无头浏览器渲染 index-final.html 的若干状态。

用法：  python design/prototype/_shot.py [状态名 ...]
不带参数则截全部预设状态，输出到 design/prototype/shots/。

三个已知坑（都踩过）：
  1. --screenshot 必须给绝对路径，相对路径会被 headless 忽略
  2. 页面有淡入/位移动画时，截图会停在首帧 → 必须注入 animation:none!important
  3. 只禁 animation / transition，**不能碰 opacity**：
     .page 的显隐就是靠 opacity:0，强加 opacity:1 会让所有页面同时可见
"""
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "index-final.html"
OUT = HERE / "shots"

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]

DISABLE_ANIM = (
    "<style id='_shot_kill'>*,*::before,*::after{animation:none!important;"
    "transition:none!important}</style>"
)

SETTINGS = ('document.querySelector(\'.nav-item[data-page="settings"]\').click();')
FILES = 'document.querySelector(\'.nav-item[data-page="files"]\').click();'
GRAPH = 'document.querySelector(\'.nav-item[data-page="graph"]\').click();'
SUMMARY = 'document.querySelector(\'.nav-item[data-page="summary"]\').click();'

# 状态 → 注入脚本 / 视口 / 主题 / URL hash
# （hash 驱动三态与视图：#unreachable #empty #filtered #know #loading #error）
STATES = {
    # —— 基础页面 ——
    "sidebar":            dict(script="", size=(1440, 900), theme="light"),
    "sidebar-dark":       dict(script="", size=(1440, 900), theme="dark"),
    "sidebar-menu":       dict(script="document.getElementById('spaceSwitch').click();",
                               size=(1440, 900), theme="light"),
    "settings-spaces":    dict(script=SETTINGS + 'document.querySelector(\'.s-nav-item[data-view="spaces"]\').click();',
                               size=(1440, 900), theme="light"),
    "settings-skills":    dict(script=SETTINGS + 'document.querySelector(\'.s-nav-item[data-view="skills"]\').click();',
                               size=(1440, 900), theme="light"),
    "settings-spaces-dark": dict(script=SETTINGS + 'document.querySelector(\'.s-nav-item[data-view="spaces"]\').click();',
                                 size=(1440, 900), theme="dark"),
    "sidebar-collapsed":  dict(script="", size=(980, 820), theme="light"),

    # —— 三态 v1.1 ——
    "state-thinking":     dict(script=FILES + 'document.querySelector(\'.nav-item[data-page="chat"]\').click();'
                                          'document.querySelectorAll(".suggest")[0].click();',
                               size=(1440, 900), theme="light", budget=1100),
    "state-unreachable":  dict(script='document.querySelector(\'.nav-item[data-page="chat"]\').click();',
                               size=(1440, 900), theme="light", hash="unreachable"),
    "state-empty-files":  dict(script=FILES, size=(1440, 900), theme="light", hash="empty"),
    "state-empty-graph":  dict(script=GRAPH, size=(1440, 900), theme="light", hash="empty"),
    "state-empty-dark":   dict(script=FILES, size=(1440, 900), theme="dark", hash="empty"),
    "state-filtered":     dict(script=FILES, size=(1440, 900), theme="light", hash="filtered"),
    "state-know":         dict(script=FILES, size=(1440, 900), theme="light", hash="know"),
    "state-know-dark":    dict(script=FILES, size=(1440, 900), theme="dark", hash="know"),
    "state-loading":      dict(script=FILES, size=(1440, 900), theme="light", hash="loading"),
    "state-error":        dict(script=SUMMARY, size=(1440, 900), theme="light", hash="error"),
    "state-new-space":    dict(script=SETTINGS + 'document.querySelector(\'.s-nav-item[data-view="spaces"]\').click();'
                                                'document.getElementById("newSpaceBtn").click();',
                               size=(1440, 900), theme="light"),
}


def build(state):
    cfg = STATES[state]
    src = SRC.read_text(encoding="utf-8")
    injection = DISABLE_ANIM
    body = f"document.documentElement.dataset.theme='{cfg['theme']}';" + cfg["script"]
    injection += f"<script>window.addEventListener('load',()=>{{{body}}});</script>"
    out = src.replace("</body>", injection + "</body>")
    tmp = HERE / f"_shot_{state}.html"
    tmp.write_text(out, encoding="utf-8")
    url = tmp.as_uri() + ("#" + cfg["hash"] if cfg.get("hash") else "")
    return tmp, url


def main():
    names = sys.argv[1:] or list(STATES)
    browser = next((b for b in BROWSERS if pathlib.Path(b).exists()), None)
    if not browser:
        print("找不到 Edge / Chrome")
        return 1
    OUT.mkdir(exist_ok=True)
    for n in names:
        if n not in STATES:
            print(f"跳过未知状态：{n}")
            continue
        cfg = STATES[n]
        html, url = build(n)
        png = (OUT / f"{n}.png").resolve()
        w, h = cfg["size"]
        r = subprocess.run([
            browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--force-device-scale-factor=1",
            f"--virtual-time-budget={cfg.get('budget', 1500)}",
            f"--window-size={w},{h}", f"--screenshot={png}", url,
        ], capture_output=True, text=True)
        ok = png.exists() and png.stat().st_size > 5000
        print(f"{'✓' if ok else '✗'} {n} → {png.name}"
              f"{'' if ok else '  ' + (r.stderr or '')[-200:]}")
        html.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
