
  (function(){
    'use strict';
    const $=id=>document.getElementById(id);
    const menuBtn=$('menuBtn'),nav=$('siteNav');
    menuBtn.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(open));menuBtn.setAttribute('aria-label',open?'إغلاق القائمة':'فتح القائمة')});
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')}));
    document.getElementById('year').textContent=new Date().getFullYear();

    // Smooth section navigation: clicking any CTA scrolls instead of opening a premature booking flow.
    // Browsers with reduced-motion preference receive immediate scrolling.
    document.querySelectorAll('a[href^="#"]').forEach(anchor=>anchor.addEventListener('click',event=>{
      const hash=anchor.getAttribute('href');
      if(!hash||hash==='#')return;
      const target=document.getElementById(hash.slice(1));
      if(!target)return;
      event.preventDefault();
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
      history.replaceState(null,'',hash);
      if(target.id==='enroll'){
        const formCard=$('registrationForm');
        formCard.classList.remove('scroll-spotlight');
        void formCard.offsetWidth;
        formCard.classList.add('scroll-spotlight');
        formCard.addEventListener('animationend',()=>formCard.classList.remove('scroll-spotlight'),{once:true});
      }
    }));

    // Classroom interactive annotation DEMO. No data is transmitted or persisted.
    let tool='highlight',canvas=$('drawingCanvas'),ctx=canvas.getContext('2d'),drawing=false,last=null,selectedVerse=null;
    function resizeBoard(){ const old=canvas.toDataURL();const r=canvas.getBoundingClientRect(); if(r.width<1)return;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.strokeStyle='#b18327';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=3.2; if(old&&old!=='data:,'){const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,r.width,r.height)};image.src=old;}}
    requestAnimationFrame(resizeBoard);window.addEventListener('resize',()=>{clearTimeout(window.noorResize);window.noorResize=setTimeout(resizeBoard,180)});
    function setTool(next){ if(next==='clear'){$('verseWords').querySelectorAll('.ayah').forEach(a=>a.classList.remove('marked','selected'));ctx.clearRect(0,0,canvas.width,canvas.height);$('lessonNotes').replaceChildren();selectedVerse=null;setTool('highlight');return;}
      tool=next; document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===next));canvas.classList.toggle('ink-enabled',next==='pen');$('boardHelper').textContent=next==='pen'?'ارسم بالقلم فوق المصحف بإصبعك أو بالماوس؛ الرسم هنا تجريبي فقط.':next==='highlight'?'اضغط على أي آية لتظليلها.':'اضغط على الآية المطلوبة، ثم اكتب تعليقك على اليمين.'; }
    document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
    function verseClick(el){if(tool==='highlight'){el.classList.toggle('marked');}else if(tool==='note'){document.querySelectorAll('.ayah').forEach(a=>a.classList.remove('selected'));el.classList.add('selected');selectedVerse=el.textContent.trim();$('lessonNoteText').focus();}}
    document.querySelectorAll('.ayah').forEach(v=>{v.addEventListener('click',()=>verseClick(v));v.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();verseClick(v)}})});
    function position(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
    canvas.addEventListener('pointerdown',e=>{if(tool!=='pen')return;drawing=true;last=position(e);canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.arc(last.x,last.y,1.7,0,Math.PI*2);ctx.fillStyle='#b18327';ctx.fill()});
    canvas.addEventListener('pointermove',e=>{if(!drawing||tool!=='pen')return;const p=position(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p});
    ['pointerup','pointercancel','lostpointercapture'].forEach(n=>canvas.addEventListener(n,()=>drawing=false));
    $('addNote').addEventListener('click',()=>{const value=$('lessonNoteText').value.trim();if(!value){$('lessonNoteText').focus();return} const container=document.createElement('div');container.className='note-entry';const who=document.createElement('b');who.textContent=$('noteAuthor').value;const content=document.createElement('span');content.textContent=(selectedVerse?'«'+selectedVerse+'»: ':'')+value;container.append(who,content);$('lessonNotes').append(container);$('lessonNoteText').value='';});
    $('printBoard').addEventListener('click',()=>window.print());

    // Registration-first flow: temporary on-device mock only (no API and no fake real booking).
    const registration=$('registrationForm'),modal=$('dashboardModal');let students=[],activeStudent='',bookings={};
    function toggleSibling(){const child=registration.querySelector('[name=learnerType]:checked').value==='child';$('siblingsArea').hidden=!child;$('learnerNameLabel').textContent=child?'اسم الطفل الأول':'اسم الطالب';$('parentPhoneLabel').innerHTML=(child?'رقم موبايل ولي الأمر':'رقم الموبايل')+' <span class="required-mark" aria-hidden="true">*</span>'; }
    registration.querySelectorAll('[name=learnerType]').forEach(el=>el.addEventListener('change',toggleSibling));toggleSibling();
    $('addSiblingBtn').addEventListener('click',()=>{const box=document.createElement('div');box.className='sibling-field';const input=document.createElement('input');input.setAttribute('aria-label','اسم الطفل الإضافي');input.placeholder='اسم الطفل الآخر';input.maxLength=50;const del=document.createElement('button');del.type='button';del.textContent='حذف';del.addEventListener('click',()=>box.remove());box.append(input,del);$('siblingList').append(box);input.focus()});
    function studentSelection(){ $('createdProfiles').replaceChildren();students.forEach(n=>{const b=document.createElement('button');b.type='button';b.className='profile-btn'+(n===activeStudent?' active':'');b.textContent=n;b.addEventListener('click',()=>{activeStudent=n;studentSelection();changeTab('home')});$('createdProfiles').append(b)}); $('modalTitle').textContent='لوحة '+activeStudent;$('classesText').textContent=bookings[activeStudent]?'لديك حصة تجريبية توضيحية في '+bookings[activeStudent]:'ليس لديك موعد بعد. اختر موعدًا تجريبيًا داخل هذه المعاينة.';$('bookingStatus').textContent=bookings[activeStudent]?'موعد محفوظ للعرض فقط: '+bookings[activeStudent]:'اختر موعدًا تجريبيًا — كل المواعيد افتراضية.';document.querySelectorAll('#mockSlots button').forEach(b=>b.classList.toggle('selected',b.dataset.slot===bookings[activeStudent])); }
    function changeTab(id){document.querySelectorAll('#modalTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.modal-panels [data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===id));}
    registration.addEventListener('submit',e=>{e.preventDefault();if(!registration.reportValidity())return;const main=$('learnerName').value.trim();const extra=[...$('siblingList').querySelectorAll('input')].map(e=>e.value.trim()).filter(Boolean);students=[...new Set([main,...extra])];activeStudent=students[0];bookings={};$('modalWelcome').textContent='مرحبًا '+$('accountName').value.trim()+'! أنشأنا لك لوحة تجريبية محلية. يمكنك التبديل بين الطلاب واستكشاف الصفحات قبل الحجز.';studentSelection();changeTab('home');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('closeModal').focus()});
    function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';}
    $('closeModal').addEventListener('click',closeModal);modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();nav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')}});
    $('modalTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)changeTab(b.dataset.tab)});
    $('homeBookBtn').addEventListener('click',()=>changeTab('classes'));
    $('mockSlots').addEventListener('click',e=>{const b=e.target.closest('button[data-slot]');if(!b)return;bookings[activeStudent]=b.dataset.slot;studentSelection();});
    $('openClassDemoFromModal').addEventListener('click',()=>{closeModal();});
  })();
  