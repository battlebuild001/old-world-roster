#!/usr/bin/env python3
"""Build display-only Hangul readings for the complete Old World name catalog.

Rebuild: python -m pip install cmudict==1.1.3 && python scripts/build-phonetic-names.py
CMUdict (BSD licensed) supplies English pronunciations; curated Warhammer readings
are loaded from the adjacent phonetic-*-overrides.json files. No network is used at
build time, and canonical rules, IDs, profiles and saved armies are never edited.
"""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SCRIPT = ROOT / 'scripts'
ABBREVIATIONS = {'M','WS','BS','S','T','W','I','A','Ld','AP','D3','D6','D66','2D6','3D6','X','XX'}
LATIN = 'A-Za-zÀ-ÖØ-öø-ÿ\u0100-\u024F\u1E00-\u1EFF'
WORD_RE = re.compile(rf"[{LATIN}]+(?:['’][{LATIN}]+)*")
NOTATION_RE = re.compile(r'\d*D\d+(?:[+−-]\d+)?|S[+−-]\d+')
LABEL_RE = re.compile(rf"\d*D\d+(?:[+−-]\d+)?|S[+−-]\d+|[{LATIN}]+(?:['’][{LATIN}]+)*")
SKIP_FIELDS = {'notes','note','description','restrictions','restriction','tooltip','book','source','url','page','body','bodyIndex','text','content','value','requirements','selectionNotes','armyComposition'}


def clean(text):
    value=unicodedata.normalize('NFKC',str(text)).translate(str.maketrans({'‘':"'",'’':"'",'`':"'",'–':'-','—':'-','Æ':'Ae','æ':'ae','Œ':'Oe','œ':'oe','ß':'ss'}))
    return re.sub(r'\s+', ' ', value).strip()


def extract_labels(include_articles=True):
    labels=set()
    def add(value):
        if isinstance(value,str):
            value=clean(value)
            if value and re.search('[A-Za-z]',value) and len(value)<=180:
                labels.add(value)
    def walk(value, context=''):
        if isinstance(value,list):
            for item in value: walk(item,context)
        elif isinstance(value,dict):
            for key,child in value.items():
                if key in SKIP_FIELDS: continue
                if key=='specialRules':
                    text=child.get('name_en','') if isinstance(child,dict) else child
                    if isinstance(text,str):
                        for item in re.split(r',\s*(?![^()]*\))|\n',text):add(item)
                    elif isinstance(text,list):
                        for item in text: add(item)
                elif key in {'name_en','Name','title_en'}:add(child)
                else:walk(child,key)
    for path in sorted((DIST/'data/games/the-old-world').rglob('*.json')):
        walk(json.loads(path.read_text()))
    index=json.loads((DIST/'data/src/components/rules-index/rules-index-export.json').read_text())
    for label,value in index.items():
        add(label)
        walk(value)
    aliases=json.loads((DIST/'data/src/components/rules-index/rule-aliases.json').read_text())
    for values in aliases.values():
        if isinstance(values,dict):
            for label,value in values.items():
                add(label)
                if isinstance(value,str):add(value)
                else:walk(value)
    weapons=json.loads((DIST/'data/play-weapon-profiles.json').read_text())
    for key,profiles in weapons.get('profiles',{}).items():
        add(key)
        for profile in profiles:
            add(profile.get('name'))
            for rule in profile.get('rules',[]):add(rule)
    if include_articles:
        catalog=json.loads((DIST/'rules-catalog.json').read_text())
        for chapter in catalog.get('chapters',[]):
            for item in chapter.get('items',[]):add(item.get('en'))
    # All stat names, selection headings and standard faction/mode names are
    # labels, while explanations and numeric abbreviations remain untouched.
    for value in ['Movement','Weapon Skill','Ballistic Skill','Strength','Toughness','Wounds','Initiative','Attacks','Leadership','Armour Piercing','Range','Special Rules','Model','Combat','Characters','Core','Special','Rare','Mercenaries','Grand Army','Open War','Combined Arms','Grand Melee','Battle March','Kingdom of Bretonnia','Empire of Man','Dwarfen Mountain Holds','Warriors of Chaos','Beastmen Brayherds','Wood Elf Realms','High Elf Realms','Orc and Goblin Tribes','Tomb Kings of Khemri','Grand Cathay','Chaos Dwarfs','Daemons of Chaos','Dark Elves','Lizardmen','Ogre Kingdoms','Skaven','Vampire Counts','Renegade Crowns']:
        add(value)
    return sorted(labels,key=lambda value:(value.casefold(),value))


def load_overrides():
    values={}
    for name in ['phonetic-base-overrides.json','phonetic-rule-overrides.json','phonetic-unit-overrides.json']:
        path=SCRIPT/name
        if path.exists():
            data=json.loads(path.read_text())
            if not isinstance(data,dict):raise ValueError(f'{name}: expected flat object')
            for key,value in data.items():
                if key.startswith('_'):continue
                if not isinstance(value,str):raise ValueError(f'{name}: expected string for {key}')
                values[clean(key).casefold()]=value
    return values



# The composer uses English sounds rather than Korean meanings. Repeated final
# consonants and English consonant clusters receive the conventional ㅡ vowel.
ONSETS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
CODAS = ['', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
VOWEL_SOUNDS = {'AA':'아','AE':'애','AH':'어','AO':'오','AW':'아우','AY':'아이','EH':'에','ER':'어','EY':'에이','IH':'이','IY':'이','OW':'오','OY':'오이','UH':'우','UW':'우'}
CONSONANTS = {'B':'ㅂ','CH':'ㅊ','D':'ㄷ','DH':'ㄷ','F':'ㅍ','G':'ㄱ','HH':'ㅎ','JH':'ㅈ','K':'ㅋ','L':'ㄹ','M':'ㅁ','N':'ㄴ','NG':'ㅇ','P':'ㅍ','R':'ㄹ','S':'ㅅ','SH':'ㅅ','T':'ㅌ','TH':'ㅅ','V':'ㅂ','W':'ㅇ','Y':'ㅇ','Z':'ㅈ','ZH':'ㅈ'}


def syllable(onset,vowel,coda=''):
    return chr(0xAC00 + (ONSETS.index(onset)*21+VOWELS.index(vowel))*28+CODAS.index(coda))


def add_coda(output,coda):
    if output and '가'<=output[-1]<='힣' and (ord(output[-1])-0xAC00)%28==0:
        output[-1]=chr(ord(output[-1])+CODAS.index(coda))
        return True
    return False


def sound_hangul(phones):
    phones=[re.sub(r'[012]','',p) for p in phones]
    phones=[p for at,p in enumerate(phones) if not (p=='R' and at and phones[at-1] in {'AA','AO','ER'} and (at+1==len(phones) or phones[at+1] not in VOWEL_SOUNDS))]
    out=[]
    i=0
    while i<len(phones):
        p=phones[i]
        before=phones[i-1] if i else None
        following=phones[i+1] if i+1<len(phones) else None
        if p in VOWEL_SOUNDS:
            out.extend(VOWEL_SOUNDS[p]);i+=1;continue
        if p not in CONSONANTS:
            i+=1;continue
        # Affricates from a final t+s/d+z are one Korean syllable.
        if (p,following) in {('T','S'),('D','Z')}:
            out.extend('츠' if p=='T' else '즈');i+=2;continue
        onset=CONSONANTS[p]
        vowel_index=i+1
        glide=None
        if following in {'W','Y'} and i+2<len(phones) and phones[i+2] in VOWEL_SOUNDS:
            glide=following;vowel_index=i+2
        if following in VOWEL_SOUNDS or glide:
            v=phones[vowel_index]
            text=VOWEL_SOUNDS[v]
            if p=='W' or glide=='W':
                text={'AA':'와','AE':'왜','AH':'워','AO':'워','AW':'와우','AY':'와이','EH':'웨','ER':'워','EY':'웨이','IH':'위','IY':'위','OW':'워','OY':'워이','UH':'우','UW':'우'}[v]
            elif p=='Y' or glide=='Y':
                text={'AA':'야','AE':'얘','AH':'여','AO':'요','AW':'야우','AY':'야이','EH':'예','ER':'여','EY':'예이','IH':'이','IY':'이','OW':'요','OY':'요이','UH':'유','UW':'유'}[v]
            elif p in {'SH','ZH','CH','JH'}:
                text={'AA':'아','AE':'애','AH':'어','AO':'오','AW':'아우','AY':'아이','EH':'에','ER':'어','EY':'에이','IH':'이','IY':'이','OW':'오','OY':'오이','UH':'우','UW':'우'}[v]
                if p in {'SH','ZH'}:
                    text={'아':'야','애':'애','어':'여','오':'요','우':'유'}.get(text[0],text[0])+text[1:]
            # English medial /l/ is conventionally written with ㄹ on both sides.
            if p=='L' and out:add_coda(out,'ㄹ')
            first=text[0]
            if p not in {'W','Y'}:
                first=chr(ord(first)+(ONSETS.index(onset)-ONSETS.index('ㅇ'))*21*28)
            out.extend(first+text[1:]);i=vowel_index+1;continue
        # English postvocalic /r/ is not given an artificial 르 syllable.
        if p=='R' and before in VOWEL_SOUNDS:
            if before in {'EH','IH','IY'}:out.extend('어')
            i+=1;continue
        if p in {'M','N','NG','L'} and before in VOWEL_SOUNDS:
            if not add_coda(out,{'M':'ㅁ','N':'ㄴ','NG':'ㅇ','L':'ㄹ'}[p]):
                out.extend({'M':'음','N':'은','NG':'응','L':'을'}[p])
            i+=1;continue
        # Short-vowel stops become Korean final consonants; long vowels and
        # diphthongs retain a following 크/트/프 as in 나이트 and 스트라이크.
        if p in {'K','P','T'} and before in {'AE','EH','IH','AH','UH','AA','AO'}:
            coda={'K':'ㄱ','P':'ㅂ','T':'ㅅ'}[p]
            if add_coda(out,coda):i+=1;continue
        out.extend({'CH':'치','JH':'지','SH':'시','ZH':'지','HH':'흐','W':'우','Y':'이','NG':'응'}.get(p,syllable(onset,'ㅡ')))
        i+=1
    return ''.join(out)


def spelling_phones(word):
    # Only used for unreviewed proper words, never for ordinary CMUdict words.
    # Longest graphemes run first so unknown names still receive a phonetic
    # approximation, not a sequence of English letter names.
    rules=[('tion',['SH','AH','N']),('sion',['ZH','AH','N']),('tch',['CH']),('igh',['AY']),('dge',['JH']),('sch',['S','K']),('sh',['SH']),('ch',['CH']),('th',['TH']),('ph',['F']),('ng',['NG']),('ck',['K']),('qu',['K','W']),('ee',['IY']),('ea',['IY']),('oo',['UW']),('ou',['AW']),('ow',['OW']),('ai',['EY']),('ay',['EY']),('oi',['OY']),('oy',['OY']),('au',['AO']),('aw',['AO']),('er',['ER']),('ar',['AA','R']),('or',['AO','R']),('ir',['ER']),('ur',['ER'])]
    single={'a':'AE','b':'B','c':'K','d':'D','e':'EH','f':'F','g':'G','h':'HH','i':'IH','j':'JH','k':'K','l':'L','m':'M','n':'N','o':'AA','p':'P','r':'R','s':'S','t':'T','u':'AH','v':'V','w':'W','x':'K S','y':'IY','z':'Z'}
    letters=re.sub('[^a-z]','',word.lower())
    phones=[];i=0
    while i<len(letters):
        found=False
        for pattern,sounds in rules:
            if letters.startswith(pattern,i):
                phones.extend(sounds);i+=len(pattern);found=True;break
        if found:continue
        letter=letters[i]
        if letter=='e' and i==len(letters)-1 and i>2:
            i+=1;continue
        if i+1<len(letters) and letters[i+1] in 'eiy' and letter in 'cg':
            phones.append('S' if letter=='c' else 'JH')
        else:phones.extend(single.get(letter,'').split())
        i+=1
    return phones


def read_word(word,dictionary,overrides,fallback):
    canonical=word.lower().replace('’',"'")
    if word in ABBREVIATIONS and word not in {'A','I'}:return word
    if canonical in {'ws','bs','ld','ap'}:return {'ws':'WS','bs':'BS','ld':'Ld','ap':'AP'}[canonical]
    if canonical in overrides:return overrides[canonical]
    if canonical in dictionary:return sound_hangul(dictionary[canonical][0])
    # Productive possessives and plurals retain the base proper-name reading.
    if canonical.endswith("'s") and canonical[:-2] in overrides:return overrides[canonical[:-2]]+'스'
    if canonical.endswith('s') and canonical[:-1] in overrides:return overrides[canonical[:-1]]+'스'
    # Compound fantasy names commonly combine reviewed English roots.
    for split in range(len(canonical)-3,2,-1):
        left,right=canonical[:split],canonical[split:]
        if (left in overrides or left in dictionary) and (right in overrides or right in dictionary):
            return read_word(left,dictionary,overrides,fallback)+read_word(right,dictionary,overrides,fallback)
    fallback.add(canonical)
    return sound_hangul(spelling_phones(canonical))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--unknown-only',action='store_true')
    parser.add_argument('--strict',action='store_true',help='Fail if any pronunciation needs review or a translated label contains unapproved Latin text')
    args=parser.parse_args()
    import cmudict
    from importlib.metadata import version
    if version('cmudict') != '1.1.3':
        raise SystemExit('Install the pinned pronunciation dictionary: python -m pip install cmudict==1.1.3')
    dictionary=cmudict.dict()
    labels=extract_labels()
    name_keys=set(extract_labels(include_articles=False))
    overrides=load_overrides()
    # Keep reviewed aliases available even when a catalog currently spells the
    # same unit differently or only exposes its lower-case index key.
    for path in sorted(SCRIPT.glob('phonetic-*-overrides.json')):
        reviewed=[clean(key) for key in json.loads(path.read_text()) if not key.startswith('_')]
        labels.extend(reviewed)
        name_keys.update(reviewed)
    labels=sorted(set(labels),key=lambda value:(value.casefold(),value))
    counts=Counter(word.lower().replace('’',"'") for label in labels for word in WORD_RE.findall(label))
    unknown={word:count for word,count in counts.most_common() if word not in dictionary and word not in overrides and word not in {x.lower() for x in ABBREVIATIONS}}
    Path('/tmp/phonetic-unknown-tokens.json').write_text(json.dumps(unknown,ensure_ascii=False,indent=2)+'\n')
    Path('/tmp/phonetic-catalog-labels.json').write_text(json.dumps(labels,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(labels)} labels, {len(counts)} tokens, {len(unknown)} non-dictionary tokens before compound/possessive resolution')
    if args.unknown_only:return
    fallback=set()
    tokens={word:read_word(word,dictionary,overrides,fallback) for word in sorted(counts)}
    values={}
    for label in labels:
        exact=overrides.get(label.casefold())
        def replacement(match):
            raw=match[0]
            if NOTATION_RE.fullmatch(raw):return raw
            if raw in ABBREVIATIONS and (label==raw or re.search(r'[\(+-]\s*$',label[:match.start()])):return raw
            return read_word(raw,dictionary,overrides,fallback)
        values[label]=exact if exact is not None else LABEL_RE.sub(replacement,label)
    coverage={'engine':'cmudict-1.1.3 + ARPAbet/Hangul composer + curated phonetic overrides','labels':len(labels),'nameKeys':len(name_keys),'tokens':len(tokens),'curatedOverrides':len(overrides),'phoneticFallbackTokens':sorted(fallback),'latinLabels': [key for key,value in values.items() if any(word not in ABBREVIATIONS for word in WORD_RE.findall(NOTATION_RE.sub('',value)))]}
    output={'version':1,'labels':values,'nameKeys':sorted(name_keys,key=lambda value:(value.casefold(),value)),'tokens':tokens,'coverage':coverage}
    (DIST/'phonetic-names.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
    (DIST/'phonetic-names.js').write_text('// Generated by scripts/build-phonetic-names.py. Display names only. CMUdict notice: licenses/cmudict.txt.\nwindow.TOWPhoneticNames='+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';\n')
    Path('/tmp/phonetic-unreviewed-tokens.json').write_text(json.dumps(sorted(fallback),ensure_ascii=False,indent=2)+'\n')
    print(f'Generated {len(values)} Hangul labels; {len(fallback)} spelling fallbacks; {len(coverage["latinLabels"])} labels contain Latin text')
    if args.strict and (fallback or coverage['latinLabels']):
        raise SystemExit('Pronunciation review required; see /tmp/phonetic-unreviewed-tokens.json and generated coverage')

if __name__=='__main__':main()
