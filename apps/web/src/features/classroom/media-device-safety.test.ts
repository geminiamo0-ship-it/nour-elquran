import {describe,expect,it,vi} from 'vitest';
import {setDeviceWithEpochGuard} from './media-device-safety';

describe('LiveKit device permission race safety (#221)',()=>{
  it('commits a toggle only for the same active room generation',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>({enabled}));
    expect(await setDeviceWithEpochGuard(true,apply,()=>true))
      .toEqual({current:true,value:{enabled:true}});
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(true);
  });

  it('stops a late camera track and disables capture after Stop/leave',async()=>{
    let resolvePermission!:()=>void;
    const permission=new Promise<void>(resolve=>{resolvePermission=resolve;});
    let current=true;
    let capturing=false;
    const stop=vi.fn();
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled)await permission;
      capturing=enabled;
      return {videoTrack:{stop}};
    });
    const pending=setDeviceWithEpochGuard(true,apply,()=>current,
      publication=>publication.videoTrack.stop());
    current=false;
    resolvePermission();
    expect(await pending).toEqual({current:false});
    expect(stop).toHaveBeenCalledOnce();
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
    expect(capturing).toBe(false);
  });

  it('stops a late microphone track even if disconnected Room rejects disable',async()=>{
    const stop=vi.fn();
    const apply=vi.fn(async(enabled:boolean)=>{
      if(!enabled)throw new Error('room already disconnected');
      return {audioTrack:{stop}};
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>false,
      publication=>publication.audioTrack.stop())).resolves.toEqual({current:false});
    expect(stop).toHaveBeenCalledOnce();
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('disables stale capture even when the returned track has already been disposed',async()=>{
    const stop=vi.fn(()=>{throw new Error('track already disposed');});
    const apply=vi.fn(async(enabled:boolean)=>({enabled}));
    await expect(setDeviceWithEpochGuard(true,apply,()=>false,stop))
      .resolves.toEqual({current:false});
    expect(stop).toHaveBeenCalledOnce();
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('tries to disable stale capture when the SDK returns no track publication',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{void enabled;return undefined;});
    const stop=vi.fn();
    await expect(setDeviceWithEpochGuard(true,apply,()=>false,stop))
      .resolves.toEqual({current:false});
    expect(stop).toHaveBeenCalledWith(undefined);
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('does not re-enable devices for stale disable operations',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{void enabled;return undefined;});
    expect(await setDeviceWithEpochGuard(false,apply,()=>false))
      .toEqual({current:false});
    expect(apply.mock.calls.map(call=>call[0])).toEqual([false]);
  });

  it('does not turn a late rejected permission into a successful toggle',async()=>{
    const apply=vi.fn(async()=>{throw new Error('denied');});
    await expect(setDeviceWithEpochGuard(true,apply,()=>false))
      .rejects.toThrow('denied');
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
