# GodSmash mobile release plan (Issue #41)

Status: **scope and repeatable baseline protocol defined; hardware measurements pending**.
This file contains no fabricated FPS, memory, startup, or device-compatibility claims.

## Release target / architectural decision

- Target an installable **Android** and **iOS** game using Capacitor around the existing Three.js implementation.
- Keep GitHub Pages functional, with a separate `dist/` build intended for a native WebView; do not rewrite gameplay in another engine.
- First milestone: an internal Android APK and an iOS debug build that render the game and work with airplane mode enabled.
- Store release (signed AAB, TestFlight, App Store) is a later milestone. Do not assume developer accounts, signing keys, or an attached physical device are available.
- Preserve the right-to-left Persian HUD and the current `fa` game copy. No login, payments, tracking SDKs, or requested system permissions are needed for the first release unless a later feature justifies them.
- Keep 3D rendering in WebGL; internet imagery may enhance continent mode but cannot be required to start the game.

### MVP inclusion matrix

| Feature | MVP | Smoke test |
|---|---|---|
| Earth, Moon, Mars, Venus | Required | All load; switch repeatedly |
| Weapons, impact and persistent surface damage | Required | Fire each category and reset |
| Drone swarms / harvesters | Required | Spawn, attack, leave / clean up |
| Planet selection and defense UI | Required | Open, deploy, cancel and close |
| Flat continent map and country-to-country missiles | Required | Select source/target and launch; offline fallback |
| Score/debrief and local best scores | Required | Finish a planet, retry, relaunch |
| Full-screen landscape and safe-area controls | Required | Touch, notch, gesture navigation |
| Touch-friendly aiming, drag, pinch zoom | Required | No accidental tap launches |
| Gameplay usable in airplane mode after installation | Required | Cold start and switch modes |
| Login, IAP, push notifications, multiplayer | Out of scope | No permissions or SDKs |

The actual minimum Android/iOS versions and final supported device classes must be confirmed against the chosen Capacitor version and real-device measurements before store submission.

## Benchmark protocol

Use the existing `?perf=1` overlay and [performance benchmarking procedure](../performance-benchmark.md) as the source of per-frame statistics. The overlay reports renderer counters, **not total physical GPU memory**. Measure the same flows in an Android browser and later in Android WebView; repeat in iOS Safari/WKWebView when a Mac and iPhone are available.

1. Record device model, chipset, OS/build number, browser/WebView version, pixel ratio, power mode and battery state; do not use guessed hardware fields.
2. Start a fresh install/cold launch. Record time to first usable rendered planet (not only DOM load) and texture-ready state. For native builds report APK/AAB/IPA size separately from installed storage use.
3. Keep Earth idle in landscape, auto-rotation off, at 1× for 30 seconds. Record median/min FPS and WebGL draw calls, geometries and textures.
4. Fire 12 Viper, 6 Titan and 6 asteroid attacks over 60 seconds; record FPS median/p5, quality level, and WebGL counters. Repeat one cycle with swarm/harvester and country mode.
5. Reset Earth three times with 30-second idle intervals. Record the geometry/texture count after each reset and watch for monotonic growth.
6. Run 10 minutes of mixed gameplay to record stuttering, thermals and battery, switch background/foreground five times, then run a full airplane-mode cold start.
7. Repeat at 0.5× and 2× simulation speed, plus portrait-to-landscape transition where supported; attach screenshots or traces to #41 and add a row per run to `measurements.csv`.

For frame-rate percentiles, collect a performance trace or external profiler; the live FPS overlay alone is an instantaneous indicator, **not** a distribution. Do not close #41 until real-device records are attached.

## Proposed budgets — pending measurement

- **Usability:** every gameplay action must be reachable by touch; modal and bottom HUD controls must remain within safe areas.
- **Frame stability:** aim for a stable 30 FPS floor on a *chosen, documented* mid-range Android and a documented iPhone, with a 60 FPS preference on capable devices. These are **targets**, not achieved results or release gates until baselines confirm them.
- **Memory:** no unbounded growth in resources after repeated attacks and resets; release on repeated reproducible crashes even if the median FPS target passes.
- **Offline:** no vital JavaScript, font, shader, local texture, or catalog request is allowed to fail without a local fallback once the app is installed.

## Required device results before closing #41

| Record | Android mid-range | iPhone |
|---|---|---|
| Exact model, SoC, OS | Not measured | Not measured |
| Browser / WebView version | Not measured | Not measured |
| Landscape logical viewport / DPR | Not measured | Not measured |
| Cold-start usable rendering, seconds | Not measured | Not measured |
| Idle median/p5 FPS | Not measured | Not measured |
| 24-impact median/p5 FPS | Not measured | Not measured |
| 10-minute thermal/crash observations | Not measured | Not measured |
| Geometry/texture counts after 3 resets | Not measured | Not measured |
| Offline cold start and continent fallback | Not measured | Not measured |

## Sequential delivery

#42 build pipeline → #43 offline/vendor dependencies → #44 native projects → #45 orientation/safe areas → #46 touch HUD → #47 WebGL measurements/optimization → #48 packaged assets. The Android and iOS platform testing cannot be simulated by the Node.js unit suite.

Reference: [Capacitor setup](https://capacitorjs.com/docs/getting-started) and [current prerequisites](https://capacitorjs.com/docs/getting-started/environment-setup).
