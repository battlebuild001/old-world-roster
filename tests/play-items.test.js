'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

global.window={};
require('../dist/option-core.js');
require('../dist/play-profiles.js');
const OPT=window.BTHTOWOptions,PLAY=window.TOWPlayProfiles;
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/',name),'utf8'));
const chaos=read('data/games/the-old-world/warriors-of-chaos.json');
const lord=chaos.characters.find(unit=>unit.id==='chaos-lord');
const knights=read('data/games/the-old-world/empire-of-man.json').core.find(unit=>unit.id==='empire-knights');
const index=read('data/src/components/rules-index/rules-index-export.json');
const aliases=read('data/src/components/rules-index/rule-aliases.json');
const key=name=>String(name).toLowerCase().replace(/\s*\([^)]*\)/g,'').replace(/[{}\[\]*]/g,'').trim();
function ruleInfo(name){const normalized=key(name),alias=aliases.synonyms[normalized];return index[normalized]||aliases.additional[normalized]||(alias&&(index[alias]||aliases.additional[alias]))||null;}
const item=(name,type,extra={})=>({group:'warriors-of-chaos',name,type,points:5,slot:0,...extra});
function screenshotItems(){return [
 item('Favour of the Gods*','enchanted-item'),
 item('Favour of the Gods*','enchanted-item'),
 item('Brazen Collar*','talisman',{points:20})
];}

test('the reported Chaos Lord items retain their original names, repeated quantity and rule destinations',()=>{
 const unit={magicItems:screenshotItems()};
 const rows=PLAY.selectedItems(unit,lord,ruleInfo);
 assert.equal(rows.length,2);
 const favour=rows.find(row=>row.name==='Favour of the Gods*'),collar=rows.find(row=>row.name==='Brazen Collar*');
 assert.equal(favour.count,2);assert.equal(favour.type,'enchanted-item');assert.equal(favour.slot,0);assert.equal(favour.group,'warriors-of-chaos');
 assert.equal(favour.url,'magic-item/favour-of-the-gods');
 assert.equal(collar.count,1);assert.equal(collar.type,'talisman');assert.equal(collar.url,'magic-item/brazen-collar');
});

test('selected items keep separate bearers, pools and item types instead of merging them by name',()=>{
 const championSlot=knights.items.length;
 const standardSlot=championSlot+1;
 const unit={magicItems:[
  item('Rune of Might*','weapon-runes',{group:'general',slot:0}),
  item('Rune of Might*','weapon-runes',{group:'general',slot:0}),
  item('Rune of Might*','weapon-runes',{group:'general',slot:standardSlot}),
  item('Rune of Might*','weapon-runes',{group:'empire-of-man',slot:0}),
  item('Rune of Might*','talisman',{group:'general',slot:0})
 ]};
 const rows=PLAY.selectedItems(unit,knights,ruleInfo);
 assert.equal(rows.length,4);
 assert.equal(rows.find(row=>row.slot===0&&row.group==='general'&&row.type==='weapon-runes').count,2);
 const champion=rows.find(row=>row.slot===championSlot);
 assert.equal(champion.count,2);assert.equal(champion.bearer,knights.command[0].name_en);
 const standard=rows.find(row=>row.slot===standardSlot);
 assert.equal(standard.count,1);assert.equal(standard.bearer,knights.command[1].name_en);
 assert.equal(rows.find(row=>row.group==='empire-of-man').count,1);
 assert.equal(rows.find(row=>row.type==='talisman').count,1);
});

test('items remain visible without source data or an indexed rule, including gifts and traits',()=>{
 const unit={magicItems:[
  item('Unknown Blessing*','gift-of-chaos'),
  item('Unknown Blessing*','gift-of-chaos'),
  item('Unlisted Trait','chaotic-trait',{slot:2}),
  item('Unlisted Rune','armor-runes',{slot:1})
 ]};
 const rows=PLAY.selectedItems(unit,null,()=>null);
 assert.equal(rows.length,3);
 assert.equal(rows.find(row=>row.name==='Unknown Blessing*').count,2);
 assert.equal(rows.find(row=>row.name==='Unknown Blessing*').url,'magic-item/unknown-blessing');
 assert.equal(rows.find(row=>row.name==='Unlisted Trait').url,'magic-item/unlisted-trait');
 assert.equal(rows.find(row=>row.name==='Unlisted Rune').type,'armor-runes');
 assert.deepEqual(PLAY.selectedItems({},null,()=>null),[]);
});

test('the item reference uses persisted copies and never changes roster selections or invents effect bonuses',()=>{
 const selections={...OPT.defaults(lord,'warriors-of-chaos'),'mounts:0':false,'mounts:7':true};
 const unit={name:'Chaos Lord',count:1,selections,magicItems:screenshotItems()};
 const before=JSON.stringify(unit);
 const original=PLAY.create({source:lord,unit,ruleInfo,optionModel:OPT,composition:'warriors-of-chaos'});
 PLAY.selectedItems(unit,lord,ruleInfo);
 const after=PLAY.create({source:lord,unit,ruleInfo,optionModel:OPT,composition:'warriors-of-chaos'});
 assert.equal(JSON.stringify(unit),before);
 assert.deepEqual(after,original);
 assert.deepEqual(after.profiles[0].modifiers.S,undefined);
 assert.deepEqual(after.profiles[0].modifiers.A,undefined);
 assert(after.unresolved.includes('Favour of the Gods*'));
 assert(after.unresolved.includes('Brazen Collar*'));
 const malformed=item('Single persisted copy','enchanted-item',{count:99});
 assert.equal(PLAY.selectedItems({magicItems:[malformed]},lord,ruleInfo)[0].count,1,'Quantity follows stored rows, not an unsupported count property');
});

test('normalization, confirmation and reload retain every selected item while draft edits leave the play snapshot intact',()=>{
 const storage=new Map();
 const context={window:{},crypto:{randomUUID:()=> 'chaos-lord-fixture'},localStorage:{getItem:name=>storage.get(name)||null,setItem:(name,value)=>storage.set(name,value)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/tow-core.js'),'utf8'),context);
 const CORE=context.window.BTHTOWCore,draft=CORE.fresh('warriors-of-chaos');
 draft.units.push(CORE.normalizeUnit({name:'Chaos Lord',category:'characters',count:1,points:510,sourceId:lord.id,sourceFaction:'warriors-of-chaos',sourceComposition:'warriors-of-chaos',magicItems:screenshotItems()}));
 assert.equal(CORE.confirmPlayRoster(draft),true);
 const initial=CORE.loadPlayRoster(draft.faction);
 assert.equal(initial.army.units[0].magicItems.length,3);
 assert.deepEqual(JSON.parse(JSON.stringify(initial.army.units[0].magicItems)),screenshotItems());
 draft.units[0].magicItems.pop();
 draft.units[0].magicItems.push(item('Changed draft item','gift-of-chaos'));
 assert.equal(CORE.playRosterChanged(draft,initial),true);
 const reloaded=CORE.loadPlayRoster(draft.faction);
 const shown=PLAY.selectedItems(reloaded.army.units[0],lord,ruleInfo);
 assert.equal(shown.find(row=>row.name==='Favour of the Gods*').count,2);
 assert(shown.some(row=>row.name==='Brazen Collar*'));
 assert(!shown.some(row=>row.name==='Changed draft item'));
 assert.deepEqual(JSON.parse(JSON.stringify(reloaded.army.units[0].magicItems)),screenshotItems());
});
