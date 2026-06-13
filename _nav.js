function switchRail(id){
  document.querySelectorAll('.rail-icon[data-sec]').forEach(i=>i.classList.remove('active'));
  document.querySelector('.rail-icon[data-sec="'+id+'"]')?.classList.add('active');
  document.querySelectorAll('.nav-list-body .nav-sec').forEach(s=>s.style.display='none');
  document.getElementById(id)?.style&&(document.getElementById(id).style.display='block');
}
function toggleSec(el){
  el.classList.toggle('open');
  el.nextElementSibling.classList.toggle('open');
}
function toggleTrustNav(e){
  e.preventDefault();
  const arr=e.currentTarget.querySelector('.sarr');
  const sub=e.currentTarget.nextElementSibling;
  if(sub&&sub.classList.contains('nav-sub2')){arr?.classList.toggle('open');sub.classList.toggle('open')}
}
function goSub(id,el){
  event.preventDefault();
  document.querySelectorAll('.nav-sub2 .nav-link').forEach(l=>l.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
}
