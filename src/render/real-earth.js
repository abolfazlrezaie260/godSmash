/* Photographic Earth assets for the existing canvas-based crater engine.
 * Public URLs are version-pinned to the Three.js r128 example textures.
 * Failed network loads leave the original procedural Earth playable.
 */
(function (root) {
  'use strict';

  const BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/';
  const files = Object.freeze({
    day: 'earth_atmos_4096.jpg',
    night: 'earth_lights_2048.png',
    clouds: 'earth_clouds_1024.png',
    normal: 'earth_normal_2048.jpg',
    specular: 'earth_specular_2048.jpg'
  });

  let pictures = null;
  let ongoing = null;
  let detailMaps = null;

  function loadImage(filename) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous'; // Required before src for safe canvas painting
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load Earth texture: ' + filename));
      image.src = BASE + filename;
    });
  }

  function preload() {
    if (pictures) return Promise.resolve(pictures);
    if (!ongoing) {
      ongoing = Promise.allSettled(Object.entries(files).map(async ([key, file]) =>
        [key, await loadImage(file)]
      )).then(results => {
        const loaded = {};
        for (const item of results) {
          if (item.status === 'fulfilled') {
            loaded[item.value[0]] = item.value[1];
          }
        }
        if (!loaded.day) {
          throw new Error('Earth day map unavailable; procedural fallback remains active');
        }
        pictures = loaded;
        return pictures;
      }).catch(error => {
        ongoing = null; // Explicit retry is possible after temporary outages
        throw error;
      });
    }
    return ongoing;
  }

  function isReady() {
    return !!(pictures && pictures.day);
  }

  // Keeps crater/scorch/lava painting in the existing engine unchanged.
  function paint(surfaceCtx, emissiveCtx, width, height) {
    if (!isReady()) return false;
    surfaceCtx.clearRect(0, 0, width, height);
    surfaceCtx.drawImage(pictures.day, 0, 0, width, height);

    emissiveCtx.fillStyle = '#000000';
    emissiveCtx.fillRect(0, 0, width, height);
    if (pictures.night) emissiveCtx.drawImage(pictures.night, 0, 0, width, height);
    return true;
  }

  function makeTexture(THREE, image) {
    const texture = new THREE.Texture(image);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  // The Three.js sample specular texture marks reflective ocean regions.
  // Convert it to inverse roughness to make water glossy, terrain matte.
  function buildRoughness(THREE, image) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixelData.data.length; i += 4) {
      const luminance = (
        pixelData.data[i] * 0.2126 +
        pixelData.data[i + 1] * 0.7152 +
        pixelData.data[i + 2] * 0.0722
      ) / 255;
      const value = Math.round(245 - 175 * luminance);
      pixelData.data[i] = value;
      pixelData.data[i + 1] = value;
      pixelData.data[i + 2] = value;
      pixelData.data[i + 3] = 255;
    }
    ctx.putImageData(pixelData, 0, 0);
    return new THREE.CanvasTexture(canvas);
  }

  function configure(THREE, surfaceMaterial, cloudMaterial, fallbackCloudMap, isEarth) {
    if (isEarth && isReady() && !detailMaps) {
      detailMaps = {
        normal: pictures.normal ? makeTexture(THREE, pictures.normal) : null,
        clouds: pictures.clouds ? makeTexture(THREE, pictures.clouds) : null,
        roughness: null
      };
      if (pictures.specular) {
        try { detailMaps.roughness = buildRoughness(THREE, pictures.specular); }
        catch (error) { console.warn('Optional Earth ocean gloss unavailable', error); }
      }
    }
    const enabled = isEarth && isReady();
    surfaceMaterial.normalMap = enabled ? detailMaps.normal : null;
    surfaceMaterial.roughnessMap = enabled ? detailMaps.roughness : null;
    surfaceMaterial.normalScale.set(0.38, 0.38);
    surfaceMaterial.roughness = enabled ? 0.95 : 0.68;
    surfaceMaterial.metalness = enabled ? 0.0 : 0.12;
    surfaceMaterial.emissiveIntensity = enabled ? 0.8 : 1.35;
    surfaceMaterial.needsUpdate = true;

    cloudMaterial.map = enabled && detailMaps.clouds ? detailMaps.clouds : fallbackCloudMap;
    cloudMaterial.needsUpdate = true;
  }

  root.GodSmashRealEarth = Object.freeze({ preload, isReady, paint, configure, files });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashRealEarth;
})(typeof window !== 'undefined' ? window : globalThis);
