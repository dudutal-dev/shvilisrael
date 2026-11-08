#!/usr/bin/env python3
"""Build src/data/pois.json: Hebrew-Wikipedia summaries, photos and coordinates for the points of
interest of every segment (names from the SPNI guide + research highlights).
Run: python3 scripts/fetch-pois.py   (honours HTTPS_PROXY / SSL_CERT_FILE)"""
import json, re, sys, time, urllib.request, urllib.parse, os
API = 'https://he.wikipedia.org/w/api.php'
UA = 'ShvilIsraelApp/1.0 (https://github.com/dudutal-dev/shvilisrael)'
seg_file = 'src/data/segments.json'
data = json.load(open(seg_file, encoding='utf-8'))
overrides = json.load(open('scripts/poi-overrides.json', encoding='utf-8')) if os.path.exists('scripts/poi-overrides.json') else {}
SKIP = overrides.get('_skip', [])
MAP = overrides.get('_map', {})

def get(params):
    params = dict(params, format='json', formatversion='2')
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(6):
        try:
            time.sleep(1.2)
            with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                ra = int(e.headers.get('Retry-After') or 30)
                print('429 – waiting', ra + 2, 's', file=sys.stderr); time.sleep(ra + 2); continue
            if i == 5: raise
            time.sleep(2)
        except Exception:
            if i == 5: raise
            time.sleep(2)
    raise RuntimeError('too many retries')

BAD = re.compile(r'(פריחה|מים זורמים|תצפיות|נקודות מילוי|נקודות לינה|הצטיידות|פינות חמד|חורש|מצוקים יפים|מעיינות קטנים|מים זורמים|שרידי|בוסתני|מדרגות|טחנות|צל ו|נוף$|נופים|תצפית ל)')
def candidates(seg):
    raw = []
    p = seg.get('spni', {}).get('pois_raw') or ''
    for x in re.split(r',|·|\n', p): raw.append(x)
    for h in seg.get('highlights', []): raw.append(h)
    out = []
    for x in raw:
        x = x.strip(' .')
        if ':' in x: x = x.split(':', 1)[1].strip()
        x = re.sub(r'\s*\(.*?\)\s*', ' ', x).strip()  # drop parentheticals
        x = re.sub(r'^(גן לאומי|שמורת טבע|שמורת|קופות|חניון|היישוב|הישוב|קיבוץ|מושב|מושבה|אנדרטת|חפיפה עם)\s+', '', x).strip()
        x = x.split(' – ')[0].split(' - ')[0].strip()
        if not x or len(x) > 32 or len(x) < 3 or BAD.search(x) or x in SKIP: continue
        if re.search(r'\d', x) and not re.search(r'מצודת|נ\.ג|ק"מ', x): continue
        out.append(x)
    seen, uniq = set(), []
    for x in out:
        k = re.sub(r'["\'״׳]', '', x)
        if k not in seen: seen.add(k); uniq.append(x)
    return uniq[:12]

def norm(s): return re.sub(r'["\'״׳\-–()]', '', s).replace('ה', '', 0).strip()
def tokens(s): return {t for t in re.split(r'\s+', re.sub(r'["\'״׳\-–(),.]', ' ', s)) if len(t) >= 3}
def good_match(q, title):
    if norm(q) == norm(title): return 3
    tq, tt = tokens(q), tokens(title)
    if not tq: return 0
    inter = tq & tt
    if q in title or title in q: return 2
    if len(inter) >= max(1, len(tq) // 2): return 1
    return 0

cache_file = 'scripts/.poi-cache.json'
cache = json.load(open(cache_file)) if os.path.exists(cache_file) else {}
def resolve(name):
    if name in MAP: return MAP[name]
    if name in cache: return cache[name]
    r = get({'action': 'query', 'list': 'search', 'srsearch': name, 'srlimit': 4})
    hits = r.get('query', {}).get('search', [])
    best = None
    for h in hits:
        score = good_match(name, h['title'])
        if score and (best is None or score > best[0]): best = (score, h['title'])
    cache[name] = best[1] if best else None
    return cache[name]

pois, segmap = {}, {}
seg_names = {str(seg['id']): candidates(seg) for seg in data['segments']}
all_names = list(dict.fromkeys(n for v in seg_names.values() for n in v))
print('candidate names:', len(all_names), file=sys.stderr)
# pass 1: direct title lookup in batches of 50 (redirects resolved by the API)
direct = {}
todo = [n for n in all_names if n not in cache and n not in MAP]
for i in range(0, len(todo), 50):
    batch = todo[i:i + 50]
    r = get({'action': 'query', 'titles': '|'.join(batch), 'redirects': 1, 'prop': 'pageprops', 'ppprop': 'disambiguation'})
    q = r.get('query', {})
    norm_map = {x['from']: x['to'] for x in q.get('normalized', [])}
    red_map = {x['from']: x['to'] for x in q.get('redirects', [])}
    ok = {p['title'] for p in q.get('pages', []) if not p.get('missing') and 'disambiguation' not in p.get('pageprops', {})}
    for n in batch:
        t = red_map.get(norm_map.get(n, n), norm_map.get(n, n))
        cache[n] = t if t in ok else None
        if t in ok: direct[n] = t
    json.dump(cache, open(cache_file, 'w'), ensure_ascii=False, indent=1)
    print(f'direct batch {i // 50 + 1}: {len(direct)} found so far', file=sys.stderr)
# pass 2: search for the misses (slow; incremental cache)
misses = [n for n in all_names if not cache.get(n) and n not in MAP]
print('searching for', len(misses), 'names', file=sys.stderr)
for n in misses:
    if cache.get(n) is not None: continue
    r = get({'action': 'query', 'list': 'search', 'srsearch': n, 'srlimit': 4})
    best = None
    for h in r.get('query', {}).get('search', []):
        score = good_match(n, h['title'])
        if score and (best is None or score > best[0]): best = (score, h['title'])
    cache[n] = best[1] if best else ''
    json.dump(cache, open(cache_file, 'w'), ensure_ascii=False, indent=1)
titles_needed = {}
for sid, names in seg_names.items():
    segmap[sid] = []
    for n in names:
        t = MAP.get(n) or cache.get(n)
        if not t: continue
        titles_needed[t] = n
        if t not in segmap[sid]: segmap[sid].append(t)
print('resolved titles:', len(titles_needed), file=sys.stderr)

titles = list(titles_needed)
for i in range(0, len(titles), 20):
    batch = titles[i:i + 20]
    print(f'details batch {i // 20 + 1}/{(len(titles) + 19) // 20}', file=sys.stderr)
    r = get({'action': 'query', 'prop': 'extracts|pageimages|coordinates|pageprops|info', 'inprop': 'url', 'exintro': 1, 'explaintext': 1, 'exsentences': 8, 'piprop': 'thumbnail|original', 'pithumbsize': 900, 'titles': '|'.join(batch), 'redirects': 1, 'ppprop': 'disambiguation'})
    red = {x['from']: x['to'] for x in r.get('query', {}).get('redirects', [])}
    for p in r.get('query', {}).get('pages', []):
        if p.get('missing') or 'disambiguation' in p.get('pageprops', {}): continue
        ext = (p.get('extract') or '').strip()
        if len(ext) < 60: continue
        co = (p.get('coordinates') or [{}])[0]
        pois[p['title']] = {'title': p['title'], 'extract': ext[:1400], 'image': (p.get('thumbnail') or {}).get('source'), 'original': (p.get('original') or {}).get('source'), 'lat': co.get('lat'), 'lon': co.get('lon'), 'url': p.get('fullurl') or f"https://he.wikipedia.org/wiki/{urllib.parse.quote(p['title'].replace(' ', '_'))}"}
    for a, b in red.items():
        if b in pois and a in titles_needed: segmap = {k: [b if x == a else x for x in v] for k, v in segmap.items()}
segmap = {k: [x for x in dict.fromkeys(v) if x in pois] for k, v in segmap.items()}
out = {'fetched': time.strftime('%Y-%m-%d'), 'source': 'he.wikipedia.org (CC BY-SA 4.0)', 'segments': segmap, 'pois': pois}
json.dump(out, open('src/data/pois.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('pois:', len(pois), 'with coords:', sum(1 for p in pois.values() if p['lat']), 'with image:', sum(1 for p in pois.values() if p['image']), file=sys.stderr)
for k, v in segmap.items(): print(k, v)
