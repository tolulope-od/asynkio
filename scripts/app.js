/* ==========================================================================
   Asynk IO — interactions
   No dependencies. Everything degrades to working markup without JS:
   the nav is real anchors, the FAQs are real <details>, the form is a real form.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ------------------------------------------------------------------
     Mobile drawer
     ------------------------------------------------------------------ */
  function initDrawer() {
    const btn = $("#menu-btn");
    const drawer = $("#drawer");
    if (!btn || !drawer) return;

    const setOpen = (open) => {
      drawer.dataset.open = String(open);
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Close" : "Menu";
    };

    btn.addEventListener("click", () =>
      setOpen(drawer.dataset.open !== "true"),
    );

    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.dataset.open === "true") {
        setOpen(false);
        btn.focus();
      }
    });

    // The drawer only exists below the nav breakpoint.
    matchMedia("(min-width: 1180px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------
     Scroll spy — marks the nav item for the section in view
     ------------------------------------------------------------------ */
  function initScrollSpy() {
    const links = $$("[data-nav]");
    if (!links.length || !("IntersectionObserver" in window)) return;

    const byId = new Map(links.map((a) => [a.dataset.nav, a]));
    const sections = [...byId.keys()]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const visible = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting);
        }
        const active = sections.find((s) => visible.get(s.id));
        for (const [id, a] of byId) {
          if (active && id === active.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((s) => observer.observe(s));
  }

  /* ------------------------------------------------------------------
     Console — a small service explorer
     ------------------------------------------------------------------ */
  const COMMANDS = {
    services: {
      body: () => [
        "[1] Custom Software & Digital Platforms",
        "[2] Technology Consulting & Digital Transformation",
        "[3] Product Development & Licensing",
        "[4] Systems Integration & Implementation",
        "[5] Support, Maintenance & Training",
        "[6] Innovation & Emerging Technologies",
        "[7] Partnerships & Collaborations",
        "",
        "Pick a number, or ask us about any of these.",
      ],
      tone: "ok",
    },
    process: {
      body: () => [
        "01 Idea       We listen, ask questions and get to grips with the problem.",
        "02 Strategy   We turn complex challenges into a clear, costed plan.",
        "03 Design     We shape the right solution and agree how it will work.",
        "04 Build      We develop and test web, mobile and business applications.",
        "05 Connect    We integrate with your existing systems and go live.",
        "06 Support    We maintain, improve and train your team as you grow.",
      ],
      tone: "info",
    },
    support: {
      body: () => [
        "Keep your systems running smoothly with ongoing technical support",
        "and user training.",
        "",
        "Covers: maintenance, fixes, monitoring, documentation and training",
        "for the software you already run — whether or not we built it.",
      ],
      tone: "info",
    },
    contact: {
      body: () => [
        "Tell us what you're working on and we'll come back with a clear next step.",
        "",
        "Scroll to the contact form on this page, or jump to it from the",
        "'Contact' link in the navigation.",
      ],
      tone: "ok",
    },
    help: {
      body: () => [
        "AVAILABLE: services, process, support, contact, help, clear",
        "Any unrecognised command returns a shell error.",
      ],
      tone: "info",
    },
  };

  function initConsole() {
    const body = $("#console-body");
    const form = $("#console-form");
    const input = $("#console-input");
    if (!body || !form || !input) return;

    const escape = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );

    const scroll = () => {
      body.scrollTop = body.scrollHeight;
    };

    const echo = (text) => {
      body.insertAdjacentHTML(
        "beforeend",
        `<div class="line" style="margin-top:10px"><span class="prompt">guest@asynk<span class="prompt__path">:~$</span></span> <span>${escape(text)}</span></div>`,
      );
    };

    const block = (lines, tone) => {
      body.insertAdjacentHTML(
        "beforeend",
        `<div class="line--block line--${tone}">${lines.map(escape).join("<br>")}</div>`,
      );
      scroll();
    };

    const clear = () => {
      body.innerHTML = `<div class="line line--dim">Console cleared. Pick a command above, or type help.</div>`;
    };

    const run = (raw) => {
      const value = String(raw).trim();
      if (!value) return;

      const token = value.toLowerCase();

      if (token === "clear" || token === "cls") {
        echo(value);
        clear();
        return;
      }

      // Tolerate both `services` and `asynk services`, and `--services`.
      const key = token
        .replace(/^asynk\s+/, "")
        .split(/\s+/)[0]
        .replace(/^--?/, "");
      const cmd = COMMANDS[key];

      echo(value);
      if (cmd) {
        block(cmd.body(), cmd.tone);
      } else {
        block(
          [
            `asynk: command not found: "${value}"`,
            "Type services, process, support, contact, help, or clear.",
          ],
          "err",
        );
      }
    };

    $$("[data-cmd]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmd = btn.dataset.cmd;
        if (cmd === "clear") {
          echo("clear");
          clear();
          return;
        }
        run(cmd);
      });
    });

    const history = [];
    let cursor = -1;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (value) {
        history.push(value);
        cursor = -1;
      }
      run(value);
      input.value = "";
    });

    // Command history, like a real shell.
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") {
        if (!history.length) return;
        cursor = cursor <= 0 ? history.length - 1 : cursor - 1;
        input.value = history[cursor];
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        if (!history.length) return;
        cursor = cursor >= history.length - 1 ? -1 : cursor + 1;
        input.value = cursor === -1 ? "" : history[cursor];
        e.preventDefault();
      }
    });
  }

  /* ------------------------------------------------------------------
     Contact form — inline validation, client-side only
     ------------------------------------------------------------------ */
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldOf(input) {
    return input.closest(".field");
  }

  function setError(input, message) {
    const field = fieldOf(input);
    if (!field) return;
    field.dataset.invalid = message ? "true" : "false";
    const slot = $("[data-error]", field);
    if (slot) slot.textContent = message || "";
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function initContactForm() {
    const form = $("#contact-form");
    const status = $("#form-status");
    const statusText = $("#form-status-text");
    if (!form) return;

    const name = $("#f-name");
    const email = $("#f-email");
    const scope = $("#f-scope");

    [name, email, scope].forEach((input) => {
      if (!input) return;
      input.addEventListener("input", () => {
        if (fieldOf(input)?.dataset.invalid === "true") setError(input, "");
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstBad = null;

      if (!name.value.trim()) {
        setError(name, "Please add your name");
        firstBad ||= name;
      } else setError(name, "");

      if (!EMAIL.test(email.value.trim())) {
        setError(email, "Please add a valid email address");
        firstBad ||= email;
      } else setError(email, "");

      if (scope.value.trim().length > 0 && scope.value.trim().length < 12) {
        setError(scope, "A few more words would help");
        firstBad ||= scope;
      } else setError(scope, "");

      if (firstBad) {
        status.dataset.visible = "false";
        firstBad.focus();
        return;
      }

      // NOTE: nothing is transmitted anywhere. Wire this up to your inbox,
      // a form service, or your own endpoint before going live.
      statusText.textContent =
        `Thanks, ${name.value.trim().split(/\s+/)[0]}. This form is front-end only — ` +
        `connect it to your inbox or a form service to start receiving enquiries.`;
      status.dataset.visible = "true";
      form.reset();
      status.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  /* ------------------------------------------------------------------
     Scroll reveal

     Elements carry `data-reveal` in the markup so the hidden state is applied
     at first paint rather than snapping in once this deferred script runs.
     The `.reveal-on` class that activates that hidden state is only added by
     the head script, and only when the animation will genuinely run — so a
     no-JS page and a reduced-motion page both render fully visible.
     ------------------------------------------------------------------ */
  const HERO_CASCADE = [
    ".ribbon",
    ".hero .eyebrow",
    ".hero .display",
    ".hero .lede",
    ".hero__actions",
  ];

  const STAGGER = [
    { sel: ".quick__card", step: 70, base: 360 },
    { sel: ".service", step: 65 },
    { sel: ".step", step: 55 },
    { sel: ".phase", step: 85 },
    { sel: ".faq__item", step: 55 },
  ];

  const MAX_STAGGER_STEPS = 7;

  function initReveal() {
    const root = document.documentElement;

    // The head script decides whether reveals are on. Nothing to do otherwise.
    if (!root.classList.contains("reveal-on")) return;
    window.__asynkReveal = true;

    if (!("IntersectionObserver" in window)) {
      root.classList.remove("reveal-on");
      return;
    }

    const targets = $$("[data-reveal]");
    if (!targets.length) {
      root.classList.remove("reveal-on");
      return;
    }

    // Hero enters as a cascade rather than all at once.
    HERO_CASCADE.forEach((sel, i) => {
      const el = $(sel);
      if (el && el.hasAttribute("data-reveal")) {
        el.style.setProperty("--reveal-delay", `${i * 80}ms`);
      }
    });

    // Grids stagger per container, not across the whole document.
    for (const { sel, step, base = 0 } of STAGGER) {
      const groups = new Map();
      for (const el of $$(sel)) {
        const parent = el.parentElement;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(el);
      }
      for (const items of groups.values()) {
        items.forEach((el, i) => {
          const stepIndex = Math.min(i, MAX_STAGGER_STEPS);
          el.style.setProperty("--reveal-delay", `${base + stepIndex * step}ms`);
        });
      }
    }

    const reveal = (el) => el.classList.add("is-revealed");

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target);
          obs.unobserve(entry.target);
        }
      },
      // Fire a little before the element reaches the bottom edge.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    initDrawer();
    initReveal();
    initScrollSpy();
    initConsole();
    initContactForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
