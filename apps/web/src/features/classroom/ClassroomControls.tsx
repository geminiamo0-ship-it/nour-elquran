'use client';
import type {ClassroomPreviewModel} from './useClassroomPreview';
import css from './Classroom.module.css';

const tools=[{id:'off',label:'تحديد الآية',icon:'⌖'},{id:'pen',label:'قلم',icon:'✎'},
  {id:'marker',label:'تظليل',icon:'▰'},{id:'eraser',label:'ممحاة',icon:'⌫'}] as const;
const colors=[{hex:'#d0a94c',name:'ذهبي'},{hex:'#388e68',name:'أخضر'},
  {hex:'#e2604e',name:'أحمر'},{hex:'#397ca7',name:'أزرق'},
  {hex:'#8d67b0',name:'بنفسجي'}] as const;

/** Always reachable palette; lifecycle and demo-only actions live in the session header. */
export function ClassroomControls({model}:{model:ClassroomPreviewModel}){
  const {role,room,inkMode,setInkMode,inkColor,setInkColor,drawingAvailable,setPage}=model;
  return <div className={css.toolbar} role="toolbar" aria-label="أدوات المصحف المشترك">
    <div className={css.inkPalette} aria-label="القلم والألوان">
      <div className={css.toolGroup}>
      {tools.map(tool=><button key={tool.id} type="button" title={tool.label}
        aria-label={tool.label} aria-pressed={inkMode===tool.id}
        disabled={room.phase!=='live'||(tool.id!=='off'&&!drawingAvailable)}
        onClick={()=>setInkMode(tool.id)}>
        <span aria-hidden="true">{tool.icon}</span><span className={css.toolLabel}>{tool.label}</span>
      </button>)}
      </div>
    <div className={css.colors} role="group" aria-label="ألوان القلم">
      {colors.map(({hex,name})=><button key={hex} type="button" title={'لون '+name}
        className={inkColor===hex?css.selectedColor:css.color} style={{background:hex}}
        aria-label={'اختر لون '+name} aria-pressed={inkColor===hex}
        disabled={room.phase!=='live'||!drawingAvailable} onClick={()=>setInkColor(hex)}/>)}
    </div>
    </div>
    <div className={[css.toolGroup,css.pageNavigation].join(' ')} role="group" aria-label="التنقل بين صفحات المصحف">
      <button type="button" aria-label="الصفحة السابقة" title="الصفحة السابقة"
        disabled={role!=='teacher'||room.phase!=='live'||room.currentPage<=1}
        onClick={()=>setPage(room.currentPage-1)}><span aria-hidden="true">‹</span></button>
      <span aria-live="polite">{room.currentPage} / 604</span>
      <button type="button" aria-label="الصفحة التالية" title="الصفحة التالية"
        disabled={role!=='teacher'||room.phase!=='live'||room.currentPage>=604}
        onClick={()=>setPage(room.currentPage+1)}><span aria-hidden="true">›</span></button>
    </div>
  </div>;
}
