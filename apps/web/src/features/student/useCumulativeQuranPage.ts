'use client';
import {useEffect,useMemo,useState} from 'react';
import {canonicalInk,fetchCumulativePage,type CumulativePage} from './cumulative-quran-client';
import type {QuranInkStroke} from './quranAnnotations';

const EMPTY:CumulativePage={marks:[],legacyInk:[]};
type State=Readonly<{learnerId:string;page:number;status:'loading'|'ready'|'failed';data:CumulativePage}>;
/** One owner-authorized page. No synthetic fallback or reuse after learner/page
 * switch: old sibling's marks are never rendered while the new read is pending.
 */
export function useCumulativeQuranPage(learnerId:string|undefined,page:number){
 const [state,setState]=useState<State|null>(null);
 useEffect(()=>{
  if(!learnerId)return;
  const controller=new AbortController();
  setState({learnerId,page,status:'loading',data:EMPTY});
  void fetchCumulativePage(learnerId,page,controller.signal).then(data=>{
   if(!controller.signal.aborted)setState({learnerId,page,status:'ready',data});
  }).catch(()=>{
   if(!controller.signal.aborted)setState({learnerId,page,status:'failed',data:EMPTY});
  });
  return()=>controller.abort();
 },[learnerId,page]);
 const current=state?.learnerId===learnerId&&state?.page===page?state:null;
 const data=current?.status==='ready'?current.data:EMPTY;
 const sharedInk=useMemo(()=>data.marks.filter(m=>m.audience==='shared')
  .map(canonicalInk).filter((m):m is QuranInkStroke=>m!==null),[data]);
 const academicNotes=useMemo(()=>data.marks.filter(m=>m.audience==='shared'&&
  m.visible&&(m.kind==='note'||m.kind==='highlight')&&m.surah!==null&&m.ayah!==null),[data]);
 return {status:!learnerId?'off':current?.status??'loading',sharedInk,academicNotes,
  legacyInk:data.legacyInk};
}
