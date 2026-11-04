# Dataset attribution

Army, unit, magic item, and spell JSON datasets in `dist/data/` are copied from [Old World Builder](https://github.com/nthiebes/old-world-builder) by its contributors, commit [`de3b6c3b585d348eef7e219ac0964ee2791e0963`](https://github.com/nthiebes/old-world-builder/tree/de3b6c3b585d348eef7e219ac0964ee2791e0963). The source repository licenses this work under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

The data files are copied without modification. This application adds its own presentation and basic point calculation. This is an unofficial fan tool and is not endorsed by Games Workshop.

`dist/data/src/components/rules-index/rule-aliases.json` extracts rule aliases and additional links from Old World Builder's `src/components/rules-index/rules-map.js` under the same CC BY 4.0 license. They let combined and plural weapon names resolve to the same rule pages as the original builder.

`dist/data/play-weapon-profiles.json` contains factual weapon characteristics and source links from [The Old World Online Rules Index](https://tow.whfb.app/), retrieved on 2026-10-18. Conditional summaries and the profile display logic are authored for this application. The original linked rules remain the reference for equipment conditions.

`dist/phonetic-names.json` and `dist/phonetic-names.js` provide display-only Korean readings. Reviewed Warhammer names and a Hangul composer supplement English pronunciations from [CMUdict](https://github.com/cmusphinx/cmudict), copyright 1993–2015 Carnegie Mellon University. Its notice is reproduced in `dist/licenses/cmudict.txt`. The build uses `cmudict==1.1.3`; run `python3 scripts/build-phonetic-names.py --strict` to regenerate both artifacts. Source names, IDs, rules, numbers and saved roster records are unchanged.

## Supplied Korean rulebook

`dist/data/document-rulebook.json` and `dist/document-book-images/` present the supplied 2026 Korean rulebook document. The document's Games Workshop copyright and noncommercial translation notice are retained in the reader. This material is separate from the army datasets' CC BY 4.0 attribution above. Word author properties and the original DOCX package are not published.

The reading edition preserves all substantive source text, 81 tables and 62 figures. Repeated covers and notices are consolidated in the book information. Figures use lossless WebP with decoded pixel equivalence checked against the supplied images. Verified corrections carry references and preserve the previous wording; unresolved source ambiguities remain labelled. Sources for those edits are the unofficial [Online Rules Index](https://tow.whfb.app/) and the official errata entries it reproduces, checked on 2026-11-04.

`dist/data/study-rulebook.json` is a separately authored Korean learning edition, with connected lessons, worked examples, decision flows and contextual source figures/tables. Its chapter files are maintained in `scripts/study-book/`; `scripts/build-study-book.py` verifies that every source section belongs to exactly one lesson and that all source tables and figures remain accessible. The supplied document remains a distinct reference view. The learning edition is unofficial and does not replace the underlying rules or their errata.

`dist/combat-charts.js` contains authored combat-result and Break-test reference tables and examples. Factual troop-type thresholds, scores and exceptions were checked against the Online Rules Index and the official errata it reproduces on 2026-11-04. Source links are included in the chart. The Break helper covers the ordinary test and does not infer a unit's special rules.

`dist/data/unit-photos.json` links unit names to miniature photographs from the [Warhammer Fantasy Lexicanum](https://whfb.lexicanum.com/) galleries. Each photograph retains its source page, original image URL, caption and credit. Photographs are separate from the army datasets' CC BY 4.0 license; rights remain with their respective owners. Local WebP copies are resized for the in-app reference viewer and omit image metadata. Unmatched units are not assigned unrelated faction photographs.

Individual image identities are checked by `scripts/photo_identity.py`. Reviewed associations in `scripts/reviewed-unit-photos.json` include official [Warhammer Community](https://www.warhammer-community.com/) build examples for the Duke, Baron and Paladin, retaining their identification text and source links. Article galleries are used for discovery; each displayed photograph carries its own unit and faction identification. The gallery and catalogue thumbnails use these same verified associations.

The viewer loads model photographs when opened and keeps viewed images in a separate browser cache. A device image can also be opened locally for the current session; it is not uploaded or added to a roster export.
