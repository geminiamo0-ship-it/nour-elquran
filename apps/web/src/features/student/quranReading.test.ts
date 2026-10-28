import { describe, expect, it } from 'vitest';
import { nearbyPages } from './components/SmoothMadinahPage';
import { normalizeArabic } from './quranSearch';
import {
  targetKey, validTarget, visibleAnnotations, pointToPath,
  type QuranAnnotation, type QuranTarget,
} from './quranAnnotations';

const target:QuranTarget={page:42,surah:2,ayah:255,wordIndex:null};
const note=(id:string,learnerId:string,type:'private'|'teacher',published:boolean,lessonId?:string):QuranAnnotation=>({
  id,learnerId,type,published,authorLabel:'معلم مثال',target,text:'تصحيح التلاوة',
  color:'#f6cd46',createdAt:'2026-10-28T12:00:00Z',lessonId
});

describe('full Quran reader: performance, note privacy and anchors',()=>{
  it('prefetches at most ten neighboring pages, never out of 1–604 bounds',()=>{
    expect(nearbyPages(25,5)).toEqual([25,26,24,27,23,28,22,29,21,30,20]);
    expect(nearbyPages(1,5)).toEqual([1,2,3,4,5,6]);
    expect(nearbyPages(604,5)).toEqual([604,603,602,601,600,599]);
    expect(nearbyPages(605,5)[0]).toBe(604);
  });
  it('normalizes search input without touching the original Quran verse text',()=>{
    expect(normalizeArabic('إِنَّ مَعَ الْعُسْرِ يُسْرًا')).toBe('ان مع العسر يسرا');
    expect(normalizeArabic('  ٱلْحَمْدُ لِلَّهِ  ')).toBe('الحمد لله');
  });
  it('anchors verse, word and page independently from visual geometry',()=>{
    expect(validTarget(target)).toBe(true);
    expect(targetKey(target)).toBe('2:255');
    expect(targetKey({...target,wordIndex:3})).toBe('2:255:w3');
    expect(validTarget({...target,page:605})).toBe(false);
    expect(validTarget({...target,wordIndex:0})).toBe(false);
  });
  it('never shows a sibling note or unapproved teacher draft',()=>{
    const all=[
      note('a','child-a','private',false),
      note('b','child-b','private',false),
      note('c','child-a','teacher',false,'lesson-3'),
      note('d','child-a','teacher',true,'lesson-3'),
      note('e','child-a','teacher',true),
    ];
    expect(visibleAnnotations(all,'child-a').map(x=>x.id)).toEqual(['a','d']);
    expect(visibleAnnotations(all,'child-b').map(x=>x.id)).toEqual(['b']);
  });
  it('keeps personal pen strokes separate from Quran text',()=>{
    expect(pointToPath([{x:4,y:5},{x:10.5,y:12}])).toBe('M4.00,5.00 L10.50,12.00');
  });
});
