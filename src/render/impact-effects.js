/* Cinematic impact core: turbulent fireball, hot plasma shell and surface shock rings.
 * Combined with GodSmashRocketFX for wispy smoke and hot fragments.
 * Visual units are game-space approximations, not a thermodynamic simulation.
 */
(function (root) {
  'use strict';

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uHotColor;
    uniform vec3 uOuterColor;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y
      );
    }
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p = p * 2.03 + vec2(7.1, 3.7);
        amplitude *= 0.5;
      }
      return value;
    }
    void main() {
      vec2 flowUv = vUv * vec2(17.0, 10.0);
      float slow = fbm(flowUv + vec2(uTime * 0.42, -uTime * 0.26));
      float fine = fbm(flowUv * 1.9 + vec2(-uTime * 0.72, uTime * 0.58));
      float turbulence = slow * 0.64 + fine * 0.36;
      float limb = smoothstep(0.015, 0.20, vUv.y) *
                   (1.0 - smoothstep(0.80, 0.99, vUv.y));
      float flame = smoothstep(0.22, 0.69, turbulence);
      float alpha = uOpacity * limb * smoothstep(0.13, 0.44, turbulence);
      vec3 color = mix(uOuterColor * 0.62, uHotColor, flame);
      color += uHotColor * pow(max(0.0, turbulence - 0.63), 2.0) * 1.6;
      gl_FragColor = vec4(color, alpha * 0.96);
    }
  `;

  function createEffect(THREE, weapon, size, lowQuality) {
    const group = new THREE.Group();
    group.name = 'Cinematic impact blast';
    const span = Math.max(0.4, size);
    const hotColor = weapon.fireColor || '#ffdb93';
    const outerColor = weapon.plasmaColor || '#ff7c32';

    const fireMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: {value: 0},
        uOpacity: {value: 1},
        uHotColor: {value: new THREE.Color(hotColor)},
        uOuterColor: {value: new THREE.Color(outerColor)}
      },
      vertexShader, fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: outerColor, transparent: true, opacity: 0.42,
      depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const waveMaterial = new THREE.MeshBasicMaterial({
      color: weapon.waveColor || '#ffbb6e', transparent: true,
      opacity: 0.8, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const innerWaveMaterial = new THREE.MeshBasicMaterial({
      color: hotColor, transparent: true, opacity: 0.54,
      depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const fireball = new THREE.Mesh(
      new THREE.SphereGeometry(span * 0.35, lowQuality ? 12 : 24, lowQuality ? 8 : 16),
      fireMaterial
    );
    fireball.position.z = span * 0.14;
    group.add(fireball);

    const plasma = new THREE.Mesh(
      new THREE.SphereGeometry(span * 0.50, lowQuality ? 12 : 20, lowQuality ? 8 : 14),
      shellMaterial
    );
    plasma.position.z = span * 0.12;
    group.add(plasma);

    // The shock front expands along the surface as rings, rather than a clean sphere.
    const ringSegments = lowQuality ? 28 : 56;
    const shockFront = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.0, ringSegments), waveMaterial
    );
    shockFront.position.z = span * 0.055;
    shockFront.scale.setScalar(0.001);
    group.add(shockFront);

    const innerWave = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1.0, ringSegments), innerWaveMaterial
    );
    innerWave.position.z = span * 0.04;
    innerWave.scale.setScalar(0.001);
    group.add(innerWave);

    const flash = lowQuality ? null : new THREE.PointLight(
      new THREE.Color(outerColor), 2.2, span * 5
    );
    if (flash) {
      flash.position.z = span * 0.18;
      group.add(flash);
    }

    let disposed = false;
    function update(progress) {
      if (disposed) return;
      const t = Math.max(0, Math.min(1, progress));
      const bloom = Math.sin(Math.PI * Math.min(1, t * 1.55));
      fireball.scale.setScalar(Math.max(0.001, 0.22 + bloom * 1.75));
      fireMaterial.uniforms.uTime.value = t * 8.5;
      fireMaterial.uniforms.uOpacity.value = Math.max(0, 1 - t * 2.05);
      plasma.scale.setScalar(0.18 + Math.pow(t, 0.62) * 2.2);
      shellMaterial.opacity = Math.max(0, 0.52 * (1 - t * 1.75));
      const expanding = span * (0.18 + t * 3.9);
      shockFront.scale.setScalar(expanding);
      innerWave.scale.setScalar(expanding * 0.78);
      waveMaterial.opacity = Math.max(0, 0.68 * (1 - t));
      innerWaveMaterial.opacity = Math.max(0, 0.46 * (1 - t * 1.25));
      if (flash) flash.intensity = 5.5 * Math.pow(1 - t, 3);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set();
      const materials = new Set();
      group.traverse(item => {
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) {
          (Array.isArray(item.material) ? item.material : [item.material]).forEach(m => materials.add(m));
        }
      });
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    }

    return {group, update, dispose, duration: lowQuality ? 1.85 : 2.65};
  }

  root.GodSmashImpactEffects = Object.freeze({createEffect});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashImpactEffects;
})(typeof window !== 'undefined' ? window : globalThis);
