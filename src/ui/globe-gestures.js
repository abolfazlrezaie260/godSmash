/* GodSmash globe pointer gestures: one-finger drag, two-finger pinch, tap.
 * Independent from rendering and weapons; pointer input is always in screen
 * coordinates and the game decides how to map deltas to rotated web viewports.
 */
(function (root) {
  'use strict';
  function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
  function mount(options) {
    const {target, moveTarget, onDrag, onPinch, onTap} = options || {};
    if (!target || !moveTarget || typeof onDrag !== 'function' ||
        typeof onPinch !== 'function' || typeof onTap !== 'function')
      throw new TypeError('Globe gestures require target, moveTarget and callbacks');
    const now = typeof options.now === 'function' ? options.now : () => performance.now();
    const threshold = Number.isFinite(options.dragThreshold) ? options.dragThreshold : 9;
    const maxTapDuration = Number.isFinite(options.tapDuration) ? options.tapDuration : 450;
    const points = new Map();
    let original = null;
    let firstId = null;
    let dragged = false;
    let multitouch = false;
    let disposed = false;

    function firstPair() {
      const a = points.values();
      return [a.next().value,a.next().value];
    }
    function reset() {
      points.clear();
      firstId = null;
      original = null;
      dragged = false;
      multitouch = false;
    }
    function down(event) {
      if (disposed || event.pointerType === 'mouse' && event.button !== 0 ||
          points.has(event.pointerId)) return;
      const p = { x: event.clientX, y: event.clientY };
      points.set(event.pointerId,p);
      if (points.size === 1) {
        original = { ...p, t: now() };
        firstId = event.pointerId;
        dragged = false;
        multitouch = false;
      } else {
        multitouch = true;
      }
      if (event.pointerType !== 'mouse' && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }
    function move(event) {
      const p = points.get(event.pointerId);
      if (!p || disposed) return;
      const next = { x:event.clientX, y:event.clientY };
      if (points.size >= 2) {
        const before = firstPair();
        const oldDistance = distance(before[0],before[1]);
        points.set(event.pointerId,next);
        const after = firstPair();
        const newDistance = distance(after[0],after[1]);
        multitouch = true;
        if (oldDistance > 0 && newDistance > 0) {
          const scale = newDistance / oldDistance;
          if (Number.isFinite(scale) && scale > 0) onPinch(scale);
        }
        return;
      }
      points.set(event.pointerId,next);
      if (original && distance(next,original) >= threshold) dragged = true;
      if (dragged && !multitouch) onDrag(next.x-p.x,next.y-p.y);
    }
    function up(event, cancelled) {
      const p = points.get(event.pointerId);
      if (!p || disposed) return;
      const next = { x:event.clientX,y:event.clientY };
      const endedSingle = points.size === 1 && event.pointerId === firstId;
      const duration = original ? now()-original.t : Infinity;
      const moved = original ? distance(next,original) : Infinity;
      points.delete(event.pointerId);
      if (points.size === 0) {
        if (!cancelled && endedSingle && !multitouch && !dragged &&
            moved < threshold && duration >= 0 && duration < maxTapDuration &&
            event.target === target) onTap(next.x,next.y);
        reset();
      } else {
        multitouch = true; // No tap or one-finger drag after a pinch until released.
      }
    }
    function onUp(event) { up(event,false); }
    function onCancel(event) { up(event,true); }
    target.addEventListener('pointerdown',down);
    moveTarget.addEventListener('pointermove',move);
    moveTarget.addEventListener('pointerup',onUp);
    moveTarget.addEventListener('pointercancel',onCancel);
    return Object.freeze({
      activePointers: () => points.size,
      destroy() {
        if (disposed) return;
        disposed = true;
        target.removeEventListener('pointerdown',down);
        moveTarget.removeEventListener('pointermove',move);
        moveTarget.removeEventListener('pointerup',onUp);
        moveTarget.removeEventListener('pointercancel',onCancel);
        reset();
      }
    });
  }
  const api = Object.freeze({ mount });
  root.GodSmashGlobeGestures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
