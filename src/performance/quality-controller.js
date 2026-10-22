/* Device-sensitive resolution and particle budget control.
 * Uses real, unscaled frame time: 0.5x/2x gameplay must not affect FPS decisions.
 */
(function (root) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function createController(options = {}) {
    const devicePixelRatio = clamp(
      Number.isFinite(options.devicePixelRatio) ? options.devicePixelRatio : 1,
      0.5, 4
    );
    const maxRatio = Math.min(devicePixelRatio, options.lowQuality ? 1.25 : 2);
    const minRatio = Math.min(maxRatio, options.lowQuality ? 0.75 : 0.85);
    let pixelRatio = maxRatio;
    const maxParticles = Math.max(1, Math.floor(options.maxParticles || 220));
    const minParticles = Math.min(maxParticles, Math.max(1, Math.floor(maxParticles * 0.45)));
    let particleBudget = maxParticles;
    let elapsed = 0;
    let windowDuration = 0;
    let sampleFrames = 0;
    let lastChange = -Infinity;
    let lowWindows = 0;
    let highWindows = 0;
    let fps = 0;
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

    function recomputeBudget() {
      const fraction = maxRatio ? pixelRatio / maxRatio : 1;
      return clamp(
        Math.round(maxParticles * (0.45 + 0.55 * fraction * fraction)),
        minParticles,
        maxParticles
      );
    }

    function sample(realDeltaSeconds, visible = true) {
      if (!visible || !Number.isFinite(realDeltaSeconds) ||
          realDeltaSeconds <= 0 || realDeltaSeconds > 0.25) {
        return false;
      }
      elapsed += realDeltaSeconds;
      windowDuration += realDeltaSeconds;
      sampleFrames++;
      if (windowDuration < 2) return false;
      fps = sampleFrames / windowDuration;
      windowDuration = 0;
      sampleFrames = 0;
      if (fps < 43) {
        lowWindows++;
        highWindows = 0;
      } else if (fps > 56) {
        highWindows++;
        lowWindows = 0;
      } else {
        lowWindows = 0;
        highWindows = 0;
      }

      let target = pixelRatio;
      if (lowWindows >= 2 && elapsed - lastChange >= 6) {
        target = Math.max(minRatio, pixelRatio - 0.15);
      } else if (highWindows >= 3 && elapsed - lastChange >= 10) {
        target = Math.min(maxRatio, pixelRatio + 0.1);
      }

      target = Math.round(target * 100) / 100;
      if (target !== pixelRatio) {
        pixelRatio = target;
        particleBudget = recomputeBudget();
        lowWindows = 0;
        highWindows = 0;
        lastChange = elapsed;
        onChange({pixelRatio, particleBudget, fps});
        return true;
      }
      return false;
    }

    return Object.freeze({
      sample,
      getStats: () => Object.freeze({
        fps, pixelRatio, particleBudget, maxParticles,
        minPixelRatio: minRatio, maxPixelRatio: maxRatio
      })
    });
  }

  root.GodSmashPerformance = Object.freeze({createController});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashPerformance;
})(typeof window !== 'undefined' ? window : globalThis);
