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
    let trailCount = 0;
    let disposed = false;

    function emit(position, type, direction, intensity = 1, tint, outward) {
      if (disposed || particles.length >= maxParticles) return false;
      const isSmoke = type === 'smoke';
      const life = isSmoke ? 1.05 + Math.random() * 0.95 : 0.22 + Math.random() * 0.30;
      const size = (isSmoke ? 0.18 + Math.random() * 0.25 : 0.045 + Math.random() * 0.075) * intensity;
      const material = new THREE.SpriteMaterial({
        map: isSmoke ? smokeTexture : emberTexture,
        color: tint || (isSmoke ? 0x78818d : 0xffa044),
        transparent: true,
        opacity: isSmoke ? 0.32 : 0.92,
        depthWrite: false,
        blending: isSmoke ? THREE.NormalBlending : THREE.AdditiveBlending,
        rotation: Math.random() * Math.PI * 2
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(size, size, 1);
      scene.add(sprite);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * (isSmoke ? 0.55 : 2.0),
        (Math.random() - 0.5) * (isSmoke ? 0.55 : 2.0),
        (Math.random() - 0.5) * (isSmoke ? 0.55 : 2.0)
      );
      if (direction) velocity.addScaledVector(direction, isSmoke ? -0.24 : -0.62);
      if (outward) velocity.addScaledVector(outward, isSmoke ? 0.28 + Math.random() * 0.8 : 1.1 + Math.random() * 4.0);
      particles.push({
        sprite, velocity, life, maxLife: life, baseSize: size,
        growth: isSmoke ? 0.28 + Math.random() * 0.36 : 0.06,
        spin: (Math.random() - 0.5) * (isSmoke ? 0.7 : 4.0),
        baseOpacity: isSmoke ? 0.32 : 0.92,
        type: isSmoke ? 'smoke' : 'ember'
      });
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
      const budget = Math.min(Math.max(0, Math.floor(count)), maxParticles - particles.length);
      for (let i = 0; i < budget; i++) {
        const type = i % 3 === 0 ? 'smoke' : 'ember';
        emit(position, type, null, type === 'smoke' ? 1.4 : 1, type === 'smoke' ? 0x555b64 : tint, outward);
      }
    }

    function update(dt) {
      if (disposed) return;
      const step = Math.max(0, Math.min(0.05, dt));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= step;
        if (p.life <= 0) {
          scene.remove(p.sprite);
          p.sprite.material.dispose();
          particles.splice(i, 1);
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

    function clear() {
      for (const p of particles) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
      }
      particles.length = 0;
      trailCount = 0;
    }

    function dispose() {
      if (disposed) return;
      clear();
      disposed = true;
      smokeTexture.dispose();
      emberTexture.dispose();
    }

    return Object.freeze({
      trail, burst, update, clear, dispose,
      getParticleCount: () => particles.length,
      getMaxParticles: () => maxParticles
    });
  }

  root.GodSmashRocketFX = Object.freeze({createSystem});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashRocketFX;
})(typeof window !== 'undefined' ? window : globalThis);
