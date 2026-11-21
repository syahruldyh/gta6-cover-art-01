# NEON SHORES — Cover Art Maker

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/syahruldyh/gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/syahruldyh/gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

Turn your own photos into bold, multi-panel video-game cover art — a panel grid,
sunset/neon colour grade and stacked poster lettering — and export a finished PNG
in a few clicks. Everything runs locally in the browser: your photos never leave
your machine, and the app works fully offline.

Entry for the make.fun bounty [Make GTA 6 Cover Art](https://make.fun/c/gta6-cover-art-01).
All art, lettering and code are original; the bundled typefaces (Anton and Pacifico)
are licensed under the SIL Open Font License, see `app/fonts/OFL.txt`.

## Run it

Serve the `app/` folder with any static file server and open it in a desktop browser:

```sh
python3 -m http.server --directory app 8080
# then open http://localhost:8080
```

No build step, no install, no network: open `app/index.html` through the server and
the editor is ready, preloaded with three sample illustrations so a cover exists
instantly.

## Features

- **Your photos, your cover** — upload photos (file picker or drag-and-drop onto the
  preview); they are read locally with `FileReader` and never uploaded anywhere.
- **Three layouts** — a 3×3 panel grid, a hero mosaic (one big panel plus smaller
  ones) and a 3-column strip, with clean white gutters between panels.
- **Spread or collage** — spread one photo across every panel, sliced GTA-poster
  style, or assign a different photo to each panel.
- **Per-panel art direction** — click a panel to select it, click a photo thumbnail
  to assign it, drag inside the panel to reposition the photo, and zoom with the
  slider.
- **Editable lettering** — a stacked, auto-fitting title with a sunset gradient fill,
  dark stroke and hard shadow, plus a glowing neon script subtitle; both are plain
  text inputs you can change.
- **Colour grades** — Sunset, Neon Night and Gold Hour presets (saturation/contrast
  filter plus a gradient overlay) with an intensity slider.
- **Live preview** — the canvas re-renders on every change.
- **One-click PNG export** — 1080×1080, 1080×1350 or 1920×1080, finished with a
  vignette and subtle film grain.

## Handing it in

`node main.ts` copies `app/` and `screenshots/` to the output directory
(`MAKEFUN_OUTPUT_DIR`, default `/output`) and writes `dossier.json` with the
vendored library in `vendor/makefun-app.ts`.
