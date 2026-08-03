const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  projects: [],
  projectExpanded: false,
  query: ""
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeLink(value = "") {
  const link = String(value).trim();
  return /^(https?:|mailto:)/i.test(link) ? link : "#";
}

function mediaUrl(value = "") {
  const source = String(value).trim();
  if (!source) return "";
  if (/^(https?:|data:|blob:)/i.test(source)) return source;
  return `./${source.replace(/^\.\//, "").replace(/^\//, "")}`;
}

function mediaFit(project) {
  return ["cover", "contain", "fill", "scale-down"].includes(project.imageFit)
    ? project.imageFit
    : "cover";
}

function mediaPosition(project) {
  return project.imagePosition || "center";
}

function projectImage(project) {
  return typeof project.image === "string" ? project.image.trim() : "";
}

function normalizedGallery(project) {
  return (Array.isArray(project.gallery) ? project.gallery : [])
    .map((entry) => {
      if (typeof entry === "string") {
        return { src: entry, alt: `${project.name} project screen`, caption: "" };
      }
      if (!entry || typeof entry !== "object") return null;
      return {
        src: entry.src || entry.image || "",
        alt: entry.alt || `${project.name} project screen`,
        caption: entry.caption || ""
      };
    })
    .filter((entry) => entry?.src);
}

function inlineCatalogue() {
  const element = qs("#projectCatalogue");
  if (!element?.textContent?.trim()) return null;
  try {
    const value = JSON.parse(element.textContent);
    return Array.isArray(value?.projects) ? value.projects : null;
  } catch (error) {
    console.warn("Inline project catalogue could not be read.", error);
    return null;
  }
}

async function loadCatalogue() {
  const embedded = inlineCatalogue();
  if (embedded) return embedded;

  const candidates = ["./projects.json", "projects.json", "/projects.json"];
  let lastError;
  for (const source of candidates) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error(`${source} returned ${response.status}`);
      const catalogue = await response.json();
      if (!catalogue || !Array.isArray(catalogue.projects)) {
        throw new Error(`${source} does not contain a projects array`);
      }
      return catalogue.projects;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("The project catalogue could not be loaded.");
}

function sortedByOrder(items) {
  return [...items].sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
}

function searchMatches(project) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  const searchText = [
    project.name,
    project.category,
    project.status,
    project.summary,
    project.description,
    ...(project.cardTags || []),
    ...(project.stack || []),
    ...(project.capabilities || []),
    ...(project.modules || []).flatMap((module) => [module.name, module.description])
  ].join(" ").toLowerCase();
  return searchText.includes(query);
}

function imageMarkup(project, className) {
  const source = projectImage(project);
  if (!source) return "";
  return `
    <div class="${className}" style="--media-fit:${escapeHtml(mediaFit(project))};--media-position:${escapeHtml(mediaPosition(project))}">
      <img src="${escapeHtml(mediaUrl(source))}" alt="${escapeHtml(project.imageAlt || `${project.name} project image`)}" loading="lazy" />
    </div>`;
}

function cardMarkup(project, index, game = false) {
  const tags = (project.cardTags || project.stack || []).slice(0, 3);
  const hasImage = Boolean(projectImage(project));
  const articleClass = game ? "game-card" : "project-card";
  const mediaClass = game ? "game-media" : "project-media";
  const bodyClass = game ? "game-body" : "project-body";
  const topClass = game ? "game-topline" : "project-topline";

  return `
    <article class="${articleClass}${hasImage ? "" : " no-image"}" tabindex="0" role="button" data-project-id="${escapeHtml(project.id)}" aria-label="Open ${escapeHtml(project.name)} project details">
      ${imageMarkup(project, mediaClass)}
      <div class="${bodyClass}">
        <div class="${topClass}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHtml(project.category || (game ? "Game" : "Project"))}</span>
        </div>
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.summary || project.description || "")}</p>
        <div class="project-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="project-open"><span>View project</span><span aria-hidden="true">↗</span></div>
      </div>
    </article>`;
}

function bindCards(root) {
  qsa("[data-project-id]", root).forEach((card) => {
    const open = () => openProject(card.dataset.projectId);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  qsa(".project-media img, .game-media img", root).forEach((image) => {
    image.addEventListener("error", () => {
      const card = image.closest(".project-card, .game-card");
      image.parentElement?.remove();
      card?.classList.add("no-image");
    }, { once: true });
  });
}

function renderCatalogues() {
  const allSystems = sortedByOrder(state.projects.filter((item) => item.type === "System" && searchMatches(item)));
  const allGames = sortedByOrder(state.projects.filter((item) => item.type === "Gaming"));

  const visibleSystems = state.projectExpanded || state.query ? allSystems : allSystems.slice(0, 4);

  const projectGrid = qs("#projectGrid");
  projectGrid.innerHTML = visibleSystems.length
    ? visibleSystems.map((project, index) => cardMarkup(project, index, false)).join("")
    : '<div class="empty-state">No projects match that search.</div>';

  const gameGrid = qs("#gameGrid");
  gameGrid.innerHTML = allGames.length
    ? allGames.map((project, index) => cardMarkup(project, index, true)).join("")
    : '<div class="empty-state">No games have been added yet.</div>';

  bindCards(projectGrid);
  bindCards(gameGrid);

  const projectMore = qs("#projectMore");
  projectMore.hidden = Boolean(state.query) || allSystems.length <= 4;
  projectMore.textContent = state.projectExpanded ? "Show Fewer Projects" : `View All Projects (${allSystems.length})`;
}

function detailLinks(project) {
  const links = Array.isArray(project.links) ? project.links : [];
  if (!links.length) return "";
  return `<div class="detail-links">${links.map((link) => `
    <a class="button ${link.kind === "primary" ? "button-primary" : "button-secondary"}" href="${escapeHtml(safeLink(link.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>
  `).join("")}</div>`;
}

function detailImage(project) {
  const source = projectImage(project);
  if (!source) return "";
  return `
    <div class="detail-media" style="--detail-fit:${escapeHtml(mediaFit(project))};--detail-position:${escapeHtml(mediaPosition(project))}">
      <img src="${escapeHtml(mediaUrl(source))}" alt="${escapeHtml(project.imageAlt || `${project.name} project image`)}" />
    </div>`;
}

function detailGallery(project) {
  const gallery = normalizedGallery(project);
  if (!gallery.length) return "";
  return `<div class="detail-gallery">${gallery.map((entry) => `
    <figure>
      <img src="${escapeHtml(mediaUrl(entry.src))}" alt="${escapeHtml(entry.alt)}" loading="lazy" />
      ${entry.caption ? `<figcaption>${escapeHtml(entry.caption)}</figcaption>` : ""}
    </figure>`).join("")}</div>`;
}

function moduleMarkup(project) {
  const modules = Array.isArray(project.modules) ? project.modules : [];
  if (!modules.length) return "";
  return `
    <section class="detail-side-panel">
      <small>Suite modules</small>
      <div class="detail-modules">${modules.map((module) => `
        <div class="detail-module">
          <strong>${escapeHtml(module.name)}</strong>
          <p>${escapeHtml(module.description)}</p>
        </div>`).join("")}</div>
    </section>`;
}

function openProject(id, updateHash = true) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;

  const detail = qs("#projectDetail");
  detail.innerHTML = `
    <section class="detail-hero${projectImage(project) ? "" : " no-image"}">
      ${detailImage(project)}
      <div class="detail-hero-copy">
        <span class="detail-kicker">${escapeHtml(project.type)} · ${escapeHtml(project.category || "Project")}${project.status ? ` · ${escapeHtml(project.status)}` : ""}</span>
        <h2 id="dialogTitle">${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.summary || project.description || "")}</p>
        ${detailLinks(project)}
      </div>
    </section>

    <div class="detail-content">
      <div class="detail-overview">
        <div class="detail-column">
          <section class="detail-panel"><small>The requirement</small><p>${escapeHtml(project.problem || project.description || "")}</p></section>
          <section class="detail-panel"><small>The system</small><p>${escapeHtml(project.solution || project.description || "")}</p></section>
          <section class="detail-panel"><small>Project overview</small><p>${escapeHtml(project.description || project.summary || "")}</p></section>
        </div>

        <div class="detail-column">
          <section class="detail-side-panel">
            <small>Core capabilities</small>
            <div class="detail-list">${(project.capabilities || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          </section>
          ${moduleMarkup(project)}
        </div>

        <div class="detail-column">
          <section class="detail-side-panel">
            <small>Technology</small>
            <div class="detail-stack">${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          </section>
          <section class="detail-side-panel">
            <small>Delivery scope</small>
            <div class="detail-stack">${(project.services || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          </section>
        </div>
      </div>
      ${detailGallery(project)}
    </div>`;

  qsa(".detail-media img, .detail-gallery img", detail).forEach((image) => {
    image.addEventListener("error", () => image.closest(".detail-media, figure")?.remove(), { once: true });
  });

  const dialog = qs("#projectDialog");
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("dialog-open");
  if (updateHash) history.replaceState(null, "", `${location.pathname}${location.search}#project/${project.id}`);
  qs("#dialogClose")?.focus();
}

function closeProject() {
  const dialog = qs("#projectDialog");
  if (dialog.open) dialog.close();
  document.body.classList.remove("dialog-open");
  if (location.hash.startsWith("#project/")) {
    history.replaceState(null, "", `${location.pathname}${location.search}#projects`);
  }
}

function openFromHash() {
  const match = location.hash.match(/^#project\/([a-z0-9-]+)$/i);
  if (match) openProject(match[1], false);
}

function setupNavigation() {
  const button = qs("#menuButton");
  const nav = qs("#siteNav");
  if (!button || !nav) return;

  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });

  qsa("a", nav).forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    });
  });
}

function setupControls() {
  qs("#projectSearch")?.addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    renderCatalogues();
  });

  qs("#projectMore")?.addEventListener("click", () => {
    state.projectExpanded = !state.projectExpanded;
    renderCatalogues();
  });

  qs("#dialogClose")?.addEventListener("click", closeProject);
  qs("#projectDialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeProject();
  });
  qs("#projectDialog")?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProject();
  });
  window.addEventListener("hashchange", openFromHash);
}

async function start() {
  qs("#year").textContent = String(new Date().getFullYear());
  setupNavigation();
  setupControls();

  try {
    state.projects = await loadCatalogue();
    renderCatalogues();
    openFromHash();
  } catch (error) {
    console.error(error);
    qs("#projectGrid").innerHTML = '<div class="empty-state">The project catalogue could not be loaded. Confirm that projects.json is included beside index.html in the deployed dist.</div>';
    qs("#gameGrid").innerHTML = '<div class="empty-state">The game catalogue could not be loaded.</div>';
  }
}

start();
