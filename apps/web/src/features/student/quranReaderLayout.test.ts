import { describe, expect, it } from 'vitest';
import { getAdjacentReaderPage, getVisibleSpread } from './quranReaderLayout';

describe('Madinah physical book layout', () => {
  it('starts with a single opening page', () => {
    expect(getVisibleSpread(1, 'double', false)).toEqual([1]);
  });
  it('groups later physical leaves into verified adjacent pairs', () => {
    expect(getVisibleSpread(2, 'double', false)).toEqual([2, 3]);
    expect(getVisibleSpread(3, 'double', false)).toEqual([2, 3]);
    expect(getVisibleSpread(604, 'double', false)).toEqual([604]);
  });
  it('uses one page for mobile regardless of desktop preference', () => {
    expect(getVisibleSpread(60, 'double', true)).toEqual([60]);
    expect(getVisibleSpread(60, 'single', false)).toEqual([60]);
    expect(getVisibleSpread(60, 'auto', false)).toEqual([60, 61]);
  });
  it('turns entire visible desktop spreads rather than repeating an odd page', () => {
    expect(getAdjacentReaderPage(1, 'auto', false, 1)).toBe(2);
    expect(getAdjacentReaderPage(2, 'auto', false, 1)).toBe(4);
    expect(getAdjacentReaderPage(3, 'double', false, 1)).toBe(4);
    expect(getAdjacentReaderPage(4, 'double', false, -1)).toBe(2);
    expect(getAdjacentReaderPage(3, 'double', false, -1)).toBe(1);
    expect(getAdjacentReaderPage(2, 'double', false, -1)).toBe(1);
    expect(getAdjacentReaderPage(604, 'double', false, -1)).toBe(602);
    expect(getAdjacentReaderPage(603, 'double', false, 1)).toBe(604);
    expect(getAdjacentReaderPage(604, 'double', false, 1)).toBe(604);
    expect(getAdjacentReaderPage(1, 'double', false, -1)).toBe(1);
  });
  it('preserves one-page turns on mobile, single-page settings and ayah mode', () => {
    expect(getAdjacentReaderPage(3, 'double', true, 1)).toBe(4);
    expect(getAdjacentReaderPage(3, 'double', true, -1)).toBe(2);
    expect(getAdjacentReaderPage(3, 'single', false, 1)).toBe(4);
    expect(getAdjacentReaderPage(3, 'auto', false, 1, true)).toBe(4);
    expect(getAdjacentReaderPage(3, 'auto', false, -1, true)).toBe(2);
    expect(getAdjacentReaderPage(Number.NaN, 'auto', false, -1)).toBe(1);
  });
});
