'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = require('../capacitor.config.json');
const json = require('../package.json');

test('Capacitor config points at the verified web build', () => {
  assert.equal(config.webDir, 'dist');
  assert.equal(config.appName, 'GodSmash');
  assert.match(config.appId, /^io\.github\.abolfazlrezaie260\.godsmash$/);
  assert.equal(json.dependencies['@capacitor/core'], '8.6.0');
  assert.equal(json.dependencies['@capacitor/android'], '8.6.0');
  assert.equal(json.dependencies['@capacitor/ios'], '8.6.0');
  assert.equal(json.devDependencies['@capacitor/cli'], '8.6.0');
  assert.match(json.scripts['mobile:sync'], /cap sync/);
});

test('generated Android/iOS projects use the same unique application ID', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.match(android, /applicationId "io\.github\.abolfazlrezaie260\.godsmash"/);
  assert.match(ios, /PRODUCT_BUNDLE_IDENTIFIER = io\.github\.abolfazlrezaie260\.godsmash;/);
  assert.equal(fs.existsSync(path.join(root, 'android/gradlew')), true);
  assert.equal(fs.existsSync(path.join(root, 'ios/App/App/Info.plist')), true);
});

test('no signing or generated web assets are checked into the native project', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  for (const rule of ['android/local.properties', 'android/app/src/main/assets/public/', 'ios/App/App/public/', '*.keystore', '*.p12']) {
    assert.ok(ignore.includes(rule), 'missing ignore rule ' + rule);
  }
});
