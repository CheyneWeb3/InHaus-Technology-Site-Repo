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
  "public/assets/projects/README.txt",
  "public/assets/social/inhaus-technologies-social-card.png",
  "public/site.webmanifest",
  "public/sitemap.xml",
  "public/robots.txt",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png"
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

  if (!project.image || !String(project.image).toLowerCase().endsWith(".webp")) {
    throw new Error(`Every project card must use a WebP primary image: ${project.id}`);
  }

  const media = [
    project.image,
    project.imageFallback,
    ...(project.gallery || []).map((item) => typeof item === "string" ? item : item?.src)
  ].filter(Boolean);

  for (const source of media) {
    if (/^(https?:|data:)/i.test(source)) continue;
    const clean = String(source).split(/[?#]/, 1)[0].replace(/^\.\//, "").replace(/^\//, "");
    const localPath = path.join(root, "public", clean);
    const details = await stat(localPath).catch(() => null);
    if (!details?.isFile()) throw new Error(`Missing project image for ${project.id}: ${source}`);
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
for (const requiredText of ["Let&apos;s Discuss", "id=\"projects\"", "id=\"games\"", "Engineering across the product", "InHaus Auditing Suite", "Current projects.", "summary_large_image", "https://inhaus.technology/"]) {
  if (!publicText.includes(requiredText)) throw new Error(`Required site content missing: ${requiredText}`);
}

const digest = (content) => createHash("sha256").update(content).digest("hex").slice(0, 12);
const cssName = `site.${digest(sourceCss)}.css`;
const jsName = `site.${digest(sourceJs)}.js`;

await rm(dist, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

// Copy public files to the deployment root. Real user-supplied project images remain untouched.
await cp(path.join(root, "public"), dist, { recursive: true });

// Build a deployment catalogue with content-hashed media URLs. The source catalogue stays
// human-editable, while every deployment receives fresh image filenames that cannot be mixed
// with stale CDN or browser cache entries from an earlier upload.
const deploymentCatalogue = structuredClone(catalogue);
const fingerprintedMedia = new Map();

async function fingerprintMedia(source) {
  if (!source || /^(https?:|data:|blob:)/i.test(source)) return source;
  if (fingerprintedMedia.has(source)) return fingerprintedMedia.get(source);

  const clean = String(source).split(/[?#]/, 1)[0].replace(/^\.\//, "").replace(/^\//, "");
  const inputPath = path.join(root, "public", clean);
  const bytes = await readFile(inputPath);
  const extension = path.extname(clean);
  const stem = clean.slice(0, -extension.length);
  const fingerprinted = `${stem}.${digest(bytes)}${extension}`;
  const outputPath = path.join(dist, fingerprinted);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
  fingerprintedMedia.set(source, fingerprinted);
  return fingerprinted;
}

for (const project of deploymentCatalogue.projects) {
  project.image = await fingerprintMedia(project.image);
  if (project.imageFallback) project.imageFallback = await fingerprintMedia(project.imageFallback);
  if (Array.isArray(project.gallery)) {
    project.gallery = await Promise.all(project.gallery.map(async (entry) => {
      if (typeof entry === "string") return fingerprintMedia(entry);
      if (!entry || typeof entry !== "object") return entry;
      return { ...entry, src: await fingerprintMedia(entry.src || entry.image || "") };
    }));
  }
}

await writeFile(path.join(dist, "projects.json"), `${JSON.stringify(deploymentCatalogue, null, 2)}
`);

// Replace stable CSS/JS URLs with content-hashed assets. This prevents Netlify or browser
// caches from mixing a new HTML file with an older stylesheet or script after redeployment.
await writeFile(path.join(assetsDir, cssName), sourceCss);
await writeFile(path.join(assetsDir, jsName), sourceJs);

const sortedCatalogue = [...catalogue.projects].sort((a, b) => a.order - b.order);
const projectSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": "https://inhaus.technology/#current-projects",
  name: "Current InHaus Technologies projects",
  numberOfItems: sortedCatalogue.length,
  itemListElement: sortedCatalogue.map((project, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: project.name,
    description: project.summary || project.description || "",
    url: `https://inhaus.technology/#${project.type === "Gaming" ? "games" : "projects"}`
  }))
};
const projectSchemaTag = `  <script type="application/ld+json">\n${JSON.stringify(projectSchema, null, 2).replaceAll("<", "\\u003c")}\n  </script>`;

let builtHtml = sourceHtml;
builtHtml = builtHtml.replace(
  '<link rel="stylesheet" href="./src/styles.css" />',
  `<link rel="stylesheet" href="./assets/${cssName}" />`
);
builtHtml = builtHtml.replace(
  '  <script type="module" src="./src/main.js"></script>',
  `  <script type="module" src="./assets/${jsName}"></script>`
);
builtHtml = builtHtml.replace(
  "  <!-- BUILD:PROJECT_SCHEMA -->",
  projectSchemaTag
);
builtHtml = builtHtml.replace(
  "</head>",
  `  <meta name="inhaus-build" content="1.7.10-${digest(sourceCss + sourceJs)}" />\n</head>`
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

/sitemap.xml
  Cache-Control: public, max-age=3600
  Content-Type: application/xml; charset=UTF-8

/robots.txt
  Cache-Control: public, max-age=3600
  Content-Type: text/plain; charset=UTF-8

/site.webmanifest
  Cache-Control: public, max-age=3600
  Content-Type: application/manifest+json; charset=UTF-8
`.trimStart());

const build = {
  name: "InHaus Technologies Business Site",
  version: "1.7.10",
  builtAt: new Date().toISOString(),
  entries: catalogue.projects.length,
  projects: catalogue.projects.filter((project) => project.type === "System").length,
  games: catalogue.projects.filter((project) => project.type === "Gaming").length,
  css: `assets/${cssName}`,
  javascript: `assets/${jsName}`,
  runtime: "Static HTML, CSS and JavaScript",
  deployment: "Drag the dist folder contents or prepared deploy ZIP into Netlify Drop",
  cacheStrategy: "No-cache HTML and JSON; immutable content-hashed CSS, JavaScript and project media"
};

await writeFile(path.join(dist, "build.json"), `${JSON.stringify(build, null, 2)}\n`);
console.log(`Build complete: ${path.relative(root, dist)}/`);
console.log(`Validated ${build.entries} entries (${build.projects} projects, ${build.games} games).`);
console.log(`CSS: ${build.css}`);
console.log(`JS:  ${build.javascript}`);
console.log("Netlify cache mixing is prevented by content-hashed CSS, JavaScript and project media.");
console.log("projects.json is the single runtime catalogue source.");
console.log("SEO: canonical URL, sitemap, robots, structured data, Open Graph and X/Twitter large card included.");
