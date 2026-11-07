'use strict';

// Zero-dependency staging build for the current static GodSmash app.
// #43 will replace external runtime CDN assets with local pinned dependencies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PAYLOAD = Object.freeze(['index.html', 'manifest.webmanifest', 'src', 'assets']);
const REQUIRED_OFFLINE_ASSETS = Object.freeze([
  'assets/data/countries-110m.json',
  'assets/textures/earth/earth_atmos_4096.jpg',
  'assets/textures/earth/earth_clouds_1024.png',
  'assets/textures/earth/earth_lights_2048.png',
  'assets/textures/earth/earth_normal_2048.jpg',
  'assets/textures/earth/earth_specular_2048.jpg',
  'assets/textures/moon/moon_4096.jpg',
  'assets/textures/moon/moon_height_1024.jpg'
]);

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

function assetHash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Deterministic inventory allows the native build to fail on a missing or
// truncated large texture before it ships. No timestamps or absolute paths.
function writeAssetManifest(webDir) {
  const root = path.resolve(webDir);
  const assets = path.join(root, 'assets');
  if (!fs.existsSync(assets)) throw new Error('Missing assets directory');
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        files.push({path:relative,bytes:fs.statSync(file).size,sha256:assetHash(file)});
      }
    }
  }
  visit(assets);
  files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const manifest = {
    schemaVersion:1,
    totalBytes:files.reduce((sum,file)=>sum+file.bytes,0),
    files
  };
  fs.writeFileSync(path.join(root,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
function verifyAssetManifest(webDir) {
  const root = path.resolve(webDir);
  const file = path.join(root,'asset-manifest.json');
  if (!existsFile(file)) throw new Error('Offline asset manifest is missing');
  const manifest = JSON.parse(fs.readFileSync(file,'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('Invalid offline asset manifest schema');
  }
  const provided = new Set();
  let counted = 0;
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || !entry.path.startsWith('assets/') ||
        entry.path.includes('\\') || !Number.isSafeInteger(entry.bytes) ||
        entry.bytes < 1 || typeof entry.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('Invalid asset manifest entry');
    }
    const target = path.resolve(root,entry.path);
    if (!target.startsWith(path.join(root,'assets')+path.sep) ||
        !existsFile(target)) throw new Error('Offline asset missing: ' + entry.path);
    if (fs.statSync(target).size !== entry.bytes || assetHash(target) !== entry.sha256) {
      throw new Error('Offline asset checksum mismatch: ' + entry.path);
    }
    if (provided.has(entry.path)) throw new Error('Duplicate asset: ' + entry.path);
    provided.add(entry.path);
    counted += entry.bytes;
  }
  for (const required of REQUIRED_OFFLINE_ASSETS) {
    if (!provided.has(required)) throw new Error('Required offline asset missing: ' + required);
  }
  if (counted !== manifest.totalBytes) throw new Error('Offline asset byte total mismatch');
  return { count:provided.size,totalBytes:counted };
}

function verifyWeb(webDir, options = {}) {
  const root = path.resolve(webDir);
  for (const item of PAYLOAD) {
    if (!fs.existsSync(path.join(root, item))) {
      throw new Error('Missing built asset: ' + item);
    }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (options.offline) {
    if (/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(html)) {
      throw new Error('Offline build still contains a remote executable or stylesheet');
    }
    verifyAssetManifest(root);
    for (const name of ['vendor/three.min.js', 'vendor/tailwind.css', 'vendor/fonts.css']) {
      if (!existsFile(path.join(root, name))) throw new Error('Offline vendor asset missing: ' + name);
    }
    const fontsCss = fs.readFileSync(path.join(root,'vendor/fonts.css'),'utf8');
    let fontCount = 0;
    const fontSources = /url\(["']?\.\/fonts\/([^"')]+)["']?\)/g;
    for (const found of fontsCss.matchAll(fontSources)) {
      const file = path.resolve(root,'vendor','fonts',found[1]);
      if (!file.startsWith(path.join(root,'vendor','fonts') + path.sep) ||
          !existsFile(file) || fs.statSync(file).size < 1) {
        throw new Error('Required local font missing: ' + found[1]);
      }
      fontCount++;
    }
    if (fontCount < 2) throw new Error('Offline font CSS missing local font declarations');
  }
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

// Rewrites the native web build only. The source index.html / GitHub Pages
// entrypoint stays unchanged until the web deployment migrates separately.
function localizeEntrypoint(html) {
  const replacements = [
    [/<script\s+src=["']https:\/\/cdn\.tailwindcss\.com\/3\.4\.17["']><\/script>/,
      '<link rel="stylesheet" href="./vendor/tailwind.css">'],
    [/<script\s+src=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js["']><\/script>/,
      '<script src="./vendor/three.min.js"></script>'],
    [/<link\s+href=["']https:\/\/fonts\.googleapis\.com\/css2[^"']*["']\s+rel=["']stylesheet["']\s*\/?>/,
      '<link rel="stylesheet" href="./vendor/fonts.css">']
  ];
  let result = html;
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(result)) throw new Error('Required CDN tag missing or changed: ' + pattern.source);
    result = result.replace(pattern, replacement);
  }
  result = result
    .replace(/\s*<link\s+rel=["']preconnect["']\s+href=["']https:\/\/fonts\.googleapis\.com["']\s*\/?>/g, '')
    .replace(/\s*<link\s+rel=["']preconnect["']\s+href=["']https:\/\/fonts\.gstatic\.com["'][^>]*>/g, '');
  return result;
}

function copyFontFamilies(projectRoot, staging) {
  const vendor = path.join(staging, 'vendor');
  const fontsOut = path.join(vendor, 'fonts');
  fs.mkdirSync(fontsOut, { recursive: true });
  const css = [];
  const families = [
    { packageName:'vazirmatn', family:'Vazirmatn', subset:'arabic', weights:[400,500,700,800] },
    { packageName:'inter', family:'Inter', subset:'latin', weights:[400,600,700,800] }
  ];
  for (const item of families) {
    const pkg = path.join(projectRoot, 'node_modules', '@fontsource', item.packageName);
    const available = path.join(pkg, 'files');
    if (!fs.existsSync(available)) throw new Error('Missing font dependency: @fontsource/' + item.packageName);
    for (const weight of item.weights) {
      const name = item.packageName + '-' + item.subset + '-' + weight + '-normal.woff2';
      const source = path.join(available, name);
      if (!existsFile(source)) throw new Error('Missing required font: ' + name);
      fs.copyFileSync(source, path.join(fontsOut, name));
      css.push(
        '@font-face{font-family:"' + item.family +
        '";font-style:normal;font-weight:' + weight +
        ';font-display:swap;src:url("./fonts/' + name + '") format("woff2");}'
      );
    }
    copyLicense(pkg, path.join(vendor, 'licenses'), item.packageName);
  }
  fs.writeFileSync(path.join(vendor, 'fonts.css'), css.join('\n') + '\n');
}

function copyLicense(packageDir, destination, name) {
  const license = ['OFL.txt', 'LICENSE', 'LICENSE.md', 'LICENSE.txt']
    .map(file => path.join(packageDir, file))
    .find(existsFile);
  if (!license) return;
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(license, path.join(destination, name + '.txt'));
}

function packageOfflineRuntime(root, staging) {
  const vendor = path.join(staging, 'vendor');
  fs.mkdirSync(vendor, { recursive: true });
  const threePkg = path.join(root, 'node_modules', 'three');
  const threeSource = path.join(threePkg, 'build', 'three.min.js');
  if (!existsFile(threeSource)) {
    throw new Error('Missing pinned Three.js build. Run npm ci first.');
  }
  fs.copyFileSync(threeSource, path.join(vendor, 'three.min.js'));
  copyLicense(threePkg, path.join(vendor, 'licenses'), 'three');
  const tailwindPkg = path.join(root, 'node_modules', 'tailwindcss');
  const tailwindCli = path.join(tailwindPkg, 'lib', 'cli.js');
  if (!existsFile(tailwindCli)) throw new Error('Missing Tailwind CSS CLI. Run npm ci first.');
  copyLicense(tailwindPkg, path.join(vendor, 'licenses'), 'tailwindcss');
  execFileSync(process.execPath, [
    tailwindCli,
    '-c', path.join(root, 'tailwind.config.cjs'),
    '-i', path.join(root, 'src/mobile/tailwind.css'),
    '-o', path.join(vendor, 'tailwind.css'),
    '--minify'
  ], { cwd: root, stdio: 'pipe', timeout: 120000 });
  if (!existsFile(path.join(vendor, 'tailwind.css'))) throw new Error('Tailwind output missing');
  copyFontFamilies(root, staging);
  const htmlFile = path.join(staging, 'index.html');
  fs.writeFileSync(htmlFile, localizeEntrypoint(fs.readFileSync(htmlFile, 'utf8')));
  writeAssetManifest(staging);
}

function buildWeb(projectRoot, options = {}) {
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
    if (!options.skipOfflineRuntime) packageOfflineRuntime(root, staging);
    const verified = verifyWeb(staging, { offline: !options.skipOfflineRuntime });
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
      const result = verifyWeb(path.join(root, 'dist'), { offline: true });
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

module.exports = { buildWeb, verifyWeb, localUrlPath, localizeEntrypoint,
  writeAssetManifest, verifyAssetManifest, REQUIRED_OFFLINE_ASSETS };
