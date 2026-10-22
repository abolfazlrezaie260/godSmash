const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');

const root = path.join(__dirname, '..');
const assets = {
  'earth_atmos_4096.jpg': ['56df0a84d9316546c45b16e5083ac94161f31bff', 713367],
  'earth_clouds_1024.png': ['5c6b17b74ce05f1c589d60a92a9d66635a5e4990', 260222],
  'earth_lights_2048.png': ['8c470501ad9999888fff0bbaf774b2edf2715d82', 734910],
  'earth_normal_2048.jpg': ['5bf40df630d9ae7cb8ae026c930b8f3421bbec54', 336774],
  'earth_specular_2048.jpg': ['06e03a3bfc7fe64f711175fe2c66bfb76b61cd0d', 223421]
};

test('all five local photographic Earth maps are committed and verified', () => {
  for (const [filename, [expectedBlobSha, expectedLength]] of Object.entries(assets)) {
    const file = path.join(root, 'assets', 'textures', 'earth', filename);
    assert.ok(fs.existsSync(file), 'missing photographic asset: ' + filename);
    const content = fs.readFileSync(file);
    assert.equal(content.length, expectedLength, filename + ' size');
    const actualBlob = execFileSync('git', ['hash-object', file], {encoding:'utf8'}).trim();
    assert.equal(actualBlob, expectedBlobSha, filename + ' git blob hash');
    if (filename.endsWith('.jpg')) {
      assert.equal(content.subarray(0, 3).toString('hex'), 'ffd8ff');
    } else {
      assert.equal(content.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
  }
});

test('renderer uses local GitHub Pages assets and waits for Earth to load', () => {
  const code = fs.readFileSync(path.join(root,'src/render/real-earth.js'),'utf8');
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(code.includes("const BASE = './assets/textures/earth/';"));
  assert.ok(!code.includes('cdn.jsdelivr.net'), 'no external texture CDN');
  assert.ok(!html.includes('paintPristineEarthTextures'), 'old map painter removed');
  assert.ok(html.includes('id="earth-loading"'));
  assert.ok(html.includes('GodSmashRealEarth.preload().then(startGameWithRealEarth)'));
  assert.ok(html.includes('requestAnimationFrame(animate)'));
  assert.ok(html.includes('createNightLightLayer(THREE)'));
  assert.ok(html.includes('Earth city lights (night side only)'));
  assert.ok(html.includes('nightMesh.visible = p.id === "earth"'));
});

test('missing local image rejects preload; retry recovers', async () => {
  const code = fs.readFileSync(path.join(root,'src/render/real-earth.js'),'utf8');
  const context = {module:{exports:{}}, Image:null};
  let broken = true;
  context.Image = class {
    set src(value) {
      queueMicrotask(() => {
        if (broken && value.includes('earth_clouds_1024.png')) this.onerror();
        else this.onload();
      });
    }
  };
  vm.runInNewContext(code,context);
  await assert.rejects(context.module.exports.preload(), /earth_clouds_1024.png/);
  assert.equal(context.module.exports.isReady(),false);
  broken = false;
  await context.module.exports.preload();
  assert.equal(context.module.exports.isReady(),true);
});

test('city lights use a sun-masked shader and are separated from crater emissive paint', async () => {
  const realEarth = require('../src/render/real-earth.js');
  const originalImage = global.Image;
  global.Image = class {
    set src(value) { this.source=value; queueMicrotask(() => this.onload()); }
  };
  class Vector3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
    normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}
  }
  class Texture {
    constructor(image){this.image=image;this.disposed=0;}
    dispose(){this.disposed++;}
  }
  class ShaderMaterial {
    constructor(config){Object.assign(this,config);this.disposed=0;}
    dispose(){this.disposed++;}
  }
  try {
    await realEarth.preload();
    const layer=realEarth.createNightLightLayer({
      Texture, ShaderMaterial, Vector3, sRGBEncoding:3001, AdditiveBlending:2
    });
    assert.ok(layer.material.fragmentShader.includes('nightSide'));
    assert.ok(layer.material.fragmentShader.includes('uSunDirectionWorld'));
    assert.ok(layer.material.fragmentShader.includes('cityMask'));
    const direction=new Vector3(45,22,35);
    layer.updateSunDirection(direction);
    assert.ok(Math.abs(Math.hypot(
      layer.material.uniforms.uSunDirectionWorld.value.x,
      layer.material.uniforms.uSunDirectionWorld.value.y,
      layer.material.uniforms.uSunDirectionWorld.value.z
    )-1)<1e-9);
    const texture=layer.material.uniforms.uNightMap.value;
    layer.dispose();
    assert.equal(layer.material.disposed,1);
    assert.equal(texture.disposed,1);
  } finally { global.Image=originalImage; }
});
