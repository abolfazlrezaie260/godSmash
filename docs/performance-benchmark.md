# Performance benchmark protocol (Issue #14)

This is a **measurement procedure**, not a claim of verified frame rates. The controls use `?perf=1` to show live frame rate, device-pixel ratio, WebGL draw calls, geometry/texture counts, sprite pool occupancy and active effect budgets. `performance.memory` is not exposed by every browser, so JavaScript heap may show **N/A**. The WebGL resource counters are not total GPU memory in megabytes.

## Test equipment and repeatability

Record the following **for both** a desktop Mac browser and a mid-range Android phone running Chrome:

| Field | Desktop Mac | Android mid-range |
| --- | --- | --- |
| Exact device / CPU / GPU | Not measured | Not measured |
| Browser version | Not measured | Not measured |
| OS version | Not measured | Not measured |
| Screen and browser viewport (CSS px) | Not measured | Not measured |
| Physical device-pixel ratio | Not measured | Not measured |
| Initial render pixel ratio | Not measured | Not measured |
| Median FPS, idle / stress / post-reset | Not measured | Not measured |
| Worst observed FPS and time to recover | Not measured | Not measured |
| Peak geometries / textures / draw calls | Not measured | Not measured |
| JS heap MB (when supported) | Not measured | Not measured |
| Android battery / thermal notes | N/A | Not measured |

Do not fill in numbers from estimates or automated Node tests. Keep the browser zoom and viewport constant between runs.

## Procedure

1. Open `https://abolfazlrezaie260.github.io/godSmash/?perf=1` after its latest deployment has completed; use a private browser window or hard-refresh to avoid stale JavaScript. Enable the browser's FPS monitor/Performance panel if available.
2. Select Earth, disable automatic rotation and set simulation speed to **1×**. Leave the game idle for **30 seconds** and record the overlay metrics after warmup.
3. With the same viewport and 1× speed, launch **12 Viper missiles**, **6 Titan missiles** and **6 asteroids**. Avoid exceeding the live-missile limit; allow several simultaneous hits. Record minimum/median FPS, pixel-ratio changes, memory/geometries and draw calls during this stress phase for **60 seconds**.
4. Reset the planet **three times**, allowing **30 seconds** of idle time between resets. Record the geometry and texture counts after each reset. They should settle near a stable baseline rather than increasing on every reset. Reused sprite materials may remain allocated up to their budget; this is intentional until page unload.
5. Repeat steps 2–4 at **0.5× and 2× simulation speed**. The measured FPS, rather than simulated game time, must drive automatic render-quality adjustment.
6. On Android, repeat once in portrait and landscape. Record whether the browser tab is suspended, device overheats, or touch controls overlap the game view.
7. Capture the Chrome Performance trace or equivalent for each device, using a consistent viewport. Link the recordings to [Issue #14](https://github.com/abolfazlrezaie260/godSmash/issues/14).

## Acceptance for closing the issue

- Particle count, live missile count, debris and blast count never exceed their quality-specific caps.
- Render pixel ratio drops only after sustained low FPS and recovers gradually on sustained improvement; it stays within device-safe bounds.
- Resource counts stabilize after repeated resets (no monotonic growth across three cycles), with pooled materials freed only at final engine disposal.
- **Measured** FPS and resource numbers from the Mac and Android benchmark above are attached to the GitHub issue.
- Regressions or crashes uncovered by the actual-device run are fixed before marking Issue #14 complete.

The automatic tests in `tests/performance-quality.test.cjs` and `tests/rocket-fx.test.cjs` verify budget behavior, hysteresis and disposal safety. They do **not** measure WebGL frame time or GPU memory on real devices.
