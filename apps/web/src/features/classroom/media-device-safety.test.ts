import {describe,expect,it,vi} from 'vitest';
import {resumeRemoteAudioIfCurrent,setDeviceWithEpochGuard} from './media-device-safety';

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

  it('disables stale capture if the SDK rejects after capture begins',async()=>{
    let rejectPermission!:(error:Error)=>void;
    const permission=new Promise<void>((_,reject)=>{rejectPermission=reject;});
    let current=true;
    let capturing=false;
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled){
        capturing=true;
        await permission;
      }else capturing=false;
      return undefined;
    });
    const pending=setDeviceWithEpochGuard(true,apply,()=>current);
    current=false;
    rejectPermission(new Error('disconnected during grant'));
    await expect(pending).rejects.toThrow('disconnected during grant');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
    expect(capturing).toBe(false);
  });

  it('preserves the original stale SDK rejection if cleanup also fails',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{
      throw new Error(enabled?'original enable failure':'cleanup failure');
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>false))
      .rejects.toThrow('original enable failure');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });

  it('does not issue an extra disable after a current SDK rejection',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{
      if(enabled)throw new Error('permission denied');
      return undefined;
    });
    await expect(setDeviceWithEpochGuard(true,apply,()=>true))
      .rejects.toThrow('permission denied');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true]);
  });

  it('preserves a late rejected permission and attempts old-room cleanup',async()=>{
    const apply=vi.fn(async(enabled:boolean)=>{void enabled;throw new Error('denied');});
    await expect(setDeviceWithEpochGuard(true,apply,()=>false))
      .rejects.toThrow('denied');
    expect(apply.mock.calls.map(call=>call[0])).toEqual([true,false]);
  });
});

describe('Room-scoped remote audio resume (#221)',()=>{
  it('never plays new-room audio when an old startAudio finishes after leave',async()=>{
    let resolveStart!:()=>void;
    const start=new Promise<void>(resolve=>{resolveStart=resolve;});
    let current=true;
    const play=vi.fn(async()=>{});
    const list=vi.fn(()=>[play]);
    const pending=resumeRemoteAudioIfCurrent(()=>start,()=>current,list);
    current=false;
    resolveStart();
    await expect(pending).resolves.toBe(false);
    expect(list).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
  it('stops playback sequence when Stop occurs during first play',async()=>{
    let current=true;
    const first=vi.fn(async()=>{current=false;});
    const second=vi.fn(async()=>{});
    await expect(resumeRemoteAudioIfCurrent(async()=>{},()=>current,()=>[first,second]))
      .resolves.toBe(false);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
  it('resumes explicitly requested audio for the still-current Room',async()=>{
    const play=vi.fn(async()=>{});
    await expect(resumeRemoteAudioIfCurrent(async()=>{},()=>true,()=>[play]))
      .resolves.toBe(true);
    expect(play).toHaveBeenCalledOnce();
  });
});
