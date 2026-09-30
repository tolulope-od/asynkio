#!/usr/bin/env node
/**
 * Tiny CDP driver used to render and verify the clone.
 *
 * Connects to a throwaway headless Chrome (own --user-data-dir, never a user
 * browser instance) and exposes the few operations the verification pass needs:
 * full-page screenshots, viewport resize, clicking, and console/network logs.
 *
 * Usage: node tools/cdp.mjs <command> [args]
 *   shot <url> <out.png> [width] [height] [fullPage]
 *   interact <url> <outDir> <width> <height>   (drives menu / FAQ / pricing)
 *   probe <url>                                 (console + failed requests)
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9411 + Math.floor(Math.random() * 200);
export const CLONE_PORT = Number(process.env.CLONE_PORT || 4321);
export const CLONE_ORIGIN = `http://127.0.0.1:${CLONE_PORT}`;
const PROFILE = `/tmp/asynk-cdp-${process.pid}`;

let child;

async function launch() {
  child = spawn(
    CHROME,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-dev-shm-usage",
      "--disable-crash-reporter",
      "--disable-breakpad",
      "--disable-features=Crashpad",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--user-data-dir=" + PROFILE,
      `--remote-debugging-port=${PORT}`,
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );

  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("chrome did not expose a devtools endpoint");
}

export async function withPage(fn) {
  await launch();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
    } else if (data.method) {
      events.push(data);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    return await fn({ send, events });
  } finally {
    ws.close();
    if (child) child.kill("SIGKILL");
  }
}

export async function evaluate(send, expression) {
  const { result } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.value;
}

export async function waitForLoad(send, url, settleMs = 2500) {
  await send("Page.navigate", { url });
  await sleep(settleMs);
}

export async function shot(send, outPath, { width, height, fullPage }) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await sleep(700);
  const params = { format: "png", captureBeyondViewport: !!fullPage };
  if (fullPage) {
    const { contentSize } = await send("Page.getLayoutMetrics");
    params.clip = {
      x: 0,
      y: 0,
      width: Math.ceil(contentSize.width),
      height: Math.ceil(contentSize.height),
      scale: 1,
    };
  }
  const { data } = await send("Page.captureScreenshot", params);
  mkdirSync(outPath.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(outPath, Buffer.from(data, "base64"));
  return outPath;
}

// ---------------------------------------------------------------------------
// CLI entry point — only when run directly (`node tools/cdp.mjs …`), so that
// sibling tools can import the helpers without triggering the argument parser.
import { pathToFileURL } from "node:url";

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

const [command, ...args] = isDirectRun ? process.argv.slice(2) : [];

if (!isDirectRun) {
  // imported as a library: export only
} else if (command === "shot") {
  const [url, out, w = 1440, h = 900, full = "true", scrollY = "0", extraDelay = "0"] = args;
  await withPage(async ({ send }) => {
    await waitForLoad(send, url, 2500 + Number(extraDelay));
    if (Number(scrollY) > 0) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: Number(w),
        height: Number(h),
        deviceScaleFactor: 1,
        mobile: Number(w) < 700,
      });
      await evaluate(send, `window.scrollTo(0, ${Number(scrollY)}); 'ok'`);
      await sleep(1200);
    }
    await shot(send, out, {
      width: Number(w),
      height: Number(h),
      fullPage: full !== "false",
    });
    console.log("saved", out);
  });
} else if (command === "eval") {
  const [url, js, scroll = "0", waitMs = "1500", vw = "", vh = ""] = args;
  await withPage(async ({ send, events }) => {
    if (vw) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: Number(vw),
        height: Number(vh || 900),
        deviceScaleFactor: 1,
        mobile: Number(vw) < 700,
      });
    }
    await waitForLoad(send, url, 3500);
    if (Number(scroll) > 0) {
      await evaluate(send, `window.scrollTo(0, ${Number(scroll)}); 'ok'`);
      await sleep(Number(waitMs));
    }
    const out = await evaluate(send, js);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 1));
    const errs = events.filter((e) => e.method === "Runtime.exceptionThrown");
    if (errs.length) {
      console.log(`\n!! ${errs.length} uncaught exception(s):`);
      for (const e of errs.slice(0, 8)) {
        console.log("  -", JSON.stringify(e.params.exceptionDetails).slice(0, 400));
      }
    }
  });
} else if (command === "net") {
  const [url, scroll = "0", filter = "", clickText = ""] = args;
  await withPage(async ({ send, events }) => {
    await send("Network.enable");
    await send("Page.navigate", { url });
    await sleep(3500);
    if (Number(scroll) > 0) {
      await evaluate(send, `window.scrollTo(0, ${Number(scroll)}); 'ok'`);
      await sleep(3000);
    }
    if (clickText) {
      await evaluate(
        send,
        `(()=>{const el=[...document.querySelectorAll("button,a")].find(x=>x.textContent.trim()===${JSON.stringify(clickText)});if(el){el.click();return "clicked"}return "not found"})()`,
      );
      await sleep(3000);
    }
    const reqs = new Map();
    for (const e of events) {
      if (e.method === "Network.requestWillBeSent") {
        reqs.set(e.params.requestId, {
          url: e.params.request.url,
          status: null,
          type: e.params.type,
        });
      }
      if (e.method === "Network.responseReceived") {
        const r = reqs.get(e.params.requestId);
        if (r) r.status = e.params.response.status;
      }
      if (e.method === "Network.loadingFailed") {
        const r = reqs.get(e.params.requestId);
        if (r) r.status = "FAILED:" + e.params.errorText;
      }
    }
    const rows = [...reqs.values()].filter(
      (r) => !filter || r.url.includes(filter),
    );
    console.log(`${rows.length} request(s)` + (filter ? ` matching "${filter}"` : ""));
    for (const r of rows) console.log(`  ${String(r.status).padEnd(14)} ${r.type.padEnd(10)} ${r.url.slice(0, 150)}`);
  });
} else if (command === "dom") {
  const [url, selector, scroll = "0"] = args;
  await withPage(async ({ send }) => {
    await waitForLoad(send, url, 3000);
    if (Number(scroll) > 0) {
      await evaluate(send, `window.scrollTo(0, ${Number(scroll)}); 'ok'`);
      await sleep(2500);
    }
    const info = await evaluate(
      send,
      `(() => {
         const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
         return JSON.stringify(nodes.slice(0, 14).map(n => ({
           tag: n.tagName.toLowerCase(),
           cls: n.getAttribute('class'),
           src: n.getAttribute('src'),
           srcset: n.getAttribute('srcset'),
           style: n.getAttribute('style'),
           complete: n.complete,
           naturalW: n.naturalWidth,
           naturalH: n.naturalHeight,
           currentSrc: n.currentSrc,
           rect: (({top,height}) => ({top: Math.round(top + window.scrollY), h: Math.round(height)}))(n.getBoundingClientRect()),
         })), null, 1);
       })()`,
    );
    console.log(info);
  });
} else if (command === "geometry") {
  const [url] = args;
  await withPage(async ({ send }) => {
    await waitForLoad(send, url, 3500);
    const info = await evaluate(
      send,
      `JSON.stringify([...document.querySelectorAll('[id], section, video, .carousel, [data-sentry-component]')]
        .map(n => ({ id: n.id || null, tag: n.tagName.toLowerCase(),
                     top: Math.round(n.getBoundingClientRect().top + window.scrollY),
                     h: Math.round(n.getBoundingClientRect().height) }))
        .filter(n => n.h > 20), null, 1)`,
    );
    console.log(info);
  });
} else if (command === "probe") {
  const [url] = args;
  await withPage(async ({ send, events }) => {
    await waitForLoad(send, url, 4000);
    const errs = events.filter(
      (e) =>
        e.method === "Runtime.exceptionThrown" ||
        (e.method === "Log.entryAdded" && e.params.entry.level === "error"),
    );
    const consoleMsgs = events.filter(
      (e) =>
        e.method === "Runtime.consoleAPICalled" &&
        ["error", "warning", "assert"].includes(e.params.type),
    );
    console.log("exceptions/log errors:", errs.length);
    for (const e of errs.slice(0, 12)) {
      const d = e.params.exceptionDetails;
      if (d) {
        console.log(`  - EXCEPTION: ${d.exception?.description || d.text}`);
      } else {
        console.log(`  - ${e.params.entry.level}: ${e.params.entry.text} ${e.params.entry.url || ""}`);
      }
    }
    console.log("console error/warning:", consoleMsgs.length);
    for (const e of consoleMsgs.slice(0, 20)) {
      const text = e.params.args
        .map((a) => a.value ?? a.description ?? a.type)
        .join(" ");
      console.log("  *", text.slice(0, 500).replace(/\n/g, "\n     "));
    }
    const info = await evaluate(
      send,
      `JSON.stringify({
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map(n=>n.textContent.trim()),
        sections: [...document.querySelectorAll('section,[id]')].map(n=>n.id).filter(Boolean),
        imgs: document.images.length,
        brokenImgs: [...document.images].filter(i=>i.complete && i.naturalWidth===0).length,
        bodyHeight: document.body.scrollHeight,
        hydrated: !!document.querySelector('#__next, body'),
      })`,
    );
    console.log("page:", info);
  });
} else {
  console.error("unknown command");
  process.exit(1);
}
