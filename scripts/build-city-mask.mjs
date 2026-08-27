/**
 * Builds public/city-empty.webp, the empty-state cityscape.
 *
 * The source is a painted raster illustration (blue ink on white). Tracing it
 * to SVG would balloon the file and flatten the soft washes, so instead we keep
 * only its *ink coverage* as an alpha channel and throw the colour away. The
 * component then paints that mask with `var(--brand)`, which means:
 *
 *   - no baked-in white background to fight in dark mode,
 *   - the illustration re-tints itself when the theme (or brand) changes,
 *   - ~20x smaller than the source PNG.
 *
 * The rounded edge fade is baked into the alpha here rather than layered on in
 * CSS, so the mask stays a single image with no mask-composite support needed.
 *
 * Run: node scripts/build-city-mask.mjs <source.png>
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
const OUT = path.join(root, 'public', 'city-empty.webp');

if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage: node scripts/build-city-mask.mjs <source.png>');
  process.exit(1);
}

/**
 * Covers 2x at both sizes it is drawn: 384px capped on desktop, and up to the
 * full width of a phone (~430px) where it runs edge to edge.
 */
const W = 900;
const H = 600;
/** Alpha steps. Below 64 the sky gradient bands (or grains, once dithered). */
const LEVELS = 64;
/** Distance from centre where the rounded fade starts, 0..1. */
const FADE_START = 0.7;
/** Corner shape of the fade: 2 is an ellipse, higher is a rounder rectangle. */
const FADE_POWER = 3.2;

const dataUri = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();

const uri = await page.evaluate(
  async ({ dataUri, W, H, LEVELS, FADE_START, FADE_POWER }) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();

    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    // Flatten onto white. The source has a transparent sky, which lands at
    // white here and therefore at zero ink below, same as a white sky would.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;

    // Pass 1: find the darkest ink, so the normalised alpha uses the full range
    // rather than topping out wherever this particular render happened to land.
    let minLum = 255;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (lum < minLum) minLum = lum;
    }
    const span = Math.max(1, 255 - minLum);
    const step = 255 / (LEVELS - 1);

    // Pass 2: alpha = normalised ink coverage x rounded fade.
    for (let y = 0; y < H; y++) {
      const ny = Math.abs((y + 0.5) / H - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

        let a = Math.min(1, Math.max(0, (255 - lum) / span));
        // Slight lift so the palest washes survive the round-trip.
        a = Math.pow(a, 0.88);

        const nx = Math.abs((x + 0.5) / W - 0.5) * 2;
        const dist = Math.pow(
          Math.pow(nx, FADE_POWER) + Math.pow(ny, FADE_POWER),
          1 / FADE_POWER,
        );
        let fade = 1;
        if (dist > FADE_START) {
          fade = Math.min(
            1,
            Math.max(0, 1 - (dist - FADE_START) / (1 - FADE_START)),
          );
          fade = fade * fade * (3 - 2 * fade); // smoothstep
        }

        // Only alpha is read by the CSS mask; RGB is flattened so it compresses
        // to nothing.
        d[i] = d[i + 1] = d[i + 2] = 0;
        d[i + 3] = Math.round((a * fade * 255) / step) * step;
      }
    }

    ctx.putImageData(id, 0, 0);
    return c.toDataURL('image/webp', 0.9);
  },
  { dataUri, W, H, LEVELS, FADE_START, FADE_POWER },
);

await browser.close();

const buf = Buffer.from(uri.split(',')[1], 'base64');
fs.writeFileSync(OUT, buf);
console.log(
  `wrote ${path.relative(root, OUT)} (${W}x${H}, ${(buf.length / 1024).toFixed(1)} KB)`,
);
