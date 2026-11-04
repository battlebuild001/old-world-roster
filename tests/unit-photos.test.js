'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const photos=require('../dist/unit-photos.js');

test('image search uses canonical English unit and faction rather than a roster nickname',()=>{
  const name=photos.originalName({name_en:'Knights of the Realm',name_de:'Ritter des Königs'},{name:'나의 왼쪽 기병',label:'Left flank'});
  assert.equal(name,'Knights of the Realm');
  const url=new URL(photos.imageURL({name,faction:'Kingdom of Bretonnia'}));
  assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/search');assert.equal(url.searchParams.get('tbm'),'isch');
  assert.equal(url.searchParams.get('q'),'Warhammer The Old World Kingdom of Bretonnia Knights of the Realm miniatures');
  assert(!url.searchParams.get('q').includes('나의'));assert(!url.searchParams.get('q').includes('Left flank'));
});

test('manual names remain usable while untrusted punctuation cannot change the search host or add parameters',()=>{
  const name=photos.originalName(null,{name:'직접 입력한 유닛 & q=other#"<img>'});
  const url=new URL(photos.imageURL({name,faction:'Lizardmen'}));
  assert.equal(url.hostname,'www.google.com');assert.equal(url.hash,'');assert.equal([...url.searchParams].length,2);
  assert(url.searchParams.get('q').includes(name));assert(url.searchParams.get('q').includes('Lizardmen'));
  assert.equal(photos.imageURL({name:''}),null);
});

test('photo queries normalize pasted whitespace and stay local until a link is opened',()=>{
  assert.equal(photos.originalName({name_en:'  Chaos\nKnights\t '}),'Chaos Knights');
  const url=new URL(photos.imageURL({name:'Duke\u0000 of Bretonnia',faction:'Kingdom\n of Bretonnia'}));
  assert.equal(url.searchParams.get('q'),'Warhammer The Old World Kingdom of Bretonnia Duke of Bretonnia miniatures');
});
