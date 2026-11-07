/* Foreground/background and Android Back integration for Capacitor.
 * Bridges native App events when available, with browser page visibility as a
 * safe fallback. It owns no rendering or app state.
 */
(function (root) {
  'use strict';

  function mount(options) {
    const {view, document: doc, onActive, onBack} = options || {};
    if (!view || !doc || typeof onActive !== 'function' || typeof onBack !== 'function') {
      throw new TypeError('App lifecycle requires view, document and callbacks');
    }
    const app = options.app === undefined ? view.Capacitor?.Plugins?.App : options.app;
    const handles = [];
    let active = !doc.hidden;
    let destroyed = false;

    function setActive(value) {
      if (destroyed || active === Boolean(value)) return;
      active = Boolean(value);
      onActive(active);
    }
    function onVisibility() { setActive(!doc.hidden); }
    function onPageHide() { setActive(false); }
    function onPageShow() { setActive(!doc.hidden); }
    function onNativeState(value) { setActive(!!value?.isActive); }
    function onNativeBack() { if (!destroyed) onBack(); }

    doc.addEventListener('visibilitychange',onVisibility);
    view.addEventListener('pagehide',onPageHide);
    view.addEventListener('pageshow',onPageShow);

    function nativeListen(name, callback) {
      if (!app || typeof app.addListener !== 'function') return;
      try {
        Promise.resolve(app.addListener(name,callback)).then(handle => {
          if (!handle || typeof handle.remove !== 'function') return;
          if (destroyed) Promise.resolve(handle.remove()).catch(() => {});
          else handles.push(handle);
        }).catch(() => {
          // The browser fallback is still active if plugin registration fails.
        });
      } catch (error) {
        // Unsupported native bridge must not prevent startup.
      }
    }
    nativeListen('appStateChange',onNativeState);
    nativeListen('backButton',onNativeBack);

    return Object.freeze({
      isActive:()=>active,
      destroy(){
        if (destroyed) return;
        destroyed = true;
        doc.removeEventListener('visibilitychange',onVisibility);
        view.removeEventListener('pagehide',onPageHide);
        view.removeEventListener('pageshow',onPageShow);
        handles.forEach(handle=>Promise.resolve(handle.remove()).catch(()=>{}));
        handles.length = 0;
      }
    });
  }

  const api = Object.freeze({mount});
  root.GodSmashAppLifecycle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
