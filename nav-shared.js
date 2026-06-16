/**
 * Fly 官网共享侧边栏 v26 · 5层架构：Identity/Trust/Verification/Attribution/Governance
 * 页面隔离架构：DocsPanel / ChatPanel 完全分离，不共享DOM/state
 * 5组：Identity（身份层）/ Trust（信任层）/ Verification（验证层）/ Attribution（归因层）/ Governance（治理层）
 * 默认展开：Identity / Trust；其余收起
 * AI Platforms统一路径：/ai-platforms/xxx.html
 */
(function(){
var sections=[
// ── 1. Identity（身份层）深绿 #1A3D2E ── Agent身份/注册/平台接入
{id:'identity',label:'Identity 身份层',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
links:[

{href:'/concept-behavior-id.html',text:'Behavior ID 行为ID',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-7.7-1.4 1.4M6.7 19.3l-1.4 1.4m0-15.4 1.4 1.4m10.6 12.6 1.4 1.4"/></svg>'},
{href:'/concept-action-id.html',text:'Action ID 动作ID',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>'},
{href:'/concept-verification.html',text:'Verification 验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/concept-trust.html',text:'Trust 信任',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'},
{href:'/concept-business-value.html',text:'Business Value 商业价值',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22m-4-4l4 4 4-4"/><path d="M5 12h14"/></svg>'},
{href:'/faq.html',text:'常见问题',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'},
{href:'/agent-registry.html',text:'Agent Registry 注册中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-7.7-1.4 1.4M6.7 19.3l-1.4 1.4m0-15.4 1.4 1.4m10.6 12.6 1.4 1.4"/></svg>'},
{href:'/bot.html',text:'Agent Identity 身份',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'},
{href:'/ai-skills.html',text:'Agent Trust 信任',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'},
{href:'/sdk.html',text:'Agent Revenue 收益',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'},
{href:'/ai-platforms/chatgpt.html',text:'ChatGPT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'},
{href:'/ai-platforms/claude.html',text:'Claude',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'},
{href:'/ai-platforms/gemini.html',text:'Gemini',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
{href:'/ai-platforms/coze.html',text:'Coze',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'},
{href:'/ai-platforms/dify.html',text:'Dify',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'},
{href:'/ai-platforms/fastgpt.html',text:'FastGPT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'},
{href:'/ai-platforms/perplexity.html',text:'Perplexity',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'},
{href:'/ai-platforms/wechat-agent.html',text:'微信Agent',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'},
{href:'/ai-platforms/red-skill.html',text:'红色技能',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'}
]},
// ── 2. Trust（信任层）绿色 #059669 ── Gate 1-6
{id:'trust',label:'Trust 信任层',color:'#059669',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
links:[
{href:'/verification-layer.html',text:'Gate 1 数据完整性验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/audit.html',text:'Gate 2 安全策略验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
{href:'/trust.html',text:'Gate 3 归因链验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'},
{href:'/dashboard.html',text:'Gate 4 部署验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'},
{href:'/gateway.html',text:'Gate 5 构建验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'},
{href:'/security.html',text:'Gate 6 健康验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'}
]},
// ── 3. Verification（验证层）琥珀 #D97706 ── 信号流/验证中心
{id:'verification',label:'Verification 验证层',color:'#D97706',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>',
links:[
{href:'/signal-flow.html',text:'Signal Flow 信号流',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'},
{href:'/verification-center.html',text:'验证中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
]},
// ── 4. Attribution（归因层）靛蓝 #6366F1 ── 企业/开发者/渠道/Web3
{id:'attribution',label:'Attribution 归因层',color:'#6366F1',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22m-4-4l4 4 4-4"/><path d="M5 12h14"/></svg>',
links:[
{href:'/enterprise.html',text:'企业控制台',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'},
{href:'/enterprise-revenue-attribution.html',text:'收入归因引擎',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'},
{href:'/enterprise-roi.html',text:'ROI 测量',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'},
{href:'/api-reference.html',text:'API Reference API参考',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
{href:'/action-id.html',text:'Action ID 归因',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>'},
{href:'/dev-webhook.html',text:'Webhook',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'},
{href:'/dev-schema.html',text:'Schema Definition 结构定义',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
{href:'/dev-openapi.html',text:'OpenAPI',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'},
{href:'/channel-partner.html',text:'合作伙伴',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'},
{href:'/channel-integration.html',text:'集成市场',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'},
{href:'/channel-affiliate.html',text:'分销系统',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'},
{href:'/channel-distribution.html',text:'渠道网络',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'},
{href:'/web3/base.html',text:'Web3 Base 基础',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'},
{href:'/web3/ethereum.html',text:'Ethereum',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'},
{href:'/web3/solana.html',text:'Solana',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'},
{href:'/web3/wallet.html',text:'Wallet',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 10H18a2 2 0 0 0 0 4h4"/></svg>'},
{href:'/web3/tx-verification.html',text:'TX Verification 交易验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
]},
// ── 5. Governance（治理层）灰色 #64748B ── 合规/审计/隐私
{id:'governance',label:'Governance 治理层',color:'#64748B',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
links:[
{href:'/compliance.html',text:'合规中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
{href:'/compliance-audit-trail.html',text:'审计追踪',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
{href:'/compliance-data-governance.html',text:'数据治理',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'},
{href:'/privacy.html',text:'隐私控制',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'},
{href:'/terms.html',text:'服务条款',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'},
{href:'/refund.html',text:'退款政策',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'}
]}
];

/* ── 渲染 ── */
var collapsed=localStorage.getItem('fly_nav_collapsed')==='1';
var topBar=document.createElement('div');topBar.className='nav-top'+(collapsed?' collapsed':'');
var h='';
h+='<div class="nav-top-left">';
h+='<a href="/" class="nav-logo-text">Fly</a>';
h+='<button class="nav-collapse-btn" onclick="FlyNav.toggle()">';
h+='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
h+='</button></div>';
h+='<div class="nav-top-right"></div>';
topBar.innerHTML=h;
var nav=document.createElement('nav');nav.className='nav'+(collapsed?' collapsed':'');nav.setAttribute('aria-label','文档导航');
var nb='';
nb+='<div class="nav-body">';

sections.forEach(function(sec){
  var op=sec.defaultOpen?'open':'';
  var arrowOpen=sec.defaultOpen?' arrow-open':'';
  nb+='<div class="nav-sec" data-sec-id="'+sec.id+'">';
  nb+='<a class="nav-link'+arrowOpen+'" data-group="'+sec.id+'" style="color:'+sec.color+'" href="javascript:void(0)">'+sec.icon+'<span>'+sec.label+'</span><span class="nav-arrow">›</span></a>';
  nb+='<div class="nav-sec-bd '+op+'">';
  sec.links.forEach(function(l){
    nb+='<a class="nav-link" data-group="'+sec.id+'" href="'+l.href+'" title="'+l.text+'">'+l.icon+'<span>'+l.text+'</span></a>';
  });
  nb+='</div></div>';
});
nb+='</div>';
nav.innerHTML=nb;
document.body.insertBefore(nav,document.body.firstChild);
document.body.insertBefore(topBar,document.body.firstChild);

window.FlyNav={
  toggle:function(){
    var n=document.querySelector('.nav'),t=document.querySelector('.nav-top');
    if(n)n.classList.toggle('collapsed');if(t)t.classList.toggle('collapsed');
    localStorage.setItem('fly_nav_collapsed',document.querySelector('.nav.collapsed')?'1':'0');
  }
};

/* ── 交互 ── */
nav.querySelectorAll('.nav-sec > .nav-link').forEach(function(el){
  el.addEventListener('click',function(e){
    e.preventDefault();
    var bd=this.nextElementSibling;
    bd.classList.toggle('open');
    this.classList.toggle('arrow-open');
  });
});

/* 当前页高亮 */
var path=location.pathname.replace(/\/$/,'')||'/';
nav.querySelectorAll('.nav-sec-bd .nav-link').forEach(function(a){
  var hp=a.getAttribute('href').replace(/\/$/,'')||'/';
  if(hp===path){
    a.classList.add('active');
    var bd=a.closest('.nav-sec-bd');if(bd)bd.classList.add('open');
    var sec=a.closest('.nav-sec');if(sec){var hdr=sec.querySelector(':scope>.nav-link');if(hdr)hdr.classList.add('arrow-open');}
  }
});

/* 样式注入 */
var cs=document.createElement('style');cs.textContent='\
:root{--dark:#0F172A;--text2:#1E293B;--text3:#475569;--text4:#94A3B8;--border:#e2e8f0;--blue:#2563EB}\
body{display:flex;flex-wrap:wrap}\
.nav-top{width:100%;flex-shrink:0;display:flex!important;align-items:center!important;height:48px!important;border-bottom:1px solid var(--border)}\
.nav-top-left{width:220px;flex-shrink:0;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0 16px;border-right:1px solid var(--border);height:48px!important}\
.nav-top-right{flex:1;padding:0 32px}\
.nav{width:220px;flex-shrink:0;background:#fff;border-right:1px solid var(--border);overflow-y:auto;padding:0 0 24px;font-size:13px;display:flex;flex-direction:column;gap:0}\
.nav.collapsed{width:80px;min-width:80px}\
.nav-top.collapsed .nav-top-left{width:80px!important;padding:0!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:5px!important;height:48px!important}\
.nav-body{flex:1;overflow-y:auto}\
.nav-logo{width:34px;height:34px;border-radius:10px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0}\
.nav-logo-text{font-size:14px;text-decoration:none;cursor:pointer;font-weight:700;color:var(--dark);white-space:nowrap;height:48px;display:inline-flex;align-items:center;justify-content:center}\
.nav.collapsed .nav-logo-text{font-size:12px}\
.nav.collapsed .nav-link span:not(.nav-arrow){display:none}\
.nav.collapsed .nav-arrow{margin:0}\
.nav-collapse-btn{width:32px!important;height:32px!important;border-radius:8px;border:none;background:transparent;cursor:pointer;display:flex!important;align-items:center!important;justify-content:center!important;color:#64748B;transition:all .15s;flex-shrink:0;padding:0!important}\
.nav-collapse-btn:hover{background:#f1f5f9;color:#0F172A}\
.nav-link{position:relative;display:flex;align-items:center;gap:8px;padding:6px 16px;color:var(--text2);text-decoration:none;transition:background .15s,color .15s;line-height:1.4;font-weight:500}\
.nav-link[data-group=identity]:hover{color:#1A3D2E;background:rgba(26,61,46,.06)}\
.nav-link[data-group=trust]:hover{color:#059669;background:rgba(5,150,105,.06)}\
.nav-link[data-group=verification]:hover{color:#D97706;background:rgba(217,119,6,.06)}\
.nav-link[data-group=attribution]:hover{color:#6366F1;background:rgba(99,102,241,.06)}\
.nav-link[data-group=governance]:hover{color:#64748B;background:rgba(100,116,139,.06)}\
.nav-link.active{font-weight:600}\
.nav-link.active::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:3px;border-radius:0 2px 2px 0}\
.nav-link svg{flex-shrink:0;opacity:.55;transition:opacity .15s;width:16px;height:16px}\
.nav-link:hover svg{opacity:.9}\
.nav-link.active svg{opacity:1}\
.nav-link span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.nav-arrow{margin-left:auto;font-size:12px;color:#94A3B8;transition:transform .2s;display:inline-block}\
.nav-link.arrow-open .nav-arrow{transform:rotate(90deg)}\
.nav-sec{border-top:1px solid var(--border);margin-top:6px;padding-top:2px}\
.nav-sec:first-of-type{border-top:none!important;margin-top:0!important;padding-top:0!important}\
.nav-sec-bd{overflow:hidden;max-height:0;transition:max-height .25s ease}\
.nav-sec-bd.open{max-height:1200px}\
.nav-link.active[data-group=identity]{color:#1A3D2E}.nav-link.active[data-group=identity]::before{background:#1A3D2E}.nav-link.active[data-group=identity] svg{color:#1A3D2E}\
.nav-link.active[data-group=trust]{color:#059669}.nav-link.active[data-group=trust]::before{background:#059669}.nav-link.active[data-group=trust] svg{color:#059669}\
.nav-link.active[data-group=verification]{color:#D97706}.nav-link.active[data-group=verification]::before{background:#D97706}.nav-link.active[data-group=verification] svg{color:#D97706}\
.nav-link.active[data-group=attribution]{color:#6366F1}.nav-link.active[data-group=attribution]::before{background:#6366F1}.nav-link.active[data-group=attribution] svg{color:#6366F1}\
.nav-link.active[data-group=governance]{color:#64748B}.nav-link.active[data-group=governance]::before{background:#64748B}.nav-link.active[data-group=governance] svg{color:#64748B}\
@media(max-width:768px){.nav{display:none}}\
.main{min-height:calc(100vh - 48px)}\
.fly-docs-panel{display:flex;flex-direction:column;flex:1;min-width:0;overflow-y:auto}\
.fly-docs-panel.hidden{display:none!important}\
.fly-chat-panel{flex:1;display:flex;flex-direction:column;height:100vh;background:#f7f8fa;min-width:0;align-items:center}\
.fly-chat-panel.hidden{display:none!important}\
.fly-chat-hd{display:flex;align-items:center;padding:14px 24px;border-bottom:1px solid #e2e8f0;flex-shrink:0;background:#fff;width:100%;max-width:760px;box-sizing:border-box}\
.fly-chat-hd .fc-avatar{width:40px;height:40px;border-radius:50%;background:#2563EB;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;margin-right:14px;flex-shrink:0}\
.fly-chat-hd .fc-info{display:flex;flex-direction:column}\
.fly-chat-hd .fc-name{font-size:15px;font-weight:700;color:#0F172A}\
.fly-chat-hd .fc-status{font-size:11px;color:#22C55E;margin-top:2px;display:flex;align-items:center;gap:4px}\
.fly-chat-hd .fc-status::before{content:"";width:6px;height:6px;border-radius:50%;background:#22C55E;display:inline-block}\
.fly-chat-hd .fc-back{margin-left:auto;display:flex;align-items:center;gap:4px;color:#64748B;text-decoration:none;font-size:13px;padding:6px 14px;border-radius:8px;transition:background .15s;cursor:pointer}\
.fly-chat-hd .fc-back:hover{background:#f1f5f9}\
.fly-chat-body{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px;background:#f7f8fa;width:100%;max-width:760px;box-sizing:border-box}\
.fly-chat-body::-webkit-scrollbar{width:5px}\
.fly-chat-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.08);border-radius:3px}\
.fc-msg{max-width:70%;display:flex;gap:10px;align-items:flex-start}\
.fc-msg.bot{align-self:flex-start}\
.fc-msg.user{align-self:flex-end;flex-direction:row-reverse}\
.fc-msg .fc-ava{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}\
.fc-msg.bot .fc-ava{background:#2563EB;color:#fff}\
.fc-msg.user .fc-ava{background:#0F172A;color:#fff}\
.fc-msg .fc-bub{padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.7;word-break:break-word;white-space:pre-wrap}\
.fc-msg.bot .fc-bub{background:#fff;color:#0F172A;border:1px solid #e2e8f0;border-top-left-radius:4px}\
.fc-msg.user .fc-bub{background:#2563EB;color:#fff;border-top-right-radius:4px}\
.fc-msg.typing .fc-bub{color:#94A3B8;font-style:italic}\
.fc-quick-tags{display:flex;flex-wrap:wrap;gap:8px;padding:0 24px 12px;background:#f7f8fa;width:100%;max-width:760px;box-sizing:border-box}\
.fc-quick-tag{padding:6px 14px;border:1px solid #e2e8f0;border-radius:20px;font-size:12px;color:#64748B;cursor:pointer;transition:all .15s;background:#fff}\
.fc-quick-tag:hover{border-color:#2563EB;color:#2563EB;background:#eff6ff}\
.fly-chat-input{display:flex;align-items:flex-end;padding:12px 24px 16px;background:#f7f8fa;gap:0;flex-shrink:0;width:100%;max-width:760px;box-sizing:border-box}\
.fly-chat-input .fc-input-wrap{flex:1;border:1px solid #e2e8f0;border-radius:24px;padding:10px 16px;display:flex;align-items:center;background:#fff;transition:border-color .2s;min-height:44px}\
.fly-chat-input .fc-input-wrap:focus-within{border-color:#2563EB;box-shadow:0 0 0 2px rgba(37,99,235,.1)}\
.fly-chat-input input{flex:1;border:none;outline:none;font-size:14px;font-family:inherit;background:transparent}\
.fly-chat-input input::placeholder{color:#94A3B8}\
.fly-chat-input .fc-plus{width:32px;height:32px;border-radius:50%;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;color:#64748B;flex-shrink:0;margin-right:8px}\
.fly-chat-input .fc-plus:hover{background:#f1f5f9;color:#0F172A}\
.fly-chat-input .fc-auto{display:flex;align-items:center;gap:2px;padding:4px 10px;border-radius:14px;font-size:11px;color:#64748B;background:transparent;border:none;cursor:pointer;transition:background .15s;flex-shrink:0;margin-right:6px}\
.fly-chat-input .fc-auto:hover{background:#f1f5f9}\
.fly-chat-input .fc-auto svg{width:10px;height:10px}\
.fly-chat-input .fc-send{width:32px;height:32px;border-radius:50%;background:#2563EB;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0}\
.fly-chat-input .fc-send:hover{background:#1D4ED8}\
.fly-chat-input .fc-send:disabled{background:#e2e8f0;cursor:default}\
@media(max-width:768px){.fc-msg{max-width:88%}.fly-chat-body{padding:14px 12px}.fly-chat-input{padding:10px 12px}.fc-quick-tags{padding:0 12px 12px}}\
';
document.head.appendChild(cs);

window.FlyChat={
  cid:'',_chatPanel:null,
  open:function(){
    if(document.getElementById('flyChatPanel'))return;
    var docs=document.getElementById('flyDocsPanel');if(docs)docs.classList.add('hidden');
    var cp=document.createElement('div');cp.id='flyChatPanel';cp.className='fly-chat-panel';
    cp.innerHTML='<div class="fly-chat-hd"><div class="fc-avatar">F</div><div class="fc-info"><span class="fc-name">在线Fly</span><span class="fc-status">在线</span></div><div class="fc-back" onclick="FlyChat.close()">← 返回</div></div><div class="fly-chat-body" id="flyChatBody"></div><div class="fc-quick-tags" id="flyChatQuick"><div class="fc-quick-tag" onclick="FlyChat.ask(\'Fly是什么？\')">Fly是什么？</div><div class="fc-quick-tag" onclick="FlyChat.ask(\'如何验证AI归因？\')">如何验证AI归因？</div><div class="fc-quick-tag" onclick="FlyChat.ask(\'支持哪些AI平台？\')">支持哪些AI平台？</div></div><div class="fly-chat-input"><button class="fc-plus" title="附件"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button><div class="fc-input-wrap"><input type="text" id="flyChatInput" placeholder="发消息给在线Fly…" autocomplete="off"/><button class="fc-auto" id="flyChatAuto">Auto <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><button class="fc-send" onclick="FlyChat.send()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div></div>';
    document.body.appendChild(cp);this._chatPanel=cp;
    this._addBot('👋 你好，我是Fly验证助手。我可以帮你了解Fly的归因验证能力，试试问我：');
    setTimeout(function(){var inp=document.getElementById('flyChatInput');if(inp)inp.focus();},100);
    var self=this;
    document.getElementById('flyChatInput').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();self.send();}});
  },
  close:function(){var cp=document.getElementById('flyChatPanel');if(cp)cp.remove();this._chatPanel=null;var docs=document.getElementById('flyDocsPanel');if(docs)docs.classList.remove('hidden');},
  ask:function(q){document.getElementById('flyChatInput').value=q;this.send();var qt=document.getElementById('flyChatQuick');if(qt)qt.style.display='none';},
  send:function(){var inp=document.getElementById('flyChatInput');if(!inp)return;var txt=inp.value.trim();if(!txt)return;inp.value='';var qt=document.getElementById('flyChatQuick');if(qt)qt.style.display='none';this._addUser(txt);this._callAPI(txt);},
  _addUser:function(t){var b=document.getElementById('flyChatBody');if(!b)return;var d=document.createElement('div');d.className='fc-msg user';d.innerHTML='<div class="fc-ava">我</div><div class="fc-bub">'+this._esc(t)+'</div>';b.appendChild(d);b.scrollTop=b.scrollHeight;},
  _addBot:function(t){var b=document.getElementById('flyChatBody');if(!b)return;var d=document.createElement('div');d.className='fc-msg bot';d.innerHTML='<div class="fc-ava">F</div><div class="fc-bub">'+this._esc(t)+'</div>';b.appendChild(d);b.scrollTop=b.scrollHeight;return d;},
  _esc:function(s){return s.replace(/\&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},
  _callAPI:function(msg){
    var self=this;var b=document.getElementById('flyChatBody');if(!b)return;
    var ld=document.createElement('div');ld.className='fc-msg bot typing';ld.innerHTML='<div class="fc-ava">F</div><div class="fc-bub">思考中…</div>';b.appendChild(ld);b.scrollTop=b.scrollHeight;
    var bub=ld.querySelector('.fc-bub');
    fetch('https://api.fly-agent.xyz/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,conversation_id:this.cid})}).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);var reader=r.body.getReader();var decoder=new TextDecoder();var answer='';var buffer='';
      function read(){return reader.read().then(function(result){if(result.done){if(!answer)bub.textContent='暂无回复';ld.classList.remove('typing');b.scrollTop=b.scrollHeight;return;}buffer+=decoder.decode(result.value,{stream:true});var lines=buffer.split('\n');buffer=lines.pop();for(var i=0;i<lines.length;i++){var line=lines[i].trim();if(line.startsWith('data:')){var jsonStr=line.substring(5).trim();if(!jsonStr||jsonStr==='[DONE]')continue;try{var d=JSON.parse(jsonStr);if(d.conversation_id)self.cid=d.conversation_id;if(d.type==='answer'&&d.content){answer+=d.content;bub.textContent=answer;b.scrollTop=b.scrollHeight;}}catch(e){}}}return read();});}
      return read();
    }).catch(function(e){bub.textContent='连接失败，请稍后再试';ld.classList.remove('typing');b.scrollTop=b.scrollHeight;});
  }
};
})();
