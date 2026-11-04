#!/usr/bin/env python3
"""Build a local miniature-photo catalogue from attributed Lexicanum galleries.

Only gallery images identified as miniature photographs are selected. Original
article/file URLs and captions remain in the catalogue; source metadata is not
copied into the resized display assets. No browser or paid image API is used.
"""
from __future__ import annotations
import argparse,concurrent.futures,hashlib,html,json,re,time,threading,tempfile,urllib.error,urllib.parse,urllib.request
from pathlib import Path
from io import BytesIO
from email.utils import parsedate_to_datetime
from PIL import Image,ImageOps
from photo_identity import verify_photo

ROOT=Path(__file__).resolve().parents[1]
BASE='https://whfb.lexicanum.com'
UA='Mozilla/5.0 (compatible; miniature-reference-catalogue/1.0)'
RATE_LOCK=threading.Lock()
NEXT_REQUEST=0.0
REQUEST_INTERVAL=1.0
NETWORK_PAUSED=False
RATE_LIMITED=False
# Article lookup hints only. A page is not evidence that its photos depict a unit.
# Every candidate photograph must independently pass the identity policy.
ALIASES={
 ('kingdom-of-bretonnia','Duke'):'Bretonnian_Lord',('kingdom-of-bretonnia','Baron'):'Bretonnian_Lord',('kingdom-of-bretonnia','Paladin'):'Bretonnian_Lord',('kingdom-of-bretonnia','Prophetess'):'Damsel',('kingdom-of-bretonnia','Mounted Knights of the Realm'):'Knight_of_the_Realm',('kingdom-of-bretonnia','Knights of the Realm on Foot'):'Knight_of_the_Realm',('kingdom-of-bretonnia','Peasant Bowmen'):'Peasant_Bowman',('kingdom-of-bretonnia','Sergeant-at-Arms'):'Sergeant-at-Arms',
 ('dwarfen-mountain-holds','King'):'Dwarf_Lord',('dwarfen-mountain-holds','Thane'):'Thane',('dwarfen-mountain-holds','Engineer'):'Dwarf_Engineer',('dwarfen-mountain-holds','Engineer Sapper'):'Dwarf_Engineer',('dwarfen-mountain-holds','Dwarf Warriors'):'Dwarf_Warrior',('dwarfen-mountain-holds','Royal Clan Warriors'):'Dwarf_Warrior',('dwarfen-mountain-holds','Rangers'):'Dwarf_Ranger',('dwarfen-mountain-holds','Cannon'):'Dwarf_Cannon',('dwarfen-mountain-holds','Bolt Thrower'):'Dwarf_Bolt_Thrower',('dwarfen-mountain-holds','Scout Gyrocopters'):'Gyrocopter',
 ('high-elf-realms','Prince'):'High_Elf_Prince',('high-elf-realms','Noble'):'High_Elf_Noble',('high-elf-realms','Mage'):'High_Elf_Mage',('high-elf-realms','Archmage'):'High_Elf_Archmage',('high-elf-realms','Elven Spearmen'):'High_Elf_Spearman',('high-elf-realms','Elven Archers'):'High_Elf_Archer',('high-elf-realms','White Lions of Chrace'):'White_Lion',('high-elf-realms','Swordmasters of Hoeth'):'Swordmaster',('high-elf-realms','Eagle-Claw Bolt Thrower'):'Eagle_Claw_Bolt_Thrower',
 ('warriors-of-chaos','Sorcerer Lord'):'Chaos_Sorcerer',('warriors-of-chaos','Exalted Sorcerer'):'Chaos_Sorcerer',('warriors-of-chaos','Exalted Champion'):'Champion_of_Chaos',('warriors-of-chaos','Aspiring Champion'):'Champion_of_Chaos',('warriors-of-chaos','Marauder Tribe Chieftain'):'Marauder_Chieftain',('warriors-of-chaos','Chosen Chaos Warriors'):'Chosen',('warriors-of-chaos','Chosen Chaos Knights'):'Chaos_Knight',('warriors-of-chaos','Chosen Chaos Chariot'):'Chaos_Chariot',
 ('empire-of-man','Wizard Lord'):'Battle_Wizard',('empire-of-man','Master Mage'):'Battle_Wizard',('empire-of-man','Grand Master'):'Grand_Master',('empire-of-man','Chapter Master'):'Grand_Master',('empire-of-man','Lector of Sigmar'):'Warrior_Priest',('empire-of-man','Priest of Sigmar'):'Warrior_Priest',('empire-of-man','High Priest of Ulric'):'Warrior_Priest_of_Ulric',('empire-of-man','Priest of Ulric'):'Warrior_Priest_of_Ulric',('empire-of-man','State Troops'):'State_Troop',('empire-of-man','Veteran State Troops'):'State_Troop',('empire-of-man','Nuln State Troops'):'State_Troop',('empire-of-man','Nuln Veteran State Troops'):'State_Troop',('empire-of-man','State Missile Troops'):'State_Troop',('empire-of-man','Free Company Militia'):'Free_Company',('empire-of-man','Empire Archers'):'Empire_Archer',('empire-of-man','Great Cannon'):'Great_Cannon',('empire-of-man','Mortar'):'Mortar',('empire-of-man','Empire Greatswords'):'Greatsword',
 ('vampire-counts','Vampire Count'):'Vampire_Lord',('vampire-counts','Vampire Lord'):'Vampire_Lord',('vampire-counts','Vampire Thrall'):'Vampire_Lord',('vampire-counts','Master Necromancer'):'Necromancer',('vampire-counts','Necromantic Acolyte'):'Necromancer',('vampire-counts','Wight Lord'):'Wight_King',('vampire-counts','Skeleton Warriors'):'Skeleton_Warrior',
 ('tomb-kings-of-khemri','High Priest'):'Liche_Priest',('tomb-kings-of-khemri','Mortuary Priest'):'Liche_Priest',('tomb-kings-of-khemri','Royal Herald'):'Tomb_Herald',('tomb-kings-of-khemri','Arch Necrotect'):'Necrotect',('tomb-kings-of-khemri','Skeleton Warriors'):'Skeleton_Warrior',('tomb-kings-of-khemri','Skeleton Infantry Cohort'):'Skeleton_Warrior',('tomb-kings-of-khemri','Skeleton Cavalry Cohort'):'Skeleton_Horseman',('tomb-kings-of-khemri','Venerable Ushabti'):'Ushabti',
 ('wood-elf-realms','Glade Lord'):'Glade_Lord',('wood-elf-realms','Glade Captain'):'Glade_Captain',('wood-elf-realms','Treeman Ancient'):'Treeman',('wood-elf-realms','Deepwood Scouts'):'Glade_Guard',
 ('skaven','Master Assassin'):'Skaven_Assassin',('skaven','Skaven Dregs'):'Clanrat',('skaven','Rat Swarms'):'Rat_Swarm',('skaven','Warplock Jezzails'):'Warplock_Jezzail',('skaven','Weapon Team'):'Weapon_Team',
 ('lizardmen','Slann Mage-Priest'):'Slann',('lizardmen','Saurus Oldblood'):'Saurus_Oldblood',('lizardmen','Saurus Scar-Veteran'):'Saurus_Scar-Veteran',('lizardmen','Skink Cohort'):'Skink',('lizardmen','Skink Skirmishers'):'Skink',('lizardmen','Salamander Pack'):'Salamander',('lizardmen','Razordon Pack'):'Razordon',('lizardmen','Ancient Stegadon'):'Stegadon',
 ('ogre-kingdoms','Gnoblar Fighters'):'Gnoblar',('ogre-kingdoms','Sabretusk Pack'):'Sabretusk',('ogre-kingdoms','Stonehorn Riders'):'Stonehorn',('ogre-kingdoms','Thundertusk Riders'):'Thundertusk',
 ('dark-elves','Dark Elf Dreadlord'):'Dreadlord',('dark-elves','Dark Elf Master'):'Dark_Elf_Master',('dark-elves','Supreme Sorceress'):'Dark_Elf_Sorceress',('dark-elves','Sorceress'):'Dark_Elf_Sorceress',('dark-elves','Khainite Assassin'):'Dark_Elf_Assassin',('dark-elves','Dark Elf Warriors'):'Dark_Elf_Warrior',('dark-elves','Repeater Crossbowmen'):'Dark_Elf_Crossbowman',('dark-elves','Har Ganeth Executioners'):'Executioner',('dark-elves','Black Guard of Naggarond'):'Black_Guard',('dark-elves','Dark Elf Shades'):'Shade',
 ('chaos-dwarfs','Despot'):'Chaos_Dwarf_Lord',('chaos-dwarfs','Castellan'):'Infernal_Castellan',('chaos-dwarfs','Blunderbuss Decimators'):'Chaos_Dwarf_Warrior',('chaos-dwarfs','Hobgoblin Cutthroats'):'Hobgoblin',('chaos-dwarfs','Bull Centaur Renders'):'Bull_Centaur',
}
GLOBAL={'Gor Herd':'Gor','Ungor Herd':'Ungor','Bestigor Herd':'Bestigor','Gors':'Gor','Ungors':'Ungor','Minotaur Herd':'Minotaur','Razorgor Herd':'Razorgor','Centigor Herd':'Centigor','Chaos Ogres':'Chaos_Ogre','Chaos Trolls':'Chaos_Troll','Chaos Giant':'Chaos_Giant','Chaos Warhounds':'Chaos_Warhound','Gigantic Spawn of Chaos':'Chaos_Spawn','Marauder Horsemen':'Marauder_Horseman','Orc Mob':'Orc','Black Orc Mob':'Black_Orc','Goblin Mob':'Goblin','Night Goblin Mob':'Night_Goblin','Snotling Mob':'Snotling','Common Troll Mob':'Troll','River Troll Mob':'River_Troll','Stone Troll Mob':'Stone_Troll','Goblin Wolf Rider Mob':'Goblin_Wolf_Rider','Goblin Spider Rider Mob':'Forest_Goblin_Spider_Rider','Orc Boar Boy Mob':'Orc_Boar_Boy','Night Goblin Squig Herd':'Squig_Herd','Night Goblin Squig Hopper Mob':'Squig_Hopper','Orc Weirdnob':'Orc_Shaman','Orc Weirdboy':'Orc_Shaman','Goblin Oddnob':'Goblin_Shaman','Goblin Oddgit':'Goblin_Shaman','Night Goblin Oddnob':'Night_Goblin_Shaman','Night Goblin Oddgit':'Night_Goblin_Shaman','Orc Bigboss':'Orc_Big_Boss','Black Orc Bigboss':'Black_Orc_Big_Boss','Goblin Bigboss':'Goblin_Big_Boss','Night Goblin Bigboss':'Night_Goblin_Big_Boss','Goblin Bolt Throwa':'Goblin_Spear_Chukka','Goblin Rock Lobber':'Rock_Lobber','Snotling Pump Wagons':'Snotling_Pump_Wagon','Grail Knights':'Grail_Knight','Questing Knights':'Questing_Knight','Pegasus Knights':'Pegasus_Knight','Battle Pilgrims':'Battle_Pilgrim','Mounted Yeomen':'Mounted_Yeoman','Field Trebuchet':'Field_Trebuchet','Gutter Runners':'Gutter_Runner','Night Runners':'Night_Runner','Rat Ogres':'Rat_Ogre','Clanrats':'Clanrat','Plague Monks':'Plague_Monk','Plague Censer Bearers':'Plague_Censer_Bearer','Poisoned Wind Globadiers':'Poisoned_Wind_Globadier','Temple Guard':'Temple_Guard','Terradon Riders':'Terradon_Rider','Ripperdactyl Riders':'Ripperdactyl_Rider','Cold One Riders':'Cold_One_Rider','Jungle Swarms':'Jungle_Swarm','Chameleon Skinks':'Chameleon_Skink','Saurus Warriors':'Saurus_Warrior','Glade Riders':'Glade_Rider','Wild Riders':'Wild_Rider','Warhawk Riders':'Warhawk_Rider','Waywatchers':'Waywatcher','Tree Kin':'Tree_Kin','Blood Knights':'Blood_Knight','Black Knights':'Black_Knight','Grave Guard':'Grave_Guard','Crypt Ghouls':'Crypt_Ghoul','Dire Wolves':'Dire_Wolf','Fell Bats':'Fell_Bat','Spirit Hosts':'Spirit_Host','Bat Swarms':'Bat_Swarm','Crypt Horrors':'Crypt_Horror','Hobgoblin Wolf Riders':'Hobgoblin_Wolf_Rider','Sneaky Gits':'Hobgoblin_Sneaky_Git'}

def clean_name(name):return re.sub(r'\s*\{[^{}]*\}\s*',' ',name).strip()
def title(value):return value.replace(' ','_')
def candidates(name,faction):
 n=clean_name(name);values=[ALIASES.get((faction,n)),GLOBAL.get(n),title(n)]
 # Army-specific descriptors are retained unless an established alias says otherwise.
 if n.endswith('ies'):values.append(title(n[:-3]+'y'))
 if n.endswith('men'):values.append(title(n[:-3]+'man'))
 if n.endswith('s') and not n.endswith(('ss','us')):values.append(title(n[:-1]))
 if n.startswith('Daemonic Herald of '):values.insert(0,title(n.replace('Daemonic Herald','Herald')))
 if n.startswith('Soul Grinder of '):values.insert(0,'Soul_Grinder')
 if n.startswith('Chaos Furies'):values.insert(0,'Chaos_Fury')
 for suffix in [' of Khorne',' of Nurgle',' of Tzeentch',' of Slaanesh']:
  if n.endswith(suffix):
   stem=n[:-len(suffix)];values.extend([title(stem),title(stem[:-1] if stem.endswith('s') else stem)])
 return list(dict.fromkeys(v for v in values if v))

def fetch(url,cache,suffix):
 key=hashlib.sha256(url.encode()).hexdigest();path=cache/(key+suffix)
 if path.exists():return path.read_bytes()
 marker=cache/(key+'.missing')
 if marker.exists():return None
 try:
  global NEXT_REQUEST,NETWORK_PAUSED,RATE_LIMITED
  with RATE_LOCK:
   if NETWORK_PAUSED:return None
   delay=max(0.0,NEXT_REQUEST-time.monotonic())
   NEXT_REQUEST=max(NEXT_REQUEST,time.monotonic())+REQUEST_INTERVAL
  if delay:time.sleep(delay)
  if NETWORK_PAUSED:return None
  req=urllib.request.Request(url,headers={'User-Agent':UA})
  with urllib.request.urlopen(req,timeout=18) as response:body=response.read()
  path.write_bytes(body);return body
 except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,OSError) as error:
  # Stop network work on rate limiting. Re-run later at the configured pace;
  # do not turn a temporary denial into a cached missing image or bypass it.
  if isinstance(error,urllib.error.HTTPError) and error.code==429:
   with RATE_LOCK:NETWORK_PAUSED=True;RATE_LIMITED=True
   retry_after=error.headers.get('Retry-After')
   try:
    seconds=max(1,float(retry_after))
   except (ValueError,TypeError):
    try:seconds=max(1,parsedate_to_datetime(retry_after).timestamp()-time.time())
    except (ValueError,TypeError,AttributeError):seconds=60
   (cache/'rate-limit.json').write_text(json.dumps({'retryAfter':retry_after,'retryAfterUntil':time.time()+seconds}))
   print(json.dumps({'networkPaused':True,'reason':'HTTP 429','retryAfter':retry_after,'cooldownSeconds':seconds}),flush=True)
  if isinstance(error,urllib.error.HTTPError) and error.code in [404,410]:marker.write_text(str(error.code))
  return None

def image_candidates(page,page_url):
 found=[]
 boxes=re.findall(r'<li class="gallerybox".*?</li>',page,re.S)
 # A few unit pages use a representative miniature thumb instead of a gallery.
 boxes.extend(re.findall(r'<img\b[^>]*>',page,re.S))
 for box in boxes:
  img=re.search(r'<img\b[^>]*\bsrc="([^"]+)"',box)
  if not img:continue
  path=html.unescape(img.group(1));filename=urllib.parse.unquote(path.split('/')[-2] if '/thumb/' in path else path.split('/')[-1])
  if not re.search(r'_M\d+(?:_[A-Za-z0-9_-]+)?\.(?:jpe?g|png|webp)$',filename,re.I):continue
  if re.search(r'^(?:WM|EPIC|Blood_Bowl)_',filename,re.I):continue
  caption=re.search(r'<div class="gallerytext">(.*?)</div>',box,re.S)
  caption=html.unescape(re.sub('<[^>]+>',' ',caption.group(1) if caption else ''))
  caption=' '.join(caption.split())
  if re.search(r'Warmaster|Blood Bowl|Total War|Age of Sigmar|Warcry',caption,re.I):continue
  if '/thumb/' in path:
   path=path.replace('/images/thumb/','/images/').rsplit('/',1)[0]
  url=urllib.parse.urljoin(BASE,path)
  if not url.startswith(BASE+'/mediawiki/images/'):continue
  stem=page_url.rsplit('/',1)[-1].replace('_',' ').lower()
  score=10 if re.search(r'W:TOW|Old World',caption,re.I) else 0
  if re.search(r'command|champion|standard|musician',filename+' '+caption,re.I):score-=4
  if re.search(r'\b[1-5](?:st|nd|rd|th) (?:Ed|Edition)',caption,re.I):score-=2
  if any(word in filename.lower().replace('_',' ') for word in stem.split() if len(word)>4):score+=2
  found.append({'fileUrl':url,'sourceUrl':page_url,'caption':caption or re.sub(r'_M\d+\.[^.]+$','',filename).replace('_',' '),'credit':'Miniature photograph via Warhammer Fantasy Lexicanum; original rights remain with the credited owner.','score':score})
 seen=set();out=[]
 for item in sorted(found,key=lambda x:-x['score']):
  if item['fileUrl'] in seen:continue
  seen.add(item['fileUrl']);out.append(item)
 return out

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--roster',help='Optional canonical faction/name roster JSON; defaults to repository army datasets');parser.add_argument('--cache',default=str(Path(tempfile.gettempdir())/'tow-unit-photo-cache'));parser.add_argument('--workers',type=int,default=6);parser.add_argument('--max-photos',type=int,default=2);parser.add_argument('--requests-per-second',type=float,default=1);parser.add_argument('--offline',action='store_true',help='Use only previously cached articles and images');parser.add_argument('--allow-legacy-sources',action='store_true',help='Explicitly allow rebuilding the archived third-party-source catalogue');args=parser.parse_args()
 if not args.allow_legacy_sources:raise SystemExit('Use build-official-unit-photo-catalog.py for the current official-source gallery. Archived third-party rebuilding requires --allow-legacy-sources.')
 global REQUEST_INTERVAL,NETWORK_PAUSED,RATE_LIMITED
 NETWORK_PAUSED=args.offline
 REQUEST_INTERVAL=1/max(0.1,min(args.requests_per_second,1))
 cache=Path(args.cache);cache.mkdir(parents=True,exist_ok=True);output=ROOT/'dist/unit-photo-images';output.mkdir(parents=True,exist_ok=True)
 if (cache/'rate-limit.json').exists():
  limit=json.loads((cache/'rate-limit.json').read_text())
  if limit.get('retryAfterUntil',0)>time.time():
   NETWORK_PAUSED=True;RATE_LIMITED=True
   print(json.dumps({'networkPaused':True,'reason':'Retry-After cooldown still active','retryAfterUntil':limit['retryAfterUntil']}),flush=True)
 if args.roster:
  roster=json.loads(Path(args.roster).read_text())
 else:
  roster={}
  data_dir=ROOT/'dist/data/games/the-old-world'
  for army_file in sorted(data_dir.glob('*.json'))+sorted((data_dir/'1.5').glob('*.json')):
   army=json.loads(army_file.read_text());names=[unit['name_en'] for category in ['characters','core','special','rare','mercenaries'] for unit in army.get(category,[]) if isinstance(unit,dict) and unit.get('name_en')]
   if names:roster.setdefault(army_file.stem,[]).extend(names)
 units=list(dict.fromkeys((faction,name) for faction,names in roster.items() for name in names));unit_candidates={(f,n):candidates(n,f) for f,n in units}
 review_path=ROOT/'scripts/reviewed-unit-photos.json'
 reviews=json.loads(review_path.read_text()) if review_path.exists() else {'bindings':[]}
 reviewed={(item['faction'],clean_name(item['name'])):item['photos'] for item in reviews['bindings']}
 all_pages={};selected={key:reviewed[(key[0],clean_name(key[1]))] for key in units if (key[0],clean_name(key[1])) in reviewed}
 rejected=[]
 for phase in range(4):
  todo=list(dict.fromkeys(values[phase] for key,values in unit_candidates.items() if key not in selected and len(values)>phase))
  def page_task(p):
   url=BASE+'/wiki/'+urllib.parse.quote(p,safe="_'-()")
   body=fetch(url,cache,'.html')
   if not body:return p,[]
   return p,image_candidates(body.decode('utf-8','replace'),url)
  with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
   for i,(p,images) in enumerate(pool.map(page_task,todo),1):
    all_pages[p]=images
    if i%50==0:print(json.dumps({'phase':phase+1,'pages':i,'totalPages':len(todo)}),flush=True)
  for key,values in unit_candidates.items():
   if key in selected:continue
   for p in values[:phase+1]:
    approved=[]
    for photo in all_pages.get(p,[]):
     verdict=verify_photo(key[0],key[1],photo)
     if verdict['approved']:approved.append(photo)
     else:rejected.append({'faction':key[0],'name':key[1],'fileUrl':photo['fileUrl'],'reason':verdict['reason']})
    if approved:selected[key]=approved;break
  print(json.dumps({'phase':phase+1,'matchedUnits':len(selected),'unitEntries':len(units),'pagesThisPhase':len(todo)}),flush=True)
 unique_images={item['fileUrl']:item for photos in selected.values() for item in photos[:args.max_photos+2]}
 photo_files={}
 def download(item):
  fileurl=item['fileUrl'];digest=hashlib.sha256(fileurl.encode()).hexdigest()[:20];dest=output/(digest+'.webp')
  try:
   if dest.exists():
    with Image.open(dest) as image:width,height=image.size
   else:
    data=fetch(fileurl,cache,'.image')
    if not data:return fileurl,None
    with Image.open(BytesIO(data)) as original:
     image=ImageOps.exif_transpose(original).convert('RGBA' if 'A' in original.getbands() else 'RGB');image.thumbnail((900,900),Image.Resampling.LANCZOS);width,height=image.size;image.save(dest,'WEBP',quality=82,method=5)
   if min(width,height)<70:return fileurl,None
   return fileurl,{'src':'./unit-photo-images/'+dest.name,'width':width,'height':height,**{k:v for k,v in item.items() if k!='score'}}
  except (OSError,ValueError):return fileurl,None
 with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
  for i,(url,entry) in enumerate(pool.map(download,unique_images.values()),1):
   if entry:photo_files[url]=entry
   if i%50==0:print(json.dumps({'imagesProcessed':i,'imagesTotal':len(unique_images),'validImages':len(photo_files)}),flush=True)
 entries=[];missing=[];matched=0
 for faction,name in units:
  photos=[]
  choices=selected.get((faction,name),[])
  reviewed_urls={photo['fileUrl'] for photo in reviewed.get((faction,clean_name(name)),[])}
  for photo in choices:
   if photo['fileUrl'] in photo_files:
    item=dict(photo_files[photo['fileUrl']])
    for field in ['caption','sourceUrl','fileUrl','credit']:item[field]=photo[field]
    if photo['fileUrl'] in reviewed_urls:
     identity={**photo['identity'],'approved':True,'faction':faction,'unit':clean_name(name),'policyVersion':1}
    else:
     verdict=verify_photo(faction,name,photo)
     if not verdict['approved']:continue
     identity={'approved':True,'faction':faction,'unit':clean_name(name),'method':'exact-unit-name','evidence':verdict['matchedLabel'],'policyVersion':1}
    item['identity']=identity;photos.append(item)
   if len(photos)>=args.max_photos:break
  if photos:matched+=1
  else:
   diagnostics=[]
   for page in unit_candidates[(faction,name)]:
    url=BASE+'/wiki/'+urllib.parse.quote(page,safe="_'-()");key=hashlib.sha256(url.encode()).hexdigest()
    state='no-miniature-gallery' if (cache/(key+'.html')).exists() else ('HTTP '+(cache/(key+'.missing')).read_text() if (cache/(key+'.missing')).exists() else 'unavailable-or-rate-limited')
    diagnostics.append({'page':page,'status':state})
   missing.append({'faction':faction,'name':name,'tried':diagnostics})
  entries.append({'name':name,'faction':faction,'aliases':[clean_name(name)] if clean_name(name)!=name else [],'photos':photos})
 # One photograph must not silently stand in for distinct units in the same army.
 owners={}
 photo_hashes={photo['src']:hashlib.sha256((ROOT/'dist'/photo['src']).read_bytes()).hexdigest() for entry in entries for photo in entry['photos']}
 for entry in entries:
  for photo in entry['photos']:owners.setdefault((entry['faction'],photo_hashes[photo['src']]),set()).add(clean_name(entry['name']).casefold())
 ambiguous={key for key,names in owners.items() if len(names)>1}
 for entry in entries:
  entry['photos']=[photo for photo in entry['photos'] if (entry['faction'],photo_hashes[photo['src']]) not in ambiguous]
 matched=sum(bool(entry['photos']) for entry in entries)
 missing=[{'faction':entry['faction'],'name':entry['name'],'reason':'No independently identified unit photograph'} for entry in entries if not entry['photos']]
 (cache/'identity-rejections.json').write_text(json.dumps({'rejected':rejected,'ambiguousSameArmyPhotos':len(ambiguous)},ensure_ascii=False,indent=2)+'\n')
 used={photo['src'].rsplit('/',1)[-1] for entry in entries for photo in entry['photos']}
 for p in output.glob('*.webp'):
  if p.name not in used:p.unlink()
 counts={'entries':len(entries),'withPhotos':matched,'withoutPhotos':len(missing),'images':len(used),'imageBytes':sum(p.stat().st_size for p in output.glob('*.webp')),'factions':len(roster),'networkPaused':RATE_LIMITED,'offlineBuild':args.offline}
 data={'schemaVersion':2,'identityPolicyVersion':1,'source':'Reviewed Warhammer Community photographs and individually matched Lexicanum miniature photographs','checkedAt':'2026-11-04','entries':entries,'counts':counts}
 (ROOT/'dist/data/unit-photos.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');(cache/'missing-units.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'complete':True,**counts}),flush=True)

if __name__=='__main__':main()
