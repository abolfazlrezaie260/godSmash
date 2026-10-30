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
    // Visual display size is expressed in device-independent CSS pixels.
    // Unlike the planet model's tiny orbital scale, an aerial missile should
    // remain legible on a dense high-DPI map at any continent zoom.
    function missileDisplayLength(width) {
      if (!Number.isFinite(width) || width <= 0) return 100;
      return Math.max(82, Math.min(148, width * 0.093));
    }
    const live = new Set();

    function resize() {
      const width = Math.max(1, canvas.clientWidth || svg.clientWidth || 1);
      const height = Math.max(1, canvas.clientHeight || svg.clientHeight || 1);
      if (width === size.width && height === size.height) return;
      size.width = width; size.height = height;
      renderer.setSize(width, height, false);
      camera.left = 0; camera.right = width;
      camera.top = 0; camera.bottom = height;
      camera.position.set(width / 2, height / 2, 600);
      camera.lookAt(width / 2, height / 2, 0);
      camera.updateProjectionMatrix();
    }

    function launch(weapon) {
      if (!weapon || weapon.kind !== 'missile') {
        throw new TypeError('The continental overlay only accepts existing missile weapons');
      }
      const model = projectileModels.createMissile(
        THREE, weapon.visualProfile || 'strategic',
        lowQuality ? 'low' : 'high', 10
      );
      // Use the native model's *actual body dimensions* for a predictable
      // 82–148 CSS-pixel silhouette, rather than multiplying the orbital
      // scale by a constant (which made it nearly invisible on the map).
      resize();
      const profile = typeof projectileModels.getProfile === 'function'
        ? projectileModels.getProfile(weapon.visualProfile || 'strategic')
        : {length: 2, nose: 0.7};
      const bodyLength = Math.max(0.4, profile.length + profile.nose);
      const displayLength = missileDisplayLength(size.width);
      model.group.scale.setScalar(displayLength / bodyLength);
      // Keep recognizable fins, nose, labels and steel materials. Shorten
      // the original very long exhaust for a cleaner aerial silhouette.
      if (model.plume && model.plume.scale) model.plume.scale.setScalar(0.67);
      model.group.visible = false;
      scene.add(model.group);
      const item = {model, position: null, heading: null, view: null, bodyLength, displayLength};
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
      // Keep the solid missile above the image plane and glow trail.
      item.model.group.position.set(start.x, start.y, 85);
      const dx = end.x - start.x, dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length > 0.01) {
        direction.set(dx / length, dy / length, 0);
        item.model.group.quaternion.setFromUnitVectors(axis, direction);
        // Three-quarter bank reveals the actual body panels, wings and fins
        // rather than displaying a nearly edge-on cylinder.
        item.model.group.rotateY(0.48);
      }
      item.model.group.visible =
        start.x >= -90 && start.x <= size.width + 90 &&
        start.y >= -90 && start.y <= size.height + 90;
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

  const api = Object.freeze({mount, projectPoint, pickWrappedPoint});
  root.GodSmashContinentProjectiles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
