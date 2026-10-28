import { describe, expect, it } from 'vitest';
import { getVisibleSpread } from './quranReaderLayout';

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
});
