"""Conservative, offline per-image identity verification for miniature photos.

An article is a search hint, never evidence that every picture on it depicts the
requested unit. Rules ranks, mount modes, weapon troop types and Chaos gods are
kept distinct. Reviewed per-file overrides belong to the caller, outside this
automatic gate.
"""
from __future__ import annotations
import html
import re
import unicodedata
from urllib.parse import unquote, urlsplit

POLICY_VERSION = 1

# Finite same-unit spelling or established troop-name synonyms. These are not
# higher/lower ranks, chosen/veteran units, different mounts or generic heroes.
SAFE_LABELS = {
    'elven spearmen': ['High Elf Spearman'],
    'elven archers': ['High Elf Archer'],
    'swordmasters of hoeth': ['Swordmaster'],
    'white lions of chrace': ['White Lion'],
    'eagle-claw bolt thrower': ['Eagle Claw Repeater Bolt Thrower', "Eagle's Claw Repeater Bolt Thrower"],
    'dark elf dreadlord': ['Dreadlord'],
    'khainite assassin': ['Dark Elf Assassin'],
    'repeater crossbowmen': ['Dark Elf Crossbowman'],
    'har ganeth executioners': ['Executioner'],
    'black guard of naggarond': ['Black Guard'],
    'dark elf shades': ['Shade'],
    'storm weaver': ['Stormweaver'],
    'gor herd': ['Gor'], 'gors': ['Gor'],
    'ungor herd': ['Ungor'], 'ungors': ['Ungor'],
    'bestigor herd': ['Bestigor'], 'minotaur herd': ['Minotaur'],
    'razorgor herd': ['Razorgor'], 'centigor herd': ['Centigor'],
    'orc mob': ['Orc Boy', 'Orc Boyz'],
    'black orc mob': ['Black Orc'], 'goblin mob': ['Goblin'],
    'night goblin mob': ['Night Goblin'], 'snotling mob': ['Snotling'],
    'common troll mob': ['Common Troll', 'Troll'],
    'river troll mob': ['River Troll'], 'stone troll mob': ['Stone Troll'],
    'goblin wolf rider mob': ['Goblin Wolf Rider'],
    'goblin spider rider mob': ['Forest Goblin Spider Rider', 'Goblin Spider Rider'],
    'orc boar boy mob': ['Orc Boar Boy'],
    'night goblin squig herd': ['Squig Herd'],
    'night goblin squig hopper mob': ['Squig Hopper'],
    'goblin bolt throwa': ['Goblin Spear Chukka', 'Spear Chukka'],
    'goblin rock lobber': ['Rock Lobber'],
    'free company militia': ['Free Company', 'Militia Fighter'],
    'empire archers': ['Empire Archer', 'Human Archer'],
    'empire greatswords': ['Greatsword'],
    'great cannon': ['Empire Great Cannon'],
    'mortar': ['Empire Mortar'],
    'dwarf warriors': ['Dwarf Warrior'], 'rangers': ['Dwarf Ranger'],
    'engineer': ['Dwarf Engineer'], 'thane': ['Dwarf Thane'],
    'cannon': ['Dwarf Cannon'], 'bolt thrower': ['Dwarf Bolt Thrower'],
    'royal herald': ['Tomb Herald'],
    'necrolith colossus': ['Bone Giant'],
    'gnoblar fighters': ['Gnoblar Fighter'],
    'salamander pack': ['Salamander Hunting Pack', 'Salamander'],
    'razordon pack': ['Razordon Hunting Pack', 'Razordon'],
    'chaos furies': ['Chaos Fury', 'Fury'],
}
FACTION_LABELS = {
    'warriors-of-chaos': {'Sorcerer Lord': ['Chaos Sorcerer Lord'], 'Exalted Sorcerer': ['Chaos Exalted Sorcerer'], 'Exalted Champion': ['Chaos Exalted Champion'], 'Aspiring Champion': ['Chaos Aspiring Champion']},
    'dwarfen-mountain-holds': {'King': ['Dwarf King']},
    'ogre-kingdoms': {'Hunter': ['Ogre Hunter']},
    'high-elf-realms': {'Prince': ['High Elf Prince'], 'Noble': ['High Elf Noble'], 'Mage': ['High Elf Mage'], 'Archmage': ['High Elf Archmage']},
    'vampire-counts': {'Skeleton Warriors': ['Vampire Counts Skeleton Warrior', 'Undead Skeleton Warrior']},
    'tomb-kings-of-khemri': {'Skeleton Warriors': ['Tomb King Skeleton Warrior', 'Tomb Kings Skeleton Warrior']},
}
# Modifiers following an identified unit can describe a real weapon, mount,
# command model or edition. New unit/rank words are intentionally absent.
CONTEXT = set('with armed wielding equipped on riding mounted horse steed pegasus dragon taurus manticore griffon griffin unicorn great weapon halberd spear hand sword axe hammer bow crossbow repeater handgun pistol shield standard bearer battle command champion musician unit regiment model miniature plastic metal resin kit classic edition citadel games workshop old world tow w painted pair red blue green yellow metal plastic box set foot dismounted carnosaur zombie griffon wyvern oathstone lance flail additional two handed 4th 5th 6th 7th 8th'.split())
RANK_MARKERS = {'chosen', 'veteran', 'ancient', 'venerable', 'exalted', 'aspiring', 'supreme', 'arch', 'lord', 'king', 'duke', 'baron', 'paladin', 'chief', 'chieftain', 'warboss', 'bigboss', 'acolyte', 'sapper', 'cohort', 'skirmisher', 'scout', 'brimstone', 'pink', 'blue', 'flamespyre', 'frostheart', 'shaggoth', 'bestigor', 'chameleon'}
GODS = {'khorne', 'nurgle', 'tzeentch', 'slaanesh'}
SINGULAR = {'men':'man','spearmen':'spearman','bowmen':'bowman','crossbowmen':'crossbowman','horsemen':'horseman','yeomen':'yeoman','swordsmen':'swordsman','beastmen':'beastman','furies':'fury','knives':'knife','wolves':'wolf'}


def clean_name(name):
    return re.sub(r'\s*\{[^{}]*\}\s*', ' ', str(name or '')).strip()


def tokens(value):
    value = html.unescape(unicodedata.normalize('NFKC', str(value or '')))
    value = value.split('·', 1)[0]  # Never treat added "reference" captions as proof.
    value = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', value)
    value = value.replace('’', "'").replace('‘', "'")
    value = re.sub(r"\b([A-Za-z]+)'s\b", r'\1', value)
    words = re.findall(r'[a-z0-9]+', value.lower().replace('bigboss','big boss'))
    result = []
    for word in words:
        if word in {'a','an','the','of'} or re.fullmatch(r'\d+(?:st|nd|rd|th)?', word):
            continue
        if word in SINGULAR:
            word = SINGULAR[word]
        elif word.endswith('s') and len(word)>3 and word not in {'chaos','arms'} and not word.endswith(('ss','us','is')):
            word = word[:-1]
        result.append(word)
    return result


def file_label(photo):
    try:
        parsed = urlsplit(str(photo.get('fileUrl') or ''))
        if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password:
            return ''
        name = unquote(parsed.path.rsplit('/',1)[-1])
        name = re.sub(r'_M\d+[^.]*\.[^.]+$', '', name, flags=re.I)
        return name
    except (ValueError, TypeError):
        return ''


def label_match(words, label, context):
    if not words or not label:
        return False
    # A caption may start with these ordinary descriptions or a brand name.
    candidates = [words]
    for prefix in [('regiment',), ('line',), ('model',), ('miniature',), ('citadel',), ('games','workshop')]:
        if tuple(words[:len(prefix)]) == prefix:
            candidates.append(words[len(prefix):])
    for candidate in candidates:
        if candidate[:len(label)] == label and all(word in context for word in candidate[len(label):]):
            return True
    return False


def verify_photo(faction, name, photo):
    unit = clean_name(name)
    def verdict(approved, reason, matched=None):
        return {'approved': approved, 'reason': reason, 'matchedLabel': matched, 'policyVersion': POLICY_VERSION, 'unit': unit, 'faction': faction, 'method': 'explicit-image-label' if approved else None}
    if not isinstance(photo, dict) or not unit or not isinstance(faction,str):
        return verdict(False, 'invalid-identity-input')
    filename = file_label(photo)
    caption = str(photo.get('caption') or '').split('·',1)[0]
    fields = [('filename', tokens(filename)), ('caption', tokens(caption))]
    evidence = set(word for _, words in fields for word in words)
    name_words = tokens(unit)
    target = set(name_words)
    if not filename:
        return verdict(False, 'missing-or-unsafe-file-identity')
    if re.search(r'Warmaster|Blood Bowl|Total War|Age of Sigmar|Mordheim', filename+' '+caption, re.I):
        return verdict(False, 'different-game-or-scale')
    if unit == 'Hunter' and faction == 'ogre-kingdoms' and evidence & {'human','elf','elven','empire','talabheim'}:
        return verdict(False, 'wrong-generic-unit-faction')
    if unit in {'Engineer','King','Cannon','Bolt Thrower','Mortar'}:
        if faction == 'dwarfen-mountain-holds' and evidence & {'empire','imperial','tomb','khemri'}:
            return verdict(False, 'wrong-generic-unit-faction')
        if faction == 'empire-of-man' and evidence & {'dwarf','dwarfen','tomb','khemri'}:
            return verdict(False, 'wrong-generic-unit-faction')
    if unit in {'Prince','Noble','Mage'} and faction == 'high-elf-realms' and ('dark' in evidence or 'wood' in evidence):
        return verdict(False, 'wrong-generic-unit-faction')
    scoped = {'engineer','thane','rangers','cannon','bolt thrower','mortar','great cannon'}
    extras = [] if unit.lower() in scoped else SAFE_LABELS.get(unit.lower(), [])
    if faction == 'dwarfen-mountain-holds' and unit.lower() in {'engineer','thane','rangers','cannon','bolt thrower'}:
        extras = SAFE_LABELS.get(unit.lower(), [])
    if faction == 'empire-of-man' and unit.lower() in {'mortar','great cannon'}:
        extras = SAFE_LABELS.get(unit.lower(), [])
    labels = [unit] + extras
    labels += FACTION_LABELS.get(faction, {}).get(unit, [])
    # Only a god explicitly named in the image can identify a shared deity variant.
    target_gods = target & GODS
    image_gods = evidence & GODS
    shared_deity_type = any(word in target for word in ['herald','fury','grinder'])
    if image_gods and target_gods and image_gods != target_gods:
        return verdict(False, 'conflicting-chaos-god')
    if target_gods and shared_deity_type:
        if image_gods != target_gods:
            return verdict(False, 'chaos-god-not-explicit')
        if 'herald' in target:
            labels.append('Herald of '+next(iter(target_gods)))
    # Dedicated daemon types are already specific identities when their god is omitted.
    if target_gods and not shared_deity_type:
        labels.append(re.sub(r'\s+of\s+(Khorne|Nurgle|Tzeentch|Slaanesh)$','',unit,flags=re.I))
    if any(word in target for word in ['skeleton']):
        tomb = 'tomb' in evidence or 'khemri' in evidence
        vampire = 'vampire' in evidence or 'deathrattle' in evidence
        if faction == 'vampire-counts' and tomb:
            return verdict(False, 'wrong-skeleton-faction')
        if faction == 'tomb-kings-of-khemri' and vampire:
            return verdict(False, 'wrong-skeleton-faction')
        if faction == 'vampire-counts' and not vampire or faction == 'tomb-kings-of-khemri' and not tomb:
            return verdict(False, 'skeleton-faction-not-explicit')
    # The on-foot and mounted Realm units are separate entries.
    foot = 'foot' in target or 'dismounted' in target
    mounted = 'mounted' in target
    if foot or mounted:
        is_foot = bool(evidence & {'foot','dismounted'})
        is_mounted = bool(evidence & {'mounted','horse','steed','cavalry'})
        if foot and is_mounted or mounted and is_foot:
            return verdict(False, 'conflicting-mount-mode')
        if foot and not is_foot or mounted and not is_mounted:
            return verdict(False, 'mount-mode-not-explicit')
        if 'knight' in target and 'realm' in target:
            labels.append('Knight of the Realm')
    if 'skeleton' in target and 'warrior' in target and 'archer' in evidence:
        return verdict(False, 'conflicting-skeleton-troop-type')
    if faction == 'dwarfen-mountain-holds' and unit in {'King','Thane'} and re.search(r'can represent (?:a )?King or Thane', caption, re.I):
        return verdict(True, 'explicit-caption-representation', unit)
    permitted_markers = set(word for label in labels for word in tokens(label))
    unexpected = (evidence & RANK_MARKERS) - permitted_markers
    # Two full-name markers sometimes describe command models or a permitted mount.
    unexpected -= {'blue'} if not (target & {'horror'}) else set()
    if unexpected:
        return verdict(False, 'conflicting-rank-or-subtype')
    context = set(tokens(' '.join(CONTEXT)))
    if faction=='vampire-counts':context |= {'vampire','count','undead'}
    if faction=='tomb-kings-of-khemri':context |= {'tomb','king','khemri'}
    for label in dict.fromkeys(labels):
        normalized = tokens(label)
        for field, words in fields:
            if label_match(words, normalized, context):
                return verdict(True, 'explicit-'+field+'-identity', label)
    return verdict(False, 'unit-identity-not-explicit')
