'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('../dist/handbook.js');
const packs=['foundations','battles','specials'].map(name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data/handbook-'+name+'.json'),'utf8')));
const data=H.normalize(packs);
const at=source=>data.entries.find(e=>e.path===source)||data.entries.find(e=>e.sources.some(s=>s.path===source));
const text=e=>JSON.stringify(e);
const english=e=>[e.summary.en,e.quick.en,...e.steps.map(s=>s.en),...e.exceptions.map(s=>s.en)].join(' ');
test('every authored ruling has bilingual procedures, exceptions, worked examples and a quick reference',()=>{
  assert(data.chapters.length>=24);assert(data.entries.length>=150);
  assert.equal(new Set(data.entries.map(e=>e.id)).size,data.entries.length);
  for(const e of data.entries){
    for(const field of ['title','summary','timing','example','quick'])for(const language of ['ko','en'])assert(e[field][language].trim(),e.id+' '+field+' '+language);
    assert(e.steps.length>=2,e.id);assert(e.exceptions.length>=1,e.id);assert(e.sources.length>=1,e.id);
    for(const p of [...e.steps,...e.exceptions])assert(p.ko&&p.en,e.id);
    assert(e.path&&e.path.startsWith('/')&&!e.path.startsWith('//'),e.id);
    for(const s of e.sources)assert(H.safePath(s.path)&&s.title,e.id);
    if(e.table)for(const row of e.table.rows)assert.equal(row.length,e.table.columns.length,e.id);
  }
});
test('the offline handbook covers every stage of resolution including loss thresholds and artillery mishaps',()=>{
  for(const source of [
    '/general-principles/re-rolls','/model-profiles/characteristic-tests','/model-profiles/leadership-tests',
    '/the-strategy-phase/insurmountable-losses','/the-movement-phase/determine-charge-range',
    '/movement-in-detail/dangerous-terrain-movement','/the-psychology-of-war/heavy-casualties',
    '/magic/casting-roll-casting-result-and-casting-value','/magic/dispel-roll-and-dispel-result','/magic/miscast',
    '/the-shooting-phase/roll-to-hit-shooting','/the-shooting-phase/roll-to-wound-shooting',
    '/the-combat-phase/roll-to-hit-combat','/the-combat-phase/break-test',
    '/special-rules/poisoned-attacks','/special-rules/armour-bane',
    '/war-machines/stone-thrower-misfire-table','/troop-types-in-detail/parry'
  ])assert(at(source),'Missing source coverage: '+source);
});
test('current Poison, Swiftstride and Press of Battle rules preserve their trigger and scope',()=>{
  const poison=english(at('/special-rules/poisoned-attacks'));
  assert.match(poison,/To Hit.*6|6.*To Hit/i);assert.match(poison,/To Wound/i);assert.match(poison,/\+2/);
  const swift=english(at('/special-rules/swiftstride'));
  assert.match(swift,/\+3/);assert.match(swift,/\+D6/);assert.match(swift,/before/i);
  const press=english(at('/troop-types-in-detail/press-of-battle'));
  assert.match(press,/combat order/i);assert.match(press,/charged|charge/i);assert.match(press,/two|2/i);
});
test('search includes detailed instructions, original terminology and chapter filters without changing input',()=>{
  const before=JSON.stringify(packs);const entry=data.entries.find(e=>e.aliases.length);
  const alias=entry.aliases[0];assert(H.search(alias,'all',data).some(e=>e.id===entry.id));
  const phrase=data.entries[0].steps[0].en.split(/\s+/).slice(0,5).join(' ');
  assert(H.search(phrase,'all',data).some(e=>e.id===data.entries[0].id));
  assert(H.search('',data.chapters[0].id,data).every(e=>e.chapterId===data.chapters[0].id));
  assert.equal(H.search('unfindable-handbook-token-098765','all',data).length,0);
  assert.equal(JSON.stringify(packs),before);assert(Object.isFrozen(data));assert(Object.isFrozen(data.entries[0].steps));
});
test('reference tables preserve zero and escape markup while keeping row and column semantics',()=>{
  const table={caption:{ko:'표',en:'Table'},columns:[{ko:'행',en:'Row'},{ko:'값',en:'Value'}],rows:[[0,'<script>bad()</script>']]};
  const html=H.tableHTML(table);assert(html.includes('>0<'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
  assert(html.includes('scope="col"'));assert(html.includes('scope="row"'));
  assert.equal(H.safePath('https://example.com'),null);assert.equal(H.safePath('//example.com'),null);
});
test('all authored handbook assets are available in the complete offline cache',()=>{
  const worker=fs.readFileSync(path.join(__dirname,'../dist/sw.js'),'utf8');
  const assets=JSON.parse(worker.match(/const ASSETS = (\[[^;]+\]);/)[1]);
  for(const asset of ['./handbook.js','./handbook.css','./data/handbook-foundations.json','./data/handbook-battles.json','./data/handbook-specials.json'])assert(assets.includes(asset),asset);
  assert(!assets.includes('./update.html'));
  for(const asset of assets)assert(fs.existsSync(path.join(__dirname,'../dist',asset)),asset);
  assert.match(worker,/bth-tow-v56-borderless-unit-thumbnails/);
  assert.match(fs.readFileSync(path.join(__dirname,'../dist/update.html'),'utf8'),/targetVersion=56/);
});
