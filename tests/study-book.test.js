'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../dist/study-book.js'),D=require('../dist/document-book.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data',name),'utf8'));
const raw=read('study-rulebook.json'),source=D.normalize(read('document-rulebook.json')),book=S.normalize(raw,source);
const lessons=raw.chapters.flatMap(chapter=>chapter.lessons);
const plain=value=>String(value).replace(/\s+/g,' ').trim();

test('authored chapters partition every supplied section and retain all tables and figures exactly once',()=>{
 assert.equal(raw.groups.length,5);assert.equal(raw.chapters.length,30);assert.equal(book.chapters.length,30);
 const mapped=lessons.flatMap(lesson=>lesson.sourceSectionIds);assert.equal(mapped.length,937);assert.equal(new Set(mapped).size,937);assert.deepEqual(mapped.slice().sort(),source.sections.map(section=>section.id).sort());
 for(const chapter of raw.chapters){const expected=source.chapters.find(item=>item.id===chapter.id);assert.ok(expected);assert.deepEqual(chapter.lessons.flatMap(lesson=>lesson.sourceSectionIds).sort(),expected.sectionIds.slice().sort());}
 const assets=book.lessons.map(lesson=>S.sourceAssets(lesson,source));const tables=assets.flatMap(asset=>asset.tables.map(table=>table.id)),images=assets.flatMap(asset=>asset.images.map(image=>image.src));assert.equal(tables.length,81);assert.equal(new Set(tables).size,81);assert.equal(images.length,62);assert.equal(new Set(images).size,62);
 assert.equal(raw.metadata.counts.lessons,lessons.length);assert.equal(raw.metadata.counts.sourceSections,937);assert.equal(raw.metadata.counts.tables,81);assert.equal(raw.metadata.counts.figures,62);
});

test('lessons teach through newly authored prose, ordered reasoning, worked examples and exceptions',()=>{
 const sourceText=source.sections.flatMap(section=>section.blocks.flatMap(block=>[block.text,...(block.rows||[]).flat()])).map(plain).filter(Boolean).join('\n');
 const leads=new Set();let diagrams=0;
 for(const lesson of lessons){assert.ok(lesson.lead.length>=50,lesson.id);const lead=plain(lesson.lead);assert.ok(!sourceText.includes(lead),'Lead is authored rather than copied: '+lesson.id);assert.ok(!leads.has(lead),'Unique lesson lead: '+lesson.id);leads.add(lead);assert.ok(lesson.takeaway.trim());assert.ok(lesson.steps.length>=2);assert.ok(lesson.steps.every(step=>step.title.trim()&&step.body.trim().length>=15));assert.ok(lesson.example.situation.trim()&&lesson.example.resolution.trim());assert.ok(lesson.exceptions.length>=1);if(lesson.diagram){diagrams++;assert.equal(lesson.diagram.type,'flow');assert.ok(lesson.diagram.nodes.length>=2&&lesson.diagram.nodes.length<=8);assert.ok(lesson.diagram.nodes.every(node=>node.trim()));assert.ok(lesson.diagram.caption.trim());}}
 assert.ok(diagrams>0);assert.equal(raw.metadata.counts.diagrams,diagrams);assert.ok(Object.isFrozen(book)&&Object.isFrozen(book.lessons[0].steps));
});

test('search reaches authored explanations and assigned source table content',()=>{
 const authored=book.lessons.find(lesson=>lesson.lead.length>80),query=plain(authored.lead).slice(0,25);assert.ok(S.search(query,'all',book).some(lesson=>lesson.id===authored.id));
 const owner=book.lessons.find(lesson=>S.sourceAssets(lesson,source).tables.some(table=>table.rows.flat().some(cell=>cell.length>55)));assert.ok(owner);const cell=S.sourceAssets(owner,source).tables.flatMap(table=>table.rows.flat()).find(cell=>cell.length>55);assert.ok(S.search(plain(cell).slice(0,30),'all',book).some(lesson=>lesson.id===owner.id));
 assert.ok(S.search('',book.chapters[2].id,book).every(lesson=>lesson.chapterId===book.chapters[2].id));assert.equal(S.search('__no_study_lesson_match__','all',book).length,0);
});

test('lesson markup prioritizes explanation and preserves linked source sections and correction evidence',()=>{
 for(const lesson of book.lessons){const html=S.lessonHTML(lesson,source);for(const part of ['studyLead','studyTakeaway','studySteps','studyWorkedExample','studyExampleSituation','studyExampleResolution','studyExceptions','studySources'])assert.ok(html.includes(part),lesson.id+' '+part);assert.ok(html.indexOf('studyLead')<html.indexOf('studySources'));if(lesson.diagram)assert.ok(html.includes('studyDiagramFlow'));for(const id of lesson.sourceSectionIds)assert.ok(html.includes('data-study-source="'+id+'"'));const reviews=new Set(S.sourceAssets(lesson,source).blocks.flatMap(block=>block.reviews||[]));for(const id of reviews){const review=source.reviews.find(item=>item.id===id);assert.ok(review);assert.ok(html.includes(S.escape(review.title.ko)));}}
});

test('back-to-contents API and safe readable markup remain available without browser history writes',()=>{
 assert.equal(typeof S.back,'function');assert.equal(typeof S.backToContents,'function');assert.equal(S.back(),false);assert.equal(S.safeSourceURL('javascript:alert(1)'),null);assert.equal(S.safeSourceURL('https://name:secret@example.invalid/a'),null);assert.ok(!S.paragraphs('<img src=x onerror=alert(1)>').includes('<img'));assert.match(S.diagramHTML({title:'a',nodes:['one','two'],caption:'why'}),/studyNodeArrow/);
});

test('release cache includes the reading edition alongside its complete retained source assets',()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../dist/sw.js'),'utf8'),assets=JSON.parse(sw.match(/const ASSETS\s*=\s*(\[[\s\S]*?\]);/)[1]);assert.match(sw,/bth-tow-v51-/);for(const asset of ['./study-book.js','./study-book.css','./data/study-rulebook.json','./document-book.js','./data/document-rulebook.json'])assert.ok(assets.includes(asset));assert.equal(assets.length,153);assert.equal(assets.filter(asset=>asset.startsWith('./document-book-images/')).length,62);assert.ok(!assets.includes('./update.html'));assert.match(fs.readFileSync(path.join(__dirname,'../dist/update.html'),'utf8'),/targetVersion\s*=\s*51/);
});
