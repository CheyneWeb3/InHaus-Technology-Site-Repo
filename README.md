# InHaus Technologies Business Site v1.6.4

This release keeps the approved v1.6 site and corrects the portfolio order without redesigning the page.

## Locked Projects order

1. Rose / OnlyRose
2. Forbidden Oasis / WATER
3. Cooking Solana Trading System
4. FoxySwap Trade
5. InHaus Universal USDC Cashier
6. InHaus Auditing Suite
7. InHaus Deploylify

The first four are shown initially. **View All Projects** reveals the remaining InHaus projects.

## Locked Games order

1. Memopoly
2. Deal or No Deal
3. Dual-Chain Roulette / Spin & Win

Games remain in their own section after Projects.

## Single project catalogue

`public/projects.json` is now the only catalogue source. The build no longer embeds a duplicate copy in `index.html`, so edits to the JSON are not overridden by stale embedded data.

## Local development

```powershell
npm run dev
```

Open `http://localhost:49215`.

## Build and verify the Netlify deployment

```powershell
npm run check
npm run preview
```

Open `http://localhost:49216`. Deploy the contents of `dist/`, or use the prepared Netlify ZIP inside `deploy/`.

## Images

Real project and game images remain in `public/assets/projects/` and are referenced from `public/projects.json`. The build does not generate or substitute project artwork.
