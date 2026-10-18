'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const data=require('../dist/phonetic-names.json');
const create=require('../dist/phonetic.js');
const names=create(data);

test('the browser bundle contains the same complete readings as the audited catalog',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/phonetic-names.js'),'utf8'),context);
  assert.equal(JSON.stringify(context.window.TOWPhoneticNames),JSON.stringify(data));
});

test('game names use phonetic Korean rather than previous meanings',()=>{
  for(const [english,korean] of Object.entries({
    'Knights of the Realm':'나이츠 오브 더 렐름',General:'제너럴',
    'Great weapon':'그레이트 웨폰','Close Order':'클로즈 오더',
    Fly:'플라이',Shield:'실드','Magical Attacks':'매지컬 어택스'
  }))assert.equal(names.korean(english),korean,english);
});

test('all nine statistics have consistent phonetic names while abbreviations stay intact',()=>{
  const expected={M:'무브먼트',WS:'웨폰 스킬',BS:'발리스틱 스킬',S:'스트렝스',T:'터프니스',W:'운즈',I:'이니셔티브',A:'어택스',Ld:'리더십'};
  for(const [key,reading] of Object.entries(expected)){
    assert.equal(names.stat(key),reading,key);
    assert.equal(names.korean(key),key);
    assert.equal(names.stat(key,'en'),names.statNames[key]);
  }
});

test('parameters, dice, stars and variant names keep their game values',()=>{
  assert.equal(names.korean('Fly (14)'),'플라이 (14)');
  assert.equal(names.korean('Armour Bane (3)'),'아머 베인 (3)');
  assert.equal(names.korean('Random Attacks (D3+1)'),'랜덤 어택스 (D3+1)');
  assert.equal(names.korean('Chaos Armour {warriors of chaos} (5+)'),'카오스 아머 {워리어즈 오브 카오스} (5+)');
  assert(names.korean('Favour of the Gods*').endsWith('*'));
  assert.equal(names.korean('Æther Blade'),'에테르 블레이드');
  assert.equal(names.korean('Ranger’s Glaive'),names.korean("ranger's glaive"));
  for(const value of ['S+2','D3+1','2D6','X','4+','-2'])assert.equal(names.korean(value),value);
});

test('English originals, custom Korean names and canonical dictionaries are preserved',()=>{
  const before=JSON.stringify(data);
  assert.equal(names.label('Knights of the Realm','en'),'Knights of the Realm');
  assert.equal(names.label('Knights of the Realm','both'),'나이츠 오브 더 렐름 · Knights of the Realm');
  assert.equal(names.korean('사용자가 정한 이름'),'사용자가 정한 이름');
  assert.equal(JSON.stringify(data),before);
});

test('the complete generated catalog has reviewed readings and keeps procedure titles separate',()=>{
  assert(data.coverage.labels>8000);
  assert.deepEqual(data.coverage.phoneticFallbackTokens,[]);
  assert.deepEqual(data.coverage.latinLabels,[]);
  for(const [english,korean] of Object.entries(data.labels))assert.equal(names.korean(english),korean,english);
  assert(names.has('Great Weapon'));
  assert(names.has('Strength (S)'));
  assert(!names.has('General Principles'));
  assert(!names.has('Casting Spells'));
});
