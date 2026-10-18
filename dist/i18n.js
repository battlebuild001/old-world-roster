'use strict';
// Display translations only. Army IDs, selection keys, links and saved rosters remain canonical.
window.TOWI18n = (() => {
  const KEY='bth_tow_language';
  const MODES=['ko','en','both'];
  let language=MODES.includes(localStorage.getItem(KEY))?localStorage.getItem(KEY):'ko';
  let ko={},en={},koKeys=[],enKeys=[],koLower={},legacyKo={},termAliases=[];
  const sources=new WeakMap(),shown=new WeakMap(),cache=new Map();
  let pending=new WeakMap();
  const HANGUL=/[가-힣]/, LATIN=/[A-Za-z]/;
  const BUILTIN_KO={Characters:'캐릭터',Core:'코어',Special:'스페셜',Rare:'레어',Model:'모델',Range:'사거리',Strength:'근력','Armour Piercing':'장갑 관통','Special Rules':'특수 규칙',Notes:'설명',Parent:'상위 항목',Combat:'근접전','Hand weapon':'한손 무기','hand weapon':'한손 무기','Great weapon':'대형 무기','Armour Bane':'아머 베인','Requires Two Hands':'양손 사용','Strike Last':'마지막에 공격','Ensorcelled Weapons':'마력이 깃든 무기','Chaos Armour {warriors of chaos}':'카오스 아머(워리어 오브 카오스)','Chaos Armour {daemons of chaos}':'카오스 아머(카오스 데몬)','Magical Attacks':'마법 공격','Ward save':'와드 세이브','ward save':'와드 세이브','armour value':'장갑 수치',Wizard:'위저드',Lance:'랜스',Shield:'방패',General:'장군','Grand Army':'그랜드 아미','Kingdom of Bretonnia':'브레토니아 왕국','Knights of the Realm':'왕국의 기사','Battle Standard Bearer':'배틀 스탠더드 베어러','The Lady of the Lake':'호수의 여인','Blessings of the Lady':'호수의 여인의 축복','The Old World':'올드 월드','Rules Index':'규칙 색인'};
  const BUILTIN_EN={'진영':'Factions','진영 선택':'Choose faction','자료':'Reference','편성':'Build','로스터':'Roster','저장':'Saved','유닛':'unit','유닛 수':'Units','모델 수':'Models','모델':'models','개':'','규칙':'Rule','무장 스펙':'Weapon profile','무기':'Weapons','방어구':'Armour','추가 옵션':'Additional options','탈것':'Mounts','커맨드':'Command','지휘부':'Command','선택 옵션':'Options','최소':'Minimum','최대':'Maximum','이름 없는 유닛':'Unnamed unit','선택':'Select','추가':'Add','수정':'Edit','삭제':'Delete','복제':'Duplicate','총 포인트':'Total points','로스터 편성 도구':'Roster builder','Army Reference':'Army Reference','유닛 자료':'Unit reference','앱 화면':'App screens','군세 설정':'Army settings','저장된 로스터':'Saved rosters','특수 규칙 · 키워드':'Special rules · Keywords','선택하여 열기':'Select to open','현재 진영':'Current faction','아직 소집된 유닛이 없습니다':'No units have been recruited yet','왼쪽에서 유닛을 선택하고 로스터에 추가하세요.':'Select a unit from the left and add it to the roster.'};
  // Former meanings are retained only as search aliases and for identifying names in translated prose.
  const RULE_NAMES_KO={
    'Fly':'비행','Feigned Flight':'위장 도주','Close Order':'밀집 대형','Open Order':'개방 대형','Cold Blooded':'냉혈','Arcane Shield':'비전 방패',
    'Swiftstride':'신속 보행','Skirmishers':'척후병','Warband':'전투단','Terror':'섬뜩함','Fear':'공포','Immune to Psychology':'심리 규칙 면역','Large Target':'대형 목표','Stubborn':'완강','Regeneration':'재생','First Charge':'첫 돌격','Move Through Cover':'엄폐물 통과 이동','Elven Reflexes':'엘프의 반사 신경','Counter Charge':'역돌격','Magic Resistance':'마법 저항','Necromantic Undead':'강령술 언데드','Horde':'대군단','Indomitable':'불굴','Impetuous':'성급함','Furious Charge':'맹렬한 돌격','Resolute':'굳센 의지','Loner':'단독 행동','Rallying Cry':'집결의 외침','Flammable':'인화성','Ensorcelled Weapons':'마력이 깃든 무기','Nehekharan Undead':'네헤카라 언데드','Daemonic':'데몬','Hatred':'증오','Unbreakable':'불굴','Primal Fury':'원초적 분노','Poisoned Attacks':'독 공격','Magical Attacks':'마법 공격','Armour Bane':'아머 베인','Vanguard':'선봉대','Veteran':'베테랑','Fire & Flee':'사격 후 도주','Scurry Away':'황급히 도주','Evasive':'회피','Motley Crew':'잡다한 부대','Fast Cavalry':'경기병','Valour of Ages':'오랜 세월의 용맹','Regimental Unit':'연대 유닛','Levies':'징집병','Stomp Attacks':'짓밟기 공격','Impact Hits':'충격 타격','Detachment':'분견대','Shieldwall':'방패벽','Drilled':'숙련병','Reserve Move':'예비 이동','Random Attacks':'무작위 공격 횟수','Random Movement':'무작위 이동','Flaming Attacks':'화염 공격','Strike First':'선제 공격','Strike Last':'마지막 공격','Requires Two Hands':'양손 사용','Scouts':'정찰병','Ambushers':'매복자','Handgun':'핸드건','Handguns':'핸드건','Repeater Handgun':'연발 핸드건'
  };
  Object.assign(BUILTIN_KO,{fly:'비행',Fly:'비행','Fly (8)':'비행 (8)','Fly (9)':'비행 (9)','Fly (10)':'비행 (10)',handgun:'핸드건',Handgun:'핸드건',Handguns:'핸드건','Feigned Flight':'위장 도주','Close Order':'밀집 대형','Open Order':'개방 대형'});
  function nameLabel(raw,mode=language){return window.TOWPhonetic?.label(raw,mode)??raw;}
  function ruleLabel(raw,mode=language){return nameLabel(String(raw).trim(),mode);}
  function phonetic(raw){return window.TOWPhonetic?.korean(raw)??raw;}
  function searchNames(raw){return [String(raw),phonetic(raw),legacyKo[raw]||koLower[String(raw).toLowerCase()]||''].join(' ');}
  function phoneticTerms(text,source=''){
    let result=String(text),original=String(source).toLowerCase();
    for(const [english,old,newName] of termAliases){
      if(english.test(original)&&result.includes(old))result=result.replaceAll(old,newName);
    }
    return result;
  }
  function keysOf(obj){return Object.keys(obj).filter(x=>x.length>1).sort((a,b)=>b.length-a.length);}
  function setGlossary(target,value){if(target==='ko'){ko={...value,...BUILTIN_KO};legacyKo={...ko,...RULE_NAMES_KO};koKeys=keysOf(ko);koLower=Object.fromEntries(Object.entries(ko).map(([key,label])=>[key.toLowerCase(),label]));termAliases=Object.entries(legacyKo).filter(([key,old])=>window.TOWPhonetic?.has(key)&&HANGUL.test(old)&&!LATIN.test(old)&&old.length>1&&old!==phonetic(key)).map(([key,old])=>[new RegExp('(^|[^a-z])'+key.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'s?($|[^a-z])','i'),old,phonetic(key)]).sort((a,b)=>b[1].length-a[1].length);}else{en={...value,...BUILTIN_EN};enKeys=keysOf(en);}refresh();}
  async function load(){
    const results=await Promise.allSettled([fetch('./translations-ko.json').then(r=>r.json()),fetch('./translations-ui-en.json').then(r=>r.json())]);
    if(results[0].status==='fulfilled')setGlossary('ko',results[0].value);
    if(results[1].status==='fulfilled')setGlossary('en',results[1].value);
    document.dispatchEvent(new Event('tow-glossary-ready'));
  }
  function replaceKnown(raw,dictionary,keys,bilingual=false){
    if(dictionary===ko&&window.TOWPhonetic?.has(raw))return nameLabel(raw,bilingual?'both':'ko');
    if(dictionary===ko && /^fly(?: \([^)]*\))?$/i.test(raw.trim())){const value=ruleLabel(raw,'ko');return bilingual?`${value} · ${raw}`:value;}
    if(Object.hasOwn(dictionary,raw))return bilingual?`${dictionary[raw]} · ${raw}`:dictionary[raw];
    if(dictionary===ko){
      const lowered=koLower[raw.toLowerCase()];
      if(lowered)return bilingual?`${lowered} · ${raw}`:lowered;
      const numbered=raw.match(/^(.*?) (\(\d+\))$/);
      if(numbered&&koLower[numbered[1].toLowerCase()]){
        const translation=`${koLower[numbered[1].toLowerCase()]} ${numbered[2]}`;
        return bilingual?`${translation} · ${raw}`:translation;
      }
      if(raw.length<160){
        const parts=raw.split(/( · |, | \/ )/);
        if(parts.length>1){
          const joined=parts.map(part=>{
            const exact=window.TOWPhonetic?.has(part)?phonetic(part):koLower[part.toLowerCase()];
            const numbered=part.match(/^(.*?) (\(\d+\))$/);
            const translated=exact||(numbered&&koLower[numbered[1].toLowerCase()]?`${koLower[numbered[1].toLowerCase()]} ${numbered[2]}`:null);
            return translated?(bilingual?`${translated} · ${part}`:translated):part;
          }).join('');
          if(joined!==raw)return joined;
        }
      }
    }
    let result=raw;
    for(const key of keys){
      if(key.length<4 || !result.includes(key))continue;
      // Avoid replacing small labels inside a longer name or natural-language sentence.
      if(key.length<8 && LATIN.test(key[0]) && result.length>key.length+35)continue;
      result=result.replaceAll(key,bilingual?`${dictionary[key]} · ${key}`:dictionary[key]);
    }
    return result;
  }
  function englishNumbers(raw){return raw.replace(/(\d+)개 편성/g,(_,n)=>`${n} ${n==='1'?'formation':'formations'}`).replace(/(\d+)개 규칙/g,(_,n)=>`${n} ${n==='1'?'rule':'rules'}`).replace(/(\d+) 유닛 표시/g,(_,n)=>`${n} units shown`).replace(/(\d+) 유닛/g,(_,n)=>`${n} ${n==='1'?'unit':'units'}`).replace(/(\d+) 모델/g,(_,n)=>`${n} ${n==='1'?'model':'models'}`).replace(/최소 (\d+)/g,'Minimum $1').replace(/최대 (\d+)/g,'Maximum $1').replace(/규칙 ·/g,'Rule ·').replace(/pts\/모델/g,'pts/model');}
  function display(raw,mode=language){
    if(!raw?.trim())return raw;
    if(/^(?:M|WS|BS|S|T|W|I|A|Ld|S[+-]\d+)$/.test(raw.trim()))return raw;
    if(window.TOWPhonetic?.has(raw))return nameLabel(raw,mode);
    if(mode==='en')return HANGUL.test(raw)?replaceKnown(englishNumbers(raw),en,enKeys):raw;
    if(mode==='both' && HANGUL.test(raw)){
      const korean=LATIN.test(raw)?replaceKnown(raw,ko,koKeys):raw;
      const english=replaceKnown(englishNumbers(raw),en,enKeys);
      return english!==raw?`${korean} / ${english}`:korean;
    }
    return LATIN.test(raw)?replaceKnown(raw,ko,koKeys,mode==='both'):raw;
  }
  function setText(node,raw){
    const value=display(raw);
    if(node.nodeValue!==value)node.nodeValue=value;
    shown.set(node,value);
    if(language!=='en' && node.parentElement?.closest('#ruleContent') && LATIN.test(raw) && raw.trim().length>35)queueRuleTranslation(node,raw);
    else if(language!=='ko' && HANGUL.test(raw) && (language==='en'?HANGUL.test(value):!value.includes(' / ')) && raw.trim().length<120 && !node.parentElement?.closest('#rosterTitle,.unit-name,.unit-detail,.savedCard,.detailNotes,#armyName,#armyNotes'))queueTranslation(node,raw,'ko','en');
  }
  function translateTextNode(node){
    if(!node.parentElement || node.parentElement.closest('script,style,textarea,[data-no-i18n]'))return;
    const current=node.nodeValue;
    if(!sources.has(node) || (shown.has(node) && shown.get(node)!==current))sources.set(node,current);
    setText(node,sources.get(node));
  }
  function translateAttributes(element){
    if(element.hasAttribute('data-no-i18n'))return;
    for(const attr of ['placeholder','aria-label','title']){
      const value=element.getAttribute(attr);
      if(value===null)continue;
      const key=`i18nSource${attr.replace('-','')}`,last=`i18nShown${attr.replace('-','')}`;
      if(element[key]===undefined||element[last]!==value)element[key]=value;
      const next=display(element[key]);
      element[last]=next;if(value!==next)element.setAttribute(attr,next);
    }
  }
  function walk(root){
    if(root.nodeType===Node.TEXT_NODE){translateTextNode(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE)return;
    if(root.matches('script,style,textarea,[data-no-i18n]'))return;
    translateAttributes(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const item=walker.currentNode;
      if(item.nodeType===Node.TEXT_NODE)translateTextNode(item);
      else translateAttributes(item);
    }
  }
  function refresh(){document.documentElement.lang=language==='en'?'en':'ko';document.querySelectorAll('[data-language]').forEach(button=>{button.classList.toggle('active',button.dataset.language===language);button.setAttribute('aria-pressed',String(button.dataset.language===language));});walk(document.body);}
  function setLanguage(next){if(!MODES.includes(next))return;language=next;pending=new WeakMap();localStorage.setItem(KEY,next);refresh();document.dispatchEvent(new CustomEvent('tow-language-change',{detail:{language:next}}));}
  function translateRemote(raw,from,to){
    const key=`${from}:${to}:${raw}`;
    if(cache.has(key))return cache.get(key);
    const promise=fetch('https://translate.googleapis.com/translate_a/single?'+new URLSearchParams({client:'gtx',sl:from,tl:to,dt:'t',q:raw})).then(r=>{if(!r.ok)throw Error('translation unavailable');return r.json();}).then(data=>data[0].map(part=>part[0]).join('')).catch(()=>null);
    cache.set(key,promise);return promise;
  }
  function queueTranslation(node,raw,from,to){
    if(pending.get(node)===raw)return;
    pending.set(node,raw);
    translateRemote(raw.trim(),from,to).then(value=>{
      if(!value||!node.isConnected||sources.get(node)!==raw||pending.get(node)!==raw||language==='ko')return;
      const known=display(raw);
      const output=language==='en'&&!HANGUL.test(known)?known:language==='both'&&known.includes(' / ')?known:language==='both'?`${raw.trim()} / ${value}`:value;
      const result=raw.replace(raw.trim(),output);node.nodeValue=result;shown.set(node,result);
    });
  }
  function queueRuleTranslation(node,raw){
    if(pending.get(node)===raw)return;
    pending.set(node,raw);
    translateRemote(raw.trim(),'en','ko').then(value=>{
      if(!value||!node.isConnected||sources.get(node)!==raw||pending.get(node)!==raw||language==='en')return;
      const localized=phoneticTerms(value,raw),translated=language==='both'?`${localized} (${raw.trim()})`:localized;
      const result=raw.replace(raw.trim(),translated);node.nodeValue=result;shown.set(node,result);
      node.parentElement.title=raw.trim();
    });
  }
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData'){
        if(shown.get(record.target)!==record.target.nodeValue)walk(record.target);
      }
      else if(record.type==='attributes')translateAttributes(record.target);
      else for(const item of record.addedNodes)walk(item);
    }
  });
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
    refresh();observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});load();
  });
  return {get language(){return language;},setLanguage,display,nameLabel,ruleLabel,phonetic,phoneticTerms,searchNames,statLabel:(key,mode=language)=>window.TOWPhonetic?.stat(key,mode)||key,refresh,translateRuleText:raw=>translateRemote(raw,'en','ko')};
})();
