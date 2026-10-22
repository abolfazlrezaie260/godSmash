/* Static, accessible weapon dock. Content comes only from the catalog.
 * No coupling to Three.js, planet state or explosion behavior.
 */
(function (root) {
  'use strict';

  function mount({ container, weapons, selectedId, onChange }) {
    if (!container || !Array.isArray(weapons) || weapons.length === 0 ||
        typeof onChange !== 'function') {
      throw new TypeError('Weapon dock requires a container, weapon list and onChange callback');
    }
    const documentRef = container.ownerDocument || document;
    const buttons = new Map();
    let currentId = null;

    function setSelected(id) {
      if (!buttons.has(id)) return false;
      currentId = id;
      buttons.forEach((button, key) => {
        const active = key === id;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      return true;
    }

    function activate(id, focus) {
      if (!setSelected(id)) return;
      if (focus) buttons.get(id).focus();
      onChange(id);
    }

    function moveSelection(event, index) {
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = weapons.length - 1;
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % weapons.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + weapons.length - 1) % weapons.length;
      else return;
      event.preventDefault();
      activate(weapons[next].id, true);
    }

    // Build as DOM nodes, not HTML strings; newly registered weapon text is safe.
    for (const [index, entry] of weapons.entries()) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'weapon-dock-button';
      button.dataset.weaponId = entry.id;
      button.setAttribute('aria-label', 'انتخاب ' + entry.nameFa + (entry.subtitle ? '، ' + entry.subtitle : ''));
      button.title = entry.nameFa + ' (' + (index + 1) + ')';
      const symbol = documentRef.createElement('span');
      symbol.className = 'weapon-dock-icon';
      symbol.textContent = entry.icon || '●';
      symbol.setAttribute('aria-hidden', 'true');
      const copy = documentRef.createElement('span');
      copy.className = 'weapon-dock-copy';
      const name = documentRef.createElement('span');
      name.className = 'weapon-dock-name';
      name.textContent = entry.nameFa;
      const detail = documentRef.createElement('span');
      detail.className = 'weapon-dock-detail';
      detail.textContent = entry.subtitle || '';
      copy.append(name, detail);
      const shorthand = documentRef.createElement('span');
      shorthand.className = 'weapon-dock-short';
      shorthand.textContent = entry.shortLabel || entry.nameFa;
      shorthand.setAttribute('aria-hidden', 'true');
      const keyHint = documentRef.createElement('span');
      keyHint.className = 'weapon-dock-key';
      keyHint.textContent = String(index + 1);
      keyHint.setAttribute('aria-hidden', 'true');
      button.append(symbol, copy, shorthand, keyHint);
      button.addEventListener('click', () => activate(entry.id, false));
      button.addEventListener('keydown', event => moveSelection(event, index));
      container.appendChild(button);
      buttons.set(entry.id, button);
    }
    if (!setSelected(selectedId)) setSelected(weapons[0].id);

    return Object.freeze({
      setSelected,
      getSelected: () => currentId,
      selectAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= weapons.length) return false;
        activate(weapons[index].id, false);
        return true;
      },
      destroy() {
        buttons.forEach(button => button.remove());
        buttons.clear();
      }
    });
  }

  root.GodSmashWeaponDock = Object.freeze({ mount });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashWeaponDock;
})(typeof window !== 'undefined' ? window : globalThis);
