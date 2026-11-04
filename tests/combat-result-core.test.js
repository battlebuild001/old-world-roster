'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resolveBreak}=require('../dist/combat-result-core.js');
const roll=overrides=>resolveBreak({leadership:8,defeatMargin:3,die1:3,die2:4,outnumbered:'no',...overrides});

test('Break uses the positive defeat margin and preserves equality boundaries',()=>{
  assert.deepEqual(roll(),{natural:7,modified:10,leadership:8,margin:3,kind:'fall-back',reason:'modified-failure',fields:[]});
  assert.equal(roll({die1:3,die2:5,defeatMargin:1}).kind,'fall-back','Natural total equal to Leadership does not Break');
  assert.equal(roll({die1:1,die2:3,defeatMargin:4}).kind,'give-ground','Modified total equal to Leadership passes');
  assert.equal(roll({die1:4,die2:5,defeatMargin:1}).reason,'natural-failure');
});

test('natural double 1 overrides a huge loss margin, low Leadership and superior enemy Unit Strength',()=>{
  const result=roll({leadership:1,defeatMargin:999,die1:1,die2:1,outnumbered:'yes'});
  assert.equal(result.natural,2);assert.equal(result.modified,1001);assert.equal(result.kind,'give-ground');assert.equal(result.reason,'double-one');
});

test('strictly more than twice Unit Strength converts only Fall Back in Good Order',()=>{
  assert.equal(roll({outnumbered:'yes'}).kind,'break');assert.equal(roll({outnumbered:'yes'}).reason,'outnumbered');
  assert.equal(roll({outnumbered:'no'}).kind,'fall-back','Equal to twice is represented by no, not yes');
  assert.equal(roll({die1:1,die2:3,defeatMargin:1,outnumbered:'yes'}).kind,'give-ground');
  assert.equal(roll({die1:5,die2:5,outnumbered:'yes'}).reason,'natural-failure');
});

test('unconfirmed Unit Strength prevents a false final FBIGO but does not block independent outcomes',()=>{
  assert.equal(roll({outnumbered:'unknown'}).kind,'check-unit-strength');
  assert.equal(roll({outnumbered:undefined}).reason,'unit-strength-unknown');
  assert.equal(roll({die1:1,die2:3,defeatMargin:1,outnumbered:'unknown'}).kind,'give-ground');
  assert.equal(roll({die1:5,die2:5,outnumbered:'unknown'}).kind,'break');
});

test('empty fields remain incomplete instead of silently becoming a zero or failed roll',()=>{
  for(const field of ['leadership','defeatMargin','die1','die2'])for(const value of ['', ' ', null, undefined]){
    const result=roll({[field]:value});assert.equal(result.kind,'incomplete',field);assert(result.fields.includes(field));
  }
  assert.equal(resolveBreak().kind,'incomplete');
});

test('invalid inputs reject nonphysical dice, invalid Leadership and zero or negative loss margins',()=>{
  for(const [field,values] of Object.entries({leadership:[0,11,1.5],defeatMargin:[0,-3,1000,2.5],die1:[0,7,1.5],die2:[0,7,1.5]})){
    for(const value of values)assert.equal(roll({[field]:value}).kind,'invalid',field+' '+value);
  }
  for(const value of [true,false,NaN,Infinity,[],{},'0x4','4e0','four'])assert.equal(roll({die1:value}).kind,'invalid');
  for(const value of [true,false,null,'YES',''])assert.equal(roll({outnumbered:value}).kind,'invalid');
  for(const value of [null,false,[],'roll'])assert.equal(resolveBreak(value).kind,'invalid');
});

test('numeric form strings work without modifying the supplied object',()=>{
  const input=Object.freeze({leadership:'8',defeatMargin:'3',die1:'3',die2:'4',outnumbered:'no'});
  const before=JSON.stringify(input),result=resolveBreak(input);
  assert.equal(result.kind,'fall-back');assert.equal(result.natural,7);assert.equal(result.modified,10);assert.equal(JSON.stringify(input),before);
});
