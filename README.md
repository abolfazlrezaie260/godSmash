# GodSmash — Extensible planets and weapons

Browser-based 3D planet destruction game, built with Three.js. The game uses modular planet and projectile content definitions with a browser-based Three.js runtime.

## Run

Serve the repository root through a static server or GitHub Pages. Open `index.html`. The default choice is **Earth + ICBM**. The planet selector remains a dropdown; weapons are selected from a fixed bottom-left icon dock supporting mouse, touch and keyboard. No compilation step is needed. The Three.js runtime, Tailwind and fonts CDNs still require network access; **Earth imagery itself is served locally by the same site**.

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
| `src/render/real-earth.js` | Photographic maps, normal/roughness/cloud maps and night-side city-light shader |
| `assets/textures/earth/` | Five bundled day/night/cloud/normal/specular maps |
| `src/render/projectile-models.js` | Detailed fictional missile silhouettes, metal panels, nozzle, thermal exhaust layers and shock diamonds |
| `src/render/impact-effects.js` | Turbulent procedural fireball shader and expanding surface shockwave rings |
| `src/render/rocket-fx.js` | Reusable soft smoke sprites, incandescent trail fragments and impact bursts |
| `src/ui/weapon-dock.js` | Accessible fixed weapon inventory, catalog-driven tiles and keyboard navigation |
| `tests/catalog.test.cjs` | Registry and texture-painting smoke tests |

## Add a planet

Add a `registerPlanet({...})` call in `src/content/catalog.js` (prefer splitting presets into their own files in the next refactor). Provide unique `id`, `nameFa`, `nameEn`, `surface`, `population`, `rotationSpeed`, `resistance`, `cloudOpacity`, three palette colors, and optional atmosphere/cloud tint. The UI discovers planets automatically. Choose `rocky` or `bands` for procedural textures; `earth` uses the bundled photographic maps. The procedural painter is no longer used for Earth. Each body uses a normalized in-game radius of 10 and has its **own fresh state on selection**; physical scale is not simulated.

## Add a weapon

Add a `registerWeapon({...})` call in `src/content/catalog.js` with unique `id`, `nameFa`, `kind`, `blastRadius`, `damage`, `damageVariance`, `casualties`, `casualtiesVariance`, `speed`, `shake`, `debrisCount`, and optional visual colors and `visualProfile` (for missile silhouettes). For a new missile silhouette, add a matching profile in `src/render/projectile-models.js`; profiles can customize plume colors, fins, wings, booster pods and glow bands. The UI discovers weapons automatically. The dock currently exposes eight weapons, including the three new missile profiles. Supported `kind` values are `missile`, `asteroid`, `beam`. The existing ballistic runtime handles missiles and asteroids; beams use an immediate short-lived cylinder effect. To add a *new kind*, implement its behavior in the runtime's `fireWeaponAtWorldPoint` dispatch and add it to catalog validation. Damage, craters, casualties and debris depend on weapon configuration and planet resistance.

## Current content

Planets: Earth, Mars, Venus, Moon. Weapons: six fictional missile models (strategic, lightweight, winged, Titan siege, Viper hypersonic, Nova plasma), kinetic asteroid, orbital laser. Planet artwork beyond Earth is intentionally procedural/stylized, not photorealistic. Earth loads bundled photographic day/night, surface normals and cloud maps before the first gameplay frame. City lights render on a separate shader layer that fades to the night hemisphere based on the sun direction.

## Architecture roadmap

1. Extract Three.js world lifecycle, mesh allocation/disposal, camera, effects, input and HUD from `index.html` into separate JS ES modules.
2. Replace ad-hoc timeouts with a session-scoped scheduler. Implement pool recycling for missiles, particles and debris (particularly for Android-class devices).
3. Add distinct impact effect strategies, beam-specific shaders, shielding and per-planet destruction profiles. Use coordinate-normalized crater textures and regeneration.
4. Add high-quality licensed planetary texture assets with proper attribution, optional LOD, and GPU performance profiling.
5. Introduce adaptive resolution and quality tiers; preserve a static web build for GitHub Pages.
6. Later roadmap: package the shared web gameplay core into an Android app or port its rendering/frontend to a native shell. No Android build is included in this change.

## Limitations

The core game still lives in a long HTML script. Selecting another planet resets the active simulation instead of retaining multiple worlds simultaneously. Stats use arcade values, not astronomical or demographic simulation. The test suite covers catalogs, procedural surfaces and projectile model resource lifecycles but **does not** substitute for browser/WebGL playtesting.


## Photographic Earth rendering (local assets)

The five Earth map files are **committed inside this repository** at `assets/textures/earth/`. They are loaded by `src/render/real-earth.js` using relative URLs, so a GitHub Pages project subpath such as `/godSmash/` works without hardcoded origins or external texture CDNs. The player sees a loading screen until **all five** maps are available; if one is missing, a localized error with a retry button appears instead of the old cartoon Earth. The planet and its destruction/canvas reset start only after the maps load. Mars, Venus and the Moon retain the separate procedural paint engine.

Asset provenance and exact content verification are documented in [assets/textures/earth/README.md](assets/textures/earth/README.md). These particular maps were vendored from the Three.js r128 example assets. **Asset redistribution rights and required credits must be audited before commercial use**; MIT licensing of the Three.js source code does not automatically establish licensing for every image. See [NASA media usage](https://www.nasa.gov/nasa-brand-center/images-and-media/) for imagery of NASA origin.

Run `node --test tests/*.test.cjs` to check bytes, file signatures and loader retry behavior. Earth textures now work without network access **once the web application and its runtime dependencies are available** (the game still includes external JavaScript and font CDNs). Browser visual testing and a full Android offline package are separate tasks.

Next visual improvements: physically correct night-side city light illumination, dynamic cloud shadows, and additional LOD variants.

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

## Localized crust destruction and blast effects

The damage engine is now split into `src/render/planet-damage.js` and `src/render/impact-effects.js`:

- **Every hit** deforms the planet surface into a depth-scaled bowl and raised rim, plus permanent charred/lava texture painting. Damage depth and color vary with weapon and surface resistance.
- **Large asteroid impacts** remove triangles from the planet's *indexed mesh* around the hit. The missing crust exposes a recessed rocky interior and a jagged, layered rim. These openings persist after the explosion ends. Later missiles can also breach a heavily damaged world.
- **Blast animation** uses a turbulent procedural fireball shader, a hot plasma shell and two expanding surface shock rings. Soft smoke sprites and incandescent fragments add irregular detail; light flashes on higher-quality devices.
- **Debris** uses rough, flat-shaded rock materials, varied fragment sizes, independent spin and fading heat. Breaches throw a handful of larger crust chunks as well as small ejecta, within a per-scene cap.
- **Planet reset or selection** restores the original vertex/index buffers, destroys persistent rim meshes and clears transient effects. Full shattering hides intact crust and breach walls.
- **Adaptive budgets** allow up to 6 breaches and 4 simultaneous blast effects on small/low-data devices; on larger devices, up to 12 breaches and 8 effects.

### How to try it

Select **شهاب‌سنگ** (asteroid) and strike an intact planet. Rotate the camera to see the permanent hole and exposed interior. Fire ordinary missiles to add dents, then continue damaging the world to produce further breaches. Use **بازسازی** to recover a pristine sphere. Try Earth, Mars, Venus and the Moon; the Moon has a colder, unlit interior.

### Limitations

This is a **visually richer arcade destruction model**, not a scientifically accurate planet fracture or fluid/thermodynamic simulation. The crater and interior are produced using CPU-side vertex displacement and indexed triangle removal; there is no voxel engine, free-form CSG or physically correct continent-scale destruction. Hole boundaries are simplified to protect browser/mobile FPS. Overlapping breaches are coalesced visually by skipping nearby new openings; their impact damage still registers. Automated geometry and effects tests pass, but full browser/WebGL visuals and mobile benchmark results are not yet confirmed. A future iteration can introduce fracture chunks/LOD and GPU-based volumetric particles.


## Fixed weapon dock (responsive)

Weapon selection is now **not a dropdown**. It appears in a floating panel at the **bottom-left** of the gameplay area, above the existing firing/planet controls:

- **Desktop:** one vertical column with icon, Persian name, short weapon description and shortcut number.
- **Mobile:** compact two-column button grid with individual icons and short Persian labels. The currently selected weapon has an orange highlight.
- **Interaction:** touch/click to select; `1`–`9` (up to the currently registered weapon count) select directly while the game is focused. Arrow keys or Home/End navigate between weapon buttons when the dock itself has keyboard focus. Each button uses `aria-pressed` and descriptive labels.
- The active-weapon title/subtitle in the existing HUD follows dock selection; launch mechanics are unchanged.
- The dock measures the footer height using `ResizeObserver` (with a resize fallback), leaving clearance for the firing controls even on narrow screens.

To add another weapon button, register it in `src/content/catalog.js`; the dock automatically builds from `catalog.listWeapons()`. Add an optional `shortLabel` to keep the mobile label concise. No changes to the HUD markup are necessary. Check `tests/weapon-dock.test.cjs` for interaction tests. Real-device visual layout testing remains recommended.


## Realistic cinematic effects pass

The latest visual pass adds:

- **Earth lighting:** city lights are separated from crater/magma emission and masked to the night hemisphere using a world-space sun direction. The photographic normal and ocean roughness maps remain active; real cloud imagery is layered above the surface.
- **Rocket exhaust:** the missile nozzle plume now has five thermal layers (cool outer envelope, orange combustion, yellow flame and white-hot core) plus subtle shock-diamond rings. The plume flickers, scales down as the projectile approaches impact and emits soft smoke with occasional glowing fragments.
- **Impact fireball:** a procedural fragment-shader adds moving turbulence to the fireball, instead of a uniformly colored smooth sphere. A hot plasma shell fades while two surface-parallel shock rings expand across the impact site.
- **Atmospheric-looking smoke and ejecta:** shared procedural alpha textures are rendered as camera-facing sprites. Smoke spreads and fades; ember particles move faster and fade sooner. The particle system enforces a global budget (92 on small/save-data devices, 220 on larger devices).
- **Surface fracture:** the existing mesh breach system is retained; impacts now eject varied rough-rock fragments, larger chunks on breaches, random angular motion and cooling emissive heat. Planet-wide rupture gets a separate core bloom and a capped radial debris burst.
- **Cleanup and mobile budget:** particle materials, transient effects, meshes and textures are released when cleared; fragment and effect counts are bounded.

The visuals are **cinematic approximations**. The plume is not a measured propulsion/combustion model; smoke is sprite-based rather than volumetric CFD; the shock rings are visual wavefronts, not a physically correct pressure simulation; and planetary fracture does not use a voxel or finite-element solver. The project remains a Three.js browser game, with visual polish balanced against mobile GPU budgets.

Run `node --test tests/*.test.cjs`. Automated tests cover shader configuration, asset loading, exhaust particle budgets, effect disposal, missile geometry and crater topology. These tests do not replace WebGL/browser screenshots or device FPS measurements; those should be done before release.
