'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const photos=require('../dist/unit-photos.js');
const picture={src:'./unit-photo-images/knights-01.webp',width:1200,height:800,caption:'Empire Knights',credit:'Photograph credit',sourceUrl:'https://example.org/models/knights'};
const entry=(name,faction,aliases=[],pictures=[picture])=>({name,faction,aliases,photos:pictures});

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
