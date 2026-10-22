const test = require('node:test');
const assert = require('node:assert/strict');
const earth = require('../src/render/real-earth.js');

test('real Earth preserves procedural fallback until imagery arrives', () => {
  assert.equal(earth.isReady(), false);
  assert.equal(earth.paint({}, {}, 512, 256), false);
  assert.equal(earth.files.day, 'earth_atmos_4096.jpg');
  assert.equal(earth.files.clouds, 'earth_clouds_1024.png');
});

test('loader paints real images and wires optional normal, roughness and cloud maps', async () => {
  const oldImage = global.Image;
  global.Image = class {
    set src(url) {
      this.srcUrl = url;
      queueMicrotask(() => this.onload());
    }
  };
  try {
    const pictures = await earth.preload();
    assert.ok(pictures.day.srcUrl.includes('earth_atmos_4096.jpg'));
    assert.ok(earth.isReady());

    const drawn = [];
    const ctx = {
      clearRect() { drawn.push('clear'); },
      drawImage(image) { drawn.push(image.srcUrl); },
      fillRect() { drawn.push('black'); },
      set fillStyle(value) {}
    };
    assert.equal(earth.paint(ctx, ctx, 1024, 512), true);
    assert.ok(drawn.some(x => x.includes('earth_lights_2048.png')));

    const oldDocument = global.document;
    global.document = {
      createElement() {
        return {
          width: 0, height: 0,
          getContext() {
            return {
              drawImage() {},
              getImageData() { return {data: new Uint8ClampedArray(512 * 256 * 4)}; },
              putImageData() {}
            };
          }
        };
      }
    };
    try {
      const THREE = {
        Texture: class { constructor(image) { this.image = image; }},
        CanvasTexture: class {constructor(canvas) { this.image = canvas; }}
      };
      const material = {normalScale: {set(x,y) {this.x=x;this.y=y;}}};
      const cloudMaterial = {};
      const fallbackCloudMap = {};
      earth.configure(THREE, material, cloudMaterial, fallbackCloudMap, true);
      assert.ok(material.normalMap);
      assert.ok(material.roughnessMap);
      assert.ok(cloudMaterial.map);
      assert.notEqual(cloudMaterial.map, fallbackCloudMap);

      earth.configure(THREE, material, cloudMaterial, fallbackCloudMap, false);
      assert.equal(material.normalMap, null);
      assert.equal(material.roughnessMap, null);
      assert.equal(cloudMaterial.map, fallbackCloudMap);
    } finally {
      global.document = oldDocument;
    }
  } finally {
    global.Image = oldImage;
  }
});
