#!/usr/bin/env node
/**
 * Pixel-asset generator for Asynk IO.
 *
 * Icons are authored as ASCII pixel maps (`X` ink, `o` accent, `.` empty) on a
 * 12x12 grid. Each map is validated, optically centred, converted to merged
 * horizontal runs, and emitted as an SVG `<symbol>`.
 *
 * Outputs:
 *   assets/pixel/sprite.svg   standalone sprite (reference copy)
 *   index.html                refreshes the region between the PIXEL SPRITE
 *                             markers so the page can use <use href="#px-…">
 *
 * Accent pixels are filled with `var(--px-accent, currentColor)` rather than a
 * literal colour: CSS custom properties inherit into <use> shadow trees, so a
 * card can recolour its accent while the ink follows `currentColor`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "assets", "pixel");
const GRID = 12;

/** `X` = ink, `o` = accent, `.` = empty. Every row must be GRID wide. */
const ICONS = {
  // Object A — software systems & platform solutions
  chip: [
    "....X..X....",
    "....X..X....",
    "..XXXXXXXX..",
    "..X......X..",
    "XXX.oooo.XXX",
    "XXX.oooo.XXX",
    "XXX.oooo.XXX",
    "XXX.oooo.XXX",
    "..X......X..",
    "..XXXXXXXX..",
    "....X..X....",
    "....X..X....",
  ],
  // Object B — systems consulting & modernization
  blueprint: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X...oooo...X",
    "X...oooo...X",
    "X....XX....X",
    "X....XX....X",
    "X..XX..XX..X",
    "X..X....X..X",
    "X.XXX..XXX.X",
    "X.XXX..XXX.X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  // Object C — proprietary products, APIs & data
  stack: [
    "XXXXXXXXXXXX",
    "X..........X",
    "XXXXXXXXXXXX",
    "............",
    "XXXXXXXXXXXX",
    "X..oooooo..X",
    "XXXXXXXXXXXX",
    "............",
    "XXXXXXXXXXXX",
    "X..........X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  // Object D — systems administration & NOC operations
  telemetry: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X..........X",
    "X.....oo...X",
    "X.....oo...X",
    "X.....oo...X",
    "X...XXoo...X",
    "X...XXooXX.X",
    "X.XXXXooXX.X",
    "X.XXXXooXX.X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  // Object E — emerging tech & deep R&D
  spark: [
    ".....XX.....",
    ".....XX.....",
    "....XXXX....",
    "....XXXX....",
    "XX.XXXXXX.XX",
    "XXX.oooo.XXX",
    "XXX.oooo.XXX",
    "XX.XXXXXX.XX",
    "....XXXX....",
    "....XXXX....",
    ".....XX.....",
    ".....XX.....",
  ],
  // Object F — ecosystem alliances & licensing
  network: [
    "XXXX....XXXX",
    "XXXX....XXXX",
    "..XX....XX..",
    "...XX..XX...",
    "....oooo....",
    "...oooooo...",
    "...oooooo...",
    "....oooo....",
    "...XX..XX...",
    "..XX....XX..",
    "XXXX....XXXX",
    "XXXX....XXXX",
  ],
  // partnerships & collaborations — two interlocking links
  link: [
    "............",
    "............",
    ".XXXXXX.....",
    ".X....X.....",
    ".X....X.....",
    ".X...XXXXXX.",
    ".X...oo..X..",
    ".XXXXXX...X.",
    ".....X....X.",
    ".....X....X.",
    ".....XXXXXX.",
    "............",
  ],
  // console prompt
  prompt: [
    "............",
    "..XX........",
    "...XX.......",
    "....XX......",
    ".....XX.....",
    "......XX....",
    "......XX....",
    ".....XX.....",
    "....XX......",
    "...XX.......",
    "..XX...oooo.",
    "............",
  ],
  // secondary call to action
  arrowDown: [
    ".....XX.....",
    ".....XX.....",
    ".....XX.....",
    ".....XX.....",
    ".....XX.....",
    ".....XX.....",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
    ".....XX.....",
    "............",
    "............",
  ],
  // primary call to action
  arrowRight: [
    "............",
    "............",
    "......XX....",
    ".......XX...",
    "........XX..",
    "XXXXXXXXXXX.",
    "XXXXXXXXXXX.",
    "........XX..",
    ".......XX...",
    "......XX....",
    "............",
    "............",
  ],
  // compliance / verification
  check: [
    "............",
    "............",
    "..........XX",
    ".........XX.",
    "........XX..",
    ".XX.....XX..",
    "..XX...XX...",
    "...XX.XX....",
    "....XXX.....",
    ".....X......",
    "............",
    "............",
  ],
  // security posture
  shield: [
    "..XXXXXXXX..",
    ".XX......XX.",
    "XX........XX",
    "XX........XX",
    "XX..oooo..XX",
    "XX..oooo..XX",
    ".XX......XX.",
    "..XX....XX..",
    "...XX..XX...",
    "....XXXX....",
    ".....XX.....",
    "............",
  ],
  // latency / speed
  bolt: [
    ".....XXXX...",
    "....XXXX....",
    "...XXXX.....",
    "..XXXX......",
    "..XXXXXXX...",
    "..XXXXXX....",
    ".....XXX....",
    "....XXX.....",
    "...XXX......",
    "..XXX.......",
    ".XXX........",
    "XXX.........",
  ],
  // database / data fabric
  data: [
    "..XXXXXXXX..",
    ".XX......XX.",
    ".XX......XX.",
    ".XXXXXXXXXX.",
    "............",
    ".XX......XX.",
    ".XX......XX.",
    ".XXXXXXXXXX.",
    "............",
    ".XX......XX.",
    ".XXXXXXXXXX.",
    "............",
  ],
};

/**
 * The brand mark is pixelated from the vector logo by `pixelate-logo.mjs`
 * rather than hand-drawn, so it is read in and appended as extra symbols.
 * Both are themeable like the rest of the sprite: chevrons are `currentColor`,
 * the circuit trace is `var(--px-accent)`.
 */
const BORROWED = [
  ["px-asynk", "assets/logo/mark-pixel-36.svg"],
  ["px-asynk-word", "assets/logo/wordmark-pixel-88.svg"],
];

// ---------------------------------------------------------------------------

function validate(name, map) {
  if (map.length !== GRID) {
    throw new Error(`${name}: expected ${GRID} rows, got ${map.length}`);
  }
  map.forEach((row, i) => {
    if (row.length !== GRID) {
      throw new Error(
        `${name}: row ${i} is ${row.length} chars, expected ${GRID} — "${row}"`,
      );
    }
    if (/[^Xo.]/.test(row)) {
      throw new Error(`${name}: row ${i} has an unknown pixel — "${row}"`);
    }
  });
}

/** Shift a map so its non-empty bounding box is centred on the grid. */
function center(map) {
  const rows = [];
  const cols = [];
  map.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") {
        rows.push(y);
        cols.push(x);
      }
    }),
  );
  if (!rows.length) return map;

  const top = Math.min(...rows);
  const bottom = Math.max(...rows);
  const left = Math.min(...cols);
  const right = Math.max(...cols);

  const dy = Math.round((GRID - (bottom - top + 1)) / 2) - top;
  const dx = Math.round((GRID - (right - left + 1)) / 2) - left;
  if (!dy && !dx) return map;

  const blank = () => Array.from({ length: GRID }, () => Array(GRID).fill("."));
  const grid = blank();
  map.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const ny = y + dy;
      const nx = x + dx;
      if (c !== "." && ny >= 0 && ny < GRID && nx >= 0 && nx < GRID) {
        grid[ny][nx] = c;
      }
    }),
  );
  return grid.map((r) => r.join(""));
}

/**
 * Collapse each row into horizontal runs, so a 12x12 icon becomes a couple of
 * dozen <rect>s instead of 144. `o` and `X` runs are kept separate.
 */
function toRects(map) {
  const rects = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < GRID) {
      const c = row[x];
      if (c === ".") {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < GRID && row[x + w] === c) w++;
      rects.push({
        x,
        y,
        w,
        fill: c === "o" ? "var(--px-accent, currentColor)" : "currentColor",
      });
      x += w;
    }
  });
  return rects;
}

function symbol(id, map) {
  const rects = toRects(center(map))
    .map((r) => `    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join("\n");
  return `  <symbol id="${id}" viewBox="0 0 ${GRID} ${GRID}">\n${rects}\n  </symbol>`;
}

/** camelCase key -> kebab-case symbol id */
const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

const symbols = [];
for (const [name, map] of Object.entries(ICONS)) {
  validate(name, map);
  symbols.push(symbol(`px-${kebab(name)}`, map));
}
for (const [id, rel] of BORROWED) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) {
    console.warn(`  ! ${rel} missing — run tools/pixelate-logo.mjs first`);
    continue;
  }
  const inner = readFileSync(file, "utf8")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>.*?<\/title>/s, "")
    .trim();
  const vb = /viewBox="([^"]+)"/.exec(readFileSync(file, "utf8"))[1];
  symbols.push(`  <symbol id="${id}" viewBox="${vb}">\n${inner}\n  </symbol>`);
}

const sprite =
  `<svg xmlns="http://www.w3.org/2000/svg" class="pixel-sprite" aria-hidden="true" ` +
  `focusable="false" width="0" height="0" style="position:absolute">\n` +
  symbols.join("\n") +
  `\n</svg>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "sprite.svg"), sprite + "\n", "utf8");

// Refresh the inlined sprite region of index.html, if it exists.
const indexPath = resolve(ROOT, "index.html");
const START = "<!-- PIXEL SPRITE:START -->";
const END = "<!-- PIXEL SPRITE:END -->";
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a !== -1 && b !== -1) {
    const next =
      html.slice(0, a + START.length) + "\n" + sprite + "\n" + html.slice(b);
    writeFileSync(indexPath, next, "utf8");
    console.log("index.html ← sprite refreshed");
  } else {
    console.log("index.html has no PIXEL SPRITE markers; skipped");
  }
}

console.log(
  `wrote ${symbols.length} symbol(s) to assets/pixel/ ` +
    `(${sprite.length} bytes of sprite markup)`,
);
