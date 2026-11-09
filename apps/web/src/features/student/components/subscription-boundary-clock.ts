'use client';
import {useEffect,useState} from 'react';

// A signed D1 cycle can start or expire while a guardian keeps the page open.
// Re-render at the next boundary without polling, reloading or changing credits.
const MAX_TIMEOUT_MS=2_147_483_647;
export function nextSubscriptionBoundaryDelay(
 now:number,startsAtMs?:number,endsAtMs?:number
):number|null{
 const next=[startsAtMs,endsAtMs].filter((value):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>now);
 if(next.length===0)return null;
 return Math.max(1,Math.min(MAX_TIMEOUT_MS,Math.ceil(Math.min(...next)-now)+1));
}
export function useSubscriptionBoundaryClock(startsAtMs?:number,endsAtMs?:number){
 const [tick,setTick]=useState(0);
 useEffect(()=>{
  const delay=nextSubscriptionBoundaryDelay(Date.now(),startsAtMs,endsAtMs);
  if(delay===null)return;
  const timer=setTimeout(()=>setTick(value=>value+1),delay);
  return()=>clearTimeout(timer);
 },[startsAtMs,endsAtMs,tick]);
 return Date.now();
}
