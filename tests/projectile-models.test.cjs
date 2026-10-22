const test = require('node:test');
const assert = require('node:assert/strict');
const projectiles = require('../src/render/projectile-models.js');

function fakeTHREE() {
  const allocated = { geometries: [], materials: [], textures: [] };
  class Node {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.children = [];
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { z: 0 };
      this.scale = { setScalar(value) { this.value = value; } };
      this.userData = {};
    }
    add(child) { this.children.push(child); }
    traverse(fn) { fn(this); for (const child of this.children) child.traverse(fn); }
  }
  class Geometry {
    constructor() { this.disposals = 0; allocated.geometries.push(this); }
    rotateX() { return this; }
    translate() { return this; }
    dispose() { this.disposals++; }
  }
  class Material {
    constructor(options = {}) {
      Object.assign(this, options);
      this.disposals = 0;
      allocated.materials.push(this);
    }
    dispose() { this.disposals++; }
  }
  class Texture {
    constructor(image) {
      this.image = image;
      this.disposals = 0;
      allocated.textures.push(this);
    }
    dispose() { this.disposals++; }
  }
  const mock = {
    Group: Node, Mesh: Node,
    CylinderGeometry: Geometry, TorusGeometry: Geometry, LatheGeometry: Geometry,
    ExtrudeGeometry: Geometry, ConeGeometry: Geometry, DodecahedronGeometry: Geometry,
    MeshStandardMaterial: Material, MeshBasicMaterial: Material,
    CanvasTexture: Texture,
    Shape: class {moveTo(){} lineTo(){} closePath(){}},
    Vector2: class {constructor(x,y) {this.x=x;this.y=y;}},
    DoubleSide: 'double', AdditiveBlending: 'add', sRGBEncoding: 'srgb'
  };
  return { mock, allocated };
}

test('missile model exposes three fictional silhouette presets', () => {
  assert.deepEqual(Object.keys(projectiles.profiles),
    ['strategic', 'interceptor', 'cruise', 'siege', 'hypersonic', 'plasma']);
  assert.equal(projectiles.getProfile('unknown').id, 'strategic');
});

test('high detail models include fins, engraved panels, nozzle and layered exhaust', () => {
  const originalDocument = global.document;
  global.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        createLinearGradient: () => ({addColorStop(){}}),
        fillRect(){}, strokeRect(){}, fillText(){}
      })
    })
  };
  try {
    const {mock, allocated} = fakeTHREE();
    const strategic = projectiles.createMissile(mock, 'strategic', 'high');
    const winged = projectiles.createMissile(mock, 'cruise', 'high');
    assert.ok(strategic.group.children.length >= 12);
    assert.ok(winged.group.children.length > strategic.group.children.length);
    assert.equal(strategic.plume.children.length, 8, 'five thermal flame layers plus three shock diamonds');
    assert.ok(strategic.plume.children[0].userData.baseOpacity > 0);
    assert.ok(strategic.group.userData.trailOffsetZ < 0);
    assert.equal(strategic.group.userData.visualProfile, 'strategic');
    assert.equal(allocated.textures.length, 2);

    strategic.dispose();
    winged.dispose();
    for (const resource of [...allocated.textures, ...allocated.materials, ...allocated.geometries]) {
      assert.equal(resource.disposals, 1, 'each GPU allocation is disposed exactly once');
    }
  } finally { global.document = originalDocument; }
});

test('asteroid has no rocket exhaust and owns its geometry', () => {
  const {mock, allocated} = fakeTHREE();
  const rock = projectiles.createAsteroid(mock, 'low');
  assert.equal(rock.plume, null);
  assert.equal(rock.group.children.length, 1);
  rock.dispose();
  assert.equal(allocated.geometries[0].disposals, 1);
  assert.equal(allocated.materials[0].disposals, 1);
});

test('new missile profiles have distinct booster, speed and plasma details', () => {
  const originalDocument = global.document;
  global.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        createLinearGradient: () => ({addColorStop(){}}),
        fillRect(){}, strokeRect(){}, fillText(){}
      })
    })
  };
  try {
    const {mock, allocated} = fakeTHREE();
    const titan = projectiles.createMissile(mock, 'siege', 'low');
    const viper = projectiles.createMissile(mock, 'hypersonic', 'low');
    const nova = projectiles.createMissile(mock, 'plasma', 'low');
    assert.equal(titan.group.userData.visualProfile, 'siege');
    assert.equal(viper.group.userData.visualProfile, 'hypersonic');
    assert.equal(nova.group.userData.visualProfile, 'plasma');
    assert.ok(titan.group.children.length > viper.group.children.length,
      'Titan includes two external booster bodies, noses and nozzles');
    assert.equal(titan.plume.children[0].material.color, 0xffbd7a);
    assert.equal(viper.plume.children[0].material.color, 0x60a5fa);
    assert.equal(nova.plume.children[0].material.color, 0x8b5cf6);
    assert.ok(nova.group.children.some(node => node.material &&
      node.material.color === 0x8b5cf6 && node.geometry instanceof mock.TorusGeometry),
      'Nova has luminous plasma bands');
    titan.dispose(); viper.dispose(); nova.dispose();
    for (const resource of [...allocated.textures, ...allocated.materials, ...allocated.geometries]) {
      assert.equal(resource.disposals, 1, 'new profile resources are disposed exactly once');
    }
  } finally { global.document = originalDocument; }
});
