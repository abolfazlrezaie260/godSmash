# GodSmash

**[▶ Play GodSmash Online](https://abolfazlrezaie260.github.io/godSmash/)**

A 3D planet-destruction sandbox built with **Three.js**. Choose a planet, experiment with cinematic weapons and effects, or protect it with orbital defenses—all in your browser.

## Features

- **Four planets:** Earth, Mars, Venus, and the Moon, with photographic Earth textures and custom procedural surfaces.
- **Weapons and tools:** missiles, asteroids, orbital laser, drone swarms, and UFO harvesters.
- **Destruction effects:** persistent craters, exposed interiors, explosions, smoke, and debris.
- **Flat continental battle map:** choose a continent in the planet selector, click a country directly on the map to set the launch origin, then click another as the destination (e.g., Iran → Iraq). Watch the **same detailed 3D missile models used in normal gameplay** fly above an aerial Earth map with selectable country boundaries.
- **Planetary defense:** deploy up to six satellites per planet, with different interceptor types and radar targeting.
- **Responsive gameplay:** desktop and touch controls, 0.5× / 1× / 2× speed, and adaptive graphics quality.

## Country-to-country play

1. Open **Select Planet → Continent** (Asia, Europe, Africa, North/South America, or Oceania).
2. The 3D globe is replaced with a **close-up, flat aerial map** that starts with the bundled 4096px Earth image and locally bundled Natural Earth borders. When connected, NASA GIBS Blue Marble Next Generation image tiles add higher-resolution detail during zoom; the local image remains the fallback.
3. Click/tap a **source country**, then a **destination country** directly on the map (no country dropdowns).
4. Choose one of the existing missile profiles in the weapon dock and press **Fire**. The same detailed rocket model is rendered through a transparent Three.js WebGL overlay (not an SVG arrow), with an animated trail, impact effects, and damage updates in the HUD.
5. Select another target to reuse the same launch country. **Change Source** starts a new selection.
6. Use **Distant Destination** for a flat world map to select countries outside the current continent. **Continent View**, mouse wheel, touch drag and the game's zoom buttons adjust the aerial viewport.
7. **Free Mode** returns to the original 3D planet sandbox.

The map uses approximate country markers and simplified boundaries, not targeting-grade geography. The routes and weapon animations are entirely fictional arcade effects, not real-world flight calculations.

Country polygon data in `assets/data/countries-110m.json` is derived from [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) (public domain). It is intentionally bundled locally to avoid dependence on a map API. Natural Earth displays its chosen de facto boundaries and may differ from other political maps.

## Visual quality

The normal Earth-globe surface now retains the full **4K** bundled daytime texture resolution on desktop (up from 2K); mobile uses **2K** rather than 1K when supported. The flat map progressively requests detailed NASA GIBS Blue Marble Next Generation tiles as you zoom, while preserving a completely local **4K fallback** for offline use.

NASA's imagery is used only for visualization; attribution: NASA Earth Observatory / Blue Marble Next Generation (see [NASA GIBS documentation](https://nasa-gibs.github.io/gibs-api-docs/)). The animated missiles are original fictional GodSmash assets; no third-party missile models or external 3D assets are loaded.

## Run locally

No build step is required. From the repository root:

```sh
npx serve .
```

Then open the local URL shown by the server. Some runtime libraries and fonts are loaded from CDNs, so an internet connection is needed.

Run the tests with:

```sh
node --test tests/*.test.cjs
```

## Project structure

- `index.html` — game scene and interface
- `src/content/` — planet and weapon definitions
- `src/render/` — textures, projectiles, and visual effects
- `src/simulation/` — projectile and swarm behavior
- `src/defense/` — orbital defense systems
- `src/ui/` — responsive controls and interactive flat continent map
- `tests/` — automated tests

## Notes

GodSmash is a **cinematic arcade simulation**, not a scientifically accurate physics model. For performance diagnostics, add `?perf=1` to the game URL.

Earth texture origins and redistribution considerations are documented in [the asset README](assets/textures/earth/README.md). See also the [performance benchmark guide](docs/performance-benchmark.md).

Licensed under [MIT](LICENSE).
