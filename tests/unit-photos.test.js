'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const photos=require('../dist/unit-photos.js');
const picture={src:'./unit-photo-images/knights-01.webp',width:1200,height:800,caption:'Empire Knights',credit:'Photograph credit',sourceUrl:'https://example.org/models/knights'};
const entry=(name,faction,aliases=[],pictures=[picture])=>({name,faction,aliases,photos:pictures.map(picture=>({...picture,identity:picture.identity||{approved:true,unit:name.replace(/\s*\{[^{}]*\}/g,''),faction,method:'exact-unit-name'}}))});

test('canonical source name wins over translated roster names and nicknames',()=>{
 assert.equal(photos.originalName({name_en:'Knights of the Realm',name_de:'Ritter'},{name:'나의 왼쪽 기병',label:'Left flank'}),'Knights of the Realm');
 assert.equal(photos.originalName(null,{name:'  Custom\nUnit\t '}),'Custom Unit');
 assert.equal(photos.imageURL,undefined,'The viewer has no Google search URL API');
});

test('catalogue lookup requires the exact original faction and only explicit unit names or aliases',()=>{
 const catalog=photos.normalizeCatalog({entries:[entry('Empire Knights','empire-of-man',['Empire Knight']),entry('Chaos Knights','warriors-of-chaos',['Chaos Knight'],[{...picture,src:'./unit-photo-images/chaos.webp'}])]});
 assert.equal(photos.findPhotos({name:'Empire Knights',factionId:'empire-of-man'},catalog).length,1);
 assert.equal(photos.findPhotos({name:'Empire Knight {renegade}',factionId:'empire-of-man'},catalog).length,1);
 assert.equal(photos.findPhotos({name:'Empire Knights',factionId:'warriors-of-chaos'},catalog).length,0);
 assert.equal(photos.findPhotos({name:'Knights',factionId:'empire-of-man'},catalog).length,0);
 assert.equal(photos.findPhotos({name:'Empire Knights'},catalog).length,0);
 assert.equal(photos.findPhotos({name:'Unknown Unit',factionId:'empire-of-man'},catalog).length,0);
});

test('ambiguous aliases never substitute another unit and an exact unit name wins over an alias',()=>{
 const catalog=photos.normalizeCatalog({entries:[entry('First Knights','empire-of-man',['Knights','Specific Knights']),entry('Second Knights','empire-of-man',['Knights']),entry('Specific Knights','empire-of-man',[],[{...picture,src:'./unit-photo-images/specific.webp'}])]});
 assert.equal(photos.findPhotos({name:'Knights',factionId:'empire-of-man'},catalog).length,0);
 assert.equal(photos.findPhotos({name:'Specific Knights',factionId:'empire-of-man'},catalog)[0].src,'./unit-photo-images/specific.webp');
});

test('only local photo files can render and source citations cannot execute code or embed credentials',()=>{
 const invalid=['https://example.org/image.webp','javascript:alert(1)','./unit-photo-images/../private.webp','./unit-photo-images/image.svg','./unit-photo-images/image.webp?q=secret','data:image/svg+xml,bad','blob:arbitrary'];
 for(const src of invalid)assert.equal(photos.safeImage(src),null,src);
 const catalog=photos.normalizeCatalog({entries:[entry('Empire Knights','empire-of-man',[],[...invalid.map(src=>({...picture,src})),{...picture,sourceUrl:'javascript:alert(1)',fileUrl:'https://name:secret@example.org/a'}])]});
 assert.equal(catalog.entries[0].photos.length,1);assert.equal(catalog.entries[0].photos[0].sourceUrl,null);assert.equal(catalog.entries[0].photos[0].fileUrl,null);
 assert.equal(photos.safeSourceURL('http://example.org/a'),null);
});

test('duplicate canonical entries merge without duplicate images and normalized data stays immutable',()=>{
 const catalog=photos.normalizeCatalog({entries:[entry('Empire Knights','empire-of-man',['Empire Knight']),entry('Empire Knights {renegade}','empire-of-man',['Knights of the Empire'])]});
 assert.equal(catalog.entries.length,1);assert.equal(catalog.entries[0].photos.length,1);assert.equal(catalog.entries[0].aliases.length,2);
 assert(Object.isFrozen(catalog));assert(Object.isFrozen(catalog.entries[0].photos[0]));
 const found=photos.findPhotos({name:'Empire Knight',factionId:'empire-of-man'},catalog);found.pop();assert.equal(catalog.entries[0].photos.length,1);
});

test('unverified or cross-unit photographs cannot enter the gallery',()=>{
 const verified={approved:true,unit:'Duke',faction:'kingdom-of-bretonnia',method:'official-caption'};
 const catalog=photos.normalizeCatalog({entries:[
  {name:'Duke',faction:'kingdom-of-bretonnia',photos:[{...picture,identity:verified}]},
  {name:'Baron',faction:'kingdom-of-bretonnia',photos:[{...picture,identity:verified}]},
  {name:'Paladin',faction:'kingdom-of-bretonnia',photos:[picture]},
  {name:'Duke',faction:'empire-of-man',photos:[{...picture,identity:verified}]}
 ]});
 assert.equal(photos.findPhotos({name:'Duke',factionId:'kingdom-of-bretonnia'},catalog).length,1);
 for(const name of ['Baron','Paladin'])assert.equal(photos.findPhotos({name,factionId:'kingdom-of-bretonnia'},catalog).length,0,name);
 assert.equal(photos.findPhotos({name:'Duke',factionId:'empire-of-man'},catalog).length,0);
});

test('a common photograph cannot be relabelled as several different units in the same army',()=>{
 const catalog=photos.normalizeCatalog({entries:['Duke','Baron','Paladin'].map(name=>entry(name,'kingdom-of-bretonnia'))});
 for(const name of ['Duke','Baron','Paladin'])assert.equal(photos.findPhotos({name,factionId:'kingdom-of-bretonnia'},catalog).length,0,name);
});

test('published Duke, Baron and Paladin photographs are distinct and retain official identification evidence',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data/unit-photos.json'),'utf8'));
 const catalog=photos.normalizeCatalog(raw),hashes=new Set(),files=new Set();
 for(const name of ['Duke','Baron','Paladin']){
  const found=photos.findPhotos({name,factionId:'kingdom-of-bretonnia'},catalog);
  assert.equal(found.length,1,name);const photo=found[0];
  assert.equal(photo.identity.unit,name);assert.equal(photo.identity.method,'official-caption');
  assert(photo.identity.proofUrl.startsWith('https://www.warhammer-community.com/'));assert(photo.identity.evidence);
  files.add(photo.src);hashes.add(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../dist',photo.src))).digest('hex'));
 }
 assert.equal(files.size,3);assert.equal(hashes.size,3,'Changing filenames must not conceal the same photograph');
 for(const item of raw.entries)for(const photo of item.photos){
  assert.equal(photo.identity.approved,true);assert.equal(photo.identity.faction,item.faction);
  assert.equal(photos.nameKey(photo.identity.unit),photos.nameKey(item.name));
 }
});

test('local photographs require PNG JPEG or WebP signatures and the per-photo size limit',async()=>{
 const png=new File([new Uint8Array([137,80,78,71,13,10,26,10])],'model.png',{type:'image/png'});
 const jpeg=new File([new Uint8Array([255,216,255,0])],'model.jpg',{type:'image/jpeg'});
 const webp=new File(['RIFF1234WEBP'],'model.webp',{type:'image/webp'});
 for(const file of [png,jpeg,webp])assert((await photos.validateLocalImage(file)).type.startsWith('image/'));
 await assert.rejects(photos.validateLocalImage(new File(['<svg></svg>'],'model.svg',{type:'image/svg+xml'})),/file-type/);
 await assert.rejects(photos.validateLocalImage(new File(['<html>unsafe</html>'],'fake.png',{type:'image/png'})),/file-type/);
 await assert.rejects(photos.validateLocalImage({size:15*1024*1024+1,type:'image/png'}),/file-size/);
 await assert.rejects(photos.validateLocalImage(new File([],'empty.png',{type:'image/png'})),/file-size/);
});
