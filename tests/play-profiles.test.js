const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

global.window={};
require('../dist/option-core.js');
require('../dist/play-profiles.js');
const OPT=window.BTHTOWOptions;
const PLAY=window.TOWPlayProfiles;
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/',name),'utf8'));
const index=read('data/src/components/rules-index/rules-index-export.json');
const aliases=read('data/src/components/rules-index/rule-aliases.json');
const ruleKey=value=>String(value).toLowerCase().replace(/\s*\([^)]*\)/g,'').replace(/[{}\[\]*]/g,'').replace(/^[0-9]x /,'').replace(/[“”]/g,'"').trim();
function ruleInfo(name){for(const candidate of [ruleKey(name),ruleKey(name).replace(/ renegade$/,'')]){const alias=aliases.synonyms[candidate];const found=index[candidate]||aliases.additional[candidate]||(alias&&(index[alias]||aliases.additional[alias]));if(found)return found;}return null;}
function unit(faction,id){const data=read(`data/games/the-old-world/${faction}.json`);return Object.values(data).flat().find(value=>value.id===id);}
function build(source,extra={}){return PLAY.create({source,unit:{selections:OPT.defaults(source,''),...extra},ruleInfo,optionModel:OPT});}
const chaosLord=unit('warriors-of-chaos','chaos-lord');

test('Great weapon adds conditional Strength next to original and cannot stack with halberd',()=>{
  const result=build(chaosLord,{selections:{'equipment:0':true,'equipment:3':true,'equipment:4':true}});
  assert.equal(result.profiles[0].base.S,'5');
  assert.equal(result.profiles[0].effective.S,'5');
  assert.equal(result.profiles[0].modifiers.S,undefined);
  assert.equal(result.weapons.find(value=>value.name==='great weapon').modifiers.S,2);
  assert.equal(result.weapons.find(value=>value.name==='halberd').modifiers.S,1);
  assert(result.weapons.find(value=>value.name==='great weapon').rules.includes('Strike Last'));
});

test('selected dragon adds explicit mount Toughness and Wounds without granting rider weapon bonuses to dragon',()=>{
  const mountIndex=chaosLord.mounts.findIndex(value=>value.name_en==='Chaos Dragon');
  const result=build(chaosLord,{selections:{'equipment:3':true,[`mounts:${mountIndex}`]:true}});
  const rider=result.profiles.find(profile=>profile.kind==='model');
  const dragon=result.profiles.find(profile=>profile.kind==='mount');
  assert.equal(rider.base.T,'5');assert.equal(rider.modifiers.T[0].value,1);assert.equal(rider.effective.T,6);
  assert.equal(rider.base.W,'4');assert.equal(rider.modifiers.W[0].value,6);assert.equal(rider.effective.W,10);
  assert.equal(dragon.base.S,'7');
  assert(!result.weapons.find(value=>value.name==='great weapon').profileIds.includes(dragon.id));
});

test('all cavalry profile rows are present and champion row requires the selected champion',()=>{
  const source=unit('empire-of-man','empire-knights');
  const regular=build(source,{selections:{'equipment:0':true}});
  assert.deepEqual(regular.profiles.map(value=>value.name),['Empire Knight','Barded Warhorse']);
  const upgraded=build(source,{selections:{'equipment:0':true,'command:0':true}});
  assert.deepEqual(upgraded.profiles.map(value=>value.name),['Empire Knight','Preceptor','Barded Warhorse']);
  assert.equal(upgraded.profiles[1].kind,'champion');
  assert.equal(upgraded.profiles[2].kind,'mount');
});

test('character mounts include each chariot and crew row',()=>{
  const mountIndex=chaosLord.mounts.findIndex(value=>value.name_en==='Chaos Chariot');
  const result=build(chaosLord,{selections:{[`mounts:${mountIndex}`]:true}});
  assert.deepEqual(result.profiles.map(value=>value.name),['Chaos Lord','Chariot','Chaos Charioteer (x2)','Chaos Steed (x2)']);
  assert.equal(result.profiles[0].modifiers.W,undefined,'ordinary chariot W is not an explicit rider bonus');
});

test('stackable Rune of Fortitude applies each verified bonus and keeps its provenance',()=>{
  const source=unit('dwarfen-mountain-holds','king');
  assert(source);
  const result=build(source,{magicItems:[{name:'Rune of Fortitude*',type:'armor-runes',slot:0},{name:'Rune of Fortitude*',type:'armor-runes',slot:0},{name:'Rune of Iron',type:'armor-runes',slot:0}]});
  const king=result.profiles[0];
  assert.equal(king.modifiers.T[0].value,2);
  assert.equal(king.effective.T,Number(king.base.T)+2);
  assert.equal(king.modifiers.W[0].value,1);
  assert.equal(king.modifiers.T[0].url,'magic-item/rune-of-fortitude');
});

test('a champion magic weapon affects the selected champion instead of every member of the regiment',()=>{
  const source=unit('empire-of-man','empire-knights');
  const slot=source.items.length;
  const result=build(source,{selections:{'command:0':true},magicItems:[{name:'Sword of Might*',type:'weapon',slot}]});
  const weapon=result.weapons.find(value=>value.name==='sword of might');
  assert.deepEqual(weapon.profileIds,[result.profiles.find(value=>value.name==='Preceptor').id]);
});

test('potions stay inactive with symbolic dice and do not add to the printed stat',()=>{
  const result=build(chaosLord,{magicItems:[{name:'Potion of Strength*',type:'enchanted-item',slot:0}]});
  assert.equal(result.profiles[0].modifiers.S,undefined);
  assert.equal(result.effects[0].modifiers.S,'D3');
  assert.match(result.effects[0].conditionEn,/Single use/);
});

test('nested choices require every ancestor to be selected',()=>{
  const source={name_en:'Chaos Lord',options:[{name_en:'Parent',options:[{name_en:'Disabled',options:[{name_en:'Great weapon'}]}]}]};
  const result=build(source,{selections:{'options:0':true,'options:0/options:0/options:0':true}});
  assert(!result.weapons.some(value=>value.name==='great weapon'));
});

test('unsupported rules remain visible and no guessed stat bonus is introduced',()=>{
  const result=build(chaosLord,{magicItems:[{name:'Mystery blessing',type:'enchanted-item',slot:0}]});
  assert(result.gear.some(value=>value.name==='Mystery blessing'));
  assert(result.unresolved.includes('Mystery blessing'));
  assert.deepEqual(result.profiles[0].modifiers,{});
});

test('Ward and armour data is separate and shield is not added as a permanent Toughness bonus',()=>{
  const result=build(chaosLord,{selections:{'armor:0':true,'options:0':true},magicItems:[{name:'Talisman of Protection',type:'talisman',slot:0}]});
  assert(result.defences.some(value=>value.kind==='armour'&&value.value==='4+'));
  assert(result.defences.some(value=>value.name==='Shield'&&value.kind==='armour-modifier'));
  assert(result.defences.some(value=>value.kind==='ward'&&value.value==='5+'));
  assert.equal(result.profiles[0].modifiers.T,undefined);
});

test('create is pure and never changes the source unit or roster selections',()=>{
  const source=structuredClone(chaosLord),entry={selections:{'equipment:3':true},magicItems:[{name:'Rune of Fortitude*',slot:0}]};
  const before=JSON.stringify({source,entry});
  build(source,entry);
  assert.equal(JSON.stringify({source,entry}),before);
});

test('dynamic sourced weapon variants retain fixed Strength and symbolic extra attacks',()=>{
  const result=PLAY.create({source:chaosLord,unit:{selections:{},magicItems:[{name:'Test Weapon',type:'weapon',slot:0}]},ruleInfo,optionModel:OPT,weaponProfiles:{profiles:{'test weapon':[
    {name:'Close combat',range:'Combat',strength:'S+3',armourPiercing:'-2',rules:['Extra Attacks (+D3)'],url:'magic-item/test-weapon'},
    {name:'Missile',range:'18"',strength:'6',armourPiercing:'-1',rules:[],url:'magic-item/test-weapon'}
  ]}}});
  assert.equal(result.weapons.length,2);
  assert.deepEqual(result.weapons[0].modifiers,{S:3,A:'D3'});
  assert.deepEqual(result.weapons[1].fixed,{S:6});
  assert.deepEqual(result.profiles[0].modifiers,{});
});

test('Virtue of the Ideal improves only rider stats while preserving mount stats',()=>{
  const source=unit('kingdom-of-bretonnia','duke'),mount=source.mounts.findIndex(value=>value.name_en==='Royal Pegasus');
  assert(mount>=0);
  const result=build(source,{selections:{[`mounts:${mount}`]:true},magicItems:[{name:'Virtue of the Ideal',type:'knightly-virtue',slot:1}]});
  const rider=result.profiles.find(value=>value.kind==='model'),pegasus=result.profiles.find(value=>value.kind==='mount');
  for(const key of ['WS','I','A','Ld'])assert.equal(rider.modifiers[key][0].value,1);
  assert.deepEqual(pegasus.modifiers,{});
});

test('catalogue profile audit covers source names and aliases without inventing missing renegade profiles',()=>{
  const folder=path.join(__dirname,'../dist/data/games/the-old-world');
  const missing=[];let count=0;
  for(const file of fs.readdirSync(folder).filter(name=>name.endsWith('.json')&&name!=='magic-items.json')){
    const data=JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
    for(const source of Object.values(data).flat().filter(value=>value&&typeof value==='object'&&value.id)){
      count++;const result=build(source);if(!result.profiles.length)missing.push(source.id);
      for(const profile of result.profiles)assert.equal(Object.keys(profile.base).length,9);
    }
  }
  assert.equal(count,751);
  assert.deepEqual(missing.sort(),['skaven-dregs-renegade','skink-cohort-renegade','vampire-lord-renegade','skeleton-warriors-renegade','soul-grinder-khorne-renegade'].sort());
});

test('before optional weapon data arrives null still produces curated weapon profiles',()=>{
  const result=PLAY.create({source:chaosLord,unit:{selections:{'equipment:3':true}},ruleInfo,optionModel:OPT,weaponProfiles:null});
  assert(result.weapons.some(value=>value.name==='great weapon'));
});

test('a champion weapon rune does not improve the regiment hand weapons',()=>{
  const source=unit('empire-of-man','empire-knights');
  const result=build(source,{selections:{'command:0':true,'equipment:0':true},magicItems:[{name:'Rune of Cleaving*',type:'weapon-runes',slot:source.items.length}]});
  const champion=result.profiles.find(value=>value.name==='Preceptor'),regular=result.profiles.find(value=>value.name==='Empire Knight');
  assert.equal(result.weapons.find(value=>value.profileIds.includes(champion.id)&&value.name==='hand weapon').armourPiercing,'-1');
  assert.equal(result.weapons.find(value=>value.profileIds.includes(regular.id)&&value.name==='hand weapon').armourPiercing,'-');
});

test('missing and manually entered source units accept an explicitly entered base profile',()=>{
  const manualStats={M:'4',WS:'6',BS:'3',S:'5',T:'5',W:'3',I:'6',A:'4',Ld:'9'};
  const missing=unit('vampire-counts','vampire-lord-renegade');
  const result=build(missing,{name:'My Vampire Lord',manualStats});
  assert.equal(result.profiles[0].base.S,'5');
  assert.equal(result.profiles[0].provenance.name,'User profile');
  assert(result.notes.some(note=>note.en.includes('entered by the user')));
  const manual=PLAY.create({unit:{name:'Custom model',manualStats},ruleInfo,optionModel:OPT});
  assert.equal(manual.profiles[0].name,'Custom model');
  assert.deepEqual(manual.profiles[0].base,manualStats);
  assert.equal(build(chaosLord,{manualStats}).profiles[0].base.W,'4','manual fallback must not replace an indexed source profile');
});

test('live sourced weapon dataset preserves special rules, conditional profiles and Ensorcelled hand weapons',()=>{
  const weaponProfiles=read('data/play-weapon-profiles.json');
  const result=PLAY.create({source:chaosLord,unit:{selections:{'equipment:0':true,'equipment:3':true},magicItems:[{name:'Sword of Battle',type:'weapon',slot:0}]},ruleInfo,optionModel:OPT,weaponProfiles});
  const hand=result.weapons.find(value=>value.ruleName==='Hand weapon'),great=result.weapons.find(value=>value.ruleName==='Great weapon'),sword=result.weapons.find(value=>value.ruleName==='Sword of Battle');
  assert.equal(hand.armourPiercing,'-1');assert(hand.rules.includes('Magical Attacks'));
  assert(great.rules.includes('Strike Last'));assert.equal(great.modifiers.S,2);
  assert.deepEqual(sword.modifiers,{S:1,A:1});
  assert.deepEqual(result.profiles[0].modifiers,{});
});

test('standalone Chaos Chariot applies crew halberds only to its attacking crew and preserves the chassis Strength',()=>{
  const source=unit('warriors-of-chaos','chaos-chariot');
  for(const weaponProfiles of [null,read('data/play-weapon-profiles.json')]){
    const result=PLAY.create({source,unit:{selections:OPT.defaults(source,'')},ruleInfo,optionModel:OPT,weaponProfiles});
    const chassis=result.profiles.find(value=>value.name==='Chariot'),crew=result.profiles.find(value=>value.name==='Chaos Charioteer (x2)'),steeds=result.profiles.find(value=>value.name==='Chaos Steed (x2)');
    assert(chassis&&crew&&steeds,'all original chariot, crew and steed profiles remain visible');
    const halberd=result.weapons.find(value=>normalName(value.ruleName)==='halberds');
    assert.deepEqual(halberd.profileIds,[crew.id]);
    assert.equal(halberd.modifiers.S,1);
    assert.equal(chassis.base.S,'5');assert.deepEqual(chassis.modifiers,{});
    assert(!result.weapons.some(value=>value.profileIds.includes(chassis.id)));
  }
});

function normalName(value){return String(value).toLowerCase();}

test('Giant Slayer profile requires purchasing its stackable model upgrade and records its count',()=>{
  const source=unit('dwarfen-mountain-holds','slayers');
  const defaults=build(source,{count:10,selections:OPT.defaults(source,'')});
  assert.deepEqual(defaults.profiles.map(value=>value.name),['Troll Slayer']);
  const selected=build(source,{count:10,selections:{...OPT.defaults(source,''),'options:0':2}});
  assert.deepEqual(selected.profiles.map(value=>value.name),['Troll Slayer','Giant Slayer']);
  assert.equal(selected.profiles[1].count,2);
  assert.equal(selected.profiles[1].selectionPath,'options:0');
});

test('a counted Slayer weapon purchase is labelled as a shared count rather than a whole-unit weapon bonus',()=>{
  const source=unit('dwarfen-mountain-holds','slayers');
  for(const weaponProfiles of [null,read('data/play-weapon-profiles.json')]){
    const result=PLAY.create({source,unit:{count:10,selections:{...OPT.defaults(source,''),'options:0':2,'options:2':1}},ruleInfo,optionModel:OPT,weaponProfiles});
    const great=result.weapons.find(value=>normalName(value.ruleName)==='great weapons');
    assert.equal(great.affectedCount,1);assert.equal(great.sharedAllocation,true);
    assert.equal(great.selectionPath,'options:2');
    assert.match(great.conditionEn,/Only the 1 selected models in the entire unit/);
    assert.match(great.conditionKo,/유닛 전체에서 선택한 1 모델/);
    for(const profile of result.profiles)assert.equal(profile.modifiers.S,undefined);
  }
});

test('weapon stat runes make only their bearer hand weapon magical',()=>{
  const king=unit('dwarfen-mountain-holds','king');
  for(const name of ['Rune of Might*','Rune of Fury*','Rune of Striking*']){
    const result=build(king,{magicItems:[{name,type:'weapon-runes',slot:0}]});
    assert(result.weapons.find(value=>normalName(value.ruleName)==='hand weapon').rules.includes('Magical Attacks'));
  }
  const source=unit('empire-of-man','empire-knights');
  const result=build(source,{selections:{'command:0':true,'equipment:0':true},magicItems:[{name:'Rune of Might*',type:'weapon-runes',slot:source.items.length}]});
  const champion=result.profiles.find(value=>value.name==='Preceptor'),regular=result.profiles.find(value=>value.name==='Empire Knight');
  assert(result.weapons.find(value=>value.profileIds.includes(champion.id)&&value.name==='hand weapon').rules.includes('Magical Attacks'));
  assert(!result.weapons.find(value=>value.profileIds.includes(regular.id)&&value.name==='hand weapon').rules.includes('Magical Attacks'));
});
