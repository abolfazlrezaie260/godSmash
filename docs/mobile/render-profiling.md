# Native WebView rendering and recovery — #47

This change caps the initial native WebView device pixel ratio to **1.15** for the low-quality/mobile profile (which is selected in Capacitor) and preserves the adaptive controller's existing hysteresis. The 1.15 value is a **conservative initial policy**, not a measured optimal setting. Web browsers retain their existing caps (1.25 low / 2 normal). Particle budgets remain bounded, with the same adaptive reductions when sustained real frame time worsens.

## Context loss

The main 3D WebGL renderer now listens for `webglcontextlost` and `webglcontextrestored`. During loss, simulation frames are not advanced; recovery refreshes renderer size/pixel ratio and resets the animation wall-clock baseline. The Three.js renderer is still responsible for rebuilding its internal GPU resources.

Use `?perf=1` to inspect current pixel ratio, particle budget, draw calls, geometry/texture counts, and cumulative context-loss count. The overlay is not an estimate of total native GPU memory.

## Repeatable device protocol

1. Select an Android WebView and an iPhone WKWebView build from the **same git commit**. Record device model, OS, runtime, viewport and thermal state in [measurements.csv](measurements.csv).
2. Run 30 seconds idle on Earth; record FPS distribution with Android GPU/Chrome DevTools or Safari Web Inspector (the debug overlay alone cannot compute percentiles).
3. Follow the #14 stress pattern: 12 Viper, 6 Titan, 6 asteroid attacks over 60 seconds, plus one swarm and one harvester sequence. Observe pixel ratio and particle count.
4. Perform 3 planet resets, measuring draw calls, geometry/texture counts after every reset. Counts should stabilize, not grow continuously.
5. Suspend/resume the app five times and repeat with Airplane Mode; verify no crash and acceptable cold-start behavior.
6. In an instrumented development browser, test context loss with the `WEBGL_lose_context` extension if present, then call `restoreContext()`; ensure the next frame is rendered and the simulation does not fast-forward during loss.
7. Include battery/thermal notes after 10 minutes on each real device. Compare the before/after baselines and record the trace links in the issue.

## Completion gates

- [x] Native WebView DPR cap and automated controller tests
- [x] Frozen simulation while WebGL context is lost, recovery-aware render baseline
- [x] Exposed a loss counter in debug HUD
- [ ] **Measured** FPS/memory/thermal traces on Android and iPhone hardware
- [ ] Reset and context-loss recovery validated visually on real native devices
- [ ] Release thresholds grounded in results, not assumed targets

Do not close #47 until the final three gates are verified. This issue complements existing [general rendering optimization #14](https://github.com/abolfazlrezaie260/godSmash/issues/14); it is not a claim that all GPU/CPU pressure is resolved.
