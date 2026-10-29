'use client';
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import type {QuranAnnotation,QuranInkStroke,QuranTarget} from './quranAnnotations';
import {privateMushafClient,asInk,asPrivateNote,type PrivateAction,
  type PrivateItemKind,type PrivateOperation} from './private-mushaf-client';

type SyncState='off'|'loading'|'saved'|'pending'|'failed';
type Job=Omit<PrivateOperation,'operationId'|'expectedVersion'> & {
 operationId:string;expectedVersion?:number;
};
type Props={
 learnerId:string;enabled:boolean;page:number;
 setPage:(value:number)=>void;setPageEntry:(value:string)=>void;
 setNotes:Dispatch<SetStateAction<QuranAnnotation[]>>;
 setInkByPage:Dispatch<SetStateAction<Record<number,QuranInkStroke[]>>>;
 setBookmarks:Dispatch<SetStateAction<number[]>>;
};
export function usePrivateMushafSave({
 learnerId,enabled,page,setPage,setPageEntry,setNotes,setInkByPage,setBookmarks,
}:Props){
 const [status,setStatus]=useState<SyncState>(enabled?'loading':'off');
 const [indexReady,setIndexReady]=useState(!enabled);
 const [pageReady,setPageReady]=useState(!enabled);
 const [error,setError]=useState('');
 const versions=useRef<Record<string,number>>({});
 const queue=useRef<Job[]>([]);
 const running=useRef(false),failed=useRef(false),mounted=useRef(true);

 useEffect(()=>{
  mounted.current=true;
  return ()=>{mounted.current=false;};
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  versions.current={};queue.current=[];failed.current=false;
  setIndexReady(false);setStatus('loading');setError('');
  const controller=new AbortController();
  void privateMushafClient.index(learnerId,controller.signal).then(items=>{
   if(controller.signal.aborted)return;
   for(const item of items)versions.current[item.itemId]=item.version;
   setNotes(items.map(item=>asPrivateNote(item,learnerId)).filter(
     (note):note is QuranAnnotation=>note!==null));
   setBookmarks(items.filter(i=>i.kind==='bookmark').map(i=>i.page).sort((a,b)=>a-b));
   const position=items.find(i=>i.kind==='position');
   if(position){setPage(position.page);setPageEntry(String(position.page));}
   setIndexReady(true);
  }).catch(()=>{
   if(!controller.signal.aborted){setStatus('failed');setError('تعذر تحميل بيانات المصحف المحفوظة. لا نسمح بالكتابة فوقها قبل إعادة التحميل.');}
  });
  return ()=>controller.abort();
 },[enabled,learnerId,setBookmarks,setInkByPage,setNotes,setPage,setPageEntry]);

 useEffect(()=>{
  if(!enabled)return;
  setPageReady(false);
  const controller=new AbortController();
  void privateMushafClient.page(learnerId,page,controller.signal).then(items=>{
   if(controller.signal.aborted)return;
   for(const item of items)versions.current[item.itemId]=item.version;
   setInkByPage(prev=>({...prev,[page]:items.map(asInk).filter(
     (ink):ink is QuranInkStroke=>ink!==null)}));
   setPageReady(true);
  }).catch(()=>{
   if(!controller.signal.aborted){setStatus('failed');setError('تعذر فتح العلامات المحفوظة لهذه الصفحة؛ الكتابة متوقفة لحماية المحتوى.');}
  });
  return ()=>controller.abort();
 },[enabled,learnerId,page,setInkByPage]);

 useEffect(()=>{
  if(!enabled||!indexReady||!pageReady||failed.current||queue.current.length)return;
  setStatus('saved');
 },[enabled,indexReady,pageReady,page]);
 useEffect(()=>{
  if(!enabled)return;
  const onUnload=(event:BeforeUnloadEvent)=>{
   if(!queue.current.length)return;
   event.preventDefault();event.returnValue='';
  };
  window.addEventListener('beforeunload',onUnload);
  return ()=>window.removeEventListener('beforeunload',onUnload);
 },[enabled]);

 async function drain(){
  if(running.current||failed.current||!enabled)return;
  running.current=true;
  setStatus('pending');
  while(queue.current.length&&mounted.current){
   const job=queue.current[0]!;
   const operation:PrivateOperation={
    ...job,expectedVersion:job.expectedVersion??versions.current[job.itemId]??0,
   };
   job.expectedVersion=operation.expectedVersion;
   try{
    const confirmed=await privateMushafClient.mutate(learnerId,operation);
    versions.current[confirmed.itemId]=confirmed.version;
    queue.current.shift();
   }catch(err){
    failed.current=true;
    setError(err instanceof Error&&'code' in err?
     'تعذر الحفظ ('+String(err.code)+'). العلامات المعروضة على الجهاز لم تتزامن بعد.':
     'تعذر حفظ التغييرات. أعد المحاولة قبل مغادرة المصحف.');
    setStatus('failed');break;
   }
  }
  running.current=false;
  if(!failed.current&&mounted.current)setStatus('saved');
 }
 function enqueue(action:PrivateAction,itemId:string,kind:PrivateItemKind,
    itemPage:number,payload:Record<string,unknown>):void{
  if(!enabled)return;
  queue.current.push({operationId:crypto.randomUUID(),action,itemId,kind,page:itemPage,payload});
  setStatus(failed.current?'failed':'pending');
  void drain();
 }
 function retry(){
  if(!enabled)return;
  if(!indexReady||!pageReady){
   // Failed initial fetch must not be interpreted as an empty saved page.
   window.location.reload();return;
  }
  failed.current=false;setError('');
  void drain();
 }
 function strokeDiff(pageId:number,previous:readonly QuranInkStroke[],next:readonly QuranInkStroke[]){
  if(!enabled)return;
  const oldIds=new Set(previous.map(s=>s.id)),newIds=new Set(next.map(s=>s.id));
  for(const removed of previous.filter(s=>!newIds.has(s.id)))
   enqueue('hide',removed.id,removed.kind,pageId,{});
  for(const added of next.filter(s=>!oldIds.has(s.id)))
   enqueue(versions.current[added.id]?'restore':'put',added.id,added.kind,pageId,
     versions.current[added.id]?{}:{points:added.points,color:added.color,width:added.width});
 }
 function note(target:QuranTarget,text:string,color:string){
  const itemId='note-'+target.surah+'-'+target.ayah+'-'+(target.wordIndex??0);
  if(text)enqueue('put',itemId,'note',target.page,{
   target:{surah:target.surah,ayah:target.ayah,wordIndex:target.wordIndex},
   text,color,
  });
  else if(versions.current[itemId])enqueue('hide',itemId,'note',target.page,{});
 }
 function bookmark(targetPage:number,exists:boolean){
  const itemId='bookmark-'+targetPage;
  enqueue(exists?'hide':versions.current[itemId]?'restore':'put',
   itemId,'bookmark',targetPage,{});
 }
 useEffect(()=>{
  if(!enabled||!indexReady||!pageReady||failed.current||queue.current.length)return;
  const timer=window.setTimeout(()=>{
   if(queue.current.length||failed.current)return;
   enqueue('put','position','position',page,{});
  },900);
  return ()=>window.clearTimeout(timer);
 // Position is written after each fully loaded page navigation, not pointer movement.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[enabled,learnerId,page,indexReady,pageReady]);

 return {
  enabled,status,error,canEdit:!enabled||(indexReady&&pageReady),
  canNavigate:!enabled||queue.current.length===0,
  retry,strokeDiff,note,bookmark,
 };
}
