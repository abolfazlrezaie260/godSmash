/* Camera-facing rocket exhaust and impact particles.
 * Reuses two procedural alpha textures and caps live sprites for mobile GPUs.
 * This is a cinematic approximation, not a CFD or propulsion simulation.
 */
(function (root) {
  'use strict';

  function makeSpriteTexture(THREE, kind) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (kind === 'smoke') {
      // Uneven overlapping lobes avoid the hard-edged, uniformly round smoke look.
      for (let i = 0; i < 7; i++) {
        const x = 34 + Math.random() * 60;
        const y = 30 + Math.random() * 68;
        const radius = 20 + Math.random() * 29;
        const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,0.34)');
        gradient.addColorStop(0.46, 'rgba(220,225,232,0.19)');
        gradient.addColorStop(1, 'rgba(150,160,175,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * (0.48 + Math.random() * 0.55),
          Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 63);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.14, 'rgba(255,246,194,0.98)');
      gradient.addColorStop(0.35, 'rgba(255,155,55,0.82)');
      gradient.addColorStop(0.68, 'rgba(239,68,30,0.34)');
      gradient.addColorStop(1, 'rgba(239,68,30,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function createSystem(THREE, options = {}) {
    if (!THREE || !THREE.Sprite || !THREE.SpriteMaterial || !options.scene) {
      throw new TypeError('Rocket FX requires Three.js Sprite support and a scene');
    }
    const lowQuality = !!options.lowQuality;
    const maxParticles = Math.max(24, options.maxParticles || (lowQuality ? 92 : 220));
    const scene = options.scene;
    const smokeTexture = makeSpriteTexture(THREE, 'smoke');
    const emberTexture = makeSpriteTexture(THREE, 'ember');
    const particles = [];
    // Each sprite needs its own opacity/material. Keep idle sprites for reuse,
    // disposing their individual materials only when this system is destroyed.
    const idleParticles = [];
    let allocated = 0;
    let budget = maxParticles;
    let trailCount = 0;
    let disposed = false;

    function recycleAt(index) {
      const p = particles[index];
      scene.remove(p.sprite);
      idleParticles.push(p);
      particles.splice(index, 1);
    }

    function allocate(type) {
      const isSmoke = type === 'smoke';
      if (idleParticles.length) return idleParticles.pop();
      const material = new THREE.SpriteMaterial({
        map: isSmoke ? smokeTexture : emberTexture,
        color: isSmoke ? 0x78818d : 0xffa044,
        transparent: true,
        opacity: isSmoke ? 0.32 : 0.92,
        depthWrite: false,
        blending: isSmoke ? THREE.NormalBlending : THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(material);
      allocated++;
      return {sprite, velocity: new THREE.Vector3(), type};
    }

    function emit(position, type, direction, intensity = 1, tint, outward, lifeMultiplier = 1) {
      if (disposed || particles.length >= budget) return false;
      const isSmoke = type === 'smoke';
      const life = (isSmoke ? 1.05 + Math.random() * 0.95 : 0.22 + Math.random() * 0.30) *
        Math.max(0.6, Math.min(3.5, lifeMultiplier));
      const size = (isSmoke ? 0.18 + Math.random() * 0.25 : 0.045 + Math.random() * 0.075) * intensity;
      const p = allocate(type);
      p.type = type; // A pooled sprite may have previously been smoke or an ember.
      const material = p.sprite.material;
      material.map = isSmoke ? smokeTexture : emberTexture;
      material.blending = isSmoke ? THREE.NormalBlending : THREE.AdditiveBlending;
      if (material.color && typeof material.color.set === 'function') {
        material.color.set(tint || (isSmoke ? 0x78818d : 0xffa044));
      } else {
        material.color = tint || (isSmoke ? 0x78818d : 0xffa044);
      }
      material.opacity = isSmoke ? 0.32 : 0.92;
      material.rotation = Math.random() * Math.PI * 2;
      p.sprite.position.copy(position);
      p.sprite.scale.set(size, size, 1);
      scene.add(p.sprite);

      const velocity = p.velocity;
      velocity.x = (Math.random() - 0.5) * (isSmoke ? 0.55 : 2.0);
      velocity.y = (Math.random() - 0.5) * (isSmoke ? 0.55 : 2.0);
      velocity.z = (Math.random() - 0.5) * (isSmoke ? 0.55 : 2.0);
      if (direction) velocity.addScaledVector(direction, isSmoke ? -0.24 : -0.62);
      if (outward) velocity.addScaledVector(outward, isSmoke ? 0.28 + Math.random() * 0.8 : 1.1 + Math.random() * 4.0);
      p.life = life;
      p.maxLife = life;
      p.baseSize = size;
      p.growth = isSmoke ? 0.28 + Math.random() * 0.36 : 0.06;
      p.spin = (Math.random() - 0.5) * (isSmoke ? 0.7 : 4.0);
      p.baseOpacity = isSmoke ? 0.32 : 0.92;
      particles.push(p);
      return true;
    }

    function trail(position, direction, profile = 'strategic') {
      if (disposed) return;
      trailCount++;
      const scale = ({
        strategic: 1.18, cruise: 0.84, interceptor: 0.68,
        siege: 1.42, hypersonic: 0.48, plasma: 0.92, asteroid: 0.86
      })[profile] || 0.68;
      emit(position, 'smoke', direction, scale, 0x89919a);
      if (trailCount % (lowQuality ? 4 : 2) === 0) {
        emit(position, 'ember', direction, scale * 0.82, 0xffa04a);
      }
    }

    function burst(position, outward, count = 12, tint = 0xff9b45) {
      if (disposed) return;
      const burstBudget = Math.min(Math.max(0, Math.floor(count)), budget - particles.length);
      for (let i = 0; i < burstBudget; i++) {
        const type = i % 3 === 0 ? 'smoke' : 'ember';
        emit(position, type, null, type === 'smoke' ? 1.4 : 1, type === 'smoke' ? 0x555b64 : tint, outward);
      }
    }

    function burstDust(position, outward, count = 7) {
      if (disposed) return;
      const amount = Math.min(Math.max(0, Math.floor(count)), budget - particles.length);
      for (let i = 0; i < amount; i++) {
        emit(position, 'smoke', null, 1.5 + Math.random() * 0.45,
          0x827d76, outward, 2.5);
      }
    }

    function update(dt) {
      if (disposed) return;
      const step = Math.max(0, Math.min(0.10, dt));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= step;
        if (p.life <= 0) {
          recycleAt(i);
          continue;
        }
        const age = 1 - p.life / p.maxLife;
        p.sprite.position.addScaledVector(p.velocity, step);
        if (p.type === 'smoke') p.velocity.multiplyScalar(1 - step * 0.72);
        else p.velocity.multiplyScalar(1 - step * 0.32);
        const size = p.baseSize * (1 + p.growth * age * 4);
        p.sprite.scale.set(size, size * (p.type === 'smoke' ? 0.78 + age * 0.7 : 1), 1);
        p.sprite.material.opacity = p.baseOpacity * Math.pow(p.life / p.maxLife, p.type === 'smoke' ? 1.6 : 0.8);
        p.sprite.material.rotation += p.spin * step;
      }
    }

    function setBudget(nextBudget) {
      if (!Number.isFinite(nextBudget)) return budget;
      budget = Math.max(1, Math.min(maxParticles, Math.floor(nextBudget)));
      while (particles.length > budget) recycleAt(particles.length - 1);
      return budget;
    }

    function clear() {
      while (particles.length) recycleAt(particles.length - 1);
      trailCount = 0;
    }

    function dispose() {
      if (disposed) return;
      clear();
      disposed = true;
      for (const p of idleParticles) p.sprite.material.dispose();
      idleParticles.length = 0;
      smokeTexture.dispose();
      emberTexture.dispose();
    }

    return Object.freeze({
      trail, burst, burstDust, update, clear, dispose, setBudget,
      getParticleCount: () => particles.length,
      getMaxParticles: () => maxParticles,
      getBudget: () => budget,
      getPoolSize: () => allocated,
      getIdleCount: () => idleParticles.length
    });

  }

  root.GodSmashRocketFX = Object.freeze({createSystem});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashRocketFX;
})(typeof window !== 'undefined' ? window : globalThis);
