'use client';
import type {ClassroomPreviewModel} from './useClassroomPreview';
import css from './Classroom.module.css';

const tools=[{id:'off',label:'تحديد الآية',icon:'⌖'},{id:'pen',label:'قلم',icon:'✎'},
  {id:'marker',label:'تظليل',icon:'▰'},{id:'eraser',label:'ممحاة',icon:'⌫'}] as const;
const colors=['#d0a94c','#388e68','#e2604e','#397ca7','#8d67b0'] as const;

/** Always reachable palette; lifecycle and demo-only actions live in the session header. */
export function ClassroomControls({model}:{model:ClassroomPreviewModel}){
  const {role,room,inkMode,setInkMode,inkColor,setInkColor,drawingAvailable,setPage}=model;
  return <div className={css.toolbar} role="toolbar" aria-label="أدوات المصحف المشترك">
    <div className={css.toolGroup}>
      {tools.map(tool=><button key={tool.id} type="button" title={tool.label}
        aria-label={tool.label} aria-pressed={inkMode===tool.id}
        disabled={room.phase!=='live'||(tool.id!=='off'&&!drawingAvailable)}
        onClick={()=>setInkMode(tool.id)}>
        <span aria-hidden="true">{tool.icon}</span><span className={css.toolLabel}>{tool.label}</span>
      </button>)}
    </div>
    <div className={css.colors} role="group" aria-label="ألوان القلم">
      {colors.map(color=><button key={color} type="button" title={'لون '+color}
        className={inkColor===color?css.selectedColor:css.color} style={{background:color}}
        aria-label={'اختر لون '+color} aria-pressed={inkColor===color}
        disabled={room.phase!=='live'||!drawingAvailable} onClick={()=>setInkColor(color)}/>)}
    </div>
    <div className={css.toolGroup} role="group" aria-label="التنقل بين صفحات المصحف">
      <button type="button" aria-label="الصفحة السابقة" title="الصفحة السابقة"
        disabled={role!=='teacher'||room.phase!=='live'||room.currentPage<=1}
        onClick={()=>setPage(room.currentPage-1)}>‹</button>
      <span aria-live="polite">{room.currentPage} / 604</span>
      <button type="button" aria-label="الصفحة التالية" title="الصفحة التالية"
        disabled={role!=='teacher'||room.phase!=='live'||room.currentPage>=604}
        onClick={()=>setPage(room.currentPage+1)}>›</button>
    </div>
  </div>;
}
