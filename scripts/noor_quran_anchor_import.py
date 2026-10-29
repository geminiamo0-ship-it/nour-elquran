#!/usr/bin/env python3
"""Pinned Quran.ws SVG + independent Hafs word boundary verifier. No D1 writes."""
import argparse
import bisect
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.request import Request,urlopen

EDITION="hafs-kfqc:v1.1.1"
SVG_REV="9fc0c87"
TEXT_REV="80361413c304107801895ba303ca01971f20bfe4"
ASSETS="https://noor-quran-assets.geminiamo0.workers.dev/quran/hafs/v1.1.1"
TEXT=f"https://raw.githubusercontent.com/quran-ws/quran-text/{TEXT_REV}/data/mushaf/hafs.json"
PAGES, SURAHS, AYAHS, WORDS=604,114,6236,77432
HEX=re.compile(r"[a-f0-9]{64}")

def require(ok,message):
    if not ok: raise ValueError(message)
def digest(blob): return hashlib.sha256(blob).hexdigest()
def jsonbytes(value): return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n").encode("utf-8")
def download(url,limit):
    require(url.startswith(ASSETS+"/") or url==TEXT,"Forbidden source host")
    with urlopen(Request(url,headers={"User-Agent":"NoorCanonicalAnchors/1.0"}),timeout=30) as reply:
        raw=reply.read(limit+1)
    require(0<len(raw)<=limit,"Invalid source size")
    return raw
def decode(raw,label):
    try:return json.loads(raw)
    except (ValueError,UnicodeError) as error:raise ValueError("Invalid source JSON "+label) from error

def check_manifest(raw,expected=None):
    h=digest(raw)
    if expected:require(HEX.fullmatch(expected) and expected==h,"Manifest SHA-256 changed")
    m=decode(raw,"manifest")
    require(isinstance(m,dict) and m.get("edition")=="hafs-kfqc"
            and m.get("version")=="v1.1.1" and m.get("source_git_revision")==SVG_REV
            and m.get("page_count")==PAGES and m.get("chapter_count")==SURAHS,
            "Wrong Quran SVG edition/revision")
    assets=m.get("assets")
    require(isinstance(assets,list) and len(assets)==PAGES*2+SURAHS+2,"Incomplete edition assets")
    mapping={}
    for row in assets:
        require(isinstance(row,dict),"Malformed asset row")
        key,sha=row.get("key"),row.get("sha256")
        require(isinstance(key,str) and re.fullmatch(
            r"(pages/[0-9]{3}\.(?:json|svg)|indexes/(?:surah|markers)\.json|text/chapters/[0-9]{3}\.json)",key)
            and isinstance(sha,str) and HEX.fullmatch(sha) and key not in mapping,
            "Invalid or duplicated SHA asset")
        mapping[key]=sha
    for i in range(1,PAGES+1):
        require(f"pages/{i:03d}.json" in mapping and f"pages/{i:03d}.svg" in mapping,"Missing page")
    for i in range(1,SURAHS+1):
        require(f"text/chapters/{i:03d}.json" in mapping,"Missing chapter")
    require("indexes/surah.json" in mapping and "indexes/markers.json" in mapping,"Missing index")
    return mapping

def surah_counts(index):
    require(isinstance(index,list) and len(index)==SURAHS,"Expected 114 surahs")
    counts=[]
    for n,row in enumerate(index,1):
        require(isinstance(row,dict) and row.get("number")==n
                and type(row.get("ayahCount")) is int and row["ayahCount"]>0,
                "Invalid surah index")
        counts.append(row["ayahCount"])
    require(sum(counts)==AYAHS,"Surah index is not 6236 ayahs")
    return counts

def word_index(m,counts):
    require(isinstance(m,dict) and m.get("format")=="quran-mushaf"
            and m.get("format_version")=="1.0" and isinstance(m.get("mushaf"),dict)
            and m["mushaf"].get("key")=="hafs" and m["mushaf"].get("word_count")==WORDS
            and isinstance(m.get("counting"),dict) and m["counting"].get("system")=="kufi"
            and m["counting"].get("ayah_count")==AYAHS,
            "Invalid pinned Quran word dataset")
    words,starts,pages,surahs=[m.get(k) for k in ("words","ayah_starts","page_starts","surahs")]
    require(isinstance(words,list) and len(words)==WORDS
            and all(isinstance(w,str) and w.strip() for w in words)
            and isinstance(starts,list) and len(starts) in (AYAHS,AYAHS+1)
            and isinstance(pages,list) and len(pages) in (PAGES,PAGES+1)
            and isinstance(surahs,list) and len(surahs)==SURAHS,
            "Missing or invalid Quran word/page boundaries")
    for boundary in (starts,pages):
        require(all(type(x) is int for x in boundary)
                and boundary[0]==0 and all(a<b for a,b in zip(boundary,boundary[1:])),
                "Unordered word boundaries")
        if len(boundary) in (AYAHS+1,PAGES+1) and boundary[-1]==WORDS:
            continue
        require(boundary[-1]<WORDS,"Invalid terminal word index")
    if len(starts)==AYAHS:
        starts=starts+[WORDS]
    else:require(starts[-1]==WORDS,"Bad final ayah")
    if len(pages)==PAGES:
        pages=pages+[WORDS]
    else:require(pages[-1]==WORDS,"Bad final page")
    mapping={}
    seen=0
    for n,row in enumerate(surahs,1):
        require(isinstance(row,dict) and row.get("number")==n
                and row.get("ayah_count")==counts[n-1] and row.get("first_ayah")==seen,
                "Quran surah/ayah count conflict")
        for ayah in range(1,counts[n-1]+1):
            first,last=starts[seen+ayah-1:seen+ayah+1]
            require(first<last<=WORDS,"Zero or invalid ayah word count")
            marker_page=bisect.bisect_right(pages,last-1)
            require(1<=marker_page<=PAGES,"Ayah marker outside 604 pages")
            mapping[(n,ayah)]=(marker_page,last-first)
        seen+=counts[n-1]
    require(seen==AYAHS and len(mapping)==AYAHS,"Incomplete Hafs source verse count")
    return mapping

def svg_index(pages):
    require(len(pages)==PAGES and set(pages)==set(range(1,PAGES+1)),"Missing Quran page")
    result={}
    for page,rows in sorted(pages.items()):
        require(isinstance(rows,list) and rows,"Empty ayah polygon page")
        for row in rows:
            require(isinstance(row,dict) and type(row.get("surahNumber")) is int
                    and type(row.get("ayahNumber")) is int
                    and 1<=row["surahNumber"]<=SURAHS and row["ayahNumber"]>=1
                    and isinstance(row.get("polygon"),str) and len(row["polygon"])>3,
                    "Invalid ayah polygon")
            key=(row["surahNumber"],row["ayahNumber"])
            require(key not in result,"Duplicate Quran ayah in SVG pages")
            result[key]=page
    require(len(result)==AYAHS,"Expected 6236 distinct SVG ayahs")
    return result

def reconcile(pages,word_data,index):
    lookup=word_index(word_data,surah_counts(index))
    locations=svg_index(pages)
    require(set(lookup)==set(locations),"Quran word and SVG verse keys differ")
    anchors=[]
    for key,(word_page,count) in sorted(lookup.items()):
        require(locations[key]==word_page,
                f"Quran page mismatch {key}: SVG={locations[key]}, words={word_page}")
        anchors.append((*key,word_page,count))
    require(sum(x[3] for x in anchors)==WORDS,"Word totals differ")
    return anchors

def render_sql(anchors,manifest_sha,text_sha):
    require(len(anchors)==AYAHS and HEX.fullmatch(manifest_sha)
            and HEX.fullmatch(text_sha),"Unverified SQL source")
    statements=[
        "-- REVIEW ONLY; generated from pinned Quran sources. NO remote D1 execution.",
        "-- SVG manifest SHA-256: "+manifest_sha,
        "-- Pinned word revision: "+TEXT_REV,
        "-- Word data SHA-256: "+text_sha,
        f"INSERT INTO quran_editions(id,riwayah,page_count,manifest_sha256) VALUES('{EDITION}','hafs',604,'{manifest_sha}');"
    ]
    statements += [f"INSERT INTO quran_ayah_anchors(edition_id,surah,ayah,page,word_count) VALUES('{EDITION}',{s},{a},{p},{n});"
                   for s,a,p,n in anchors]
    return "\n".join(statements)+"\n"

def fetch_and_verify(expected=None):
    raw=download(ASSETS+"/manifest.json",1600000)
    hashes=check_manifest(raw,expected)
    def load_page(n):
        key=f"pages/{n:03d}.json"
        body=download(ASSETS+"/"+key,100000)
        require(digest(body)==hashes[key],"Page SHA mismatch "+key)
        return n,decode(body,key)
    with ThreadPoolExecutor(max_workers=10) as pool:
        pages=dict(pool.map(load_page,range(1,PAGES+1)))
    index=download(ASSETS+"/indexes/surah.json",100000)
    require(digest(index)==hashes["indexes/surah.json"],"Surah index SHA mismatch")
    text=download(TEXT,15000000)
    anchors=reconcile(pages,decode(text,"hafs"),decode(index,"surahs"))
    evidence={"edition":EDITION,"page_count":PAGES,"ayah_count":len(anchors),
              "word_total":sum(row[3] for row in anchors),
              "manifest_sha256":digest(raw),"word_source_sha256":digest(text),
              "svg_revision":SVG_REV,"word_revision":TEXT_REV}
    return anchors,evidence

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",required=True,type=Path)
    parser.add_argument("--expected-manifest-sha256")
    args=parser.parse_args()
    anchors,evidence=fetch_and_verify(args.expected_manifest_sha256)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    (args.output_dir/"verified-quran-anchors.sql").write_text(
        render_sql(anchors,evidence["manifest_sha256"],evidence["word_source_sha256"]),encoding="utf-8")
    (args.output_dir/"verified-quran-anchors-evidence.json").write_bytes(jsonbytes(evidence))
    print("Verified 604 pages, 114 surahs, 6236 ayahs and 77432 words; SQL is REVIEW ONLY.")
    print("manifest_sha256="+evidence["manifest_sha256"])
    print("word_source_sha256="+evidence["word_source_sha256"])
if __name__=="__main__":
    try: main()
    except (ValueError,OSError) as exc:
        print("REFUSING Quran SQL output:",exc,file=sys.stderr)
        sys.exit(1)
