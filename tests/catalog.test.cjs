/* Run: node --test tests/catalog.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../src/content/catalog.js');
const textures = require('../src/render/planet-textures.js');

test('default planets and weapons are accessible', () => {
  assert.deepEqual(catalog.listPlanets().map(x => x.id), ['earth', 'mars', 'venus', 'moon']);
  assert.deepEqual(catalog.listWeapons().map(x => x.id), ['icbm', 'asteroid', 'laser']);
});
test('unique IDs and required configuration are enforced', () => {
  assert.throws(() => catalog.registerPlanet({...catalog.getPlanet('earth')}), /unique/i);
  assert.throws(() => catalog.registerWeapon({...catalog.getWeapon('icbm')}), /unique/i);
  assert.throws(() => catalog.registerWeapon({id: 'bad', nameFa: 'Bad', kind: 'missile'}), /finite/);
});
test('new content can be registered independently', () => {
  catalog.registerPlanet({
    id:'test-world',nameFa:'آزمایشی',nameEn:'TEST',surface:'rocky',
    population:0, rotationSpeed:0, resistance:1,cloudOpacity:0,
    palette:['#111111','#222222','#333333']
  });
  catalog.registerWeapon({
    id:'test-weapon',nameFa:'آزمایشی',kind:'asteroid',blastRadius:2,
    damage:2,damageVariance:0,casualties:0,casualtiesVariance:0,
    speed:1,shake:0,debrisCount:0
  });
  assert.equal(catalog.getPlanet('test-world').surface, 'rocky');
  assert.equal(catalog.getWeapon('test-weapon').blastRadius, 2);
});
test('procedural texture painter supports offscreen or mocked contexts', () => {
  const calls = [];
  const ctx = {
    createLinearGradient:()=>({addColorStop(){}}),fillRect(){calls.push('fill')},
    beginPath(){},ellipse(){},fill(){},stroke(){},set fillStyle(x){},
    set globalAlpha(x){},set strokeStyle(x){},set lineWidth(x){}
  };
  textures.paint(catalog.getPlanet('mars'),ctx,ctx,128,64);
  textures.paint(catalog.getPlanet('venus'),ctx,ctx,128,64);
  assert.ok(calls.length > 0);
});
