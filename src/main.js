const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  projects: [],
  projectExpanded: false,
  query: "",
  activeProjectId: null
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let revealObserver;

function setupScrollEffects() {
  const progress = qs("#scrollProgress");
  const header = qs(".site-header");
  let scheduled = false;

  const update = () => {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / scrollable));
    progress?.style.setProperty("transform", `scaleX(${ratio})`);
    header?.classList.toggle("is-scrolled", window.scrollY > 18);
    scheduled = false;
  };

  const requestUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
}

function setupRevealElements(root = document) {
  if (reduceMotion.matches || !("IntersectionObserver" in window)) return;

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("reveal-pending");
        entry.target.classList.add("reveal-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
  }

  const candidates = qsa([
    ".about-layout > *",
    ".section-heading",
    ".audit-intro",
    ".capability-card",
    ".audit-module-grid article",
    ".project-card",
    ".game-card",
    ".process-grid article",
    ".faq-intro-layout > *",
    ".faq-item",
    ".contact-layout > *",
    ".footer-main > *"
  ].join(","), root);

  candidates.forEach((element, index) => {
    if (element.dataset.revealReady === "true") return;
    element.dataset.revealReady = "true";
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 65}ms`);
    element.classList.add("reveal-pending");
    revealObserver.observe(element);
  });
}

function setupPointerGlow(root = document) {
  if (reduceMotion.matches) return;
  const candidates = qsa([
    ".capability-card",
    ".audit-module-grid article",
    ".project-card",
    ".game-card",
    ".process-grid article",
    ".faq-commercial",
    ".faq-item",
    ".contact-panel"
  ].join(","), root);

  candidates.forEach((element) => {
    if (element.dataset.pointerGlow === "true") return;
    element.dataset.pointerGlow = "true";
    element.classList.add("pointer-glow");
    element.addEventListener("pointermove", (event) => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--glow-x", `${event.clientX - bounds.left}px`);
      element.style.setProperty("--glow-y", `${event.clientY - bounds.top}px`);
    }, { passive: true });
  });
}

function setupActiveNavigation() {
  if (!("IntersectionObserver" in window)) return;
  const links = qsa('.site-nav a[href^="#"]');
  const sections = links
    .map((link) => qs(link.getAttribute("href")))
    .filter(Boolean);

  const byId = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => link.classList.remove("active"));
    const active = byId.get(visible.target.id);
    active?.classList.add("active");
  }, { rootMargin: "-24% 0px -62%", threshold: [0.05, 0.2, 0.45] });

  sections.forEach((section) => observer.observe(section));
}

function setupHeroNetwork() {
  const canvas = qs("#networkCanvas");
  const hero = qs(".hero");
  if (!canvas || !hero) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let points = [];
  let frame = 0;
  let visible = true;
  const pointer = { x: 0, y: 0, active: false };

  const createPoints = () => {
    const count = Math.max(18, Math.min(54, Math.round((width * height) / 30000)));
    points = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      size: 0.7 + Math.random() * 1.35
    }));
  };

  const resize = () => {
    const bounds = hero.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    createPoints();
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      if (!reduceMotion.matches) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -10) point.x = width + 10;
        if (point.x > width + 10) point.x = -10;
        if (point.y < -10) point.y = height + 10;
        if (point.y > height + 10) point.y = -10;
      }

      for (let j = i + 1; j < points.length; j += 1) {
        const other = points[j];
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 145) continue;
        context.strokeStyle = `rgba(92, 171, 255, ${0.11 * (1 - distance / 145)})`;
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.stroke();
      }

      if (pointer.active) {
        const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
        if (distance < 190) {
          context.strokeStyle = `rgba(89, 166, 255, ${0.22 * (1 - distance / 190)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }
      }

      context.fillStyle = `rgba(142, 202, 255, ${0.38 + point.size * 0.1})`;
      context.beginPath();
      context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      context.fill();
    }
  };

  const animate = () => {
    if (visible && document.visibilityState === "visible") draw();
    frame = requestAnimationFrame(animate);
  };

  hero.addEventListener("pointermove", (event) => {
    const bounds = hero.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
    observer.observe(hero);
  }

  resize();
  draw();
  if (!reduceMotion.matches) animate();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("beforeunload", () => cancelAnimationFrame(frame), { once: true });
}

function enhanceInterface(root = document) {
  setupRevealElements(root);
  setupPointerGlow(root);
}

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

function projectImageFallback(project) {
  return typeof project.imageFallback === "string" ? project.imageFallback.trim() : "";
}

function imageFallbackAttribute(project) {
  const fallback = projectImageFallback(project);
  return fallback ? ` data-fallback-src="${escapeHtml(mediaUrl(fallback))}"` : "";
}

function bindImageFallback(image, onFinalFailure) {
  image.addEventListener("error", () => {
    const fallback = image.dataset.fallbackSrc;
    if (fallback && image.src !== new URL(fallback, location.href).href) {
      image.removeAttribute("data-fallback-src");
      image.src = fallback;
      return;
    }
    onFinalFailure?.(image);
  });
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

async function loadCatalogue() {
  let managedProjects = [];

  try {
    const managedResponse = await fetch(
      "https://pm-api.inhaus.technology/api/public/inhaus-projects.json",
      { cache: "no-store" }
    );

    if (managedResponse.ok) {
      const managed = await managedResponse.json();
      if (managed && Array.isArray(managed.projects)) managedProjects = managed.projects;
    }
  } catch (error) {
    console.warn("Project Manager sync unavailable; using bundled catalogue.", error);
  }

  let bundledProjects = [];
  try {
    const response = await fetch("./projects.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`./projects.json returned ${response.status}`);
    const catalogue = await response.json();
    if (!catalogue || !Array.isArray(catalogue.projects)) {
      throw new Error("./projects.json does not contain a projects array");
    }
    bundledProjects = catalogue.projects;
  } catch (error) {
    if (managedProjects.length) return sortedByOrder(managedProjects);
    throw error;
  }

  if (!managedProjects.length) return bundledProjects;

  const keyFor = (project) => String(project?.id || project?.slug || project?.name || "").trim().toLowerCase();
  const merged = new Map();

  for (const project of bundledProjects) merged.set(keyFor(project), project);
  for (const project of managedProjects) merged.set(keyFor(project), project);

  return sortedByOrder(Array.from(merged.values()));
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
      <img src="${escapeHtml(mediaUrl(source))}"${imageFallbackAttribute(project)} alt="${escapeHtml(project.imageAlt || `${project.name} project image`)}" loading="eager" decoding="async" />
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
    bindImageFallback(image, (failedImage) => {
      const card = failedImage.closest(".project-card, .game-card");
      failedImage.parentElement?.remove();
      card?.classList.add("no-image");
    });
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
  enhanceInterface(projectGrid);
  enhanceInterface(gameGrid);

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
      <img src="${escapeHtml(mediaUrl(source))}"${imageFallbackAttribute(project)} alt="${escapeHtml(project.imageAlt || `${project.name} project image`)}" decoding="async" />
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

function projectSequence(project) {
  return sortedByOrder(state.projects.filter((item) => item.type === project.type));
}

function updateDialogNavigation(project) {
  const sequence = projectSequence(project);
  const previousButton = qs("#dialogPrevious");
  const nextButton = qs("#dialogNext");
  const isGame = project.type === "Gaming";
  const itemLabel = isGame ? "game" : "project";

  if (!previousButton || !nextButton) return;
  const navigationAvailable = sequence.length > 1;
  previousButton.hidden = !navigationAvailable;
  nextButton.hidden = !navigationAvailable;
  if (!navigationAvailable) return;

  const currentIndex = sequence.findIndex((item) => item.id === project.id);
  const previous = sequence[(currentIndex - 1 + sequence.length) % sequence.length];
  const next = sequence[(currentIndex + 1) % sequence.length];

  previousButton.setAttribute("aria-label", `Previous ${itemLabel}: ${previous.name}`);
  nextButton.setAttribute("aria-label", `Next ${itemLabel}: ${next.name}`);
  previousButton.title = `Previous ${itemLabel}: ${previous.name}`;
  nextButton.title = `Next ${itemLabel}: ${next.name}`;
}

function navigateProject(direction) {
  const current = state.projects.find((item) => item.id === state.activeProjectId);
  if (!current) return;
  const sequence = projectSequence(current);
  if (sequence.length < 2) return;

  const currentIndex = sequence.findIndex((item) => item.id === current.id);
  const nextIndex = (currentIndex + direction + sequence.length) % sequence.length;
  openProject(sequence[nextIndex].id, true, direction);
}

function openProject(id, updateHash = true, direction = 0) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;

  state.activeProjectId = project.id;
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
    bindImageFallback(image, (failedImage) => failedImage.closest(".detail-media, figure")?.remove());
  });

  updateDialogNavigation(project);
  detail.classList.remove("modal-slide-previous", "modal-slide-next");
  if (direction) {
    void detail.offsetWidth;
    detail.classList.add(direction < 0 ? "modal-slide-previous" : "modal-slide-next");
  }

  const dialog = qs("#projectDialog");
  const wasOpen = dialog.open;
  if (!wasOpen) dialog.showModal();
  document.body.classList.add("dialog-open");
  if (updateHash) history.replaceState(null, "", `${location.pathname}${location.search}#project/${project.id}`);
  if (!wasOpen) qs("#dialogClose")?.focus();
}

function closeProject() {
  const dialog = qs("#projectDialog");
  if (dialog.open) dialog.close();
  document.body.classList.remove("dialog-open");
  state.activeProjectId = null;
  if (location.hash.startsWith("#project/")) {
    history.replaceState(null, "", `${location.pathname}${location.search}#projects`);
  }
}

function openFromHash() {
  const match = location.hash.match(/^#project\/([a-z0-9-]+)$/i);
  if (match) openProject(match[1], false);
}

function setupMobileSections() {
  const buttons = qsa("[data-mobile-toggle]");
  if (!buttons.length) return;

  const mobileQuery = window.matchMedia("(max-width: 720px)");
  document.documentElement.classList.add("mobile-interface-ready");

  const targetsFor = (button) => String(button.dataset.mobileToggle || "")
    .split(/\s+/)
    .map((id) => document.getElementById(id))
    .filter((target) => target && !target.closest("[data-mobile-always-visible=\"true\"]"));

  const renderButton = (button, expanded) => {
    const label = qs(".mobile-section-toggle-label", button);
    const icon = qs(".mobile-section-toggle-icon", button);
    const collapsedLabel = button.dataset.collapsedLabel || "Read more";
    const expandedLabel = button.dataset.expandedLabel || "Show less";

    button.setAttribute("aria-expanded", String(expanded));
    if (label) label.textContent = expanded ? expandedLabel : collapsedLabel;
    if (icon) icon.textContent = expanded ? "−" : "+";
    button.classList.toggle("is-expanded", expanded);
  };

  const applyState = (button, expanded, animate = false) => {
    button.dataset.mobileExpanded = String(expanded);
    renderButton(button, expanded);

    targetsFor(button).forEach((target) => {
      if (!mobileQuery.matches) {
        target.hidden = false;
        target.classList.remove("mobile-section-expanded", "mobile-section-reveal");
        return;
      }

      target.hidden = !expanded;
      target.classList.toggle("mobile-section-expanded", expanded);
      if (expanded && animate) {
        target.classList.remove("mobile-section-reveal");
        requestAnimationFrame(() => target.classList.add("mobile-section-reveal"));
      } else {
        target.classList.remove("mobile-section-reveal");
      }
    });
  };

  buttons.forEach((button) => {
    button.dataset.mobileExpanded = "false";
    button.addEventListener("click", () => {
      if (!mobileQuery.matches) return;
      const expanded = button.dataset.mobileExpanded === "true";
      applyState(button, !expanded, true);
    });
  });

  const sync = () => {
    buttons.forEach((button) => {
      const expanded = button.dataset.mobileExpanded === "true";
      applyState(button, expanded, false);
    });
  };

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", sync);
  } else {
    mobileQuery.addListener(sync);
  }

  sync();
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
  qs("#dialogPrevious")?.addEventListener("click", () => navigateProject(-1));
  qs("#dialogNext")?.addEventListener("click", () => navigateProject(1));
  qs("#projectDialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeProject();
  });
  qs("#projectDialog")?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProject();
  });
  document.addEventListener("keydown", (event) => {
    const dialog = qs("#projectDialog");
    if (!dialog?.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigateProject(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigateProject(1);
    }
  });
  window.addEventListener("hashchange", openFromHash);
}

async function start() {
  qs("#year").textContent = String(new Date().getFullYear());
  setupNavigation();
  setupMobileSections();
  setupControls();
  setupScrollEffects();
  setupActiveNavigation();
  setupHeroNetwork();
  enhanceInterface(document);

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
