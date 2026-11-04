'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const root=path.join(__dirname,'..');
const photo=(file,caption='')=>({fileUrl:'https://whfb.lexicanum.com/mediawiki/images/a/ab/'+file,caption,sourceUrl:'https://whfb.lexicanum.com/wiki/An_untrusted_parent_article'});
function verify(cases){
 const script="import sys,json;sys.path.insert(0,'scripts');from photo_identity import verify_photo;print(json.dumps([verify_photo(*case) for case in json.load(sys.stdin)]))";
 return JSON.parse(cp.execFileSync('python3',['-B','-c',script],{cwd:root,input:JSON.stringify(cases),encoding:'utf8'}));
}

test('exact miniature identity accepts real unit names and same-unit rules variants',()=>{
 const cases=[
  ['warriors-of-chaos','Chaos Knights',photo('Chaos_Knights_M03.png','Chaos Knights for W:TOW')],
  ['warriors-of-chaos','Chaos Knights {renegade}',photo('Chaos_Knight_Command_M01.png','Chaos Knight Command for W:TOW')],
  ['kingdom-of-bretonnia','Men-at-Arms',photo('Men_at_Arms_Spears_M01.png','Men-at-arms with spears')],
  ['high-elf-realms','Elven Spearmen',photo('High_Elf_Spearman_M02.jpg','High Elf Spearman')],
  ['dark-elves','Har Ganeth Executioners',photo('Executioner_M01.jpg','Executioner Regiment')],
  ['dwarfen-mountain-holds','Engineer',photo('Dwarf_Engineer_M01.jpg','Dwarf Engineer')],
  ['empire-of-man','Mortar {empire}',photo('Empire_Mortar_M01.jpg','A Mortar with three crewmen')]
 ];
 const results=verify(cases);results.forEach((r,i)=>{assert.equal(r.approved,true,JSON.stringify(cases[i])+' '+r.reason);assert.equal(r.policyVersion,1);assert(r.matchedLabel);});
});

test('a shared Lord or parent gallery cannot establish Duke Baron Paladin or another rank',()=>{
 const cases=['Duke','Baron','Paladin'].map(name=>['kingdom-of-bretonnia',name,photo('Bretonnian_Lord_Pegasus_M01.jpg','Bretonnian Lord on Royal Pegasus · Bretonnian character model reference')]);
 cases.push(['vampire-counts','Vampire Thrall',photo('Vampire_Lord_M01.jpg','Vampire Lord · Vampire character model reference')]);
 cases.push(['warriors-of-chaos','Chosen Chaos Knights',photo('Chaos_Knights_M03.png','Chaos Knights for W:TOW')]);
 cases.push(['warriors-of-chaos','Aspiring Champion',photo('Exalted_Hero_M01.jpg','Exalted Hero')]);
 assert(verify(cases).every(r=>r.approved===false));
});

test('explicitly different rank troop faction and named subtype images are rejected',()=>{
 const cases=[
  ['lizardmen','Skink Cohort',photo('Chameleon_Skink_M01.jpg','Chameleon Skinks')],
  ['lizardmen','Skink Skirmishers',photo('Skink_Chief_M01.jpg','Skink Chief')],
  ['orc-and-goblin-tribes','Night Goblin Mob',photo('Night_Goblin_Warboss_M02.jpg','Night Goblin Warboss')],
  ['beastmen-brayherds','Gor Herd',photo('Bestigor_M01.jpg','Bestigors')],
  ['beastmen-brayherds','Dragon Ogres',photo('Dragon_Ogre_Shaggoth_M01.jpg','Shaggoth')],
  ['ogre-kingdoms','Hunter',photo('Human_Archer_M01.jpeg','Archers of Talabheim')],
  ['vampire-counts','Skeleton Warriors {vampire counts}',photo('Tomb_King_Skeleton_Warrior_M03.jpg','Tomb Kings skeleton spearmen')],
  ['tomb-kings-of-khemri','Skeleton Warriors',photo('Skeleton_Archer_M02.jpg','Tomb King skeleton archer models')],
  ['high-elf-realms','Frostheart Phoenix',photo('Flamespyre_Phoenix_M01.jpg','Flamespyre Phoenix')],
  ['empire-of-man','Engineer',photo('Dwarf_Engineer_M01.jpg','Dwarf Engineer')],
  ['lizardmen','Ripperdactyl Riders',photo('Bloat_Toad_M01.jpg','Bloat Toad')]
 ];
 verify(cases).forEach((r,i)=>assert.equal(r.approved,false,JSON.stringify(cases[i])));
});

test('foot and mounted units require their mount mode explicitly rather than inheriting a gallery',()=>{
 const cases=[
  ['kingdom-of-bretonnia','Knights of the Realm on Foot',photo('Knight_of_the_Realm_M01.jpg','Knight of the Realm')],
  ['kingdom-of-bretonnia','Mounted Knights of the Realm',photo('Knight_of_the_Realm_M01.jpg','Knight of the Realm')],
  ['kingdom-of-bretonnia','Knights of the Realm on Foot',photo('Knight_of_the_Realm_Foot_M01.jpg','Knights of the Realm on foot')],
  ['kingdom-of-bretonnia','Mounted Knights of the Realm',photo('Knight_of_the_Realm_Mounted_M01.jpg','Mounted Knights of the Realm')]
 ];
 assert.deepEqual(verify(cases).map(r=>r.approved),[false,false,true,true]);
});

test('Chaos deity variants must match the explicit deity in the individual photograph',()=>{
 const cases=[
  ['daemons-of-chaos','Daemonic Herald of Khorne',photo('Herald_of_Khorne_M01.jpg','Herald of Khorne')],
  ['daemons-of-chaos','Daemonic Herald of Nurgle',photo('Herald_of_Khorne_M01.jpg','Herald of Khorne')],
  ['daemons-of-chaos','Daemonic Herald of Tzeentch',photo('Herald_M01.jpg','Herald')],
  ['daemons-of-chaos','Soul Grinder of Khorne',photo('Soulgrinder_Nurgle_M01.jpg','Soul Grinder of Nurgle')],
  ['daemons-of-chaos','Bloodletters of Khorne',photo('Bloodletter_M01.jpg','Bloodletters')]
 ];
 assert.deepEqual(verify(cases).map(r=>r.approved),[true,false,false,false,true]);
});

test('parent article and added generic reference text do not constitute positive image identity',()=>{
 const r=verify([
  ['kingdom-of-bretonnia','Baron',{...photo('Unknown_M01.jpg','Bretonnian Lord · Baron reference photo'),sourceUrl:'https://whfb.lexicanum.com/wiki/Baron'}],
  ['warriors-of-chaos','Chaos Knights',{...photo('Unknown_M01.jpg','Model'),sourceUrl:'https://whfb.lexicanum.com/wiki/Chaos_Knight'}],
  ['warriors-of-chaos','Chaos Knights',{fileUrl:'javascript:Chaos_Knights_M01.jpg',caption:'Chaos Knights'}]
 ]);
 assert(r.every(item=>item.approved===false));
});
