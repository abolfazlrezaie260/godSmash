/* Canvas-generated visual presets for non-Earth bodies; no texture downloads required. */
(function (root) {
  'use strict';
  function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
  function hashId(id) {
    let hash = 2166136261;
    for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  }
  function paint(planet, surface, emissive, width, height) {
    if (!planet || !Array.isArray(planet.palette) || planet.palette.length < 3) {
      throw new Error('Unknown planet texture configuration');
    }
    // Mars has a dedicated geologically inspired offline synthesizer;
    // Moon/Venus retain their independent lightweight procedural presets.
    if(planet.id==='mars' && root.GodSmashMarsSurface)
      return root.GodSmashMarsSurface.paint(surface,emissive,width,height);
    const random = seededRandom(hashId(planet.id));
    const [dark, mid, light] = planet.palette;
    const gradient = surface.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(0.3, mid);
    gradient.addColorStop(0.68, dark);
    gradient.addColorStop(1, mid);
    surface.fillStyle = gradient;
    surface.fillRect(0, 0, width, height);

    if (planet.surface === 'bands') {
      for (let i = 0; i < 52; i++) {
        const y = random() * height;
        const thickness = 4 + random() * 34;
        surface.fillStyle = i % 3 === 0 ? light : (i % 2 ? dark : mid);
        surface.globalAlpha = 0.09 + random() * 0.20;
        surface.fillRect(0, y, width, thickness);
      }
      surface.globalAlpha = 1;
    } else {
      for (let i = 0; i < 400; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 2 + random() * 36;
        surface.beginPath();
        surface.ellipse(x, y, radius, radius * (0.35 + random() * 0.45), 0, 0, Math.PI * 2);
        surface.fillStyle = i % 4 === 0 ? light : dark;
        surface.globalAlpha = 0.05 + random() * 0.25;
        surface.fill();
      }
      surface.globalAlpha = 1;
      for (let i = 0; i < 65; i++) {
        const x = random() * width, y = random() * height, r = 3 + random() * 16;
        surface.beginPath();
        surface.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
        surface.strokeStyle = light;
        surface.lineWidth = 1.2 + random() * 1.8;
        surface.globalAlpha = 0.15 + random() * 0.22;
        surface.stroke();
      }
      surface.globalAlpha = 1;
    }
    emissive.fillStyle = '#000000';
    emissive.fillRect(0, 0, width, height);
  }
  const api = Object.freeze({ paint });
  root.GodSmashTextures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
