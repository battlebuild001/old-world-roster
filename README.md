# The Old World Roster Builder

A bilingual, browser based roster builder for Warhammer: The Old World. The app is in `dist/` and runs as a static site. Rosters are stored in the browser and can be exchanged using roster seeds.

The builder offers Open War, Combined Arms and Grand Melee settings, faction specific mercenary choices, and a mobile play mode for tableside reference. Matched play warnings cover the guide's general limits; faction specific composition rules still need to be checked against the army list.

## Run locally

```sh
cd dist
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Deploy

Changes pushed to `main` deploy `dist/` to GitHub Pages through `.github/workflows/deploy-pages.yml`.

This is an unofficial fan project and is not affiliated with Games Workshop. Data attribution is in [DATA_ATTRIBUTION.md](DATA_ATTRIBUTION.md).
