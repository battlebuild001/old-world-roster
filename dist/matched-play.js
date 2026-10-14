'use strict';

// Summaries and checks based on the Matched Play Guide, p. 13.
// Army list restrictions remain authoritative when they are more specific.
window.TOWMatchedPlay = (() => {
  const MODES = Object.freeze({
    'open-war': {ko:'오픈 워',en:'Open War',url:'https://tow.whfb.app/matched-play/open-war'},
    'combined-arms': {ko:'콤바인드 암즈',en:'Combined Arms',url:'https://tow.whfb.app/matched-play/combined-arms'},
    'grand-melee': {ko:'그랜드 멜레',en:'Grand Melee',url:'https://tow.whfb.app/matched-play/grand-melee'}
  });
  const entry = (ko,en,kind='warning') => ({ko,en,kind});
  const restricted = (source,composition) => /\b0-\d|\bper\s+\d|\bup to\b|\bmaximum\b/i.test(
    [source?.armyComposition?.[composition]?.notes?.name_en,source?.notes?.name_en].filter(Boolean).join(' ')
  );
  function check(army,resolveSource,describeOptions) {
    const findings=[],units=army.units||[],total=units.reduce((sum,unit)=>sum+Number(unit.points||0),0);
    if(total>army.limit)findings.push(entry(`포인트 초과: ${total} / ${army.limit} pts`,`Points exceeded: ${total} / ${army.limit} pts`,'error'));
    if(army.matchedMode==='combined-arms') {
      const extra=Math.max(0,Math.floor((army.limit-2000)/1000));
      const limits={characters:3,core:4,special:3,rare:2,mercenaries:2};
      const groups=new Map();
      for(const unit of units) {
        const source=resolveSource(unit);
        if(!source||source.named&&unit.category==='characters'||unit.isDetachment||restricted(source,army.composition))continue;
        const key=`${unit.category}:${unit.sourceFaction||army.faction}:${unit.sourceId}`;
        const group=groups.get(key)||{name:unit.name,category:unit.category,count:0};group.count++;groups.set(key,group);
      }
      for(const group of groups.values()) {
        const limit=(limits[group.category]||0)+extra;
        if(group.count>limit)findings.push(entry(`${group.name}: ${group.count}개 편성, 동일 유닛 한도 ${limit}개`,`${group.name}: ${group.count} entries; limit ${limit} of the same unit`,'error'));
      }
      if(units.some(unit=>!unit.sourceId))findings.push(entry('직접 입력 유닛의 중복 제한은 직접 확인하세요.','Check duplicate limits for manually entered units.','note'));
    }
    if(army.matchedMode==='grand-melee') {
      const maxPoints=army.limit*0.25,models=units.reduce((sum,unit)=>sum+Number(unit.count||0),0),wizards={3:0,4:0};
      for(const unit of units) {
        const source=resolveSource(unit);
        if(source?.named&&unit.category==='characters')continue;
        if(unit.points>maxPoints)findings.push(entry(`${unit.name}: ${unit.points} pts — 단일 유닛 한도 ${maxPoints} pts`,`${unit.name}: ${unit.points} pts exceeds the ${maxPoints} pt single unit limit`,'error'));
        if(models&&unit.count>models/2)findings.push(entry(`${unit.name}: 전체 ${models}모델 중 ${unit.count}모델 — 50% 초과`,`${unit.name}: ${unit.count} of ${models} models exceeds 50%`,'error'));
        const choices=source ? describeOptions(source,unit) : [];
        const level=String([...choices,unit.options||''].join(' ')).match(/(?:Level\s*([34])\s*Wizard|([34])\s*레벨\s*마법사)/i);
        if(level)wizards[Number(level[1]||level[2])]++;
      }
      const l3=Math.floor(army.limit/1000),l4=Math.floor(army.limit/2000);
      if(wizards[3]>l3)findings.push(entry(`3레벨 마법사 ${wizards[3]}명 — 한도 ${l3}명`,`Level 3 Wizards: ${wizards[3]}; limit ${l3}`,'error'));
      if(wizards[4]>l4)findings.push(entry(`4레벨 마법사 ${wizards[4]}명 — 한도 ${l4}명`,`Level 4 Wizards: ${wizards[4]}; limit ${l4}`,'error'));
      if(units.some(unit=>!unit.sourceId))findings.push(entry('직접 입력 유닛의 마법사 레벨과 이름 있는 캐릭터 여부는 직접 확인하세요.','Check wizard levels and named characters for manually entered units.','note'));
    }
    return findings;
  }
  return Object.freeze({MODES,check});
})();
