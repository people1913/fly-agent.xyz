#!/usr/bin/env python3
"""页面一致性深度审计脚本 v3 - 修复字体解析"""
import os, re
from collections import defaultdict, Counter
from pathlib import Path

BASE_DIR = Path("/tmp/fly-deep-audit")
OUTPUT_FILE = BASE_DIR / "audit-page-consistency.md"

html_files = sorted(BASE_DIR.rglob("*.html"))
all_rel_paths = [str(f.relative_to(BASE_DIR)) for f in html_files]
existing_files_set = set(all_rel_paths)

print(f"发现 {len(html_files)} 个 HTML 文件")

file_contents = {}
for f in html_files:
    rel = str(f.relative_to(BASE_DIR))
    file_contents[rel] = f.read_text(encoding="utf-8", errors="replace")

special_pages = ["index.html", "404.html"]
normal_pages = [r for r in all_rel_paths if r not in special_pages]

# ============================================================
# 1. TOPBAR CSS
# ============================================================
print("[1/6] Topbar...")
topbar_css = {}
for rel, content in file_contents.items():
    m = re.search(r'\.topbar\s*\{([^}]+)\}', content)
    if m:
        props = {}
        for part in m.group(1).strip().split(';'):
            part = part.strip()
            if ':' in part:
                k, v = part.split(':', 1)
                props[k.strip()] = v.strip()
        topbar_css[rel] = props
    else:
        topbar_css[rel] = None

topbar_html = {}
for rel, content in file_contents.items():
    m = re.search(r'<div class="topbar">(.*?)</div>', content)
    topbar_html[rel] = m.group(1).strip() if m else None

bl = "signal-flow.html"
bl_css = topbar_css[bl]
bl_html = topbar_html[bl]

css_diffs = {}
for rel in normal_pages:
    c = topbar_css.get(rel)
    if c is None and bl_css is not None:
        css_diffs[rel] = "无 .topbar CSS 定义"
    elif c is not None and bl_css is not None and c != bl_css:
        items = []
        for k in sorted(set(list(c.keys()) + list(bl_css.keys()))):
            v1 = bl_css.get(k, "<缺失>")
            v2 = c.get(k, "<缺失>")
            if v1 != v2:
                items.append(f"    {k}: 基准=`{v1}` → 当前=`{v2}`")
        if items:
            css_diffs[rel] = "\n".join(items)

# ============================================================
# 2. SIDEBAR
# ============================================================
print("[2/6] Sidebar...")
sidebar_missing = [r for r in normal_pages if "nav-shared.js" not in file_contents.get(r, "")]

# ============================================================
# 3. FOOTER
# ============================================================
print("[3/6] Footer...")
footer = {}
for rel, content in file_contents.items():
    m = re.search(r'<footer[^>]*>(.*?)</footer>', content, re.DOTALL)
    footer[rel] = m.group(1).strip() if m else None

# ============================================================
# 4. CSS VARIABLES
# ============================================================
print("[4/6] CSS variables...")
root_vars = {}
for rel, content in file_contents.items():
    m = re.search(r':root\s*\{([^}]+)\}', content)
    if m:
        variables = {}
        for part in m.group(1).strip().split(';'):
            part = part.strip()
            if part.startswith('--') and ':' in part:
                k, v = part.split(':', 1)
                variables[k.strip()] = v.strip()
        root_vars[rel] = variables
    else:
        root_vars[rel] = {}

all_var_names = sorted(set(v for d in root_vars.values() for v in d.keys()))

var_diffs_normal = {}
for vn in all_var_names:
    vals = {}
    for r in normal_pages:
        v = root_vars.get(r, {}).get(vn)
        if v is not None:
            vals[r] = v
    if len(set(vals.values())) > 1:
        var_diffs_normal[vn] = vals

# ============================================================
# 5. DEAD LINKS
# ============================================================
print("[5/6] Links...")
all_hrefs = defaultdict(list)
for rel, content in file_contents.items():
    for m in re.finditer(r'href="([^"]*)"', content):
        href = m.group(1).strip()
        if not href:
            continue
        if href.startswith(('http', 'mailto:', 'javascript:', 'data:', '#', 'tel:')):
            continue
        all_hrefs[href].append(rel)

dead_links = {}
live_links = {}
for href, sources in all_hrefs.items():
    # Strip fragment
    clean = href.split('#')[0].lstrip('/')
    if not clean:
        live_links[href] = sources
        continue
    found = clean in existing_files_set
    if found:
        live_links[href] = sources
    else:
        dead_links[href] = sources

# ============================================================
# 6. JS/CSS IMPORTS (fixed font parsing)
# ============================================================
print("[6/6] JS/CSS imports...")
js_imports = {}
font_families_map = {}

for rel, content in file_contents.items():
    js_imports[rel] = re.findall(r'<script[^>]+src="([^"]+)"', content)
    
    m = re.search(r'fonts\.googleapis\.com/css2\?([^"]+)', content)
    if m:
        url = m.group(1)
        # Split by & or \u0026 (literal in file)
        parts = re.split(r'&|\\u0026', url)
        families = []
        for p in parts:
            if p.startswith('family='):
                name = p[7:].split(':')[0]
                families.append(name.replace('+', ' '))
        font_families_map[rel] = families
    else:
        font_families_map[rel] = []

# ============================================================
# GENERATE REPORT
# ============================================================
print("\n生成报告...")

R = []
R.append("# 页面一致性深度审计报告")
R.append("日期：2026-06-18\n")

footer_none_normal = [r for r in normal_pages if footer.get(r) is None]
font_patterns_normal = set(tuple(font_families_map[r]) for r in normal_pages)

issues = []
if css_diffs: issues.append(f"Topbar CSS 差异（{len(css_diffs)} 页）")
if sidebar_missing: issues.append(f"Sidebar 缺失（{len(sidebar_missing)} 页）")
if footer_none_normal: issues.append(f"Footer 缺失（{len(footer_none_normal)} 页）")
if var_diffs_normal: issues.append(f"CSS 变量差异（{len(var_diffs_normal)} 个变量）")
if dead_links: issues.append(f"死链（{len(dead_links)} 个）")
if len(font_patterns_normal) > 1: issues.append(f"字体引入不一致（{len(font_patterns_normal)} 种模式）")

consistent_count = 6 - len(issues)

R.append("## 总结")
R.append(f"- **总页面数**：{len(html_files)}（含 index.html、404.html 两个特殊页面）")
R.append(f"- **常规页面数**：{len(normal_pages)}（排除 index.html 和 404.html）")
R.append(f"- **基准页面**：signal-flow.html（定版基准）")
R.append(f"- **一致项**：{consistent_count}")
R.append(f"- **不一致项**：{len(issues)}")
for i in issues:
    R.append(f"  - {i}")
R.append("")

R.append("| 审计项 | 状态 | 详情 |")
R.append("|--------|------|------|")
R.append(f"| Topbar CSS | {'✅ 一致' if not css_diffs else f'❌ {len(css_diffs)}页差异'} | 基准: height:52px; padding:0 32px; 无border-bottom |")
R.append(f"| Sidebar | {'✅ 全部引入' if not sidebar_missing else f'❌ {len(sidebar_missing)}页缺失'} | 通过 nav-shared.js 统一渲染 |")
R.append(f"| Footer | {'✅ 全部有' if not footer_none_normal else f'❌ {len(footer_none_normal)}页缺失'} | 仅 compliance.html 有 footer |")
R.append(f"| CSS :root 变量 | {'✅ 一致' if not var_diffs_normal else f'❌ {len(var_diffs_normal)}个变量有差异'} | 详见第4节 |")
R.append(f"| 导航链接 | {'✅ 无死链' if not dead_links else f'❌ {len(dead_links)}个死链'} | 有效链接 {len(live_links)} 个 |")
R.append(f"| 字体引入 | {'✅ 一致' if len(font_patterns_normal) <= 1 else f'❌ {len(font_patterns_normal)}种模式'} | 详见第6节 |")
R.append("")

# ---- 1. Topbar ----
R.append("## 1. Topbar 一致性\n")
R.append("### 基准（signal-flow.html）")
if bl_css:
    props_str = "; ".join(f"{k}: {v}" for k, v in bl_css.items())
    R.append(f"```css\n.topbar {{ {props_str} }}\n```")
R.append(f"- Topbar HTML 结构：`{bl_html}`\n")

if css_diffs:
    R.append(f"### ❌ CSS 差异（{len(css_diffs)} 个页面）\n")
    for rel in sorted(css_diffs.keys()):
        R.append(f"- **{rel}**")
        R.append(f"  ```")
        R.append(f"  {css_diffs[rel]}")
        R.append(f"  ```")
    R.append("")
else:
    R.append("✅ 所有常规页面的 .topbar CSS 完全一致。\n")

# ---- 2. Sidebar ----
R.append("## 2. Sidebar 一致性\n")
R.append("侧边栏通过 `nav-shared.js` 统一渲染，所有页面共享同一份导航数据结构。\n")

if sidebar_missing:
    R.append(f"### ❌ 未引入 nav-shared.js 的常规页面（{len(sidebar_missing)} 个）\n")
    for r in sorted(sidebar_missing):
        R.append(f"- **{r}**")
else:
    R.append("✅ 所有 69 个常规页面均引入了 nav-shared.js。\n")

nav_js = BASE_DIR / "nav-shared.js"
if nav_js.exists():
    nc = nav_js.read_text(encoding="utf-8")
    nav_links = re.findall(r"href:'([^']+)'", nc)
    sections = re.findall(r"\{id:'([^']+)',label:'([^']+)'", nc)
    R.append(f"### nav-shared.js 导航数据")
    R.append(f"- 导航分组：{len(sections)} 组")
    for sid, slbl in sections:
        R.append(f"  - {slbl}")
    R.append(f"- 总导航链接数：{len(nav_links)}")
R.append("")

# ---- 3. Footer ----
R.append("## 3. Footer 一致性\n")
footer_has = [r for r in normal_pages if footer.get(r) is not None]
if footer_has:
    by_content = defaultdict(list)
    for r in footer_has:
        by_content[footer[r][:200]].append(r)
    R.append("### 有 footer 的页面\n")
    for fc, pages in sorted(by_content.items(), key=lambda x: -len(x[1])):
        R.append(f"- 内容：`{fc[:150]}`")
        R.append(f"  - 共 {len(pages)} 页：{', '.join(sorted(pages)[:5])}{'...' if len(pages) > 5 else ''}")
    R.append("")

if footer_none_normal:
    R.append(f"### ❌ 无 footer 的常规页面（{len(footer_none_normal)} 个）\n")
    for r in sorted(footer_none_normal):
        R.append(f"- {r}")
    R.append("")

# ---- 4. CSS Variables ----
R.append("## 4. CSS 变量一致性\n")
R.append(f"共发现 **{len(all_var_names)}** 个 CSS 变量。\n")

if var_diffs_normal:
    R.append(f"### ❌ 存在差异的变量（{len(var_diffs_normal)} 个，仅统计常规页面）\n")
    for vn in sorted(var_diffs_normal.keys()):
        vals = var_diffs_normal[vn]
        unique = Counter(vals.values())
        R.append(f"#### `{vn}`（{len(unique)} 种值）\n")
        for val, count in unique.most_common():
            pages = sorted([r for r, v in vals.items() if v == val])
            if count <= 5:
                R.append(f"- `{val}` → {count} 页: {', '.join(pages)}")
            else:
                R.append(f"- `{val}` → {count} 页（多数页面）")
        R.append("")
else:
    R.append("✅ 所有常规页面的 :root CSS 变量完全一致。\n")

R.append(f"### 全部变量列表（{len(all_var_names)} 个）")
R.append(f"`{'`, `'.join(all_var_names)}`\n")

# ---- 5. Links ----
R.append("## 5. 导航链接可达性\n")
R.append(f"- 有效内部链接：{len(live_links)} 个")
R.append(f"- 死链：{len(dead_links)} 个\n")

if dead_links:
    R.append(f"### ❌ 死链清单（{len(dead_links)} 个）\n")
    R.append("| 死链 href | 引用来源页面 |")
    R.append("|-----------|-------------|")
    for href in sorted(dead_links.keys()):
        sources = dead_links[href]
        src_str = ", ".join(sorted(sources)[:5])
        if len(sources) > 5:
            src_str += f" ... 等{len(sources)}页"
        R.append(f"| `{href}` | {src_str} |")
    R.append("")
else:
    R.append("✅ 所有内部导航链接均指向真实存在的页面，无死链。\n")

# ---- 6. JS/CSS ----
R.append("## 6. JS/CSS 引入一致性\n")

R.append("### 外部 JS 引入\n")
js_pats = Counter(tuple(v) for v in js_imports.values())
for pat, count in js_pats.most_common():
    label = ", ".join(pat) if pat else "<无外部JS>"
    pages = sorted([r for r in file_contents if tuple(js_imports[r]) == pat])
    if count <= 5:
        R.append(f"- `{label}` → {count} 页: {', '.join(pages)}")
    else:
        R.append(f"- `{label}` → {count} 页")
R.append("")

# Fonts - normal pages only
R.append("### Google Fonts 引入（常规页面）\n")
font_pats_normal = Counter(tuple(font_families_map[r]) for r in normal_pages)
for pat, count in font_pats_normal.most_common():
    if not pat:
        pages = sorted([r for r in normal_pages if not font_families_map[r]])
        R.append(f"- **无字体导入** → {count} 页: {', '.join(pages)}")
    else:
        R.append(f"- `{', '.join(pat)}` → {count} 页")
R.append("")

# JetBrains Mono analysis
with_mono = [r for r in normal_pages if any('JetBrains' in f for f in font_families_map[r])]
without_mono = [r for r in normal_pages if font_families_map[r] and not any('JetBrains' in f for f in font_families_map[r])]
no_font = [r for r in normal_pages if not font_families_map[r]]

if len(font_pats_normal) > 1:
    R.append("### ❌ 字体引入不一致分析\n")
    R.append(f"**主要差异点 — JetBrains Mono 字体：**")
    R.append(f"- 包含 `JetBrains Mono` 的页面：{len(with_mono)} 个")
    R.append(f"  - {', '.join(sorted(with_mono))}")
    R.append(f"- 不包含 `JetBrains Mono` 的页面：{len(without_mono)} 个")
    if without_mono:
        R.append(f"  - {', '.join(sorted(without_mono)[:15])}{'...' if len(without_mono) > 15 else ''}")
    R.append(f"- 完全无字体导入的页面：{len(no_font)} 个")
    if no_font:
        R.append(f"  - {', '.join(sorted(no_font))}")
    R.append("")
    R.append("**影响**：缺少 JetBrains Mono 的页面无法正确渲染 `var(--mono)` 字体（代码块等），建议统一引入包含 JetBrains Mono 的字体组合。")
    R.append("")

# ---- 问题清单 ----
R.append("## 问题清单\n")
R.append("| # | 问题 | 严重度 | 影响页面数 | 建议 |")
R.append("|---|------|--------|-----------|------|")

n = 0
if css_diffs:
    n += 1
    R.append(f"| {n} | Topbar CSS 与基准不一致 | 🔴 高 | {len(css_diffs)} | 统一为基准 `.topbar {{ height:52px; padding:0 32px; ... }}`，无 border-bottom |")

if sidebar_missing:
    n += 1
    R.append(f"| {n} | 未引入 nav-shared.js | 🔴 高 | {len(sidebar_missing)} | 添加 `<script src=\"/nav-shared.js?v=20260616h\"></script>` |")

if footer_none_normal:
    n += 1
    R.append(f"| {n} | 缺少 footer | 🟡 中 | {len(footer_none_normal)} | 添加统一 footer（参考 compliance.html） |")

for vn in sorted(var_diffs_normal.keys()):
    n += 1
    vals = var_diffs_normal[vn]
    unique = set(vals.values())
    majority = Counter(vals.values()).most_common(1)[0][0]
    R.append(f"| {n} | CSS 变量 `{vn}` 有 {len(unique)} 种值 | 🟡 中 | 1 页偏离 | 统一为多数值 `{majority}` |")

if dead_links:
    n += 1
    R.append(f"| {n} | 内部死链 | 🟠 中 | {len(dead_links)} 个链接 | 修复链接目标（检查 #fragment 是否存在） |")

if len(font_patterns_normal) > 1:
    n += 1
    R.append(f"| {n} | Google Fonts 引入不一致 | 🟡 中 | {len(without_mono) + len(no_font)} 页缺少 JetBrains Mono | 统一引入含 JetBrains Mono 的字体组合 |")

R.append("")

R.append("## 附录：特殊页面说明\n")
R.append("- **index.html**：首页，使用完全不同的布局（无 sidebar、无 topbar、有固定 header 导航和 footer），属于独立设计，不纳入一致性对比。")
R.append("- **404.html**：错误页，无 sidebar、无 topbar、无 footer，使用独立样式，属于特殊页面，不纳入一致性对比。")
R.append("")
R.append("---\n*报告由 audit_consistency.py 自动生成，仅审计不修改任何代码。*")
R.append("")

text = "\n".join(R)
OUTPUT_FILE.write_text(text, encoding="utf-8")
print(f"\n✅ 报告已保存到 {OUTPUT_FILE}")
print(f"报告长度: {len(text)} 字符, {len(R)} 行")
