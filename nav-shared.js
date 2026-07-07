/**
 * Fly 官网共享侧边栏 v30 · 精简为协议核心框架
 * 只保留有实质内容的分组，删除空模板链接
 * 框架：左导航 + 右内容区（不变）
 */
(function(){
var sections=[
// ── 0. Fly（产品入口）──
{id:'fly',label:'⭐ Fly',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
links:[
{href:'/verify.html',text:'Fly Verify 验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/faq.html',text:'常见问题',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
]},
// ── 1. Protocol 协议核心（4层）──
{id:'protocol',label:'Protocol 协议核心',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
links:[
{href:'/concept-behavior-id.html',text:'Claim 声明层',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-7.7-1.4 1.4M6.7 19.3l-1.4 1.4m0-15.4 1.4-1.4m10.6 12.6 1.4 1.4"/></svg>'},
{href:'/concept-action-id.html',text:'Evidence 证据层',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>'},
{href:'/concept-verification.html',text:'Attestation 证明层',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/concept-trust.html',text:'Trust Record 信任记录',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'}
]},
// ── 2. Agent 生态 ──
{id:'agent',label:'Agent 生态',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-7.7-1.4 1.4M6.7 19.3l-1.4 1.4m0-15.4 1.4-1.4m10.6 12.6 1.4 1.4"/></svg>',
links:[
{href:'/concept-business-value.html',text:'Settlement Ready 结算就绪',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22m-4-4l4 4 4-4"/><path d="M5 12h14"/></svg>'},
{href:'/agent-registry.html',text:'Agent Registry 注册中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-7.7-1.4 1.4M6.7 19.3l-1.4 1.4m0-15.4 1.4-1.4m10.6 12.6 1.4 1.4"/></svg>'},
{href:'/agent-identity.html',text:'Agent Identity 身份',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}
]},
// ── 3. Governance 治理 ──
{id:'governance',label:'Governance 治理',color:'#64748B',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
links:[
{href:'/compliance.html',text:'合规中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
{href:'/compliance-audit-trail.html',text:'审计追踪',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
{href:'/compliance-data-governance.html',text:'数据治理',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'},
{href:'/privacy.html',text:'隐私政策',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'},
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
sections.forEach(function(s){
nb+='<div class="nav-section" data-id="'+s.id+'">';
nb+='<div class="nav-section-header" style="color:'+s.color+'" onclick="FlyNav.toggleSection(\''+s.id+'\')">';
nb+=s.icon;
nb+='<span>'+s.label+'</span>';
nb+='<span class="nav-chevron">›</span>';
nb+='</div>';
nb+='<div class="nav-section-links" id="nav-'+s.id+'" style="display:'+(s.defaultOpen?'block':'none')+'">';
s.links.forEach(function(l){
nb+='<a href="'+l.href+'" class="nav-link">';
nb+=l.icon;
nb+='<span>'+l.text+'</span>';
nb+='</a>';
});
nb+='</div></div>';
});
nb+='</div>';
nav.innerHTML=nb;
document.body.prepend(nav);
document.body.prepend(topBar);
window.FlyNav={toggle:function(){collapsed=!collapsed;document.querySelector('.nav-top').classList.toggle('collapsed',collapsed);document.querySelector('.nav').classList.toggle('collapsed',collapsed);localStorage.setItem('fly_nav_collapsed',collapsed?'1':'0')},toggleSection:function(id){var el=document.getElementById('nav-'+id);if(el)el.style.display=el.style.display==='none'?'block':'none'}};
})();
