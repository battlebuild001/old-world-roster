"""Match a roster unit to a current official shop product, without network I/O.

The product title and army facet establish the kit identity. Multi-build kits
also require the selected image filename to isolate the requested build. This
module never treats another rank, a renamed AoS unit or an army box as a proxy.
"""
from __future__ import annotations
import html
import re
from urllib.parse import unquote, urlsplit

from photo_identity import clean_name, tokens, SAFE_LABELS, FACTION_LABELS

METHOD = 'official-product-title-and-image'
SHOP = 'https://www.warhammer.com/en-GB/shop/'
IMAGE_BASE = 'https://www.warhammer.com'
TOW_ARMIES = {
    'kingdom-of-bretonnia':['Kingdom Of Bretonnia'],
    'dwarfen-mountain-holds':['Dwarfen Mountain Holds'],
    'empire-of-man':['Empire of Man'], 'high-elf-realms':['High Elf Realms'],
    'warriors-of-chaos':['Warriors of Chaos'], 'beastmen-brayherds':['Beastmen Brayherds'],
    'wood-elf-realms':['Wood Elf Realms'], 'orc-and-goblin-tribes':['Orc and Goblin Tribes'],
    'tomb-kings-of-khemri':['Tomb Kings Of Khemri'], 'grand-cathay':['Grand Cathay'],
    'vampire-counts':['Vampire Counts'], 'dark-elves':['Dark Elves'],
    'chaos-dwarfs':['Chaos Dwarfs'], 'daemons-of-chaos':['Daemons of Chaos'],
    'skaven':['Skaven'], 'lizardmen':['Lizardmen'], 'ogre-kingdoms':['Ogre Kingdoms'],
    'renegade-crowns':['Renegade Crowns'],
}
# Specific official legacy army/faction facets, never the broad Grand Alliance.
AOS_ARMIES = {
    'skaven':['Skaven'], 'lizardmen':['Seraphon'], 'ogre-kingdoms':['Ogor Mawtribes'],
    'vampire-counts':['Soulblight Gravelords','Flesh-eater Courts','Nighthaunt'],
    'warriors-of-chaos':['Slaves to Darkness'], 'beastmen-brayherds':['Beasts of Chaos'],
    'daemons-of-chaos':['Chaos Daemons','Blades of Khorne','Maggotkin of Nurgle','Disciples of Tzeentch','Hedonites of Slaanesh'],
    'wood-elf-realms':['Sylvaneth','Wanderers'],
    'dark-elves':['Darkling Covens','Order Serpentis','Scourge Privateers','Daughters of Khaine'],
    'dwarfen-mountain-holds':['Dispossessed'],
    'high-elf-realms':['Phoenix Temple'],
    'orc-and-goblin-tribes':['Gloomspite Gitz','Orruk Warclans'],
}
PREFIXES = {
    'kingdom-of-bretonnia':['Bretonnian','Kingdom of Bretonnia'],
    'dwarfen-mountain-holds':['Dwarf','Dwarfen'], 'empire-of-man':['Empire','Imperial'],
    'high-elf-realms':['High Elf','Elven'], 'wood-elf-realms':['Wood Elf'],
    'dark-elves':['Dark Elf'], 'ogre-kingdoms':['Ogre'],
    'skaven':['Skaven'], 'tomb-kings-of-khemri':['Tomb Kings','Tomb Kings of Khemri'],
    'warriors-of-chaos':['Warriors of Chaos'], 'grand-cathay':['Grand Cathay','Cathayan'],
}
EXTRA_LABELS = {
    ('skaven','Rat Ogres'):['Rat Ogors'],
    ('kingdom-of-bretonnia','Mounted Knights of the Realm'):['Knights of the Realm'],
    ('kingdom-of-bretonnia','Knights Errant'):['Knights Errant'],
    ('dwarfen-mountain-holds','Gyrocopters'):['Gyrocopter'],
}
TITLE_TAIL = set(tokens('daemonic demonic mount chariot zombie bone necrolith warhorse elven barded winged bull eagle imperial shieldbearers star sun moon command group with armed wielding equipped hand great weapon sword axe spear halberd shield handgun pistol battle standard bearer musician champion regiment unit herd mob on mounted foot horse steed pegasus royal dragon chaos griffon griffin manticore carnosaur wyvern oathstone panther knight white wolf storm'))
MOUNT_CONTEXT = set(tokens('daemonic demonic mount chariot zombie bone necrolith warhorse elven barded winged bull eagle imperial shieldbearers star sun moon on mounted foot horse steed pegasus royal dragon chaos griffon griffin manticore carnosaur wyvern oathstone'))
# A troop-name alias such as Goblin must never turn foot infantry into a
# Goblin Wolf Chariot. Only these reviewed character identities may acquire
# a mount suffix from an official product title.
CHARACTER_MOUNT_UNITS = {
    'dwarfen-mountain-holds': {'King', 'Thane'},
    'empire-of-man': {'General of the Empire', 'Captain of the Empire', 'Grand Master'},
    'high-elf-realms': {'Prince', 'Noble', 'Mage', 'Archmage', 'Dragon Mage'},
    'lizardmen': {'Saurus Oldblood', 'Saurus Scar-Veteran', 'Skink Chief', 'Skink Priest'},
    'orc-and-goblin-tribes': {'Orc Warboss', 'Orc Bigboss', 'Black Orc Warboss', 'Goblin Warboss', 'Goblin Bigboss', 'Night Goblin Warboss', 'Night Goblin Bigboss'},
    'tomb-kings-of-khemri': {'Tomb King', 'Tomb Prince', 'Liche Priest', 'High Priest', 'Mortuary Priest'},
    'warriors-of-chaos': {'Chaos Lord', 'Sorcerer Lord', 'Exalted Sorcerer', 'Exalted Champion', 'Aspiring Champion'},
    'dark-elves': {'Dark Elf Dreadlord', 'Dark Elf Master', 'Supreme Sorceress', 'Sorceress'},
    'vampire-counts': {'Vampire Lord', 'Wight King', 'Master Necromancer'},
    'wood-elf-realms': {'Glade Lord', 'Glade Captain', 'Spellweaver', 'Spellsinger'},
}
# These kits can show both alternative builds in one photograph even when
# the store gives the product a single-build title.
ALTERNATIVE_BUILD_FAMILIES = ({'gyrocopter', 'gyrobomber'},)
SENSITIVE = {'chosen','veteran','ancient','venerable','aspiring','exalted','supreme','archer','crossbowman','handgunner','missile','blunderbuss','brimstone','pink','blue','foot','mounted','skirmisher','cohort','scout'}
GODS = {'khorne','nurgle','tzeentch','slaanesh'}
BOX = re.compile(r'\b(?:battalion|battleforce|spearhead|vanguard|army reinforcement|army set|army box|battle group|battlehost|combat patrol|core set|starter set|collection|dice|transfer sheet|terrain)\b',re.I)
BAD_IMAGE = re.compile(r'threesixty|sprue|transfer|unpainted|box(?:ed|art|set|front|back)|packaging|backdrop|instructions?|component|\.(?:pdf|gif)$',re.I)


def plain(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]*>', ' ', str(value or ''))).split())


def key(value):
    return ' '.join(tokens(value))


def facet_data(product):
    tree=product.get('GameSystemsRoot') or product.get('facets') or {}
    flat=[]
    if isinstance(tree,dict):
        for values in tree.values():
            flat.extend(values if isinstance(values,list) else [values])
    elif isinstance(tree,list):
        flat.extend(tree)
    segments=[part.strip() for value in flat if isinstance(value,str) for part in value.split('>') if part.strip()]
    games=tree.get('lvl0',[]) if isinstance(tree,dict) else []
    if isinstance(games,str):games=[games]
    if not games:games=product.get('gameSystems',[])
    if isinstance(games,str):games=[games]
    if not games:games=list(dict.fromkeys(value.split('>')[0].strip() for value in flat if isinstance(value,str)))
    return list(dict.fromkeys(games)),segments


def unit_labels(faction,unit):
    labels=[unit]+SAFE_LABELS.get(unit.lower(),[])+FACTION_LABELS.get(faction,{}).get(unit,[])+EXTRA_LABELS.get((faction,unit),[])
    if ' of ' in unit:
        base,_,god=unit.rpartition(' of ')
        if god.lower() in GODS and not any(word in key(base).split() for word in ['herald','grinder','fury']):
            labels.append(base)
    if unit.startswith('Daemonic Herald of '):labels.append(unit.replace('Daemonic Herald','Herald',1))
    return list(dict.fromkeys(label for label in labels if label))


def title_components(title):
    parts=[part.strip() for part in re.split(r'\s*(?:/|&|\bor\b|\band\b)\s*',title,flags=re.I) if part.strip()]
    # "Blue & Brimstone Horrors" shares a noun, not an arbitrary unit identity.
    if len(parts)>1:
        last=tokens(parts[-1])
        if len(last)>1:
            noun=last[-1]
            parts=[part+' '+noun if noun=='horror' and key(part) in {'blue','pink','brimstone'} else part for part in parts]
    return parts or [title]


def component_match(faction,component,labels,unit=None):
    words=tokens(component)
    choices=[words]
    # The first comma-delimited part can be an explicitly named character.
    if ',' in component:choices.append(tokens(component.split(',',1)[0]))
    for prefix in PREFIXES.get(faction,[]):
        p=tokens(prefix)
        if words[:len(p)]==p:choices.append(words[len(p):])
    for label in labels:
        target=tokens(label)
        for value in choices:
            if value==target:return label
            tail=value[len(target):]
            if value[:len(target)]==target and tail and all(word in TITLE_TAIL for word in tail):
                if set(tail)&MOUNT_CONTEXT and unit not in CHARACTER_MOUNT_UNITS.get(faction,set()):continue
                return label
    return None


def image_info(value):
    if not isinstance(value,str):return None
    url=IMAGE_BASE+value if value.startswith('/app/resources/catalog/product/') else value
    try:
        parsed=urlsplit(url)
        if parsed.scheme!='https' or parsed.hostname not in {'www.warhammer.com','static.warhammer.com'} or parsed.username or parsed.password:return None
        if '/app/resources/catalog/product/920x950/' not in parsed.path or not re.search(r'\.(?:jpe?g|png|webp)$',parsed.path,re.I):return None
        filename=unquote(parsed.path.rsplit('/',1)[-1])
        if BAD_IMAGE.search(filename):return None
        stem=re.sub(r'^\d+[_-]*','',filename.rsplit('.',1)[0])
        stem=re.sub(r'(?<=[A-Za-z])\d+[a-z]?$', '', stem)
        stem=re.sub(r'([A-Z]+)([A-Z][a-z])',r'\1 \2',stem)
        return {'fileUrl':url,'filename':filename,'words':tokens(stem)}
    except ValueError:return None


def contains(words,part):
    words=[word for word in words if word not in {'on','with','in'}]
    part=[word for word in part if word not in {'on','with','in'}]
    return bool(part) and any(words[i:i+len(part)]==part for i in range(len(words)-len(part)+1))


def match_product(faction,unit,product):
    unit=clean_name(unit)
    result={'approved':False,'reason':'unmatched','unit':unit,'faction':faction,'photos':[]}
    def reject(reason):return {**result,'reason':reason}
    if not isinstance(product,dict) or not unit or not isinstance(faction,str) or faction not in TOW_ARMIES:return reject('invalid-input')
    name=plain(product.get('name'));slug=str(product.get('slug') or '')
    if not name or not re.fullmatch(r'[a-zA-Z0-9_-]+',slug):return reject('missing-product-identity')
    if product.get('productType')!='miniatureKit':return reject('not-a-miniature-kit')
    if BOX.search(name):return reject('army-box-or-nonunit-product')
    if faction=='kingdom-of-bretonnia' and unit in {'Duke','Baron','Paladin'}:return reject('requires-reviewed-character-build')
    games,segments=facet_data(product);segment_keys={key(x) for x in segments}
    is_tow='The Old World' in games
    allowed=TOW_ARMIES.get(faction,[]) if is_tow else AOS_ARMIES.get(faction,[]) if 'Age of Sigmar' in games else []
    matched_facet=next((facet for facet in allowed if key(facet) in segment_keys),None)
    if not matched_facet:return reject('wrong-or-unproven-army-facet')
    labels=unit_labels(faction,unit);parts=title_components(name)
    matched=[]
    for index,part in enumerate(parts):
        label=component_match(faction,part,labels,unit)
        if label:matched.append((index,part,label))
    if len(matched)!=1:return reject('product-title-does-not-identify-unit')
    index,part,label=matched[0]
    description=plain(product.get('description'))
    mounted='mounted' in tokens(unit)
    foot='foot' in tokens(unit)
    mounted_proof=bool(re.search(r'\bbuilds?\b[^.]{0,200}\bmounted\b',description,re.I))
    if mounted and 'mounted' not in tokens(name) and not mounted_proof:return reject('mounted-build-not-explicit')
    if foot and 'foot' not in tokens(part):return reject('foot-build-not-explicit')
    selected_tokens=set(tokens(label));unit_tokens=set(tokens(unit))
    other_parts=[set(tokens(p)) for i,p in enumerate(parts) if i!=index]
    # A suffix mount can be shared by both builds: Tomb King/Liche Priest on
    # Necrolith Bone Dragon. The other rank, not that shared mount, isolates it.
    other_markers=set().union(*(p-selected_tokens-MOUNT_CONTEXT for p in other_parts)) if other_parts else set()
    source_url=SHOP+slug
    candidates=[info for value in product.get('images',[]) if (info:=image_info(value))]
    if not candidates:return reject('no-official-painted-image')
    chosen=None;image_label=None
    for position,info in enumerate(candidates):
        evidence=set(info['words'])
        if any(len(evidence&family)>1 for family in ALTERNATIVE_BUILD_FAMILIES):continue
        if evidence&other_markers:continue
        if evidence&GODS and unit_tokens&GODS and evidence&GODS != unit_tokens&GODS:continue
        unexpected=(evidence&SENSITIVE)-(unit_tokens|selected_tokens)
        if unexpected:continue
        if foot and 'foot' not in evidence:continue
        if mounted and 'foot' in evidence:continue
        # Unit-specific filename is mandatory for multi-build/identity-sensitive
        # variants. A plain single-unit kit can use its first painted hero shot.
        image_label=next((candidate for candidate in labels if contains(info['words'],tokens(candidate))),None)
        if len(parts)>1 and not image_label:continue
        sensitive=bool((unit_tokens|selected_tokens)&(SENSITIVE-{'mounted'}))
        if sensitive and not image_label:continue
        if not image_label and position!=0:continue
        chosen=info;break
    if not chosen:return reject('no-image-isolates-requested-build')
    product_id=str(product.get('objectID') or product.get('sku') or '')
    proof={'method':METHOD,'matchedUnit':unit,'unitLabel':label,'productTitle':name,'productId':product_id,'sku':str(product.get('sku') or ''),'imageFilename':chosen['filename'],'factionFacet':matched_facet,'gameSystems':games,'variantTitle':part,'mountedBuildConfirmed':mounted_proof}
    evidence=f'Official product: {name}; image: {chosen["filename"]}; army: {matched_facet}; systems: {", ".join(games)}'
    identity={'approved':True,'unit':unit,'faction':faction,'method':METHOD,'policyVersion':2,'evidence':evidence,'proofUrl':source_url}
    photo={'fileUrl':chosen['fileUrl'],'sourceUrl':source_url,'title':name,'caption':name,'credit':'Games Workshop · official Warhammer product photograph','proof':proof,'identity':identity,'gameSystems':games,'legacyReference':not is_tow}
    year_match=re.search(r'(20\d{2})(?:[-_]|$)',slug)
    return {**result,'approved':True,'reason':'official-title-army-and-build-match','productName':name,'slug':slug,'productId':product_id,'gameSystems':games,'legacyReference':not is_tow,'productYear':int(year_match.group(1)) if year_match else None,'photos':[photo]}
