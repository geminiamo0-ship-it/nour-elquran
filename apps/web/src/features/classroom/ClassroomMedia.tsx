'use client';
import {useRef,useState,type PointerEvent} from 'react';
import type {ClassroomPreviewModel} from './useClassroomPreview';
import css from './Classroom.module.css';

function VideoCard({label,details,kind}:{label:string;details:string;kind:'student'|'teacher'}){
  return <div className={css.videoCard} data-video-role={kind}>
    <div className={css.videoBackdrop}><span aria-hidden="true">◉</span><strong>{label}</strong><small>{details}</small></div>
    <div className={css.videoFooter}><span className={css.liveDot}/> {kind==='student'?'كاميرا الطالب':'كاميرا الشيخ'} · معاينة بدون بث</div>
  </div>;
}
export function ClassroomMedia({model}:{model:ClassroomPreviewModel}){
  const {role,room,teacherCamera,selfPreview,setSelfPreview,setTeacherCamera}=model;
  const [floating,setFloating]=useState(false);
  const [position,setPosition]=useState({x:18,y:95});
  const drag=useRef<{pointerId:number;initialX:number;initialY:number;x:number;y:number}|null>(null);
  const participantIsStudent=role==='teacher';
  const remoteVisible=participantIsStudent?room.learnerPresent:room.teacherPresent;
  const remoteName=participantIsStudent?'الطالب التجريبي':'الشيخ التجريبي';
  function down(event:PointerEvent<HTMLDivElement>){
    if(!floating||!event.isPrimary||event.pointerType==='mouse'&&event.button!==0)return;
    drag.current={pointerId:event.pointerId,initialX:event.clientX,initialY:event.clientY,x:position.x,y:position.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event:PointerEvent<HTMLDivElement>){
    const d=drag.current;if(!d||event.pointerId!==d.pointerId)return;
    setPosition({x:Math.max(0,d.x-(event.clientX-d.initialX)),
      y:Math.max(60,d.y+(event.clientY-d.initialY))});
  }
  function up(event:PointerEvent<HTMLDivElement>){
    if(drag.current?.pointerId===event.pointerId)drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const remote=<div className={floating?css.floatingVideo:css.dockedVideo}
    style={floating?{right:position.x,top:position.y}:undefined}>
    <div className={css.videoTitle} onPointerDown={down} onPointerMove={move}
      onPointerUp={up} onPointerCancel={()=>{drag.current=null;}}>
      <span>{participantIsStudent?'فيديو الطالب':'فيديو الشيخ'}</span>
      <button type="button" className={css.videoMove} onClick={()=>setFloating(v=>!v)}>
        {floating?'إعادة للجانب':'نافذة عائمة'}
      </button>
    </div>
    {remoteVisible?<VideoCard label={remoteName} details="لم تُربط خدمة LiveKit بعد"
      kind={participantIsStudent?'student':'teacher'}/>:
      <div className={css.videoOffline}>◌<strong>{remoteName} غير متصل</strong><span>لن يتم افتراض بث أو حضور.</span></div>}
  </div>;
  return <aside className={css.mediaPanel} aria-label="لوحة فيديو المشاركين">
    <header className={css.mediaHead}><strong>المشاركون</strong><span>غرفة عرض فقط</span></header>
    {remote}
    {role==='teacher'&&<div className={css.selfPreview}>
      <div className={css.videoTitle}><span>معاينتي</span>
        <button type="button" className={css.videoMove} onClick={()=>setSelfPreview(!selfPreview)}>
          {selfPreview?'إخفاء المعاينة':'إظهار المعاينة'}
        </button>
      </div>
      {selfPreview?(teacherCamera?<VideoCard label="الشيخ التجريبي" details="معاينة شخصية غير متصلة" kind="teacher"/>:
      <div className={css.videoOffline}>الكاميرا مغلقة في المعاينة</div>):
      <p className={css.hint}>المعاينة مخفية محليًا فقط. إخفاؤها لا يطفئ كاميرا الشيخ عند الربط الحقيقي.</p>}
      <button type="button" className={css.linkControl} onClick={()=>setTeacherCamera(!teacherCamera)}>
        {teacherCamera?'إيقاف الكاميرا (محاكاة)':'تشغيل الكاميرا (محاكاة)'}
      </button>
    </div>}
    <div className={css.deviceNotice}>لا توجد كاميرات أو ميكروفونات حقيقية متصلة في هذه المعاينة. التحكم في الإرسال سيُربط بأذونات الجهاز وLiveKit بعد اختبار الصلاحيات.</div>
  </aside>;
}
