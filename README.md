# Asynk IO

A single-page marketing site for the fictional **Asynk IO**, built from the pasted
SYNTAXIS design and re-skinned as a light, paper-toned site with a lime accent.
No build step, no dependencies, no external requests.

```bash
node server.mjs          # → http://127.0.0.1:4321/
node server.mjs 8080     # custom port
```

Any static host will serve the folder as-is; `server.mjs` only adds clean URLs,
correct MIME types and cache headers.

### Caching

`server.mjs` sends an ETag with every response and `cache-control: no-cache` for
anything editable (HTML, CSS, JS, the sprite, the favicon), so a browser always
revalidates and gets a cheap `304` when nothing changed. Only the fonts — whose
bytes never change and whose filenames are not content-hashed — get
`max-age=31536000, immutable`.

This matters more than it looks: an earlier version of this server marked *every*
non-HTML file `immutable` for a year. Rewriting `app.css` then left browsers
serving the **old stylesheet against new markup** — `immutable` means the cache is
not even revalidated on a normal reload — which strips the card layout entirely.
Never long-cache a non-fingerprinted asset you might edit.

The `?v=2` suffixes in `index.html` are a one-time cache-buster to escape that
already-poisoned entry; they are not needed for future edits.

---

## The copy

The supplied copy is used **verbatim** where it was given, and drives the page:

| Supplied | Where it landed |
|---|---|
| “Technology Built for What’s Next” | `<h1>` |
| “We design, develop and deliver practical technology solutions for individuals, businesses and organisations.” | Hero lede, footer, and the opening FAQ answer |
| “What We Do” | Services section heading |
| The seven service titles and one-line descriptions | Seven service cards, in the given order |
| “From idea to implementation, we create technology that helps your business grow.” | The full-width statement bar closing the services section |

That text covers the headline, the intro and the services. The remaining sections
needed copy of their own, so it was written to match — and deliberately kept to
**process and positioning, never invented facts**:

- **How We Work** — six stages (Idea → Strategy → Design → Build → Connect →
  Support), each rewritten from the supplied service descriptions. The diagram is
  labelled with those stages instead of infrastructure jargon.
- **Why Us** — four cards whose body copy is lifted directly from four of the
  supplied service descriptions.
- **FAQs** — six questions built only from facts already in the supplied copy.
- **Contact** — a plain enquiry form.
- **Explore** — the interactive console, reframed as a way to browse the services.

### Claims that were removed

The design this was adapted from carried a lot of enterprise theatre. None of it
was supplied, and all of it would have been a fabricated claim about this
business, so it was removed rather than reworded:

- fake SLA and scale metrics (`99.999%`, `42 cluster zones`, `0.42 ms median latency`)
- fake certifications (`ISO/IEC 27001`, `SOC 2 TYPE II`, `HIPAA HITECH`, `GDPR Art. 28`)
- fake cryptography (`ZK-STARK v2.1`, `KYBER-1024 / DILITHIUM-5`, `AES-256-GCM`)
- the invented legal charter (“Objects of Incorporation”, `CORP.OBJ.A`) and
  charter-ID / coordinate / spec-revision telemetry

The hero’s four stat tiles became four scannable entry points (Build / Advise /
Connect / Support), and the charter accordion became the FAQ.

> **The forms do not send anything.** They validate inline and say so in the
> confirmation. Wire `#contact-form` up to your inbox, a form service or your own
> endpoint, then replace the message in `scripts/app.js` (`initContactForm`).

---

## The design direction

The source design was a dark, high-contrast “system console” aesthetic. This
version keeps its **structure** — the service grid, the lifecycle pipeline, the
value-card row, the interactive terminal, the intake console — and rebuilds the
surface as light, paper-toned UI:

| | |
|---|---|
| **Page** | Off-white paper `#F5F5F1`, white cards, 1px warm hairlines |
| **Ink** | Near-black `#0A0A0B` with a two-step muted grey for secondary text |
| **Accent** | A lime `#CFFF55` for the primary CTA and pixel accents |
| **Support** | Cyan `#0D7F8C` and violet `#6B3FD4` carry the telemetry accents the dark design leaned on |
| **Console** | The one dark surface — a black terminal inset into the light page, so the “system” motif survives |
| **Type** | Inter for display/body, Pixelify Sans for the pixel chrome, JetBrains Mono in the console, Kalam for one hand-drawn annotation — all SIL OFL, all self-hosted |
| **Motion** | Short, sharp easings; everything collapses under `prefers-reduced-motion` |

## The logo

The brand mark was supplied as a bitmap and is **recreated here as vector**, not
re-hosted: alpha threshold → marching squares → closed contours →
Douglas-Peucker simplification → hole nesting → per-contour two-stop gradient
fitting → SVG. The trace was a one-off build step, so the tooling is not shipped;
the output is committed as ordinary SVG that can be hand-edited from here on.

Four assets come out of that, all with clean geometry and no raster fallback:

| Asset | Use | Size |
|---|---|---|
| [`assets/logo/mark.svg`](assets/logo/mark.svg) | the mark alone — header, anywhere compact | 3.9 KB |
| [`assets/logo/wordmark.svg`](assets/logo/wordmark.svg) | the "AsynkIO" lockup alone | 8.1 KB |
| [`assets/logo/lockup.svg`](assets/logo/lockup.svg) | mark + wordmark — footer, OG image | 11.8 KB |
| [`assets/logo/favicon.svg`](assets/logo/favicon.svg) | pixel mark on an ink tile, for the tab bar | 3.7 KB |

Palette read straight off the source: deep navy `#06122A`–`#122750` for the
chevrons and "Asynk", mid blue `#07346E`–`#067EE0`, and bright cyan
`#02B0FE`–`#1AB1FF` for the circuit trace and "IO".

### The pixel version

The UI does not use the vector logo. `tools/pixelate-logo.mjs` rasterises
`mark.svg` onto a small grid, classifies every cell (empty / ink / accent) and
re-emits it as flat 1px rectangles — the same technique `gen-assets.mjs` uses for
the hand-drawn icons, but derived from the vector mark rather than drawn by hand.

```bash
node server.mjs 4399 &
node tools/pixelate-logo.mjs 36              # header mark        -> mark-pixel-36.svg
node tools/pixelate-logo.mjs 88 --source=wordmark   # wordmark    -> wordmark-pixel-88.svg
node tools/pixelate-logo.mjs 22 --favicon    # tab icon           -> favicon.svg
node tools/gen-assets.mjs                    # folds both into the sprite
```

The output is themeable, so the colours are CSS, not baked in: the chevron mass
is `currentColor` and the circuit trace is `var(--px-accent)`. The header sets
`color: var(--paper)` and `--px-accent: var(--lime)` on an **ink tile** — the
site's two signature colours — so the mark reads as paper chevrons with a lime
trace on black:

```css
.brand__mark { background: var(--ink); color: var(--paper); --px-accent: var(--lime); }
.brand__mark svg { width: 36px; height: 33px; shape-rendering: crispEdges; }
```

Two details make it render as actual pixel art rather than a blurry small image:

- **The grid size is chosen to match the display size.** The mark is a 36×33 grid
  shown at exactly 36×33 CSS px, and the wordmark is 88×23 at 88×23, so each cell
  lands on one pixel (and two device pixels at DPR 2). Rendering a 44-wide grid at
  29px — which the first attempt did — makes every cell sub-pixel and smears it.
- `shape-rendering: crispEdges` keeps the edges hard.

36×33 was picked after comparing 22 / 33 / 36 / 44 / 55 grids: below ~33 the
circuit trace and its via rings stop resolving, and above 44 the header mark
would have to grow to stay 1:1.

The vector originals (`mark.svg`, `wordmark.svg`, `lockup.svg`) are kept — they
are the faithful brand reproduction and `lockup.svg` is still the OG image.

### Typography

Three roles, all SIL Open Font License and all self-hosted (still zero external
requests):

| Role | Face | Why |
|---|---|---|
| Display + body | **Inter** | Neutral, well-hinted grotesque; measures within 1% of the original across the nav and button strings |
| Chrome — labels, tags, eyebrows, nav, buttons | **Pixelify Sans** | A genuine pixel face, so the pixel identity carries through the type and not just the icons — and it is 0.87× the width of the face it replaced, so nothing had to be re-tuned |
| Console | **JetBrains Mono** | Real monospace: the terminal output is column-formatted, and a proportional face would ragged it |
| One annotation | **Kalam** | The hand-drawn “go ahead, type a command” note |

The chrome/console split is deliberate. Pixelifying the terminal too would look
right but break the aligned columns in the `process` output, and mono-ing the
chrome would drop the pixel identity. Each role gets the face it needs.

### Pixel assets

No bitmaps, no icon font. Every icon is **pixel art drawn on a 12×12 grid** and
emitted as an SVG sprite symbol, so it stays crisp at any size and inherits colour
from CSS.

Icons are authored as ASCII maps in [`tools/gen-assets.mjs`](tools/gen-assets.mjs):

```js
spark: [
  ".....XX.....",
  ".....XX.....",
  "....XXXX....",
  "XX.XXXXXX.XX",
  "XXX.oooo.XXX",   // o = accent pixel
  ...
]
```

The generator validates every row, optically centres the drawing, merges each row
into horizontal runs (a 12×12 icon becomes ~25 `<rect>`s, not 144), and emits the
sprite. Ink pixels use `currentColor`; accent pixels use
`var(--px-accent, currentColor)`. CSS custom properties inherit into `<use>` shadow
trees, which is what lets one symbol render lime in one card and cyan in the next.

Regenerate after editing a map:

```bash
node tools/gen-assets.mjs
```

That also refreshes the sprite inlined into `index.html` between the
`PIXEL SPRITE:START/END` markers, and rewrites `assets/pixel/logo.svg` and
`favicon.svg`. Fifteen symbols: seven service icons, prompt, two arrows, check,
shield, bolt, data, and the “A” monogram.

---

## What was fixed from the source

The pasted design was a Google-Stitch-style export with a runtime Tailwind CDN and
several things that did not work at all:

| Issue in the source | Resolution |
|---|---|
| `cdn.tailwindcss.com` (in-browser JIT; the docs say never ship it) | Replaced with two authored stylesheets: `tokens.css` (design tokens) + `app.css` (components). No runtime compiler, no FOUC. |
| Google Fonts + Material Symbols fetched from `fonts.googleapis.com` | Fonts self-hosted in `assets/fonts/`. Material Symbols dropped entirely, replaced by the pixel sprite. |
| Logo loaded from `lh3.googleusercontent.com/aida/…` (a generated-asset host that will rot) | Local pixel monogram plus an SVG favicon. |
| Invalid SVG attributes — `viewbox`, `attributename`, `repeatcount` (SVG is case-sensitive, so the animation never ran) | Correct markup; the trace animation is CSS `stroke-dashoffset`, so it also honours `prefers-reduced-motion`. |
| Nav items were `href="#"` with a `data-path` attribute nothing consumed | Real anchors to the six sections, with an `IntersectionObserver` scroll-spy. |
| Nav hidden below `xl` with **no mobile fallback** — unusable on phones | Accessible hamburger + drawer: `aria-expanded`, `aria-controls`, Escape to close, closes on link tap and on resize past the breakpoint. |
| Inline `onclick=` handlers and globals | All behaviour moved to `scripts/app.js` behind event listeners. |
| Terminal used `innerHTML +=` with unescaped user input | Input is escaped before it reaches the DOM. |
| Header CTAs and nav labels wrapped onto two lines | `white-space: nowrap` with deliberate breakpoints for the status pill, header CTA and brand tagline. |
| Fixed header overlapped the first line of content | `main { padding-top: var(--header-h) }` + `scroll-padding-top` for anchor jumps. |
| Console printed the prompt and command on separate, indented lines | `white-space: pre-wrap` was faithfully reproducing the markup’s own indentation; static lines are emitted without internal newlines. |

## Scroll reveal

Sections animate in as you scroll. Elements carry `data-reveal` **in the markup**,
so the hidden state is applied at first paint rather than snapping in once the
deferred script runs; a single `IntersectionObserver` adds `.is-revealed` as each
one enters the viewport, and it unobserves immediately.

- **Hero** cascades in on load (80 ms apart), then the four entry tiles follow
  (70 ms apart, 360 ms base).
- **Grids stagger per container**, not across the document: services 65 ms, steps
  55 ms, value cards 85 ms, FAQs 55 ms, capped at 7 steps so a long grid never
  runs away.
- Timing is a 0.72 s `cubic-bezier(0.16, 1, 0.3, 1)` fade + 22px rise.

Three deliberate choices:

1. **It animates, it does not transition.** A `transition` on `[data-reveal]`
   would out-specify each component's own `transition`, and every card's hover
   lift would lose its timing. Using `animation` keeps them independent —
   which is also why the reveal moves `translate` (the individual property)
   rather than `transform`, so it composes with the hover `transform`.
2. **The hidden state is opt-in, from `<head>`.** A tiny inline script adds
   `.reveal-on` to `<html>` only when `prefers-reduced-motion` is *not* set and
   JS is running. No JS → the class is never added → every element renders
   visible. The CSS keys off `.reveal-on`, never off `[data-reveal]` alone.
3. **There is a safety net.** If `app.js` fails to boot after arming, a 3 s timer
   in that same head script removes `.reveal-on` rather than leaving a blank
   page. The failure mode of scroll animation is a page with no content, so it
   is defended twice.

All three fallbacks are asserted by `tools/verify.mjs`, not assumed.

## What was added

- **Interactive console** that works: `services`, `process`, `support`, `contact`,
  `help`, `clear`, tolerant of both `services` and `asynk services`, with ↑/↓
  command history. Runs entirely client-side.
- **Contact form** with inline per-field validation, `aria-invalid` and focus
  management.
- **FAQ** as native `<details>` — keyboard accessible, works without JS.
- **Scroll-spy** navigation.
- **Scroll reveal** with per-container stagger (see above).
- Responsive from 320px up: the service grid goes 1 → 2 → 3 columns, the pipeline
  stepper 1 → 2 → 6, value cards 1 → 2 → 4.

---

## Verified

| Check | Result |
|---|---|
| Console errors / warnings | **0** (desktop and mobile) |
| Assets revalidate | `no-cache` + ETag on HTML/CSS/JS; `304` on repeat requests |
| Uncaught exceptions | **0** |
| Network requests | **8, all same-origin** — no external host is contacted |
| Form controls with an accessible name | 100% |
| Decorative icons hidden from assistive tech | 35 / 35 |
| Heading outline | `h1 → h2 → h3`, no skipped levels |
| Horizontal overflow | none at 390px or 1440px |
| Drawer, FAQ, console, contact form | Behaviours asserted programmatically |
| Scroll reveal | 43/43 targets fire progressively; none left hidden |
| Reveal fallbacks | reduced-motion, JS disabled, and `app.js`-failed all render fully visible |
| Horizontal overflow | none at 360 / 390 / 768 / 1024 / 1180 / 1280 / 1440 / 1920px |

Run it with:

```bash
node server.mjs 4399 &
node tools/verify.mjs        # 24 checks
```

Screenshots of every section are in [`screenshots/`](screenshots/).

## Layout

```
asynk-io/
├── index.html              the page (pixel sprite inlined between markers)
├── server.mjs              static server
├── styles/
│   ├── tokens.css          palette, type, spacing, elevation, @font-face
│   └── app.css             components and layout
├── scripts/app.js          drawer, scroll-spy, console, contact form
├── assets/
│   ├── fonts/              self-hosted woff2 (all SIL OFL)
│   ├── logo/               mark, wordmark, lockup, favicon (vector)
│   └── pixel/              generated icon sprite
├── tools/
│   ├── gen-assets.mjs      pixel-map → SVG sprite generator
│   ├── cdp.mjs             minimal Chrome DevTools Protocol driver
│   └── verify.mjs          24-check verification suite
└── screenshots/
```

## Notes

- **Logo** is vector-recreated from the supplied bitmap; the site's accent palette
  (lime on off-white) is deliberately *not* the brand's (navy and cyan) — say the
  word if you want the UI palette moved onto the brand colours.
- **Fonts** are Inter, Pixelify Sans, JetBrains Mono and Kalam — all SIL Open
  Font License, downloaded from Google Fonts and self-hosted. No commercial or
  third-party-owned typefaces are bundled, so there is nothing to licence before
  using this.
