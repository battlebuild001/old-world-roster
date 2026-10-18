'use strict';

// Army data and selectable upgrades come from the attributed Old World Builder dataset.
const CORE = window.BTHTOWCore;
const OPT = window.BTHTOWOptions;
const CATEGORY_KEYS = CORE.CATEGORIES;
const CATEGORY_LABELS = {characters:'Characters', core:'Core', special:'Special', rare:'Rare',mercenaries:'Mercenaries'};
const $ = id => document.getElementById(id);
const whole = (value, min, max) => Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));
const fmt = value => value.toLocaleString('ko-KR');
const slugTitle = value => String(value).split('-').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ');
const labelOf = value => value?.name_en || value?.name_de || value?.id || '이름 없는 유닛';
function pairedName(original) {
  const name=String(original||'');
  if(window.TOWI18n?.language==='en')return name;
  const translated=window.TOWI18n?.display(name,'ko')||name;
  return translated!==name?`${translated} · ${name}`:name;
}
function sourceName(tag,original,className='') {const element=node(tag,pairedName(original),className);element.dataset.noI18n='';return element;}
const ITEM_TYPE_NAMES={
  weapon:['마법 무기','Magic Weapons'],armor:['마법 갑옷','Magic Armour'],'armor-mages':['마법사 갑옷','Wizard Armour'],talisman:['부적','Talismans'],'arcane-item':['비전 아이템','Arcane Items'],'enchanted-item':['마법 부여 아이템','Enchanted Items'],banner:['마법 깃발','Magic Banners'],
  'weapon-runes':['무기 룬','Weapon Runes'],'ranged-weapon-runes':['원거리 무기 룬','Ranged Weapon Runes'],'armor-runes':['갑옷 룬','Armour Runes'],'talismanic-runes':['부적 룬','Talismanic Runes'],'banner-runes':['깃발 룬','Banner Runes'],'engineering-runes':['공학 룬','Engineering Runes'],'runic-tattoos':['룬 문신','Runic Tattoos'],
  'knightly-virtue':['기사의 미덕','Knightly Virtues'],'forest-spite':['숲의 정령','Forest Spites'],'gift-of-chaos':['혼돈의 선물','Gifts of Chaos'],'chaos-mutation':['혼돈의 변이','Chaos Mutations'],'chaotic-trait':['혼돈의 특성','Chaotic Traits'],'elven-honour':['엘프 명예','Elven Honours'],'discipline-old-ones':['고대 존재의 가르침','Disciplines of the Old Ones'],'big-name':['위대한 이름','Big Names'],'vampiric-power':['흡혈귀의 권능','Vampiric Powers'],'forbidden-poison':['금지된 독','Forbidden Poisons'],'gift-of-khaine':['케인의 선물','Gifts of Khaine'],kindred:['킨드레드','Kindreds'],'incantation-scroll':['주문 두루마리','Incantation Scrolls']
};
function itemTypeName(type){const fallback=type?slugTitle(String(type).replaceAll('-',' ')):'Other',names=ITEM_TYPE_NAMES[type]||[type?fallback:'기타',fallback],mode=window.TOWI18n?.language||'ko';return mode==='en'?names[1]:mode==='both'?`${names[0]} / ${names[1]}`:names[0];}
function itemTypes(items){const priority=['weapon','armor','armor-mages','talisman','arcane-item','enchanted-item','banner'];return [...new Set(items.map(item=>item.type||''))].sort((a,b)=>{const ai=priority.indexOf(a),bi=priority.indexOf(b);return (ai<0?100:ai)-(bi<0?100:bi)||a.localeCompare(b);});}
const {fresh,normalize,normalizeUnit,unitsForComposition} = CORE;
let state = CORE.loadCurrent();
let metadata = null, armyData = null, catalog = new Map(), editing = null, manualPoints = false;
const requestedScreen = new URLSearchParams(location.search).get('screen');
let screen = ['home','factions','reference','forge','roster','rules','quicksheet','saved','play'].includes(requestedScreen) ? requestedScreen : 'home';
let rulesIndex = {}, ruleAliases = {additional:{},synonyms:{}}, detailUnit = null, ruleIndexPromise = null;
let ruleRequestId = 0;
let currentRulePath = null, currentRuleInfo = null;
let configured = null, magicData = null;
let playWeaponProfiles=null;
const armyCache = new Map();
let mercenaryPool = [];

function save() { $('saveStatus').textContent = CORE.saveArmy(state) ? '● 이 브라우저에 자동 저장됨' : '저장 공간 부족 · JSON으로 내보내세요'; }
function update() { save(); render(); }
function node(tag, text, className) { const element = document.createElement(tag); if (className) element.className = className; element.textContent = text; return element; }
function toast(message) { document.querySelector('.toast')?.remove(); const element = node('div',message,'toast'); element.setAttribute('role','status'); document.body.append(element); setTimeout(() => element.remove(),2800); }
function option(value, text) { const element = document.createElement('option'); element.value = value; element.textContent = text; return element; }
function keywords(unit) { return String(unit?.specialRules?.name_en || '').split(', ').map(value=>value.trim()).filter(Boolean); }
function ruleKey(value) { return String(value).toLowerCase().replace(/\s*\([^)]*\)/g,'').replace(/[{}\[\]*]/g,'').replace(/^[0-9]x /,'').replace(/[“”]/g,'"').trim(); }
function ruleInfo(value) {
  const key=ruleKey(value),withoutRenegade=key.replace(/ renegade$/,'');
  const embedded=String(value).match(/\(([^()]*)\)/)?.[1];
  for(const candidate of [key,withoutRenegade,embedded&&ruleKey(embedded)]){
    if(!candidate)continue;
    const alias=ruleAliases.synonyms[candidate];
    const found=rulesIndex[candidate] || ruleAliases.additional[candidate] || (alias && (rulesIndex[alias] || ruleAliases.additional[alias]));
    if(found)return found;
  }
  return null;
}
function splitRuleNames(value) {
  const names=[];let part='',depth=0;
  for(const char of String(value||'')){
    if(char==='(')depth++;
    if(char===')')depth=Math.max(0,depth-1);
    if(!depth && (char===','||char==='['||char==='+')){if(part.trim())names.push(part.trim());part='';}
    else if(char!==']')part+=char;
  }
  if(part.trim())names.push(part.trim());return names;
}
function linkedRuleNames(value,includeUnknown=false) {return splitRuleNames(value).filter(name=>name && (includeUnknown||ruleInfo(name)));}
function optionRuleLinks(value,label='규칙') {const names=linkedRuleNames(value,label==='무장 스펙');if(!names.length)return null;const links=node('div','','optionRuleLinks');for(const name of names){const button=ruleChip(name),language=window.TOWI18n?.language||'ko',prefix=language==='en'?(label==='무장 스펙'?'Weapon profile':'Rule'):language==='both'?(label==='무장 스펙'?'무장 스펙 / Weapon profile':'규칙 / Rule'):label;button.textContent=`${prefix} · ${window.TOWI18n?.ruleLabel(name)||name}`;links.append(button);}return links;}
function sourceUnit(id,faction=state.faction) {const data=armyCache.get(faction)|| (faction===state.faction?armyData:null);for(const category of CATEGORY_KEYS) {const found=data?.[category]?.find(unit=>unit.id===id);if(found)return {...found,category:unitCategory(found,data,category),_sourceFaction:faction,_optionComposition:faction===state.faction?state.composition:faction};} return null; }
function unitCategory(unit,data,fallback){if(fallback==='mercenaries')return fallback;return unit.armyComposition?.[state.composition]?.category||fallback;}
function rosterSource(unit,army=state) {if(!unit.sourceId)return null;const faction=unit.sourceFaction||army.faction,source=sourceUnit(unit.sourceId,faction);return source?{...source,category:unit.category,_optionComposition:unit.sourceComposition||(faction===army.faction?army.composition:faction)}:null;}
function configuredSource(unit) {return rosterSource(unit,state);}
function playText(ko,en){const language=window.TOWI18n?.language||'ko';return language==='en'?en:language==='both'?`${ko} / ${en}`:ko;}
function ruleChip(value) {const button=node('button',window.TOWI18n?.ruleLabel(value)||value,'rulePill');button.type='button';button.dataset.rule=value;button.dataset.noI18n='';button.title=ruleInfo(value)?(window.TOWI18n?.language==='en'?'Open source rule':'규칙 원문 보기'):(window.TOWI18n?.language==='en'?'No source index link':'규칙 색인 링크 없음');return button;}
function renderModelProfile(unit,targetId) {
  const target=$(targetId),info=ruleInfo(labelOf(unit));target.replaceChildren();
  if(!info?.stats?.length){target.classList.add('hidden');return;}
  const wrap=node('div','','modelProfileWrap'),table=node('table','','modelProfile');
  const keys=['Name','M','WS','BS','S','T','W','I','A','Ld'];
  const head=node('tr','');for(const key of keys)head.append(node('th',key==='Name'?'Model':key));table.append(head);
  for(const stats of info.stats){const row=node('tr','');for(const key of keys)row.append(node('td',stats[key]||'-'));table.append(row);}
  wrap.append(table);target.append(wrap);
  const hint=node('p',playText('↔ 좌우로 이동해 전체 능력치 보기','↔ Swipe to view the complete profile'),'profileScrollHint');hint.dataset.noI18n='';target.append(hint);target.classList.remove('hidden');
}

function armyName() { return metadata?.armies?.find(army => army.id === state.faction)?.name_en || slugTitle(state.faction); }
function compositionName() { return slugTitle(state.composition); }
function matchedModeName(army=state){const mode=window.TOWMatchedPlay.MODES[army.matchedMode]||window.TOWMatchedPlay.MODES['open-war'];return `${mode.ko} · ${mode.en}`;}
function matchedFindings(army=state){return window.TOWMatchedPlay.check(army,unit=>rosterSource(unit,army),(source,unit)=>OPT.describe(source,unit.selections,unit.magicItems,unit.sourceComposition||source._optionComposition||army.composition));}
function renderMatchedStatus(){
  const panel=$('matchedStatus'),mode=window.TOWMatchedPlay.MODES[state.matchedMode]||window.TOWMatchedPlay.MODES['open-war'],findings=matchedFindings(),expanded=panel.querySelector('details')?.open;
  panel.replaceChildren();const details=document.createElement('details');details.className='matchedDetails';details.open=Boolean(expanded||findings.some(item=>item.kind==='error'));
  const head=node('summary','','matchedHead');head.append(node('strong',matchedModeName()),node('span',findings.some(item=>item.kind==='error')?playText('제한 초과','Check list'):findings.length?playText('확인 필요','Review'):playText('추가 경고 없음','No warnings'),'matchedBadge'));details.append(head);
  const body=node('div','','matchedBody'),link=node('a',playText('원문 규칙 ↗','Source rule ↗'),'matchedSource');link.href=mode.url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
  if(state.matchedMode==='combined-arms')body.append(node('p','동일 유닛 종류별 한도: 캐릭터 3 · 코어 4 · 스페셜 3 · 레어/용병 2. 2,000pts 초과 시 완성된 1,000pts마다 각 한도 +1. 원래 제한된 선택, 이름 있는 캐릭터, 분견대는 제외합니다.','matchedHint'));
  if(state.matchedMode==='grand-melee')body.append(node('p','단일 유닛·캐릭터 25% 이하, 한 유닛의 모델 수 50% 이하. 3레벨 마법사는 1,000pts당 1명, 4레벨은 2,000pts당 1명까지. 이름 있는 캐릭터는 제외합니다.','matchedHint'));
  for(const finding of findings)body.append(node('p',`${finding.kind==='error'?'⚠':'ℹ'} ${playText(finding.ko,finding.en)}`,'matchedFinding '+finding.kind));
  body.append(node('p',playText('진영별 편성 비율과 용병 조건 등은 원본 군세 목록도 확인하세요.','Check faction limits and mercenary conditions in the original army list.'),'matchedFoot'));details.append(body);panel.append(details);
}
function renderSettings() {
  $('armyName').value = state.name;
  $('pointLimit').value = state.limit;
  $('armyNotes').value = state.notes;
  $('matchedMode').value = state.matchedMode||'open-war';
  $('brandSub').textContent = `${armyName()} · 로스터 편성 도구`;
  if (metadata) {
    const previous = $('faction').value;
    $('faction').replaceChildren(...metadata.armies.map(army => option(army.id,army.name_en || slugTitle(army.id))));
    $('faction').value = metadata.armies.some(army => army.id === state.faction) ? state.faction : previous;
    const current = metadata.armies.find(army => army.id === state.faction);
    const compositions = current?.armyComposition || [state.faction];
    if (!compositions.includes(state.composition)) state.composition = compositions[0];
    $('armyType').replaceChildren(...compositions.map(id => option(id,slugTitle(id))));
    $('armyType').value = state.composition;
  }
}
function renderRoster() {
  const total = state.units.reduce((sum,unit) => sum + unit.points,0);
  const models = state.units.reduce((sum,unit) => sum + unit.count,0);
  const remaining = state.limit - total;
  $('rosterTitle').textContent = state.name || '새 군세';
  $('confirmRoster').textContent=playText('확정하고 플레이','Confirm & play');
  $('confirmRoster').disabled=!state.units.length;
  const factionLabel=armyName(),formationLabel=compositionName();
  $('rosterSubtitle').textContent = `${factionLabel}${formationLabel.toLowerCase()===factionLabel.toLowerCase()?'':` · ${formationLabel}`} · ${matchedModeName()} · ${fmt(state.limit)} pts`;
  renderMatchedStatus();
  $('totalPoints').innerHTML = `${fmt(total)} <small>pts</small>`;
  $('remainingPoints').innerHTML = `${fmt(remaining)} <small>pts</small>`;
  $('unitTotal').textContent=fmt(state.units.length);
  $('modelTotal').textContent=fmt(models);
  $('totalMetric').classList.toggle('over',remaining < 0);
  $('progressFill').style.width = `${Math.min(100,Math.max(0,total/state.limit*100))}%`;
  const body = $('rosterBody'); body.replaceChildren();
  if (!state.units.length) {
    const empty = node('div','','empty');
    empty.innerHTML = '<div class="empty-icon" aria-hidden="true">⚜</div><h4>아직 소집된 유닛이 없습니다</h4><p>유닛 자료에서 유닛을 선택하고 로스터에 추가하세요.</p>';
    body.append(empty);
  }
  for (const category of CATEGORY_KEYS) {
    const units = state.units.filter(unit => unit.category === category);
    if (!units.length) continue;
    const group = node('div','','group');
    const header = node('div','','group-header');
    header.append(node('h4',CATEGORY_LABELS[category]),node('span',`${fmt(units.reduce((sum,unit) => sum + unit.points,0))} pts`));
    group.append(header);
    for (const unit of units) {
      const card = node('article','','unit');
      const left = node('div',''); left.append(sourceName('div',unit.name,'unit-name'));
      let detail = `${fmt(unit.count)} 모델`;
      if (unit.label) detail += ` · ${unit.label}`;
      if (unit.isDetachment) detail += ' · 분견대 / Detachment';
      const source=configuredSource(unit);
      if(source && unit.selections){const chosen=OPT.describe(source,unit.selections,[],optionComposition(source));if(chosen.length)detail += `\n${chosen.join(' · ')}`;}
      if(unit.lore)detail += `\n${slugTitle(unit.lore)}`;
      if (unit.options) detail += `\n${unit.options}`;
      left.append(node('div',detail,'unit-detail'));
      if(unit.magicItems?.length){const items=node('div','','unitItemNames');const seen=new Set();for(const item of unit.magicItems){const key=`${item.group}\u0000${item.name}`;if(seen.has(key))continue;seen.add(key);const copies=unit.magicItems.filter(value=>value.group===item.group&&value.name===item.name).length;const line=node('div','','unitItemName');line.append(sourceName('span',item.name));if(copies>1)line.append(node('b',`×${copies}`));items.append(line);}left.append(items);}
      if(source){const ruleList=keywords(source);if(ruleList.length){const strip=node('div','','rulePills unitRules');for(const rule of ruleList.slice(0,4))strip.append(ruleChip(rule));if(ruleList.length>4)strip.append(node('span',`+${ruleList.length-4}`,'ruleMore'));left.append(strip);}}
      const right = node('div','','unit-side');
      const points = node('div','','unit-points'); points.append(document.createTextNode(fmt(unit.points)),node('small','pts')); right.append(points);
      const controls = node('div','','unit-controls');
      for (const [action,label,className] of [...(source?[['details','규칙','ghost']]:[]),['edit','수정','ghost'],['duplicate','복제','ghost'],['delete','삭제','ghost danger']]) {
        const button = node('button',label,className); button.type = 'button'; button.dataset.action = action; button.dataset.id = unit.id; controls.append(button);
      }
      right.append(controls); card.append(left,right); group.append(card);
    }
    body.append(group);
  }
  const breakdown = $('breakdown'); breakdown.replaceChildren();
  for (const category of CATEGORY_KEYS) {
    const points = state.units.filter(unit => unit.category === category).reduce((sum,unit) => sum + unit.points,0);
    const chip = node('span','','chip'); chip.append(document.createTextNode(`${CATEGORY_LABELS[category]} `),node('b',`${fmt(points)} pts`)); breakdown.append(chip);
  }
}
function renderHome() {
  const language=window.TOWI18n?.language||'ko';
  const label=(ko,en)=>language==='en'?en:language==='both'?ko+' / '+en:ko;
  const factionKo={'renegade-crowns':'레니게이드 크라운','empire-of-man':'인간의 제국','orc-and-goblin-tribes':'오크와 고블린 부족','dwarfen-mountain-holds':'드워프 산 요새','warriors-of-chaos':'카오스 워리어','kingdom-of-bretonnia':'브레토니아 왕국','beastmen-brayherds':'비스트맨 브레이허드','wood-elf-realms':'우드 엘프 영역','tomb-kings-of-khemri':'켐리의 툼킹','high-elf-realms':'하이 엘프 영역','dark-elves':'다크 엘프','skaven':'스케이븐','vampire-counts':'뱀파이어 백작','daemons-of-chaos':'카오스의 데몬','ogre-kingdoms':'오우거 왕국','lizardmen':'리자드맨','chaos-dwarfs':'카오스 드워프','grand-cathay':'그랜드 캐세이'};
  const categoryKo={characters:'캐릭터',core:'코어',special:'스페셜',rare:'레어'};
  const labels={
    homeTitle:['군세 작업실','Command desk'],homeIntro:['진행 중인 로스터와 필요한 규칙을 한 화면에서 이어보세요.','Pick up your roster and the rules you need in one place.'],
    homeEyebrow:['진행 중인 군세','Current army'],homeContinue:['유닛 선택하기 →','Choose units →'],homeOpenRoster:['로스터 보기','View roster'],
    homeRosterHeading:['현재 로스터','Current roster'],homeViewAll:['전체 보기 →','View all →'],homeQuickHeading:['바로가기','Quick access'],
    homeLinkUnits:['유닛 선택과 옵션','Units and options'],homeLinkUnitsDesc:['진영 자료를 보며 편성','Build from your faction data'],
    homeLinkRules:['룰북과 퀵시트','Rules and quick sheet'],homeLinkRulesDesc:['필요한 규칙을 바로 찾기','Find the rule you need'],
    homeLinkTutorial:['처음 배우기','Learn to play'],homeLinkTutorialDesc:['도식으로 따라가는 튜토리얼','A visual guide'],
    homeLinkPlay:['플레이 모드','Play mode'],homeLinkPlayDesc:['탁상에서 로스터·규칙 참조','Quick tableside reference'],
    topBrandName:['올드 월드 빌더','Old World Builder'],navBrandName:['올드 월드 로스터 빌더','The Old World Roster Builder'],navHome:['홈','Home'],navArmy:['군세','Army'],navLibrary:['규칙','Rules'],navPlay:['플레이','Play'],navSaved:['보관함','Saved'],
    tabFactions:['진영','Factions'],tabReference:['유닛 자료','Unit reference'],tabForge:['편성','Build'],tabRoster:['로스터','Roster'],
    tabRules:['룰북','Rules'],tabQuick:['퀵시트','Quick sheet'],tabTutorial:['처음 배우기','Tutorial']
  };
  for(const [id,names] of Object.entries(labels))$(id).textContent=label(...names);
  if(language==='both' && matchMedia('(max-width:680px)').matches){$('topBrandName').title=label(...labels.topBrandName);$('topBrandName').textContent='올드 월드';}
  else $('topBrandName').removeAttribute('title');
  $('homeSaveStatus').textContent=$('saveStatus').textContent.includes('부족')?label('저장 공간 부족','Storage full'):label('이 브라우저에 자동 저장','Saved in this browser');
  $('homeArmyName').textContent=state.name||label('새 군세','New army');
  $('homeFaction').textContent=label(factionKo[state.faction]||armyName(),armyName());
  const points=CORE.totalPoints(state);
  $('homePoints').textContent=fmt(points);
  $('homeLimit').textContent=' / '+fmt(state.limit)+' pts';
  $('homeUnitCount').textContent=state.units.length+' '+label('유닛',state.units.length===1?'unit':'units');
  $('homeProgress').style.width=Math.min(100,Math.max(0,points/state.limit*100))+'%';
  const preview=$('homeRosterPreview');preview.replaceChildren();
  if(!state.units.length){
    preview.append(node('p',label('아직 유닛이 없습니다. 유닛 자료에서 첫 유닛을 추가하세요.','No units yet. Choose your first unit from Unit reference.'),'homeEmpty'));
  }else{
    for(const unit of state.units.slice(0,4)){
      const row=node('div','','homeUnit');
      const symbol=node('span',unit.category==='characters'?'✦':'◇','homeUnitSymbol');symbol.setAttribute('aria-hidden','true');
      const info=node('span','','homeUnitInfo');
      info.append(sourceName('strong',unit.name),node('small',unit.count+' '+label('모델',unit.count===1?'model':'models')+' · '+label(categoryKo[unit.category]||unit.category,CATEGORY_LABELS[unit.category]||unit.category)));
      row.append(symbol,info,node('b',fmt(unit.points)+' pts'));preview.append(row);
    }
    if(state.units.length>4)preview.append(node('p',label('외 '+(state.units.length-4)+'개 유닛','And '+(state.units.length-4)+' more units'),'homeMore'));
  }
  renderScreenChrome();
}
function renderScreenChrome(){
  $('forgeHeading').textContent=screen==='roster'?playText('로스터','Your roster'):playText('군세 설정','Army settings');
  $('forgeIntro').textContent=screen==='roster'?playText('편성을 확인하고 플레이를 시작하세요.','Review your army and start playing.'):playText('진영, 군세 편성과 목표 포인트를 설정하세요.','Set your faction, formation and points limit.');
  $('manualAddTitle').textContent=playText('유닛 직접 입력·추가','Manual unit entry');
  for(const [id,ko,en] of [['usedMetricLabel','사용','Used'],['remainingMetricLabel','잔여','Left'],['unitsMetricLabel','유닛','Units'],['modelsMetricLabel','모델','Models']])$(id).textContent=playText(ko,en);
  requestAnimationFrame(()=>{for(const tabs of document.querySelectorAll('.sectionTabs')){if(!tabs.getClientRects().length)continue;const active=tabs.querySelector('.active');if(!active)continue;const item=active.getBoundingClientRect(),box=tabs.getBoundingClientRect();if(item.right>box.right)tabs.scrollLeft+=item.right-box.right;else if(item.left<box.left)tabs.scrollLeft+=item.left-box.left;}});
  for(const [id,ko,en] of [['referenceSearch','유닛·규칙 검색','Search units or rules'],['playSearch','유닛·장비 검색','Search units or gear']]){const input=$(id);input.dataset.noI18n='';input.placeholder=window.TOWI18n?.language==='both'?'검색 / Search':playText(ko,en);}
  const confirmed=CORE.loadPlayRoster(state.faction),ready=confirmed&&!CORE.playRosterChanged(state,confirmed);
  $('homeContinue').dataset.homeScreen=ready?'play':'reference';
  $('homeContinue').textContent=ready?playText('플레이 이어보기 →','Resume play →'):playText('유닛 선택하기 →','Choose units →');
}
function playStatCell(profile,key,extra=null){
  const cell=node('td','','playStatCell');cell.dataset.stat=key;cell.dataset.profile=profile.id;
  const base=String(profile.base?.[key]??'–'),effects=[...(profile.modifiers?.[key]||[])];
  cell.append(node('span',base,'playBase'));
  const fixed=extra?.fixed?.[key];
  if(fixed!==undefined){cell.append(node('span',`→${fixed}`,'playFixed'));cell.title=playText('조건 적용 시 사용하는 고정 능력치','Fixed characteristic under the stated condition');cell.setAttribute('aria-label',`${key} ${base} → ${fixed}`);return cell;}
  const bonus=extra?.modifiers?.[key];if(bonus!==undefined)effects.push({value:bonus,source:extra.name});
  let numeric=effects.filter(effect=>Number.isFinite(Number(effect.value))).reduce((sum,effect)=>sum+Number(effect.value),0);
  if(Number.isFinite(Number(base))&&Number.isFinite(Number(profile.effective?.[key]))){const extraNumeric=bonus!==undefined&&Number.isFinite(Number(bonus))?Number(bonus):0;numeric=Number(profile.effective[key])-Number(base)+extraNumeric;if(extra?.cap)numeric=Math.min(Number(extra.cap),Number(base)+numeric)-Number(base);}
  const symbolic=effects.filter(effect=>!Number.isFinite(Number(effect.value)));
  const descriptions=effects.map(effect=>`${effect.source||''}: ${Number(effect.value)>0?'+':''}${effect.value}`);
  if(numeric){const badge=node('span',`${numeric>0?'+':''}${numeric}`,'playBonus'+(numeric<0?' negative':''));badge.title=descriptions.join('\n');cell.append(badge);}
  for(const effect of symbolic){const value=String(effect.value),badge=node('span',`${/^[+-]/.test(value)?'':'+'}${value}`,'playBonus');badge.title=effect.source||'';cell.append(badge);}
  const effective=Number.isFinite(Number(base))&&!symbolic.length?Number(base)+numeric:null;
  cell.setAttribute('aria-label',`${key} ${base}${numeric?` ${numeric>0?'+':''}${numeric}`:''}${effective!==null?` = ${effective}`:''}${descriptions.length?` · ${descriptions.join('; ')}`:''}`);
  return cell;
}
function playRuleButton(name,url=null){
  const button=ruleChip(name);
  if(url)try{const path=new URL(url,'https://tow.whfb.app/');if(path.hostname==='tow.whfb.app')button.dataset.rulePath=path.pathname;}catch{}
  return button;
}
function renderPlayProfiles(model,unit){
  const table=node('table','','playProfileTable');table.setAttribute('aria-label',playText(`${unit.name} 전체 능력치`,`${unit.name} complete profiles`));
  const head=document.createElement('thead'),headers=node('tr','');for(const key of model.keys||['M','WS','BS','S','T','W','I','A','Ld']){const th=node('th',key);th.scope='col';headers.append(th);}head.append(headers);table.append(head);
  const body=document.createElement('tbody');
  const appendRow=(profile,extra=null)=>{
    const heading=node('tr','',extra?'playProfileLabel playVariantLabel':'playProfileLabel'),title=node('th','');title.colSpan=9;title.scope='rowgroup';
    title.append(sourceName('span',profile.name));
    if(profile.count!==undefined)title.append(node('span',` · ${profile.count} ${playText('모델','models')}`,'playProfileCount'));
    if(extra)title.append(node('span',` · ${pairedName(extra.name)}`,'playVariantName'));
    const condition=extra&&(window.TOWI18n?.language==='en'?extra.conditionEn:extra.conditionKo||extra.conditionEn);
    if(condition)title.append(node('small',condition,'playCondition'));
    heading.append(title);body.append(heading);
    const row=node('tr','',extra?'playProfileValues playVariantValues':'playProfileValues');for(const key of model.keys||['M','WS','BS','S','T','W','I','A','Ld'])row.append(playStatCell(profile,key,extra));body.append(row);
  };
  for(const profile of model.profiles||[]){
    appendRow(profile);
    const variants=[...(model.weapons||[]),...(model.effects||[])].filter(effect=>(Object.keys(effect.modifiers||{}).length||Object.keys(effect.fixed||{}).length)&&effect.profileIds?.includes(profile.id));
    for(const variant of variants)appendRow(profile,variant);
  }
  table.append(body);return table;
}
function renderPlay(){
  const language=window.TOWI18n?.language||'ko',label=playText,snapshot=CORE.loadPlayRoster(state.faction),army=snapshot?.army;
  const categoryKo={characters:'캐릭터',core:'코어',special:'스페셜',rare:'레어',mercenaries:'용병'};
  $('playConfirm').textContent=army?label('현재 로스터로 다시 확정','Confirm current roster'):label('로스터 확정 · 플레이 시작','Confirm roster · Play');
  $('playConfirm').disabled=!state.units.length;
  $('playConfirm').classList.toggle('hidden',Boolean(army&&!CORE.playRosterChanged(state,snapshot)));
  $('playEdit').textContent=label('로스터 편집','Edit roster');
  $('playQuick').textContent=label('퀵시트','Quick sheet');$('playRules').textContent=label('룰북','Rules');
  $('playTitle').textContent=army?.name||label('플레이 모드','Play mode');
  $('playSubtitle').textContent=army?`${matchedModeName(army)} · ${fmt(CORE.totalPoints(army))} / ${fmt(army.limit)} pts`:label('로스터를 확정해 전투용 능력치 표를 만드세요.','Confirm your roster to build its battle reference.');
  const changed=army&&CORE.playRosterChanged(state,snapshot),notice=$('playNotice');
  notice.classList.toggle('changed',Boolean(changed));
  notice.classList.toggle('confirmed',Boolean(army&&!changed));
  $('playHelp').classList.toggle('hidden',!army);
  $('playHelpLabel').textContent=label('스탯 표시 안내','Reading the profiles');
  const date=snapshot?.confirmedAt?new Date(snapshot.confirmedAt):null,stamp=date&&!Number.isNaN(date.getTime())?date.toLocaleString(language==='en'?'en-GB':'ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  notice.textContent=!army?label('현재 로스터의 유닛과 선택 옵션을 확정하면 모든 프로필을 한 화면에서 볼 수 있습니다.','Confirm the units and options in your current roster to see every profile together.'):changed?label('편성이 변경되었습니다. 아래 표는 이전에 확정한 로스터입니다. 현재 로스터로 다시 확정하면 갱신됩니다.','Your draft has changed. The reference below uses your last confirmed roster. Confirm the current roster to update it.'):label(`확정 로스터${stamp?` · ${stamp}`:''}`,`Confirmed roster${stamp?` · ${stamp}`:''}`);
  $('playLegend').textContent=army?label('기본 수치 + 옵션 보너스. 무기·돌격 등 조건부 보너스는 조건이 적힌 별도 행에 표시됩니다.','Base value + option bonus. Weapon and other conditional bonuses have separate labelled rows.'):'';
  const search=$('playSearch').value.trim().toLowerCase(),host=$('playUnits');host.replaceChildren();
  $('playSearch').disabled=!army;
  const summary=$('playSummary');summary.replaceChildren();
  if(!army){summary.append(node('strong',`${state.units.length} ${label('유닛','units')} · ${fmt(CORE.totalPoints(state))} pts`));host.append(node('p',state.units.length?label('위의 확정 버튼을 누르면 플레이 모드가 시작됩니다.','Press Confirm roster above to start play mode.'):label('먼저 로스터에 유닛을 추가하세요.','Add units to your roster first.'),'playEmpty'));return;}
  const findings=matchedFindings(army);summary.append(node('strong',`${army.units.length} ${label('유닛','units')} · ${army.units.reduce((sum,unit)=>sum+unit.count,0)} ${label('모델','models')}`),node('span',findings.some(item=>item.kind==='error')?label('편성 제한 초과','Check limits'):label('확정 로스터','Confirmed roster')));
  for(const unit of army.units){
    const source=rosterSource(unit,army),choices=source?OPT.describe(source,unit.selections,unit.magicItems,optionComposition(source)):[];
    const rules=source?keywords(source):[];
    if(search&&!`${unit.name} ${unit.label} ${choices.join(' ')} ${rules.join(' ')} ${pairedName(unit.name)}`.toLowerCase().includes(search))continue;
    const card=node('article','','playCard playOverviewCard');card.dataset.unitId=unit.id;
    const head=node('div','','playCardHead');const title=node('span','','playCardTitle');title.append(sourceName('strong',unit.name),node('small',`${unit.count} ${label('모델','models')} · ${label(categoryKo[unit.category]||unit.category,CATEGORY_LABELS[unit.category]||unit.category)}${unit.label?` · ${unit.label}`:''}`));head.append(title,node('b',`${fmt(unit.points)} pts`));card.append(head);
    const body=node('div','','playCardBody');
    const model=window.TOWPlayProfiles?.create({source,unit,ruleInfo,optionModel:OPT,weaponProfiles:playWeaponProfiles,composition:unit.sourceComposition||source?._optionComposition||army.composition});
    if(model?.profiles?.length){body.append(renderPlayProfiles(model,unit));const sources=node('div','','playBonusSources');for(const profile of model.profiles){const bonuses=new Map();for(const [key,values] of Object.entries(profile.modifiers||{}))for(const effect of values){const list=bonuses.get(effect.source)||[];list.push(`${key} ${Number(effect.value)>0?'+':''}${effect.value}`);bonuses.set(effect.source,list);}for(const [name,values] of bonuses)sources.append(node('p',`${pairedName(profile.name)} · ${pairedName(name)}: ${values.join(' · ')}`));}if(sources.childElementCount)body.append(sources);}
    else body.append(node('p',Object.keys(rulesIndex).length?label('이 유닛의 능력치 자료가 없습니다. 유닛 원문을 확인하세요.','No profile data is available for this unit. Check its source entry.'):label('능력치 자료를 불러오는 중…','Loading profiles…'),'playMeta'));
    if(model?.defences?.length){const defences=node('div','','playDefences');for(const defence of model.defences){const condition=language==='en'?defence.conditionEn:defence.conditionKo||defence.conditionEn;defences.append(node('span',`${pairedName(defence.name)}${defence.value?` ${defence.value}`:''}${condition?` · ${condition}`:''}`));}body.append(defences);}
    if(model?.weapons?.length){const weapons=node('div','','playWeapons');weapons.append(node('h3',label('무장 스펙','Weapon profiles')));for(const weapon of model.weapons){const row=node('div','','playWeaponRow');row.append(playRuleButton(weapon.name,weapon.url),node('span',`${label('사거리','Range')} ${weapon.range||'–'} · S ${weapon.strength||'–'} · AP ${weapon.armourPiercing||'–'}`));if(weapon.rules?.length){const rulesRow=node('div','','playChips');for(const rule of weapon.rules)rulesRow.append(ruleChip(rule));row.append(rulesRow);}const condition=language==='en'?weapon.conditionEn:weapon.conditionKo||weapon.conditionEn;if(condition)row.append(node('small',condition,'playWeaponCondition'));if(weapon.notes)row.append(node('small',Array.isArray(weapon.notes)?weapon.notes.join(' '):String(weapon.notes),'playWeaponCondition'));weapons.append(row);}body.append(weapons);}
    const reference=document.createElement('details');reference.className='playReferenceDetails';reference.append(node('summary',label('선택 장비·특수 규칙 보기','Selected equipment and special rules')));const referenceBody=node('div','','playReferenceBody');
    if(choices.length){referenceBody.append(node('h3',label('선택 장비·옵션','Selected equipment and options')));const options=node('div','','playChips');for(const choice of choices){const parts=splitRuleNames(choice.replace(/^\d+×\s*/,'')),known=parts.filter(part=>ruleInfo(part));if(known.length){for(const part of known)options.append(ruleChip(part));}else options.append(node('span',choice,'playPlain'));}referenceBody.append(options);}
    if(rules.length){referenceBody.append(node('h3',label('특수 규칙','Special rules')));const row=node('div','','playChips');for(const rule of rules)row.append(ruleChip(rule));referenceBody.append(row);}
    if(unit.lore)referenceBody.append(node('p',`${label('마법 학파','Lore of Magic')}: ${slugTitle(unit.lore)}`,'playMeta'));
    if(unit.options)referenceBody.append(node('p',unit.options,'playMeta'));
    for(const note of model?.notes||[])body.append(node('p',label(note.ko,note.en),'playProfileNote'));
    if(source){const detail=node('button',label('유닛 전체 자료 보기','Full unit reference'),'secondary playDetails');detail.type='button';detail.dataset.playDetails=unit.id;referenceBody.append(detail);}
    if(referenceBody.childElementCount){reference.append(referenceBody);body.append(reference);}
    card.append(body);host.append(card);
  }
  if(!host.childElementCount)host.append(node('p',label('검색 결과가 없습니다.','No matching units.'),'viewHint'));
}
function render() { renderSettings(); renderRoster(); renderFactions(); renderReference(); renderSaved(); renderHome(); renderPlay(); }

function renderCatalog() {
  catalog = new Map();
  const choices = [option('','직접 입력')];
  for (const unit of [...unitsForComposition(armyData,state.composition),...mercenaryPool]) {
    const key = `${unit.category}:${unit.id}:${catalog.size}`;
    catalog.set(key,unit);
    const choice=option(key,`${CATEGORY_LABELS[unit.category]} · ${pairedName(labelOf(unit))} · ${fmt(Number(unit.points) || 0)} pts/모델`);choice.dataset.noI18n='';choices.push(choice);
  }
  $('preset').replaceChildren(...choices);
  renderReference();
}
function showScreen(next) {
  screen = next;
  document.body.dataset.screen=next;
  renderScreenChrome();
  const armyScreens=['factions','reference','forge','roster'],libraryScreens=['rules','quicksheet','tutorial'];
  const primary=armyScreens.includes(next)?'army':libraryScreens.includes(next)?'library':next;
  $('homeScreen').classList.toggle('hidden',next!=='home');
  $('forgeScreen').classList.toggle('hidden', !['forge','roster'].includes(next));
  $('forgeScreen').classList.toggle('rosterMode', next === 'roster');
  $('factionScreen').classList.toggle('hidden', next !== 'factions');
  $('referenceScreen').classList.toggle('hidden', next !== 'reference');
  $('quickSheetScreen').classList.toggle('hidden', next !== 'quicksheet');
  $('rulesScreen').classList.toggle('hidden', !['rules','tutorial'].includes(next));
  $('savedScreen').classList.toggle('hidden', next !== 'saved');
  $('playScreen').classList.toggle('hidden', next !== 'play');
  $('sectionNav').classList.toggle('hidden',!['army','library'].includes(primary));
  $('armySectionTabs').classList.toggle('hidden',primary!=='army');
  $('librarySectionTabs').classList.toggle('hidden',primary!=='library');
  for (const button of $('bottomNav').querySelectorAll('[data-primary]')) {
    button.classList.toggle('active',button.dataset.primary === primary);
    if (button.dataset.primary === primary) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  for(const button of $('sectionNav').querySelectorAll('[data-screen]')){
    button.classList.toggle('active',button.dataset.screen===next);
    button.setAttribute('aria-pressed',String(button.dataset.screen===next));
  }
  if(next==='rules'||next==='tutorial')document.querySelector('[data-rules-view="'+(next==='tutorial'?'tutorial':'library')+'"]')?.click();
  if (next === 'saved') renderSaved();
  if (next === 'play') {renderPlay();loadPlaySources(CORE.loadPlayRoster(state.faction)?.army);}
  window.scrollTo(0,0);
}
function renderFactions() {
  const grid=$('factionGrid'); grid.replaceChildren();
  const query=$('factionSearch').value.trim().toLowerCase();
  const armies=(metadata?.armies || []).filter(army=>`${army.name_en} ${army.id} ${window.TOWI18n?.display(army.name_en||'','ko')||''}`.toLowerCase().includes(query));
  for (const army of armies) {
    const button=node('button','','factionCard'+(army.id===state.faction?' current':''));
    button.type='button';button.dataset.faction=army.id;
    button.append(node('span',army.group?.replaceAll('-',' ') || 'The Old World','cardKicker'),node('strong',army.name_en || slugTitle(army.id),'cardTitle'),node('span',`${army.armyComposition?.length || 1}개 편성 · ${army.id===state.faction?'현재 진영':'선택하여 열기'}`,'cardMeta'));
    grid.append(button);
  }
  if (!metadata) grid.append(node('p','진영 데이터를 불러오는 중…','viewHint'));
  else if(!armies.length)grid.append(node('p','검색 결과가 없습니다.','viewHint'));
}
function renderReference() {
  $('referenceTitle').textContent='유닛 자료';
  document.querySelector('#referenceScreen .eyebrow').textContent=`${armyName()} · Army Reference`;
  const grid=$('referenceGrid');grid.replaceChildren();
  const query=$('referenceSearch').value.trim().toLowerCase(),category=$('referenceCategory').value;
  let shown=0;
  for (const [key,unit] of catalog) {
    if (category!=='all' && unit.category!==category) continue;
    if (query && !`${labelOf(unit)} ${unit.id} ${keywords(unit).join(' ')} ${window.TOWI18n?.display(labelOf(unit),'ko')||''} ${keywords(unit).map(value=>window.TOWI18n?.ruleLabel(value,'ko')||'').join(' ')}`.toLowerCase().includes(query)) continue;
    const card=node('article','','referenceCard');card.dataset.catalogKey=key;
    card.append(node('span',CATEGORY_LABELS[unit.category],'cardKicker'),sourceName('strong',labelOf(unit),'cardTitle'),node('span',`${fmt(Number(unit.points) || 0)} pts/모델 · 최소 ${fmt(Math.max(1,Number(unit.minimum)||1))} 모델${unit.category==='mercenaries'&&unit._sourceFaction?` · ${metadata?.armies?.find(item=>item.id===unit._sourceFaction)?.name_en||unit._sourceFaction}`:''}`,'cardMeta'));
    const ruleList=keywords(unit);
    if(ruleList.length){const pills=node('div','','rulePills');for(const rule of ruleList.slice(0,3))pills.append(ruleChip(rule));if(ruleList.length>3)pills.append(node('span',`+${ruleList.length-3}개 규칙`,'ruleMore'));card.append(pills);}
    const actions=node('div','','referenceActions');
    for(const [action,label,className] of [['details','규칙 · 옵션 보기','secondary'],['quickadd','옵션 선택 · 추가','primary']]){const button=node('button',label,className);button.type='button';button.dataset.referenceAction=action;button.dataset.catalogKey=key;actions.append(button);}
    card.append(actions);
    grid.append(card);shown++;
  }
  $('referenceSummary').replaceChildren(node('span',`${shown} / ${catalog.size} 유닛 표시`),node('b',`${fmt(CORE.totalPoints(state))} / ${fmt(state.limit)} pts · ${state.units.length} 유닛`));
  if (!shown) grid.append(node('p',armyData?'검색 결과가 없습니다.':'진영 데이터를 불러오는 중…','viewHint'));
}
function renderSaved() {
  const grid=$('savedGrid');grid.replaceChildren();
  const saved=CORE.listSaved(state.faction);
  saved.forEach((item,index)=>{
    const card=node('div','','savedCard');
    card.append(node('span',item.when || '저장됨','cardKicker'),node('strong',item.army.name || '이름 없는 로스터','cardTitle'),node('span',`${fmt(CORE.totalPoints(item.army))} / ${fmt(item.army.limit)} pts · ${item.army.units.length} 유닛`,'cardMeta'));
    const actions=node('div','','savedActions');
    for (const [action,label,className] of [['load','불러오기','secondary'],['delete','삭제','secondary danger']]) {const button=node('button',label,className);button.type='button';button.dataset.savedAction=action;button.dataset.index=index;actions.append(button);}
    card.append(actions);grid.append(card);
  });
  if (!saved.length) grid.append(node('p','저장된 로스터가 없습니다. 위 버튼으로 현재 로스터를 보관하세요.','viewHint'));
}
function openUnitDetail(unit) {
  detailUnit=unit;
  $('detailCategory').textContent=CATEGORY_LABELS[unit.category] || 'Unit';
  $('detailName').textContent=pairedName(labelOf(unit));$('detailName').dataset.noI18n='';
  renderModelProfile(unit,'detailProfile');
  const count=Math.max(1,Number(unit.minimum)||1);
  $('detailMeta').replaceChildren(node('span',`${fmt(Number(unit.points)||0)} pts / 모델`),node('span',`최소 ${fmt(count)} 모델`),...(Number(unit.maximum)>0?[node('span',`최대 ${fmt(Number(unit.maximum))} 모델`)]:[]));
  const notes=[unit.notes?.name_en,unit.armyComposition?.[optionComposition(unit)]?.notes?.name_en].filter(Boolean);
  $('detailNotes').replaceChildren(...notes.map(text=>node('p',text)));
  $('detailNotes').classList.toggle('hidden',!notes.length);
  const pills=$('detailRules');pills.replaceChildren();
  const ruleList=keywords(unit);
  if(ruleList.length)for(const rule of ruleList)pills.append(ruleChip(rule));
  else pills.append(node('p','기록된 특수 규칙이 없습니다.','viewHint'));
  const options=$('detailOptions');options.replaceChildren();
  for(const [field,label] of [['command','커맨드'],['equipment','무기'],['armor','방어구'],['options','추가 옵션'],['mounts','탈것']]){
    const values=unit[field]||[];
    for(const item of values){const wrap=node('div','','detailOptionWrap');const row=node('div','','detailOption');const title=node('span','');title.append(document.createTextNode(`${label} · `),sourceName('span',labelOf(item)));row.append(title,node('b',`${fmt(Number(item.points)||0)} pts${item.perModel?'/모델':''}`));wrap.append(row);const links=optionRuleLinks(labelOf(item),field==='equipment'?'무장 스펙':'규칙');if(links)wrap.append(links);options.append(wrap);}
  }
  if(!options.childElementCount)options.append(node('p','추가 옵션 정보가 없습니다.','viewHint'));
  $('detailBackdrop').classList.remove('hidden');$('closeDetail').focus();
}
function closeUnitDetail() {$('detailBackdrop').classList.add('hidden');detailUnit=null;}
function richRuleText(part) {
  if(!part)return '';
  if(part.nodeType==='text')return part.value||'';
  return (part.content||[]).map(richRuleText).join('');
}
function profileRuleNames(profile) {
  const rich=profile?.fields?.specialRules,names=[];
  const visit=part=>{
    if(part?.nodeType==='entry-hyperlink')names.push(richRuleText(part).trim());
    for(const child of part?.content||[])visit(child);
  };
  visit(rich);
  if(!names.length)names.push(...richRuleText(rich).split(',').map(value=>value.trim()));
  return [...new Set(names.filter(value=>value&&value!=='-'))];
}
function hydrateWeaponRules(documentOfRule) {
  const tables=[...documentOfRule.querySelectorAll('table.profile-table--weapon')];
  if(!tables.length)return;
  let profiles=[];
  try{
    const payload=JSON.parse(documentOfRule.querySelector('#__NEXT_DATA__')?.textContent||'{}');
    profiles=(payload.props?.pageProps?.entry?.fields?.body?.content||[])
      .filter(part=>part.nodeType==='embedded-entry-block'&&part.data?.target?.sys?.contentType?.sys?.id==='weaponProfile')
      .map(part=>part.data.target);
  }catch{}
  for(const [index,table] of tables.entries()){
    const cell=table.querySelector('tbody tr td:last-child');
    if(!cell||cell.textContent.trim()&&cell.textContent.trim()!=='-')continue;
    let names=profileRuleNames(profiles[index]);
    if(!names.length&&tables.length===1){
      const description=documentOfRule.querySelector('meta[name="description"]')?.content||'';
      names=description.split(/\bNotes:/)[0].split(',').map(value=>value.trim()).filter(value=>ruleInfo(value));
    }
    if(!names.length)continue;
    const makeLink=name=>{
      const info=ruleInfo(name),element=documentOfRule.createElement(info?.url?'a':'span');
      if(info?.url)element.href=`https://tow.whfb.app/${info.url}`;
      element.textContent=name;
      return element;
    };
    cell.replaceChildren(...names.flatMap((name,position)=>position?[documentOfRule.createTextNode(', '),makeLink(name)]:[makeLink(name)]));
    const summary=documentOfRule.createElement('div');summary.className='weaponSpecialRules';
    summary.append(documentOfRule.createElement('strong'));
    summary.firstChild.textContent='Special Rules';
    for(const name of names)summary.append(makeLink(name));
    (table.parentElement||table).after(summary);
  }
}
function appendRuleMarkup(target,source) {
  if(source.nodeType===Node.TEXT_NODE){target.append(document.createTextNode(source.textContent));return;}
  if(source.nodeType!==Node.ELEMENT_NODE)return;
  const tag=source.tagName;
  if(['SCRIPT','STYLE','SVG','BUTTON','NOSCRIPT'].includes(tag))return;
  if(tag==='A'){
    const href=source.getAttribute('href');
    let resolved=null;
    if(href)try{resolved=new URL(href,'https://tow.whfb.app');}catch{}
    const title=source.textContent.trim();
    if(resolved?.origin==='https://tow.whfb.app' && title){
      const button=node('button',title,'ruleInlineLink');button.type='button';button.dataset.rulePath=resolved.pathname;button.dataset.ruleTitle=title;target.append(button);
    }else target.append(document.createTextNode(title));
    return;
  }
  const allowed={P:'p',H1:'h3',H2:'h3',H3:'h3',H4:'h4',STRONG:'strong',B:'strong',EM:'em',I:'em',UL:'ul',OL:'ol',LI:'li',BLOCKQUOTE:'blockquote',TABLE:'table',THEAD:'thead',TBODY:'tbody',TFOOT:'tfoot',TR:'tr',TH:'th',TD:'td',BR:'br',DIV:'div'};
  const element=document.createElement(allowed[tag]||'span');
  if(tag==='DIV'&&source.querySelector(':scope > table'))element.className='ruleTableWrap';
  else if(source.classList?.contains('weaponSpecialRules'))element.className='weaponSpecialRules';
  else if(source.classList?.contains('unit-profile'))element.className='ruleUnitProfile';
  else if(source.classList?.contains('unit-profile__details'))element.className='ruleUnitDetails';
  else if(source.classList?.contains('unit-profile__details--special-rules'))element.className='ruleUnitSpecial';
  if(tag==='TABLE')element.className='ruleSpecTable';
  for(const child of source.childNodes)appendRuleMarkup(element,child);
  if(element.textContent.trim() || ['BR','DIV','TABLE'].includes(tag)&&element.childElementCount)target.append(element);
}
const VERIFIED_RULE_TRANSLATIONS=new Map([
  ['Many warriors brandish ensorcelled weapons, their heavy, black blades inscribed with dark runes that glow with infernal power.','많은 전사들이 마력이 깃든 무기를 휘두릅니다. 무겁고 검은 칼날에는 지옥의 힘으로 빛나는 어둠의 룬이 새겨져 있습니다.'],
  ['A hand weapon carried by a model with this special rule has the Magical Attacks special rule and an Armour Piercing characteristic of -1.','이 특수 규칙을 가진 모델이 휴대한 한손 무기는 마법 공격(Magical Attacks) 특수 규칙을 가지며, 장갑 관통(Armour Piercing) 수치가 -1입니다.'],
  ["Note that this special rule only applies to a single, non-magical hand weapon and does not apply to a model's mount (should it have one). If the model is using two hand weapons or any other sort of weapon, this special rule ceases to apply.",'참고: 이 특수 규칙은 마법 무기가 아닌 한손 무기 하나에만 적용되며, 탈것에는 적용되지 않습니다. 모델이 한손 무기 두 개 또는 다른 종류의 무기를 사용하면 이 특수 규칙은 더 이상 적용되지 않습니다.'],
  ['Chaos Armour is the living gift of the gods. As champions progress towards glory, their armour becomes ever more heavy and baroque as new plates are added, each new piece obscuring more of their humanity.','카오스 아머는 신들이 내리는 살아 있는 선물입니다. 챔피언이 영광을 향해 나아갈수록 갑옷에 새로운 판이 더해져 점점 무겁고 화려해지고, 챔피언의 인간적인 모습은 점차 가려집니다.'],
  ["A model with this special rule has a Ward save against any wounds suffered. The armour value of this Ward save is shown in brackets after the name of this special rule (shown here as 'X+'). In addition, a Wizard with this special rule may wear armour without penalty.",'이 특수 규칙을 가진 모델은 받은 모든 피해에 대해 와드 세이브(Ward save)를 가집니다. 와드 세이브 수치는 이 특수 규칙 이름 뒤의 괄호에 표시됩니다(여기서는 ‘X+’). 또한 이 특수 규칙을 가진 위저드는 불이익 없이 갑옷을 착용할 수 있습니다.'],
  ['Great weapons are especially large and heavy weapons wielded with both hands. This includes great hammers, great axes, two-handed swords and so forth. A blow from a great weapon can cut a foe in half and shatter the thickest armour.','대형 무기는 양손으로 사용하는 크고 무거운 무기입니다. 대형 망치, 대형 도끼, 양손검 등이 여기에 포함됩니다. 대형 무기의 일격은 적을 두 동강 내고 두꺼운 갑옷도 부술 수 있습니다.']
]);
function localizeRuleParagraphs(content,requestId) {
  const language=window.TOWI18n?.language||'ko';
  for(const block of content.querySelectorAll('p,li,blockquote,.ruleUnitDetails>div')){
    if(block.closest('table,.weaponSpecialRules')||block.querySelector('p,li,blockquote'))continue;
    const original=block.textContent.replace(/\s+/g,' ').trim();
    if(!/[A-Za-z]/.test(original)||original.length<8)continue;
    const links=[...block.querySelectorAll('[data-rule-path]')].map(button=>button.cloneNode(true));
    block.setAttribute('data-no-i18n','');
    if(language==='en')continue;
    const renderTranslation=translated=>{
      if(!translated||requestId!==ruleRequestId||window.TOWI18n?.language!==language||!block.isConnected)return;
      block.replaceChildren(document.createTextNode(translated));
      const extras=[];
      if(language==='both'){
        const source=node('div',original,'ruleEnglishOriginal');source.setAttribute('data-no-i18n','');extras.push(source);
      }else{
        const details=node('details','','ruleEnglishDetails');details.setAttribute('data-no-i18n','');
        details.append(node('summary',verified?'영문 원문 보기':'자동 번역 · 영문 원문 보기'),node('p',original));extras.push(details);
      }
      if(links.length){
        const references=node('div','','ruleParagraphLinks');
        const heading=node('strong',language==='both'?'관련 규칙 / Related rules':'관련 규칙');heading.setAttribute('data-no-i18n','');
        references.append(heading,...links);extras.push(references);
      }
      if(block.tagName==='LI')block.append(...extras);else block.after(...extras);
    };
    const verified=VERIFIED_RULE_TRANSLATIONS.get(original);
    if(verified)queueMicrotask(()=>renderTranslation(verified));
    else window.TOWI18n?.translateRuleText(original).then(renderTranslation);
  }
}
function showEmbeddedRule(url,name) {
  const frame=document.createElement('iframe');frame.src=url;frame.title=`${name} 규칙 원문`;frame.loading='eager';frame.referrerPolicy='no-referrer';
  $('ruleContent').classList.add('embedded');$('ruleContent').replaceChildren(frame);
}
function showOfflineRule() {
  const language=window.TOWI18n?.language||'ko';
  const ko='규칙 원문은 인터넷 연결이 필요합니다. 오프라인에서는 퀵시트를 확인할 수 있습니다.';
  const en='The full rule requires an internet connection. The quick sheet is available offline.';
  const message=language==='en'?en:language==='both'?`${ko} / ${en}`:ko;
  const quick=node('button',language==='en'?'Open quick sheet':language==='both'?'퀵시트 보기 / Open quick sheet':'퀵시트 보기','secondary');
  quick.type='button';quick.addEventListener('click',()=>{closeRule();showScreen('quicksheet');});
  $('ruleContent').classList.remove('embedded');$('ruleContent').replaceChildren(node('p',message,'viewHint'),quick);
}
function renderRuleNavigation(path,info) {
  const neighbors=path && window.TOWRulesReader?.neighbors(path),language=window.TOWI18n?.language||'ko';
  $('ruleNav').classList.toggle('hidden',!neighbors);
  $('rulePage').toggleAttribute('data-no-i18n',Boolean(neighbors));
  if(!neighbors){$('rulePage').textContent=info?.page?`룰북 참고: ${info.page}`:'색인 링크 정보 없음';return;}
  const chapter=language==='en'?neighbors.chapter.en:language==='both'?`${neighbors.chapter.ko} / ${neighbors.chapter.en}`:neighbors.chapter.ko;
  $('rulePage').textContent=`${chapter} · ${neighbors.position}/${neighbors.count}${info?.page?` · ${info.page}`:''}`;
  for(const [direction,item] of [['Prev',neighbors.previous],['Next',neighbors.next]]){
    const button=$(`rule${direction}`),label=$(`rule${direction}Label`);
    button.disabled=!item;
    button.dataset.rulePath=item?.path||'';
    button.dataset.ruleTitle=item?.en||'';
    button.dataset.ruleKo=item?.ko||'';
    label.textContent=item?(language==='en'?item.en:item.ko||item.en):(language==='en'?'No more rules':'끝');
    button.setAttribute('aria-label',`${language==='en'?(direction==='Prev'?'Previous rule':'Next rule'):(direction==='Prev'?'이전 규칙':'다음 규칙')}: ${label.textContent}`);
  }
}
async function openRule(name,path=null,translatedTitle=null) {
  if(!Object.keys(rulesIndex).length)await loadRuleIndex();
  const info=ruleInfo(name),url=path?`https://tow.whfb.app${path}?minimal=true`:info?.url?`https://tow.whfb.app/${info.url}?minimal=true`:null;
  const requestId=++ruleRequestId;
  currentRulePath=path||(info?.url?`/${info.url}`:null);currentRuleInfo=info;
  const localizedTitle=translatedTitle && window.TOWI18n?.language!=='en' ? (window.TOWI18n?.language==='both'?`${translatedTitle} / ${name}`:translatedTitle) : name;
  $('ruleName').toggleAttribute('data-no-i18n',Boolean(translatedTitle));
  $('ruleName').textContent=localizedTitle;renderRuleNavigation(currentRulePath,info);
  $('ruleContent').classList.remove('embedded');
  $('ruleContent').replaceChildren(node('p',url?'규칙 내용을 불러오는 중…':'원본 규칙 색인에 이 항목의 별도 스펙 페이지가 없습니다. 해당 유닛의 메모와 룰북을 확인하세요.','viewHint'));
  $('ruleFrameWrap').scrollTop=0;
  if(url){$('ruleSource').href=url;$('ruleSource').classList.remove('hidden');}
  else{$('ruleSource').removeAttribute('href');$('ruleSource').classList.add('hidden');}
  const wasHidden=$('ruleBackdrop').classList.contains('hidden');
  $('ruleBackdrop').classList.remove('hidden');if(wasHidden)$('closeRule').focus();
  if(!url)return;
  try{
    const response=await fetch(url);
    if(!response.ok)throw Error('원문 응답 오류');
    const documentOfRule=new DOMParser().parseFromString(await response.text(),'text/html');
    hydrateWeaponRules(documentOfRule);
    const articles=[...documentOfRule.querySelectorAll('article.article--rich-text, .unit-profile')];
    if(!articles.length)throw Error('본문을 찾지 못했습니다.');
    const content=document.createDocumentFragment();
    for(const article of articles)for(const child of article.childNodes)appendRuleMarkup(content,child);
    if(!content.childNodes.length)throw Error('본문을 찾지 못했습니다.');
    localizeRuleParagraphs(content,requestId);
    if(requestId===ruleRequestId)$('ruleContent').replaceChildren(content);
  }catch{if(requestId===ruleRequestId){if(navigator.onLine)showEmbeddedRule(url,name);else showOfflineRule();}}
}
function closeRule() {ruleRequestId++;currentRulePath=null;currentRuleInfo=null;$('ruleBackdrop').classList.add('hidden');}
$('ruleNav').addEventListener('click',event=>{const button=event.target.closest('button[data-rule-path]');if(button && !button.disabled && button.dataset.rulePath)openRule(button.dataset.ruleTitle,button.dataset.rulePath,button.dataset.ruleKo);});
document.addEventListener('tow-language-change',()=>{if(currentRulePath)renderRuleNavigation(currentRulePath,currentRuleInfo);});
document.addEventListener('tow-rules-catalog-ready',()=>{if(currentRulePath)renderRuleNavigation(currentRulePath,currentRuleInfo);});
$('ruleContent').addEventListener('click',event=>{const link=event.target.closest('[data-rule-path]');if(link)openRule(link.dataset.ruleTitle,link.dataset.rulePath);});
function optionPrice(entry) {return `${Number(entry.points)||0 ? `+${fmt(Number(entry.points))}` : '0'} pts${entry.perModel ? '/모델' : ''}`;}
function itemPrice(entry){const mode=window.TOWI18n?.language||'ko';return optionPrice(entry).replace('/모델',mode==='en'?'/model':mode==='both'?'/모델 / model':'/모델');}
function optionComposition(source){return source?._optionComposition||state.composition;}
function renderManualStats(prefix,values={}){
  const host=$(`${prefix}ManualStats`);host.replaceChildren();
  for(const key of ['M','WS','BS','S','T','W','I','A','Ld']){const label=node('label',key);label.dataset.noI18n='';const input=document.createElement('input');input.id=`${prefix}Stat${key}`;input.value=values[key]||'';input.maxLength=16;input.setAttribute('aria-label',key);label.append(input);host.append(label);}
}
function readManualStats(prefix){return Object.fromEntries(['M','WS','BS','S','T','W','I','A','Ld'].map(key=>[key,$(`${prefix}Stat${key}`)?.value.trim()||'']).filter(([,value])=>value));}
function magicOptions(group) {
  return OPT.itemChoices(magicData,group,configured?.source?._sourceFaction||state.faction,optionComposition(configured?.source));
}
function magicGroups(source,selections) {
  const groups=(source.items||[]).map((group,slot)=>({group,slot}));
  const offset=groups.length;
  (source.command||[]).forEach((entry,index)=>{
    if(entry.magic?.types?.length && OPT.active(selections[`command:${index}`]))groups.push({group:{...entry.magic,maxPoints:entry.magic.armyComposition?.[optionComposition(source)]?.maxPoints ?? entry.magic.maxPoints,name_en:`${labelOf(entry)} · 마법 아이템`},slot:offset+index});
  });
  return groups;
}
function refreshMagicPicker() {
  if(!configured)return;
  const host=$('magicGroupsList');host.replaceChildren();
  for(const {group,slot} of magicGroups(configured.source,configured.selections)){
    const chosen=configured.magicItems.map((item,index)=>({...item,index})).filter(item=>item.slot===slot);
    const used=chosen.reduce((sum,item)=>sum+item.points,0),items=magicOptions(group);
    const card=node('section','','magicGroupCard');
    const heading=node('div','','magicGroupHead');heading.append(node('strong',labelOf(group)));
    const summary=node('span',`${fmt(used)}${group.maxPoints?` / ${fmt(group.maxPoints)}`:''} pts`);
    summary.dataset.noI18n='';
    if(group.maxItemsPerCategory){
      const limit=group.maxItemsPerCategory,mode=window.TOWI18n?.language||'ko';
      const limitText=mode==='en'?`Up to ${limit} per type`:mode==='both'?`종류별 최대 ${limit}개 / Up to ${limit} per type`:`종류별 최대 ${limit}개`;
      summary.textContent+=` · ${limitText}`;
    }
    heading.append(summary);card.append(heading);
    const selected=node('div','','magicGroupSelected');
    for(const type of itemTypes(chosen)){
      const inType=chosen.filter(item=>(item.type||'')===type);
      const categoryTitle=node('h4',itemTypeName(type),'magicCategoryTitle');categoryTitle.dataset.noI18n='';selected.append(categoryTitle);
      const seen=new Set();
      for(const item of inType){
        const key=`${item.group}\u0000${item.name}`;if(seen.has(key))continue;seen.add(key);
        const copies=inType.filter(value=>value.group===item.group&&value.name===item.name),sourceItem=items.find(value=>value.group===item.group&&labelOf(value)===item.name&&value.type===item.type);
        const row=node('div','','magicSelectedRow');const name=node('span','','magicSelectedName');name.append(sourceName('span',item.name),node('small',`${fmt(copies.reduce((sum,value)=>sum+value.points,0))} pts`));row.append(name);
        const controls=node('span','','magicQuantity');
        if(sourceItem?.stackable || item.name.endsWith('*')){
          const minus=node('button','−','ghost');minus.type='button';minus.dataset.magicRemove=copies.at(-1).index;minus.setAttribute('aria-label',`${item.name} 한 개 제거`);controls.append(minus,node('b',String(copies.length)));
          const plus=node('button','+','ghost');plus.type='button';plus.dataset.magicIncrement=item.index;plus.disabled=!sourceItem;plus.setAttribute('aria-label',`${item.name} 한 개 추가`);controls.append(plus);
        }else{const remove=node('button','삭제','ghost danger');remove.type='button';remove.dataset.magicRemove=item.index;controls.append(remove);}
        row.append(controls);selected.append(row);const links=optionRuleLinks(item.name);if(links)selected.append(links);
      }
    }
    if(!chosen.length)selected.append(node('p','선택한 항목 없음','magicGroupEmpty'));
    card.append(selected);
    const picker=node('div','','configMagicRow');const select=document.createElement('select');select.dataset.magicSlot=slot;select.dataset.noI18n='';select.setAttribute('aria-label',`${labelOf(group)} 항목 선택`);
    select.append(option('',magicData?'항목 선택 / Select item':'선택지 불러오는 중… / Loading items…'));
    for(const type of itemTypes(items)){const section=document.createElement('optgroup');section.label=itemTypeName(type);for(const [index,item] of items.entries())if((item.type||'')===type)section.append(option(index,`${pairedName(labelOf(item))} · ${itemPrice(item)}`));select.append(section);}
    const add=node('button','추가','secondary');add.type='button';add.dataset.magicAdd=slot;add.disabled=!items.length;picker.append(select,add);card.append(picker);
    const preview=node('div','','magicRulePreview');preview.dataset.magicPreview=slot;card.append(preview);
    if(magicData&&!items.length)card.append(node('p','이 편성에서 선택 가능한 항목이 없습니다.','magicGroupEmpty'));
    host.append(card);
  }
}
function refreshConfig() {
  if(!configured)return;
  const {source,selections}=configured,count=whole($('configCount').value,1,Math.min(999,Number(source.maximum)||999));
  renderModelProfile(source,'configProfile');
  $('configManualProfile').classList.toggle('hidden',Boolean(window.TOWPlayProfiles?.lookup(source,ruleInfo)?.stats?.length));
  configured.count=count;
  const groups=$('configGroups');groups.replaceChildren();
  for(const [field,title] of [['command','지휘부'],['equipment','무기'],['armor','방어구'],['options','추가 옵션'],['mounts','탈것']]) {
    const entries=OPT.entries(source,optionComposition(source)).filter(item=>item.field===field && !item.depth);
    if(!entries.length)continue;
    const section=node('section','','configGroup');section.append(node('h3',title));
    const draw=(item,container)=>{
      const {entry,path,parentKey}=item;
      const checked=OPT.active(selections[path]);
      const disabled=Boolean(entry.alwaysActive || (parentKey && !OPT.active(selections[parentKey])));
      const row=node('label','','configChoice'+(checked?' selected':'')+(disabled?' disabled':''));
      const input=document.createElement('input');input.type=field==='mounts'?'radio':'checkbox';if(field==='mounts')input.name='configMount';input.checked=checked;input.disabled=disabled;input.dataset.path=path;
      const main=node('span','','configChoiceText');main.append(sourceName('strong',labelOf(entry)));
      if(entry.notes?.name_en)main.append(node('small',entry.notes.name_en));
      const right=node('b',optionPrice(entry),'configChoicePrice');
      row.append(input,main,right);container.append(row);
      const links=optionRuleLinks(labelOf(entry),field==='equipment'?'무장 스펙':'규칙');if(links)container.append(links);
      if(entry.stackable && checked){const amount=document.createElement('input');amount.type='number';amount.min=entry.minimum||1;amount.max=entry.maximum||99;amount.value=Number(selections[path])||1;amount.dataset.amount=path;amount.className='configAmount';amount.setAttribute('aria-label',`${labelOf(entry)} 수량`);container.append(amount);}
      if(checked && entry.options){const nested=node('div','','configNested');for(const child of OPT.entries(source,optionComposition(source)).filter(candidate=>candidate.parentKey===path))draw(child,nested);container.append(nested);}
    };
    for(const item of entries)draw(item,section);
    groups.append(section);
  }
  $('configPoints').textContent=`${fmt(OPT.price(source,count,selections,configured.magicItems,optionComposition(source)))} pts`;
  $('configMagic').classList.toggle('hidden',!magicGroups(source,selections).length);
  if(magicGroups(source,selections).length)refreshMagicPicker();
}
function refreshOpenNames(){if(configured){$('configTitle').textContent=pairedName(labelOf(configured.source));refreshConfig();}if(detailUnit)openUnitDetail(detailUnit);}
document.addEventListener('tow-language-change',refreshOpenNames);
document.addEventListener('tow-glossary-ready',()=>{render();refreshOpenNames();});
async function loadMagicData(){if(magicData)return;try{const response=await fetch('./data/games/the-old-world/magic-items.json');if(response.ok)magicData=await response.json();}catch{}}
function openConfig(source,existing=null,initialCount=null) {
  const count=existing?.count||whole(initialCount||source.minimum||1,Number(source.minimum)||1,Number(source.maximum)||999);
  configured={source,id:existing?.id||null,count,selections:existing?.selections?{...existing.selections}:OPT.defaults(source,optionComposition(source)),magicItems:(existing?.magicItems||[]).map(item=>({...item})),lore:existing?.lore||source.lores?.[0]||'',options:existing?.options||''};
  renderManualStats('config',existing?.manualStats||{});
  $('configDetachmentWrap').classList.toggle('hidden',!source.detachment && !existing?.isDetachment);
  $('configDetachment').checked=Boolean(existing?.isDetachment);
  $('configTitle').textContent=pairedName(labelOf(source));$('configTitle').dataset.noI18n='';
  $('configCount').min=source.minimum||1;$('configCount').max=source.maximum||999;$('configCount').value=count;
  $('configLabel').value=existing?.label||'';$('configNotes').value=configured.options;
  $('configSave').textContent=existing?'변경 저장':'로스터에 추가';
  $('configMagic').classList.toggle('hidden',!magicGroups(source,configured.selections).length);
  $('configLore').classList.toggle('hidden',!source.lores?.length);
  const loreChoices=$('loreChoices');loreChoices.replaceChildren();
  for(const value of source.lores||[]){const row=node('div','','loreChoice');const label=node('label','','configChoice'+(value===configured.lore?' selected':''));const input=document.createElement('input');input.type='radio';input.name='lorePick';input.value=value;input.checked=value===configured.lore;label.append(input,node('span',slugTitle(value),'configChoiceText'));row.append(label);const rule=value==='shadowlands'?'Lore of the Shadowlands':slugTitle(value);const links=optionRuleLinks(rule);if(links)row.append(links);loreChoices.append(row);}
  $('configBackdrop').classList.remove('hidden');refreshConfig();loadMagicData().then(()=>{if(configured?.source===source)refreshMagicPicker();});$('configTitle').focus({preventScroll:true});
}
function closeConfig(){$('configBackdrop').classList.add('hidden');configured=null;}
function quickAdd(unit) {openConfig(unit);}
async function loadRuleIndex(){if(ruleIndexPromise)return ruleIndexPromise;ruleIndexPromise=(async()=>{try{const [index,aliases]=await Promise.all([fetch('./data/src/components/rules-index/rules-index-export.json'),fetch('./data/src/components/rules-index/rule-aliases.json')]);if(index.ok)rulesIndex=await index.json();if(aliases.ok)ruleAliases=await aliases.json();if(configured)refreshConfig();if(detailUnit)openUnitDetail(detailUnit);renderPlay();}catch{}})();return ruleIndexPromise;}
async function fetchArmyData(id){
  if(!armyCache.has(id)){const response=await fetch(`./data/games/the-old-world/${encodeURIComponent(id)}.json`);if(!response.ok)throw Error('진영 데이터를 읽지 못했습니다.');armyCache.set(id,await response.json());}
  return armyCache.get(id);
}
async function loadPlaySources(army){
  if(!army)return;
  const missing=[...new Set([army.faction,...army.units.map(unit=>unit.sourceFaction).filter(Boolean)])].filter(id=>!armyCache.has(id));
  if(!missing.length)return;
  await Promise.allSettled(missing.map(id=>fetchArmyData(id)));
  renderPlay();
}
async function loadPlayWeaponProfiles(){
  try{const response=await fetch('./data/play-weapon-profiles.json');if(response.ok){playWeaponProfiles=await response.json();renderPlay();}}catch{}
}
function confirmRosterForPlay(){
  if(!state.units.length){toast(playText('먼저 유닛을 추가하세요.','Add units first.'));return;}
  if(!CORE.confirmPlayRoster(state)){toast(playText('저장 공간이 부족해 로스터를 확정할 수 없습니다. JSON으로 내보내세요.','Could not save the confirmed roster. Export it as JSON to preserve it.'));return;}
  $('playSearch').value='';showScreen('play');
  toast(playText('로스터를 확정했습니다.','Roster confirmed.'));
}
async function loadMercenaries(id,composition){
  const lists=metadata?.armies?.find(army=>army.id===id)?.mercenaries?.[composition]||[];
  const result=[],seen=new Set();
  for(const reference of lists){
    let data;try{data=await fetchArmyData(reference.army);}catch{continue;}
    for(const unitId of reference.units||[]){
      const key=`${reference.army}:${unitId}`;if(seen.has(key))continue;seen.add(key);
      const source=CATEGORY_KEYS.flatMap(category=>data[category]||[]).find(unit=>unit.id===unitId);
      if(source)result.push({...source,category:'mercenaries',_sourceFaction:reference.army,_optionComposition:reference.army});
    }
  }
  return result;
}
async function loadArmy(id) {
  try {
    const composition=state.composition,data=await fetchArmyData(id),mercs=await loadMercenaries(id,composition);
    if (id !== state.faction || composition!==state.composition) return;
    armyData=data;mercenaryPool=mercs;renderCatalog();renderRoster();renderPlay();
  } catch { armyData = null;mercenaryPool=[];renderCatalog();toast('진영 데이터를 불러오지 못했습니다. 직접 입력은 사용할 수 있습니다.'); }
}
async function loadMetadata() {
  try {
    const response = await fetch('./data/src/assets/the-old-world.json');
    if (!response.ok) throw Error('진영 목록을 읽지 못했습니다.');
    metadata = await response.json();
    if (!metadata.armies.some(army => army.id === state.faction)) state.faction = 'kingdom-of-bretonnia';
    render(); await loadArmy(state.faction);
  } catch { toast('진영 목록을 불러오지 못했습니다. 직접 입력은 사용할 수 있습니다.'); }
}

for (const id of ['category','editCategory']) $(id).replaceChildren(...CATEGORY_KEYS.map(category => option(category,CATEGORY_LABELS[category])));
$('preset').replaceChildren(option('','데이터를 불러오는 중…'));
async function switchFaction(chosen) {
  if (chosen === state.faction) { showScreen('reference'); return; }
  save(); state = CORE.loadFaction(chosen);
  state.composition = metadata?.armies?.find(army => army.id === chosen)?.armyComposition?.includes(state.composition) ? state.composition : metadata?.armies?.find(army => army.id === chosen)?.armyComposition?.[0] || chosen;
  armyData = null;mercenaryPool=[];update(); renderCatalog(); await loadArmy(chosen); showScreen('reference');
}
$('faction').addEventListener('change',event => switchFaction(event.target.value));
$('bottomNav').addEventListener('click',event => {const button=event.target.closest('[data-primary]');if(button)showScreen({home:'home',army:'reference',library:'rules',play:'play',saved:'saved'}[button.dataset.primary]);});
$('sectionNav').addEventListener('click',event=>{const button=event.target.closest('[data-screen]');if(button)showScreen(button.dataset.screen);});
$('homeScreen').addEventListener('click',event=>{const button=event.target.closest('[data-home-screen]');if(button)showScreen(button.dataset.homeScreen);});
$('factionGrid').addEventListener('click',event => {const button=event.target.closest('[data-faction]');if(button)switchFaction(button.dataset.faction);});
$('factionSearch').addEventListener('input',renderFactions);
$('referenceSearch').addEventListener('input',renderReference);
$('referenceCategory').addEventListener('change',renderReference);
$('playSearch').addEventListener('input',renderPlay);
$('confirmRoster').addEventListener('click',confirmRosterForPlay);
$('playConfirm').addEventListener('click',confirmRosterForPlay);
$('playEdit').addEventListener('click',()=>showScreen('roster'));
$('playQuick').addEventListener('click',()=>showScreen('quicksheet'));
$('playRules').addEventListener('click',()=>showScreen('rules'));
$('playUnits').addEventListener('click',event=>{
  const rule=event.target.closest('[data-rule]');if(rule){event.preventDefault();openRule(rule.dataset.rule,rule.dataset.rulePath||null);return;}
  const detail=event.target.closest('[data-play-details]');if(!detail)return;
  const army=CORE.loadPlayRoster(state.faction)?.army,unit=army?.units.find(item=>item.id===detail.dataset.playDetails),source=unit&&rosterSource(unit,army);if(source)openUnitDetail(source);
});
$('referenceGrid').addEventListener('click',event => {
  const rule=event.target.closest('[data-rule]');if(rule){openRule(rule.dataset.rule);return;}
  const button=event.target.closest('[data-reference-action]');if(!button)return;
  const unit=catalog.get(button.dataset.catalogKey);if(!unit)return;
  if(button.dataset.referenceAction==='quickadd')quickAdd(unit);else openUnitDetail(unit);
});
$('detailRules').addEventListener('click',event=>{const rule=event.target.closest('[data-rule]');if(rule)openRule(rule.dataset.rule);});
$('detailOptions').addEventListener('click',event=>{const rule=event.target.closest('[data-rule]');if(rule)openRule(rule.dataset.rule);});
$('detailAdd').addEventListener('click',()=>{if(detailUnit)quickAdd(detailUnit);closeUnitDetail();});
const configGroups=$('configGroups');
configGroups.addEventListener('click',event=>{const rule=event.target.closest('[data-rule]');if(rule)openRule(rule.dataset.rule);});
$('loreChoices').addEventListener('click',event=>{const rule=event.target.closest('[data-rule]');if(rule)openRule(rule.dataset.rule);});
$('loreChoices').addEventListener('change',event=>{if(!configured||event.target.name!=='lorePick')return;configured.lore=event.target.value;for(const row of $('loreChoices').querySelectorAll('.configChoice'))row.classList.toggle('selected',row.querySelector('input')?.checked);});
configGroups.addEventListener('change',event=>{
  if(!configured)return;
  const path=event.target.dataset.path;
  if(path){
    const selected=configured.selections,entry=OPT.entries(configured.source,optionComposition(configured.source)).find(item=>item.path===path);
    if(!entry)return;
    if(event.target.checked){
      if(entry.field==='mounts' || entry.field==='armor' && (configured.source.armor||[]).length>1 || entry.field==='equipment' && !entry.entry.group || entry.field==='command' && entry.entry.exclusive!==false && configured.source.category==='characters'){
        for(const peer of OPT.entries(configured.source,optionComposition(configured.source)))if(peer.field===entry.field && !peer.depth && peer.path!==path && (entry.field!=='equipment'||!peer.entry.group))delete selected[peer.path];
      }
      if(entry.entry.exclusive){for(const peer of OPT.entries(configured.source,optionComposition(configured.source)))if(peer.parentKey===entry.parentKey && peer.entry.exclusive)delete selected[peer.path];}
      selected[path]=entry.entry.stackable ? entry.entry.minimum||1 : true;
    }else {delete selected[path];for(const key of Object.keys(selected))if(key.startsWith(`${path}/`))delete selected[key];}
    if(entry.field==='command'){const offset=(configured.source.items||[]).length;configured.magicItems=configured.magicItems.filter(item=>item.slot<offset || OPT.active(selected[`command:${item.slot-offset}`]));}
  }else if(event.target.dataset.amount){configured.selections[event.target.dataset.amount]=whole(event.target.value,1,99);}
  refreshConfig();
});
$('configCount').addEventListener('input',()=>{if(configured)refreshConfig();});
$('magicGroupsList').addEventListener('change',event=>{
  const select=event.target.closest('select[data-magic-slot]');if(!select||!configured)return;
  const slot=Number(select.dataset.magicSlot),group=magicGroups(configured.source,configured.selections).find(item=>item.slot===slot)?.group;
  const item=group&&select.value!==''?magicOptions(group)[Number(select.value)]:null;
  const preview=$('magicGroupsList').querySelector(`[data-magic-preview="${slot}"]`);preview.replaceChildren();
  if(item){const name=node('p','','magicChoiceName');name.append(sourceName('span',labelOf(item)),document.createTextNode(` · ${itemPrice(item)}`));name.dataset.noI18n='';preview.append(name);const links=optionRuleLinks(labelOf(item));if(links)preview.append(links);}
});
function addMagicItem(slot,item){
  if(!configured||!item)return false;
  const group=magicGroups(configured.source,configured.selections).find(value=>value.slot===slot)?.group;
  if(!group)return false;
  const chosen=configured.magicItems,used=chosen.filter(value=>value.slot===slot).reduce((sum,value)=>sum+value.points,0);
  if(group.maxPoints && used+Number(item.points)>group.maxPoints){toast(`${labelOf(group)} 한도를 초과합니다.`);return false;}
  if(group.maxItemsPerCategory && chosen.filter(value=>value.slot===slot&&value.type===item.type).length>=group.maxItemsPerCategory){toast(`${labelOf(group)} 종류별 선택 개수를 초과합니다.`);return false;}
  const copies=chosen.filter(value=>value.slot===slot&&value.group===item.group&&value.name===labelOf(item)).length;
  if((!item.stackable&&copies)||(item.maximum&&copies>=item.maximum)){toast('이 아이템의 선택 가능 개수에 도달했습니다.');return false;}
  if(item.onePerArmy && state.units.some(unit=>unit.magicItems?.some(value=>value.name===labelOf(item)) && unit.id!==configured.id)){toast('군세에서 이미 선택한 아이템입니다.');return false;}
  if(chosen.length>=30){toast('한 유닛에 선택 항목을 30개까지 저장할 수 있습니다.');return false;}
  chosen.push({group:item.group,name:labelOf(item),points:Number(item.points)||0,type:item.type||'',slot});refreshConfig();return true;
}
$('magicGroupsList').addEventListener('click',event=>{
  const rule=event.target.closest('[data-rule]');if(rule){openRule(rule.dataset.rule);return;}
  const remove=event.target.closest('[data-magic-remove]');if(remove&&configured){configured.magicItems.splice(Number(remove.dataset.magicRemove),1);refreshConfig();return;}
  const increment=event.target.closest('[data-magic-increment]');if(increment&&configured){const selected=configured.magicItems[Number(increment.dataset.magicIncrement)];if(!selected)return;const group=magicGroups(configured.source,configured.selections).find(value=>value.slot===selected.slot)?.group;const item=group&&magicOptions(group).find(value=>value.group===selected.group&&value.type===selected.type&&labelOf(value)===selected.name);addMagicItem(selected.slot,item);return;}
  const add=event.target.closest('[data-magic-add]');if(!add)return;
  if(!configured||!magicData)return;
  const slot=Number(add.dataset.magicAdd),group=magicGroups(configured.source,configured.selections).find(item=>item.slot===slot)?.group,choice=add.closest('.magicGroupCard')?.querySelector('select[data-magic-slot]')?.value;
  if(!group||choice===''){toast('마법 아이템을 선택하세요.');return;}
  addMagicItem(slot,magicOptions(group)[Number(choice)]);
});
$('closeConfig').addEventListener('click',closeConfig);
$('configBackdrop').addEventListener('click',event=>{if(event.target===$('configBackdrop'))closeConfig();});
$('configSave').addEventListener('click',()=>{
  if(!configured)return;
  const {source,selections,magicItems}=configured,count=whole($('configCount').value,Number(source.minimum)||1,Math.min(999,Number(source.maximum)||999));
  const old=state.units.find(unit=>unit.id===configured.id);
  const record=normalizeUnit({...old,name:labelOf(source),category:source.category,count,points:OPT.price(source,count,selections,magicItems,optionComposition(source)),label:$('configLabel').value.trim(),options:$('configNotes').value.trim(),sourceId:source.id,sourceFaction:source._sourceFaction||state.faction,sourceComposition:optionComposition(source),isDetachment:$('configDetachment').checked,manualStats:readManualStats('config'),basePoints:source.points,selections,magicItems,lore:source.lores?.length ? configured.lore : '',pointsOverride:false});
  if(old)state.units[state.units.indexOf(old)]=record;else state.units.push(record);
  closeConfig();update();showScreen('roster');toast(old?'유닛 옵션을 저장했습니다.':'유닛을 로스터에 추가했습니다.');
});
$('closeDetail').addEventListener('click',closeUnitDetail);
$('detailBackdrop').addEventListener('click',event=>{if(event.target===$('detailBackdrop'))closeUnitDetail();});
$('closeRule').addEventListener('click',closeRule);
$('ruleBackdrop').addEventListener('click',event=>{if(event.target===$('ruleBackdrop'))closeRule();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('ruleBackdrop').classList.contains('hidden'))closeRule();else if(!$('configBackdrop').classList.contains('hidden'))closeConfig();else if(!$('detailBackdrop').classList.contains('hidden'))closeUnitDetail();else if(document.querySelector('.top-actions')?.classList.contains('open'))closeMenu();}});
$('saveCurrentBtn').addEventListener('click',()=>{if(CORE.saveSnapshot(state)){renderSaved();toast('현재 로스터를 저장했습니다.');}else toast('저장 공간이 부족합니다. JSON으로 내보내세요.');});
$('savedGrid').addEventListener('click',event=>{
  const button=event.target.closest('[data-saved-action]');if(!button)return;
  const index=Number(button.dataset.index),saved=CORE.listSaved(state.faction),item=saved[index];if(!item)return;
  if(button.dataset.savedAction==='delete'){if(!confirm('저장된 로스터를 삭제하시겠습니까?'))return;CORE.deleteSnapshot(state.faction,index);renderSaved();toast('저장된 로스터를 삭제했습니다.');return;}
  if(!confirm('저장된 로스터를 불러오시겠습니까? 현재 편집 내용은 저장 목록에 보관됩니다.'))return;
  CORE.saveSnapshot(state);state=normalize(item.army);update();renderCatalog();showScreen('roster');toast('저장된 로스터를 불러왔습니다.');
});
$('armyType').addEventListener('change',async event => {state.composition = event.target.value;mercenaryPool=[];update();renderCatalog();await loadArmy(state.faction);toast('편성을 변경했습니다. 기존 유닛의 편성 적합성을 확인하세요.');});
$('matchedMode').addEventListener('change',event=>{state.matchedMode=event.target.value;update();toast('매치드 플레이 구성을 변경했습니다.');});
for (const [id,key,transform] of [['armyName','name',value => value.slice(0,80)],['pointLimit','limit',value => whole(value,1,999999)],['armyNotes','notes',value => value.slice(0,2000)]]) {
  $(id).addEventListener('change',event => {state[key] = transform(event.target.value); update();});
}
$('preset').addEventListener('change',() => {
  const unit = catalog.get($('preset').value);
  if (!unit) { $('unitName').value = ''; $('unitPoints').value = ''; manualPoints = false; return; }
  const count = whole(unit.minimum || 1,1,999);
  $('unitName').value = labelOf(unit); $('category').value = unit.category; $('unitCount').value = count;
  $('unitPoints').value = whole(unit.points,0,999999) * count; manualPoints = false;
});
$('unitCount').addEventListener('input',() => {const unit = catalog.get($('preset').value); if (unit && !manualPoints) $('unitPoints').value = whole(unit.points,0,999999) * whole($('unitCount').value,1,999);});
$('unitPoints').addEventListener('input',() => {manualPoints = true;});
$('addBtn').addEventListener('click',() => {
  const source = catalog.get($('preset').value);
  if(source){openConfig(source,null,$('unitCount').value);return;}
  const name = $('unitName').value.trim(); if (!name) { $('unitName').focus(); toast('유닛 이름을 입력하세요.'); return; }
  const raw = $('unitPoints').value; if (raw === '' || Number(raw) < 0) { $('unitPoints').focus(); toast('총 포인트를 입력하세요.'); return; }
  state.units.push(normalizeUnit({name,category:$('category').value,count:$('unitCount').value,points:raw,label:$('unitLabel').value.trim(),options:$('unitOptions').value.trim(),sourceId:source?.id,sourceFaction:source ? state.faction : '',basePoints:source?.points}));
  for (const id of ['unitName','unitPoints','unitLabel','unitOptions']) $(id).value = '';
  $('unitCount').value = 1; $('preset').value = ''; manualPoints = false; update(); toast('유닛을 추가했습니다.');
});
$('rosterBody').addEventListener('click',event => {
  const rule=event.target.closest('[data-rule]');if(rule){openRule(rule.dataset.rule);return;}
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const index = state.units.findIndex(unit => unit.id === button.dataset.id); if (index < 0) return;
  const unit = state.units[index];
  if (button.dataset.action === 'delete') { state.units.splice(index,1); update(); toast('유닛을 삭제했습니다.'); return; }
  if (button.dataset.action === 'duplicate') { state.units.splice(index+1,0,{...unit,id:crypto.randomUUID()}); update(); toast('유닛을 복제했습니다.'); return; }
  if (button.dataset.action === 'details') { const source=configuredSource(unit);if(source)openUnitDetail(source);return; }
  if (button.dataset.action === 'edit') {const source=configuredSource(unit);if(source){openConfig({...source,category:unit.category},unit);return;}}
  editing = unit.id;
  for (const [id,key] of [['editName','name'],['editCategory','category'],['editCount','count'],['editPoints','points'],['editLabel','label'],['editOptions','options']]) $(id).value = unit[key];
  $('editDetachment').checked=Boolean(unit.isDetachment);
  renderManualStats('edit',unit.manualStats||{});
  $('editBackdrop').classList.remove('hidden'); $('editHeading').focus({preventScroll:true});
});
function closeEdit() { $('editBackdrop').classList.add('hidden'); editing = null; }
$('cancelEdit').onclick = closeEdit;
$('editBackdrop').addEventListener('click',event => {if (event.target === $('editBackdrop')) closeEdit();});
document.addEventListener('keydown',event => {if (event.key === 'Escape' && !$('editBackdrop').classList.contains('hidden')) closeEdit();});
$('editCount').addEventListener('input',() => {const unit = state.units.find(item => item.id === editing); if (unit && unit.basePoints && unit.points === unit.basePoints * unit.count) $('editPoints').value = unit.basePoints * whole($('editCount').value,1,999);});
$('saveEdit').onclick = () => {
  const index = state.units.findIndex(unit => unit.id === editing); if (index < 0) return;
  const name = $('editName').value.trim(); if (!name) { $('editName').focus(); return; }
  const old = state.units[index];
  state.units[index] = normalizeUnit({...old,name,category:$('editCategory').value,count:$('editCount').value,points:$('editPoints').value,label:$('editLabel').value.trim(),options:$('editOptions').value.trim(),isDetachment:$('editDetachment').checked,manualStats:readManualStats('edit')});
  closeEdit(); update(); toast('유닛을 수정했습니다.');
};
$('newBtn').onclick = () => {if (!confirm('현재 로스터를 새 로스터로 바꾸시겠습니까? 먼저 JSON으로 내보낼 수 있습니다.')) return; const faction=state.faction,composition=state.composition,matchedMode=state.matchedMode;state=fresh(faction);state.composition=composition;state.matchedMode=matchedMode;state.name=`${armyName()} 군세`;update();toast('새 로스터를 만들었습니다.');};
$('clearBtn').onclick = () => {if (!state.units.length || !confirm('로스터의 모든 유닛을 삭제하시겠습니까?')) return;state.units=[];update();toast('유닛을 비웠습니다.');};
$('exportBtn').onclick = () => {const blob=new Blob([JSON.stringify(CORE.exportEnvelope(state),null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`old-world-roster-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
$('importBtn').onclick = () => $('importFile').click();
$('importFile').addEventListener('change',async event => {const file=event.target.files?.[0];if (!file) return;try {const parsed=CORE.importEnvelope(JSON.parse(await file.text()));if (!confirm('현재 로스터를 불러온 파일로 교체하시겠습니까?')) return;state=parsed;armyData=null;update();await loadArmy(state.faction);toast('로스터를 불러왔습니다.');} catch (error) {toast(error.message || '파일을 읽지 못했습니다.');} finally {event.target.value='';}});
$('printBtn').onclick = () => window.print();
$('copyBtn').onclick = async () => {const lines=[`${state.name} — ${armyName()} / ${compositionName()} / ${window.TOWMatchedPlay.MODES[state.matchedMode]?.en||"Open War"} (${fmt(state.limit)} pts)`];for (const category of CATEGORY_KEYS) {const units=state.units.filter(unit => unit.category === category);if (!units.length) continue;lines.push(`\n${CATEGORY_LABELS[category]}`);for (const unit of units){const source=configuredSource(unit);const chosen=source?OPT.describe(source,unit.selections,unit.magicItems,optionComposition(source)):[];lines.push(`- ${unit.name}${unit.label ? ` [${unit.label}]` : ''} · ${unit.count} 모델 · ${fmt(unit.points)} pts${chosen.length ? ` · ${chosen.join(', ')}` : ''}${unit.lore ? ` · ${slugTitle(unit.lore)}` : ''}${unit.options ? ` · ${unit.options.replaceAll('\n','; ')}` : ''}`);}}lines.push(`\n총 ${fmt(state.units.reduce((sum,unit) => sum + unit.points,0))} pts`);if (state.notes) lines.push(`\n메모: ${state.notes}`);try {await navigator.clipboard.writeText(lines.join('\n'));toast('로스터 텍스트를 복사했습니다.');} catch {toast('복사할 수 없습니다. 브라우저 권한을 확인하세요.');}};

let inspectedSeed=null;
const seedLabel=(ko,en)=>{const mode=window.TOWI18n?.language||'ko';return mode==='en'?en:mode==='both'?`${ko} / ${en}`:ko;};
function updateSeedLanguage(){
  const labels={seedHeading:['로스터 시드','Roster seed'],seedShareTab:['보내기','Share'],seedReceiveTab:['받기','Receive'],seedShareHint:['현재 로스터를 복사해 다른 사용자에게 보내세요.','Copy the current roster and send it to another player.'],seedOutputLabel:['내 로스터 시드','Your roster seed'],seedCopyBtn:['시드 복사','Copy seed'],seedReceiveHint:['받은 시드를 붙여넣고 내용을 확인하세요.','Paste a seed and review the roster before loading it.'],seedInputLabel:['받은 시드','Received seed'],seedInspectBtn:['내용 확인','Preview roster'],seedLoadBtn:['이 로스터 불러오기','Load this roster']};
  for(const [id,words] of Object.entries(labels))$(id).textContent=seedLabel(...words);
  $('seedShareBtn').textContent=seedLabel('시드 공유','Share seed');$('seedImportBtn').textContent=seedLabel('시드로 불러오기','Import seed');
  $('seedClose').setAttribute('aria-label',seedLabel('닫기','Close'));
  if(inspectedSeed)renderSeedPreview(inspectedSeed);
}
async function setSeedTab(mode){const share=mode==='share';$('seedShareTab').setAttribute('aria-selected',String(share));$('seedReceiveTab').setAttribute('aria-selected',String(!share));$('seedSharePanel').classList.toggle('hidden',!share);$('seedReceivePanel').classList.toggle('hidden',share);$('seedMessage').textContent='';$('seedHeading').focus({preventScroll:true});if(share&&!$('seedOutput').value){try{const seed=await window.TOWRosterSeed.encode(state);if(!$('seedBackdrop').classList.contains('hidden'))$('seedOutput').value=seed;}catch(error){$('seedMessage').textContent=error.message||seedLabel('시드를 만들 수 없습니다.','Could not create a seed.');}}}
function closeSeed(){inspectedSeed=null;$('seedBackdrop').classList.add('hidden');$('seedInput').value='';$('seedOutput').value='';$('seedPreview').classList.add('hidden');$('seedLoadBtn').classList.add('hidden');$('seedMessage').textContent='';}
function openSeed(mode){updateSeedLanguage();$('seedBackdrop').classList.remove('hidden');setSeedTab(mode);}
function renderSeedPreview(army){const faction=metadata?.armies?.find(item=>item.id===army.faction)?.name_en||slugTitle(army.faction),formation=slugTitle(army.composition),identity=formation.toLowerCase()===faction.toLowerCase()?faction:`${faction} · ${formation}`,total=CORE.totalPoints(army),box=$('seedPreview');box.replaceChildren(node('strong',army.name||seedLabel('이름 없는 로스터','Unnamed roster')),node('p',`${identity} · ${window.TOWMatchedPlay.MODES[army.matchedMode]?.en||"Open War"} · ${fmt(total)} / ${fmt(army.limit)} pts · ${army.units.length} ${seedLabel('유닛','units')}`),node('p',seedLabel('불러오면 해당 진영의 현재 로스터가 교체됩니다. 기존 로스터는 저장 목록에 보관됩니다.','Loading replaces the current roster for that faction. The previous roster is kept in Saved.')));box.classList.remove('hidden');}
$('seedShareBtn').addEventListener('click',()=>openSeed('share'));
$('seedImportBtn').addEventListener('click',()=>openSeed('receive'));
$('seedClose').addEventListener('click',closeSeed);
$('seedBackdrop').addEventListener('click',event=>{if(event.target===$('seedBackdrop'))closeSeed();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('seedBackdrop').classList.contains('hidden'))closeSeed();});
$('seedShareTab').addEventListener('click',()=>setSeedTab('share'));
$('seedReceiveTab').addEventListener('click',()=>setSeedTab('receive'));
$('seedOutput').addEventListener('click',event=>event.target.select());
$('seedCopyBtn').addEventListener('click',async()=>{const seed=$('seedOutput').value;if(!seed)return;try{await navigator.clipboard.writeText(seed);}catch{$('seedOutput').select();if(!document.execCommand('copy')){$('seedMessage').textContent=seedLabel('복사할 수 없습니다. 시드 문자열을 직접 선택해 복사하세요.','Copy failed. Select and copy the seed manually.');return;}}$('seedMessage').textContent=seedLabel('시드를 복사했습니다.','Seed copied.');});
$('seedInput').addEventListener('input',()=>{inspectedSeed=null;$('seedPreview').classList.add('hidden');$('seedLoadBtn').classList.add('hidden');$('seedMessage').textContent='';});
$('seedInspectBtn').addEventListener('click',async()=>{inspectedSeed=null;$('seedLoadBtn').classList.add('hidden');$('seedPreview').classList.add('hidden');try{const parsed=await window.TOWRosterSeed.decode($('seedInput').value);if(metadata&&!metadata.armies.some(army=>army.id===parsed.faction))throw Error(seedLabel('지원하지 않는 진영의 시드입니다.','This seed uses an unsupported faction.'));inspectedSeed=parsed;renderSeedPreview(parsed);$('seedLoadBtn').classList.remove('hidden');$('seedMessage').textContent='';}catch(error){$('seedMessage').textContent=error.message||seedLabel('시드를 읽을 수 없습니다.','Could not read the seed.');}});
$('seedLoadBtn').addEventListener('click',async()=>{if(!inspectedSeed)return;const imported=inspectedSeed;try{if(!CORE.saveSnapshot(state))throw Error(seedLabel('저장 공간이 부족해 기존 로스터를 보관할 수 없습니다.','There is not enough storage to keep the current roster.'));if(imported.faction!==state.faction){const key=`bth_tow_${imported.faction}_army_v1`;if(localStorage.getItem(key)&&!CORE.saveSnapshot(CORE.loadFaction(imported.faction)))throw Error(seedLabel('저장 공간이 부족해 대상 진영의 로스터를 보관할 수 없습니다.','There is not enough storage to keep the target faction roster.'));}if(!CORE.saveArmy(imported))throw Error(seedLabel('저장 공간이 부족해 로스터를 불러올 수 없습니다.','There is not enough storage to load the roster.'));state=imported;armyData=null;closeSeed();update();await loadArmy(state.faction);showScreen('roster');toast(seedLabel('시드 로스터를 불러왔습니다.','Roster loaded from seed.'));}catch(error){$('seedMessage').textContent=error.message||seedLabel('로스터를 불러올 수 없습니다.','Could not load the roster.');}});
document.addEventListener('tow-language-change',updateSeedLanguage);

function closeMenu(){document.querySelector('.top-actions')?.classList.remove('open');$('menuBtn').setAttribute('aria-expanded','false');}
$('menuBtn').addEventListener('click',()=>{const open=document.querySelector('.top-actions').classList.toggle('open');$('menuBtn').setAttribute('aria-expanded',String(open));});
$('actionItems').addEventListener('click',event=>{if(event.target.closest('button'))closeMenu();});
document.addEventListener('click',event=>{if(!event.target.closest('.top-actions'))closeMenu();});
updateSeedLanguage();render(); showScreen(screen); loadMetadata(); loadRuleIndex();loadPlayWeaponProfiles();
document.addEventListener('tow-language-change',()=>{if(armyData)renderCatalog();render();});
