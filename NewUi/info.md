# Global Operations Command Center (bigscreen-cockpit)

A 1920×1080 "command screen" dashboard, designed to hang on a wall and stay open: at the centre a draggable, clickable 3D earth (day/night terminator, city lights, route arcs, hub pings), flanked by data rails — a KPI band, a regional attainment ranking (drill-down: region → city → store), category mix, inventory turns, cross-border routes, a live alert ticker, collections & cash flow, and a revenue trend chart. The top bar carries a live clock, a connection status pill, and a dark/light theme toggle. When nobody interacts, the screen auto-tours the regional viewpoints; any interaction pauses the tour.

**Language**: the site's language follows the user's query language. This repo is the English version; talk to the user in whatever language they use, and adapt the site's copy on request.

## Before using it: ask the user first

Before using this website online, ask the user a few questions with the ask_user tool:

1. **(Required) Do you want to turn the page into a full-stack app?** That is, do you need persistent data storage: right now every figure on the screen (regional revenue, categories, routes, alerts…) is demo data hard-coded in the frontend — a reload resets everything, and no real business data can be entered. As a full-stack app it gains a backend and a database, so data can be persisted, edited, and synced on a schedule.
2. What business should this screen monitor? The default demo is cross-border trade / retail operations (revenue, routes, stores), but the same layout works for logistics, manufacturing lines, energy, facility ops, media monitoring — any "overview + drill-down" scenario. Headings, KPIs, charts, and alert copy all change with it.
3. Should the data model be yours? Region/city groupings, route city-pairs, metric definitions, alert rules and thresholds.
4. Any colour or branding requirements? The default is a deep-blue command-screen palette (with a one-click dark/light toggle). Every colour in the site lives in CSS custom properties (design tokens), so a brand re-colour touches one token block only.

If the user answers nothing, just load the default site files.

**Default behaviour for dashboard templates**: unless the user explicitly asks for a static site only, after loading the site files, use the backend-building skill by default to build out the backend (API + database) and wire the hard-coded demo data to real persistent storage.

## File layout

```
index.html              entry; #root mounts with display:contents so body's layout chain is intact
package.json            react 19 / echarts 5 / three 0.170 / vite 7
vite.config.ts
src/
  main.tsx              React mount
  App.tsx               whole-screen layout and all interaction: fit-scaling, drill-down, tour, clock, theme
  styles/
    kit.css             design tokens (dark + light themes) and base component styles
    app.css             screen-specific styles: three-column grid, KPIs, ranking, routes, alerts, scanlines
  lib/
    data.js             demo business data (regions/cities/categories/routes/hubs/alerts/tour) + echarts registry
    charts.js           option configs for the four ECharts
    kit.js              theme toggle, chart rebuild registry, number formatting, toast, misc helpers
    fx.js               background effects library (this page uses the constellation backdrop)
    geo.js              land geometry: TopoJSON decode, raster sampling, great-circle routes, city table
    globe.js            the 3D earth: three.js + custom GLSL shaders
    land-110m.json      world land outlines (56 KB, loaded locally, no CDN)
public/fonts/           Geist / Geist Mono variable fonts
dist/                   build output, ready for static hosting
```

Optional: You can use image and video generation tools if it suits user's query.

## What it can become

This is an "overview — drill-down" skeleton: one interactive hero in the middle, cards on both wings; the cards are clickable and the hero responds. Likely user requests:

- **Change the business**: logistics, manufacturing, energy, security, esports, facilities… edit the data definitions in `data.js` and the card copy; the layout stays.
- **Change the hero**: swap the earth for a 2D map, a production-line 3D view, a building section; `geo.js` / `globe.js` are self-contained modules and replacing them doesn't touch the wings.
- **Wire real data**: `data.js` is the single data source — replace the hard-coded arrays with API responses; when a backend is wanted, follow the default behaviour above and use the backend-building skill.
- **Text and media**: headings, alert copy, chart titles, cities and routes are all content the user may ask to replace — adapt as requested.

If the user only wants to look at the site, just load the site files and don't over-ask.

## Technical notes (3D / shaders)

Before touching the 3D or shader code, read `src/lib/globe.js` and `src/lib/fx.js` — the trade-offs of every effect are written in their file-header comments. The condensed version:

**The 3D earth (globe.js, three.js)**: no textures anywhere — the whole planet is procedural.

- Ocean is a custom shader: a Lambert terminator (`smoothstep(dot(worldNormal, sunDir))`) plus a Fresnel limb sheen. Two dot products, no lights, no textures.
- Atmosphere is a 1.035R back-faced shell: a high-exponent Fresnel peaks exactly at the silhouette, brightest where the sun grazes the limb. The light theme turns the glow down via tokens, becoming a "porcelain globe with ink coastlines".
- Land is ~14k points: `geo.js` rasterises the TopoJSON polygons to an offscreen canvas once, then samples an *area-even* lat/lon lattice (a fixed lon step piles dots at the poles). Each point carries a stable pseudo-random weight so only about a third light up as "cities" at night, fading with latitude.
- Coastlines are the definition layer: TopoJSON rings decoded into segment pairs, drawn as one `LineSegments`. Segments jumping 170°+ of longitude are dropped — that's the antimeridian seam, not a coast.
- Routes = great-circle interpolation with a parabolic midpoint lift; a dim static line plus a bright travelling head, the head rewritten in place each frame in a fixed-length buffer (no reallocation).
- Hubs are CanvasTexture sprites; the ping ring's alpha falls with its radius. The sun lives in world space and the earth turns underneath it — the terminator doubles as the screen's clock.
- Every colour comes from CSS tokens (`--globe-*`); on a theme flip `retheme()` re-reads them — one earth, two themes.
- Performance: shaders precompiled with `compileAsync`; pixel ratio capped at 2x; the 3D module is dynamically imported and starts a frame late so it never blocks first paint; rendering pauses off-screen and in the background.

**Backgrounds and effects (fx.js)**: one canvas per effect, a shared `stage()` pipeline handling device pixels, off-screen pausing, and `prefers-reduced-motion`. aurora is a WebGL fragment shader: 3-octave fbm with double domain warping — a soft low-frequency ground, so 40% resolution at 30 fps is plenty, with 1/255 ordered dither to kill banding. The rest (constellation / radar / topo / ridgeline / hudgrid / gauge / trail) are small 2D-canvas effects, easy to lift and reuse.

**Screen engineering (App.tsx)**: a 1920×1080 design canvas; `fit()` scales the whole stage by the smaller ratio and grows it in design units along whichever axis has slack — resolution changes only change the scale, never the layout. ECharts colours are baked into the option at setOption time, so a theme flip rebuilds options with notMerge (kit.js's registry does this uniformly).
