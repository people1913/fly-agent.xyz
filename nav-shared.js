/**
 * Fly 官网共享侧边栏
 * 自动：注入HTML、CSS、根据URL设active、恢复折叠、绑定事件
 */
(function(){
var sections=[
{id:'product',label:'产品',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="12" y="2" width="8" height="8" rx="1"/><rect x="2" y="12" width="8" height="8" rx="1"/><rect x="12" y="12" width="8" height="8" rx="1"/></svg>',
links:[
{href:'/signal-flow.html',text:'Signal Flow',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="4" height="4" rx=".5"/><rect x="10" y="2" width="4" height="4" rx=".5"/><rect x="18" y="2" width="4" height="4" rx=".5"/><rect x="2" y="10" width="4" height="4" rx=".5"/><rect x="10" y="10" width="4" height="4" rx=".5"/><rect x="18" y="10" width="4" height="4" rx=".5"/><line x1="6" y1="4" x2="10" y2="4"/><line x1="14" y1="4" x2="18" y2="4"/><line x1="4" y1="6" x2="4" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/><line x1="20" y1="6" x2="20" y2="10"/></svg>'},
{href:'/audit.html',text:'沙盒验证',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 12 10 15 17 8"/></svg>'},
{href:'/verification-layer.html',text:'验证层',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v5c0 5 3.5 9.7 9 11 5.5-1.3 9-6 9-11V7l-9-5z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="12" y1="9" x2="12" y2="15"/></svg>'},
{href:'/dashboard.html',text:'运行时',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="12" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><rect x="2" y="18" width="8" height="4" rx="1"/></svg>'},
{href:'/gateway.html',text:'网关',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="6" rx="1.5"/><rect x="2" y="15" width="20" height="6" rx="1.5"/><circle cx="6" cy="6" r="1.2" fill="currentColor"/><circle cx="6" cy="18" r="1.2" fill="currentColor"/></svg>'},
{href:'/agent-registry.html',text:'Agent注册',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2.5"/><line x1="14" y1="7" x2="18" y2="7"/><line x1="14" y1="11" x2="18" y2="11"/><line x1="5" y1="17" x2="19" y2="17"/></svg>'}
]},
{id:'support',label:'支持',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
links:[
{href:'/trust.html',text:'信任中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v5c0 5 3.5 9.7 9 11 5.5-1.3 9-6 9-11V7l-9-5z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>'},
{href:'/security.html',text:'安全中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0110 0v3"/><circle cx="12" cy="16" r="1.5"/></svg>'},
{href:'/enterprise.html',text:'企业版',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>'},
{href:'#',text:'文档',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="14" height="20" rx="2"/><line x1="8" y1="7" x2="14" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>'}
]},
{id:'compliance',label:'合规',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>',
links:[
{href:'/compliance.html',text:'合规中心',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>'},
{href:'/privacy.html',text:'隐私政策',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 01-4.24-4.24"/></svg>'},
{href:'/refund.html',text:'退款政策',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'},
{href:'/terms.html',text:'服务条款',icon:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'}
]},
{id:'channel',label:'渠道',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
links:[
{href:'/channel-douyin.html',text:'抖音',icon:'🎵'},
{href:'/channel-xiaohongshu.html',text:'小红书',icon:'📕'},
{href:'/channel-wechat.html',text:'微信',icon:'💬'},
{href:'/channel-meituan.html',text:'美团',icon:'💈'},
{href:'/channel-feishu.html',text:'飞书',icon:'✈'},
{href:'/channel-ai-search.html',text:'AI搜索推荐',icon:'🔍'},
{href:'/channel-coze.html',text:'扣子',icon:'🎖'},
{href:'/channel-clawhub.html',text:'ClawHub',icon:'🔧'},
{href:'/channel-other.html',text:'其他',icon:'☁'}
]},
{id:'industry',label:'行业',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
links:[
{href:'/industry-beauty.html',text:'医美',icon:'⚕'},
{href:'/industry-local.html',text:'本地生活',icon:'🏪'},
{href:'/industry-education.html',text:'教培',icon:'📚'},
{href:'/industry-highticket.html',text:'高客单',icon:'💎'}
]}
];

var path=window.location.pathname;

function buildNav(){
var h='<aside class="nav"><div class="nav-list">';
h+='<div class="nav-logo" onclick="if(this.parentElement.classList.contains(\'collapsed\'))FlyNav.toggle()">';
h+='<div class="nav-logo-left"><span class="nav-logo-mark">F</span><span class="nav-logo-text">Fly</span></div>';
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
h+='<a href="'+l.href+'" class="nav-link'+(act?' active':'')+'">';
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
.nav-list{width:var(--nav-w);display:flex;flex-direction:column;overflow-y:auto;background:var(--bg);border-right:1px solid var(--border);transition:width .2s ease;scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.08) transparent}\
.nav-list::-webkit-scrollbar{width:4px}\
.nav-list::-webkit-scrollbar-track{background:transparent}\
.nav-list::-webkit-scrollbar-thumb{background:rgba(0,0,0,.08);border-radius:2px}\
.nav-list::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.15)}\
.nav-logo{display:flex;align-items:center;gap:8px;padding:14px 16px;font-size:13px;font-weight:700;color:var(--dark);border-bottom:1px solid var(--border);letter-spacing:-.3px;white-space:nowrap;overflow:hidden;transition:padding .2s}\
.nav-logo-mark{display:none;width:28px;height:28px;border-radius:6px;background:var(--deep-green);color:#fff;font-size:15px;font-weight:800;line-height:28px;text-align:center;flex-shrink:0}\
.nav-logo-left{display:flex;align-items:center;gap:8px}\
.nav-list.collapsed{width:var(--nav-w-c)}\
.nav-list.collapsed .nav-logo{padding:12px 4px;justify-content:center;overflow:hidden;cursor:pointer;transition:background .15s;flex-direction:column;gap:2px}\
.nav-list.collapsed .nav-logo-mark{display:block}\
.nav-list.collapsed .nav-logo-text{display:block;font-size:12px;white-space:nowrap}\
.nav-list.collapsed .nav-logo:hover{background:var(--bg3)}\
.nav-list.collapsed .nav-link span{display:none}\
.nav-list.collapsed .nav-sec-hd{display:none}\
.nav-list.collapsed .nav-sec-bd{display:block!important;max-height:none!important;overflow:visible}\
.nav-list.collapsed .nav-sec-bd.open{max-height:none!important}\
.nav-list.collapsed .nav-link{justify-content:center;padding:7px 0;margin-right:0;border-radius:6px;margin:0 6px}\
.nav-list.collapsed .nav-sec-bd{padding-top:4px}\
.nav-list.collapsed .nav-link.active::before{display:none}\
.nav-list.collapsed .nav-link.active::after{content:"";position:absolute;left:2px;top:4px;bottom:4px;width:3px;background:var(--deep-green);border-radius:0 2px 2px 0}\
.nav-toggle{display:flex;align-items:center;justify-content:center;padding:4px;border-radius:4px;cursor:pointer;color:var(--text4);transition:color .15s,background .15s;flex-shrink:0}\
.nav-list.collapsed .nav-toggle{display:flex;position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:32px;height:32px;justify-content:center;align-items:center;border-radius:6px;background:var(--bg3);cursor:pointer}\
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
.nav-link svg{flex-shrink:0;opacity:.55;transition:opacity .15s}\
.nav-link:hover svg{opacity:.9}\
.nav-link.active svg{opacity:1;color:var(--deep-green)}\
.nav-link span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.nav-link .nav-emoji{font-style:normal}\
.nav-list.collapsed .nav-link .nav-emoji{display:inline}\
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
';
document.head.appendChild(cs);
})();
