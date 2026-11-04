#!/usr/bin/env python3
"""Read the official store's public product-search catalogue.

The store publishes its browser search configuration in its JavaScript bundle.
Read-only search configuration is discovered in memory instead of storing a key
in the repository. Only product metadata is written to the requested output.
An HTTP denial or rate limit stops the fetch; no alternate identity is tried.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

STORE = 'https://www.warhammer.com'
CATEGORY = STORE + '/en-GB/shop/the-old-world'
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
FIELDS = ['name', 'slug', 'sku', 'objectID', 'images', 'description',
          'productType', 'isAvailable', 'isInStock', 'isNewRelease',
          'GameSystemsRoot', 'version']


def read(url, *, body=None, headers=None):
    request_headers = {'User-Agent': USER_AGENT}
    request_headers.update(headers or {})
    request = Request(url, data=body, headers=request_headers,
                      method='POST' if body is not None else 'GET')
    try:
        with urlopen(request, timeout=35) as response:
            return response.read()
    except HTTPError as error:
        if error.code == 429:
            raise RuntimeError('Official store rate limited the request; Retry-After: '
                               + str(error.headers.get('Retry-After', 'not supplied'))) from None
        raise RuntimeError(f'Official store returned HTTP {error.code}; stopped without bypassing access controls') from None


def configuration():
    html = read(CATEGORY).decode('utf-8')
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    scripts = [path for path in scripts if path.startswith('/_next/static/chunks/')
               and not re.search(r'/(?:polyfills|webpack|framework|main)-', path)]
    # Small site-component chunks usually contain the public search setup.
    scripts.sort(key=lambda path: ('/pages/' in path, path))
    for path in scripts:
        time.sleep(0.35)
        source = read(urljoin(STORE, path)).decode('utf-8')
        app = re.search(r'getAlgoliaAppId=\(\)=>"([^"\\]+)"', source)
        key = re.search(r'getAlgoliaApiKey=\(\)=>"([^"\\]+)"', source)
        index = re.search(r'getAlgoliaIndexName=\(\)=>"([^"\\]+)"', source)
        if app and key and index:
            return app.group(1), key.group(1), index.group(1)
    raise RuntimeError('Official store public product-search configuration was not found')


def fetch_products(locale='en-GB', query='', old_world_only=True, game_system=None):
    app_id, search_key, index_base = configuration()
    index = index_base + '-' + locale.lower()
    endpoint = ('https://' + app_id.lower()
                + '-dsn.algolia.net/1/indexes/' + quote(index, safe='') + '/query')
    headers = {'Content-Type': 'application/json', 'Origin': STORE,
               'X-Algolia-Application-Id': app_id, 'X-Algolia-API-Key': search_key}
    game = game_system or ('The Old World' if old_world_only else None)
    filters = 'productType:miniatureKit'
    if game:
        filters = 'GameSystemsRoot.lvl0:' + json.dumps(game) + ' AND ' + filters
    page, products, total = 0, {}, None
    exhaustive = True
    while True:
        params = {'query': query, 'hitsPerPage': 1000, 'page': page,
                  'filters': filters, 'attributesToRetrieve': FIELDS,
                  'attributesToHighlight': []}
        result = json.loads(read(endpoint, body=json.dumps(params).encode(), headers=headers))
        total = result['nbHits']
        exhaustive = exhaustive and bool(result.get('exhaustiveNbHits', True))
        for hit in result.get('hits', []):
            products[hit['objectID']] = {key: hit.get(key) for key in FIELDS}
        if page + 1 >= result['nbPages']:
            break
        page += 1
        time.sleep(0.5)
    if len(products) != total:
        raise RuntimeError(f'Incomplete official catalogue: {len(products)} of {total} products')
    listing = {'The Old World': 'the-old-world', 'Age of Sigmar': 'age-of-sigmar'}.get(game)
    source_url = STORE + '/' + locale + ('/shop/' + listing if listing else '')
    return {'schemaVersion': 1, 'checkedAt': time.strftime('%Y-%m-%d', time.gmtime()),
            'locale': locale, 'sourceUrl': source_url,
            'sourceType': 'Official Warhammer store public product search',
            'query': query, 'oldWorldOnly': game == 'The Old World', 'gameSystem': game,
            'productCount': len(products), 'exhaustive': exhaustive,
            'products': list(products.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True,
                        help='Private metadata output JSON; do not publish the raw store dump')
    parser.add_argument('--locale', default='en-GB')
    parser.add_argument('--query', default='')
    parser.add_argument('--game-system',
                        help='Exact official game-system facet, e.g. Age of Sigmar')
    parser.add_argument('--all-games', action='store_true',
                        help='Search exact legacy-unit names across official game ranges')
    arguments = parser.parse_args()
    data = fetch_products(arguments.locale, arguments.query, not arguments.all_games,
                          arguments.game_system)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'products': data['productCount'], 'exhaustive': data['exhaustive'],
                      'metadataOutput': str(arguments.output)}))


if __name__ == '__main__':
    main()
