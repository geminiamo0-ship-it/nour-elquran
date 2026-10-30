/** Guard local LiveKit device toggles against Stop/leave during async permission prompts.
 * A late camera/microphone enable must never revive a device after a disconnect.
 * The caller must also disconnect/stop the old Room on Stop.
 */
export async function setDeviceWithEpochGuard<T>(
  enabled:boolean,
  apply:(enabled:boolean)=>Promise<T>,
  isCurrent:()=>boolean,
  stopLateTrack?:(value:T)=>void,
):Promise<{current:true;value:T}|{current:false}>{
  const value=await apply(enabled);
  if(!isCurrent()){
    if(enabled){
      // Stop any just-created local track even if Room.disconnect() ran earlier.
      try{stopLateTrack?.(value);}catch{/* best-effort cleanup */}
      try{await apply(false);}catch{/* old Room may already be disconnected */}
    }
    return {current:false};
  }
  return {current:true,value};
}
