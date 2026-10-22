const test = require('node:test');
const assert = require('node:assert/strict');
const physics = require('../src/simulation/missile-physics.js');

const titan = {
  id: 'titan', kind: 'missile', speed: 0.72, launchSpeed: 0.15,
  acceleration: 0.82, maxSpeed: 1.25, fuelDuration: 0.78, drag: 0.03
};
const viper = {
  id: 'viper', kind: 'missile', speed: 1.75, launchSpeed: 0.5,
  acceleration: 2.5, maxSpeed: 3.0, fuelDuration: 0.45, drag: 0.12
};

test('powered flight accelerates and consumes fuel progressively', () => {
  const flight = physics.createFlight(titan);
  assert.equal(flight.progress, 0);
  assert.equal(flight.fuelRatio, 1);
  const initialSpeed = flight.velocity;
  const first = physics.stepFlight(flight, 0.2);
  assert.ok(first.speed > initialSpeed);
  assert.ok(first.progress > 0);
  assert.ok(first.fuelRatio < 1 && first.fuelRatio > 0);
  physics.stepFlight(flight, 1);
  assert.equal(flight.fuelRatio, 0);
  assert.ok(flight.progress > first.progress);
});

test('hypersonic profile travels faster than heavy siege over equal simulated time', () => {
  const heavy = physics.createFlight(titan);
  const fast = physics.createFlight(viper);
  for (let i = 0; i < 30; i++) {
    physics.stepFlight(heavy, 1 / 60);
    physics.stepFlight(fast, 1 / 60);
  }
  assert.ok(fast.progress > heavy.progress * 1.6);
  assert.ok(fast.velocity > heavy.velocity);
});

test('fixed substeps keep progress consistent across 30 and 60 FPS', () => {
  function simulate(frameDt) {
    const flight = physics.createFlight(viper);
    for (let i = 0; i < 120 && !flight.finished; i++) {
      physics.stepFlight(flight, frameDt);
    }
    return flight;
  }
  const at30 = simulate(1 / 30);
  const at60 = simulate(1 / 60);
  assert.ok(Math.abs(at30.elapsed - at60.elapsed) < 0.035);
  assert.ok(Math.abs(at30.velocity - at60.velocity) < 0.04);
  assert.equal(at30.finished, true);
  assert.equal(at60.finished, true);
});

test('asteroids are ballistic and do not burn rocket fuel', () => {
  const flight = physics.createFlight({kind:'asteroid',speed:0.65});
  assert.equal(flight.fuelDuration, 0);
  assert.equal(flight.fuelRatio, 0);
  const next = physics.stepFlight(flight, 0.25);
  assert.equal(next.powered, false);
  assert.ok(next.progress > 0);
});

test('invalid flight state and negative delta time are rejected', () => {
  assert.throws(() => physics.createFlight({kind:'beam',speed:0}), /positive-speed/);
  assert.throws(() => physics.stepFlight(physics.createFlight(titan), -0.1), /non-negative/);
});
