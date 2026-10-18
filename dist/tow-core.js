'use strict';

// Game-specific domain adapter. Keep this independent from the UI so the
// existing BTH app can load The Old World as another game module later.
window.BTHTOWCore = (() => {
  const GAME_ID = 'the-old-world';
  const FORMAT = 'BTH_TOW_V1';
  const DATA_COMMIT = 'de3b6c3b585d348eef7e219ac0964ee2791e0963';
  const PREFIX = 'bth_tow';
  const CURRENT_KEY = `${PREFIX}_current_v1`;
  const LEGACY_KEY = 'old-world-bretonnia-roster-v1';
  const CATEGORIES = ['characters','core','special','rare','mercenaries'];
  const MATCHED_MODES = ['open-war','combined-arms','grand-melee'];
  const whole = (value,min,max) => Math.max(min,Math.min(max,Math.trunc(Number(value) || 0)));
  const armyKey = faction => `${PREFIX}_${faction}_army_v1`;
  const savedKey = faction => `${PREFIX}_${faction}_saved_v1`;
  const playKey = faction => `${PREFIX}_${faction}_play_v1`;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key,value) => { try { localStorage.setItem(key,value); return true; } catch { return false; } };
  const fresh = (faction='kingdom-of-bretonnia') => ({version:2,faction,composition:faction,matchedMode:'open-war',name:faction==='kingdom-of-bretonnia'?'새 브레토니아 군세':'새 군세',limit:2000,notes:'',units:[]});
  function normalizeUnit(unit) {
    const rawCategory = String(unit.category || 'core').toLowerCase();
    return {
      id:String(unit.id || crypto.randomUUID()),
      name:String(unit.name || '이름 없는 유닛').slice(0,100),
      category:CATEGORIES.includes(rawCategory) ? rawCategory : 'core',
      count:whole(unit.count,1,999), points:whole(unit.points,0,999999),
      label:String(unit.label || '').slice(0,80), options:String(unit.options || '').slice(0,1000),
      sourceId:String(unit.sourceId || ''), sourceFaction:String(unit.sourceFaction || ''),
      sourceComposition:String(unit.sourceComposition || ''), isDetachment:Boolean(unit.isDetachment),
      manualStats:Object.fromEntries(['M','WS','BS','S','T','W','I','A','Ld'].filter(key=>unit.manualStats&&String(unit.manualStats[key]||'').trim()).map(key=>[key,String(unit.manualStats[key]).trim().slice(0,16)])),
      basePoints:whole(unit.basePoints || 0,0,999999),
      selections:unit.selections && typeof unit.selections === 'object' && !Array.isArray(unit.selections) ? unit.selections : {},
      magicItems:Array.isArray(unit.magicItems) ? unit.magicItems.slice(0,30).map(item=>({group:String(item.group||''),name:String(item.name||''),points:whole(item.points,0,99999),type:String(item.type||''),slot:whole(item.slot,0,99)})) : [],
      lore:String(unit.lore || '').slice(0,80),
      pointsOverride:Boolean(unit.pointsOverride)
    };
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.units)) throw Error('올바른 로스터 파일이 아닙니다.');
    const faction = String(raw.faction || 'kingdom-of-bretonnia');
    return {version:2,faction,composition:String(raw.composition || faction),matchedMode:MATCHED_MODES.includes(raw.matchedMode)?raw.matchedMode:'open-war',name:String(raw.name || '새 군세').slice(0,80),limit:whole(raw.limit || 2000,1,999999),notes:String(raw.notes || '').slice(0,2000),units:raw.units.slice(0,1000).map(normalizeUnit)};
  }
  function loadFaction(faction) {
    try { const raw = read(armyKey(faction)); if (raw) return normalize(JSON.parse(raw)); } catch {}
    return fresh(faction);
  }
  function loadCurrent() {
    const faction = read(CURRENT_KEY);
    if (faction) return loadFaction(faction);
    try {
      const legacy = read(LEGACY_KEY);
      if (legacy) { const army = normalize(JSON.parse(legacy)); saveArmy(army); return army; }
    } catch {}
    return fresh();
  }
  function saveArmy(army) {
    const saved = write(armyKey(army.faction),JSON.stringify(normalize(army)));
    write(CURRENT_KEY,army.faction);
    return saved;
  }
  function listSaved(faction) {
    try {
      const value = JSON.parse(read(savedKey(faction)) || '[]');
      return Array.isArray(value) ? value.filter(item => item && item.army && Array.isArray(item.army.units)).slice(0,30) : [];
    } catch { return []; }
  }
  function saveSnapshot(army) {
    const list = listSaved(army.faction);
    list.unshift({when:new Date().toLocaleString('ko-KR'),army:normalize(army)});
    return write(savedKey(army.faction),JSON.stringify(list.slice(0,30)));
  }
  function deleteSnapshot(faction,index) {
    const list = listSaved(faction);
    if (index < 0 || index >= list.length) return false;
    list.splice(index,1);
    return write(savedKey(faction),JSON.stringify(list));
  }
  function loadPlayRoster(faction) {
    try {
      const value=JSON.parse(read(playKey(faction))||'null');
      if(!value?.army||value.army.faction!==faction)return null;
      return {army:normalize(value.army),confirmedAt:String(value.confirmedAt||'')};
    } catch { return null; }
  }
  function confirmPlayRoster(army) {
    const snapshot={army:normalize(army),confirmedAt:new Date().toISOString()};
    return write(playKey(army.faction),JSON.stringify(snapshot));
  }
  function playRosterChanged(army,snapshot) {
    return !snapshot||JSON.stringify(normalize(army))!==JSON.stringify(normalize(snapshot.army));
  }
  function exportEnvelope(army) { return {format:FORMAT,game:GAME_ID,faction:army.faction,source:{name:'Old World Builder',commit:DATA_COMMIT},army:normalize(army)}; }
  function importEnvelope(value) {
    if (value?.format === FORMAT && value.game === GAME_ID) return normalize({...value.army,faction:value.faction});
    // Accept roster files created by the earlier standalone builder.
    if (Array.isArray(value?.units)) return normalize(value);
    throw Error('올드 월드 로스터 파일이 아닙니다.');
  }
  function unitsForComposition(data,composition) {
    const result=[];
    for (const originalCategory of CATEGORIES.slice(0,4)) for (const unit of data?.[originalCategory] || []) {
      const map=unit.armyComposition;
      if (map && Object.keys(map).length && !map[composition]) continue;
      const category=map?.[composition]?.category || originalCategory;
      if (CATEGORIES.includes(category)) result.push({...unit,category});
    }
    return result;
  }
  const totalPoints = army => army.units.reduce((sum,unit) => sum + unit.points,0);
  const validate = army => ({errors:totalPoints(army)>army.limit ? [`포인트 초과: ${totalPoints(army)} / ${army.limit}`] : [],warnings:['군세 편성 제한과 일부 조건부 옵션은 자동 검사하지 않습니다.']});
  return Object.freeze({GAME_ID,FORMAT,DATA_COMMIT,CATEGORIES,fresh,normalize,normalizeUnit,loadCurrent,loadFaction,saveArmy,listSaved,saveSnapshot,deleteSnapshot,loadPlayRoster,confirmPlayRoster,playRosterChanged,exportEnvelope,importEnvelope,unitsForComposition,totalPoints,validate});
})();
