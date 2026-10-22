/* Lightweight, deterministic game-space flight model for projectiles.
 * This is a gameplay model, not a real propulsion or orbital-mechanics solver.
 */
(function (root) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const positive = (value, fallback) =>
    Number.isFinite(value) && value >= 0 ? value : fallback;

  function createFlight(weapon) {
    if (!weapon || !Number.isFinite(weapon.speed) || weapon.speed <= 0 ||
        weapon.kind === 'beam') {
      throw new TypeError('Projectile flight requires a positive-speed missile or asteroid');
    }
    const asteroid = weapon.kind === 'asteroid';
    const baseSpeed = weapon.speed;
    const launchSpeed = positive(weapon.launchSpeed,
      asteroid ? baseSpeed : Math.max(0.08, baseSpeed * 0.24));
    const acceleration = positive(weapon.acceleration,
      asteroid ? 0 : baseSpeed * 1.35);
    const maxSpeed = Math.max(launchSpeed, positive(weapon.maxSpeed,
      asteroid ? baseSpeed : baseSpeed * 1.65));
    const fuelDuration = asteroid ? 0 : positive(weapon.fuelDuration, 0.68);
    return {
      baseSpeed,
      velocity: launchSpeed,
      launchSpeed,
      acceleration,
      maxSpeed,
      cruiseSpeed: asteroid ? baseSpeed * 0.82 : baseSpeed * 0.70,
      drag: positive(weapon.drag, asteroid ? 0.008 : 0.035),
      fuelDuration,
      fuelRemaining: fuelDuration,
      fuelRatio: fuelDuration > 0 ? 1 : 0,
      elapsed: 0,
      progress: 0,
      finished: false
    };
  }

  function stepFlight(flight, deltaSeconds) {
    if (!flight || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new TypeError('Flight step requires a flight state and non-negative delta time');
    }
    if (flight.finished || deltaSeconds === 0) {
      return Object.freeze({
        progress: flight.progress, progressDelta: 0, speed: flight.velocity,
        fuelRatio: flight.fuelRatio, powered: flight.fuelRemaining > 0,
        finished: flight.finished
      });
    }

    // Small fixed integration steps reduce differences between 30/60/120 FPS.
    let remaining = Math.min(1, deltaSeconds);
    let progressDelta = 0;
    while (remaining > 1e-8) {
      const step = Math.min(remaining, 1 / 120);
      const poweredStep = Math.min(step, flight.fuelRemaining);
      if (poweredStep > 0) {
        const nextVelocity = Math.min(
          flight.maxSpeed, flight.velocity + flight.acceleration * poweredStep
        );
        progressDelta += (flight.velocity + nextVelocity) * 0.5 * poweredStep;
        flight.velocity = nextVelocity;
        flight.fuelRemaining = Math.max(0, flight.fuelRemaining - poweredStep);
        flight.elapsed += poweredStep;
        remaining -= poweredStep;
        if (step > poweredStep) {
          const coastStep = step - poweredStep;
          const coastVelocity = Math.max(
            flight.cruiseSpeed, flight.velocity - flight.drag * coastStep
          );
          progressDelta += (flight.velocity + coastVelocity) * 0.5 * coastStep;
          flight.velocity = coastVelocity;
          flight.elapsed += coastStep;
          remaining -= coastStep;
        }
      } else {
        const nextVelocity = Math.max(
          flight.cruiseSpeed, flight.velocity - flight.drag * step
        );
        progressDelta += (flight.velocity + nextVelocity) * 0.5 * step;
        flight.velocity = nextVelocity;
        flight.elapsed += step;
        remaining -= step;
      }
    }

    flight.progress = Math.min(1, flight.progress + progressDelta);
    flight.fuelRatio = flight.fuelDuration > 0
      ? clamp(flight.fuelRemaining / flight.fuelDuration, 0, 1) : 0;
    flight.finished = flight.progress >= 1;
    return Object.freeze({
      progress: flight.progress,
      progressDelta,
      speed: flight.velocity,
      fuelRatio: flight.fuelRatio,
      powered: flight.fuelRemaining > 0,
      finished: flight.finished
    });
  }

  root.GodSmashMissilePhysics = Object.freeze({createFlight, stepFlight});
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.GodSmashMissilePhysics;
  }
})(typeof window !== 'undefined' ? window : globalThis);
