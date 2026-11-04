'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const root=path.join(__dirname,'..');
const img=file=>'/app/resources/catalog/product/920x950/'+file;
function product(name,army,images,{game='The Old World',description='',slug='verified-unit-2026',...extra}={}){return {name,slug,images,description,productType:'miniatureKit',GameSystemsRoot:{lvl0:[game],lvl2:[game+' > Armies > '+army]},...extra};}
function match(cases){
 const script="import sys,json;sys.path.insert(0,'scripts');from match_official_products import match_product;print(json.dumps([match_product(*case) for case in json.load(sys.stdin)]))";
 return JSON.parse(cp.execFileSync('python3',['-B','-c',script],{cwd:root,input:JSON.stringify(cases),encoding:'utf8'}));
}

test('an exact official unit title and its army select one current painted photograph',()=>{
 const input=product('Chaos Knights','Warriors of Chaos',[img('99122701019_ChaosKnights1a.jpg'),'/app/resources/catalog/product/threeSixty/no-file',img('99122701019_ChaosKnights2.jpg')]);
 const r=match([['warriors-of-chaos','Chaos Knights {renegade}',input]])[0];
 assert.equal(r.approved,true);assert.equal(r.photos.length,1);assert(r.photos[0].fileUrl.endsWith('ChaosKnights1a.jpg'));assert.equal(r.legacyReference,false);
 assert.equal(r.photos[0].identity.method,'official-product-title-and-image');assert.equal(r.photos[0].identity.policyVersion,2);assert.equal(typeof r.photos[0].identity.evidence,'string');assert(r.photos[0].identity.proofUrl.startsWith('https://www.warhammer.com/en-GB/shop/'));assert(!('description' in r.photos[0].proof));
});

test('a Realm and Errant multi-kit never gives the two units the same build photograph',()=>{
 const p=product('Knights of the Realm/Knights Errant','Kingdom Of Bretonnia',[
  img('99122703004_KnightsRealm2.jpg'),img('99122703004_KoBKnightsErrant2.jpg')
 ],{description:'This plastic kit builds 12 mounted Knights of the Realm or Knights Errant.'});
 const [realm,errant,foot]=match([
  ['kingdom-of-bretonnia','Mounted Knights of the Realm',p],['kingdom-of-bretonnia','Knights Errant',p],['kingdom-of-bretonnia','Knights of the Realm on Foot',p]
 ]);
 assert(realm.approved&&errant.approved);assert(realm.photos[0].fileUrl.endsWith('KnightsRealm2.jpg'));assert(errant.photos[0].fileUrl.endsWith('KoBKnightsErrant2.jpg'));assert.notEqual(realm.photos[0].fileUrl,errant.photos[0].fileUrl);assert.equal(foot.approved,false);
});

test('on-foot product and mounted evidence remain distinct',()=>{
 const foot=product('Knights of the Realm on Foot','Kingdom Of Bretonnia',[img('99122703003_KnightsRealmFoot2.jpg')]);
 const generic=product('Knights of the Realm/Knights Errant','Kingdom Of Bretonnia',[img('99122703004_KnightsRealm2.jpg')]);
 const r=match([['kingdom-of-bretonnia','Knights of the Realm on Foot',foot],['kingdom-of-bretonnia','Mounted Knights of the Realm',foot],['kingdom-of-bretonnia','Mounted Knights of the Realm',generic]]);
 assert.deepEqual(r.map(x=>x.approved),[true,false,false]);
});

test('generic Lords, renamed units and another rank are not automatic substitutes',()=>{
 const cases=[
  ['kingdom-of-bretonnia','Duke',product('Duke on Royal Pegasus','Kingdom Of Bretonnia',[img('Duke1.jpg')])],
  ['kingdom-of-bretonnia','Baron',product('Bretonnian Lord','Kingdom Of Bretonnia',[img('Lord1.jpg')])],
  ['kingdom-of-bretonnia','Paladin',product('Paladin with Great Weapon','Kingdom Of Bretonnia',[img('Paladin1.jpg')])],
  ['warriors-of-chaos','Chosen Chaos Knights',product('Chaos Knights','Warriors of Chaos',[img('ChaosKnights1.jpg')])],
  ['vampire-counts','Vampire Thrall',product('Vampire Lord','Soulblight Gravelords',[img('VampireLord1.jpg')],{game:'Age of Sigmar'})],
  ['lizardmen','Slann Mage-Priest',product('Slann Starmaster','Seraphon',[img('Starmaster1.jpg')],{game:'Age of Sigmar'})],
  ['vampire-counts','Grave Guard',product('Barrow Guard','Soulblight Gravelords',[img('BarrowGuard1.jpg')],{game:'Age of Sigmar'})],
 ];
 assert(match(cases).every(r=>!r.approved));
});

test('exact legacy units retain their official Age of Sigmar system and faction proof',()=>{
 const blood=product('Blood Knights','Soulblight Gravelords',[img('99120207095_SBGravelordsBloodKnightsLead.jpg')],{game:'Age of Sigmar'});
 const rats=product('Rat Ogors','Skaven',[img('99120206043_RatOgors1.jpg')],{game:'Age of Sigmar'});
 const r=match([['vampire-counts','Blood Knights',blood],['skaven','Rat Ogres',rats]]);
 assert(r.every(x=>x.approved&&x.legacyReference));assert(r.every(x=>x.photos[0].gameSystems.includes('Age of Sigmar')));assert(r[0].photos[0].proof.factionFacet==='Soulblight Gravelords');
});

test('army facet and Chaos deity mismatches are rejected even when a title looks similar',()=>{
 const r=match([
  ['vampire-counts','Skeleton Warriors',product('Skeleton Warriors','Tomb Kings Of Khemri',[img('SkeletonWarriors1.jpg')])],
  ['ogre-kingdoms','Clanrats',product('Clanrats','Skaven',[img('Clanrats1.jpg')],{game:'Age of Sigmar'})],
  ['daemons-of-chaos','Daemonic Herald of Nurgle',product('Herald of Khorne','Blades of Khorne',[img('HeraldKhorne1.jpg')],{game:'Age of Sigmar'})],
  ['daemons-of-chaos','Daemonic Herald of Nurgle',product('Herald of Nurgle','Maggotkin of Nurgle',[img('HeraldKhorne1.jpg')],{game:'Age of Sigmar'})]
 ]);
 assert(r.every(x=>!x.approved));
});

test('ambiguous combined kit images and army collections are not treated as isolated unit photos',()=>{
 const combined=product('Dwarf Cannon & Organ Gun','Dwarfen Mountain Holds',[img('99122705008_DMHDwarfCannonsAndOrganGuns01.jpg')]);
 const box=product('Chaos Knights Army Reinforcement Set','Warriors of Chaos',[img('ChaosKnightsArmy1.jpg')]);
 const r=match([['dwarfen-mountain-holds','Cannon',combined],['dwarfen-mountain-holds','Organ Gun',combined],['warriors-of-chaos','Chaos Knights',box]]);
 assert(r.every(x=>!x.approved));
});

test('sprues transfers packaging and nonofficial image URLs are excluded',()=>{
 const p=product('Chaos Knights','Warriors of Chaos',[
  img('ChaosKnightsSprue.jpg'),img('ChaosKnightsBoxFront.jpg'),img('ChaosKnightsTransfer.jpg'),
  'https://example.invalid/app/resources/catalog/product/920x950/ChaosKnights1.jpg',img('ChaosKnights01.jpg')]);
 const r=match([['warriors-of-chaos','Chaos Knights',p]])[0];assert(r.approved);assert(r.photos[0].fileUrl.endsWith('ChaosKnights01.jpg'));
});

test('troop aliases cannot acquire another troop type through a mount suffix',()=>{
 const chariot=product('Goblin Wolf Chariot','Orc and Goblin Tribes',[img('99112709014_OGTGoblinWolfChariot01.jpg')]);
 const infantry=product('Goblin Mob','Orc and Goblin Tribes',[img('99122709004_OGTGoblinMob01.jpg')]);
 const lord=product('Chaos Lord on Manticore','Warriors of Chaos',[img('99122701001_LordonManticore1.jpg')]);
 const r=match([['orc-and-goblin-tribes','Goblin Mob',chariot],['orc-and-goblin-tribes','Goblin Wolf Chariot',chariot],['orc-and-goblin-tribes','Goblin Mob',infantry],['warriors-of-chaos','Chaos Lord',lord]]);
 assert.deepEqual(r.map(x=>x.approved),[false,true,true,true]);
});

test('a shared mount suffix is not mistaken for the other character build',()=>{
 const p=product('Tomb King/Liche Priest on Necrolith Bone Dragon','Tomb Kings Of Khemri',[
  img('99122717001_WHTOWTKTombKingOnNecrolithBoneDragon01.jpg'),img('99122717001_WHTOWTKLichePriestOnNecrolithBoneDragon01.jpg')]);
 const r=match([['tomb-kings-of-khemri','Tomb King',p],['tomb-kings-of-khemri','Liche Priest',p]]);
 assert(r.every(x=>x.approved));assert.notEqual(r[0].photos[0].fileUrl,r[1].photos[0].fileUrl);
});

test('alternative build photos exclude combined Blue/Brimstone and Gyrocopter/Gyrobomber shots',()=>{
 const horrors=product('Blue Horrors and Brimstone Horrors','Disciples of Tzeentch',[
  img('99129915029_BlueHorrorsAndBrimstoneHorrors01.jpg'),img('99129915029_BlueHorrors01.jpg'),img('99129915029_BrimstoneHorrors03.jpg')],{game:'Age of Sigmar'});
 const gyro=product('Dwarf Gyrocopters','Dwarfen Mountain Holds',[img('99122705007_DMHGyrocoptersAndGyrobombers01.jpg')]);
 const r=match([['daemons-of-chaos','Blue Horrors of Tzeentch',horrors],['daemons-of-chaos','Brimstone Horrors of Tzeentch',horrors],['dwarfen-mountain-holds','Gyrocopters',gyro]]);
 assert(r[0].approved&&r[1].approved);assert(r[0].photos[0].fileUrl.endsWith('_BlueHorrors01.jpg'));assert(r[1].photos[0].fileUrl.endsWith('_BrimstoneHorrors03.jpg'));assert.equal(r[2].approved,false);
});
