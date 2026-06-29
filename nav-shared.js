/**
 * Fly 官网共享侧边栏 v29 · 融合版
 * 4层商业结构：AI Source → Evidence → Attribution → Settlement
 * 隐藏技术层（Gate/Verification/Governance → Infrastructure）
 * 默认展开：Fly / AI Source / Evidence
 */
(function(){
var sections=[
// ── 0. Fly（产品入口）深绿 #1A3D2E
{id:'fly',label:'Fly \u2014 \u5546\u4e1a\u5f52\u56e0\u534f\u8bae',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
links:[
{href:'/verify',text:'Issue Attribution \u7b7e\u53d1\u5f52\u56e0',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/trust.html',text:'View Reports \u67e5\u770b\u62a5\u544a',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'}
]},
// ── 1. AI Source\uff08\u53d1\u751f\u6e90\uff09\u6df1\u7eff #1A3D2E
{id:'source',label:'AI Source \u53d1\u751f\u6e90',color:'#1A3D2E',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2"/></svg>',
links:[
{href:'/concept-behavior-id.html',text:'AI Source AI\u6765\u6e90',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2"/></svg>'},
{href:'/bot.html',text:'Agent Profile Agent\u6863\u6848',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'},
{href:'/ai-platforms/chatgpt.html',text:'ChatGPT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>'},
{href:'/ai-platforms/claude.html',text:'Claude',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'},
{href:'/ai-platforms/gemini.html',text:'Gemini',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
{href:'/ai-platforms/coze.html',text:'Coze',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'},
{href:'/ai-platforms/dify.html',text:'Dify',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'},
{href:'/ai-platforms/fastgpt.html',text:'FastGPT',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'},
{href:'/ai-platforms/perplexity.html',text:'Perplexity',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'},
{href:'/ai-platforms/wechat-agent.html',text:'\u5fae\u4fe1Agent',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}
]},
// ── 2. Evidence\uff08\u53ef\u4fe1\u4f9d\u636e\uff09\u7425\u73c0 #D97706
{id:'evidence',label:'Evidence \u53ef\u4fe1\u4f9d\u636e',color:'#D97706',defaultOpen:true,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
links:[
{href:'/concept-action-id.html',text:'Evidence \u8bc1\u636e',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'},
{href:'/concept-verification.html',text:'Conversion \u8f6c\u5316',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'}
]},
// ── 3. Attribution\uff08\u4ef7\u503c\u5206\u914d\uff09\u7eff\u8272 #059669
{id:'attribution',label:'Attribution \u4ef7\u503c\u5206\u914d',color:'#059669',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
links:[
{href:'/concept-trust.html',text:'Attribution Ratio \u5f52\u56e0\u6bd4\u4f8b',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
{href:'/concept-business-value.html',text:'Commission \u4f63\u91d1',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22m-4-4l4 4 4-4"/><path d="M5 12h14"/></svg>'},
{href:'/ai-skills.html',text:'Revenue Track \u6536\u5165\u8ffd\u8e2a',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'}
]},
// ── 4. Settlement\uff08\u7ed3\u7b97\uff09\u7070\u8272 #64748B
{id:'settlement',label:'Settlement \u7ed3\u7b97',color:'#64748B',defaultOpen:false,icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
links:[
{href:'/sdk.html',text:'Commission History \u4f63\u91d1\u5386\u53f2',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'},
{href:'/agent-registry.html',text:'Agent Economy \u7ecf\u6d4e\u751f\u6001',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2"/></svg>'},
{href:'/faq.html',text:'FAQ \u5e38\u89c1\u95ee\u9898',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
]}
]
;

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
.nav-body>.nav-sec:first-child{border-top:none!important;margin-top:0!important;padding-top:0!important}\
.nav-sec-bd{overflow:hidden;max-height:0;transition:max-height .25s ease}\
.nav-sec-bd.open{max-height:1200px}\
.nav-link.active[data-group=fly]{color:#1A3D2E}.nav-link.active[data-group=fly]::before{background:#1A3D2E}.nav-link.active[data-group=fly] svg{color:#1A3D2E}\
.nav-link.active[data-group=source]{color:#1A3D2E}.nav-link.active[data-group=source]::before{background:#1A3D2E}.nav-link.active[data-group=source] svg{color:#1A3D2E}\
.nav-link.active[data-group=evidence]{color:#D97706}.nav-link.active[data-group=evidence]::before{background:#D97706}.nav-link.active[data-group=evidence] svg{color:#D97706}\
.nav-link.active[data-group=attribution]{color:#059669}.nav-link.active[data-group=attribution]::before{background:#059669}.nav-link.active[data-group=attribution] svg{color:#059669}\
.nav-link.active[data-group=settlement]{color:#64748B}.nav-link.active[data-group=settlement]::before{background:#64748B}.nav-link.active[data-group=settlement] svg{color:#64748B}\
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
