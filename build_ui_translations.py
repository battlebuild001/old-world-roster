"""Produce a small offline English glossary for Korean interface copy."""
from html.parser import HTMLParser
import concurrent.futures
import json
import re
import urllib.parse
import urllib.request

class TextParser(HTMLParser):
    def __init__(self): super().__init__(); self.values=[]
    def handle_data(self, data): self.values.append(data.strip())
    def handle_starttag(self, tag, attrs):
        for key,value in attrs:
            if key in ('placeholder','aria-label','title') and value:self.values.append(value.strip())

p=TextParser();p.feed(open('dist/index.html').read())
values=set(v for v in p.values if re.search('[가-힣]',v) and len(v)<250)
for path in ('dist/app.js','dist/pwa.js'):
    source=open(path).read()
    for match in re.finditer(r"'([^'\n]*[가-힣][^'\n]*)'|`([^`\n]*[가-힣][^`\n]*)`",source):
        v=(match.group(1) or match.group(2)).strip()
        if '${' in v:
            for part in re.split(r'\$\{[^}]+\}',v):
                if re.search('[가-힣]',part):values.add(part.strip())
        elif v:values.add(v)
values=sorted(x for x in values if x and re.search('[가-힣]',x) and len(x)<180 and not any(mark in x for mark in ('<','>','`','${','\\')))
print('UI phrases:',len(values),flush=True)
def translate(value):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'ko','tl':'en','dt':'t','q':value})
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response:r=json.load(response)
        return ''.join(x[0] for x in r[0]).strip()
    except Exception:return ''
def batch(chunk):
    result=translate('\n'.join(chunk)).split('\n')
    if len(result)==len(chunk):return dict(zip(chunk,result))
    return {v:translate(v) for v in chunk}
chunks=[values[i:i+15] for i in range(0,len(values),15)]
data={}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    for result in pool.map(batch,chunks):data.update({k:v for k,v in result.items() if v})
with open('dist/translations-ui-en.json','w') as f:json.dump(data,f,ensure_ascii=False,separators=(',',':'))
print('Saved:',len(data),flush=True)
