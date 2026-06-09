/**
 * Fly 官网共享侧边栏 v23 · 8组终极版 + 折叠 + /ai-platforms/ 路径
 * 页面隔离架构：DocsPanel / ChatPanel 完全分离，不共享DOM/state
 * 8组：核心概念 / 验证体系 / AI Native / AI Platforms / 开发者 / 企业 / 合规 / 渠道
 * 默认展开：核心概念 / 验证体系 / AI Native；其余收起
 * AI Platforms统一路径：/ai-platforms/xxx.html
 */
(function(){
var sections=[
// ── 1. 核心概念（深绿 #1A3D2E） ──
{id:'core',label:'核心概念',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
links:[
{href:'/',text:'Fly概念',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'},
{href:'/signal-flow.html',text:'Signal Flow',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'},
{href:'/faq.html',text:'常见问题',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
]},
// ── 2. 验证体系（绿色 #059669） ──
{id:'verify',label:'验证体系',color:'#059669',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
links:[
{href:'/verification-layer.html',text:'Action ID',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>'},
{href:'/audit.html',text:'Attribution',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'},
{href:'/trust.html',text:'Verification',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/dashboard.html',text:'Audit Chain',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="1 12 5 8 9 12"/><polyline points="15 12 19 8 23 12"/><line x1="5" y1="8" x2="5" y2="18"/><line x1="19" y1="8" x2="19" y2="18"/></svg>'},
{href:'/gateway.html',text:'Trust Layer',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'},
{href:'/security.html',text:'Security Model',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0110 0v3"/><circle cx="12" cy="16" r="1.5"/></svg>'}
]},
// ── 3. AI Native（紫色 #7C3AED） ──
{id:'ainative',label:'AI Native',color:'#7C3AED',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14h.01"/><path d="M8 14h.01"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>',
links:[
{href:'/agent-registry.html',text:'Behavior ID',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-7.7-1.4 1.4M6.7 19.3l-1.4 1.4m0-15.4 1.4 1.4m10.6 12.6 1.4 1.4"/></svg>'},
{href:'/bot.html',text:'BOT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',onclick:'FlyChat.open()'},
{href:'/ai-skills.html',text:'AI Skills',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
{href:'/sdk.html',text:'SDK',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'}
]},
// ── 4. AI Platforms（靛蓝 #6366F1） ──
{id:'aiplatforms',label:'AI Platforms',color:'#6366F1',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
links:[
{href:'/ai-platforms/chatgpt.html',text:'ChatGPT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'},
{href:'/ai-platforms/claude.html',text:'Claude',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'},
{href:'/ai-platforms/gemini.html',text:'Gemini',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><line x1="22" y1="8.5" x2="12" y2="15.5"/><line x1="2" y1="8.5" x2="12" y2="15.5"/></svg>'},
{href:'/ai-platforms/perplexity.html',text:'Perplexity',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'},
{href:'/ai-platforms/coze.html',text:'Coze',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="12" y="2" width="8" height="8" rx="1"/><rect x="2" y="12" width="8" height="8" rx="1"/><rect x="12" y="12" width="8" height="8" rx="1"/></svg>'},
{href:'/ai-platforms/dify.html',text:'Dify',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'},
{href:'/ai-platforms/fastgpt.html',text:'FastGPT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'},
{href:'/ai-platforms/red-skill.html',text:'小红书 Skill',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'},
{href:'/ai-platforms/wechat-agent.html',text:'微信 Agent',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'}
]},
// ── 5. 开发者（橙色 #EA580C） ──
{id:'dev',label:'开发者',color:'#EA580C',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
links:[
{href:'/audit.html',text:'API Playground',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'},
{href:'/api-reference.html',text:'API Reference',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
{href:'/ecosystem.html',text:'Ecosystem',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><line x1="7.5" y1="7.5" x2="10.5" y2="10.5"/><line x1="13.5" y1="10.5" x2="16.5" y2="7.5"/><line x1="7.5" y1="16.5" x2="10.5" y2="13.5"/><line x1="13.5" y1="13.5" x2="16.5" y2="16.5"/></svg>'}
]},
// ── 6. 企业（青色 #0891B2） ──
{id:'enterprise',label:'企业',color:'#0891B2',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
links:[
{href:'/enterprise.html',text:'Enterprise',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>'},
{href:'/cases.html',text:'Cases',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'}
]},
// ── 7. 合规（灰色 #64748B） ──
{id:'compliance',label:'合规',color:'#64748B',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 8l7-5 7 5"/><line x1="4" y1="16" x2="20" y2="16"/></svg>',
links:[
{href:'/compliance.html',text:'Compliance',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 8l7-5 7 5"/><line x1="4" y1="16" x2="20" y2="16"/></svg>'},
{href:'/privacy.html',text:'Privacy',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'},
{href:'/refund.html',text:'Refund',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'},
{href:'/terms.html',text:'Terms',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'}
]},
// ── 8. 渠道（暖黄 #D97706） ──
{id:'channel',label:'渠道',color:'#D97706',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
links:[
{href:'/channel-douyin.html',text:'抖音',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'},
{href:'/channel-xiaohongshu.html',text:'小红书(RED)',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'},
{href:'/channel-wechat.html',text:'微信',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'},
{href:'/channel-meituan.html',text:'美团',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z"/><line x1="3" y1="7" x2="21" y2="7"/><path d="M16 11a4 4 0 0 1-8 0"/></svg>'},
{href:'/channel-feishu.html',text:'飞书',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>'}
]},
// ── 9. Web3（青灰 #475569） ──
{id:'web3',label:'Web3',color:'#475569',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
links:[
{href:'/web3/wallet.html',text:'Wallet ID',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>'},
{href:'/web3/ethereum.html',text:'Ethereum',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 12 12 22 22 12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>'},
{href:'/web3/solana.html',text:'Solana',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M2 6h20M2 18h20"/></svg>'},
{href:'/web3/base.html',text:'Base',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>'},
{href:'/web3/tx-verification.html',text:'Tx Verification',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'}
]}
];

var cur=location.pathname.replace(/\/$/,'/index.html');
var collapsed=localStorage.getItem('fly_nav_collapsed')==='1';

var colorVars='';
sections.forEach(function(s){colorVars+='--gc-'+s.id+':'+s.color+';';});

var h='<nav class="nav'+(collapsed?' collapsed':'')+'">';
h+='<div class="nav-brand"><div class="nav-logo">F</div><span class="nav-logo-text">Fly 验证归因</span></div>';
h+='<div class="nav-list'+(collapsed?' collapsed':'')+'">';
h+='<button class="nav-toggle" onclick="FlyNav.toggle()">';
h+='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
h+='</button>';

sections.forEach(function(sec){
  var ha=sec.links.some(function(l){return l.href===cur;})||sec.defaultOpen;
  h+='<div class="nav-sec" data-group="'+sec.id+'">';
  h+='<div class="nav-sec-hd'+(ha?' open':'')+'" onclick="FlyNav.toggleSec(this)" style="color:var(--gc-'+sec.id+')">';
  h+='<span class="sec-ico">'+sec.icon+'</span>';
  h+='<span class="sec-lbl">'+sec.label+'</span>';
  h+='<span class="arr"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 6 15 12 9 18"/></svg></span>';
  h+='</div>';
  h+='<div class="nav-sec-bd'+(ha?' open':'')+'">';
  sec.links.forEach(function(l){
    var ac=l.href===cur;
    if(l.onclick){
      h+='<a class="nav-link'+(ac?' active':'')+'" href="javascript:void(0)" onclick="'+l.onclick+'" title="'+l.text+'" data-group="'+sec.id+'">'+l.icon+'<span>'+l.text+'</span></a>';
    }else{
      h+='<a class="nav-link'+(ac?' active':'')+'" href="'+l.href+'" title="'+l.text+'" data-group="'+sec.id+'">'+l.icon+'<span>'+l.text+'</span></a>';
    }
  });
  h+='</div></div>';
});
h+='</div></nav>';

var d=document.createElement('div');
d.innerHTML=h;
document.body.insertBefore(d.firstElementChild,document.body.firstChild);

(function(){
  var nav=document.querySelector('.nav');
  if(!nav)return;
  var wrapper=document.createElement('div');
  wrapper.className='fly-docs-panel';
  wrapper.id='flyDocsPanel';
  var sib=nav.nextElementSibling;
  while(sib){
    var next=sib.nextElementSibling;
    wrapper.appendChild(sib);
    sib=next;
  }
  nav.parentNode.appendChild(wrapper);
})();

window.FlyNav={
  toggle:function(){
    var n=document.querySelector('.nav');
    var l=document.querySelector('.nav-list');
    if(n)n.classList.toggle('collapsed');
    if(l)l.classList.toggle('collapsed');
    localStorage.setItem('fly_nav_collapsed',document.querySelector('.nav.collapsed')?'1':'0');
  },
  toggleSec:function(el){el.classList.toggle('open');var b=el.nextElementSibling;if(b)b.classList.toggle('open')}
};

var cs=document.createElement('style');
cs.textContent='\
:root{'+colorVars+'--dark:#0F172A;--text3:#475569;--text4:#94A3B8;--border:#e2e8f0;--bg3:#f1f5f9;--mint:#ecfdf5;--deep-green:#059669;--blue:#2563EB}\
*{margin:0;padding:0;box-sizing:border-box}\
body{display:flex;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;background:#fff;color:var(--dark)}\
a{color:inherit;text-decoration:none}\
.nav{width:260px;min-width:260px;background:#fff;border-right:1px solid var(--border);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;transition:width .2s,min-width .2s;overflow:hidden;z-index:100}\
.nav.collapsed{width:64px;min-width:64px}\
.nav-brand{display:flex;align-items:center;gap:10px;padding:16px;flex-shrink:0}\
.nav-logo{width:34px;height:34px;border-radius:10px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0}\
.nav-logo-text{font-size:14px;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden}\
.nav.collapsed .nav-logo-text{display:none}\
.nav-list{flex:1;overflow-y:auto;padding:4px 0;transition:padding .2s}\
.nav-list::-webkit-scrollbar{width:3px}\
.nav-list::-webkit-scrollbar-thumb{background:rgba(0,0,0,.06);border-radius:2px}\
.nav-list.collapsed .nav-sec-hd .sec-lbl,.nav-list.collapsed .nav-sec-hd .arr,.nav-list.collapsed .nav-link span,.nav-list.collapsed .nav-sec-bd{display:none!important}\
.nav-list.collapsed .nav-link{justify-content:center;padding:10px 0;margin-right:0}\
.nav-toggle{display:flex;align-items:center;justify-content:center;margin:4px 16px 8px;padding:6px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;transition:background .15s}\
.nav-toggle:hover{background:var(--bg3)}\
.nav-toggle svg{transition:all .15s;width:18px;height:18px}\
.nav-sec-hd{display:flex;align-items:center;gap:6px;padding:10px 16px 4px;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;user-select:none;transition:opacity .15s}\
.nav-sec-hd .sec-ico{display:flex;align-items:center;opacity:.7;transition:opacity .15s}\
.nav-sec-hd:hover .sec-ico{opacity:1}\
.nav-sec-hd .arr{margin-left:auto;transition:transform .2s;display:flex;align-items:center;opacity:.5}\
.nav-sec-hd.open .arr{transform:rotate(90deg);opacity:.8}\
.nav-link{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:12.5px;font-weight:500;color:var(--text3);text-decoration:none;transition:.12s;position:relative;border-radius:0 6px 6px 0;margin-right:8px}\
.nav-link:hover{background:var(--bg3)}\
.nav-link[data-group=core]:hover{color:#1A3D2E;background:rgba(26,61,46,.06)}\
.nav-link[data-group=verify]:hover{color:#059669;background:rgba(5,150,105,.06)}\
.nav-link[data-group=ainative]:hover{color:#7C3AED;background:rgba(124,58,237,.06)}\
.nav-link[data-group=aiplatforms]:hover{color:#6366F1;background:rgba(99,102,241,.06)}\
.nav-link[data-group=dev]:hover{color:#EA580C;background:rgba(234,88,12,.06)}\
.nav-link[data-group=enterprise]:hover{color:#0891B2;background:rgba(8,145,178,.06)}\
.nav-link[data-group=compliance]:hover{color:#64748B;background:rgba(100,116,139,.06)}\
.nav-link[data-group=channel]:hover{color:#D97706;background:rgba(217,119,6,.06)}\
.nav-link[data-group=web3]:hover{color:#475569;background:rgba(71,85,105,.06)}\
.nav-link.active{font-weight:600}\
.nav-link.active::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:3px;border-radius:0 2px 2px 0}\
.nav-link svg{flex-shrink:0;opacity:.55;transition:opacity .15s;width:16px;height:16px}\
.nav-link:hover svg{opacity:.9}\
.nav-link.active svg{opacity:1}\
.nav-link span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.nav-sec{border-top:1px solid var(--border);margin-top:6px;padding-top:2px}\
.nav-sec:first-of-type{border-top:none;margin-top:0;padding-top:0}\
.nav-sec-bd{overflow:hidden;max-height:0;transition:max-height .25s ease}\
.nav-sec-bd.open{max-height:600px}\
.nav-link.active[data-group=core]{color:#1A3D2E}.nav-link.active[data-group=core]::before{background:#1A3D2E}.nav-link.active[data-group=core] svg{color:#1A3D2E}\
.nav-link.active[data-group=verify]{color:#059669}.nav-link.active[data-group=verify]::before{background:#059669}.nav-link.active[data-group=verify] svg{color:#059669}\
.nav-link.active[data-group=ainative]{color:#7C3AED}.nav-link.active[data-group=ainative]::before{background:#7C3AED}.nav-link.active[data-group=ainative] svg{color:#7C3AED}\
.nav-link.active[data-group=aiplatforms]{color:#6366F1}.nav-link.active[data-group=aiplatforms]::before{background:#6366F1}.nav-link.active[data-group=aiplatforms] svg{color:#6366F1}\
.nav-link.active[data-group=dev]{color:#EA580C}.nav-link.active[data-group=dev]::before{background:#EA580C}.nav-link.active[data-group=dev] svg{color:#EA580C}\
.nav-link.active[data-group=enterprise]{color:#0891B2}.nav-link.active[data-group=enterprise]::before{background:#0891B2}.nav-link.active[data-group=enterprise] svg{color:#0891B2}\
.nav-link.active[data-group=compliance]{color:#64748B}.nav-link.active[data-group=compliance]::before{background:#64748B}.nav-link.active[data-group=compliance] svg{color:#64748B}\
.nav-link.active[data-group=channel]{color:#D97706}.nav-link.active[data-group=channel]::before{background:#D97706}.nav-link.active[data-group=channel] svg{color:#D97706}\
.nav-link.active[data-group=web3]{color:#475569}.nav-link.active[data-group=web3]::before{background:#475569}.nav-link.active[data-group=web3] svg{color:#475569}\
@media(max-width:768px){.nav{display:none}}\
.fly-docs-panel{flex:1;min-width:0;overflow-y:auto}\
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
  _esc:function(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},
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
