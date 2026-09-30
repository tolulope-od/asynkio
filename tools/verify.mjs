#!/usr/bin/env node
/**
 * Verification suite for the Asynk IO site.
 *
 *   node tools/verify.mjs                 # against http://127.0.0.1:4399
 *   CLONE_PORT=8080 node tools/verify.mjs
 *
 * Starts nothing; point it at a running `node server.mjs <port>`.
 *
 * The scroll-reveal checks are the point of this file. Animating content in
 * means content starts hidden, and the failure mode of getting that wrong is a
 * blank page — so the no-JS path, the reduced-motion path and the "app.js never
 * ran" path are each asserted, not assumed.
 */
import { withPage, waitForLoad, evaluate } from "./cdp.mjs";
import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = `http://127.0.0.1:${process.env.CLONE_PORT || 4399}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Pin the viewport — the default headless size is 800x600, which pushes the
 *  hero's lower half below the fold and makes reveal assertions meaningless. */
async function setViewport(send, width = 1440, height = 1000) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
}

async function probe(path = "/") {
  return withPage(async ({ send, events }) => {
    await setViewport(send);
    await waitForLoad(send, ORIGIN + path, 3000);
    return {
      exceptions: events.filter((e) => e.method === "Runtime.exceptionThrown").length,
      consoleErrors: events.filter(
        (e) =>
          e.method === "Runtime.consoleAPICalled" &&
          ["error", "warning", "assert"].includes(e.params.type),
      ).length,
    };
  });
}

/** Count elements that are still invisible (opacity 0) anywhere on the page. */
const INVISIBLE = `[...document.querySelectorAll("[data-reveal]")].filter(e=>getComputedStyle(e).opacity==="0").length`;

try {
  console.log(`\n1. Page loads clean (${ORIGIN})`);
  const { exceptions, consoleErrors } = await probe("/");
  record("no exceptions", exceptions === 0, `exceptions=${exceptions}`);
  record("no console errors", consoleErrors === 0, `console=${consoleErrors}`);

  console.log("\n2. Scroll reveal — normal motion");
  const reveal = await withPage(async ({ send }) => {
    await setViewport(send);
    await waitForLoad(send, ORIGIN + "/", 3000);
    const armed = await evaluate(send, `document.documentElement.classList.contains("reveal-on")`);
    const total = await evaluate(send, `document.querySelectorAll("[data-reveal]").length`);
    const heroVisible = await evaluate(
      send,
      `[".ribbon",".display",".lede",".hero__actions"].every(s=>getComputedStyle(document.querySelector(s)).opacity==="1")`,
    );
    const progression = [];
    for (const y of [0, 900, 2100, 3000, 3800, 4700, 5500, 6600]) {
      await evaluate(send, `window.scrollTo(0, ${y}); 'ok'`);
      await sleep(1100);
      progression.push(
        await evaluate(send, `document.querySelectorAll("[data-reveal].is-revealed").length`),
      );
    }
    const stillHidden = await evaluate(send, INVISIBLE);
    return { armed, total, heroVisible, progression, stillHidden };
  });
  record("reveal styles armed", reveal.armed === true);
  record("hero visible without scrolling", reveal.heroVisible === true);
  record(
    "reveals progress with scroll",
    reveal.progression.every((n, i, a) => i === 0 || n >= a[i - 1]) &&
      reveal.progression.at(-1) === reveal.total,
    `${reveal.progression.join(" → ")} of ${reveal.total}`,
  );
  record("nothing left hidden", reveal.stillHidden === 0, `hidden=${reveal.stillHidden}`);

  console.log("\n3. Fallback — prefers-reduced-motion: reduce");
  const reduced = await withPage(async ({ send }) => {
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await waitForLoad(send, ORIGIN + "/", 3000);
    return {
      armed: await evaluate(send, `document.documentElement.classList.contains("reveal-on")`),
      hidden: await evaluate(send, INVISIBLE),
      total: await evaluate(send, `document.querySelectorAll("[data-reveal]").length`),
    };
  });
  record("reveal styles not armed", reduced.armed === false);
  record("all content visible", reduced.hidden === 0, `${reduced.total} elements`);

  console.log("\n4. Fallback — JavaScript disabled");
  const noJs = await withPage(async ({ send }) => {
    await send("Emulation.setScriptExecutionDisabled", { value: true });
    await waitForLoad(send, ORIGIN + "/", 2500);
    return {
      hidden: await evaluate(send, INVISIBLE),
      sections: await evaluate(send, `document.querySelectorAll("section").length`),
      h1: await evaluate(send, `document.querySelector("h1")?.textContent.trim() ?? null`),
    };
  });
  record("all content visible", noJs.hidden === 0);
  record("content still present", noJs.sections > 0 && !!noJs.h1, `h1="${noJs.h1}"`);

  console.log("\n5. Fallback — app.js never runs (reveal armed, no observer)");
  const orphaned = await withPage(async ({ send }) => {
    await setViewport(send);
    await waitForLoad(send, ORIGIN + "/", 3000);
    const before = await evaluate(send, INVISIBLE);
    // Simulate the boot failing after the head script armed the styles.
    await evaluate(
      send,
      `document.documentElement.classList.add("reveal-on"); window.__asynkReveal=false; 'ok'`,
    );
    const armed = await evaluate(send, INVISIBLE);
    await sleep(3400); // head script's safety net fires at 3s
    return {
      before,
      armed,
      after: await evaluate(send, INVISIBLE),
      classGone: await evaluate(
        send,
        `!document.documentElement.classList.contains("reveal-on")`,
      ),
    };
  });
  record("safety net exposes content again", orphaned.after === 0 && orphaned.classGone, `hidden ${orphaned.armed} → ${orphaned.after}`);

  console.log("\n6. Layout");
  for (const w of [360, 390, 768, 1024, 1180, 1280, 1440, 1920]) {
    const over = await withPage(async ({ send }) => {
      await send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: 900,
        deviceScaleFactor: 1,
        mobile: w < 700,
      });
      await waitForLoad(send, ORIGIN + "/", 2200);
      return evaluate(
        send,
        `JSON.stringify({over:document.documentElement.scrollWidth>window.innerWidth,sw:document.documentElement.scrollWidth})`,
      );
    });
    const { over: hasOverflow } = JSON.parse(over);
    record(`no horizontal overflow @ ${w}px`, hasOverflow === false);
  }

  console.log("\n7. Accessibility");
  const a11y = await withPage(async ({ send }) => {
    await setViewport(send);
    await waitForLoad(send, ORIGIN + "/", 2500);
    return JSON.parse(
      await evaluate(
        send,
        `JSON.stringify({
          iconsTotal: document.querySelectorAll("svg[viewBox='0 0 12 12']").length,
          iconsExposed: [...document.querySelectorAll("svg[viewBox='0 0 12 12']")].filter(s=>!s.hasAttribute("aria-hidden")&&!s.hasAttribute("role")).length,
          unlabelled: [...document.querySelectorAll("input,select,textarea")].filter(el=>!(el.labels&&el.labels.length)&&!el.getAttribute("aria-label")).length,
          unnamed: [...document.querySelectorAll("button,a")].filter(el=>!el.textContent.trim()&&!el.getAttribute("aria-label")).length,
          levels: [...new Set([...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(h=>h.tagName))],
          lang: document.documentElement.lang,
          skip: !!document.querySelector(".skip")
        })`,
      ),
    );
  });
  record("decorative icons hidden", a11y.iconsExposed === 0, `${a11y.iconsTotal} icons`);
  record("form controls labelled", a11y.unlabelled === 0);
  record("controls have names", a11y.unnamed === 0);
  record("heading levels", a11y.levels.join(",") === "H1,H2,H3", a11y.levels.join(","));
  record("lang + skip link", a11y.lang === "en" && a11y.skip);
} finally {
  /* nothing to tear down */
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? ` — ${failed.length} FAILED` : ""),
);
process.exit(failed.length ? 1 : 0);
