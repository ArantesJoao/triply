/**
 * Builds public/backlog-empty.webp, the empty-Backlog illustration.
 *
 * Same idea as scripts/build-city-mask.mjs — keep the artwork's *ink coverage*
 * as an alpha channel, throw the colour away, and let the component paint it
 * with `var(--brand)` so it re-tints itself per theme. Two things differ from
 * the cityscape, because the source is a flat vector-style render rather than a
 * painting:
 *
 *   - The source already carries alpha, so coverage comes from that channel
 *     directly instead of from "how dark is this pixel against white". The
 *     artwork's own silhouette is the mask's silhouette.
 *   - Its idea cards are near-white. Pure darkness mapping would erase them and
 *     leave the icons floating in mid-air, so opaque pixels get a small ink
 *     FLOOR: white reads as a pale periwinkle panel, the box as a mid tint, the
 *     glyphs and route dots as full brand. The light-to-dark ordering of the
 *     original survives, which is what makes the composition legible.
 *
 * No edge fade — unlike the cityscape this asset is already isolated on
 * transparency and is cropped to its own bounding box here.
 *
 * Run: node scripts/build-backlog-mask.mjs <source.png>
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
const OUT = path.join(root, 'public', 'backlog-empty.webp');

if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage: node scripts/build-backlog-mask.mjs <source.png>');
  process.exit(1);
}

/** 2x the widest the illustration is drawn (a phone-width empty state). */
const W = 640;
const H = 640;
/** Alpha steps — matches the cityscape, well clear of banding. */
const LEVELS = 64;
/** Ink an opaque but pure-white pixel still contributes, 0..1. */
const FLOOR = 0.14;
/** Below this the source is antialiasing fringe or stray speckle, not art. */
const ALPHA_CUTOFF = 0.12;
/** Padding kept around the trimmed content, as a fraction of its longest side. */
const PAD = 0.03;

const dataUri = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();

const uri = await page.evaluate(
  async ({ dataUri, W, H, LEVELS, FLOOR, ALPHA_CUTOFF, PAD }) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();

    // Pass 0: measure the artwork inside the source's transparent margins, so
    // the exported mask is all art and the component's box is all illustration.
    const probe = document.createElement('canvas');
    probe.width = img.naturalWidth;
    probe.height = img.naturalHeight;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(img, 0, 0);
    const pd = pctx.getImageData(0, 0, probe.width, probe.height).data;

    let x0 = probe.width, y0 = probe.height, x1 = -1, y1 = -1;
    for (let y = 0; y < probe.height; y++) {
      for (let x = 0; x < probe.width; x++) {
        if (pd[(y * probe.width + x) * 4 + 3] / 255 <= ALPHA_CUTOFF) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }

    const side = Math.max(x1 - x0, y1 - y0);
    const pad = side * PAD;
    // Squared off around the content's centre: the output box is square, and
    // letting the crop be square too keeps the artwork from being stretched.
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const half = side / 2 + pad;

    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, W, H);

    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;

    // Pass 1: find the darkest ink among pixels that are actually drawn, so the
    // normalised darkness uses the full range of this particular artwork.
    let minLum = 255;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] / 255 <= ALPHA_CUTOFF) continue;
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (lum < minLum) minLum = lum;
    }
    const span = Math.max(1, 255 - minLum);
    const step = 255 / (LEVELS - 1);

    // Pass 2: alpha = coverage x (floor + normalised darkness).
    for (let i = 0; i < d.length; i += 4) {
      const cover = d[i + 3] / 255;
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

      let dark = Math.min(1, Math.max(0, (255 - lum) / span));
      // Slight lift so the palest washes survive the round-trip.
      dark = Math.pow(dark, 0.88);

      const ink =
        cover <= ALPHA_CUTOFF ? 0 : cover * (FLOOR + (1 - FLOOR) * dark);

      // Only alpha is read by the CSS mask; RGB is flattened so it compresses
      // to nothing.
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = Math.round((ink * 255) / step) * step;
    }

    ctx.putImageData(id, 0, 0);
    return c.toDataURL('image/webp', 0.92);
  },
  { dataUri, W, H, LEVELS, FLOOR, ALPHA_CUTOFF, PAD },
);

await browser.close();

const buf = Buffer.from(uri.split(',')[1], 'base64');
fs.writeFileSync(OUT, buf);
console.log(
  `wrote ${path.relative(root, OUT)} (${W}x${H}, ${(buf.length / 1024).toFixed(1)} KB)`,
);
