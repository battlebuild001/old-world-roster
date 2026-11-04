#!/usr/bin/env python3
"""Build the unit gallery from current official products and reviewed official photos."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import threading
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from PIL import Image, ImageOps
from match_official_products import match_product

ROOT = Path(__file__).resolve().parents[1]
DATE = datetime.now(timezone.utc).date().isoformat()
LOCK = threading.Lock()
NEXT = 0.0
PAUSED = False
ALLOWED_IMAGES = {'www.warhammer.com', 'warhammer.com', 'static.warhammer.com', 'assets.warhammer-community.com'}


def canonical(name):
    return re.sub(r'\s*\{[^{}]*\}\s*', ' ', name).strip()


def official_page(url):
    parsed = urlsplit(str(url or ''))
    return parsed.scheme == 'https' and parsed.hostname in {'www.warhammer.com', 'warhammer.com', 'www.warhammer-community.com', 'warhammer-community.com'} and not parsed.username and not parsed.password


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--products', required=True, type=Path)
    parser.add_argument('--legacy-products', type=Path)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    primary = json.loads(args.products.read_text())['products']
    legacy = json.loads(args.legacy_products.read_text())['products'] if args.legacy_products else []
    products = primary + legacy
    reviewed = json.loads((ROOT / 'scripts/reviewed-unit-photos.json').read_text())['bindings']
    pinned = {(b['faction'], canonical(b['name'])): b['photos'] for b in reviewed}
    community = json.loads((ROOT / 'scripts/reviewed-official-community-photos.json').read_text())['bindings']
    fallback = {(b['faction'], canonical(b['name'])): b['photos'] for b in community}
    units = []
    data = ROOT / 'dist/data/games/the-old-world'
    for path in sorted(data.glob('*.json')) + sorted((data / '1.5').glob('*.json')):
        army = json.loads(path.read_text())
        for category in ['characters', 'core', 'special', 'rare', 'mercenaries']:
            units.extend((path.stem, u['name_en']) for u in army.get(category, []) if isinstance(u, dict) and u.get('name_en'))
    units = list(dict.fromkeys(units))

    def product_rank(result):
        game = result.get('gameSystems', [])
        primary_game = 'The Old World' in game or 'The Old World' in str(game)
        years = re.findall(r'(?<!\d)(20\d{2})(?!\d)', str(result.get('slug', '')))
        return (primary_game, max(map(int, years), default=0))

    planned = []
    for faction, name in units:
        key = (faction, canonical(name))
        if key in pinned:
            planned.append({'faction': faction, 'name': name, 'photos': pinned[key], 'kind': 'reviewed-official'})
            continue
        matches = [result for product in products if (result := match_product(faction, name, product))['approved']]
        if matches:
            chosen = max(matches, key=product_rank)
            selected = chosen['photos'][:1]
            game = 'The Old World' if 'The Old World' in str(chosen.get('gameSystems', [])) else 'Age of Sigmar'
            for photo in selected:
                photo['caption'] = f"{canonical(name)} · {chosen['productName']} · 공식 제품 사진 ({game})"
                photo['credit'] = f'Games Workshop / Warhammer.com · Official product photograph · checked {DATE}'
                photo['gameSystem'] = game
            planned.append({'faction': faction, 'name': name, 'photos': selected, 'kind': 'official-store', 'product': chosen['productName'], 'slug': chosen['slug'], 'gameSystem': game})
        elif key in fallback:
            planned.append({'faction': faction, 'name': name, 'photos': fallback[key], 'kind': 'reviewed-official-community'})
        else:
            planned.append({'faction': faction, 'name': name, 'photos': [], 'kind': 'unmatched'})
    (args.cache / 'matching-review.json').write_text(json.dumps(planned, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'plannedUnits': len(planned), 'matched': sum(bool(p['photos']) for p in planned), 'officialProductsChecked': len(products)}), flush=True)
    if args.dry_run:
        return

    dest = ROOT / 'dist/unit-photo-images'
    dest.mkdir(exist_ok=True)
    sources = {p['fileUrl']: p for unit in planned for p in unit['photos']}

    def image_task(url):
        global NEXT, PAUSED
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_IMAGES or parsed.username or parsed.password:
            return url, None
        digest = hashlib.sha256(url.encode()).hexdigest()
        out = dest / (digest[:20] + '.webp')
        cached = args.cache / (digest + '.image')
        try:
            if not out.exists():
                if not cached.exists():
                    if args.offline or PAUSED:
                        return url, None
                    with LOCK:
                        delay = max(0.0, NEXT - time.monotonic())
                        NEXT = max(NEXT, time.monotonic()) + 1.0
                    if delay:
                        time.sleep(delay)
                    if PAUSED:
                        return url, None
                    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; official-miniature-reference/1.0)'}), timeout=30) as response:
                        if urlsplit(response.url).hostname not in ALLOWED_IMAGES or not response.headers.get('Content-Type', '').startswith('image/'):
                            return url, None
                        cached.write_bytes(response.read())
                with Image.open(BytesIO(cached.read_bytes())) as original:
                    picture = ImageOps.exif_transpose(original).convert('RGBA' if 'A' in original.getbands() else 'RGB')
                    picture.thumbnail((900, 900), Image.Resampling.LANCZOS)
                    picture.save(out, 'WEBP', quality=82, method=5)
            with Image.open(out) as picture:
                picture.load()
                width, height = picture.size
                if min(width, height) < 70:
                    return url, None
            return url, {'src': './unit-photo-images/' + out.name, 'width': width, 'height': height}
        except HTTPError as error:
            if error.code == 429:
                PAUSED = True
                (args.cache / 'rate-limit.json').write_text(json.dumps({'urlHost': parsed.hostname, 'retryAfter': error.headers.get('Retry-After'), 'checkedAt': DATE}))
            return url, None
        except (URLError, OSError, ValueError, TimeoutError):
            return url, None

    images = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for index, (url, result) in enumerate(pool.map(image_task, sources), 1):
            if result:
                images[url] = result
            if index % 25 == 0:
                print(json.dumps({'imagesProcessed': index, 'total': len(sources), 'downloaded': len(images)}), flush=True)
    if PAUSED:
        raise RuntimeError('Official source rate limit received; catalogue was not replaced. Respect Retry-After before resuming.')
    entries = []
    for planned_unit in planned:
        faction, name = planned_unit['faction'], planned_unit['name']
        photos = []
        for photo in planned_unit['photos']:
            if photo['fileUrl'] not in images or not official_page(photo.get('sourceUrl')):
                continue
            identity = {**photo['identity'], 'approved': True, 'unit': canonical(name), 'faction': faction, 'policyVersion': 2}
            if not (identity.get('evidence') or identity.get('proof')):
                identity['evidence'] = f"Official product: {planned_unit.get('product', canonical(name))}"
            identity.setdefault('proofUrl', photo['sourceUrl'])
            photos.append({**photo, **images[photo['fileUrl']], 'identity': identity, 'checkedAt': DATE})
        entries.append({'name': name, 'faction': faction, 'aliases': [canonical(name)] if canonical(name) != name else [], 'photos': photos})
    # Equal image bytes must not silently stand in for distinct units in an army.
    hashes = {p['src']: hashlib.sha256((ROOT / 'dist' / p['src']).read_bytes()).hexdigest() for entry in entries for p in entry['photos']}
    owners = {}
    for entry in entries:
        for photo in entry['photos']:
            owners.setdefault((entry['faction'], hashes[photo['src']]), set()).add(canonical(entry['name']).casefold())
    ambiguous = {key for key, names in owners.items() if len(names) > 1}
    for entry in entries:
        entry['photos'] = [p for p in entry['photos'] if (entry['faction'], hashes[p['src']]) not in ambiguous]
    used = {p['src'].rsplit('/', 1)[-1] for entry in entries for p in entry['photos']}
    counts = {'entries': len(entries), 'withPhotos': sum(bool(e['photos']) for e in entries), 'withoutPhotos': sum(not e['photos'] for e in entries), 'images': len(used), 'imageBytes': sum((dest / name).stat().st_size for name in used), 'factions': len({f for f, _ in units}), 'officialProductsChecked': len(products), 'officialOnly': True}
    output = {'schemaVersion': 2, 'identityPolicyVersion': 2, 'officialOnly': True, 'source': 'Games Workshop official store and Warhammer Community', 'checkedAt': DATE, 'counts': counts, 'entries': entries}
    temporary = ROOT / 'dist/data/unit-photos.json.tmp'
    temporary.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(ROOT / 'dist/data/unit-photos.json')
    for path in dest.glob('*.webp'):
        if path.name not in used:
            path.unlink()
    (args.cache / 'unmatched-units.json').write_text(json.dumps([{'name': e['name'], 'faction': e['faction']} for e in entries if not e['photos']], ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'complete': True, 'networkPaused': PAUSED, **counts}), flush=True)


if __name__ == '__main__':
    main()
