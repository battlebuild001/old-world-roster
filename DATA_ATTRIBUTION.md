# Dataset attribution

Army, unit, magic item, and spell JSON datasets in `dist/data/` are copied from [Old World Builder](https://github.com/nthiebes/old-world-builder) by its contributors, commit [`de3b6c3b585d348eef7e219ac0964ee2791e0963`](https://github.com/nthiebes/old-world-builder/tree/de3b6c3b585d348eef7e219ac0964ee2791e0963). The source repository licenses this work under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

The data files are copied without modification. This application adds its own presentation and basic point calculation. This is an unofficial fan tool and is not endorsed by Games Workshop.

`dist/data/src/components/rules-index/rule-aliases.json` extracts rule aliases and additional links from Old World Builder's `src/components/rules-index/rules-map.js` under the same CC BY 4.0 license. They let combined and plural weapon names resolve to the same rule pages as the original builder.

`dist/data/play-weapon-profiles.json` contains factual weapon characteristics and source links from [The Old World Online Rules Index](https://tow.whfb.app/), retrieved on 2026-10-18. Conditional summaries and the profile display logic are authored for this application. The original linked rules remain the reference for equipment conditions.

`dist/phonetic-names.json` and `dist/phonetic-names.js` provide display-only Korean readings. Reviewed Warhammer names and a Hangul composer supplement English pronunciations from [CMUdict](https://github.com/cmusphinx/cmudict), copyright 1993–2015 Carnegie Mellon University. Its notice is reproduced in `dist/licenses/cmudict.txt`. The build uses `cmudict==1.1.3`; run `python3 scripts/build-phonetic-names.py --strict` to regenerate both artifacts. Source names, IDs, rules, numbers and saved roster records are unchanged.
