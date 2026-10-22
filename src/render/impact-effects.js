/* Animated impact visuals: hot fireball, transient shock front, debris haze,
 * growing dust column, and localized flash light. No per-frame allocation.
 */
(function (root) {
  'use strict';

  function createEffect(THREE, weapon, size, lowQuality) {
    const group = new THREE.Group();
    group.name = 'Impact blast';
    const span = Math.max(0.4, size);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: weapon.plasmaColor || '#ff7c32', transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const fireMaterial = new THREE.MeshBasicMaterial({
      color: weapon.fireColor || '#ffdb93', transparent: true,
      opacity: 0.99, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const waveMaterial = new THREE.MeshBasicMaterial({
      color: weapon.waveColor || '#ffbb6e', transparent: true,
      opacity: 0.65, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const sootMaterial = new THREE.MeshBasicMaterial({
      color: 0x2b262a, transparent: true, opacity: 0.36, depthWrite: false
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7835, transparent: true, opacity: 0.28,
      depthWrite: false, blending: THREE.AdditiveBlending
    });

    const fireball = new THREE.Mesh(
      new THREE.SphereGeometry(span * 0.34, lowQuality ? 12 : 20, lowQuality ? 8 : 14), fireMaterial);
    fireball.position.z = span * 0.15;
    group.add(fireball);
    const plasma = new THREE.Mesh(
      new THREE.SphereGeometry(span * 0.52, lowQuality ? 12 : 20, lowQuality ? 8 : 14), shellMaterial);
    plasma.position.z = span * 0.16;
    group.add(plasma);
    const shockFront = new THREE.Mesh(
      new THREE.SphereGeometry(1, lowQuality ? 16 : 28, lowQuality ? 12 : 20), waveMaterial);
    shockFront.position.z = span * 0.1;
    shockFront.scale.setScalar(0.001);
    group.add(shockFront);

    const dust = [];
    const count = lowQuality ? 5 : 11;
    const shardGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < count; i++) {
      const smoke = new THREE.Mesh(shardGeo, i % 4 === 0 ? glowMaterial : sootMaterial);
      const angle = i * 2.39996;
      const ring = 0.14 + 0.26 * Math.sqrt((i + 1) / count);
      smoke.userData = {
        x: Math.cos(angle) * ring,
        y: Math.sin(angle) * ring,
        rise: 0.18 + (i % 5) * 0.16,
        phase: i / count
      };
      group.add(smoke);
      dust.push(smoke);
    }
    const flash = lowQuality ? null : new THREE.PointLight(
      new THREE.Color(weapon.plasmaColor || '#f97316'), 2.2, span * 5
    );
    if (flash) {
      flash.position.z = 0.2;
      group.add(flash);
    }
    let disposed = false;
    function update(progress) {
      if (disposed) return;
      const t = Math.max(0, Math.min(1, progress));
      const bloom = Math.sin(Math.PI * Math.min(1, t * 1.6));
      fireball.scale.setScalar(Math.max(0.001, 0.15 + bloom * 1.8));
      fireMaterial.opacity = Math.max(0, 1 - t * 2.6);
      plasma.scale.setScalar(0.25 + Math.pow(t, 0.6) * 2.1);
      shellMaterial.opacity = Math.max(0, 0.75 * (1 - t * 1.8));
      const expanding = span * (0.30 + t * 4.5);
      shockFront.scale.setScalar(expanding);
      waveMaterial.opacity = Math.max(0, 0.50 * (1 - t));
      dust.forEach(d => {
        const phase = d.userData;
        d.position.set(
          phase.x * span * (0.8 + t * 4.0),
          phase.y * span * (0.8 + t * 4.0),
          span * (phase.rise + 1.95 * t)
        );
        const spread = span * (0.18 + t * 0.72);
        d.scale.set(spread, spread, spread * (0.82 + phase.phase));
        d.rotation.z += 0.009;
      });
      sootMaterial.opacity = Math.max(0, 0.47 * (1 - t * 0.8));
      glowMaterial.opacity = Math.max(0, 0.38 * (1 - t * 2));
      if (flash) flash.intensity = 5 * Math.pow(1 - t, 3);
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

    return {group, update, dispose, duration: lowQuality ? 1.9 : 2.5};
  }

  root.GodSmashImpactEffects = Object.freeze({createEffect});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashImpactEffects;
})(typeof window !== 'undefined' ? window : globalThis);
