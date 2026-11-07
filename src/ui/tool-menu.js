/* A small accessible utility menu, independent from the Three.js scene. */
(function (root) {
  'use strict';

  function mount(options) {
    const doc = options && options.document;
    const menu = options && options.menu;
    const trigger = options && options.trigger;
    const panel = options && options.panel;
    if (!doc || !menu || !trigger || !panel) {
      throw new TypeError('Tool menu requires a document, menu, trigger and panel');
    }

    let expanded = false;
    function setOpen(value, returnFocus) {
      expanded = Boolean(value);
      panel.hidden = !expanded;
      trigger.setAttribute('aria-expanded', String(expanded));
      if (!expanded && returnFocus) trigger.focus();
    }
    function toggle() { setOpen(!expanded, false); }
    function outside(event) {
      if (expanded && !menu.contains(event.target)) setOpen(false, false);
    }
    function escape(event) {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        setOpen(false, true);
      }
    }
    function dismissOnAction(event) {
      const button = event.target.closest && event.target.closest('button');
      if (button && panel.contains(button)) setOpen(false, false);
    }

    trigger.addEventListener('click', toggle);
    doc.addEventListener('pointerdown', outside);
    doc.addEventListener('keydown', escape);
    panel.addEventListener('click', dismissOnAction);
    setOpen(false, false);
    return Object.freeze({
      open: () => setOpen(true, false),
      close: () => setOpen(false, false),
      destroy() {
        trigger.removeEventListener('click', toggle);
        doc.removeEventListener('pointerdown', outside);
        doc.removeEventListener('keydown', escape);
        panel.removeEventListener('click', dismissOnAction);
      }
    });
  }

  root.GodSmashToolMenu = Object.freeze({ mount });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashToolMenu;

  // The markup is already present when this script loads at the end of body.
  if (root.document && root.document.getElementById('utility-menu')) {
    mount({
      document: root.document,
      menu: root.document.getElementById('utility-menu'),
      trigger: root.document.getElementById('btn-tools'),
      panel: root.document.getElementById('utility-panel')
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
