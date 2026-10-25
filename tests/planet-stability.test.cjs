const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('weapon impacts keep the planet and orbit camera globally stable', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const match = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match, 'browser gameplay script must exist');
  const script = match[1];

  // A random camera offset makes the entire planet appear to jump on impact.
  assert.doesNotMatch(script, /screenShake/);
  assert.match(script, /camera\.position\.set\(cx, cy, cz\);\s*camera\.lookAt\(0, 0, 0\);/);
  assert.doesNotMatch(script, /camera\.position\.[xyz]\s*\+=\s*\(Math\.random\(\) - 0\.5\)/);

  const impactStart = script.indexOf('function triggerNuclearDetonation(');
  const impactEnd = script.indexOf('function triggerPlanetaryShatter(', impactStart);
  assert.ok(impactStart >= 0 && impactEnd > impactStart, 'impact handler must exist');
  const impact = script.slice(impactStart, impactEnd);
  assert.match(impact, /carveCraterOnEarth\(localTarget/);
  assert.match(impact, /blast\.group\.position\.copy\(localTarget\)/);
  assert.match(impact, /earthGroup\.add\(blast\.group\)/);
  assert.doesNotMatch(impact, /earthGroup\.(?:position|rotation)\.(?:set|add|copy|multiply)/);

  // The destruction path must not re-enable global camera movement either.
  const shatterStart = script.indexOf('function triggerPlanetaryShatter(');
  const shatterEnd = script.indexOf('function ', shatterStart + 10);
  assert.ok(shatterStart >= 0 && shatterEnd > shatterStart);
  assert.doesNotMatch(script.slice(shatterStart, shatterEnd), /screenShake/);
});
