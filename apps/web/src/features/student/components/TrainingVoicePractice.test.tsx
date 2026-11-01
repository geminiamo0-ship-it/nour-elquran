import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TrainingVoicePractice} from './TrainingVoicePractice';
import {LOCAL_REHEARSAL_MAX_BYTES,LOCAL_REHEARSAL_MAX_MS,
 localRehearsalLimit} from './local-rehearsal-limits';

describe('privacy bounded browser-only recitation (#245)',()=>{
 it('never overflows the 8 MiB budget even for a single huge recorder chunk',()=>{
  const max=LOCAL_REHEARSAL_MAX_BYTES;
  expect(localRehearsalLimit(0,max,1000)).toBe('ok');
  expect(localRehearsalLimit(max,0,1000)).toBe('ok');
  expect(localRehearsalLimit(max-1,1,1000)).toBe('ok');
  expect(localRehearsalLimit(max-1,2,1000)).toBe('too_large');
  expect(localRehearsalLimit(0,max+1,1000)).toBe('too_large');
  expect(localRehearsalLimit(max,1,1000)).toBe('too_large');
 });
 it('limits background-tab recordings and rejects malformed elapsed time/size',()=>{
  expect(localRehearsalLimit(0,1,LOCAL_REHEARSAL_MAX_MS)).toBe('ok');
  expect(localRehearsalLimit(0,1,LOCAL_REHEARSAL_MAX_MS+1)).toBe('too_long');
  for(const value of [NaN,Infinity,-1]){
   expect(localRehearsalLimit(0,1,value)).toBe('invalid');
  }
  for(const value of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
   expect(localRehearsalLimit(value,1,100)).toBe('invalid');
   expect(localRehearsalLimit(1,value,100)).toBe('invalid');
  }
 });
 it('shows truthful local-only rehearsal and manual microphone prompt, no upload button',()=>{
  const html=renderToStaticMarkup(<TrainingVoicePractice/>);
  expect(html).toContain('تسميع ذاتي اختياري');
  expect(html).toContain('داخل هذا الجهاز فقط');
  expect(html).toContain('تسجيل تلاوة جديدة');
  expect(html).toContain('لا يتم رفعها للشيخ');
  expect(html).toContain('٨ ميجابايت');
  expect(html).not.toContain('إرسال للشيخ');
  expect(html).not.toContain('تم الرفع');
 });
});
