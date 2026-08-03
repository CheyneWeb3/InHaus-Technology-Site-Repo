# InHaus Technologies Business Site v1.7.10


## v1.7.10 funded engagement clarification

- Restores the FAQ policy that InHaus Technologies does not join project teams or commit development resources for future promises alone.
- Confirms that exposure, future token value, equity, revenue, launch proceeds or success-based compensation do not replace funded engineering fees.
- Clarifies that InHaus can work alongside a client team as an external development and project-delivery partner.
- Keeps optional success participation available only as a separately negotiated written addition to the retainer, Scope of Works and development fees.


## v1.7.10 mobile interface condensation

- Mobile visitors see the heading and a short summary first instead of every detail at once.
- Hero services, About details, Capabilities, Audit modules, Process and the full FAQ expand through accessible Read more controls.
- Project and game cards remain visible and image-led, with shorter mobile summaries and hidden tag clutter.
- Desktop and tablet layouts remain fully expanded.
- The complete content remains visible when JavaScript is unavailable.
- Commercial FAQ now explains that InHaus may propose an optional success participation on any project; acceptance is never automatic and all figures remain negotiable.


## v1.7.8 project image correction

- Every project and game card now uses the supplied WebP artwork as its primary image.
- The remaining WATER artwork is generated as `water.webp` from the supplied PNG so all ten primary card images are WebP.
- Production builds assign content-hashed filenames to every primary image and fallback, preventing old Netlify or browser caches from hiding updated artwork.
- Cards load their WebP images eagerly and only use the matching local PNG if the WebP request genuinely fails.
- `npm run check` fails when any project image is missing, is not a valid WebP, or is absent from the production build.

Static, JSON-driven InHaus Technologies company site with full editable source and a built Netlify-ready `dist/`.

## Production presentation

- Company-first InHaus Technologies identity
- Hero: “Technology built beyond the interface.”
- Animated technical network canvas with restrained InHaus blue motion
- Scroll progress indicator and active navigation state
- Staggered section and card reveals
- Pointer-aware card highlights, image motion and button sheen
- Motion honours `prefers-reduced-motion`
- Restored capabilities and auditing sections
- **Current Projects** first
- **Games** second
- Project images controlled only through `public/projects.json`
- Uniform four-column desktop cards
- High desktop detail modals
- Full modal scrolling on smaller screens and short-height devices
- Professional company footer
- Commercial FAQ covering payments, retainers, scope variations, delivery readiness, pricing versus delivery speed, AI-assisted development, ethics and project acceptance
- FAQPage structured data for search engines

## Locked current-project order

1. Rose / OnlyRose
2. Forbidden Oasis / WATER
3. Cooking Solana Trading System
4. FoxySwap Trade
5. InHaus Universal USDC Cashier
6. InHaus Auditing Suite
7. InHaus Deploylify

Games remain separate and follow Projects:

1. Memopoly
2. Deal or No Deal
3. Dual-Chain Roulette / Spin & Win

## Run

```powershell
npm run dev
```

Open `http://localhost:49215`.

## Build and verify

```powershell
npm run check
npm run preview
```

Open `http://localhost:49216` to test the exact built deployment.

## Netlify

Drag the contents of `dist/`, or use the prepared ZIP inside `deploy/`.

## SEO and social cards

The production build includes the canonical `https://inhaus.technology/` URL, sitemap, robots file, web manifest, Organization/WebSite/WebPage/ItemList/FAQPage structured data, full Open Graph metadata and an X/Twitter `summary_large_image` card.

See `SEO-AND-SOCIAL.md`.
