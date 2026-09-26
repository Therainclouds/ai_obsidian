# -*- coding: utf-8 -*-
"""按「配色黄金律」由主色色相生成整套 token，输出 _tokens.css

律1 面积   中性面 60% / 文字与结构 30% / 主色 + 点缀 10%
律2 中性面 与主色同色相 H，彩度 C<=0.014，只动明度 L
律3 点缀色 主色 H + 137.5deg（黄金角）
"""
import math

GOLD = 137.5

def s2l(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def l2s(c):
    c = max(0.0, min(1.0, c))
    return c*12.92 if c <= 0.0031308 else 1.055*(c**(1/2.4))-0.055

def oklch2rgb(L, C, H):
    a, b = C*math.cos(math.radians(H)), C*math.sin(math.radians(H))
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    return (4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
            -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
            -0.0041960863*l - 0.7034186147*m + 1.7076147010*s)

def in_gamut(rgb, eps=1e-4):
    return all(-eps <= v <= 1+eps for v in rgb)

def oklch2hex(L, C, H):
    """超出 sRGB 色域时二分压彩度，保证输出一定落在色域内。"""
    lo, hi = 0.0, C
    for _ in range(32):
        mid = (lo+hi)/2
        if in_gamut(oklch2rgb(L, mid, H)): lo = mid
        else: hi = mid
    rgb = oklch2rgb(L, lo, H)
    return '#%02X%02X%02X' % tuple(round(l2s(v)*255) for v in rgb)

def rel_lum(hx):
    h = hx.lstrip('#')
    c = [s2l(int(h[i:i+2], 16)/255) for i in (0, 2, 4)]
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi+0.05)/(lo+0.05)

# ============================================================
# 品牌：色相 H（由 v0.4 实测值取整）+ 命名
# ============================================================
BRANDS = {
    'indigo': ('靛 Indigo', 271.3),
    'steel':  ('钢 Steel',  236.5),
    'claret': ('绛 Claret',   8.7),
}
FIXED = {  # 默认（靛）由上方通用函数生成，无需特例
}

# 明度/彩度骨架 —— 只这一份，三套色相共用
LIGHT = {
    'bg':        (.9580, .0090),
    'surface':   (1.0000, .0000),
    'surface-2': (.9770, .0070),
    'surface-3': (.9360, .0110),
    'line':      (.8980, .0130),
    'line-soft': (.9320, .0090),
    'ink':       (.2120, .0180),
    'ink-2':     (.4870, .0220),
    'ink-3':     (.5600, .0180),
    'brand':     (.4750, .1810),
    'brand-deep':(.4050, .1600),
    'brand-soft':(.9340, .0320),
    'brand-ink': (.4150, .1600),
    'brand-mid': (.7950, .0700),
    'accent':    (.5590, .1390),
    'accent-soft':(.9450, .0320),
    'accent-ink':(.4700, .1450),
    'accent-mid':(.7500, .0850),
    'node-2':    (.7800, .0720),
    'node-4':    (.8350, .0060),
    'orb-core':  (.5450, .1650),
    'orb-edge':  (.3050, .1050),
    'orb-light': (.7600, .1050),
}
DARK = {
    'bg':        (.1680, .0140),
    'surface':   (.2120, .0140),
    'surface-2': (.2430, .0140),
    'surface-3': (.2820, .0150),
    'line':      (.3080, .0140),
    'line-soft': (.2620, .0130),
    'ink':       (.9380, .0080),
    'ink-2':     (.6980, .0140),
    'ink-3':     (.6150, .0140),
    'brand':     (.7230, .1280),
    'brand-deep':(.7950, .1050),
    'brand-soft':(.2580, .0480),
    'brand-ink': (.8200, .1000),
    'brand-mid': (.4450, .0900),
    'accent':    (.7240, .1270),
    'accent-soft':(.2650, .0450),
    'accent-ink':(.8200, .0950),
    'accent-mid':(.4400, .0700),
    'node-2':    (.4700, .0850),
    'node-4':    (.4200, .0100),
    'orb-core':  (.6200, .1450),
    'orb-edge':  (.3000, .0900),
    'orb-light': (.8300, .0700),
}
ON_BRAND = {'light': '#FFFFFF', 'dark': None}  # dark 稍后按 brand 明度算

def build(name, base_h, scale, mode):
    """accent 用黄金角；中性面与主色同色相。"""
    out, meta = {}, {}
    for key, (L, C) in scale.items():
        if key.startswith('accent'):
            out[key] = oklch2hex(L, C, (base_h + GOLD) % 360)
        else:
            out[key] = oklch2hex(L, C, base_h)
    out['node-1'] = out['brand']
    out['node-3'] = out['accent']
    # 影子：同色相的近黑
    sh = oklch2rgb(0.1900, 0.0200, base_h)
    rs, gs, bs = (l2s(v) for v in sh)
    out['_shadow_rgb'] = '%d,%d,%d' % (round(rs*255), round(gs*255), round(bs*255))
    out['on-brand'] = ON_BRAND[mode]
    out['_mode'] = mode
    return out

def emit(v, indent='  '):
    keys = ['bg', 'surface', 'surface-2', 'surface-3', 'ink', 'ink-2', 'ink-3',
            'line', 'line-soft', 'brand', 'brand-deep', 'brand-soft', 'brand-ink',
            'brand-mid', 'on-brand', 'accent', 'accent-soft', 'accent-ink', 'accent-mid',
            'node-1', 'node-2', 'node-3', 'node-4', 'orb-core', 'orb-edge', 'orb-light']
    lines, buf = [], []
    for k in keys:
        buf.append('--%s:%s;' % (k, v[k]))
        if len(buf) == 3:
            lines.append(indent + ' '.join(buf)); buf = []
    if buf: lines.append(indent + ' '.join(buf))
    if v.get('_mode') == 'dark':
        lines.append(indent + '--shadow-1:0 1px 3px rgba(0,0,0,.42);')
        lines.append(indent + '--shadow-2:0 10px 30px -12px rgba(0,0,0,.62);')
        lines.append(indent + '--shadow-3:0 24px 64px -20px rgba(0,0,0,.74);')
    else:
        lines.append(indent + '--shadow-1:0 1px 3px rgba(%s,.07);' % v['_shadow_rgb'])
        lines.append(indent + '--shadow-2:0 10px 30px -12px rgba(%s,.20);' % v['_shadow_rgb'])
        lines.append(indent + '--shadow-3:0 24px 64px -20px rgba(%s,.28);' % v['_shadow_rgb'])
    return '\n'.join(lines)

css = []
css.append('/* ============================================================\n'
           '   配色黄金律 —— 所有色值由「主色色相」算出来，不手工挑色\n'
           '   律1 面积：中性面 60% / 文字与结构 30% / 主色 + 点缀 10%\n'
           '   律2 中性面：与主色同色相 H，彩度 C≤0.014，只动明度 L\n'
           '   律3 点缀色：主色 H + 137.5°（黄金角）\n'
           '   换主色 = 换一个色相种子，整站随之重算\n'
           '   ============================================================ */')

plain = {}
for key, (label, h) in BRANDS.items():
    for mode, scale in (('light', LIGHT), ('dark', DARK)):
        v = build(key, h, scale, mode)
        plain[(key, mode)] = v

for key in ['indigo', 'steel', 'claret']:
    for mode in ['light', 'dark']:
        v = plain[(key, mode)]
        if v['on-brand'] is None:
            v['on-brand'] = oklch2hex(0.2000, 0.0300, BRANDS[key][1])
        sel = ':root' if key == 'indigo' and mode == 'light' else \
              ':root[data-theme="dark"]' if key == 'indigo' else \
              ':root[data-brand="%s"]' % key if mode == 'light' else \
              ':root[data-theme="dark"][data-brand="%s"]' % key
        head = '%s{ /* %s · %s */' % (sel, BRANDS[key][0],
                                      '白天' if mode == 'light' else '黑夜')
        css.append(head + '\n  color-scheme:%s;\n%s\n}' % (mode, emit(v)))

# --- 点缀色备选：锁定陶色（保留 v0.4 的原始实测色相） ---
TERRA_L, TERRA_D = 46.3, 57.6
for mode, h, sel in (('light', TERRA_L, ':root[data-accent="terra"]'),
                     ('dark', TERRA_D, ':root[data-theme="dark"][data-accent="terra"]')):
    scale = LIGHT if mode == 'light' else DARK
    line = []
    for k in ('accent', 'accent-soft', 'accent-ink', 'accent-mid'):
        L, C = scale[k]
        line.append('--%s:%s;' % (k, oklch2hex(L, C, h)))
    css.append('%s{\n  %s\n}' % (sel, ' '.join(line)))

open('_tokens.css', 'w', encoding='utf-8').write('\n'.join(css) + '\n')

# ============================================================
# 报告
# ============================================================
print('== 三套主色的派生结果 ==')
print()
for key, (label, h) in BRANDS.items():
    l, d = plain[(key, 'light')], plain[(key, 'dark')]
    print(f'【{label}】主色相 H={h}°   →  点缀色相 H={(h+GOLD)%360:.1f}°')
    print(f'   白天  底 {l["bg"]}  卡 {l["surface"]}  墨 {l["ink"]}  主 {l["brand"]}  缀 {l["accent"]}')
    print(f'   黑夜  底 {d["bg"]}  卡 {d["surface"]}  墨 {d["ink"]}  主 {d["brand"]}  缀 {d["accent"]}')
    print()

print('== 对比度校验（WCAG，正文需 ≥4.5，UI 元素需 ≥3.0）==')
print()
worst = []
for key, (label, h) in BRANDS.items():
    for mode in ('light', 'dark'):
        v = plain[(key, mode)]
        checks = [
            ('墨 on 底',        v['ink'], v['bg'], 4.5),
            ('墨 on 卡',        v['ink'], v['surface'], 4.5),
            ('次级墨 on 卡',    v['ink-2'], v['surface'], 4.5),
            ('三级墨 on 卡',    v['ink-3'], v['surface'], 4.5),
            ('主色 on 卡',      v['brand'], v['surface'], 3.0),
            ('卡片字 on 主色',  v['on-brand'], v['brand'], 4.5),
            ('主色字 on 主色底',v['brand-ink'], v['brand-soft'], 4.5),
            ('缀色 on 卡',      v['accent'], v['surface'], 3.0),
            ('缀色字 on 缀色底',v['accent-ink'], v['accent-soft'], 4.5),
        ]
        bad = [(n, round(contrast(a, b), 2), m) for n, a, b, m in checks if contrast(a, b) < m]
        tag = 'OK' if not bad else 'FAIL'
        print(f'{label} / {"白天" if mode=="light" else "黑夜"}  {tag}')
        for n, r, m in bad:
            print(f'    <<< {n}: {r} < {m}')
            worst.append((label, mode, n, r, m))
print()
print('总计不达标项:', len(worst))
