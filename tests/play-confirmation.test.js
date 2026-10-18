const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
  const storage=new Map();let full=false;
  const context={window:{},crypto:{randomUUID:()=> 'unit-id'},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(full)throw Error('full');storage.set(key,value);}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/tow-core.js'),'utf8'),context);
  return {core:context.window.BTHTOWCore,storage,fill:()=>{full=true;}};
}
test('confirmed roster stays fixed when the editable roster changes',()=>{
  const {core}=setup(),draft=core.fresh();
  draft.units.push(core.normalizeUnit({name:'Duke',count:1,points:175,selections:{'mounts:1':true}}));
  assert.equal(core.confirmPlayRoster(draft),true);
  const confirmed=core.loadPlayRoster(draft.faction);
  assert.equal(core.playRosterChanged(draft,confirmed),false);
  draft.units[0].selections['mounts:1']=false;draft.units[0].points=200;
  assert.equal(core.playRosterChanged(draft,confirmed),true);
  assert.equal(core.loadPlayRoster(draft.faction).army.units[0].points,175);
  assert.equal(core.loadPlayRoster(draft.faction).army.units[0].selections['mounts:1'],true);
});
test('confirmation is preserved across reload and isolated by faction',()=>{
  const {core}=setup(),bretonnia=core.fresh(),chaos=core.fresh('warriors-of-chaos');
  bretonnia.name='Confirmed knights';chaos.name='Confirmed chaos';
  core.confirmPlayRoster(bretonnia);core.confirmPlayRoster(chaos);
  assert.equal(core.loadPlayRoster(bretonnia.faction).army.name,'Confirmed knights');
  assert.equal(core.loadPlayRoster(chaos.faction).army.name,'Confirmed chaos');
  assert.ok(core.loadPlayRoster(chaos.faction).confirmedAt);
});
test('failed confirmation preserves the previous confirmed roster',()=>{
  const {core,fill}=setup(),draft=core.fresh();core.confirmPlayRoster(draft);
  const before=core.loadPlayRoster(draft.faction).army.name;draft.name='New draft';fill();
  assert.equal(core.confirmPlayRoster(draft),false);
  assert.equal(core.loadPlayRoster(draft.faction).army.name,before);
});
