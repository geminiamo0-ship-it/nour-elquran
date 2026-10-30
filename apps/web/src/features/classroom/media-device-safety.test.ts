import {describe,expect,it,vi} from 'vitest';
import {setDeviceWithEpochGuard} from './media-device-safety';

describe('LiveKit device permission race safety',()=>{
  it('commits a device toggle only while its room epoch is current',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>({enabled}));
    const result=await setDeviceWithEpochGuard(true,apply,()=>true);
    expect(result).toEqual({current:true,value:{enabled:true}});
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it('stops a camera enabled after the user already left the room',async()=>{
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    let current=true;
    let trackEnabled=false;
    const stopTrack=vi.fn();
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled)await gate;
      trackEnabled=enabled;
      return {videoTrack:{stop:stopTrack}};
    });
    const pending=setDeviceWithEpochGuard(true,apply,()=>current,
      value=>value.videoTrack.stop());
    current=false; // Stop/leave happened while browser permission prompt was pending.
    release();
    expect(await pending).toEqual({current:false});
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(trackEnabled).toBe(false);
  });
  it('re-disables a late microphone enable and tolerates disconnected old room',async()=>{
    let current=false;
    const apply=vi.fn(async(enabled:boolean)=>{
      if(!enabled)throw new Error('room already disconnected');
      return undefined;
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>current)).resolves.toEqual({current:false});
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });
  it('does not turn a stale disable into a fresh enable',async()=>{
    const apply=vi.fn(async(_enabled:boolean)=>undefined);
    expect(await setDeviceWithEpochGuard(false,apply,()=>false)).toEqual({current:false});
    expect(apply.mock.calls.map(call=>call[0])).toEqual([false]);
  });
});
