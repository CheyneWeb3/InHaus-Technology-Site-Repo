import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const assetsDir = path.join(dist, "assets");
const required = [
  "index.html",
  "src/main.js",
  "src/styles.css",
  "public/projects.json",
  "public/projects.schema.json",
  "public/assets/inhaus-technologies.svg",
  "public/assets/inhaus-mark.svg",
  "public/assets/projects/README.txt"
];

for (const file of required) await access(path.join(root, file));

const catalogueText = await readFile(path.join(root, "public/projects.json"), "utf8");
const catalogue = JSON.parse(catalogueText);
JSON.parse(await readFile(path.join(root, "public/projects.schema.json"), "utf8"));

if (!Array.isArray(catalogue.projects) || catalogue.projects.length < 1) {
  throw new Error("projects.json must contain a projects array");
}

const ids = new Set();
const orders = new Set();
for (const project of catalogue.projects) {
  if (!project.id || !/^[a-z0-9-]+$/.test(project.id)) throw new Error(`Invalid project id: ${project.id}`);
  if (ids.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`);
  ids.add(project.id);

  if (!Number.isInteger(project.order)) throw new Error(`Project order must be an integer: ${project.id}`);
  if (orders.has(project.order)) throw new Error(`Duplicate project order: ${project.order}`);
  orders.add(project.order);

  if (!["System", "Gaming"].includes(project.type)) throw new Error(`Invalid project type: ${project.id}`);

  const media = [
    project.image,
    ...(project.gallery || []).map((item) => typeof item === "string" ? item : item?.src)
  ].filter(Boolean);

  for (const source of media) {
    if (/^(https?:|data:)/i.test(source)) continue;
    const clean = String(source).replace(/^\.\//, "").replace(/^\//, "");
    const localPath = path.join(root, "public", clean);
    const details = await stat(localPath).catch(() => null);
    if (!details?.isFile()) console.warn(`Optional project image not added yet for ${project.id}: ${source}`);
  }
}

const names = catalogue.projects.map((project) => project.name);
for (const forbidden of ["Blockchain Time Machine & Replay Laboratory", "Audit & Investigation Systems"]) {
  if (names.includes(forbidden)) throw new Error(`Obsolete separate auditing project found: ${forbidden}`);
}
if (!names.includes("InHaus Auditing Suite")) throw new Error("InHaus Auditing Suite is missing");

const sourceHtml = await readFile(path.join(root, "index.html"), "utf8");
const sourceCss = await readFile(path.join(root, "src/styles.css"), "utf8");
const sourceJs = await readFile(path.join(root, "src/main.js"), "utf8");
const publicText = `${sourceHtml}\n${catalogueText}`;

for (const forbidden of ["Hayworth", "parent company", "About Cheyne", "Lego", "LEGO", "Discuss a system"]) {
  if (publicText.includes(forbidden)) throw new Error(`Forbidden public wording found: ${forbidden}`);
}
for (const requiredText of ["Let&apos;s Discuss", "id=\"projects\"", "id=\"games\"", "Engineering across the product", "InHaus Auditing Suite"]) {
  if (!publicText.includes(requiredText)) throw new Error(`Required site content missing: ${requiredText}`);
}

const digest = (content) => createHash("sha256").update(content).digest("hex").slice(0, 12);
const cssName = `site.${digest(sourceCss)}.css`;
const jsName = `site.${digest(sourceJs)}.js`;

await rm(dist, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

// Copy public files to the deployment root. Real user-supplied project images remain untouched.
await cp(path.join(root, "public"), dist, { recursive: true });

// Replace stable CSS/JS URLs with content-hashed assets. This prevents Netlify or browser
// caches from mixing a new HTML file with an older stylesheet or script after redeployment.
await writeFile(path.join(assetsDir, cssName), sourceCss);
await writeFile(path.join(assetsDir, jsName), sourceJs);

const safeCatalogue = catalogueText.replaceAll("<", "\\u003c");
let builtHtml = sourceHtml;
builtHtml = builtHtml.replace(
  '<link rel="stylesheet" href="./src/styles.css" />',
  `<link rel="stylesheet" href="./assets/${cssName}" />`
);
builtHtml = builtHtml.replace(
  '  <script type="module" src="./src/main.js"></script>',
  `  <script id="projectCatalogue" type="application/json">${safeCatalogue}</script>\n  <script type="module" src="./assets/${jsName}"></script>`
);
builtHtml = builtHtml.replace(
  "</head>",
  `  <meta name="inhaus-build" content="1.6.3-${digest(sourceCss + sourceJs)}" />\n</head>`
);

if (builtHtml.includes("./src/styles.css") || builtHtml.includes("./src/main.js")) {
  throw new Error("Built HTML still references source CSS or JavaScript paths");
}
if (!builtHtml.includes(`./assets/${cssName}`) || !builtHtml.includes(`./assets/${jsName}`)) {
  throw new Error("Built HTML is missing hashed production assets");
}

await writeFile(path.join(dist, "index.html"), builtHtml);

// Netlify Drop reads this file from the uploaded deployment root.
await writeFile(path.join(dist, "_headers"), `
/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/
  Cache-Control: no-cache, no-store, must-revalidate

/projects.json
  Cache-Control: no-cache, no-store, must-revalidate

/build.json
  Cache-Control: no-cache, no-store, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff
`.trimStart());

const build = {
  name: "InHaus Technologies Business Site",
  version: "1.6.3",
  builtAt: new Date().toISOString(),
  entries: catalogue.projects.length,
  projects: catalogue.projects.filter((project) => project.type === "System").length,
  games: catalogue.projects.filter((project) => project.type === "Gaming").length,
  css: `assets/${cssName}`,
  javascript: `assets/${jsName}`,
  runtime: "Static HTML, CSS and JavaScript",
  deployment: "Drag the dist folder contents or prepared deploy ZIP into Netlify Drop",
  cacheStrategy: "No-cache HTML and JSON; immutable content-hashed CSS and JavaScript"
};

await writeFile(path.join(dist, "build.json"), `${JSON.stringify(build, null, 2)}\n`);
console.log(`Build complete: ${path.relative(root, dist)}/`);
console.log(`Validated ${build.entries} entries (${build.projects} projects, ${build.games} games).`);
console.log(`CSS: ${build.css}`);
console.log(`JS:  ${build.javascript}`);
console.log("Netlify cache mixing is prevented by content-hashed production assets.");
