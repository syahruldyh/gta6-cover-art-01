// NEON SHORES — editor UI.
//
// Wires the controls in index.html to the rendering engine in cover.js: a photo
// library (bundled samples + the user's own uploads, read locally and never sent
// anywhere), layouts, per-panel assignment / drag / zoom, lettering, colour grades
// and one-click PNG export. The preview canvas is kept at the chosen export size,
// so the live preview is pixel-for-pixel the file that downloads.

import { EXPORT_SIZES, GRADES, LAYOUTS, coverFit, layoutPanels, panelAtPoint, renderCover } from './cover.js';

const SAMPLES = [
  { src: 'samples/hero.jpg', name: 'Sunset Boulevard (sample)' },
  { src: 'samples/pier.jpg', name: 'Neon Pier (sample)' },
  { src: 'samples/boat.jpg', name: 'Bay Run (sample)' },
];

const state = {
  width: EXPORT_SIZES[1].width,
  height: EXPORT_SIZES[1].height,
  layout: 'grid',
  spread: true,
  photos: [],
  panels: [],
  spreadPhoto: 0,
  spreadScale: 1,
  spreadOX: 0.5,
  spreadOY: 0.5,
  title: 'NEON SHORES',
  subtitle: 'Vice Nights',
  grade: 'sunset',
  gradeAmount: 0.8,
};

let selectedPanel = 0;
let selectedSize = 1;

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

/** A fresh default panel pointing at a photo, centred, unscaled. */
function defaultPanel(photoIndex) {
  return { photo: photoIndex, scale: 1, ox: 0.5, oy: 0.5 };
}

/** Grow/shrink state.panels to the current layout's panel count, keeping old entries. */
function syncPanels() {
  const count = layoutPanels(state.layout, state.width, state.height).length;
  while (state.panels.length < count) {
    state.panels.push(defaultPanel(state.panels.length % Math.max(1, state.photos.length)));
  }
  state.panels.length = count;
  if (selectedPanel >= count) selectedPanel = 0;
}

/** The panel rectangles in pixels, exactly as renderCover computes them. */
function pixelRects() {
  const gutter = Math.max(6, Math.round(state.width * 0.008));
  return layoutPanels(state.layout, state.width, state.height).map((p) => ({
    x: p.x * state.width + gutter / 2,
    y: p.y * state.height + gutter / 2,
    w: p.w * state.width - gutter,
    h: p.h * state.height - gutter,
  }));
}

/** Redraw the preview, then outline the selected panel (editor-only chrome). */
function render() {
  syncPanels();
  canvas.width = state.width;
  canvas.height = state.height;
  renderCover(ctx, state);
  if (!state.spread && selectedPanel >= 0) {
    const r = pixelRects()[selectedPanel];
    if (r) {
      ctx.save();
      ctx.strokeStyle = '#ffcf3f';
      ctx.lineWidth = Math.max(3, state.width * 0.004);
      ctx.setLineDash([state.width * 0.02, state.width * 0.012]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }
  updatePanelLabel();
  markActiveButtons();
}

function updatePanelLabel() {
  const zoom = $('zoom');
  if (state.spread) {
    $('panelLabel').textContent = 'Spread mode: one photo fills every panel. Drag the preview to reposition it.';
    zoom.value = state.spreadScale;
  } else {
    $('panelLabel').textContent = `Panel ${selectedPanel + 1} selected. Click a photo to assign it, drag in the panel to reposition.`;
    zoom.value = state.panels[selectedPanel]?.scale ?? 1;
  }
}

/** Highlight the active layout / grade / size buttons and the in-use thumbnails. */
function markActiveButtons() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', Number(b.dataset.size) === selectedSize));
  document.querySelectorAll('.thumb').forEach((el, i) => {
    const inUse = state.spread ? i === state.spreadPhoto : state.panels[selectedPanel]?.photo === i;
    el.classList.toggle('active', inUse);
  });
}

/** Rebuild the thumbnail strip from state.photos. */
function renderThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    btn.appendChild(img);
    btn.addEventListener('click', () => assignPhoto(i));
    box.appendChild(btn);
  });
  markActiveButtons();
}

/** Assign library photo i to the selected panel (or as the spread photo). */
function assignPhoto(i) {
  if (state.spread) {
    state.spreadPhoto = i;
  } else {
    const panel = state.panels[selectedPanel];
    if (panel) {
      panel.photo = i;
      panel.scale = 1;
      panel.ox = 0.5;
      panel.oy = 0.5;
    }
  }
  render();
}

/** Load an image from a URL or data URL into an HTMLImageElement. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Add the user's own files to the library. Local only: FileReader, never uploaded. */
async function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const img = await loadImage(dataUrl);
    state.photos.push({ img, name: file.name });
  }
  renderThumbs();
  render();
}

// ------------------------------------------------------------------ controls

function buildButtons() {
  for (const layout of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.label;
    b.dataset.layout = layout.id;
    b.addEventListener('click', () => { state.layout = layout.id; render(); });
    $('layoutBtns').appendChild(b);
  }
  for (const [id, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = grade.label;
    b.dataset.grade = id;
    b.addEventListener('click', () => { state.grade = id; render(); });
    $('gradeBtns').appendChild(b);
  }
  EXPORT_SIZES.forEach((size, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = size.id.replace('x', ' × ');
    b.dataset.size = i;
    b.addEventListener('click', () => {
      selectedSize = i;
      state.width = size.width;
      state.height = size.height;
      render();
    });
    $('sizeBtns').appendChild(b);
  });
}

function wireControls() {
  $('fileInput').addEventListener('change', (e) => addFiles([...e.target.files]));
  $('spreadToggle').addEventListener('change', (e) => { state.spread = e.target.checked; render(); });
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('gradeRange').addEventListener('input', (e) => { state.gradeAmount = Number(e.target.value) / 100; render(); });
  $('zoom').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (state.spread) state.spreadScale = v;
    else if (state.panels[selectedPanel]) state.panels[selectedPanel].scale = v;
    render();
  });
  $('exportBtn').addEventListener('click', exportPng);

  // Drag-and-drop uploads straight onto the preview.
  canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('dropping'); });
  canvas.addEventListener('dragleave', () => canvas.classList.remove('dropping'));
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('dropping');
    if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]);
  });

  // Click selects a panel; drag repositions that panel's photo (or the spread).
  let drag = null;
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (state.width / r.width),
      y: (e.clientY - r.top) * (state.height / r.height),
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = point(e);
    const idx = panelAtPoint(state, p.x, p.y);
    if (!state.spread && idx >= 0) selectedPanel = idx;
    const target = dragTarget();
    if (target) {
      drag = { startX: p.x, startY: p.y, ox: target.ox, oy: target.oy, fit: target.fit, rect: target.rect };
      canvas.setPointerCapture(e.pointerId);
    }
    render();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = point(e);
    const t = dragTarget();
    if (!t) return;
    const slackX = drag.rect.w - drag.fit.w;
    const slackY = drag.rect.h - drag.fit.h;
    if (slackX < 0) t.ox = Math.min(1, Math.max(0, drag.ox + (p.x - drag.startX) / slackX));
    if (slackY < 0) t.oy = Math.min(1, Math.max(0, drag.oy + (p.y - drag.startY) / slackY));
    render();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
}

/**
 * The thing a drag moves right now: the spread placement, or the selected panel's
 * placement, with its current cover-fit and rect for converting pixels to offsets.
 */
function dragTarget() {
  if (state.spread) {
    const photo = state.photos[state.spreadPhoto];
    if (!photo?.img) return null;
    const rect = { x: 0, y: 0, w: state.width, h: state.height };
    return {
      get ox() { return state.spreadOX; }, set ox(v) { state.spreadOX = v; },
      get oy() { return state.spreadOY; }, set oy(v) { state.spreadOY = v; },
      fit: coverFit(photo.img.naturalWidth, photo.img.naturalHeight, rect, state.spreadScale, state.spreadOX, state.spreadOY),
      rect,
    };
  }
  const panel = state.panels[selectedPanel];
  const photo = panel ? state.photos[panel.photo] : null;
  if (!panel || !photo?.img) return null;
  const rect = pixelRects()[selectedPanel];
  return {
    get ox() { return panel.ox; }, set ox(v) { panel.ox = v; },
    get oy() { return panel.oy; }, set oy(v) { panel.oy = v; },
    fit: coverFit(photo.img.naturalWidth, photo.img.naturalHeight, rect, panel.scale, panel.ox, panel.oy),
    rect,
  };
}

/** Render at the chosen export size onto a fresh canvas and download it as a PNG. */
async function exportPng() {
  await ensureFonts();
  const out = document.createElement('canvas');
  out.width = state.width;
  out.height = state.height;
  renderCover(out.getContext('2d'), state);
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neon-shores-cover-${state.width}x${state.height}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Make sure the bundled display fonts are ready before any render that matters. */
async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // Fonts are bundled locally; a failure just falls back to system fonts.
  }
}

// ------------------------------------------------------------------ boot

async function boot() {
  buildButtons();
  wireControls();
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('spreadToggle').checked = state.spread;
  $('gradeRange').value = Math.round(state.gradeAmount * 100);
  const imgs = await Promise.all(SAMPLES.map((s) => loadImage(s.src)));
  state.photos = imgs.map((img, i) => ({ img, name: SAMPLES[i].name }));
  state.panels = layoutPanels(state.layout, state.width, state.height)
    .map((_, i) => defaultPanel(i % state.photos.length));
  renderThumbs();
  await ensureFonts();
  render();
}

boot();
