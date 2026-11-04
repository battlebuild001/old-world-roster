'use strict';
// Ordinary Break tests only. The caller must apply any overriding unit rules.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TOWCombatResultCore=api;
})(typeof window==='undefined'?null:window,function(){
  const LIMITS=Object.freeze({leadership:[1,10],defeatMargin:[1,999],die1:[1,6],die2:[1,6]});
  function integer(value,min,max){
    if(value===null||value===undefined||typeof value==='string'&&!value.trim())return {state:'missing',value:null};
    if(typeof value!=='number'&&typeof value!=='string')return {state:'invalid',value:null};
    if(typeof value==='string'&&!/^[+-]?\d+(?:\.\d+)?$/.test(value.trim()))return {state:'invalid',value:null};
    const number=Number(value);
    return Number.isInteger(number)&&number>=min&&number<=max?{state:'valid',value:number}:{state:'invalid',value:null};
  }
  function resolveBreak(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))return {kind:'invalid',reason:'invalid-input',fields:['input'],natural:null,modified:null,leadership:null,margin:null};
    const parsed=Object.fromEntries(Object.entries(LIMITS).map(([field,[min,max]])=>[field,integer(input[field],min,max)]));
    const missing=Object.keys(parsed).filter(field=>parsed[field].state==='missing');
    const invalid=Object.keys(parsed).filter(field=>parsed[field].state==='invalid');
    const outnumbered=input.outnumbered===undefined?'unknown':input.outnumbered;
    if(!['unknown','no','yes'].includes(outnumbered))invalid.push('outnumbered');
    const natural=parsed.die1.value!==null&&parsed.die2.value!==null?parsed.die1.value+parsed.die2.value:null;
    const base={natural,modified:natural!==null&&parsed.defeatMargin.value!==null?natural+parsed.defeatMargin.value:null,leadership:parsed.leadership.value,margin:parsed.defeatMargin.value};
    if(invalid.length)return {...base,kind:'invalid',reason:'invalid-input',fields:invalid};
    if(missing.length)return {...base,kind:'incomplete',reason:'missing-input',fields:missing};
    const result=(kind,reason)=>({...base,kind,reason,fields:[]});
    // Natural double 1 takes priority even when natural or modified totals exceed Ld.
    if(parsed.die1.value===1&&parsed.die2.value===1)return result('give-ground','double-one');
    if(natural>base.leadership)return result('break','natural-failure');
    if(base.modified<=base.leadership)return result('give-ground','modified-pass');
    // Only Fall Back in Good Order is converted by overwhelming Unit Strength.
    if(outnumbered==='yes')return result('break','outnumbered');
    if(outnumbered==='unknown')return result('check-unit-strength','unit-strength-unknown');
    return result('fall-back','modified-failure');
  }
  return Object.freeze({resolveBreak});
});
