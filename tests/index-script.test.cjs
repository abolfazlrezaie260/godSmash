const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('browser game inline script is syntactically valid and wired to projectile factory', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match, 'browser gameplay script must exist');
  assert.doesNotThrow(() => new vm.Script(match[1], {filename: 'index.html'}));
  assert.ok(html.includes('src="./src/render/projectile-models.js"'));
  assert.match(match[1], /projectileModels\.createMissile/);
  assert.match(match[1], /projectileModels\.createAsteroid/);
  assert.match(match[1], /m\.dispose\(\)/);
  assert.ok(html.includes('id="weapon-dock-items"'));
  assert.ok(html.includes('src="./src/ui/weapon-dock.js"'));
  assert.doesNotMatch(html, /id="weapon-select"/);
  assert.match(match[1], /GodSmashWeaponDock\.mount/);
  assert.match(match[1], /weaponDock\.setSelected/);
  assert.match(match[1], /weaponDock\.selectAt/);
  assert.ok(html.includes('src="./src/render/rocket-fx.js"'));
  assert.match(match[1], /GodSmashRocketFX\.createSystem/);
  assert.match(match[1], /rocketFx\.trail/);
  assert.match(match[1], /rocketFx\.burst/);
  assert.match(match[1], /createNightLightLayer/);
  assert.match(match[1], /hotIntensity/);
});
