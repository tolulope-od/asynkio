#!/usr/bin/env node
/**
 * Pixelate the Asynk IO mark.
 *
 * Rasterises `assets/logo/mark.svg` onto a small square grid, classifies each
 * cell (empty / ink / accent) and re-emits it as flat 1px rectangles — the same
 * technique `gen-assets.mjs` uses for the hand-drawn icons, but derived from the
 * vector mark instead of an authored ASCII map.
 *
 * The result is themeable, like the rest of the sprite: the chevron mass is
 * `currentColor` and the circuit trace is `var(--px-accent)`, so one asset
 * serves both the light header and an inverted tile without a second file.
 *
 * Requires the static server to be running (it renders the page over HTTP):
 *   node server.mjs 4399 &
 *   node tools/pixelate-logo.mjs 44                                  # header mark
 *   node tools/pixelate-logo.mjs 22 --favicon                        # tab icon
 *   node tools/pixelate-logo.mjs 88 --source=wordmark                # wordmark
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { withPage } from "./cdp.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SITE = resolve(ROOT, "..", "asynk-io");
const PORT = Number(process.env.CLONE_PORT || 4399);
const BASE = `http://127.0.0.1:${PORT}`;

const args = process.argv.slice(2);
const width = Number(args.find((a) => /^\d+$/.test(a)) || 44);
const faviconMode = args.includes("--favicon");
const source = (args.find((a) => a.startsWith("--source=")) || "--source=mark").split("=")[1];
const outPath = resolve(
  SITE,
  faviconMode ? "assets/logo/favicon.svg" : `assets/logo/${source}-pixel-${width}.svg`,
);

const svg = readFileSync(resolve(SITE, `assets/logo/${source}.svg`), "utf8");
const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const aspect = vb[2] / vb[3];
const height = Math.round(width / aspect);

const page = `<!doctype html><meta charset="utf-8"><pre id="out">…</pre><script>
const SRC = ${JSON.stringify(svg)};
const W = ${width}, H = ${height};
(async () => {
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(SRC)));
  const img = new Image();
  img.src = url;
  await img.decode();

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;

  // 0 = empty, 1 = ink (the chevron mass), 2 = accent (the circuit trace).
  const grid = [];
  for (let py = 0; py < H; py++) {
    const row = [];
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const a = d[i + 3];
      if (a < 110) { row.push(0); continue; }
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      row.push(lum > 86 ? 2 : 1);
    }
    grid.push(row);
  }

  // Horizontal runs keep the output to a few hundred rects instead of W*H.
  const rects = [];
  for (let y = 0; y < H; y++) {
    let px = 0;
    while (px < W) {
      const v = grid[y][px];
      if (!v) { px++; continue; }
      let run = 1;
      while (px + run < W && grid[y][px + run] === v) run++;
      rects.push({ x: px, y, w: run, v });
      px += run;
    }
  }

  const body = rects
    .map((r) => \`  <rect x="\${r.x}" y="\${r.y}" width="\${r.w}" height="1" fill="\${r.v === 2 ? "var(--px-accent, currentColor)" : "currentColor"}"/>\`)
    .join("\\n");
  const FAVICON = ${faviconMode};
  let out;
  if (FAVICON) {
    // Square ink tile, mark centred, colours baked — a favicon is a standalone
    // document and cannot inherit the page's custom properties.
    const side = Math.round(Math.max(W, H) * 1.28);
    const ox = Math.round((side - W) / 2), oy = Math.round((side - H) / 2);
    const baked = rects
      .map((r) => \`  <rect x="\${r.x + ox}" y="\${r.y + oy}" width="\${r.w}" height="1" fill="\${r.v === 2 ? "#CFFF55" : "#F5F5F1"}\"/>\`)
      .join("\\n");
    out =
      \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${side} \${side}" shape-rendering="crispEdges" role="img" aria-label="Asynk IO">\\n\` +
      \`  <title>Asynk IO</title>\\n  <rect width="\${side}" height="\${side}" rx="\${Math.round(side * 0.2)}" fill="#0A0A0B"/>\\n\` +
      baked + "\\n</svg>\\n";
  } else {
    out =
      \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${W} \${H}" width="\${W}" height="\${H}" shape-rendering="crispEdges" role="img" aria-label="Asynk IO">\\n\` +
      \`  <title>Asynk IO</title>\\n\` + body + "\\n</svg>\\n";
  }

  document.getElementById("out").textContent = JSON.stringify({
    svg: out,
    stats: { grid: W + "x" + H, rects: rects.length, ink: rects.filter(r => r.v === 1).length, accent: rects.filter(r => r.v === 2).length, bytes: out.length }
  });
})().catch(e => { document.getElementById("out").textContent = "ERROR " + e.message; });
</script>`;

const tmpName = `_pixelate-${process.pid}.html`;
const tmpPath = resolve(SITE, tmpName);

try {
  writeFileSync(tmpPath, page, "utf8");
  const raw = await withPage(async ({ send }) => {
    const { send: _s } = { send };
    await send("Page.navigate", { url: `${BASE}/${tmpName}` });
    await new Promise((r) => setTimeout(r, 2500));
    const { result } = await send("Runtime.evaluate", {
      expression: `document.getElementById("out").textContent`,
      returnByValue: true,
    });
    return result.value;
  });

  if (!raw || raw.startsWith("ERROR") || raw === "…") {
    console.error("pixelate failed:", raw);
    process.exit(1);
  }
  const { svg: out, stats } = JSON.parse(raw);
  writeFileSync(outPath, out, "utf8");
  console.log(`${outPath.replace(SITE + "/", "")}  grid ${stats.grid}  ${stats.rects} rects  ${stats.bytes} bytes`);
} finally {
  rmSync(tmpPath, { force: true });
}
