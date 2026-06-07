/**
 * Fly 官网共享侧边栏 v20
 * 在线Fly：隐藏右侧页面内容，聊天区居中显示，输入框参考扣子风格
 */
(function(){
var sections=[
{id:'product',label:'产品',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="12" y="2" width="8" height="8" rx="1"/><rect x="2" y="12" width="8" height="8" rx="1"/><rect x="12" y="12" width="8" height="8" rx="1"/></svg>',
links:[
{href:'javascript:void(0)',text:'在线Fly',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',onclick:'FlyChat.open()'},
{href:'/signal-flow.html',text:'信号流',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'},
{href:'/audit.html',text:'沙盒验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/verification-layer.html',text:'验证层',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'},
{href:'/dashboard.html',text:'运行时',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="12" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><rect x="2" y="18" width="8" height="4" rx="1"/></svg>'},
{href:'/gateway.html',text:'网关',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="6" rx="1.5"/><rect x="2" y="15" width="20" height="6" rx="1.5"/><circle cx="6" cy="6" r="1.2" fill="currentColor"/><circle cx="6" cy="18" r="1.2" fill="currentColor"/></svg>'},
{href:'/agent-registry.html',text:'Agent注册',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>'}
]},
{id:'support',label:'支持',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
links:[
{href:'/trust.html',text:'信任中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'},
{href:'/security.html',text:'安全中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0110 0v3"/><circle cx="12" cy="16" r="1.5"/></svg>'},
{href:'/enterprise.html',text:'企业版',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="9" y1="12" x2="9" y2="12.01"/><line x1="9" y1="15" x2="9" y2="15.01"/><line x1="9" y1="18" x2="9" y2="18.01"/></svg>'},
{href:'#',text:'文档',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'}
]},
{id:'compliance',label:'合规',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="1 12 5 8 9 12"/><polyline points="15 12 19 8 23 12"/><line x1="5" y1="8" x2="5" y2="18"/><line x1="19" y1="8" x2="19" y2="18"/></svg>',
links:[
{href:'/compliance.html',text:'合规中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 8l7-5 7 5"/><line x1="4" y1="16" x2="20" y2="16"/></svg>'},
{href:'/privacy.html',text:'隐私政策',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 01-4.24-4.24"/></svg>'},
{href:'/refund.html',text:'退款政策',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'},
{href:'/terms.html',text:'服务条款',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'}
]},
{id:'channel',label:'渠道',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
links:[
{href:'/channel-douyin.html',text:'抖音',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'},
{href:'/channel-xiaohongshu.html',text:'小红书',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'},
{href:'/channel-wechat.html',text:'微信',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'},
{href:'/channel-meituan.html',text:'美团',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z"/><line x1="3" y1="7" x2="21" y2="7"/><path d="M16 11a4 4 0 0 1-8 0"/></svg>'},
{href:'/channel-feishu.html',text:'飞书',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></svg>'},
{href:'/channel-ai-search.html',text:'AI搜索推荐',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'},
{href:'/channel-coze.html',text:'扣子',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>'},
{href:'/channel-clawhub.html',text:'ClawHub',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'},
{href:'/channel-other.html',text:'其他',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>'}
]},
{id:'industry',label:'行业',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
links:[
{href:'/industry-beauty.html',text:'医美',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 2.76-5 9-5 9S7 9.76 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="1.5"/></svg>'},
{href:'/industry-local.html',text:'本地生活',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'},
{href:'/industry-education.html',text:'教育',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'},
{href:'/industry-highticket.html',text:'高客单',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><line x1="2" y1="9" x2="22" y2="9"/></svg>'}
]}
];

var path=window.location.pathname;

function buildNav(){
var h='<aside class="nav"><div class="nav-list">';
h+='<div class="nav-logo">';
h+='<a href="/" class="nav-logo-left" title="首页"><span class="nav-logo-mark">F</span><span class="nav-logo-text">Fly</span><span class="nav-logo-sub">归因验证</span></a>';
h+='<div class="nav-toggle" onclick="FlyNav.toggle()" title="折叠/展开">';
h+='<svg class="toggle-icon-expand" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="7" height="18" rx="1"/><line x1="11" y1="5" x2="19" y2="5"/><line x1="11" y1="9" x2="19" y2="9"/><line x1="11" y1="13" x2="17" y2="13"/></svg>';
h+='<svg class="toggle-icon-collapse" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="3.5" height="18" rx="1"/><line x1="7.5" y1="5" x2="19" y2="5"/><line x1="7.5" y1="9" x2="19" y2="9"/><line x1="7.5" y1="13" x2="17" y2="13"/></svg>';
h+='</div></div>';

sections.forEach(function(s){
var ha=s.links.some(function(l){return l.href===path});
h+='<div class="nav-sec">';
h+='<div class="nav-sec-hd'+(ha?' open':'')+'" onclick="FlyNav.toggleSec(this)">';
h+='<span class="sec-ico">'+s.icon+'</span><span>'+s.label+'</span>';
h+='<span class="arr"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg></span></div>';
h+='<div class="nav-sec-bd'+(ha?' open':'')+'">';
s.links.forEach(function(l){
var act=l.href===path;
h+='<a href="'+l.href+'" class="nav-link'+(act?' active':'')+'"'+(l.onclick?' onclick="'+l.onclick+'"':'')+'>';
if(l.icon.charAt(0)==='<'){h+=l.icon}else{h+='<span class="nav-emoji">'+l.icon+'</span>'}
h+='<span>'+l.text+'</span></a>';
});
h+='</div></div>';
});
h+='</div></aside>';
return h;
}

// 注入侧边栏到[data-nav]或body开头
var c=document.querySelector('[data-nav]');
if(c){c.innerHTML=buildNav()}else{
var d=document.createElement('div');d.innerHTML=buildNav();
document.body.insertBefore(d.firstElementChild,document.body.firstChild);
}

// 恢复折叠状态
(function(){try{if(localStorage.getItem('fly-nav-collapsed')==='1'){var n=document.querySelector('.nav-list');if(n){n.classList.add('collapsed');n.style.width='var(--nav-w-c)'}}}catch(e){}})();

// 全局方法
window.FlyNav={
toggle:function(){var n=document.querySelector('.nav-list');if(!n)return;n.classList.toggle('collapsed');var c=n.classList.contains('collapsed');n.style.width=c?'var(--nav-w-c)':'var(--nav-w)';try{localStorage.setItem('fly-nav-collapsed',c?'1':'0')}catch(e){}},
toggleSec:function(el){el.classList.toggle('open');var b=el.nextElementSibling;if(b)b.classList.toggle('open')}
};

// 注入导航CSS
var cs=document.createElement('style');
cs.textContent='\
.nav{display:flex;height:100vh;flex-shrink:0}\
.nav-list{position:relative;width:var(--nav-w);display:flex;flex-direction:column;overflow-y:auto;background:var(--bg);border-right:1px solid var(--border);transition:width .2s ease;scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.08) transparent}\
.nav-list::-webkit-scrollbar{width:4px}\
.nav-list::-webkit-scrollbar-track{background:transparent}\
.nav-list::-webkit-scrollbar-thumb{background:rgba(0,0,0,.08);border-radius:2px}\
.nav-list::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.15)}\
.nav-logo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;font-size:13px;font-weight:700;color:var(--dark);border-bottom:1px solid var(--border);letter-spacing:-.3px;white-space:nowrap;overflow:visible;transition:padding .2s}\
.nav-logo-mark{display:none;width:28px;height:28px;border-radius:6px;background:var(--deep-green);color:#fff;font-size:15px;font-weight:800;line-height:28px;text-align:center;flex-shrink:0}\
.nav-logo-left{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--dark)}\
.nav-logo-sub{font-size:10px;font-weight:400;color:var(--text4);letter-spacing:.5px}\
.nav-list.collapsed .nav-logo-sub{display:none}\
.nav-list.collapsed{width:var(--nav-w-c)}\
.nav-list.collapsed .nav-logo{padding:10px 6px;justify-content:center;align-items:center;overflow:visible;transition:background .15s;gap:2px}\
.nav-list.collapsed .nav-logo-mark{display:none}\
.nav-list.collapsed .nav-logo-text{display:block;font-size:12px;font-weight:700;white-space:nowrap}\
.nav-list.collapsed .nav-logo-left{justify-content:center;overflow:visible;gap:0;padding:0}\
.nav-list.collapsed .nav-logo:hover{background:var(--bg3)}\
.nav-bot-link{display:flex;align-items:center;gap:8px;padding:10px 16px;text-decoration:none;color:var(--text3);font-size:12.5px;font-weight:500;border-bottom:1px solid var(--border);transition:background .15s}\
.nav-bot-link:hover{background:var(--bg3)}\
.nav-bot-link.chat-active{color:var(--deep-green);background:var(--mint)}\
.bot-ico{display:inline-flex;align-items:center;color:var(--text4)}\
.nav-list.collapsed .nav-bot-link{justify-content:center;padding:10px 6px;gap:0}\
.nav-list.collapsed .bot-text{display:none}\
.nav-list.collapsed .nav-link span{display:none}\
.nav-list.collapsed .nav-sec-hd{display:none}\
.nav-list.collapsed .nav-sec-bd{display:block!important;max-height:none!important;overflow:visible}\
.nav-list.collapsed .nav-sec-bd.open{max-height:none!important}\
.nav-list.collapsed .nav-link{justify-content:center;padding:8px 0;margin-right:0;border-radius:6px;margin:0 4px;gap:0;height:36px;box-sizing:border-box}\
.nav-list.collapsed .nav-sec-bd{padding-top:4px}.nav-list.collapsed .nav-sec{border-top:1px solid var(--border);margin-top:4px;padding-top:4px}\
.nav-list.collapsed .nav-link.active::before{display:none}\
.nav-list.collapsed .nav-link.active::after{content:"";position:absolute;left:2px;top:4px;bottom:4px;width:3px;background:var(--deep-green);border-radius:0 2px 2px 0}\
.nav-toggle{display:flex;align-items:center;justify-content:center;padding:4px;border-radius:4px;cursor:pointer;color:var(--text4);transition:color .15s,background .15s;flex-shrink:0}\
.nav-list.collapsed .nav-toggle{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;cursor:pointer;flex-shrink:0}\
.nav-toggle:hover{color:var(--dark);background:var(--bg3)}\
.nav-toggle svg{transition:opacity .15s,width .15s,height .15s;width:18px;height:18px}\
.nav-list.collapsed .nav-toggle svg{width:14px;height:14px}\
.toggle-icon-collapse{display:none}\
.nav-list.collapsed .toggle-icon-expand{display:block}\
.nav-list.collapsed .toggle-icon-collapse{display:none}\
.nav-link{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:12.5px;font-weight:500;color:var(--text3);text-decoration:none;transition:.12s;position:relative;border-radius:0 6px 6px 0;margin-right:8px}\
.nav-link:hover{color:var(--dark);background:var(--bg3)}\
.nav-link.active{color:var(--deep-green);font-weight:600;background:var(--mint)}\
.nav-link.active::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:3px;background:var(--deep-green);border-radius:0 2px 2px 0}\
.nav-link svg{flex-shrink:0;opacity:.55;transition:opacity .15s;width:16px;height:16px}\
.nav-link:hover svg{opacity:.9}\
.nav-link.active svg{opacity:1;color:var(--deep-green)}\
.nav-link span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.nav-link .nav-emoji{font-style:normal}\
.nav-list.collapsed .nav-link .nav-emoji{display:inline-flex;align-items:center;justify-content:center;font-size:14px;width:16px;height:16px;line-height:1;text-align:center;flex-shrink:0}\
.nav-sec-hd{display:flex;align-items:center;gap:6px;padding:10px 16px 4px;font-size:10px;font-weight:600;color:var(--text4);letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;user-select:none}\
.nav-sec-hd:hover{color:var(--text3)}\
.nav-sec-hd .arr{margin-left:auto;transition:transform .2s;display:flex;align-items:center}\
.nav-sec-hd.open .arr{transform:rotate(90deg)}\
.nav-sec-hd .sec-ico{display:flex;align-items:center;opacity:.45;transition:opacity .15s}\
.nav-sec-hd:hover .sec-ico{opacity:.8}\
.nav-sec{border-top:1px solid var(--border);margin-top:2px;padding-top:2px}\
.nav-sec:first-of-type{border-top:none;margin-top:0;padding-top:0}\
.nav-sec-bd{overflow:hidden;max-height:0;transition:max-height .25s ease}\
.nav-sec-bd.open{max-height:400px}\
.nav-link.sub{padding-left:32px;font-size:11.5px;font-weight:400;color:var(--text4)}\
.nav-link.sub:hover{color:var(--dark)}\
.nav-link.sub.active{color:var(--deep-green);font-weight:600}\
.nav-link .sarr{margin-left:auto;transition:transform .2s;display:flex;align-items:center}\
.nav-link .sarr.open{transform:rotate(90deg)}\
@media(max-width:768px){.nav{display:none}}\
\
/* ====== 聊天区（侧边栏右侧，居中布局，参考扣子风格） ====== */\
.fly-chat-main{flex:1;display:flex;flex-direction:column;height:100vh;background:#f7f8fa;min-width:0;align-items:center}\
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
@media(max-width:768px){.fc-sidebar{display:none}.fc-msg{max-width:88%}.fly-chat-body{padding:14px 12px}.fly-chat-input{padding:10px 12px}.fc-quick-tags{padding:0 12px 12px}}\
';
document.head.appendChild(cs);

// ========== 聊天逻辑：替换右侧主内容区为全屏聊天 ==========
window.FlyChat={
  cid:'',
  _saved:null,
  _chatEl:null,

  open:function(){
    if(document.getElementById('flyChatMain'))return;
    var nav=document.querySelector('.nav');
    if(!nav)return;
    // 隐藏右侧所有主内容区（.main等所有兄弟元素）
    var saved=[];
    var sib=nav.nextElementSibling;
    while(sib){saved.push(sib);sib.style.display='none';sib=sib.nextElementSibling;}
    this._savedEls=saved;

    // 在侧边栏右侧插入聊天区，不用fixed覆盖
    var chatMain=document.createElement('div');
    chatMain.id='flyChatMain';
    chatMain.className='fly-chat-main';
    chatMain.innerHTML='\
        <div class="fly-chat-hd">\
          <div class="fc-avatar">F</div>\
          <div class="fc-info">\
            <span class="fc-name">在线Fly</span>\
            <span class="fc-status">在线</span>\
          </div>\
          <div class="fc-back" onclick="FlyChat.close()">← 返回</div>\
        </div>\
        <div class="fly-chat-body" id="flyChatBody"></div>\
        <div class="fc-quick-tags" id="flyChatQuick">\
          <div class="fc-quick-tag" onclick="FlyChat.ask(\'Fly是什么？\')">Fly是什么？</div>\
          <div class="fc-quick-tag" onclick="FlyChat.ask(\'如何验证AI归因？\')">如何验证AI归因？</div>\
          <div class="fc-quick-tag" onclick="FlyChat.ask(\'支持哪些渠道？\')">支持哪些渠道？</div>\
        </div>\
        <div class="fly-chat-input">\
          <button class="fc-plus" title="附件">\
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\
          </button>\
          <div class="fc-input-wrap">\
            <input type="text" id="flyChatInput" placeholder="发消息给在线Fly…" autocomplete="off"/>\
            <button class="fc-auto" id="flyChatAuto">Auto <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>\
            <button class="fc-send" onclick="FlyChat.send()">\
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>\
            </button>\
          </div>\
        </div>';
    nav.parentNode.insertBefore(chatMain,nav.nextSibling);
    this._chatEl=chatMain;

    this._addBot('👋 你好，我是Fly验证助手。我可以帮你了解Fly的归因验证能力，试试问我：');

    setTimeout(function(){var inp=document.getElementById('flyChatInput');if(inp)inp.focus();},100);
    var self=this;
    document.getElementById('flyChatInput').addEventListener('keydown',function(e){
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();self.send();}
    });
  },

  close:function(){
    var cp=document.getElementById('flyChatMain');
    if(cp)cp.remove();
    if(this._savedEls){this._savedEls.forEach(function(el){el.style.display='';});this._savedEls=null;}
    this._chatEl=null;
  },

  ask:function(q){
    document.getElementById('flyChatInput').value=q;
    this.send();
    var qt=document.getElementById('flyChatQuick');if(qt)qt.style.display='none';
  },

  send:function(){
    var inp=document.getElementById('flyChatInput');
    if(!inp)return;
    var txt=inp.value.trim();
    if(!txt)return;
    inp.value='';
    var qt=document.getElementById('flyChatQuick');if(qt)qt.style.display='none';
    this._addUser(txt);
    this._callAPI(txt);
  },

  _addUser:function(t){
    var b=document.getElementById('flyChatBody');
    if(!b)return;
    var d=document.createElement('div');d.className='fc-msg user';
    d.innerHTML='<div class="fc-ava">我</div><div class="fc-bub">'+this._esc(t)+'</div>';
    b.appendChild(d);b.scrollTop=b.scrollHeight;
  },

  _addBot:function(t){
    var b=document.getElementById('flyChatBody');
    if(!b)return;
    var d=document.createElement('div');d.className='fc-msg bot';
    d.innerHTML='<div class="fc-ava">F</div><div class="fc-bub">'+this._esc(t)+'</div>';
    b.appendChild(d);b.scrollTop=b.scrollHeight;
    return d;
  },

  _esc:function(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},

  _callAPI:function(msg){
    var self=this;
    var b=document.getElementById('flyChatBody');
    if(!b)return;
    var ld=document.createElement('div');ld.className='fc-msg bot typing';
    ld.innerHTML='<div class="fc-ava">F</div><div class="fc-bub">思考中…</div>';
    b.appendChild(ld);b.scrollTop=b.scrollHeight;
    fetch('https://api.fly-agent.xyz/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:msg,conversation_id:this.cid})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.conversation_id)self.cid=d.conversation_id;
      ld.querySelector('.fc-bub').textContent=d.reply||d.message||d.content||'暂无回复';
      ld.classList.remove('typing');
      b.scrollTop=b.scrollHeight;
    }).catch(function(e){
      ld.querySelector('.fc-bub').textContent='连接失败，请稍后再试';
      ld.classList.remove('typing');
      b.scrollTop=b.scrollHeight;
    });
  }
};
})();
