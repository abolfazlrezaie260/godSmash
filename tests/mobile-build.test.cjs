'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildWeb, verifyWeb, localUrlPath, localizeEntrypoint } = require('../scripts/build-web.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godsmash-web-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const folder of ['src', 'assets/data', 'assets/textures']) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'index.html'),
    '<!doctype html><html><head><link rel="manifest" href="./manifest.webmanifest"><script src="./src/app.js"></script></head><body><img src="./assets/textures/earth.jpg"></body></html>');
  fs.writeFileSync(path.join(root, 'manifest.webmanifest'), '{"name":"GodSmash"}');
  fs.writeFileSync(path.join(root, 'src/app.js'), 'console.log("game");');
  fs.writeFileSync(path.join(root, 'assets/textures/earth.jpg'), 'fake-asset');
  fs.writeFileSync(path.join(root, 'assets/data/countries.json'), '{}');
  fs.writeFileSync(path.join(root, 'test.txt'), 'should not be bundled');
  return root;
}

test('build copies only runtime payload, preserving paths', t => {
  const root = fixture(t);
  const result = buildWeb(root, { skipOfflineRuntime: true });
  assert.equal(result.checkedLocalReferences, 3);
  assert.equal(fs.readFileSync(path.join(root, 'dist/src/app.js'), 'utf8'), 'console.log("game");');
  assert.equal(fs.readFileSync(path.join(root, 'dist/assets/data/countries.json'), 'utf8'), '{}');
  assert.equal(fs.existsSync(path.join(root, 'dist/test.txt')), false);
  assert.equal(verifyWeb(path.join(root, 'dist')).checkedLocalReferences, 3);
});

test('rebuild removes stale outputs without changing source', t => {
  const root = fixture(t);
  buildWeb(root, { skipOfflineRuntime: true });
  fs.writeFileSync(path.join(root, 'dist/obsolete.js'), 'stale');
  buildWeb(root, { skipOfflineRuntime: true });
  assert.equal(fs.existsSync(path.join(root, 'dist/obsolete.js')), false);
  assert.equal(fs.readFileSync(path.join(root, 'src/app.js'), 'utf8'), 'console.log("game");');
});

test('a missing referenced asset fails safely and keeps old dist', t => {
  const root = fixture(t);
  buildWeb(root, { skipOfflineRuntime: true });
  fs.rmSync(path.join(root, 'src/app.js'));
  assert.throws(() => buildWeb(root, { skipOfflineRuntime: true }), /Missing local resource: \.\/src\/app\.js/);
  assert.equal(fs.existsSync(path.join(root, 'dist/src/app.js')), true);
  const staging = fs.readdirSync(root).filter(name => name.startsWith('.godsmash-dist-stage-'));
  assert.deepEqual(staging, []);
});

test('local references exclude network, anchors and reject path traversal', () => {
  assert.equal(localUrlPath('https://example.test/script.js'), null);
  assert.equal(localUrlPath('#section'), null);
  assert.equal(localUrlPath('./src/game.js?version=1'), 'src/game.js');
  assert.equal(localUrlPath('assets/my%20file.png'), 'assets/my file.png');
});

test('offline source rewrite replaces CDN dependencies without changing other tags', () => {
  const sample = [
    '<script src="https://cdn.tailwindcss.com/3.4.17"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />'
  ].join('\n');
  const html = localizeEntrypoint(sample);
  assert.match(html, /vendor\/tailwind\.css/);
  assert.match(html, /vendor\/three\.min\.js/);
  assert.match(html, /vendor\/fonts\.css/);
  assert.doesNotMatch(html, /https:\/\//);
  assert.throws(() => localizeEntrypoint('<html/>'), /Required CDN tag missing/);
});

test('verify rejects remote runtime links when offline mode is enforced', t => {
  const root = fixture(t);
  buildWeb(root, { skipOfflineRuntime: true });
  const vendor = path.join(root, 'dist/vendor');
  fs.mkdirSync(vendor, { recursive: true });
  for (const file of ['three.min.js', 'tailwind.css', 'fonts.css']) {
    fs.writeFileSync(path.join(vendor, file), 'test');
  }
  const entry = path.join(root, 'dist/index.html');
  fs.appendFileSync(entry, '<script src="https://example.test/runtime.js"></script>');
  assert.throws(() => verifyWeb(path.join(root, 'dist'), { offline: true }), /remote executable/);
});
