"""Build an offline Korean glossary for public Old World source labels."""
import concurrent.futures
import glob
import json
import re
import time
import urllib.parse
import urllib.request

ROOT = 'dist/'
values = set()

def collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'name_en' and isinstance(child, str):
                values.add(child.strip())
            collect(child)
    elif isinstance(value, list):
        for child in value:
            collect(child)

for path in glob.glob(ROOT + 'data/games/the-old-world/**/*.json', recursive=True):
    collect(json.load(open(path)))
collect(json.load(open(ROOT + 'data/src/assets/the-old-world.json')))
rules = json.load(open(ROOT + 'data/src/components/rules-index/rules-index-export.json'))
def rule_collect(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(key, str) and re.search('[A-Za-z]', key) and len(key) < 100:
                values.add(key)
            rule_collect(child)
    elif isinstance(value, list):
        for child in value: rule_collect(child)
rule_collect(rules)
values = sorted(x for x in values if x and re.search('[A-Za-z]', x) and len(x) <= 120 and '\n' not in x)
print('Source labels:', len(values), flush=True)
chunks = [values[i:i+18] for i in range(0,len(values),18)]

def translate(chunk):
    query = '\n'.join(chunk)
    url = 'https://translate.googleapis.com/translate_a/single?' + urllib.parse.urlencode({'client':'gtx','sl':'en','tl':'ko','dt':'t','q':query})
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.load(response)
            output = ''.join(x[0] for x in result[0]).split('\n')
            if len(output) == len(chunk):
                return dict(zip(chunk, [x.strip() for x in output]))
        except Exception:
            time.sleep(1.5 * (attempt+1))
    return {}

found={}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    futures=[pool.submit(translate,chunk) for chunk in chunks]
    for index, future in enumerate(concurrent.futures.as_completed(futures),1):
        found.update(future.result())
        if index%30==0: print('Batches:',index,'/',len(chunks),'translated:',len(found),flush=True)
for value in values:
    if value not in found:
        found.update(translate([value]))
path=ROOT+'translations-ko.json'
with open(path,'w') as file: json.dump(found,file,ensure_ascii=False,separators=(',',':'))
print('Saved:',len(found),'/',len(values),path,flush=True)
