# Governance · 落地页首页

## 治理规则
- 首页为纯展示页，无左侧导航
- "溯源Fly"按钮跳转 `/signal-flow.html`（有左侧导航的子页面）
- 子页面共享 `nav-shared.js`（v21，5分组导航）

## 架构
```
首页 index.html（Hero展示，无侧栏）
  └─ 溯源Fly → /signal-flow.html（有侧栏+Footer）
  └─ Footer链接 → /terms.html, /privacy.html, /refund.html, /compliance.html
```

## 修改约束
- 首页架构不变：Hero居中 + 右上角CTA + Footer
- 配色：黑蓝白（#0F172A/#2563EB/#60A5FA），白底
- Hero文案层级：灰字sub → 大字黑标题 → 中字蓝说明

## 状态
**FROZEN**
