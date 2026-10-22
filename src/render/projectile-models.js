/* Detailed fictional rocket models for GodSmash.
 * Visual-only geometry: stylized silhouettes, no real-world engineering specifications.
 * Each projectile owns its meshes, geometries, materials and body decal texture.
 */
(function (root) {
  'use strict';

  const profiles = Object.freeze({
    strategic: Object.freeze({
      id: 'strategic', serial: 'GS-01', caption: 'STRATEGIC',
      length: 1.95, radius: 0.22, nose: 0.78,
      fins: 4, finSpan: 0.38, finChord: 0.60,
      stripes: '#b45309', base: '#d6dee5', tip: '#a0aebd', wings: false
    }),
    interceptor: Object.freeze({
      id: 'interceptor', serial: 'GS-02', caption: 'INTERCEPT',
      length: 1.50, radius: 0.14, nose: 0.68,
      fins: 4, finSpan: 0.25, finChord: 0.44,
      stripes: '#2e739d', base: '#e6eaf0', tip: '#bac4cc', wings: false
    }),
    cruise: Object.freeze({
      id: 'cruise', serial: 'GS-03', caption: 'CRUISE',
      length: 1.68, radius: 0.17, nose: 0.54,
      fins: 4, finSpan: 0.20, finChord: 0.39,
      stripes: '#475569', base: '#c2cdd3', tip: '#a4b0bd', wings: true
    }),
    siege: Object.freeze({
      id: 'siege', serial: 'GS-04', caption: 'TITAN SIEGE',
      length: 2.30, radius: 0.29, nose: 0.76,
      fins: 6, finSpan: 0.40, finChord: 0.63,
      stripes: '#b91c1c', base: '#303743', tip: '#fca5a5',
      hardwareColor: '#252b35', finColor: '#7f3b3b', sideBoosters: 2,
      plumeColors: Object.freeze([0xffbd7a, 0xff3b24, 0xff7a2f, 0xffd166, 0xfff5d6]),
      shockColor: 0xff7043, wings: false
    }),
    hypersonic: Object.freeze({
      id: 'hypersonic', serial: 'GS-05', caption: 'VIPER HYPERSONIC',
      length: 2.08, radius: 0.115, nose: 0.78,
      fins: 4, finSpan: 0.16, finChord: 0.32,
      stripes: '#0891b2', base: '#293f50', tip: '#b7f7ff',
      hardwareColor: '#152b3a', finColor: '#3b6475',
      plumeColors: Object.freeze([0x60a5fa, 0x0ea5e9, 0x38bdf8, 0x7dd3fc, 0xf0fdff]),
      shockColor: 0x67e8f9, wings: false
    }),
    plasma: Object.freeze({
      id: 'plasma', serial: 'GS-06', caption: 'NOVA PLASMA',
      length: 1.78, radius: 0.19, nose: 0.74,
      fins: 3, finSpan: 0.29, finChord: 0.46,
      stripes: '#7c3aed', base: '#c4d4e7', tip: '#d8b4fe',
      hardwareColor: '#263248', finColor: '#6d5ca8', glowRings: true, wings: true,
      plumeColors: Object.freeze([0x8b5cf6, 0x6d28d9, 0x22d3ee, 0x67e8f9, 0xffffff]),
      shockColor: 0x8b5cf6
    })
  });

  function getProfile(id) {
    return profiles[id] || profiles.strategic;
  }

  function paintMarkings(profile) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, '#77828e');
    gradient.addColorStop(0.17, profile.base);
    gradient.addColorStop(0.49, '#f8fafc');
    gradient.addColorStop(0.74, profile.base);
    gradient.addColorStop(1, '#8995a1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 512);

    // Panel seams, inspection hatches, identification and safety stripes.
    ctx.fillStyle = 'rgba(28, 40, 50, 0.26)';
    [26, 112, 222, 338, 448].forEach(y => ctx.fillRect(0, y, 256, 2));
    ctx.fillStyle = profile.stripes;
    ctx.fillRect(0, 28, 256, 16);
    ctx.fillRect(0, 442, 256, 9);
    ctx.fillStyle = 'rgba(17, 24, 39, 0.4)';
    for (let i = 0; i < 5; i++) ctx.fillRect(16 + i * 52, 0, 1, 512);
    ctx.strokeStyle = 'rgba(28, 40, 50, 0.35)';
    ctx.strokeRect(32, 148, 62, 92);
    ctx.strokeRect(168, 304, 47, 62);
    ctx.fillStyle = '#273544';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(profile.serial, 38, 182);
    ctx.font = '11px sans-serif';
    ctx.fillText(profile.caption, 38, 202);
    ctx.fillStyle = profile.stripes;
    ctx.fillRect(40, 217, 48, 5);
    return canvas;
  }

  function finish(THREE, rootGroup) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    rootGroup.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) {
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(mat => {
          materials.add(mat);
          if (mat.map) textures.add(mat.map);
        });
      }
    });
    textures.forEach(x => x.dispose());
    materials.forEach(x => x.dispose());
    geometries.forEach(x => x.dispose());
  }

  function axialCylinder(THREE, radiusTop, radiusBottom, length, segments, z, material, parent) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments, 1);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    parent.add(mesh);
    return mesh;
  }

  function createFinShape(THREE, radius, span, chord, thickness) {
    const shape = new THREE.Shape();
    shape.moveTo(radius * 0.88, -chord * 0.51);
    shape.lineTo(radius + span * 0.84, -chord * 0.63);
    shape.lineTo(radius + span, chord * 0.16);
    shape.lineTo(radius * 0.9, chord * 0.48);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness, steps: 1, bevelEnabled: false, curveSegments: 1
    });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, thickness / 2, 0);
    return geometry;
  }

  function createMissile(THREE, profileName, quality) {
    if (!THREE || !THREE.Group || !THREE.Mesh) throw new TypeError('Three.js is required');
    const p = getProfile(profileName);
    const segmentCount = quality === 'low' ? 12 : 24;
    const group = new THREE.Group();
    group.name = 'GodSmash ' + p.serial;

    const decals = new THREE.CanvasTexture(paintMarkings(p));
    decals.encoding = THREE.sRGBEncoding;
    decals.anisotropy = 2;
    const body = new THREE.MeshStandardMaterial({
      map: decals, roughness: 0.46, metalness: 0.42
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: p.hardwareColor || '#333e4c', metalness: 0.75, roughness: 0.33
    });
    const metal = new THREE.MeshStandardMaterial({
      color: p.tip, metalness: 0.52, roughness: 0.41
    });
    const finMaterial = new THREE.MeshStandardMaterial({
      color: p.finColor || '#677686', metalness: 0.62, roughness: 0.36,
      side: THREE.DoubleSide
    });

    axialCylinder(THREE, p.radius * 0.97, p.radius, p.length, segmentCount, 0, body, group);
    // Ogive-like nose with smooth visual curvature. Values are game-space only.
    const points = [
      new THREE.Vector2(p.radius, -p.nose / 2),
      new THREE.Vector2(p.radius * 0.91, -p.nose * 0.30),
      new THREE.Vector2(p.radius * 0.73, 0),
      new THREE.Vector2(p.radius * 0.37, p.nose * 0.34),
      new THREE.Vector2(0.012, p.nose / 2)
    ];
    const noseGeo = new THREE.LatheGeometry(points, segmentCount);
    noseGeo.rotateX(Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeo, metal);
    noseMesh.position.z = (p.length + p.nose) / 2;
    group.add(noseMesh);

    // Panel joints, collar rings, tail nozzle, and subtle hardware detail.
    const bandMaterial = new THREE.MeshStandardMaterial({
      color: p.stripes, metalness: 0.48, roughness: 0.49
    });
    [p.length * 0.38, p.length * 0.15, -p.length * 0.35].forEach((z, i) => {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(p.radius * 1.004, i === 0 ? 0.013 : 0.008, 5, segmentCount),
        i === 0 ? bandMaterial : darkSteel
      );
      torus.position.z = z;
      group.add(torus);
    });
    const nozzleZ = -p.length / 2 - 0.11;
    axialCylinder(THREE, p.radius * 0.66, p.radius * 0.73, 0.25, segmentCount, nozzleZ, darkSteel, group);
    axialCylinder(THREE, p.radius * 0.40, p.radius * 0.40, 0.04, segmentCount, nozzleZ - 0.14, metal, group);

    const finGeo = createFinShape(THREE, p.radius, p.finSpan, p.finChord, 0.035);
    for (let i = 0; i < p.fins; i++) {
      const fin = new THREE.Mesh(finGeo, finMaterial);
      fin.position.z = -p.length * 0.37;
      fin.rotation.z = (Math.PI * 2 * i) / p.fins;
      group.add(fin);
    }
    if (p.wings) {
      const wingGeo = createFinShape(THREE, p.radius, p.id === 'plasma' ? 0.62 : 0.77,
        p.id === 'plasma' ? 0.64 : 0.78, 0.043);
      for (let i = 0; i < 2; i++) {
        const wing = new THREE.Mesh(wingGeo, finMaterial);
        wing.position.z = 0.1;
        wing.rotation.z = Math.PI * i;
        group.add(wing);
      }
    }

    // The Titan silhouette uses two side boosters; shared materials keep draw cost modest.
    if (p.sideBoosters) {
      const boosterLength = p.length * 0.62;
      const boosterRadius = p.radius * 0.25;
      for (let i = 0; i < p.sideBoosters; i++) {
        const x = (i === 0 ? -1 : 1) * p.radius * 1.34;
        const boosterBody = axialCylinder(
          THREE, boosterRadius * 0.94, boosterRadius, boosterLength,
          segmentCount, -p.length * 0.10, body, group
        );
        boosterBody.position.x = x;
        const boosterNose = new THREE.Mesh(
          new THREE.ConeGeometry(boosterRadius, p.nose * 0.40, segmentCount), metal
        );
        boosterNose.geometry.rotateX(Math.PI / 2);
        boosterNose.position.set(x, 0, -p.length * 0.10 + boosterLength / 2 + p.nose * 0.20);
        group.add(boosterNose);
        const boosterNozzle = new THREE.Mesh(
          new THREE.TorusGeometry(boosterRadius * 0.70, 0.012, 5, segmentCount), darkSteel
        );
        boosterNozzle.position.set(x, 0, -p.length * 0.10 - boosterLength / 2);
        group.add(boosterNozzle);
      }
    }

    // The Nova's two restrained luminous bands identify its plasma-powered profile.
    if (p.glowRings) {
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: p.shockColor || 0x22d3ee, transparent: true, opacity: 0.72,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      [-0.12, 0.19].forEach(fraction => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(p.radius * 1.045, 0.009, 5, segmentCount),
          glowMaterial
        );
        ring.position.z = p.length * fraction;
        group.add(ring);
      });
    }

    // Multi-temperature exhaust: translucent outer envelope, orange combustion,
    // yellow flame front and a compact white-hot core. All layers flicker in runtime.
    const plume = new THREE.Group();
    plume.name = 'Layered rocket exhaust';
    plume.position.z = nozzleZ - 0.28;

    function addFlameLayer(radius, length, color, opacity, z) {
      const material = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const geometry = new THREE.ConeGeometry(radius, length, segmentCount);
      geometry.rotateX(-Math.PI / 2);
      const flame = new THREE.Mesh(geometry, material);
      flame.position.z = z;
      flame.userData.baseOpacity = opacity;
      plume.add(flame);
      return flame;
    }

    const plumeColors = p.plumeColors || [
      0x8fc9ff, 0xff5424, 0xff9d35, 0xffe0a0, 0xf8fdff
    ];
    addFlameLayer(p.radius * 0.98, 1.72, plumeColors[0], 0.16, -0.60);
    addFlameLayer(p.radius * 0.78, 1.28, plumeColors[1], 0.58, -0.37);
    addFlameLayer(p.radius * 0.57, 1.03, plumeColors[2], 0.72, -0.29);
    addFlameLayer(p.radius * 0.37, 0.78, plumeColors[3], 0.88, -0.22);
    addFlameLayer(p.radius * 0.20, 0.52, plumeColors[4], 0.98, -0.16);

    // Faint exhaust shock diamonds, spaced along the plume axis.
    [ -0.42, -0.78, -1.12 ].forEach((z, i) => {
      const material = new THREE.MeshBasicMaterial({
        color: p.shockColor || (i === 0 ? 0xffd6a1 : 0xb6e4ff),
        transparent: true, opacity: 0.22 - i * 0.035,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(p.radius * (0.40 - i * 0.055), p.radius * 0.035, 5, segmentCount),
        material
      );
      ring.position.z = z;
      ring.userData.baseOpacity = material.opacity;
      plume.add(ring);
    });
    group.add(plume);
    group.userData.trailOffsetZ = nozzleZ - 0.60;
    group.userData.visualProfile = p.id;
    return { group, plume, dispose: () => finish(THREE, group) };
  }

  function createAsteroid(THREE, quality) {
    const group = new THREE.Group();
    group.name = 'GodSmash asteroid';
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.57, quality === 'low' ? 0 : 1),
      new THREE.MeshStandardMaterial({
        color: 0x655248, roughness: 1, flatShading: true,
        emissive: 0x3f190b, emissiveIntensity: 0.32
      })
    );
    group.add(rock);
    group.userData.trailOffsetZ = -0.45;
    return { group, plume: null, dispose: () => finish(THREE, group) };
  }

  const api = Object.freeze({ profiles, getProfile, createMissile, createAsteroid });
  root.GodSmashProjectiles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
