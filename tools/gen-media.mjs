#!/usr/bin/env node
/**
 * Media and preview asset generator for Asynk IO.
 *
 * Generates:
 *   assets/og-image.svg          1200x630 Open Graph card vector
 *   assets/og-image.png          1200x630 social preview card for Twitter/LinkedIn/Slack/WhatsApp
 *   assets/logo/apple-touch-icon.png 180x180 iOS home-screen icon
 *   assets/logo/favicon-32x32.png    32x32 standard browser tab icon
 *   assets/logo/favicon-16x16.png    16x16 standard browser tab icon
 *   assets/logo/icon-192.png         192x192 PWA web manifest icon
 *   assets/logo/icon-512.png         512x512 PWA web manifest splash icon
 *   favicon.ico                      Legacy 32x32 root favicon for browsers and bots
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const LOGO_DIR = resolve(ROOT, "assets", "logo");

// 1. Build the high-resolution Open Graph vector card (1200x630)
const lockupSvg = readFileSync(resolve(LOGO_DIR, "lockup.svg"), "utf8");
const defsMatch = lockupSvg.match(/<defs>([\s\S]*?)<\/defs>/);
const defs = defsMatch ? defsMatch[1] : "";

let lockupPaths = lockupSvg.replace(/<svg[^>]*>[\s\S]*?<\/defs>/, "").replace(/<\/svg>/, "");
// Brighten the letter fills ("A", "s", "y", "n", "k") to off-white #F5F5F1 for maximum contrast on ink dark bg
lockupPaths = lockupPaths
  .replace(/fill="url\(#g3\)"/g, 'fill="#F5F5F1"')
  .replace(/fill="url\(#g7\)"/g, 'fill="#F5F5F1"')
  .replace(/fill="url\(#g9\)"/g, 'fill="#F5F5F1"')
  .replace(/fill="url\(#g8\)"/g, 'fill="#F5F5F1"')
  .replace(/fill="url\(#g4\)"/g, 'fill="#F5F5F1"');

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    ${defs}
    <linearGradient id="bgGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#050811" stop-opacity="1"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.04"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#0A0A0B"/>
  <rect width="1200" height="630" fill="url(#bgGlow)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>

  <!-- Outer frame border -->
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="none" stroke="#27272A" stroke-width="1.5"/>

  <!-- Corner tech brackets -->
  <path d="M 32 60 L 32 32 L 60 32" fill="none" stroke="#CFFF55" stroke-width="3"/>
  <path d="M 1140 32 L 1168 32 L 1168 60" fill="none" stroke="#CFFF55" stroke-width="3"/>
  <path d="M 32 570 L 32 598 L 60 598" fill="none" stroke="#CFFF55" stroke-width="3"/>
  <path d="M 1140 598 L 1168 598 L 1168 570" fill="none" stroke="#CFFF55" stroke-width="3"/>

  <!-- Header Eyebrow -->
  <g transform="translate(80, 85)">
    <rect x="0" y="0" width="8" height="8" fill="#CFFF55"/>
    <text x="20" y="9" fill="#A1A1AA" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" letter-spacing="2">PRACTICAL TECHNOLOGY SOLUTIONS</text>
    <text x="1040" y="9" fill="#71717A" font-family="ui-monospace, Menlo, monospace" font-size="13" text-anchor="end">SYS.ASYNKIO.COM // 2026</text>
  </g>

  <!-- Lockup Logo (Mark + Wordmark) -->
  <g transform="translate(80, 125) scale(0.34)">
    ${lockupPaths}
  </g>

  <!-- Main Headline -->
  <text x="80" y="325" fill="#F5F5F1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="700" letter-spacing="-1">
    Technology Built for What’s Next
  </text>

  <!-- Description Body -->
  <text x="80" y="388" fill="#A1A1AA" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="400">
    We design, develop and deliver practical technology solutions
  </text>
  <text x="80" y="422" fill="#A1A1AA" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="400">
    for individuals, businesses and organisations.
  </text>

  <!-- Service Pills -->
  <g transform="translate(80, 485)">
    <!-- Pill 1 -->
    <rect x="0" y="0" width="170" height="38" rx="8" fill="#18181B" stroke="#27272A" stroke-width="1"/>
    <text x="85" y="24" fill="#E4E4E7" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="500" text-anchor="middle">Custom Software</text>

    <!-- Pill 2 -->
    <rect x="185" y="0" width="130" height="38" rx="8" fill="#18181B" stroke="#27272A" stroke-width="1"/>
    <text x="250" y="24" fill="#E4E4E7" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="500" text-anchor="middle">Consulting</text>

    <!-- Pill 3 -->
    <rect x="330" y="0" width="190" height="38" rx="8" fill="#18181B" stroke="#27272A" stroke-width="1"/>
    <text x="425" y="24" fill="#E4E4E7" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="500" text-anchor="middle">Systems Integration</text>

    <!-- Pill 4 -->
    <rect x="535" y="0" width="180" height="38" rx="8" fill="#18181B" stroke="#27272A" stroke-width="1"/>
    <text x="625" y="24" fill="#E4E4E7" font-family="ui-monospace, Menlo, monospace" font-size="13" font-weight="500" text-anchor="middle">Support &amp; Training</text>
  </g>

  <!-- Domain Tag on Right -->
  <g transform="translate(1040, 506)">
    <text x="0" y="0" fill="#CFFF55" font-family="ui-monospace, Menlo, monospace" font-size="20" font-weight="700" text-anchor="end">asynkio.com &#x2192;</text>
  </g>
</svg>`;

const ogSvgPath = resolve(ROOT, "assets", "og-image.svg");
const ogPngPath = resolve(ROOT, "assets", "og-image.png");
writeFileSync(ogSvgPath, ogSvg, "utf8");
console.log("Wrote assets/og-image.svg");

// Rasterise to 1200x630 PNG via macOS sips
execSync(`sips -s format png "${ogSvgPath}" --out "${ogPngPath}"`, { stdio: "inherit" });
console.log("Rasterised assets/og-image.png (1200x630)");

// 2. Generate PNG favicons and app icons from assets/logo/favicon.svg
const faviconSvg = readFileSync(resolve(LOGO_DIR, "favicon.svg"), "utf8");

const sizes = [
  { size: 16, dest: resolve(LOGO_DIR, "favicon-16x16.png") },
  { size: 32, dest: resolve(LOGO_DIR, "favicon-32x32.png") },
  { size: 180, dest: resolve(LOGO_DIR, "apple-touch-icon.png") },
  { size: 192, dest: resolve(LOGO_DIR, "icon-192.png") },
  { size: 512, dest: resolve(LOGO_DIR, "icon-512.png") },
];

for (const { size, dest } of sizes) {
  const tmpSvg = resolve(ROOT, `_tmp_fav_${size}.svg`);
  const sizedSvg = faviconSvg.replace(/<svg\s+([^>]+)>/, `<svg width="${size}" height="${size}" $1>`);
  writeFileSync(tmpSvg, sizedSvg, "utf8");
  try {
    execSync(`sips -s format png "${tmpSvg}" --out "${dest}"`, { stdio: "pipe" });
    console.log(`Generated ${dest.replace(ROOT + "/", "")} (${size}x${size})`);
  } finally {
    try { unlinkSync(tmpSvg); } catch {}
  }
}

// 3. Generate root favicon.ico (32x32)
const favIco = resolve(ROOT, "favicon.ico");
execSync(`sips -s format ico "${resolve(LOGO_DIR, "favicon-32x32.png")}" --out "${favIco}"`, { stdio: "pipe" });
console.log("Generated favicon.ico (root)");
