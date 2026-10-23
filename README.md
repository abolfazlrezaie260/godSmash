# GodSmash — Extensible planets and weapons

Browser-based 3D planet destruction game, built with Three.js. The game uses modular planet and projectile content definitions with a browser-based Three.js runtime.

## Run

Serve the repository root through a static server or GitHub Pages. Open `index.html`. The default choice is **Earth + ICBM**. Planet selection now opens an accessible preview modal with the same local Earth image and canvas-generated Mars, Venus and Moon surfaces; the planet dropdown is removed. The single speed button cycles **1× → 2× → 0.5× → 1×** per tap without reloading. The time scale applies to missile flight, planet/cloud rotation, smoke and impact effects, debris, camera transitions and salvo spacing. Weapons are selected from a fixed bottom-left icon dock supporting mouse, touch and keyboard. No compilation step is needed. The Three.js runtime, Tailwind and fonts CDNs still require network access; **Earth imagery itself is served locally by the same site**.

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
| `src/defense/catalog.js` | Extensible registry for planetary defence categories and unit types |
| `src/defense/orbital-defense.js` | Pure satellite orbit, hostile projectile detection, line-of-sight and laser combat logic |
| `src/defense/orbital-defense-renderer.js` | Low-poly satellite models and pooled laser beam visuals |
| `tests/orbital-defense.test.cjs` | Defence configuration, targeting, interception and time-step tests |
| `tests/catalog.test.cjs` | Registry and texture-painting smoke tests |
| `tests/missile-physics.test.cjs` | Flight acceleration, fuel use, ballistic impacts and frame-rate consistency |

## Add a planet

Add a `registerPlanet({...})` call in `src/content/catalog.js` (prefer splitting presets into their own files in the next refactor). Provide unique `id`, `nameFa`, `nameEn`, `surface`, `population`, `rotationSpeed`, `resistance`, `cloudOpacity`, three palette colors, and optional atmosphere/cloud tint. The UI discovers planets automatically. Choose `rocky` or `bands` for procedural textures; `earth` uses the bundled photographic maps. The procedural painter is no longer used for Earth. Each body uses a normalized in-game radius of 10 and has its **own fresh state on selection**; physical scale is not simulated.

## Add a weapon

Add a `registerWeapon({...})` call in `src/content/catalog.js` with unique `id`, `nameFa`, `kind`, `blastRadius`, `damage`, `damageVariance`, `casualties`, `casualtiesVariance`, `speed`, `shake`, `debrisCount`, and optional visual colors, `visualProfile`, `launchSpeed`, `acceleration`, `maxSpeed`, `fuelDuration` and `drag`. Flight values are game-space tuning parameters, not real propulsion measurements. For a new missile silhouette, add a matching profile in `src/render/projectile-models.js`; profiles can customize plume colors, fins, wings, booster pods and glow bands. The UI discovers weapons automatically. The dock currently exposes eight weapons, including the three new missile profiles. Supported `kind` values are `missile`, `asteroid`, `beam`. The existing ballistic runtime handles missiles and asteroids; beams use an immediate short-lived cylinder effect. To add a *new kind*, implement its behavior in the runtime's `fireWeaponAtWorldPoint` dispatch and add it to catalog validation. Damage, craters, casualties and debris depend on weapon configuration and planet resistance.

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
- **Impact angle matters:** grazing impacts make wider, shallower, directionally elongated craters and longer scorch marks; the incoming speed also adjusts delivered damage within a bounded arcade range.
- **Accumulated surface damage:** overlapping impacts are grouped into bounded surface sites, each site tracks repeat hits and the HUD reports an estimated damaged-surface percentage. This is a spherical-cap coverage estimate, not a geophysical measurement.
- **Large asteroid impacts** remove triangles from the planet's *indexed mesh* around the hit. The missing crust exposes a recessed rocky interior and a jagged, layered rim. These openings persist after the explosion ends. Later missiles can also breach a heavily damaged world.
- **Blast animation** uses a turbulent procedural fireball shader, a hot plasma shell and two expanding surface shock rings. Soft smoke sprites and incandescent fragments add irregular detail; light flashes on higher-quality devices.
- **Debris** uses rough, flat-shaded rock materials, varied fragment sizes, independent spin and fading heat. Breaches throw a handful of larger crust chunks as well as small ejecta, within a per-scene cap.
- **Planet reset or selection** restores the original vertex/index buffers, destroys persistent rim meshes and clears transient effects. Full shattering hides intact crust and breach walls.
- **Adaptive budgets** allow up to 6 breaches and 4 simultaneous blast effects on small/low-data devices; on larger devices, up to 12 breaches and 8 effects. Live missiles are capped at 8 on small/low-data devices and 20 on larger devices; debris is capped at 96 and 210 respectively. Surface damage sites are capped at 72 and 160.

### How to try it

Select **شهاب‌سنگ** (asteroid) and strike an intact planet. Rotate the camera to see the permanent hole and exposed interior. Fire ordinary missiles to add dents, then continue damaging the world to produce further breaches. Use **بازسازی** to recover a pristine sphere. Try Earth, Mars, Venus and the Moon; the Moon has a colder, unlit interior.

### Limitations

This is a **visually richer arcade destruction model**, not a scientifically accurate planet fracture or fluid/thermodynamic simulation. The crater and interior are produced using CPU-side vertex displacement and indexed triangle removal; there is no voxel engine, free-form CSG or physically correct continent-scale destruction. Hole boundaries are simplified to protect browser/mobile FPS. Overlapping breaches are coalesced visually by skipping nearby new openings; their impact damage still registers. Automated geometry, impact-angle, accumulated-damage, flight-physics and resource-budget tests cover the new systems. Full browser/WebGL visual inspection and real-device FPS/memory measurements are still required before making performance guarantees. The flight model is a deterministic arcade approximation, not a real engine, ballistic trajectory or CFD simulation.


## Fixed weapon dock (responsive)

Weapon selection is now **not a dropdown**. On mobile/tablet screens it becomes a **horizontal swipeable touch strip** above the main controls; on larger viewports the original vertical dock remains:

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


## Gameplay physics and performance budgets

Projectile motion is integrated in small fixed substeps by `src/simulation/missile-physics.js`. Weapon catalog entries can tune launch speed, acceleration, maximum speed, fuel duration and drag. Missiles burn down their exhaust over the powered phase and coast afterward; asteroids are ballistic and do not consume rocket fuel. Flight uses the same scaled delta time as the rest of the simulation, so 0.5×, 1× and 2× affect the full trajectory.

The impact engine records bounded damage sites and estimates surface coverage from spherical caps. Hits near an existing site merge into it, while hits elsewhere create a separate site until the quality-specific cap is reached. Planet reset clears the site history, restores the original mesh and textures, and disposes persistent crater rims.

For a repeatable manual performance check, use the same browser and viewport, select the lowest and highest quality modes (narrow viewport/save-data versus desktop), fire 20+ consecutive missiles including asteroid breaches, leave effects running for 30 seconds, then reset twice. Check for missing HUD updates, lingering effects and steadily growing GPU memory. Record browser/device, viewport, device-pixel ratio, quality mode and average FPS; automated tests do not replace this profiling.


## Adaptive rendering and profiling (Issue #14)

- Rocket smoke/ember sprites are **pooled**, with one live `SpriteMaterial` per particle. Individual materials and shared atlas textures are retained across resets and disposed only when the particle system itself is destroyed. Pool allocations never exceed the configured maximum.
- The adaptive quality controller samples **unscaled** wall-clock frame durations (unaffected by 0.5×/1×/2× game speed). After sustained low FPS it gradually reduces device-pixel ratio and sprite capacity; recovery is slower and guarded by a cooldown to avoid oscillation. Browser background periods are excluded.
- Quality caps remain in force: 8/20 live projectiles, 96/210 debris chunks, 4/8 explosions, 92/220 sprites for low/high base quality, further reduced adaptively under load.
- CPU frame allocations were reduced by reusing `THREE.Vector3` scratch instances for flight interpolation and crater vertex updates.
- Open the game with `?perf=1` to display a small diagnostic panel with estimated FPS, active particle budgets, draw calls, geometries, textures and optional JS heap.
- Follow the [repeatable Mac and Android benchmark checklist](docs/performance-benchmark.md). Do not mark Issue #14 fully complete until measurements from both real device classes are posted. Automated unit tests establish resource correctness but are not a substitute for GPU profiling.


## Planetary defense — orbital laser satellites

The top HUD has a **دفاع** button that opens a responsive and keyboard-accessible defence configuration dialog. The first usable category is **ماهواره لیزری** (Orbital Laser). The game begins with **zero defenders**. The player explicitly deploys individual defensive satellites using **+ افزودن ماهواره** and removes them individually with **− حذف ماهواره**. Up to six can be deployed to each planet; each planet maintains its own fleet count during the current game session. Toggling the system off does not delete deployed units; restoring a planet keeps its manually deployed defenders. The defence counters show shots fired and successfully intercepted projectiles; rebuilding or switching planets clears counts and ongoing beams while retaining the chosen mode and count.

The units are compact **armoured fictional orbital interceptors**, with faceted protective plating, forward twin laser cannons, a sensor turret and cyan laser emitters; they have no decorative solar wings. Only user-deployed units become visible. The simulation checks incoming **physical projectiles** (missiles and asteroids), prioritizes nearby threats, checks that the line of sight does not go through the planet, and fires cyan laser beams within a limited range and cooldown. Each projectile has a small, configurable game-space interception durability. If its durability reaches zero before surface contact, it is removed along with its targeting reticle, creates a small burst, and **does not call the planetary impact/damage handler**. The instant-hit orbital offensive laser is not intercepted because it does not enter the physical projectile pool.

### Add another category or defence system

1. Register a new unique `id` and `category` in `src/defense/catalog.js`, supplying `nameFa`, `orbitRadius`, `range`, `damage`, `cooldown`, `angularSpeed` and allowed unit counts.
2. Provide the corresponding simulator and visual implementation for that type (e.g., an energy shield or interceptors). The pure `src/defense/orbital-defense.js` module currently implements **only orbital-laser** mechanics; additional registry entries must not be exposed as functional until the runtime is implemented.
3. Add UI selection and tests for the additional type. The UI list is generated from the current defence type catalog.
4. Respect the existing low-end quality budget, simulation time scale and reset/planet-switch cleanup.

### Boundaries and balancing

This is an arcade defence system, not a real-world satellite targeting or laser propagation simulation. Satellites track automatically; there is no manual aim, ammunition, power grid or satellite health yet. Laser beams have a short visual lifetime; a finite cooldown, range and line-of-sight check prevent every satellite from shooting every missile indiscriminately. Defence does not guarantee interception of all incoming projectiles, especially during a salvo. Unit meshes, beam geometries and materials are reused and the maximum simultaneously visible satellite/beam counts are fixed for mobile FPS.

Run `node --test tests/*.test.cjs` and visually verify both the intercept and no-intercept paths before release. In particular, confirm time scaling at **0.5×, 1× and 2×**, and reset/switch to another planet after a defence intercept.


## Mobile-first impact and controls refresh

The old giant red emissive impact disks and long bright orange radial spokes are removed. Damage now paints **localized charcoal/ash patches** and subtle dark hairline cracks on the daytime texture, while the deformation/breach engine continues to create actual craters and broken rock. A full breach now exposes dark, rough interior rock, not a bright fluorescent-red inner sphere. Rocket flames and transient explosion animations remain visible.

Planet selection uses `src/ui/planet-picker.js`. The bottom bar has a single `سیاره` button that opens a centered modal on larger viewports and a bottom sheet on phones and tablets. Four planet cards use the local Earth photographic texture or the same seeded procedural textures as the actual non-Earth planets. Each card has the Persian/English name and a short description, and the current selection is highlighted. Tap a card to switch planet and close the sheet. Keyboard focus and Escape close are supported.

Speed selection no longer uses an HTML select: a single stopwatch-style button cycles `1× → 2× → 0.5× → 1×`. It updates the existing time scale for all game simulation systems. No duplicate speed icons or dropdowns are rendered.

For viewports up to **1024px**, the weapon dock is a horizontally scrollable, touch-friendly strip; the bottom controls are compact and wrap when necessary. Touch targets are at least 44px, safe-area insets are respected, and redundant desktop-specific active-weapon cards are hidden. The primary target is mobile/tablet, with desktop UI retained as a fallback.

After deployment, test landscape/portrait phones and tablets with the defence modal, planet modal, changing the active planet, 0.5×/1×/2× time scale and repeated heavy impacts. Automated JS/DOM tests do not replace visual WebGL checks on a physical phone.


## Planetary defence v2 — player-selected orbital placement, 3 unit classes and radar

The planetary defence dialog is now a mobile/tablet-friendly control center with three selectable **fictional** defence types:

| Type | Tactic | Arcade limitations |
| --- | --- | --- |
| **ماهواره لیزری — Orbital Laser** | Fast, frequent cyan precision shots against lighter missiles | Low damage per burst, line-of-sight check and finite range |
| **رهگیر موشکی — Heavy Interceptor** | Slow, powerful amber strikes against heavy projectiles | Longer reload and slower orbital movement |
| **ماهواره سپرساز — Shield Projector** | Green localized energy interception near the planet surface | Works only within the satellite's local coverage and close to the planet; requires recharge |

**How to deploy:** Tap **دفاع** → select a unit type → **انتخاب محل استقرار**. The dialog closes and a placement prompt appears. Tap a **visible spot on the planet** to deploy a satellite in an orbit starting above that spot; tap **لغو** to cancel without adding anything. A tap in placement mode **does not fire a missile**. Each planet starts with zero defenders, has a maximum six total satellites across all types, and retains the selected unit types and orbital placements during the current game session. Return to another planet to restore its stored fleet. Planet rebuild resets shot counters, not the fleet.

The **radar** lists a bounded set of incoming projectiles and projects their live positions into a compact 2D display. The player can choose target priority:

- **نزدیک‌ترین** — nearest to the planet surface (default).
- **سریع‌ترین** — highest instantaneous game-space velocity.
- **مخرب‌ترین** — greatest weapon damage.

An orbital unit only fires when its cooldown, coverage, range and planet line-of-sight checks all pass. A successful interception removes the threat before the planet damage handler runs, including when the threat reaches the surface in the current update frame. Each type has a dedicated low-poly model variant and an individual beam color. Projectile targeting and orbit calculations use the existing 0.5×/1×/2× simulation clock, not real time.

Architecture: `src/defense/catalog.js` defines the unit registry, `src/defense/orbital-defense.js` implements pure combat/placement/radar logic, and `src/defense/orbital-defense-renderer.js` owns visual models and pooled laser effects. Unit counts remain capped at six, active beam meshes at 6–12 depending on graphics quality and threat radar entries at twelve.

**Scope and limitations:** These systems are gameplay approximations, not actual spacecraft, weapon engineering, or ballistic-defense calculations. Orbital placement establishes the initial orbital direction rather than permanently station-keeping over a fixed country. The energy shield only intercepts eligible projectiles near its current orbital coverage; it is not a permanent invulnerable planet-wide shield. Orbital configurations persist across planet changes during the session, but not across browser reloads. For UI regression testing see `tests/index-script.test.cjs`; the behavioural coverage is in `tests/defense-v2.test.cjs`. Real mobile browser render/FPS verification is still needed.
