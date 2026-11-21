// NEON SHORES — Cover Art Maker (gta6-cover-art-01 entry, Node 22, standard library only).
//
// The app is this directory's app/ folder: plain static files a desktop browser loads fully
// offline (app/index.html plus its ES modules, fonts and sample art, no network requests).
// This program hands the entry in: it copies app/ and screenshots/ from beside this file to
// the output directory and writes dossier.json there with the vendored make.fun library, so
// the dossier describes exactly the bytes the judge receives.
//
// Run the app locally by serving app/ with any static file server, e.g.
//   python3 -m http.server --directory app 8080
// then open http://localhost:8080.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps for gta6-cover-art-01: only text_max_bytes shapes the dossier's
// bytes; the rest make this program refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB, more than 993 files in app/ or 48 MiB of app files in
// all, or a path under app/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
