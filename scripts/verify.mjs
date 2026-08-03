import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const html = await readFile(path.join(dist, "index.html"), "utf8");
const sourceCss = await readFile(path.join(root, "src/styles.css"), "utf8");
const sourceJs = await readFile(path.join(root, "src/main.js"), "utf8");
const catalogue = JSON.parse(await readFile(path.join(dist, "projects.json"), "utf8"));

const cssMatch = html.match(/\.\/assets\/(site\.[a-f0-9]{12}\.css)/);
const jsMatch = html.match(/\.\/assets\/(site\.[a-f0-9]{12}\.js)/);
if (!cssMatch) throw new Error("Built HTML does not reference a hashed CSS asset");
if (!jsMatch) throw new Error("Built HTML does not reference a hashed JavaScript asset");

const builtCssPath = path.join(dist, "assets", cssMatch[1]);
const builtJsPath = path.join(dist, "assets", jsMatch[1]);
await access(builtCssPath);
await access(builtJsPath);
await access(path.join(dist, "_headers"));

const builtCss = await readFile(builtCssPath, "utf8");
const builtJs = await readFile(builtJsPath, "utf8");
if (builtCss !== sourceCss) throw new Error("Built CSS differs from source CSS");
if (builtJs !== sourceJs) throw new Error("Built JavaScript differs from source JavaScript");
if (html.includes("./src/styles.css") || html.includes("./src/main.js")) throw new Error("Built HTML still references source assets");
if (html.indexOf('id="projects"') > html.indexOf('id="games"')) throw new Error("Games appears before Projects");

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

const requiredCss = [
  /\.project-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4/s,
  /calc\(100% - 64px\)/,
  /grid-template-rows:\s*46px minmax\(58px, auto\) minmax\(118px, 1fr\) 72px 52px/,
  /height:\s*min\(940px, calc\(100dvh - 24px\)\)/
];
for (const rule of requiredCss) {
  if (!rule.test(builtCss)) throw new Error(`Required layout rule missing: ${rule}`);
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 12);
console.log("DIST VERIFICATION PASSED");
console.log(`CSS ${cssMatch[1]} (${sha(builtCss)})`);
console.log(`JS  ${jsMatch[1]} (${sha(builtJs)})`);
console.log(`${systems.length} projects, ${games.length} games`);
console.log("Projects precede Games; InHaus Auditing Suite is consolidated; Netlify cache headers are present.");
