#!/usr/bin/env python3
"""原型自检：标签平衡 / CSS 大括号 / var 引用 / 重复 id / 内联脚本语法。

用法：  python design/prototype/_check.py [index-final.html]
退出码 0 = 全过，1 = 有错误。项目约定：原型每次改动后必须跑一次。
"""
import html.parser
import os
import pathlib
import re
import subprocess
import sys
import tempfile

NODE_CANDIDATES = [
    r"C:\Users\DELL\.workbuddy\binaries\node\versions\22.22.2-3\node.exe",
    r"C:\Program Files\nodejs\node.exe",
]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


def find_node():
    for c in NODE_CANDIDATES:
        if os.path.exists(c):
            return c
    return None


class TagBalance(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.bad = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.bad.append(f"多余闭合 </{tag}> @ 行{self.getpos()[0]}")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        names = [t for t, _ in self.stack]
        if tag in names:
            while self.stack and self.stack[-1][0] != tag:
                t, pos = self.stack.pop()
                self.bad.append(f"<{t}> 未闭合（开于 行{pos[0]}）")
            self.stack.pop()
        else:
            self.bad.append(f"孤立闭合 </{tag}> @ 行{self.getpos()[0]}")


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else str(
        pathlib.Path(__file__).with_name("index-final.html"))
    src = pathlib.Path(target).read_text(encoding="utf-8")
    errs, notes = [], []

    # 1 · CSS 大括号配平 + var 引用闭环
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", src, re.S))
    if css.count("{") != css.count("}"):
        errs.append(f"CSS 大括号不配平：{{ = {css.count('{')}，}} = {css.count('}')}")
    defined = set(re.findall(r"(--[a-z0-9-]+)\s*:", css))
    defined |= set(re.findall(r"setProperty\(\s*['\"](--[a-z0-9-]+)", src))
    used = set(re.findall(r"var\((--[a-z0-9-]+)", src))
    used |= set(re.findall(r"setProperty\(\s*['\"](--[a-z0-9-]+)", src))
    for m in sorted(used - defined):
        errs.append(f"var 未定义：{m}")

    # 2 · 重复 id
    ids = re.findall(r'\sid="([^"]+)"', src)
    for d in sorted({i for i in ids if ids.count(i) > 1}):
        errs.append(f"重复 id：{d}")

    # 3 · 标签平衡
    tb = TagBalance()
    tb.feed(src)
    errs += tb.bad
    for t, pos in tb.stack:
        errs.append(f"<{t}> 未闭合（开于 行{pos[0]}）")

    # 4 · 内联脚本语法
    node = find_node()
    scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", src, re.S)
    if node:
        for i, s in enumerate(scripts, 1):
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                             encoding="utf-8") as f:
                f.write(s)
                tmp = f.name
            r = subprocess.run([node, "--check", tmp], capture_output=True, text=True)
            if r.returncode:
                errs.append(f"内联脚本 #{i} 语法错误：{r.stderr.strip().splitlines()[-1][:200]}")
            os.unlink(tmp)
        notes.append(f"内联脚本 {len(scripts)} 段已用 node --check 校验")
    else:
        notes.append("未找到 node，跳过脚本语法校验")

    notes.append(f"CSS 变量 定义 {len(defined)} / 引用 {len(used)}")
    notes.append(f"元素 id {len(ids)} 个，标签栈残留 {len(tb.stack)}")

    print(f"检查目标：{target}")
    for n in notes:
        print(f"  · {n}")
    if errs:
        print(f"\n发现 {len(errs)} 个问题：")
        for e in errs:
            print(f"  ✗ {e}")
        return 1
    print("\n全部通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
