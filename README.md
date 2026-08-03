# InHaus Technologies Business Site v1.7.2

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
- Commercial FAQ covering payments, retainers, scope variations, delivery readiness, ethics and project acceptance
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
