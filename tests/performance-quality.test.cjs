const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/performance/quality-controller.js');

function feed(quality, fps, seconds) {
  const dt = 1 / fps;
  for (let i = 0; i < fps * seconds; i++) quality.sample(dt, true);
}

test('sustained low FPS lowers resolution and particle budget within configured limits', () => {
  const changes = [];
  const quality = controller.createController({
    devicePixelRatio: 2, maxParticles: 220,
    onChange: change => changes.push(change)
  });
  assert.equal(quality.getStats().pixelRatio, 2);
  feed(quality, 30, 24);
  const stats = quality.getStats();
  assert.ok(stats.pixelRatio < 2);
  assert.ok(stats.pixelRatio >= stats.minPixelRatio);
  assert.ok(stats.particleBudget < 220);
  assert.ok(stats.particleBudget > 0);
  assert.ok(changes.every(x => x.pixelRatio >= stats.minPixelRatio));
});

test('recovering FPS raises quality gradually rather than oscillating', () => {
  const quality = controller.createController({devicePixelRatio:2,maxParticles:92,lowQuality:true});
  feed(quality, 30, 25);
  const reduced = quality.getStats();
  assert.ok(reduced.pixelRatio < reduced.maxPixelRatio);
  feed(quality, 60, 50);
  const recovered = quality.getStats();
  assert.ok(recovered.pixelRatio > reduced.pixelRatio);
  assert.ok(recovered.pixelRatio <= recovered.maxPixelRatio);
  assert.ok(recovered.particleBudget <= 92);
});

test('pause / background events and invalid samples never change quality', () => {
  const quality = controller.createController({devicePixelRatio:1.5,maxParticles:100});
  const original = quality.getStats();
  for(let i=0;i<1000;i++) {
    quality.sample(1/20, false);
    quality.sample(0.5, true);
    quality.sample(NaN, true);
  }
  assert.deepEqual(quality.getStats(), original);
});

test('quality controller honors low pixel-ratio devices', () => {
  const quality = controller.createController({devicePixelRatio:1,maxParticles:24,lowQuality:true});
  assert.equal(quality.getStats().maxPixelRatio,1);
  feed(quality, 20, 75);
  assert.ok(quality.getStats().pixelRatio >= 0.75);
  assert.ok(quality.getStats().particleBudget <= 24);
});
