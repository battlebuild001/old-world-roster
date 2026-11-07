'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

global.window={};
require('../dist/option-core.js');
const OPT=window.BTHTOWOptions;
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/',name),'utf8'));
const chaos=read('data/games/the-old-world/warriors-of-chaos.json');
const lord=chaos.characters.find(unit=>unit.id==='chaos-lord');
const sorcerer=chaos.characters.find(unit=>unit.id==='sorcerer-lord');
const allItems=read('data/games/the-old-world/magic-items.json');
const hatChoice=OPT.itemChoices(allItems,lord.items[0],'warriors-of-chaos','warriors-of-chaos').find(item=>item.name_en==='Wizarding Hat');
const hat={name:'Wizarding Hat',type:'enchanted-item',points:45,group:'general',slot:0};
const eightLores=['battle-magic','daemonology','dark-magic','elementalism','high-magic','illusion','necromancy','waaagh-magic'];
const resolve=(source,items=[],selections=OPT.defaults(source,'warriors-of-chaos'))=>OPT.wizardState(source,selections,items,'warriors-of-chaos');

test('a normal Chaos Lord and a Tzeentch mark alone do not become Wizards',()=>{
 const plain=resolve(lord);
 assert.equal(plain.level,0);assert.deepEqual(plain.lores,[]);
 const selections=OPT.defaults(lord,'warriors-of-chaos');
 const mark=OPT.entries(lord,'warriors-of-chaos').find(entry=>entry.entry.name_en==='Mark of Tzeentch');
 assert(mark);selections[mark.path]=true;
 const marked=resolve(lord,[],selections);
 assert.equal(marked.level,0);assert.deepEqual(marked.lores,[]);
});

test('the current Lord can select the 45-point Wizarding Hat from its existing enchanted-item pool',()=>{
 assert(hatChoice,'The path uses the real item catalogue rather than a free Wizard option');
 assert.equal(hatChoice.type,'enchanted-item');assert.equal(hatChoice.points,45);assert.equal(hatChoice.group,'general');
 const selections=OPT.defaults(lord,'warriors-of-chaos');
 assert.equal(OPT.price(lord,1,selections,[hat],'warriors-of-chaos'),OPT.price(lord,1,selections,[],'warriors-of-chaos')+45);
 assert.equal(OPT.entries(lord,'warriors-of-chaos').filter(entry=>/Level \d Wizard/.test(entry.entry.name_en)).length,0,'No fabricated native upgrade is added to Lord data');
});

test('Wizarding Hat grants Level 1, one random spell, Stupidity and the eight permitted rulebook lores',()=>{
 const state=resolve(lord,[hat]);
 assert.equal(state.level,1);assert.equal(state.grantedBy,'Wizarding Hat');assert.equal(state.randomSpells,1);assert.equal(state.stupidity,true);
 assert.deepEqual([...state.lores].sort(),[...eightLores].sort());
 assert(!state.lores.includes('lore-of-chaos'),'The faction signature lore is not a free ninth Hat lore');
});

test('the Hat overrides a native higher level and removing it restores the active native selection',()=>{
 const selected=OPT.defaults(sorcerer,'warriors-of-chaos');
 const normal=resolve(sorcerer,[],selected);
 assert.equal(normal.level,3);assert.deepEqual(normal.lores,sorcerer.lores);
 const hatted=resolve(sorcerer,[hat],selected);
 assert.equal(hatted.level,1);assert.equal(hatted.grantedBy,'Wizarding Hat');
 assert.equal(resolve(sorcerer,[],selected).level,3);
 assert.equal(resolve(lord,[]).level,0);assert.deepEqual(resolve(lord,[]).lores,[]);
});

test('native Wizard level respects inactive ancestors and faction composition instead of scanning every option name',()=>{
 const source={name_en:'Training character',lores:['battle-magic'],options:[{name_en:'Wizard',options:[{name_en:'Level 4 Wizard',active:true}]},{name_en:'Level 2 Wizard',armyComposition:'another-composition'}]};
 const inactive=OPT.wizardState(source,{'options:0/options:0':true,'options:1':true},[],'warriors-of-chaos');
 assert.equal(inactive.level,0);
 const active=OPT.wizardState(source,{'options:0':true,'options:0/options:0':true},[],'warriors-of-chaos');
 assert.equal(active.level,4);assert.deepEqual(active.lores,['battle-magic']);
});

test('resolving imported Hat selections does not mutate a source, item or existing selection',()=>{
 const source=structuredClone(lord),selections=OPT.defaults(source,'warriors-of-chaos');
 const imported={name:'  WIZARDING HAT*  ',points:45,type:'enchanted-item',slot:0};
 const before=JSON.stringify({source,selections,imported});
 const state=OPT.wizardState(source,selections,[imported],'warriors-of-chaos');
 assert.equal(state.level,1);assert.equal(JSON.stringify({source,selections,imported}),before);assert.deepEqual(source.lores,[]);
 const missing=OPT.wizardState(null,{},[hat],'warriors-of-chaos');
 assert.equal(missing.level,1);assert.deepEqual([...missing.lores].sort(),[...eightLores].sort());
});

test('the selected Hat and lore survive normalization, confirmation, reload and portable seed sharing',async()=>{
 const storage=new Map();
 const context={window:{},TextEncoder,TextDecoder,Blob,CompressionStream,DecompressionStream,btoa,atob,Uint8Array,crypto:{randomUUID:()=> 'wizard-lord'},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/tow-core.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/roster-seed.js'),'utf8'),context);
 const CORE=context.window.BTHTOWCore,SEED=context.window.TOWRosterSeed,draft=CORE.fresh('warriors-of-chaos');
 draft.units.push(CORE.normalizeUnit({name:'Chaos Lord',sourceId:lord.id,category:'characters',count:1,points:240,selections:OPT.defaults(lord,'warriors-of-chaos'),magicItems:[hat],lore:'necromancy'}));
 assert.equal(CORE.confirmPlayRoster(draft),true);
 const saved=CORE.loadPlayRoster(draft.faction).army.units[0];
 assert.equal(saved.lore,'necromancy');assert.equal(saved.magicItems[0].name,'Wizarding Hat');assert.equal(resolve(lord,saved.magicItems,saved.selections).level,1);
 const decoded=await SEED.decode(await SEED.encode(draft));
 assert.equal(decoded.units[0].lore,'necromancy');assert.equal(decoded.units[0].magicItems[0].points,45);
 draft.units[0].magicItems=[];draft.units[0].lore='';
 assert.equal(CORE.loadPlayRoster(draft.faction).army.units[0].lore,'necromancy','Draft edits do not silently change a confirmed Wizard');
 assert.equal(resolve(lord,draft.units[0].magicItems,draft.units[0].selections).level,0);
});
