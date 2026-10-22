# GodSmash — Extensible planets and weapons

Browser-based 3D planet destruction game, built with Three.js. This branch is an incremental refactor of the original single-file game.

## Run

Serve the repository root through a static server or GitHub Pages. Open `index.html`. The default choice is **Earth + ICBM**. The planet and weapon dropdowns support mouse and touch. No compilation step is needed. The Three.js, Tailwind and fonts CDNs still require a network connection.

```sh
npx serve .
node --test tests/catalog.test.cjs
```

## Structure

| Location | Purpose |
| --- | --- |
| `index.html` | Existing Three.js scene, HUD, camera, raycast, impact engine and loop |
| `src/content/catalog.js` | Planets and weapons registries, data validation and default presets |
| `src/render/planet-textures.js` | Deterministic, procedural surface painter for new planets |
| `tests/catalog.test.cjs` | Registry and texture-painting smoke tests |

## Add a planet

Add a `registerPlanet({...})` call in `src/content/catalog.js` (prefer splitting presets into their own files in the next refactor). Provide unique `id`, `nameFa`, `nameEn`, `surface`, `population`, `rotationSpeed`, `resistance`, `cloudOpacity`, three palette colors, and optional atmosphere/cloud tint. The UI discovers planets automatically. Choose `rocky` or `bands` for procedural textures; `earth` uses the legacy continental painter. Each body uses a normalized in-game radius of 10 and has its **own fresh state on selection**; physical scale is not simulated.

## Add a weapon

Add a `registerWeapon({...})` call in `src/content/catalog.js` with unique `id`, `nameFa`, `kind`, `blastRadius`, `damage`, `damageVariance`, `casualties`, `casualtiesVariance`, `speed`, `shake`, `debrisCount`, and optional visual colors. The UI discovers weapons automatically. Supported `kind` values are `missile`, `asteroid`, `beam`. The existing ballistic runtime handles missiles and asteroids; beams use an immediate short-lived cylinder effect. To add a *new kind*, implement its behavior in the runtime's `fireWeaponAtWorldPoint` dispatch and add it to catalog validation. Damage, craters, casualties and debris depend on weapon configuration and planet resistance.

## Current content

Planets: Earth, Mars, Venus, Moon. Weapons: ICBM missile, kinetic asteroid, orbital laser. Planet artwork beyond Earth is intentionally procedural/stylized, not photorealistic. Earth retains the original approximate polygon-based procedural map.

## Architecture roadmap

1. Extract Three.js world lifecycle, mesh allocation/disposal, camera, effects, input and HUD from `index.html` into separate JS ES modules.
2. Replace ad-hoc timeouts with a session-scoped scheduler. Implement pool recycling for missiles, particles and debris (particularly for Android-class devices).
3. Add distinct impact effect strategies, beam-specific shaders, shielding and per-planet destruction profiles. Use coordinate-normalized crater textures and regeneration.
4. Add high-quality licensed planetary texture assets with proper attribution, optional LOD, and GPU performance profiling.
5. Introduce adaptive resolution and quality tiers; preserve a static web build for GitHub Pages.
6. Later roadmap: package the shared web gameplay core into an Android app or port its rendering/frontend to a native shell. No Android build is included in this change.

## Limitations

The core game still lives in a long HTML script. Selecting another planet resets the active simulation instead of retaining multiple worlds simultaneously. Stats use arcade values, not astronomical or demographic simulation. The test suite covers catalog and procedural painter but **does not** substitute for browser/WebGL playtesting.
