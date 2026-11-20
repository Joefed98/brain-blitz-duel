import re, os, sys, json
ROOT='/home/user/brain-blitz-duel'
src=open(f'{ROOT}/docs/polish-plan-final/assertions.md',encoding='utf8').read().split('\n')
cache={}
def lines_of(path):
    if path not in cache:
        p=os.path.join(ROOT,path)
        cache[path]=open(p,encoding='utf8',errors='replace').read().split('\n') if os.path.isfile(p) else None
    return cache[path]
def norm(s): return re.sub(r'\s+',' ',s).strip()
def frags(cell):
    out=[]
    for q in re.findall(r'`([^`]+)`',cell):
        for part in re.split(r'\s*(?:…|\.\.\.)\s*',q):
            part=norm(part)
            if len(part)>=6: out.append(part)
    return out
def parse_lines(cell):
    nums=[]
    for a,b in re.findall(r'(\d+)\s*(?:[–-]\s*(\d+))?',cell):
        a=int(a); b=int(b) if b else a
        if b<a or b-a>400: b=a
        nums.append((a,b))
    return nums
res=[]; cur_file=None
for i,l in enumerate(src,1):
    if not l.startswith('|') or re.match(r'^\|\s*-',l): continue
    cells=[c.strip() for c in l.strip().strip('|').split('|')]
    if len(cells)<3: continue
    m=re.search(r'`((?:scripts|src|docs|\.github)/[^`\s]+\.[a-z]+)`',cells[0])
    path=m.group(1) if m else None
    if not path:
        m0=re.search(r'`([A-Za-z0-9_.\-/]+\.(?:tsx?|json|py|mjs))`',cells[0])
        if m0 and os.path.isfile(os.path.join(ROOT,'scripts',m0.group(1))): path='scripts/'+m0.group(1)
    if not path:
        # maybe path:line form anywhere in the row
        m2=re.search(r'`((?:scripts|src)/[^`\s:]+\.[a-z]+):(\d+(?:[–-]\d+)?)`',l)
        if m2: res.append(dict(row=i,path=m2.group(1),lines=m2.group(2),kind='inline',cells=cells)); 
        continue
    res.append(dict(row=i,path=path,lines=cells[1],kind='table',cells=cells))
report=[]
for r in res:
    fl=lines_of(r['path'])
    if fl is None:
        report.append((r['row'],r['path'],r['lines'],'FILE MISSING','')); continue
    rng=parse_lines(r['lines'])
    qcell=r['cells'][2] if r['kind']=='table' and len(r['cells'])>2 else ' '.join(r['cells'])
    fr=frags(qcell)
    if not rng:
        report.append((r['row'],r['path'],r['lines'],'NO LINE NUMBER','')); continue
    lo=min(a for a,b in rng); hi=max(b for a,b in rng)
    if hi>len(fl):
        report.append((r['row'],r['path'],r['lines'],f'PAST END (file has {len(fl)} lines)','')); continue
    if not fr:
        report.append((r['row'],r['path'],r['lines'],'no quote to check','')); continue
    window=norm(' '.join(fl[max(0,lo-2):hi+1]))
    bad=[]
    for f in fr:
        if f in window: continue
        # search the file
        hits=[n for n,x in enumerate(fl,1) if f in norm(x)]
        bad.append((f,hits[:4]))
    if not bad: report.append((r['row'],r['path'],r['lines'],'OK',''))
    else:
        report.append((r['row'],r['path'],r['lines'],'MISMATCH',bad))
from collections import Counter
print(Counter(x[3].split(' (')[0] for x in report))
for x in report:
    if x[3]!='OK': print(x[0],x[1],x[2],x[3],json.dumps(x[4])[:230] if x[4] else '')


p2=[x for x in report if x[0]>=309]
print('PART 2:',Counter(x[3].split(' (')[0] for x in p2))
# inline path:line refs anywhere
inl=0; bad=[]
for i,l in enumerate(src,1):
    for m in re.finditer(r'`([A-Za-z0-9_.\-/]+\.(?:tsx?|css|py|mjs|md)):(\d+)(?:[-–](\d+))?',l):
        p=m.group(1)
        cand=[p,'scripts/'+p]
        fl=None
        for c in cand:
            fl=lines_of(c)
            if fl is not None: break
        inl+=1
        if fl is None: bad.append((i,p,'missing')); continue
        hi=int(m.group(3) or m.group(2))
        if hi>len(fl): bad.append((i,p,f'{hi} past end {len(fl)}'))
print('inline refs',inl,'bad',bad)
print('\n=========== DETAIL2')
for x in p2:
    if x[3] in ('OK',): continue
    r=[q for q in res if q['row']==x[0]][0]
    fl=lines_of(r['path']); rng=parse_lines(r['lines'])
    print(f"\n## row {x[0]} {r['path']} [{r['lines']}] {x[3]}")
    if fl is None: continue
    print('   SAYS:', (r['cells'][2] if len(r['cells'])>2 else '')[:260])
    for a,b in rng[:3]:
        for n in range(a,min(b,a+2)+1):
            if n<=len(fl): print(f'   {n}: {fl[n-1].strip()[:210]}')
