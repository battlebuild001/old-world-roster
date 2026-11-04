'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const D=require('../dist/document-book.js');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data/document-rulebook.json'),'utf8'));
const book=D.normalize(raw);
const blocks=raw.sections.flatMap(section=>section.blocks);
const byId=new Map(blocks.map(block=>[block.id,block]));

test('the complete supplied document is accounted for, with every substantive block published once',()=>{
  assert.equal(book.chapters.length,30);assert.equal(book.sections.length,937);
  assert.equal(blocks.length,5995);assert.equal(byId.size,5995);
  assert.equal(raw.coverage.totalSourceBlocks,6050);
  const included=raw.coverage.includedIds;
  assert.deepEqual(blocks.map(block=>block.id),included);
  const omitted=raw.coverage.omitted;
  assert.equal(omitted.length,55);assert(omitted.every(block=>block.reason));
  const accounted=[...included,...omitted.map(block=>block.id)];
  assert.equal(new Set(accounted).size,6050);
  assert.deepEqual(accounted.sort(),Array.from({length:6050},(_,i)=>'B'+String(i+1).padStart(5,'0')));
  assert(raw.coverage.allSubstantiveContentIncluded);
});

test('restoring the recorded originals reproduces the complete source text and all table cells',()=>{
  const source=blocks.map(block=>({
    id:block.id,kind:block.type==='table'?'table':'paragraph',
    content:block.type==='table'?(block.originalRows||block.rows):(block.originalText??block.text??'')
  }));
  const digest=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
  assert.equal(digest,'fa1aa7e770561ea02c1ca8d91f1cab5def10314e117bc7f5bcf7df67d00dc968');
  assert.equal(blocks.filter(block=>block.type==='table').length,81);
});

test('all sourced corrections are applied exactly and retain their original wording',()=>{
  assert.equal(raw.reviews.length,58);
  assert.equal(raw.reviews.filter(note=>note.status==='verified').length,56);
  const replay=new Map();let changes=0;
  for(const note of raw.reviews){
    assert(note.title.ko&&note.title.en&&note.explanation.ko&&note.explanation.en,note.id);
    assert(note.sources.length,note.id);
    for(const source of note.sources)assert(D.safeURL(source.url),note.id);
    for(const patch of note.patches||[]){
      const block=byId.get(patch.blockId);assert(block,patch.blockId);
      if(!replay.has(block.id))replay.set(block.id,{text:block.originalText??block.text,rows:structuredClone(block.originalRows||block.rows)});
      const current=replay.get(block.id);
      if(patch.field==='text'){
        assert(block.originalText!==undefined,block.id);assert(current.text.includes(patch.from),block.id);
        current.text=current.text.replace(patch.from,patch.to);
      }else{
        assert.equal(patch.field,'table-cell');assert(block.originalRows,block.id);
        assert(current.rows[patch.row][patch.column].includes(patch.from),block.id);
        current.rows[patch.row][patch.column]=current.rows[patch.row][patch.column].replace(patch.from,patch.to);
      }
      changes++;
    }
  }
  assert.equal(changes,90);
  for(const [id,expected] of replay){const block=byId.get(id);if(block.type==='table')assert.deepEqual(block.rows,expected.rows,id);else assert.equal(block.text,expected.text,id);}
});

test('corrected Miscast values render from current rows while the source table remains accessible',()=>{
  for(const id of ['B00595','B05901']){
    const block=byId.get(id);assert(block.originalRows,id);
    assert.match(block.rows[1][1],/5/);assert.match(block.rows[1][1],/10/);
    const current=D.tableHTML(block),original=D.tableHTML(block,{original:true});
    assert(current.includes('10'));assert.notEqual(current,original,id);
  }
  assert.match(byId.get('B02719').text,/Armour Bane \(1\)/);
  assert.match(byId.get('B02719').originalText,/Armour Bane \(2\)/);
  assert(!byId.get('B06014').text.includes('음수'));
});

test('every diagram is a bounded local asset and present in the complete offline release',()=>{
  const images=blocks.flatMap(block=>block.images||[]);
  assert.equal(images.length,62);assert.equal(new Set(images.map(image=>image.src)).size,62);
  const worker=fs.readFileSync(path.join(__dirname,'../dist/sw.js'),'utf8');
  const assets=JSON.parse(worker.match(/const ASSETS = (\[[^;]+\]);/)[1]);
  for(const image of images){assert(D.safeImage(image.src));assert(image.width>0&&image.height>0&&image.alt);assert(assets.includes(image.src),image.src);assert(fs.existsSync(path.join(__dirname,'../dist',image.src)),image.src);}
  for(const file of ['./document-book.js','./document-book.css','./data/document-rulebook.json'])assert(assets.includes(file),file);
  assert.equal(new Set(assets).size,assets.length);assert.equal(assets.length,159);
  assert(!assets.includes('./update.html'));
  assert.match(worker,/bth-tow-v53-in-app-unit-photos/);
  const updater=fs.readFileSync(path.join(__dirname,'../dist/update.html'),'utf8');
  assert.match(updater,/targetVersion=53/);assert.match(updater,/Date\.now\(\)\+180000/);
});

test('full text search reaches spells, items, table contents and corrected original wording',()=>{
  for(const word of ['Fireball','Ogre Blade','Miscast','Poisoned Attacks','Magic Resistance'])assert(D.search(word,'all',book).length,word);
  assert(D.search('ArmourBane','all',book).length);
  const chapter=book.chapters.find(chapter=>chapter.sectionIds.length>5);
  assert(D.search('',chapter.id,book).every(section=>section.chapterId===chapter.id));
  const original=blocks.find(block=>block.originalText);
  const query=original.originalText.split(/\s+/).slice(0,4).join(' ');
  assert(D.search(query,'all',book).some(section=>section.blocks.some(block=>block.id===original.id)));
  assert.equal(D.search('unfindable-document-token-519283','all',book).length,0);
  assert(Object.isFrozen(book));assert(Object.isFrozen(book.sections[0].blocks));
});

test('document rendering escapes markup without changing numeric zero or allowing executable URLs',()=>{
  const html=D.tableHTML({rows:[['D6','Value'],['0','<script>bad()</script>']]});
  assert(html.includes('>0<'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
  assert(D.formatBody('**35%**').includes('<strong>35%</strong>'));
  assert.equal(D.safeImage('https://example.com/image.webp'),null);
  assert.equal(D.safeImage('./document-book-images/../private.webp'),null);
  assert.equal(D.safeURL('javascript:alert(1)'),null);
  assert.equal(D.safeURL('https://user:password@example.com/'),null);
});
