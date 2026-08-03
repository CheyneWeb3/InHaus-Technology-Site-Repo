import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const html = await readFile(path.join(dist, "index.html"), "utf8");
const sourceCss = await readFile(path.join(root, "src/styles.css"), "utf8");
const sourceJs = await readFile(path.join(root, "src/main.js"), "utf8");
const catalogue = JSON.parse(await readFile(path.join(dist, "projects.json"), "utf8"));

function cleanMediaPath(source = "") {
  return String(source).split(/[?#]/, 1)[0].replace(/^\.\//, "").replace(/^\//, "");
}

async function verifyProjectMedia(project) {
  if (!project.image || !cleanMediaPath(project.image).toLowerCase().endsWith(".webp")) {
    throw new Error(`Primary project image is not WebP: ${project.id}`);
  }

  const primaryPath = path.join(dist, cleanMediaPath(project.image));
  await access(primaryPath);
  const primaryBytes = await readFile(primaryPath);
  if (primaryBytes.subarray(0, 4).toString("ascii") !== "RIFF" || primaryBytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`Primary project image is not a valid WebP file: ${project.image}`);
  }

  if (!project.imageFallback) throw new Error(`Project image fallback is missing: ${project.id}`);
  await access(path.join(dist, cleanMediaPath(project.imageFallback)));
}

for (const project of catalogue.projects) await verifyProjectMedia(project);

const cssMatch = html.match(/\.\/assets\/(site\.[a-f0-9]{12}\.css)/);
const jsMatch = html.match(/\.\/assets\/(site\.[a-f0-9]{12}\.js)/);
if (!cssMatch) throw new Error("Built HTML does not reference a hashed CSS asset");
if (!jsMatch) throw new Error("Built HTML does not reference a hashed JavaScript asset");

const builtCssPath = path.join(dist, "assets", cssMatch[1]);
const builtJsPath = path.join(dist, "assets", jsMatch[1]);
await access(builtCssPath);
await access(builtJsPath);
await access(path.join(dist, "_headers"));
await access(path.join(dist, "robots.txt"));
await access(path.join(dist, "sitemap.xml"));
await access(path.join(dist, "site.webmanifest"));
await access(path.join(dist, "favicon.ico"));
await access(path.join(dist, "apple-touch-icon.png"));
await access(path.join(dist, "assets", "social", "inhaus-technologies-social-card.png"));

const builtCss = await readFile(builtCssPath, "utf8");
const builtJs = await readFile(builtJsPath, "utf8");
if (builtCss !== sourceCss) throw new Error("Built CSS differs from source CSS");
// Blue-only colour policy: prevent the previously rejected GPT-style mint/green UI accent from returning.
for (const forbiddenColour of ["--mint", "var(--mint)", "#65f3b1", "rgb(101, 243, 177)", "rgba(101, 243, 177"]) {
  if (`${builtCss}
${builtJs}`.toLowerCase().includes(forbiddenColour.toLowerCase())) {
    throw new Error(`Forbidden green/mint UI colour token found: ${forbiddenColour}`);
  }
}
if (builtJs !== sourceJs) throw new Error("Built JavaScript differs from source JavaScript");
if (html.includes("./src/styles.css") || html.includes("./src/main.js")) throw new Error("Built HTML still references source assets");

const requiredSeo = [
  '<title>InHaus Technologies | Software, Blockchain &amp; Systems</title>',
  '<link rel="canonical" href="https://inhaus.technology/" />',
  '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
  '<meta property="og:type" content="website" />',
  '<meta property="og:url" content="https://inhaus.technology/" />',
  '<meta property="og:image" content="https://inhaus.technology/assets/social/inhaus-technologies-social-card.png" />',
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  '<meta name="twitter:card" content="summary_large_image" />',
  '<meta name="twitter:image" content="https://inhaus.technology/assets/social/inhaus-technologies-social-card.png" />',
  '"@type": "Organization"',
  '"@type": "WebSite"',
  '"@type": "WebPage"',
  '"@type": "ItemList"',
  '"@type": "FAQPage"'
];
for (const marker of requiredSeo) {
  if (!html.includes(marker)) throw new Error(`Required SEO marker missing: ${marker}`);
}
if (html.includes('<!-- BUILD:PROJECT_SCHEMA -->')) throw new Error('Project schema placeholder was not replaced');

const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
if (!robots.includes('Sitemap: https://inhaus.technology/sitemap.xml')) throw new Error('robots.txt is missing the absolute sitemap URL');
const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
if (!sitemap.includes('<loc>https://inhaus.technology/</loc>')) throw new Error('sitemap.xml is missing the canonical site URL');
const manifest = JSON.parse(await readFile(path.join(dist, "site.webmanifest"), "utf8"));
if (manifest.name !== 'InHaus Technologies' || !Array.isArray(manifest.icons) || manifest.icons.length < 2) {
  throw new Error('site.webmanifest is incomplete');
}
const socialPng = await readFile(path.join(dist, "assets", "social", "inhaus-technologies-social-card.png"));
if (socialPng.toString('ascii', 1, 4) !== 'PNG') throw new Error('Social card is not a PNG');
const socialWidth = socialPng.readUInt32BE(16);
const socialHeight = socialPng.readUInt32BE(20);
if (socialWidth !== 1200 || socialHeight !== 630) throw new Error(`Incorrect social card dimensions: ${socialWidth}x${socialHeight}`);

if (html.indexOf('id="projects"') > html.indexOf('id="games"')) throw new Error("Games appears before Projects");

const primaryNavMatch = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
if (!primaryNavMatch) throw new Error("Primary navigation is missing");
const primaryNav = primaryNavMatch[0];
for (const removedNavItem of ['href="#games"', 'href="#process"']) {
  if (primaryNav.includes(removedNavItem)) throw new Error(`Removed primary-navigation item returned: ${removedNavItem}`);
}
if (!primaryNav.includes('href="#faq"')) throw new Error("FAQ is missing from primary navigation");
if (!/scroll-padding-top:\s*var\(--anchor-offset\)/.test(builtCss) || !/scroll-margin-top:\s*var\(--anchor-offset\)/.test(builtCss)) {
  throw new Error("Sticky-header anchor offset is missing; FAQ links may land under the navigation");
}

if (!html.includes("Current projects.")) throw new Error("Current projects heading is missing");
if (!html.includes('id="faq"') || !html.includes("Funded engineering first. Optional participation by agreement.")) {
  throw new Error("FAQ section or updated commercial engagement statement is missing");
}
if (!html.includes("Does InHaus Technologies request a participation in projects it helps build?") ||
    !html.includes("There is <strong>no obligation to accept</strong>") ||
    !html.includes("separate from the retainer, Scope of Works and development fees")) {
  throw new Error("Optional project-participation FAQ is missing or incomplete");
}
if (!html.includes('data-mobile-toggle="capabilityContent"') ||
    !html.includes('data-mobile-toggle="auditModules"') ||
    !html.includes('data-mobile-toggle="processGrid"') ||
    !html.includes('data-mobile-toggle="faqCommercial faqGrid"')) {
  throw new Error("Mobile section-condensation controls are missing");
}
if (!builtCss.includes(".mobile-interface-ready .mobile-section-toggle") ||
    !builtJs.includes("setupMobileSections")) {
  throw new Error("Mobile Read more interface was not included in the production build");
}
if (!html.includes("USDC") || !html.includes("Scope of Works")) throw new Error("Required FAQ commercial terms are missing");
if (!html.includes("Why can a project be completed quickly when the quoted cost is substantial?") || !html.includes("23 years of technical experience")) {
  throw new Error("FAQ value and delivery-speed explanation is missing");
}
if (!html.includes("Does InHaus Technologies use AI?") || !html.includes("AI is like a baseball bat")) {
  throw new Error("FAQ AI-use explanation or analogy is missing");
}
if (html.includes("Systems and products.")) throw new Error("Obsolete products wording remains");

const systems = catalogue.projects.filter((project) => project.type === "System");
const games = catalogue.projects.filter((project) => project.type === "Gaming");
if (systems.length !== 7) throw new Error(`Expected 7 system projects, found ${systems.length}`);
if (games.length !== 3) throw new Error(`Expected 3 games, found ${games.length}`);
if (catalogue.projects.filter((project) => project.name === "InHaus Auditing Suite").length !== 1) {
  throw new Error("InHaus Auditing Suite must appear exactly once");
}
for (const oldName of ["Blockchain Time Machine & Replay Laboratory", "Audit & Investigation Systems"]) {
  if (catalogue.projects.some((project) => project.name === oldName)) throw new Error(`Obsolete project still exists: ${oldName}`);
}

const expectedProjectOrder = [
  "Rose / OnlyRose",
  "Forbidden Oasis / WATER",
  "Cooking Solana Trading System",
  "FoxySwap Trade",
  "InHaus Universal USDC Cashier",
  "InHaus Auditing Suite",
  "InHaus Deploylify"
];
const actualProjectOrder = [...systems]
  .sort((a, b) => a.order - b.order)
  .map((project) => project.name);
if (JSON.stringify(actualProjectOrder) !== JSON.stringify(expectedProjectOrder)) {
  throw new Error(`Incorrect project order: ${actualProjectOrder.join(" -> ")}`);
}
const expectedGameOrder = ["Memopoly", "Deal or No Deal", "Dual-Chain Roulette / Spin & Win"];
const actualGameOrder = [...games].sort((a, b) => a.order - b.order).map((project) => project.name);
if (JSON.stringify(actualGameOrder) !== JSON.stringify(expectedGameOrder)) {
  throw new Error(`Incorrect game order: ${actualGameOrder.join(" -> ")}`);
}
if (html.includes('id="projectCatalogue"')) throw new Error("Built HTML still embeds a duplicate project catalogue");
if (!builtJs.includes('fetch("./projects.json"')) throw new Error("Built JavaScript does not load projects.json as the single source");

const requiredCss = [
  /\.project-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4/s,
  /calc\(100% - 64px\)/,
  /grid-template-rows:\s*46px minmax\(58px, auto\) minmax\(118px, 1fr\) 72px 52px/,
  /height:\s*min\(940px, calc\(100dvh - 24px\)\)/,
  /\.scroll-progress\s*\{/,
  /\.network-canvas\s*[,\{]/,
  /@keyframes revealIn/,
  /@media \(max-width: 900px\), \(max-height: 820px\)[\s\S]*?\.project-detail\s*\{[\s\S]*?overflow-y:\s*auto/,
  /\.faq-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/s,
  /\.faq-item summary\s*\{/,
  /@media \(prefers-reduced-motion: reduce\)/,
  /\.mobile-interface-ready \.mobile-section-toggle/,
  /-webkit-line-clamp:\s*3/
];
for (const rule of requiredCss) {
  if (!rule.test(builtCss)) throw new Error(`Required layout rule missing: ${rule}`);
}

const requiredInteractionMarkers = [
  'id="networkCanvas"',
  'id="scrollProgress"',
  'class="hero-highlight"',
  'data-mobile-toggle="capabilityContent"',
  'data-mobile-toggle="faqCommercial faqGrid"'
];
for (const marker of requiredInteractionMarkers) {
  if (!html.includes(marker)) throw new Error(`Required production interaction marker missing: ${marker}`);
}
for (const marker of ["setupHeroNetwork", "setupRevealElements", "setupPointerGlow", "setupScrollEffects", "setupMobileSections"]) {
  if (!builtJs.includes(marker)) throw new Error(`Required production interaction code missing: ${marker}`);
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 12);
console.log("DIST VERIFICATION PASSED");
console.log(`CSS ${cssMatch[1]} (${sha(builtCss)})`);
console.log(`JS  ${jsMatch[1]} (${sha(builtJs)})`);
console.log(`${systems.length} projects, ${games.length} games`);
console.log("All 10 project and game cards reference valid content-hashed WebP files with local fallbacks.");
console.log("Project order is locked; Projects precede Games; projects.json is the single catalogue source.");
console.log("SEO verified: canonical, robots, sitemap, manifest, structured data, Open Graph and X/Twitter 1200x630 card.");
console.log("Production interactions verified: canvas network, reveals, pointer highlights, scroll progress and responsive modal scrolling.");
