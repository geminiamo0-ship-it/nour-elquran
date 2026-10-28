import { describe,expect,it } from 'vitest';
import { pageViewBox,regionPath } from './components/QuranAyahOverlay';
import { parseQuranAyahRegions } from './quranSource';

describe('Madinah ayah tap coordinates and word-safe hit regions',()=>{
  it('uses exact publisher viewBox for opening spread and the standard later pages',()=>{
    expect(pageViewBox(1)).toBe('-53.3109 -198.4777 345 550');
    expect(pageViewBox(2)).toBe('-53.3109 -198.4777 345 550');
    expect(pageViewBox(3)).toBe('0 0 345 550');
    expect(pageViewBox(604)).toBe('0 0 345 550');
  });
  it('accepts opening spread bare polygon point lists and normal SVG M/L/Z paths',()=>{
    expect(regionPath('181.08,18.31 57.54,18.31 57.54,48.94 181.08,48.94'))
      .toBe('M181.08,18.31 L57.54,18.31 L57.54,48.94 L181.08,48.94 Z');
    expect(regionPath('M 0.0 0.75 L 337.75 0.75 L 337.75 43 Z'))
      .toBe('M 0.0 0.75 L 337.75 0.75 L 337.75 43 Z');
    expect(regionPath('foo')).toBeNull();
    expect(regionPath('1,2 4,5')).toBeNull();
    expect(regionPath('M0 1 L2 2 <script>')).toBeNull();
  });
  it('binds reference and polygon from the same page rather than estimating click positions',()=>{
    const data=[{surahNumber:1,ayahNumber:1,polygon:'181.08,18.31 57.54,18.31 57.54,48.94'}];
    const [first]=parseQuranAyahRegions(data);
    expect(first).toEqual({surah:1,ayah:1,polygon:data[0]!.polygon});
    expect(regionPath(first!.polygon)).not.toBeNull();
  });
});
