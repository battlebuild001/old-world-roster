'use strict';

// Tableside profiles. Printed profiles stay intact; equipment alternatives and
// temporary effects are separate so their bonuses cannot accidentally stack.
window.TOWPlayProfiles = (() => {
  const keys = Object.freeze(['M','WS','BS','S','T','W','I','A','Ld']);
  const nameOf = value => String(value?.name_en || value?.name || value?.id || '');
  const normal = value => String(value || '').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[{}*]/g,'').replace(/\s+/g,' ').trim();
  const valueOf = value => /^\d+$/.test(String(value)) ? Number(value) : null;
  const sourceUrl = name => `magic-item/${normal(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
  const specialParts = value => String(value || '').split(/,\s*(?![^()]*\))/).map(part=>part.trim()).filter(Boolean);
  const weaponAliases = {'hand weapons':'hand weapon','great weapons':'great weapon','halberds':'halberd','flails':'flail','lances':'lance','cavalry spears':'cavalry spear','additional hand weapons':'additional hand weapon','two hand weapons':'additional hand weapon','thrusting spears':'thrusting spear','throwing spears':'throwing spear','longbows':'longbow','shortbows':'shortbow','bows':'bow','crossbows':'crossbow','handguns':'handgun','pistols':'pistol','javelins':'javelin','slings':'sling'};
  const aliases = {'despot':'Despot {renegade}','castellan':'Castellan {renegade}','seneschal':'Seneschal {renegade}','chaos dwarf warriors':'Chaos Dwarf Warriors {renegade}','gors':'Gor Herd','ungors':'Ungor Herd'};
  const weapon = (strength,armourPiercing,rules=[],extra={}) => ({range:'Combat',strength,armourPiercing,rules,...extra});
  // Values checked against tow.whfb.app. Numeric modifiers are *weapon-use*
  // modifiers, never permanent changes to the wielder's printed characteristic.
  const weapons = {
    'hand weapon':weapon('S','-',[]),
    'great weapon':weapon('S+2','-2',['Armour Bane (1)','Requires Two Hands','Strike Last']),
    'halberd':weapon('S+1','-1 (-2 on the charge)',['Requires Two Hands'],{conditionKo:'이 무기로 공격할 때. 돌격한 상대에게 AP -2.',conditionEn:'When attacking with this weapon. AP -2 against enemies charged this turn.'}),
    'lance':weapon('S+2','-2',['Armour Bane (1)'],{conditionKo:'기병·몬스터가 돌격한 턴에, 돌격한 상대에게만.',conditionEn:'Cavalry/monsters: only against enemies charged this turn.'}),
    'flail':weapon('S+2','-2',['Armour Bane (1)','Requires Two Hands'],{conditionKo:'힘 +2와 Armour Bane은 이 턴에 돌격한 상대에게만.',conditionEn:'Strength +2 and Armour Bane apply only against enemies charged this turn.'}),
    'cavalry spear':weapon('S+1','-1',[],{conditionKo:'기병·몬스터·전차가 돌격한 턴에만.',conditionEn:'Cavalry/monsters/chariots: only during a turn in which the wielder charged.'}),
    'additional hand weapon':weapon('S','-',['Extra Attacks (+1)','Requires Two Hands'],{extraModifiers:{A:1},conditionKo:'두 무기를 사용하는 도보 모델의 공격에만.',conditionEn:'Only when an infantry model fights with two hand weapons.'}),
    'morning star':weapon('S+1','-1',['Armour Bane (1)'],{conditionKo:'힘 +1과 Armour Bane은 이 턴에 돌격한 상대에게만.',conditionEn:'Strength +1 and Armour Bane apply only against enemies charged this turn.'}),
    'sword of might':weapon('S+1','-1',['Magical Attacks']),
    'sword of battle':weapon('S+1','-1',['Armour Bane (1)','Extra Attacks (+1)','Magical Attacks'],{extraModifiers:{A:1}}),
    'ogre blade':weapon('S+2','-2',['Multiple Wounds (D3)','Armour Bane (1)','Magical Attacks']),
    'giant blade':weapon('S+1','-',['Multiple Wounds (2)','Armour Bane (2)','Magical Attacks']),
    'longbow':weapon('3','-',['Armour Bane (1)','Volley Fire'],{range:'30"'}),
    'shortbow':weapon('3','-',['Quick Shot','Volley Fire'],{range:'18"'}),
    'bow':weapon('3','-',[],{range:'24"'}),
    'crossbow':weapon('4','-',['Armour Bane (2)','Ponderous'],{range:'30"'}),
    'handgun':weapon('4','-1',['Armour Bane (1)','Ponderous'],{range:'24"'}),
    'pistol':weapon('4','-1',['Armour Bane (1)','Quick Shot'],{range:'12"'}),
    'javelin':weapon('S','-',['Move & Shoot','Quick Shot'],{range:'12"'}),
    'throwing spear':weapon('S','-',['Fight in Extra Rank'],{conditionKo:'돌격한 턴에만 사용할 수 있는 근접 무기.',conditionEn:'A combat weapon that can be used only during a turn in which the wielder charged.'}),
    'sling':weapon('3','-',['Multiple Shots (2)'],{range:'18"'}),
    'chaos runesword':weapon('S+1','-1',['Magical Attacks'],{extraModifiers:{WS:1,I:1}}),
    "martog's best basha":weapon('S+1','-2',['Magical Attacks','Requires Two Hands'],{extraModifiers:{WS:1,I:1}}),
    "duellist's blades":weapon('S','-',['Magical Attacks','Extra Attacks (+2)','Requires Two Hands'],{extraModifiers:{A:2}}),
    'berserker blade':weapon('S+1','-1',['Magical Attacks','Extra Attacks (+1)','Impetuous'],{extraModifiers:{A:1}}),
    'cackling blade':weapon('S+1','-1',['Magical Attacks','Extra Attacks (+D6)'],{extraModifiers:{A:'D6'},conditionKo:'이 무기 사용 시. 추가 공격 주사위의 자연 6은 사용자에게 상처 1.',conditionEn:'When using this weapon; a natural 6 for extra attacks inflicts 1 Wound on the wielder.'}),
    'sword of reaving':weapon('S+1','-1',['Magical Attacks','Extra Attacks (+D3)'],{extraModifiers:{A:'D3'}}),
    "headsman's axe":weapon('S+1','-1',['Killing Blow','Magical Attacks','Requires Two Hands']),
    'meteor hammer':weapon('S','-3',['Magical Attacks','Requires Two Hands'],{conditionKo:'이 무기로 공격할 때. 피해 굴림 3+는 항상 성공.',conditionEn:'When using this weapon; a To Wound roll of 3+ always succeeds.'}),
    'grim verdict':weapon('S+3','-1',['Armour Bane (2)','Furious Charge','Impetuous','Magical Attacks','Requires Two Hands','Strike Last']),
    'flail of wrecks':weapon('S+2','-2',['Armour Bane (1)','Magical Attacks','Multiple Wounds (2)'],{conditionKo:'힘 +2와 Armour Bane은 이 턴에 돌격한 상대에게만.',conditionEn:'Strength +2 and Armour Bane apply only against enemies charged this turn.'}),
    'spelleater axe':weapon('S','-1',['Magical Attacks','Magic Resistance (-2)']),
    'hell-forged axe':weapon('S+1','-1',['Armour Bane (3)','Flaming Attacks','Magical Attacks']),
    'sword of sorrow':weapon('5','-1',['Armour Bane (2)','Magical Attacks','Multiple Wounds (2)'],{range:'30"',conditionKo:'이 원거리 무기로 공격할 때. 와드·재생 방어 불가.',conditionEn:'When shooting this weapon; no Ward or Regeneration saves.'}),
    'sword of swiftness':weapon('S','-',['Magical Attacks','Strike First']),
    "skirmisher's blade":weapon('S','-1',['Magical Attacks','Extra Attacks (+1)'],{extraModifiers:{A:1}}),
    "hunter's scorn":weapon('5','-1',['Armour Bane (1)','Magical Attacks','Multiple Shots (2)'],{range:'30"'}),
    'biting blade':weapon('S','-2',['Armour Bane (1)','Magical Attacks']),
    'sword of striking':weapon('S','-',['Magical Attacks'],{conditionKo:'이 무기 사용 시 명중 굴림 +1. WS 보너스가 아닙니다.',conditionEn:'+1 to To Hit rolls when using this weapon; does not increase WS.'}),
    "trailblazer's hatchet":weapon('S+1','-1',['Flaming Attacks','Magical Attacks','Move Through Cover']),
    "diestro's blade":weapon('S','-1',['Magical Attacks'],{extraModifiers:{I:1}}),
    'burning blade':weapon('S','-',['Flaming Attacks','Magical Attacks']),
    'sword of heroes':weapon('S','-',['Magical Attacks','Monster Slayer']),
    'heartwood lance':weapon('S+3','-3',['Magical Attacks'],{conditionKo:'돌격한 턴에만. 이후 한손 무기 사용.',conditionEn:'Only during a turn in which the wielder charged; otherwise use a hand weapon.'}),
    'morning star of fracasse':weapon('S+1','-1',['Magical Attacks']),
    "crusader's lance":weapon('S+2','-2',['Armour Bane (2)','Furious Charge','Hatred (all enemies)','Magical Attacks'],{conditionKo:'돌격한 턴에만. 이후 한손 무기 사용.',conditionEn:'Only during a turn in which the wielder charged; otherwise use a hand weapon.'}),
    'frontier axe':weapon('S+2','-3',['Magical Attacks','Multiple Wounds (2)','Requires Two Hands']),
    'sword of the stout hearted':weapon('S+2','-1',['Armour Bane (1)','Immune to Psychology','Magical Attacks','Requires Two Hands']),
    'foebreaker':weapon('S+1','-',['Magical Attacks'])
  };
  const permanent = {
    'rune of fortitude':{T:1},'rune of iron':{W:1},'rune of might':{S:1},'rune of fury':{A:1},'rune of striking':{WS:1},'giantbreaker':{S:1},'virtue of the ideal':{WS:1,I:1,A:1,Ld:1},'extra arm':{A:1},'muscular monstrosity':{S:1},'uncanny senses':{I:1},'curse of the revenant':{W:1},'mawseeker':{T:1},'longstrider':{M:1},"warrior's rune":{WS:1},'rune of wrath':{A:1},'rune of grit':{T:1},'blood of caledor':{WS:1},'daemonic platemail':{T:1,I:1}
  };
  const armour = {'light armour':'6+','heavy armour':'5+','full plate armour':'4+','armour of destiny':'5+','armour of silvered steel':'3+','master rune of gromril':'2+','daemonic platemail':'4+','padded hauberk':'5+'};

  function lookup(source, ruleInfo) {
    if(!source || typeof ruleInfo!=='function')return null;
    const name=nameOf(source), direct=ruleInfo(name);
    if(direct?.stats?.length)return direct;
    const candidates=[aliases[normal(name)], String(source.id||'').replace(/-/g,' ').replace(/renegades$/,'renegade')];
    for(const candidate of candidates.filter(Boolean)){const info=ruleInfo(candidate);if(info?.stats?.length)return info;}
    return null;
  }

  function displayRows(model) {
    const rows=[];
    for(const profile of model.profiles||[]){
      const applicable=(model.weapons||[]).filter(weapon=>weapon.profileIds?.includes(profile.id));
      const melee=weapon=>/^combat\b/i.test(String(weapon.range||'Combat'));
      const complete=weapon=>!weapon.sharedAllocation;
      const handWeapon=weapon=>(weaponAliases[normal(weapon.ruleName||weapon.name)]||normal(weapon.ruleName||weapon.name))==='hand weapon';
      const magicMelee=applicable.filter(weapon=>melee(weapon)&&complete(weapon)&&['weapon','weapon-runes'].includes(weapon.itemType));
      const primaryMelee=applicable.filter(weapon=>melee(weapon)&&complete(weapon)&&!handWeapon(weapon));
      const selected=applicable.filter(weapon=>{
        if(!melee(weapon)||!complete(weapon))return true;
        if(magicMelee.length)return magicMelee.includes(weapon);
        return !primaryMelee.length||!handWeapon(weapon);
      });
      // A selected melee weapon supplies the wielder's full stat line. Keep a
      // base row for mounts, missing weapons, shooting-only and partial units.
      if(!selected.some(weapon=>melee(weapon)&&complete(weapon)))rows.push({profile,extra:null});
      for(const weapon of selected)rows.push({profile,extra:weapon});
      for(const effect of model.effects||[]){
        if(effect.profileIds?.includes(profile.id)&&(Object.keys(effect.modifiers||{}).length||Object.keys(effect.fixed||{}).length))rows.push({profile,extra:effect});
      }
    }
    return rows;
  }

  function create({source,unit={},ruleInfo=()=>null,optionModel=window.BTHTOWOptions,composition='',weaponProfiles={}}={}) {
    const result={keys:[...keys],profiles:[],weapons:[],gear:[],effects:[],defences:[],notes:[],unresolved:[]};
    const hasManual=keys.some(key=>unit.manualStats?.[key]!==undefined&&!['','-'].includes(String(unit.manualStats[key]).trim()));
    const manualRow=()=>Object.fromEntries([['Name',unit.name||nameOf(source)||'User profile'],...keys.map(key=>[key,String(unit.manualStats?.[key]??'-')])]);
    if(!source){
      if(hasManual){const raw=manualRow(),base=Object.fromEntries(keys.map(key=>[key,raw[key]]));result.profiles.push({id:'profile-0',name:raw.Name,kind:'model',base,modifiers:{},effective:{...base},provenance:{name:'User profile',url:null,page:null}});result.notes.push({ko:'이 유닛의 기본 능력치는 사용자가 직접 입력한 값입니다.',en:'This unit uses base characteristics entered by the user.'});}
      else result.notes.push({ko:'직접 입력한 유닛에는 원본 능력치 자료가 없습니다.',en:'No source profile is available for this manually entered unit.'});
      return result;
    }
    const optionEntries=optionModel?.entries ? optionModel.entries(source,composition) : [];
    const selections=unit.selections || optionModel?.defaults?.(source,composition) || {};
    const active=value=>value===true || Number(value)>0;
    const byPath=new Map(optionEntries.map(entry=>[entry.path,entry]));
    const enabled=item=>{let current=item;while(current){if(!active(selections[current.path]))return false;current=current.parentKey?byPath.get(current.parentKey):null;}return true;};
    const selected=optionEntries.filter(enabled);
    const info=lookup(source,ruleInfo);
    const commandEntries=optionEntries.filter(item=>(item.field==='command'||item.field==='options'||item.path.startsWith('command:'))&&!item.path.startsWith('mounts:'));
    const modelName=value=>normal(value).replace(/ies$/,'y').replace(/s$/,'');
    const championFor = name => commandEntries.find(item=>{
      const entryName=normal(nameOf(item.entry)), rowName=normal(name);
      return !/^(general|standard bearer|battle standard bearer|musician)$/.test(entryName) && (modelName(entryName)===modelName(rowName) || (rowName==='champion' && /champion/i.test(nameOf(item.entry))));
    });
    const isMountRow=row=>['T','W'].every(key=>!/^\d+$/.test(String(row[key]))) && (valueOf(row.M)!==null || /steed|horse|mount|beast|wolf|spider|boar|cold one|dragon|gryph/i.test(row.Name||''));
    function addRows(stats,kind,provenance){
      for(const [index,row] of (stats||[]).entries()){
        const champion=kind==='model'&&index>0&&championFor(row.Name);
        if(champion&&!enabled(champion))continue;
        const rowKind=champion?'champion':kind==='mount'||isMountRow(row)?'mount':'model';
        if(result.profiles.some(profile=>normal(profile.name)===normal(row.Name)))continue;
        const base=Object.fromEntries(keys.map(key=>[key,String(row[key]??'-')]));
        const id=`profile-${result.profiles.length}`;
        result.profiles.push({id,name:row.Name||nameOf(source),kind:rowKind,base,modifiers:{},effective:{...base},...(champion?{count:champion.entry.stackable?Number(selections[champion.path])||1:1,selectionPath:champion.path}:{}),provenance:{name:provenance.name,url:provenance.url||null,page:provenance.page||null}});
      }
    }
    if(info)addRows(info.stats,'model',{...info,name:nameOf(source)});
    else if(hasManual){addRows([manualRow()],'model',{name:'User profile'});result.notes.push({ko:'이 유닛의 기본 능력치는 사용자가 직접 입력한 값입니다.',en:'This unit uses base characteristics entered by the user.'});}
    else result.notes.push({ko:'이 유닛의 원본 능력치가 현재 자료에 없습니다. 전체 유닛 규칙에서 확인하세요.',en:'This unit has no profile in the current source data. Check the full unit reference.'});
    const mainProfiles=()=>result.profiles.filter(profile=>profile.kind!=='mount');
    const bearerProfiles=item=>{
      const slot=Number(item?.slot),commandIndex=slot-(source.items?.length||0);
      if(Number.isInteger(slot)&&commandIndex>=0&&source.command?.[commandIndex]){
        const commandName=normal(nameOf(source.command[commandIndex]));
        return mainProfiles().filter(profile=>normal(profile.name)===commandName||(profile.kind==='champion'&&/champion/i.test(nameOf(source.command[commandIndex]))));
      }
      return mainProfiles();
    };
    function addModifier(profiles,key,value,from,kind='item',extra={}){
      for(const profile of profiles){if(valueOf(profile.base[key])===null)continue;(profile.modifiers[key] ||= []).push({value,source:from.name,url:from.url||null,kind,...extra});}
    }
    const mounts=selected.filter(item=>item.field==='mounts' && !item.parentKey && normal(nameOf(item.entry))!=='on foot');
    if(mounts.length>1)result.notes.push({ko:'탈것이 여러 개 선택되어 있어 추가 능력치를 합산하지 않았습니다.',en:'Multiple mounts are selected; their profile bonuses have not been combined.'});
    if(mounts.length===1){
      const mount=mounts[0],mountName=nameOf(mount.entry),mountInfo=lookup(mount.entry,ruleInfo);
      if(mountInfo){
        for(const row of mountInfo.stats)for(const key of ['T','W']){
          const match=String(row[key]||'').match(/^\(?\s*\+(\d+)\s*\)?$/);
          if(match)addModifier(mainProfiles(),key,Number(match[1]),{name:mountName,url:mountInfo.url},'mount');
        }
        addRows(mountInfo.stats,'mount',{...mountInfo,name:mountName});
      }else result.notes.push({ko:`${mountName}: 탈것 능력치가 현재 자료에 없습니다.`,en:`${mountName}: mount profile is unavailable in the current data.`});
    }
    const gearNames=new Set();
    for(const item of selected){
      const name=nameOf(item.entry);result.gear.push({name,kind:item.field,path:item.path,url:ruleInfo(name)?.url||null,count:item.entry.stackable?Number(selections[item.path])||1:1});
      for(const part of specialParts(name))gearNames.add(normal(part));
    }
    const rules=specialParts(source.specialRules?.name_en);
    const hasEnsorcelled=rules.some(rule=>normal(rule)==='ensorcelled weapons');
    const itemGroups=new Map();
    for(const item of unit.magicItems||[]){
      const name=nameOf(item),key=`${item.slot??''}:${item.group||''}:${normal(name)}`;
      if(itemGroups.has(key))itemGroups.get(key).count++;
      else itemGroups.set(key,{...item,name,count:1});
    }
    function scope(item){
      if(!item)return mainProfiles();
      if(item.path?.startsWith('mounts:'))return result.profiles.filter(profile=>profile.kind==='mount');
      if(item.path?.startsWith('command:')){
        const match=item.path.match(/^command:(\d+)/);return bearerProfiles({slot:(source.items?.length||0)+Number(match[1])});
      }
      return bearerProfiles(item);
    }
    function addWeapon(name,from,targets){
      // A chariot chassis can have printed Strength for impact hits while its
      // crew wield the selected weapons. Keep that chassis row, but never apply
      // a halberd, magic sword, etc. to a profile with no close-combat attacks.
      targets=targets.filter(profile=>['WS','A'].some(stat=>{
        const value=String(profile.base[stat]||'-');
        return (valueOf(value)!==null&&valueOf(value)>0)||/^(?:\d+)?D\d+(?:[+-]\d+)?$|^\*$/i.test(value);
      }));
      let key=normal(name);key=weaponAliases[key]||key;
      const appendWeapon=entry=>{
        if(from.itemType)entry.itemType=from.itemType;
        if(from.affectedCount){
          entry.affectedCount=from.affectedCount;entry.selectionPath=from.selectionPath;entry.sharedAllocation=true;
          entry.conditionKo=`유닛 전체에서 선택한 ${from.affectedCount} 모델에만 적용. ${entry.conditionKo||''}`;
          entry.conditionEn=`Only the ${from.affectedCount} selected models in the entire unit. ${entry.conditionEn||''}`;
        }
        result.weapons.push(entry);
      };
      const dynamic=weaponProfiles?.profiles||weaponProfiles||{};
      const sourceProfiles=dynamic[key]||dynamic[normal(name).replace(/\s*\{[^}]*\}/g,'').trim()];
      if(sourceProfiles?.length){
        for(const [index,sourceProfile] of sourceProfiles.entries()){
          const known=weapons[key],strength=String(sourceProfile.strength||'S'),rules=[...(sourceProfile.rules||[])];
          const modifiers={},fixed={};
          const strengthBonus=strength.match(/^S\s*\+\s*((?:\d+)?D\d+|\d+)$/i);
          if(strengthBonus)modifiers.S=/^\d+$/.test(strengthBonus[1])?Number(strengthBonus[1]):strengthBonus[1].toUpperCase();
          else if(/^\d+$/.test(strength))fixed.S=Number(strength);
          for(const rule of rules){const extra=String(rule).match(/^Extra Attacks\s*\(\s*\+?((?:\d+)?D\d+|\d+)\s*\)/i);if(extra)modifiers.A=/^\d+$/.test(extra[1])?Number(extra[1]):extra[1].toUpperCase();}
          for(const [stat,amount] of Object.entries(known?.extraModifiers||{}))if(modifiers[stat]===undefined)modifiers[stat]=amount;
          const cleanName=String(name).replace(/\*$/,'').trim(),printedName=String(sourceProfile.name||'');
          const variant=printedName.toLowerCase().startsWith(cleanName.toLowerCase())?printedName.slice(cleanName.length).trim():printedName;
          const profileIds=targets.map(profile=>profile.id),suffix=sourceProfiles.length>1?` · ${variant||index+1}`:'';
          if(result.weapons.some(entry=>entry.name===name+suffix&&entry.profileIds.join()===profileIds.join()))continue;
          const entry={name:name+suffix,ruleName:name,range:sourceProfile.range||'Combat',strength,armourPiercing:String(sourceProfile.armourPiercing??'-'),rules,modifiers,fixed,profileIds,url:sourceProfile.url||from.url||ruleInfo(name)?.url||null,notes:sourceProfile.notes||'',conditionKo:known?.conditionKo||sourceProfile.conditionKo||'이 무기로 공격할 때만. 추가 사용 조건은 아래 규칙 참조.',conditionEn:known?.conditionEn||sourceProfile.conditionEn||'Only when attacking with this weapon. See its additional conditions below.'};
          if(key==='hand weapon'&&hasEnsorcelled){entry.armourPiercing='-1';entry.rules=[...entry.rules,'Magical Attacks'];}
          appendWeapon(entry);
        }
        return true;
      }
      if(key==='sword of the quest'){
        for(const [variant,stats] of [['Single-Handed',weapon('S+1','-1',['Magical Attacks','Strike First'])],['Double-Handed',weapon('S+2','-2',['Magical Attacks','Multiple Wounds (2)','Requires Two Hands','Strike Last'])]]){
          const profileIds=targets.map(profile=>profile.id),strengthBonus=stats.strength.match(/^S\+(\d+)$/);
          appendWeapon({name:`Sword of the Quest · ${variant}`,ruleName:'Sword of the Quest',...stats,modifiers:strengthBonus?{S:Number(strengthBonus[1])}:{},fixed:{},profileIds,url:from.url||sourceUrl('sword of the quest'),conditionKo:'매 전투 라운드에 둘 중 하나 선택.',conditionEn:'Choose one alternative each combat round.'});
        }
        return true;
      }
      const known=weapons[key];if(!known)return false;
      const profileIds=targets.map(profile=>profile.id);
      if(!profileIds.length)return true;
      if(result.weapons.some(entry=>normal(entry.name)===key&&entry.profileIds.join()===profileIds.join()))return true;
      const url=from.url||ruleInfo(name)?.url||`${from.kind==='item'?'magic-item':'weapons-of-war'}/${key.replaceAll(' ','-')}`;
      const modifiers={...known.extraModifiers};const strengthBonus=known.strength.match(/^S\+(\d+)$/);
      if(strengthBonus)modifiers.S=Number(strengthBonus[1]);
      const fixed=/^\d+$/.test(known.strength)?{S:Number(known.strength)}:{};
      const entry={name:key,ruleName:name,...known,modifiers,fixed,profileIds,url,conditionKo:known.conditionKo||'이 무기로 공격할 때만.',conditionEn:known.conditionEn||'Only when attacking with this weapon.'};
      if(key==='hand weapon'&&hasEnsorcelled){entry.armourPiercing='-1';entry.rules=[...entry.rules,'Magical Attacks'];}
      appendWeapon(entry);return true;
    }
    for(const item of selected){
      if(item.field==='mounts'||item.field==='command')continue;
      for(const part of specialParts(nameOf(item.entry)))addWeapon(part,{kind:'equipment',...(item.entry.stackable?{affectedCount:Number(selections[item.path])||1,selectionPath:item.path}:{})},scope(item));
    }
    function addConditional(name,modifiers,targets,conditionKo,conditionEn,extra={}){
      result.effects.push({name,modifiers,profileIds:targets.map(profile=>profile.id),conditionKo,conditionEn,url:ruleInfo(name)?.url||sourceUrl(name),...extra});
    }
    function scopedRunicWeapons(targets){
      const affected=[];
      for(const original of result.weapons.filter(value=>(weaponAliases[normal(value.ruleName||value.name)]||normal(value.ruleName||value.name))==='hand weapon'&&value.profileIds.some(id=>targets.some(target=>target.id===id)))){
        let entry=original;
        const ids=entry.profileIds.filter(id=>targets.some(target=>target.id===id));
        if(ids.length!==entry.profileIds.length){entry={...original,profileIds:ids,rules:[...original.rules]};original.profileIds=original.profileIds.filter(id=>!ids.includes(id));result.weapons.push(entry);}
        entry.itemType='weapon-runes';
        affected.push(entry);
      }
      return affected;
    }
    for(const item of itemGroups.values()){
      const name=item.name,key=normal(name),targets=scope(item),url=ruleInfo(name)?.url||sourceUrl(name),from={name,url};
      result.gear.push({name,kind:'item',type:item.type,url,count:item.count,slot:item.slot});
      if(addWeapon(name,{kind:'item',itemType:item.type,url},targets))continue;
      if(item.type==='weapon-runes'||['rune of might','rune of fury','rune of striking','rune of speed','rune of cleaving'].includes(key)){
        for(const entry of scopedRunicWeapons(targets))entry.rules=[...new Set([...entry.rules,'Magical Attacks'])];
      }
      if(permanent[key]){
        for(const [stat,value] of Object.entries(permanent[key]))addModifier(targets,stat,value*item.count,from,'item',{cap:10});
      }else if(key==='master rune of adamant'){
        for(const profile of targets){const base=valueOf(profile.base.T);if(base!==null)addModifier([profile],'T',10-base,from,'replacement',{fixed:10,cap:10});}
      }else if(key==='unnatural fortitude'){
        const heavy=[...gearNames].some(name=>/^(heavy armour|full plate armour)/.test(name))||[...itemGroups.values()].some(value=>['armour of destiny'].includes(normal(value.name)));
        if(!heavy)addModifier(targets,'T',1,from,'item',{cap:10});
        else result.notes.push({ko:`${name}: 중갑 또는 판금 갑옷 때문에 강인함 보너스가 적용되지 않습니다.`,en:`${name}: no Toughness bonus while wearing heavy or full plate armour.`});
      }else if(key==='rune of speed'){
        addConditional(name,{I:item.count},targets,'이 룬을 새긴 한손 무기를 사용할 때만.','Only when wielding the hand weapon bearing this rune.');
      }else if(key==='enhanced reflexes'){
        addConditional(name,{I:2},targets,'근접전에서 마법이 아닌 한손 무기 또는 마법이 깃든 한손 무기(Ensorcelled Weapons) 하나를 사용할 때만.','Only in combat using a single non-magical or Ensorcelled hand weapon.');
      }else if(key==='errantry banner'){
        addConditional(name,{S:1},result.profiles,'이 턴에 돌격한 유닛의 모든 모델.','All models in the unit, only during a turn in which it charged.');
      }else if(key==='daemon-forged barding'){
        addConditional(name,{A:1},result.profiles.filter(profile=>profile.kind==='mount'),'돌격한 턴에 사용자 유닛의 탈것만.','Only the mounts in the bearer\'s unit during a turn in which it charged.');
      }else if(key==='virtue of knightly temper'){
        addConditional(name,{A:'D3'},targets,'돌격한 턴에만. 증오도 적용.','Only during a turn in which the character charged; also gains Hatred.');
      }else if(key==='pendant of damnation'){
        addConditional(name,{A:'lost W'},targets,'잃은 상처마다 공격 횟수 +1. 상처가 가득 차 있으면 보너스 없음.','+1 Attack per lost Wound; no bonus at full Wounds.');
      }else if(key==='many-limbed fiend'){
        addConditional(name,{A:1},targets,'추가 공격 1회는 일반 한손 무기로 해야 합니다. 다른 무기 보너스를 적용하지 않습니다.','One additional attack made with an ordinary hand weapon; other weapon bonuses do not apply.');
      }else if(key.startsWith('potion of ')&&['strength','toughness','speed'].includes(key.slice(10))){
        const stat={strength:'S',toughness:'T',speed:'I'}[key.slice(10)];
        addConditional(name,{[stat]:'D3'},targets,'한 번 사용. 지휘 하위 단계에 마신 뒤 그 턴 끝까지, 최대 10.','Single use. After drinking in the Command sub-phase, until end of turn; maximum 10.',{cap:10});
      }else if(key==='rune of cleaving'){
        for(const entry of scopedRunicWeapons(targets)){
          const base=entry.armourPiercing==='-'?0:Number(entry.armourPiercing);
          if(Number.isFinite(base)){entry.armourPiercing=String(base-item.count);entry.rules=[...new Set([...entry.rules,'Magical Attacks'])];}
        }
      }else if(!armour[key]&&!['talisman of protection','rune of stone'].includes(key))result.unresolved.push(name);
      if(armour[key])result.defences.push({name,kind:'armour',value:armour[key],url,profileIds:targets.map(profile=>profile.id),conditionKo:['armour of silvered steel','master rune of gromril'].includes(key)?'다른 효과로 개선할 수 없음.':'',conditionEn:['armour of silvered steel','master rune of gromril'].includes(key)?'Cannot be improved.':''});
      if(key==='armour of destiny'||key==='talisman of protection')result.defences.push({name,kind:'ward',value:key==='armour of destiny'?'4+':'5+',url,profileIds:targets.map(profile=>profile.id)});
      if(key==='rune of stone')result.defences.push({name,kind:'armour-modifier',value:'+1',url,profileIds:targets.map(profile=>profile.id),conditionKo:'갑옷 수치 1 개선. 동일 갑옷의 중복 룬은 추가 효과 없음.',conditionEn:'Improves armour value by 1. Duplicate runes on the same armour add no further benefit.'});
      if(key==='padded hauberk')result.defences.push({name,kind:'armour-modifier',value:'+1',url,profileIds:targets.map(profile=>profile.id),conditionKo:'AP가 -인 공격에 대해서만 갑옷 수치 1 개선.',conditionEn:'Improves armour value by 1 only against attacks with AP -.'});
    }
    for(const item of selected){
      const targets=scope(item),ids=targets.map(profile=>profile.id);
      for(const part of specialParts(nameOf(item.entry))){const key=normal(part),url=ruleInfo(part)?.url||null;
        const armourName=Object.keys(armour).find(name=>key===name||key.startsWith(name+' '));
        if(armourName)result.defences.push({name:part,kind:'armour',value:armour[armourName],url,profileIds:ids});
        if(/^shields?$/.test(key))result.defences.push({name:part,kind:'armour-modifier',value:'+1',url,profileIds:ids,conditionKo:'방패를 사용할 수 있을 때 갑옷 수치 1 개선.',conditionEn:'Improves armour value by 1 when the shield can be used.'});
      }
    }
    for(const rule of rules){
      const match=rule.match(/(Ward Save|Regeneration|Chaos Armour[^()]*)\s*\((\d+)\+\)/i);
      if(match)result.defences.push({name:rule,kind:/regeneration/i.test(match[1])?'regeneration':'ward',value:match[2]+'+',url:ruleInfo(rule)?.url||null,profileIds:mainProfiles().map(profile=>profile.id)});
      const fly=rule.match(/^Fly\s*\((\d+)\)/i);
      if(fly)result.effects.push({name:rule,modifiers:{},fixed:{M:Number(fly[1])},profileIds:mainProfiles().map(profile=>profile.id),conditionKo:'비행 이동 시 사용하는 이동력. 지상 이동력에 합산하지 않습니다.',conditionEn:'Movement when flying. Does not add to ground Movement.',url:ruleInfo(rule)?.url||null});
    }
    const optionRules=[...rules,...selected.map(item=>nameOf(item.entry))];
    if(optionRules.some(rule=>normal(rule)==='mark of slaanesh'))addConditional('Mark of Slaanesh',{I:1},mainProfiles(),'전투 첫 라운드에만.','Only during the first round of combat.',{url:ruleInfo('Mark of Slaanesh')?.url||'special-rules/mark-of-slaanesh'});
    if(optionRules.some(rule=>['frenzy','mark of khorne'].includes(normal(rule))))addConditional('Frenzy',{A:1},mainProfiles(),'돌격한 턴 또는 추격 이동(follow up)을 한 다음 턴. 전투 라운드에서 패배하면 상실.','Only on the turn it charged or the turn after a follow up move. Lost after losing a round of combat.',{url:ruleInfo('Frenzy')?.url||'special-rules/frenzy'});
    for(const profile of result.profiles)for(const key of keys){
      const base=valueOf(profile.base[key]),mods=profile.modifiers[key]||[];
      if(base===null||!mods.length)continue;
      const fixed=mods.findLast(mod=>mod.fixed!==undefined);
      const amount=fixed?fixed.fixed:base+mods.reduce((sum,mod)=>sum+mod.value,0);
      const cap=mods.some(mod=>mod.cap)?10:Infinity;
      profile.effective[key]=Math.min(cap,amount);
    }
    if(result.unresolved.length)result.notes.push({ko:'일부 아이템의 조건부 효과는 자동 합산하지 않습니다. 아래 아이템 이름을 눌러 규칙을 확인하세요.',en:'Some item effects are not calculated automatically. Tap their names below to check their conditions.'});
    return result;
  }
  return Object.freeze({keys,create,lookup,displayRows});
})();
