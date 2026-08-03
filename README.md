# InHaus Technologies Business Site v1.6.3

This is the maintained v1.6 site with the approved hero option 4, deployment-safe hashed assets, and JSON-wired project and game image filenames. The page structure, Projects, Games, capabilities, footer and InHaus Auditing Suite remain unchanged.

## Local development

```powershell
npm run dev
```

Open `http://localhost:49215`.

## Build the exact Netlify deployment

```powershell
npm run build
npm run preview
```

Open `http://localhost:49216`. The build produces content-hashed CSS and JavaScript filenames, so Netlify and the browser cannot combine a new page with an older stylesheet.

## Netlify drag deployment

Use the prepared ZIP inside `deploy/`, or drag the **contents** of `dist/` into Netlify Drop. `index.html` must be at the deployment root.

The deployment contains:

- no-cache HTML and project JSON
- fingerprinted immutable CSS and JavaScript
- `_headers` for Netlify cache control
- embedded project-catalogue fallback

## Project and game images

Put the real screenshots in:

```text
public/assets/projects/
```

The image paths are already wired in `public/projects.json`. Use the exact filenames listed in `public/assets/projects/README.txt`, then run:

```powershell
npm run build
```

Missing files are hidden cleanly until added. The site never generates, recreates or substitutes project artwork.

## Catalogue structure

- `type: "System"` renders under Projects.
- `type: "Gaming"` renders under Games.
- InHaus Auditing Suite is one project; the Time Machine, simulation and forensics tools are modules inside it.
- The first four Projects are shown initially; View All Projects reveals the remainder.
- Project cards use fixed content rows so titles, descriptions, chips and links align.
- Detail modals use nearly the full desktop viewport height.
