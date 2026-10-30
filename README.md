# GodSmash

**[▶ Play GodSmash Online](https://abolfazlrezaie260.github.io/godSmash/)**

A 3D planet-destruction sandbox built with **Three.js**. Choose a planet, experiment with cinematic weapons and effects, or protect it with orbital defenses—all in your browser.

## Features

- **Four planets:** Earth, Mars, Venus, and the Moon, with photographic Earth textures and custom procedural surfaces.
- **Weapons and tools:** missiles, asteroids, orbital laser, drone swarms, and UFO harvesters.
- **Destruction effects:** persistent craters, exposed interiors, explosions, smoke, and debris.
- **Country-to-country mode:** choose a continent in the planet selector, pick two countries on Earth (for example, Iran → Iraq), then launch any available missile type along an animated globe arc.
- **Planetary defense:** deploy up to six satellites per planet, with different interceptor types and radar targeting.
- **Responsive gameplay:** desktop and touch controls, 0.5× / 1× / 2× speed, and adaptive graphics quality.

## Country-to-country play

Open **Select Planet → Choose Continent**, then choose the **source** and **destination** countries in the route panel. Select a missile from the weapon dock and press **Fire**. Single and three-missile salvo modes are supported. Choose **Free Mode** to return to the original planet sandbox.

Country markers use approximate geographic centers for visualization, not national borders or real-world targeting data.

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
- `src/ui/` — responsive controls
- `tests/` — automated tests

## Notes

GodSmash is a **cinematic arcade simulation**, not a scientifically accurate physics model. For performance diagnostics, add `?perf=1` to the game URL.

Earth texture origins and redistribution considerations are documented in [the asset README](assets/textures/earth/README.md). See also the [performance benchmark guide](docs/performance-benchmark.md).

Licensed under [MIT](LICENSE).
