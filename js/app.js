/* Clinical Journal interaction layer — vanilla JavaScript + Bootstrap modal. */
(function(){
  'use strict';
  const portfolio=window.PORTFOLIO,photoMap=window.PHOTO_DATA;
  const $=(sel)=>document.querySelector(sel);
  const photoSrc=id=>photoMap[String(id)];
  const pad=id=>String(id).padStart(2,'0');
  const escapeHTML=value=>String(value).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  const allPhotos=portfolio.weeks.flatMap(w=>w.photos.map((id,i)=>({id,week:w,caption:w.captions[i]||'Clinical photograph'})));
  let activeWeek=1,viewedPhotos=allPhotos,currentPhoto=0,toastTimer=0;
  const photoModal=bootstrap.Modal.getOrCreateInstance($('#photoModal'));

  $('#heroMainImg').src=photoSrc(3);
  $('#heroInsetImg').src=photoSrc(1);
  $('#purposeText').textContent=portfolio.purpose;
  $('#goalText').textContent=portfolio.goal;
  $('#conclusionText').textContent=portfolio.conclusion;

  function weekButton(w){return `<button type="button" role="option" aria-selected="${w.id===activeWeek}" data-week="${w.id}" class="week-tab${w.id===activeWeek?' active':''}"><span class="week-tab-num">${pad(w.id)}</span><span class="week-tab-copy"><strong>${escapeHTML(w.short)}</strong><small>WEEK ${pad(w.id)}</small></span><svg class="icon week-tab-arrow"><use href="#ico-chevron"/></svg></button>`;}
  function renderWeekList(query=''){
    const term=query.trim().toLowerCase();
    const matching=portfolio.weeks.filter(w=>(w.title+' '+w.short+' '+w.category+' '+w.focus.join(' ')+' '+w.description).toLowerCase().includes(term));
    $('#weekList').innerHTML=matching.map(weekButton).join('');
    $('#weekResultsCount').textContent=pad(matching.length)+' WEEKS';
    $('#weekNoResults').hidden=matching.length!==0;
    $('#weekList').querySelectorAll('[data-week]').forEach(b=>b.addEventListener('click',()=>setWeek(Number(b.dataset.week),true)));
  }
  function photoButton(id,caption,index){
    return `<button type="button" class="detail-photo" data-detail-photo="${index}" aria-label="Open photo ${pad(id)}: ${escapeHTML(caption)}"><img src="${photoSrc(id)}" loading="lazy" alt="${escapeHTML(caption)}"><span>PHOTO ${pad(id)}</span></button>`;
  }
  function setWeek(id,scrollMobile=false){
    const w=portfolio.weeks.find(w=>w.id===id);if(!w)return;
    activeWeek=w.id;
    $('#detailIndex').innerHTML='WEEK '+pad(w.id)+' <span>/ 08</span>';
    $('#detailCategory').textContent=w.category;
    $('#detailTitle').textContent=w.title;
    $('#detailSummary').textContent=w.summary;
    $('#detailDescription').textContent=w.description;
    $('#detailFocus').innerHTML=w.focus.map(f=>'<span class="focus-chip">'+escapeHTML(f)+'</span>').join('');
    $('#detailPhotoCount').textContent=w.photos.length+' photograph'+(w.photos.length!==1?'s':'')+' in this rotation';
    $('#detailPhotos').innerHTML=w.photos.map((id,i)=>photoButton(id,w.captions[i]||'Clinical photograph',i)).join('');
    $('#detailPhotos').querySelectorAll('[data-detail-photo]').forEach(b=>b.addEventListener('click',()=>openPhoto(w.photos.map((id,i)=>({id,week:w,caption:w.captions[i]||'Clinical photograph'})),Number(b.dataset.detailPhoto))));
    const note=$('#detailNote');note.hidden=!w.note;note.textContent=w.note||'';
    $('#prevWeek').disabled=w.id===1;$('#nextWeek').disabled=w.id===8;
    renderWeekList($('#weekSearch').value);
    if(scrollMobile&&window.innerWidth<=700){$('#weekDetail').scrollIntoView({behavior:'smooth',block:'start'});}
  }
  $('#weekSearch').addEventListener('input',e=>renderWeekList(e.target.value));
  $('#prevWeek').addEventListener('click',()=>setWeek(activeWeek-1));
  $('#nextWeek').addEventListener('click',()=>setWeek(activeWeek+1));
  $('#weekPdfButton').addEventListener('click',()=>window.ExportDialog.open(activeWeek));
  $('#detailViewAll').addEventListener('click',()=>{$('#galleryFilter').value=String(activeWeek);renderGallery();$('#gallery').scrollIntoView({behavior:'smooth'});});

  const galleryFilter=$('#galleryFilter');
  portfolio.weeks.forEach(w=>galleryFilter.add(new Option('Week '+pad(w.id)+' — '+w.short,String(w.id))));
  function renderGallery(){
    const val=galleryFilter.value;
    viewedPhotos=val==='all'?allPhotos:allPhotos.filter(p=>p.week.id===Number(val));
    $('#galleryCount').textContent=pad(viewedPhotos.length);
    $('#galleryGrid').innerHTML=viewedPhotos.map((p,i)=>`<button class="gallery-tile" type="button" data-gallery-photo="${i}" aria-label="Open ${escapeHTML(p.caption)}"><img src="${photoSrc(p.id)}" loading="lazy" alt="${escapeHTML(p.caption)}"><span class="gallery-tile-wash"></span><span class="gallery-zoom"><svg class="icon"><use href="#ico-arrow-up-right"/></svg></span><span class="gallery-tile-info"><small>WEEK ${pad(p.week.id)} / PHOTO ${pad(p.id)}</small><strong>${escapeHTML(p.caption)}</strong></span></button>`).join('');
    $('#galleryGrid').querySelectorAll('[data-gallery-photo]').forEach(b=>b.addEventListener('click',()=>openPhoto(viewedPhotos,Number(b.dataset.galleryPhoto))));
  }
  galleryFilter.addEventListener('change',renderGallery);
  function openPhoto(collection,index){
    viewedPhotos=collection;currentPhoto=index;renderLightbox();photoModal.show();
  }
  function renderLightbox(){
    const p=viewedPhotos[currentPhoto];if(!p)return;
    $('#lightboxImg').src=photoSrc(p.id);$('#lightboxImg').alt=p.caption;
    $('#lightboxCounter').textContent=pad(currentPhoto+1)+' / '+pad(viewedPhotos.length);
    $('#lightboxWeek').textContent='WEEK '+pad(p.week.id)+' · '+p.week.short.toUpperCase();
    $('#lightboxTitle').textContent=p.caption;$('#lightboxSubtitle').textContent='Clinical photograph '+pad(p.id)+' · '+portfolio.clinic.name;
    $('#lightboxPrev').disabled=viewedPhotos.length<2;$('#lightboxNext').disabled=viewedPhotos.length<2;
  }
  function changeLightbox(delta){if(viewedPhotos.length<2)return;currentPhoto=(currentPhoto+delta+viewedPhotos.length)%viewedPhotos.length;renderLightbox();}
  $('#lightboxPrev').addEventListener('click',()=>changeLightbox(-1));$('#lightboxNext').addEventListener('click',()=>changeLightbox(1));
  document.addEventListener('keydown',e=>{
    if(!$('#photoModal').classList.contains('show'))return;
    if(e.key==='ArrowRight'){e.preventDefault();changeLightbox(1);}
    if(e.key==='ArrowLeft'){e.preventDefault();changeLightbox(-1);}
  });
  $('#lightboxSave').addEventListener('click',()=>{
    const p=viewedPhotos[currentPhoto],a=document.createElement('a');a.href=photoSrc(p.id);a.download=portfolio.student.name.replace(/[^A-Za-z0-9]+/g,'_')+'_Clinical_Photo_'+pad(p.id)+'.jpg';document.body.append(a);a.click();a.remove();showAppToast('Photo saved','Photo '+pad(p.id)+' has been downloaded.');
  });

  const weeklyList=$('#pdfWeekList');
  weeklyList.innerHTML=portfolio.weeks.map(w=>`<div class="pdf-week-row"><div class="pdf-week-info"><span class="pdf-week-index">${pad(w.id)}</span><div><strong>${escapeHTML(w.title)}</strong><small>${w.photos.length} PHOTOGRAPH${w.photos.length>1?'S':''} · CLINICAL NOTES</small></div></div><button type="button" data-download="${w.id}" class="pdf-week-action"><svg class="icon"><use href="#ico-download"/></svg>Download PDF</button></div>`).join('');
  document.querySelectorAll('[data-download]').forEach(b=>b.addEventListener('click',()=>window.ExportDialog.open(b.dataset.download)));

  function showAppToast(title,description,isError=false){
    $('#toastTitle').textContent=title;$('#toastMessage').textContent=description;
    const icon=$('.toast-icon');icon.style.color=isError?'#ad694c':'';icon.style.background=isError?'#fff0e7':'';
    $('#appToast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#appToast').classList.remove('show'),4600);
  }
  window.showAppToast=showAppToast;
  $('#toastClose').addEventListener('click',()=>$('#appToast').classList.remove('show'));

  const sidebar=$('#appSidebar'),backdrop=$('#sidebarBackdrop'),menuButton=$('#menuButton');
  function closeMenu(){sidebar.classList.remove('open');backdrop.classList.remove('show');menuButton.setAttribute('aria-expanded','false');}
  menuButton.addEventListener('click',()=>{const open=sidebar.classList.toggle('open');backdrop.classList.toggle('show',open);menuButton.setAttribute('aria-expanded',String(open));});
  backdrop.addEventListener('click',closeMenu);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('open'))closeMenu();});
  document.querySelectorAll('.side-link').forEach(a=>a.addEventListener('click',closeMenu));
  const toTop=$('#toTop');
  toTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  window.addEventListener('scroll',()=>toTop.classList.toggle('visible',window.scrollY>700),{passive:true});
  const sections=[...document.querySelectorAll('main section[id]')];
  if('IntersectionObserver' in window){
    const animationObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');animationObserver.unobserve(e.target);}}),{threshold:.08,rootMargin:'0px 0px -26px 0px'});
    document.querySelectorAll('.reveal').forEach(el=>animationObserver.observe(el));
    const navObserver=new IntersectionObserver(entries=>{
      entries.filter(e=>e.isIntersecting).forEach(e=>{
        document.querySelectorAll('.side-link').forEach(a=>a.classList.toggle('is-active',a.hash==='#'+e.target.id));
      });
    },{rootMargin:'-20% 0px -65% 0px',threshold:0});
    sections.forEach(el=>navObserver.observe(el));
  }else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));}
  // Load a specific rotation through ?week=1…8, useful for sharing a direct link.
  const requested=Number(new URLSearchParams(location.search).get('week'));
  setWeek(requested>=1&&requested<=8?requested:1);renderGallery();
})();
