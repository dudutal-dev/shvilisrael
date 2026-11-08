#!/usr/bin/env python3
"""Validate scripts/i18n/spni-en/seg-NN.json translations against the Hebrew source."""
import json,glob,re,sys
src={s['number']:s for s in json.load(open('src/data/spni/segments.json',encoding='utf-8'))}
HEB=re.compile(r'[֐-׿]')
ok=True; seen=set()
for f in sorted(glob.glob('scripts/i18n/spni-en/seg-*.json')):
    t=json.load(open(f,encoding='utf-8')); n=t.get('number'); s=src.get(n); seen.add(n)
    if not s: print(f,'unknown number'); ok=False; continue
    def chk(cond,msg):
        global ok
        if not cond: print(f'seg {n}: {msg}'); ok=False
    for k in ['title','intro','character','description']:
        chk(isinstance(t.get(k+'_en'),str) and t[k+'_en'].strip(), f'missing {k}_en')
    for k in ['shortcuts','parking','transport','pois','author']:
        if s.get(k): chk(isinstance(t.get(k+'_en'),str) and t[k+'_en'].strip(), f'missing {k}_en')
    for k in ['important','nearby','lodging']:
        if s.get(k): chk(isinstance(t.get(k+'_en'),list) and len(t[k+'_en'])==len(s[k]), f'{k}_en must be a list of {len(s[k])}')
    hp=[p for p in (s['description'] or '').split('\n') if p.strip()]
    ep=[p for p in (t.get('description_en') or '').split('\n') if p.strip()]
    chk(len(hp)==len(ep), f'description paragraphs {len(ep)} != {len(hp)}')
    for k,v in t.items():
        txt=' '.join(v) if isinstance(v,list) else str(v)
        heb=HEB.findall(txt)
        chk(len(heb)<=0 or k=='number', f'{k} contains Hebrew ({len(heb)} chars)')
missing=sorted(set(src)-seen)
if missing: print('missing segments:',missing); ok=False
print('OK' if ok else 'FAILED'); sys.exit(0 if ok else 1)
