# The Old World Roster Builder

A bilingual, browser based roster builder for Warhammer: The Old World. The app is in `dist/` and runs as a static site. Rosters are stored in the browser and can be exchanged using roster seeds.

The builder offers Open War, Combined Arms and Grand Melee settings, faction specific mercenary choices, and a mobile play mode for tableside reference. Matched play warnings cover the guide's general limits; faction specific composition rules still need to be checked against the army list.

Confirm a roster to save a separate play reference. Every selected model, champion and mount profile is shown, with verified option bonuses beside the original characteristics. Weapon alternatives and temporary bonuses use labelled conditional rows. Editing the draft does not change the confirmed roster until it is confirmed again. Units without indexed profiles can use manually entered base characteristics.

The rules area includes the complete supplied Korean document in 30 chapters and 937 sections, with 81 tables, 62 lossless figures, full text search, source notes and previous/next navigation. The bilingual ruling guide, quick sheet, original rules index and tutorial remain available. Verified document corrections retain their original wording and sources. The document body remains Korean; the reader controls follow the selected interface language.

The default rules view is an authored playbook. It connects related rules into lessons with a key takeaway, a numbered resolution procedure, a worked example and explicit exceptions. The editorial contents page, learning routes and contextual diagrams support both learning and use at the table. The complete supplied document can be opened separately or expanded under the relevant lesson.

Quick sheet → Roll charts includes rank thresholds, combat-result scoring and the three-way Break-test table, with a helper for entered dice, Leadership, losing margin and Unit Strength comparison. Unit photo buttons open an in-app miniature gallery with source captions, zoom and previous/next navigation. Catalogue matches use canonical English unit and faction names. Device photographs can be opened for the current session without uploading them or changing saved rosters.

The unit catalogue shows a thumbnail on the left. Thumbnails fill their frame without a border or inset padding; their edges can be cropped. Tapping a thumbnail opens the matching photograph in the gallery, initially fitted in full without cropping. Photographs come from the official Warhammer store and reviewed Warhammer Community build examples, checked on 2026-11-04. Current Old World products take priority; an exact same-name Age of Sigmar model is labelled as such. Photograph identities are checked per unit, army and individual image; the Duke, Baron and Paladin retain distinct verified build examples. Unverified associations remain empty until identified.

## Refresh official photographs

Keep fetched product metadata and source-image caches outside this repository. The product feed contains descriptions used for review; the published catalogue contains only photograph credits, source links and factual matching evidence.

```sh
python3 scripts/fetch-official-warhammer-products.py --output /tmp/tow-official-products.json
python3 scripts/build-official-unit-photo-catalog.py --products /tmp/tow-official-products.json --cache /tmp/tow-official-photo-cache --dry-run
python3 scripts/build-official-unit-photo-catalog.py --products /tmp/tow-official-products.json --cache /tmp/tow-official-photo-cache
node --test tests/*.test.js
```

The builder prefers current Old World product photographs, checks individual variant filenames for combined kits, preserves reviewed official character identities, and removes unused former assets. `scripts/reviewed-official-community-photos.json` supplies individually reviewed official article photographs only when no store match exists. Optional `--legacy-products` accepts a separately reviewed official product feed for exact same-name legacy models. It does not map renamed units or generic faction images. Source requests are limited to one per second and stop on a rate-limit response. The archived Lexicanum builder requires an explicit `--allow-legacy-sources` flag and must not replace the official release catalogue.

## Run locally

```sh
cd dist
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Deploy

Changes pushed to `main` deploy `dist/` to GitHub Pages through `.github/workflows/deploy-pages.yml`.

This is an unofficial fan project and is not affiliated with Games Workshop. Data attribution is in [DATA_ATTRIBUTION.md](DATA_ATTRIBUTION.md).
