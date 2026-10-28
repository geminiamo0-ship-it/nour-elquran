import {describe,it,expect} from 'vitest';
import {isQuranDoubleTap,QURAN_DOUBLE_TAP_MS} from './quranInteraction';
describe('Mushaf single tap vs quick second tap',()=>{
  it('selects on first tap, opens only for same ayah within window',()=>{
    expect(isQuranDoubleTap(null,'2:5',100)).toBe(false);
    expect(isQuranDoubleTap({key:'2:5',at:100},'2:5',100+QURAN_DOUBLE_TAP_MS)).toBe(true);
    expect(isQuranDoubleTap({key:'2:5',at:100},'2:5',551)).toBe(false);
    expect(isQuranDoubleTap({key:'2:5',at:100},'2:6',130)).toBe(false);
  });
  it('does not treat clocks that moved backwards or invalid timestamps as double taps',()=>{
    expect(isQuranDoubleTap({key:'1:1',at:500},'1:1',499)).toBe(false);
    expect(isQuranDoubleTap({key:'1:1',at:500},'1:1',NaN)).toBe(false);
  });
  it('keeps verse and word taps distinct',()=>{
    expect(isQuranDoubleTap({key:'2:255',at:100},'2:255:w1',150)).toBe(false);
    expect(isQuranDoubleTap({key:'2:255:w1',at:100},'2:255:w1',150)).toBe(true);
  });
});
