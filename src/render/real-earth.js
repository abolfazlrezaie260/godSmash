/* Local photographic Earth assets for the original canvas crater engine.
 * All image bytes are committed inside assets/textures/earth for GitHub Pages
 * and offline Android/WebView builds. No image CDN or cross-origin dependency.
 */
(function (root) {
  'use strict';

  const BASE = './assets/textures/earth/';
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
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load Earth texture: ' + filename));
      image.src = BASE + filename;
    });
  }

  function preload() {
    if (pictures) return Promise.resolve(pictures);
    if (!ongoing) {
      // Require every locally vendored map: never swap to a partially stylized Earth.
      ongoing = Promise.all(Object.entries(files).map(async ([key, file]) => {
        return [key, await loadImage(file)];
      })).then(results => {
        pictures = Object.fromEntries(results);
        return pictures;
      }).catch(error => {
        ongoing = null; // Retry button can reload missing files without reloading the page.
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

    // City lights are rendered by a separate night-side shader layer.
    // Keeping them out of this canvas lets impact magma stay visible in daylight.
    emissiveCtx.fillStyle = '#000000';
    emissiveCtx.fillRect(0, 0, width, height);
    return true;
  }

  function makeTexture(THREE, image) {
    const texture = new THREE.Texture(image);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  // City lights are a separate transparent layer, masked to the dark hemisphere.
  // The sun direction is world-space so planetary rotation naturally changes the terminator.
  function createNightLightLayer(THREE) {
    if (!isReady() || !pictures.night) throw new Error('Earth night-light map is not ready');
    const texture = makeTexture(THREE, pictures.night);
    if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uNightMap: {value: texture},
        uSunDirectionWorld: {value: new THREE.Vector3(1, 0, 0)},
        uOpacity: {value: 1.0}
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uNightMap;
        uniform vec3 uSunDirectionWorld;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vec3 mapColor = texture2D(uNightMap, vUv).rgb;
          float luminance = max(mapColor.r, max(mapColor.g, mapColor.b));
          float nightSide = 1.0 - smoothstep(-0.10, 0.20,
            dot(normalize(vWorldNormal), normalize(uSunDirectionWorld)));
          float cityMask = smoothstep(0.025, 0.22, luminance) * luminance;
          float alpha = nightSide * cityMask * uOpacity;
          vec3 warmCityLight = vec3(1.0, 0.64, 0.31) * min(1.6, luminance * 1.8);
          gl_FragColor = vec4(warmCityLight, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return Object.freeze({
      material,
      updateSunDirection(direction) {
        material.uniforms.uSunDirectionWorld.value.copy(direction).normalize();
      },
      dispose() {
        material.dispose();
        texture.dispose();
      }
    });
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

  root.GodSmashRealEarth = Object.freeze({ preload, isReady, paint, configure, createNightLightLayer, files });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashRealEarth;
})(typeof window !== 'undefined' ? window : globalThis);
