import {describe,expect,it,vi} from 'vitest';
import {findVerifiedVersePage} from './quran-verse-navigation';
import {isVerseSelection} from './quran-verse-selection';
import type {QuranSurahInfo,QuranAyahRegion} from '@/features/student';

const index:QuranSurahInfo[]=Array.from({length:114},(_,i)=>({
 number:i+1,nameArabic:'سورة',pageNumber:i===0?1:i===1?2:Math.min(604,10+i*5),
 ayahCount:i===0?7:i===1?286:10,juzNumber:Math.min(30,Math.floor(i/4)+1),
}));
const region=(surah:number,ayah:number):QuranAyahRegion=>({
 surah,ayah,polygon:'M 0 0 L 1 1 Z',
});
describe('Quran verse side navigator',()=>{
 it('validates canonical verse reference only',()=>{
  expect(isVerseSelection({surah:2,ayah:255})).toBe(true);
  expect(isVerseSelection({surah:2,ayah:255,admin:true})).toBe(false);
  expect(isVerseSelection({surah:115,ayah:1})).toBe(false);
 });
 it('uses publisher polygons to binary-search exact printed page',async()=>{
  const read=vi.fn(async(page:number)=>{
   if(page<5)return [region(2,1),region(2,15)];
   if(page===5)return [region(2,16),region(2,30)];
   if(page<8)return [region(2,31),region(2,60)];
   return [region(2,61),region(2,286)];
  });
  // End bound for surah 2 in the synthetic fixture is page 25.
  expect(await findVerifiedVersePage(index,2,30,read)).toBe(5);
  expect(read.mock.calls.length).toBeLessThanOrEqual(11);
 });
 it('handles a Surah that spans a single canonical page without guessing',async()=>{
  const read=vi.fn(async(page:number)=>{void page;return [region(1,1),region(1,7)];});
  expect(await findVerifiedVersePage(index,1,7,read)).toBe(1);
  expect(read).toHaveBeenCalledWith(1);
 });
 it('fails closed instead of guessing when verse polygon is missing',async()=>{
  const read=async(page:number)=>{void page;return [region(2,1),region(2,4)];};
  await expect(findVerifiedVersePage(index,2,6,read)).rejects.toThrow('QURAN_VERSE_NOT_FOUND');
  await expect(findVerifiedVersePage(index,2,287,read)).rejects.toThrow('INVALID_QURAN_VERSE');
 });
});
