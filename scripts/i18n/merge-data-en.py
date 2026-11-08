#!/usr/bin/env python3
"""Merge scripts/i18n/data-en/batch-*.json into src/i18n/en-data.json and report coverage of data strings."""
import json,glob,re,sys
out={}
for f in sorted(glob.glob('scripts/i18n/data-en/batch-*.json')):
    d=json.load(open(f,encoding='utf-8'))
    for k,v in d.items():
        if isinstance(v,str) and v.strip() and not re.search(r'[֐-׿]',v): out[k]=v
json.dump(out,open('src/i18n/en-data.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
need=set()
for f in sorted(glob.glob('scripts/i18n/data-src/batch-*.json')): need.update(json.load(open(f,encoding='utf-8'))['strings'])
missing=sorted(need-set(out))
print(f'en-data.json: {len(out)} strings; source strings {len(need)}; missing {len(missing)}')
for m in missing[:20]: print('  -', m[:80])
sys.exit(1 if missing else 0)
