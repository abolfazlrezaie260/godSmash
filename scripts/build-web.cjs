'use strict';

// Zero-dependency staging build for the current static GodSmash app.
// #43 will replace external runtime CDN assets with local pinned dependencies.
const fs = require('node:fs');
const path = require('node:path');

const PAYLOAD = Object.freeze(['index.html', 'manifest.webmanifest', 'src', 'assets']);

function existsFile(target) {
  try { return fs.statSync(target).isFile(); }
  catch { return false; }
}

function localUrlPath(reference) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  const value = reference.split(/[?#]/, 1)[0];
  if (!value || value.startsWith('/')) return null; // not a bundle-local path
  try {
    return decodeURIComponent(value.replace(/^\.\//, ''));
  } catch {
    throw new Error('Invalid percent encoding in asset URL: ' + reference);
  }
}

function verifyWeb(webDir) {
  const root = path.resolve(webDir);
  for (const item of PAYLOAD) {
    if (!fs.existsSync(path.join(root, item))) {
      throw new Error('Missing built asset: ' + item);
    }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!/<head[\s>]/i.test(html) || !/<\/head>/i.test(html)) {
    throw new Error('Built index.html must include a <head> for Capacitor');
  }
  // All local entrypoint refs, including any new stylesheet/script tags,
  // must resolve inside webDir. Dynamic texture URLs are carried by src/assets.
  const tags = /<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let checked = 0;
  for (const match of html.matchAll(tags)) {
    const relative = localUrlPath(match[1]);
    if (!relative) continue;
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) {
      throw new Error('Asset escapes web directory: ' + match[1]);
    }
    if (!existsFile(target)) {
      throw new Error('Missing local resource: ' + match[1]);
    }
    checked++;
  }
  return { webDir: root, checkedLocalReferences: checked };
}

function buildWeb(projectRoot) {
  const root = path.resolve(projectRoot);
  for (const name of PAYLOAD) {
    if (!fs.existsSync(path.join(root, name))) throw new Error('Missing source: ' + name);
  }
  const out = path.join(root, 'dist');
  // Stage in the same filesystem; an invalid build cannot destroy an
  // existing valid dist output. Remove the staging folder on any failure.
  const staging = fs.mkdtempSync(path.join(root, '.godsmash-dist-stage-'));
  try {
    for (const name of PAYLOAD) {
      const src = path.join(root, name);
      fs.cpSync(src, path.join(staging, name), {
        recursive: fs.statSync(src).isDirectory(),
        force: true
      });
    }
    const verified = verifyWeb(staging);
    fs.rmSync(out, { recursive: true, force: true });
    fs.renameSync(staging, out);
    return { ...verified, webDir: out };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  try {
    if (!args.length) {
      const result = buildWeb(root);
      console.log('GodSmash web build ready: ' + result.webDir);
      console.log('Checked ' + result.checkedLocalReferences + ' local entrypoint references.');
    } else if (args.length === 1 && args[0] === '--verify') {
      const result = verifyWeb(path.join(root, 'dist'));
      console.log('Verified ' + result.checkedLocalReferences + ' local references in dist/.');
    } else if (args.length === 1 && args[0] === '--clean') {
      fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
      console.log('Removed dist/.');
    } else {
      throw new Error('Usage: node scripts/build-web.cjs [--verify|--clean]');
    }
  } catch (error) {
    console.error('GodSmash web build failed: ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildWeb, verifyWeb, localUrlPath };
