// NEON SHORES — cover rendering engine.
//
// Pure canvas-2D: given a plain state object (see defaultState in main.js) it paints a
// finished cover onto any 2D context: photo panels with white gutters, a colour grade,
// stacked poster lettering with a neon script subtitle, then a vignette and film grain.
// The editor's live preview and the PNG export both call renderCover, so what you see
// is exactly what downloads.

/** The three colour grades: a ctx.filter string factory plus a gradient overlay. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: (a) => `saturate(${(1 + 0.55 * a).toFixed(3)}) contrast(${(1 + 0.14 * a).toFixed(3)}) brightness(${(1 + 0.04 * a).toFixed(3)})`,
    overlayTop: 'rgba(255, 138, 42, 0.85)',
    overlayBottom: 'rgba(255, 47, 150, 0.85)',
    overlayMode: 'overlay',
  },
  neon: {
    label: 'Neon Night',
    filter: (a) => `saturate(${(1 + 0.45 * a).toFixed(3)}) contrast(${(1 + 0.22 * a).toFixed(3)}) brightness(${(1 - 0.05 * a).toFixed(3)})`,
    overlayTop: 'rgba(38, 198, 255, 0.8)',
    overlayBottom: 'rgba(255, 43, 214, 0.8)',
    overlayMode: 'soft-light',
  },
  gold: {
    label: 'Gold Hour',
    filter: (a) => `saturate(${(1 + 0.3 * a).toFixed(3)}) contrast(${(1 + 0.1 * a).toFixed(3)}) brightness(${(1 + 0.07 * a).toFixed(3)}) sepia(${(0.28 * a).toFixed(3)})`,
    overlayTop: 'rgba(255, 196, 64, 0.8)',
    overlayBottom: 'rgba(255, 110, 64, 0.8)',
    overlayMode: 'overlay',
  },
};

/** Export sizes the editor offers, in pixels. */
export const EXPORT_SIZES = [
  { id: '1080x1080', width: 1080, height: 1080 },
  { id: '1080x1350', width: 1080, height: 1350 },
  { id: '1920x1080', width: 1920, height: 1080 },
];

/** The layouts the editor offers. */
export const LAYOUTS = [
  { id: 'grid', label: 'Grid 3×3' },
  { id: 'mosaic', label: 'Hero mosaic' },
  { id: 'strip', label: 'Strip · 3 columns' },
];

/**
 * Panel rectangles for a layout, in unit space (0..1 across the canvas), in reading
 * order. Gutters are applied later, in pixels, so layouts stay resolution-free.
 */
export function layoutPanels(layout, width, height) {
  if (layout === 'strip') {
    return [0, 1, 2].map((i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 1 }));
  }
  if (layout === 'mosaic') {
    if (height >= width) {
      // Portrait: one wide hero on top, three smaller panels below.
      return [
        { x: 0, y: 0, w: 1, h: 0.52 },
        { x: 0, y: 0.52, w: 0.5, h: 0.48 },
        { x: 0.5, y: 0.52, w: 0.5, h: 0.24 },
        { x: 0.5, y: 0.76, w: 0.5, h: 0.24 },
      ];
    }
    // Landscape / square: one tall hero on the left, three panels stacked right.
    return [
      { x: 0, y: 0, w: 0.58, h: 1 },
      { x: 0.58, y: 0, w: 0.42, h: 0.5 },
      { x: 0.58, y: 0.5, w: 0.21, h: 0.5 },
      { x: 0.79, y: 0.5, w: 0.21, h: 0.5 },
    ];
  }
  // Grid 3×3.
  const panels = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      panels.push({ x: col / 3, y: row / 3, w: 1 / 3, h: 1 / 3 });
    }
  }
  return panels;
}

/** Where an image lands when cover-fitted into a rect: drawn size and top-left corner. */
export function coverFit(imgW, imgH, rect, scale, ox, oy) {
  const s = Math.max(rect.w / imgW, rect.h / imgH) * Math.max(1, scale);
  const w = imgW * s;
  const h = imgH * s;
  return { x: rect.x + (rect.w - w) * ox, y: rect.y + (rect.h - h) * oy, w, h };
}

/** One pre-generated tile of film grain, reused for every render. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const data = g.createImageData(256, 256);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 96);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = c;
  return c;
}

/** Paint one photo into one panel rect, clipped, with the grade filter applied. */
function drawPanelPhoto(ctx, img, rect, fit, filter) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = filter;
  ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
  ctx.restore();
}

/** The stacked poster title: one word per line, sunset gradient fill, dark stroke, hard shadow. */
function drawTitleBlock(ctx, state, W, H) {
  const words = state.title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const maxW = W * 0.92;
  let size = W * 0.17;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `${s}px Anton, 'Arial Black', sans-serif`; };
  setFont(size);
  for (const word of words) {
    const w = ctx.measureText(word.toUpperCase()).width;
    if (w > maxW) size *= maxW / w;
  }
  setFont(size);
  const lineH = size * 0.94;
  const blockH = lineH * words.length;
  const bottom = H * 0.965;
  const top = bottom - blockH;

  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, '#ffd76a');
  grad.addColorStop(0.75, '#ff7a3c');
  grad.addColorStop(1, '#ff2f92');

  words.forEach((word, i) => {
    const text = word.toUpperCase();
    const y = top + lineH * (i + 0.82);
    const cx = W / 2;
    ctx.lineJoin = 'round';
    // Hard offset shadow first, then stroke, then the gradient fill.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.9)';
    ctx.fillText(text, cx + size * 0.05, y + size * 0.055);
    ctx.strokeStyle = '#160a12';
    ctx.lineWidth = size * 0.14;
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, y);
  });
  return blockH;
}

/** The neon script subtitle, glowing pink, tucked under the title, tilted a few degrees. */
function drawSubtitle(ctx, state, W, H, titleBlockH) {
  const text = state.subtitle.trim();
  if (!text) return;
  const size = Math.max(20, W * 0.052);
  ctx.save();
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const y = H * 0.965 - titleBlockH - size * 0.15;
  ctx.translate(W / 2, y);
  ctx.rotate(-0.045);
  ctx.shadowColor = '#ff2fb3';
  ctx.shadowBlur = size * 0.55;
  ctx.fillStyle = '#ff6fd8';
  ctx.fillText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd7f4';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Render the whole cover described by `state` onto `ctx` at state's width × height.
 * state: { width, height, layout, spread, photos: [{img}], panels: [{photo, scale, ox, oy}],
 *          spreadPhoto, spreadScale, spreadOX, spreadOY, title, subtitle, grade, gradeAmount }
 */
export function renderCover(ctx, state) {
  const W = state.width;
  const H = state.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const amount = Math.min(1, Math.max(0, state.gradeAmount));
  const filter = grade.filter(amount);
  const gutter = Math.max(6, Math.round(W * 0.008));
  const panels = layoutPanels(state.layout, W, H);

  // Gutter paper behind everything; panels are inset by half a gutter each side.
  ctx.save();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, W, H);

  const rects = panels.map((p) => ({
    x: p.x * W + gutter / 2,
    y: p.y * H + gutter / 2,
    w: p.w * W - gutter,
    h: p.h * H - gutter,
  }));

  if (state.spread) {
    // One photo fitted to the whole canvas, then sliced by each panel's clip.
    const photo = state.photos[state.spreadPhoto];
    if (photo?.img) {
      const fit = coverFit(photo.img.naturalWidth, photo.img.naturalHeight,
        { x: 0, y: 0, w: W, h: H }, state.spreadScale, state.spreadOX, state.spreadOY);
      for (const rect of rects) drawPanelPhoto(ctx, photo.img, rect, fit, filter);
    }
  } else {
    rects.forEach((rect, i) => {
      const panel = state.panels[i];
      const photo = panel ? state.photos[panel.photo] : null;
      if (photo?.img) {
        const fit = coverFit(photo.img.naturalWidth, photo.img.naturalHeight, rect, panel.scale, panel.ox, panel.oy);
        drawPanelPhoto(ctx, photo.img, rect, fit, filter);
      } else {
        // Empty panel: a dark placeholder so the grid still reads as a cover.
        ctx.fillStyle = '#191423';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
    });
  }

  // Colour-grade gradient wash over the photos (never over the lettering).
  ctx.save();
  ctx.globalCompositeOperation = grade.overlayMode;
  ctx.globalAlpha = 0.18 + 0.5 * amount;
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, grade.overlayTop);
  wash.addColorStop(1, grade.overlayBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // A soft darkening at the very bottom so the lettering always sits on contrast.
  const shade = ctx.createLinearGradient(0, H * 0.55, 0, H);
  shade.addColorStop(0, 'rgba(8, 4, 14, 0)');
  shade.addColorStop(1, 'rgba(8, 4, 14, 0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  const titleH = drawTitleBlock(ctx, state, W, H);
  drawSubtitle(ctx, state, W, H, titleH);

  // Vignette.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(5,2,10,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Film grain.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.restore();
}

/** The panel index at a canvas point (in rendered pixels), or -1 for a gutter / outside. */
export function panelAtPoint(state, px, py) {
  const panels = layoutPanels(state.layout, state.width, state.height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (px >= p.x * state.width && px <= (p.x + p.w) * state.width &&
        py >= p.y * state.height && py <= (p.y + p.h) * state.height) return i;
  }
  return -1;
}
