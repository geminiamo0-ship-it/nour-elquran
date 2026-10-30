type ArchiveStroke=Readonly<{id:string;page:number;color:string;width:number;
 kind:'pen'|'marker';points:readonly {x:number;y:number}[]}>;

export type ArchiveMark=Readonly<{
 id:string;page:number;surah:number|null;ayah:number|null;
 kind:'note'|'highlight'|'pen'|'marker';
 payload:Readonly<{color:string;text?:string;width?:number;points?:readonly {x:number;y:number}[]}>;
}>;
export type PublishedQuranArchive=Readonly<{
 lessonId:string;learnerId:string;reportRevision:number;editionId:string;
 source:'classroom-do:v1';sealedAtMs:number;sourceSha256:string;
 pages:readonly number[];marks:readonly ArchiveMark[];
}>;
export class ArchiveError extends Error{
 constructor(readonly code:string,readonly status:number=0){super(code);}
}
function obj(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new ArchiveError('INVALID_ARCHIVE');
 return v as Record<string,unknown>;
}
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9:._-]{1,128}$/.test(v);
const page=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=604;
const hex=(v:unknown)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
function mark(raw:unknown,pages:ReadonlySet<number>):ArchiveMark{
 const m=obj(raw),payload=obj(m.payload);
 if(!id(m.id)||!page(m.page)||!pages.has(m.page as number)||!hex(payload.color)||
   !['pen','marker','note','highlight'].includes(String(m.kind)))
  throw new ArchiveError('INVALID_ARCHIVE');
 const kind=m.kind as ArchiveMark['kind'];
 let cleaned:ArchiveMark['payload'];
 if(kind==='pen'||kind==='marker'){
  if(m.surah!==null||m.ayah!==null||typeof payload.width!=='number'||
   !Number.isFinite(payload.width)||payload.width<1||payload.width>60||
   !Array.isArray(payload.points)||payload.points.length<2||payload.points.length>2500)
   throw new ArchiveError('INVALID_ARCHIVE');
  const points=payload.points.map(x=>{
   const p=obj(x);
   if(typeof p.x!=='number'||!Number.isFinite(p.x)||p.x<0||p.x>1000||
      typeof p.y!=='number'||!Number.isFinite(p.y)||p.y<0||p.y>1594)
     throw new ArchiveError('INVALID_ARCHIVE');
   return {x:p.x,y:p.y};
  });
  cleaned={color:payload.color as string,width:payload.width,points};
 }else{
  if(!Number.isInteger(m.surah)||Number(m.surah)<1||Number(m.surah)>114||
   !Number.isInteger(m.ayah)||Number(m.ayah)<1||
   (kind==='note'&&(typeof payload.text!=='string'||!payload.text.trim()||
    payload.text.length>500)))
   throw new ArchiveError('INVALID_ARCHIVE');
  cleaned={color:payload.color as string,...(kind==='note'?{text:payload.text as string}:{})};
 }
 return {id:m.id as string,page:m.page as number,surah:m.surah as number|null,
  ayah:m.ayah as number|null,kind,payload:cleaned};
}
export function parsePublishedQuranArchive(raw:unknown):PublishedQuranArchive|null {
 const archive=obj(raw).archive;
 if(archive===null)return null;
 const a=obj(archive);
 if(!id(a.lessonId)||!id(a.learnerId)||a.editionId!=='hafs-kfqc:v1.1.1'||
  a.source!=='classroom-do:v1'||typeof a.sourceSha256!=='string'||
  !/^[0-9a-f]{64}$/.test(a.sourceSha256)||!Number.isSafeInteger(a.reportRevision)||
  Number(a.reportRevision)<1||!Number.isSafeInteger(a.sealedAtMs)||
  Number(a.sealedAtMs)<0||!Array.isArray(a.pages)||a.pages.length===0||
  a.pages.length>20||!a.pages.every(page)||!Array.isArray(a.marks)||a.marks.length>100)
  throw new ArchiveError('INVALID_ARCHIVE');
 const pages=a.pages as number[],set=new Set(pages);
 if(set.size!==pages.length||!pages.every((p,i)=>i===0||pages[i-1]!<p))
  throw new ArchiveError('INVALID_ARCHIVE');
 const marks=a.marks.map(m=>mark(m,set));
 if(new Set(marks.map(m=>m.id)).size!==marks.length)
  throw new ArchiveError('INVALID_ARCHIVE');
 return {lessonId:a.lessonId as string,learnerId:a.learnerId as string,
  reportRevision:a.reportRevision as number,editionId:a.editionId as string,
  source:'classroom-do:v1',sourceSha256:a.sourceSha256,
  sealedAtMs:a.sealedAtMs as number,pages,marks};
}
export const archiveStrokes=(archive:PublishedQuranArchive,pageNumber:number):ArchiveStroke[]=>
 archive.marks.filter(m=>m.page===pageNumber&&(m.kind==='pen'||m.kind==='marker'))
  .map(m=>({id:m.id,page:m.page,color:m.payload.color,
   width:m.payload.width!,kind:m.kind as 'pen'|'marker',points:m.payload.points!}));
export async function fetchPublishedQuranArchive(learnerId:string,lessonId:string,
 signal?:AbortSignal):Promise<PublishedQuranArchive|null>{
 let res:Response;
 try{res=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+'/lessons/'+
   encodeURIComponent(lessonId)+'/quran-archive',{credentials:'same-origin',cache:'no-store',
   redirect:'error',signal});}
 catch(error){if(signal?.aborted)throw error;throw new ArchiveError('NETWORK_UNCERTAIN');}
 let data:unknown;try{data=await res.json();}catch{throw new ArchiveError('INVALID_ARCHIVE',res.status);}
 if(!res.ok){const x=obj(data).code;throw new ArchiveError(typeof x==='string'?x:'REQUEST_FAILED',res.status);}
 return parsePublishedQuranArchive(data);
}
