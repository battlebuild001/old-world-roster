const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

global.window={};
require('../dist/option-core.js');
require('../dist/play-profiles.js');
const OPT=window.BTHTOWOptions,PLAY=window.TOWPlayProfiles;
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dist',name),'utf8'));
const index=read('data/src/components/rules-index/rules-index-export.json');
const aliases=read('data/src/components/rules-index/rule-aliases.json');
const key=value=>String(value).toLowerCase().replace(/\s*\([^)]*\)/g,'').replace(/[{}\[\]*]/g,'').trim();
function ruleInfo(name){
  for(const candidate of [key(name),key(name).replace(/ renegade$/,'')]){
    const alias=aliases.synonyms[candidate],found=index[candidate]||aliases.additional[candidate]||(alias&&(index[alias]||aliases.additional[alias]));
    if(found)return found;
  }
  return null;
}
function unit(faction,id){return Object.values(read(`data/games/the-old-world/${faction}.json`)).flat().find(value=>value.id===id);}
function build(source,extra={},weaponProfiles=null){return PLAY.create({source,unit:{selections:OPT.defaults(source,''),...extra},ruleInfo,optionModel:OPT,weaponProfiles});}
function display(model){
  const before=structuredClone(model),rows=PLAY.displayRows(model);
  assert.deepEqual(model,before,'display projection must preserve source profiles, base stats and calculated effects');
  return rows;
}
const weaponName=row=>row.extra?key(row.extra.ruleName||row.extra.name):'';
const isHand=row=>/^hand weapons?$/.test(weaponName(row));

test('selected Chaos Knight lances replace duplicate base rows and preserve champion and steed',()=>{
  const source=unit('warriors-of-chaos','chaos-knights');
  for(const weaponProfiles of [null,read('data/play-weapon-profiles.json')])for(const champion of [false,true]){
    const model=build(source,{count:6,selections:{'equipment:1':true,...(champion?{'command:0':true}:{})}},weaponProfiles);
    const rows=display(model);
    assert.equal(rows.length,champion?3:2);
    assert.deepEqual(rows.map(row=>row.profile.name),champion?['Chaos Knight','Champion','Chaos Steed']:['Chaos Knight','Chaos Steed']);
    for(const row of rows.filter(row=>row.profile.kind!=='mount')){
      assert.match(weaponName(row),/^lances?$/);
      assert.equal(row.extra.modifiers.S,2);
      assert.equal(row.profile.base.S,'4');
      assert.equal(row.profile.effective.S,'4','charge-only lance bonus is not permanent Strength');
      assert.match(row.extra.conditionEn,/charged/);
    }
    assert.equal(rows.at(-1).extra,null);
    assert.equal(rows.at(-1).profile.base.S,'4');
  }
});

test('Empire Knights carrying hand weapons and lances display the selected primary weapon once',()=>{
  const model=build(unit('empire-of-man','empire-knights'),{selections:{'equipment:0':true,'command:0':true}});
  const rows=display(model);
  assert.equal(rows.length,3);
  assert.equal(rows.filter(row=>/^lances?$/.test(weaponName(row))).length,2);
  assert.equal(rows.filter(isHand).length,0);
  assert.equal(rows.filter(row=>row.extra===null).length,1,'the mount keeps its own base profile');
});

test('a champion magic weapon with no stat bonus replaces only that champion lance',()=>{
  const source=unit('warriors-of-chaos','chaos-knights');
  const model=build(source,{selections:{'equipment:1':true,'command:0':true},magicItems:[{name:'Sword of Swiftness',type:'weapon',slot:source.items.length}]});
  const rows=display(model),regular=rows.find(row=>row.profile.name==='Chaos Knight'),champion=rows.find(row=>row.profile.name==='Champion');
  assert.equal(rows.length,3);
  assert.match(weaponName(regular),/^lances?$/);
  assert.equal(weaponName(champion),'sword of swiftness');
  assert.deepEqual(champion.extra.modifiers,{});
  assert(champion.extra.rules.includes('Strike First'));
  assert.equal(rows.find(row=>row.profile.kind==='mount').extra,null);
});

test('a champion runic hand weapon does not replace the regiment lances or affect its mount',()=>{
  const source=unit('empire-of-man','empire-knights');
  const model=build(source,{selections:{'equipment:0':true,'command:0':true},magicItems:[{name:'Rune of Might*',type:'weapon-runes',slot:source.items.length}]});
  const rows=display(model),champion=rows.find(row=>row.profile.kind==='champion');
  assert.equal(rows.length,3);
  assert.match(weaponName(rows.find(row=>row.profile.name==='Empire Knight')),/^lances?$/);
  assert(isHand(champion));
  assert(champion.extra.rules.includes('Magical Attacks'));
  assert.equal(champion.extra.itemType,'weapon-runes');
  assert.equal(rows.find(row=>row.profile.kind==='mount').extra,null);
});

test('chariot crew use their selected halberds while chassis and steeds keep base rows',()=>{
  const rows=display(build(unit('warriors-of-chaos','chaos-chariot')));
  assert.equal(rows.length,3);
  const chassis=rows.find(row=>row.profile.name==='Chariot'),crew=rows.find(row=>row.profile.name==='Chaos Charioteer (x2)'),steeds=rows.find(row=>row.profile.name==='Chaos Steed (x2)');
  assert.equal(chassis.extra,null);assert.equal(chassis.profile.base.S,'5');
  assert.match(weaponName(crew),/^halberds?$/);assert.equal(crew.extra.modifiers.S,1);
  assert.equal(steeds.extra,null);
});

test('a weapon bought for one Slayer preserves the unassigned models and shared upgrade count',()=>{
  const source=unit('dwarfen-mountain-holds','slayers');
  const model=build(source,{count:10,selections:{...OPT.defaults(source,''),'options:0':2,'options:2':1}});
  for(const includeHand of [true,false]){
    const fixture=structuredClone(model);
    if(!includeHand)fixture.weapons=fixture.weapons.filter(weapon=>!/^hand weapons?$/.test(key(weapon.ruleName||weapon.name)));
    const rows=display(fixture);
    assert.equal(rows.length,4);
    for(const profile of fixture.profiles){
      const own=rows.filter(row=>row.profile.id===profile.id);
      assert(own.some(row=>includeHand?isHand(row):row.extra===null));
      const upgrade=own.find(row=>/^great weapons?$/.test(weaponName(row)));
      assert.equal(upgrade.extra.affectedCount,1);
      assert.equal(upgrade.extra.sharedAllocation,true);
      assert.match(upgrade.extra.conditionEn,/1 selected models in the entire unit/);
    }
  }
});

test('ranged profiles and conditional effects retain the selected combat or unarmed reference',()=>{
  const source=structuredClone(unit('kingdom-of-bretonnia','duke'));
  source.equipment=[{name_en:'Hand weapon',active:true},{name_en:'Training bow',active:true}];
  const model=build(source,{magicItems:[{name:'Potion of Strength',type:'enchanted-item',slot:0}]},{profiles:{'training bow':[{name:'Training bow',range:'24"',strength:'4',armourPiercing:'-1',rules:[]}]}});
  for(const includeHand of [true,false]){
    const fixture=structuredClone(model);
    if(!includeHand)fixture.weapons=fixture.weapons.filter(weapon=>!/^hand weapons?$/.test(key(weapon.ruleName||weapon.name)));
    const rows=display(fixture);
    assert.equal(rows.length,3);
    assert(rows.some(row=>includeHand?isHand(row):row.extra===null));
    const bow=rows.find(row=>weaponName(row)==='training bow'),potion=rows.find(row=>weaponName(row)==='potion of strength');
    assert.equal(bow.extra.fixed.S,4);
    assert.equal(potion.extra.modifiers.S,'D3');
    assert.equal(model.profiles[0].base.S,'5');
    assert.equal(model.profiles[0].effective.S,'5');
  }
});

test('both sourced fighting modes of one selected magic weapon remain available',()=>{
  const source=unit('kingdom-of-bretonnia','duke');
  const model=build(source,{magicItems:[{name:'Training blade',type:'weapon',slot:0}]},{profiles:{'training blade':[
    {name:'Training blade · Light',range:'Combat',strength:'S+1',armourPiercing:'-1',rules:[]},
    {name:'Training blade · Heavy',range:'Combat',strength:'S+3',armourPiercing:'-3',rules:['Requires Two Hands']}
  ]}});
  const rows=display(model);
  assert.equal(rows.length,2);
  assert(rows.every(row=>weaponName(row)==='training blade'));
  assert.deepEqual(rows.map(row=>row.extra.modifiers.S),[1,3]);
  assert(rows.some(row=>row.extra.name.includes('Light')));
  assert(rows.some(row=>row.extra.name.includes('Heavy')));
});
