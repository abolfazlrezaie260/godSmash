# GodSmash — Extensible planets and weapons

Browser-based 3D planet destruction game, built with Three.js. The game uses modular planet and projectile content definitions with a browser-based Three.js runtime.

## Run

Serve the repository root through a static server or GitHub Pages. Open `index.html`. The default choice is **Earth + ICBM**. The planet and weapon dropdowns support mouse and touch. No compilation step is needed. The Three.js, Tailwind and fonts CDNs still require a network connection.

```sh
npx serve .
node --test tests/*.test.cjs
```

## Structure

| Location | Purpose |
| --- | --- |
| `index.html` | Existing Three.js scene, HUD, camera, raycast, impact engine and loop |
| `src/content/catalog.js` | Planets and weapons registries, data validation and default presets |
| `src/render/planet-textures.js` | Deterministic, procedural surface painter for new planets |
| `src/render/real-earth.js` | Photographic Earth imagery loader with offline fallback |
| `src/render/projectile-models.js` | Detailed fictional missile silhouettes, decals, fins, nozzles and plume effects |
| `tests/catalog.test.cjs` | Registry and texture-painting smoke tests |

## Add a planet

Add a `registerPlanet({...})` call in `src/content/catalog.js` (prefer splitting presets into their own files in the next refactor). Provide unique `id`, `nameFa`, `nameEn`, `surface`, `population`, `rotationSpeed`, `resistance`, `cloudOpacity`, three palette colors, and optional atmosphere/cloud tint. The UI discovers planets automatically. Choose `rocky` or `bands` for procedural textures; `earth` uses the legacy continental painter. Each body uses a normalized in-game radius of 10 and has its **own fresh state on selection**; physical scale is not simulated.

## Add a weapon

Add a `registerWeapon({...})` call in `src/content/catalog.js` with unique `id`, `nameFa`, `kind`, `blastRadius`, `damage`, `damageVariance`, `casualties`, `casualtiesVariance`, `speed`, `shake`, `debrisCount`, and optional visual colors and `visualProfile` (for missile silhouettes). The UI discovers weapons automatically. Supported `kind` values are `missile`, `asteroid`, `beam`. The existing ballistic runtime handles missiles and asteroids; beams use an immediate short-lived cylinder effect. To add a *new kind*, implement its behavior in the runtime's `fireWeaponAtWorldPoint` dispatch and add it to catalog validation. Damage, craters, casualties and debris depend on weapon configuration and planet resistance.

## Current content

Planets: Earth, Mars, Venus, Moon. Weapons: three fictional missile models (strategic, lightweight, winged), kinetic asteroid, orbital laser. Planet artwork beyond Earth is intentionally procedural/stylized, not photorealistic. Earth loads photographic day/night, surface normals and cloud maps online (with fallback to the old painter).

## Architecture roadmap

1. Extract Three.js world lifecycle, mesh allocation/disposal, camera, effects, input and HUD from `index.html` into separate JS ES modules.
2. Replace ad-hoc timeouts with a session-scoped scheduler. Implement pool recycling for missiles, particles and debris (particularly for Android-class devices).
3. Add distinct impact effect strategies, beam-specific shaders, shielding and per-planet destruction profiles. Use coordinate-normalized crater textures and regeneration.
4. Add high-quality licensed planetary texture assets with proper attribution, optional LOD, and GPU performance profiling.
5. Introduce adaptive resolution and quality tiers; preserve a static web build for GitHub Pages.
6. Later roadmap: package the shared web gameplay core into an Android app or port its rendering/frontend to a native shell. No Android build is included in this change.

## Limitations

The core game still lives in a long HTML script. Selecting another planet resets the active simulation instead of retaining multiple worlds simultaneously. Stats use arcade values, not astronomical or demographic simulation. The test suite covers catalogs, procedural surfaces and projectile model resource lifecycles but **does not** substitute for browser/WebGL playtesting.


## Photographic Earth rendering

Earth now upgrades automatically from the original painted globe to real equirectangular imagery: daytime surface (4096-wide source), night city lights, atmospheric clouds, terrain normal map and an ocean reflectance/roughness approximation. Deformation, craters and reset reuse the original dynamic canvas. Mars, Venus and the Moon retain their procedural appearances. On a failed image request, the original playable Earth remains visible.

Image assets are loaded from a version-pinned public CDN and are **not bundled** with the repository. The browser needs network access for the high-fidelity layer, even on GitHub Pages. Canvas images are requested with CORS enabled. On first load the original surface is shown before the upgrade. Late image completion does not overwrite a planet after impacts.

Sources and upstream files: [Three.js r128 examples planet textures](https://github.com/mrdoob/three.js/tree/r128/examples/textures/planets). These sample image files must be checked for any relevant individual asset license or attribution obligations before commercial redistribution; do not assume the code's MIT license automatically covers each image. Consult the [NASA image usage policy](https://www.nasa.gov/nasa-brand-center/images-and-media/) for NASA-derived imagery. This build links to them at runtime, rather than redistributing image bytes.

Next quality improvements: physically accurate day/night masking for city lights, higher quality Earth normals, source-verified local textures for fully offline Android packaging and a dedicated cloud shadow shader. Browser visual QA is required after deployment.


## Detailed 3D missile models

The procedural visual factory lives in `src/render/projectile-models.js` and is independent of damage/physics. It builds three different **fictional** rocket silhouettes:

| Visual profile | Gameplay weapon | Appearance |
| --- | --- | --- |
| `strategic` | `icbm` | Long ogive nose, multi-panel fuselage, metal bands, four stabilizer fins |
| `interceptor` | `swift` | Lighter slim body, smaller rear fins and shorter nozzle |
| `cruise` | `winged` | Two large mid-body wings, four tail stabilizers and a shorter nose |

Each launch has layered semi-transparent exhaust, a game-fiction serial marking, a metallic fuselage material, and a time-rate-limited smoke trail. Assets are generated locally (no additional CDN requests). The game scales the projectile size up relative to its planet so details remain visible on ordinary screens; sizes and trajectories are not meant to reproduce real launch vehicle physics.

To introduce a new silhouette, add a compatible entry to `profiles` in `src/render/projectile-models.js` and set the weapon's `visualProfile` field in `src/content/catalog.js`. To introduce a new effect/behavior, extend the runtime dispatch separately. The model builder exposes `dispose()` to release per-projectile GPU resources after impact/reset. A smaller geometry profile and smoke emission budget are used on narrower devices. Test with `node --test tests/*.test.cjs`.

**Known limitation:** The models are generated meshes, not scanned real-world missile assets; browser visual inspection and mobile GPU benchmarking should be completed prior to release.
