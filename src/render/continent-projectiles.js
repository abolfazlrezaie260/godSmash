/* High-fidelity missile overlay for the close-up continental atlas.
 * Uses the SAME GodSmashProjectiles.createMissile factory as the globe game.
 * Flight timing belongs to continent-mode; this renderer only visualizes it.
 */
(function (root) {
  'use strict';

  function projectPoint(point, view, width, height) {
    if (!point || !view || !(width > 0) || !(height > 0) ||
        !(view.w > 0) || !(view.h > 0)) {
      throw new TypeError('Invalid map projection');
    }
    const scale = Math.min(width / view.w, height / view.h);
    const left = (width - view.w * scale) / 2;
    const top = (height - view.h * scale) / 2;
    return {
      x: left + (point.x - view.x) * scale,
      y: top + (point.y - view.y) * scale,
      scale
    };
  }

  function pickWrappedPoint(point, view) {
    const center = view.x + view.w / 2;
    const candidates = [-360, 0, 360, 720];
    const offset = candidates.reduce((best, value) =>
      Math.abs(point.x + value - center) <
      Math.abs(point.x + best - center) ? value : best, 0);
    return {x: point.x + offset, y: point.y, offset};
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const profileSize = Object.freeze({
    strategic: 1.05, interceptor: 0.84, cruise: 0.94,
    siege: 1.13, hypersonic: 0.86, plasma: 1,
    specter: 0.86, aurora: 1.02, phoenix: 1.12
  });

  // Screen-space size is limited by BOTH the viewport and the distance
  // between the selected countries. A short trip cannot be obscured by
  // an enormous rocket. Never rely on the tiny tangent used for heading.
  function missileDisplayLength(width, routePixels, visualProfile = 'strategic') {
    const screen = Number.isFinite(width) && width > 0 ? width : 1000;
    const screenLimit = screen * 0.038;
    const routeLimit = Number.isFinite(routePixels) && routePixels > 0
      ? Math.max(14, routePixels * 0.17) : screenLimit;
    const factor = profileSize[visualProfile] || 1;
    return clamp(Math.min(screenLimit, routeLimit) * factor, 14, 62);
  }

  function routePixelLength(route, view, width, height) {
    if (!route || !route.start || !route.end) return null;
    const start = pickWrappedPoint(route.start, view);
    const startPixel = projectPoint(start, view, width, height);
    const endPixel = projectPoint({
      x: route.end.x + start.offset, y: route.end.y
    }, view, width, height);
    return Math.hypot(endPixel.x - startPixel.x, endPixel.y - startPixel.y);
  }

  function mount(options) {
    const {canvas, svg, THREE, projectileModels, lowQuality = false} = options || {};
    if (!canvas || !svg || !THREE || !THREE.WebGLRenderer ||
        !projectileModels || typeof projectileModels.createMissile !== 'function') {
      throw new TypeError('Continental missiles require Three.js, a canvas and the projectile factory');
    }

    const renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: !lowQuality,
      powerPreference: 'high-performance', premultipliedAlpha: false
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, lowQuality ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.7;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xc4ebff, 0x384254, 1.7));
    const key = new THREE.DirectionalLight(0xfff0d5, 2.5);
    key.position.set(-100, -90, 250);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x76c9ff, 0.95);
    fill.position.set(120, 100, 150);
    scene.add(fill);

    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 2000);
    const axis = new THREE.Vector3(0, 0, 1);
    const direction = new THREE.Vector3();
    const size = {width: 0, height: 0};
    let active = false;
    const live = new Set();

    function resize() {
      const width = Math.max(1, canvas.clientWidth || svg.clientWidth || 1);
      const height = Math.max(1, canvas.clientHeight || svg.clientHeight || 1);
      if (width === size.width && height === size.height) return;
      size.width = width; size.height = height;
      renderer.setSize(width, height, false);
      // The atlas uses (0,0) in the *top-left* corner. Orthographic
      // camera space uses +Y upwards. Inverting the screen Y below and
      // anchoring the camera at (0,0) prevents the half-screen offset
      // that used to hide missiles on the western half of the map.
      camera.left = 0; camera.right = width;
      camera.top = 0; camera.bottom = -height;
      camera.position.set(0, 0, 600);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    function launch(weapon, route = null) {
      if (!weapon || weapon.kind !== 'missile') {
        throw new TypeError('The continental overlay only accepts existing missile weapons');
      }
      const model = projectileModels.createMissile(
        THREE, weapon.visualProfile || 'strategic',
        lowQuality ? 'low' : 'high', 10
      );
      // The original mesh uses +Z as its nose direction. Preserve its
      // geometry, decals and fins; only its screen-space root transform
      // changes. The actual size is calculated when the route/view is known.
      resize();
      const profileName = weapon.visualProfile || 'strategic';
      const profile = typeof projectileModels.getProfile === 'function'
        ? projectileModels.getProfile(profileName)
        : {length: 2, nose: 0.7};
      const bodyLength = Math.max(0.4, profile.length + profile.nose);
      model.group.scale.setScalar(1);
      if (model.plume && model.plume.scale) model.plume.scale.setScalar(0.52);
      model.group.visible = false;
      scene.add(model.group);
      const item = {
        model, position: null, heading: null, view: null, route,
        bodyLength, displayLength: 0, profileName
      };
      live.add(item);
      return item;
    }

    function position(item, coordinate, ahead, view) {
      if (!item || !live.has(item)) return;
      item.position = coordinate; item.heading = ahead; item.view = view;
      resize();
      const wrapped = pickWrappedPoint(coordinate, view);
      const start = projectPoint(wrapped, view, size.width, size.height);
      const end = projectPoint({
        x: ahead.x + wrapped.offset, y: ahead.y
      }, view, size.width, size.height);
      // Recalculate size while zooming, using the entire country-to-country
      // flight instead of the tiny tangent segment used for orientation.
      const routePixels = routePixelLength(item.route, view, size.width, size.height);
      item.displayLength = missileDisplayLength(size.width, routePixels, item.profileName);
      item.model.group.scale.setScalar(item.displayLength / item.bodyLength);
      item.model.group.position.set(start.x, -start.y, 85);

      const dx = end.x - start.x, dy = end.y - start.y;
      const headingLength = Math.hypot(dx, dy);
      if (headingLength > 0.01) {
        // A rocket's nose is +Z in createMissile. Set that axis to the
        // direction of travel in the map plane, with a subtle pitch toward
        // the viewer. Roll about LOCAL +Z, never rotateY: rotating Y after
        // alignment would steer the nose away from the drawn flight path.
        const elevation = 0.21;
        const normalizer = Math.hypot(dx, dy, elevation * headingLength);
        direction.set(dx / normalizer, -dy / normalizer,
          elevation * headingLength / normalizer);
        item.model.group.quaternion.setFromUnitVectors(axis, direction);
        item.model.group.rotateZ(0.16);
      }
      const margin = item.displayLength;
      item.model.group.visible =
        start.x >= -margin && start.x <= size.width + margin &&
        start.y >= -margin && start.y <= size.height + margin;
    }

    function refreshView(view) {
      resize();
      for (const item of live) {
        if (item.position && item.heading) position(item, item.position, item.heading, view);
      }
    }

    function remove(item) {
      if (!item || !live.has(item)) return;
      live.delete(item);
      scene.remove(item.model.group);
      item.model.dispose();
    }

    function clear() {
      for (const item of Array.from(live)) remove(item);
    }

    function render() {
      if (!active) return;
      resize();
      renderer.render(scene, camera);
    }

    function setActive(value) {
      active = !!value;
      canvas.hidden = !active;
      if (!active) clear();
      else resize();
    }

    function dispose() {
      clear();
      renderer.dispose();
      active = false;
    }

    const api = Object.freeze({
      launch, position, remove, clear, render, refreshView,
      setActive, resize, dispose,
      getActiveCount: () => live.size
    });

    if (root.ResizeObserver) {
      new root.ResizeObserver(() => { if (active) resize(); }).observe(canvas);
    }
    canvas.hidden = true;
    return api;
  }

  const api = Object.freeze({
    mount, projectPoint, pickWrappedPoint,
    missileDisplayLength, routePixelLength
  });
  root.GodSmashContinentProjectiles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
