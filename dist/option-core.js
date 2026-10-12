'use strict';
// Option model kept separate from the UI for later integration with BTH AoS Forge.
window.BTHTOWOptions = (() => {
  const fields = ['command','equipment','armor','options','mounts'];
  const standardItemTypes = new Set(['weapon','armor','armor-mages','talisman','arcane-item','enchanted-item','banner']);
  const key = (field,index,parent='') => `${parent}${field}:${index}`;
  const valid = (entry,composition) => !entry.armyComposition || (Array.isArray(entry.armyComposition) ? entry.armyComposition.includes(composition) : entry.armyComposition === composition);
  function defaults(source,composition) {
    const selected={};
    const visit=(entries,field,parent='')=>(entries||[]).forEach((entry,index)=>{
      if(!valid(entry,composition))return;
      const path=key(field,index,parent);
      if(entry.active || (entry.alwaysActive && valid(entry,composition))) selected[path]=entry.stackable ? (entry.minimum || 1) : true;
      if(entry.options)visit(entry.options,'options',`${path}/`);
    });
    for(const field of fields)visit(source[field],field);
    return selected;
  }
  function entries(source,composition) {
    const result=[];
    const visit=(list,field,parent='',depth=0,parentKey='')=>(list||[]).forEach((entry,index)=>{
      if(!valid(entry,composition))return;
      const path=key(field,index,parent);
      result.push({entry,field,path,depth,parentKey,index});
      if(entry.options)visit(entry.options,'options',`${path}/`,depth+1,path);
    });
    for(const field of fields)visit(source[field],field);
    return result;
  }
  const active=(value)=>value===true || Number(value)>0;
  function itemChoices(data,group,faction,composition) {
    if(!data)return [];
    const types=new Set(group.types||[]),pools=['general',faction];
    for(const [pool,items] of Object.entries(data)) {
      if(pools.includes(pool))continue;
      if(items.some(item=>types.has(item.type) && !standardItemTypes.has(item.type)))pools.push(pool);
    }
    const result=[];
    for(const pool of pools)for(const item of data[pool]||[])if(types.has(item.type) && valid(item,composition))result.push({...item,group:pool});
    return result;
  }
  function price(source,count,selections,magicItems=[],composition='') {
    let total=(Number(source.points)||0)*count;
    for(const {entry,path,parentKey} of entries(source,composition)) {
      if(!active(selections[path]) || (parentKey && !active(selections[parentKey])))continue;
      const amount=entry.stackable ? Number(selections[path])||0 : 1;
      total += (Number(entry.points)||0)*(entry.perModel ? count : 1)*amount;
    }
    for(const item of magicItems) total += Number(item.points)||0;
    return Math.max(0,Math.round(total));
  }
  function describe(source,selections,magicItems=[],composition='') {
    const labels=[];
    for(const {entry,path,parentKey} of entries(source,composition)){
      if(!active(selections[path]) || (parentKey && !active(selections[parentKey])))continue;
      const name=entry.name_en||entry.id||'옵션';
      labels.push(entry.stackable ? `${selections[path]}× ${name}` : name);
    }
    const itemCounts=new Map();
    for(const item of magicItems){const key=`${item.group}\u0000${item.name}`;itemCounts.set(key,(itemCounts.get(key)||0)+1);}
    for(const [key,count] of itemCounts)labels.push(count>1?`${count}× ${key.split('\u0000')[1]}`:key.split('\u0000')[1]);
    return labels;
  }
  return Object.freeze({fields,key,valid,defaults,entries,price,describe,active,itemChoices});
})();
