const test=require('node:test');
const assert=require('node:assert/strict');

global.window={};
require('../dist/matched-play.js');
const {check}=window.TOWMatchedPlay;
const base={faction:'kingdom-of-bretonnia',composition:'kingdom-of-bretonnia',limit:2000};
const unit=(overrides={})=>({name:'Knights',category:'core',sourceId:'knights',sourceFaction:base.faction,count:5,points:100,...overrides});
const options=()=>[];

test('Combined Arms counts identical unrestricted units and scales at 3,000 points',()=>{
  const units=Array.from({length:5},()=>unit());
  const source=()=>({id:'knights'});
  assert(check({...base,matchedMode:'combined-arms',units},source,options).some(item=>item.kind==='error'));
  assert(!check({...base,limit:3000,matchedMode:'combined-arms',units},source,options).some(item=>item.kind==='error'));
});

test('existing list limits and detachments are excluded from Combined Arms duplicates',()=>{
  const units=Array.from({length:5},()=>unit());
  const restricted=()=>({armyComposition:{[base.composition]:{notes:{name_en:'0-1 per 1000 points'}}}});
  assert(!check({...base,matchedMode:'combined-arms',units},restricted,options).some(item=>item.kind==='error'));
  assert(!check({...base,matchedMode:'combined-arms',units:units.map(item=>({...item,isDetachment:true}))},()=>({}),options).some(item=>item.kind==='error'));
});

test('Grand Melee flags unit points, model share and high level Wizards',()=>{
  const units=[unit({name:'Wizard',category:'characters',sourceId:'wizard',count:1,points:550}),unit({name:'Wizard',category:'characters',sourceId:'wizard',count:1,points:200}),unit({name:'Big unit',sourceId:'big',count:12,points:200}),unit({name:'Small unit',sourceId:'small',count:2,points:50})];
  const results=check({...base,matchedMode:'grand-melee',units},()=>({}),(_source,entry)=>entry.name==='Wizard'?['Level 4 Wizard']:[]);
  assert(results.some(item=>item.en.includes('single unit limit')));
  assert(results.some(item=>item.en.includes('exceeds 50%')));
  assert(results.some(item=>item.en.includes('Level 4 Wizards')));
});

test('matched mode selection survives roster normalization',()=>{
  global.localStorage={getItem:()=>null,setItem:()=>{}};
  global.crypto={randomUUID:()=> 'id'};
  require('../dist/tow-core.js');
  const army=window.BTHTOWCore.normalize({...base,matchedMode:'grand-melee',name:'Army',units:[unit({category:'mercenaries',sourceFaction:'orc-and-goblin-tribes'})]});
  assert.equal(army.matchedMode,'grand-melee');
  assert.equal(army.units[0].category,'mercenaries');
  assert.equal(army.units[0].sourceFaction,'orc-and-goblin-tribes');
});
