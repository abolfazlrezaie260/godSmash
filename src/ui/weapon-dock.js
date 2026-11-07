/* Accessible weapon inventory with category filters and a compact tactical view.
 * The complete catalog remains the single source of truth for weapon selection.
 */
(function (root) {
  'use strict';

  function mount({ container, weapons, selectedId, onChange }) {
    if (!container || !Array.isArray(weapons) || !weapons.length ||
        typeof onChange !== 'function') {
      throw new TypeError('Weapon dock requires a container, weapon list and onChange callback');
    }
    const doc = container.ownerDocument || document;
    const dock = container.parentElement;
    const filters = Array.from(dock ? dock.querySelectorAll('.weapon-filter-button') : []);
    const collapseButton = dock && dock.querySelector('.weapon-dock-collapse');
    const equippedLabel = dock && dock.querySelector('#equipped-weapon-label');
    const buttons = new Map();
    const handlers = [];
    let currentId = null;
    let currentFilter = 'all';
    let collapsed = false;

    function categoryOf(entry) {
      return entry.kind === 'missile' ? 'missile' : 'special';
    }
    function isVisible(entry) {
      return currentFilter === 'all' || categoryOf(entry) === currentFilter;
    }
    function refreshTabsAndItems() {
      const visible = weapons.filter(isVisible);
      const keyboardTarget = visible.some(entry => entry.id === currentId) ?
        currentId : (visible[0] && visible[0].id);
      weapons.forEach(entry => {
        const button = buttons.get(entry.id);
        if (!button) return;
        button.hidden = !isVisible(entry);
        button.tabIndex = button.hidden ? -1 : (entry.id === keyboardTarget ? 0 : -1);
      });
      filters.forEach(button => {
        const active = button.dataset.filter === currentFilter;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active', active);
      });
    }
    function setFilter(filter) {
      if (!['all', 'missile', 'special'].includes(filter)) return false;
      currentFilter = filter;
      refreshTabsAndItems();
      return true;
    }
    function setSelected(id) {
      if (!buttons.has(id)) return false;
      currentId = id;
      const entry = weapons.find(item => item.id === id);
      buttons.forEach((button, key) => {
        const active = key === id;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (entry && equippedLabel) equippedLabel.textContent = 'انتخاب‌شده: ' + entry.nameFa;
      if (entry && !isVisible(entry)) setFilter(categoryOf(entry));
      else refreshTabsAndItems();
      return true;
    }
    function setCollapsed(value) {
      collapsed = Boolean(value);
      if (dock) dock.classList.toggle('is-collapsed', collapsed);
      if (collapseButton) {
        collapseButton.setAttribute('aria-expanded', String(!collapsed));
        collapseButton.setAttribute('aria-label', collapsed ? 'نمایش فهرست سلاح‌ها' : 'جمع کردن فهرست سلاح‌ها');
        collapseButton.title = collapsed ? 'باز کردن تجهیزات' : 'جمع کردن تجهیزات';
      }
      return collapsed;
    }
    function activate(id, focus) {
      if (!buttons.has(id)) return false;
      // The game may reject a weapon in a restricted mode. Do not visually
      // select a weapon until the game has accepted the selection.
      const accepted = onChange(id);
      if (accepted === false) return false;
      setSelected(id);
      if (collapsed) setCollapsed(false);
      if (focus) buttons.get(id).focus();
      return true;
    }
    function moveSelection(event, id) {
      const visible = weapons.filter(isVisible);
      const index = visible.findIndex(entry => entry.id === id);
      if (index < 0 || !visible.length) return;
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = visible.length - 1;
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % visible.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + visible.length - 1) % visible.length;
      else return;
      event.preventDefault();
      activate(visible[next].id, true);
    }

    for (const [index, entry] of weapons.entries()) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'weapon-dock-button';
      button.dataset.weaponId = entry.id;
      button.setAttribute('aria-label', 'انتخاب ' + entry.nameFa + (entry.subtitle ? '، ' + entry.subtitle : ''));
      button.title = entry.nameFa + (index < 9 ? ' · کلید ' + (index + 1) : ' · انتخاب با کلیک');

      const symbol = doc.createElement('span');
      symbol.className = 'weapon-dock-icon';
      symbol.textContent = entry.icon || '●';
      symbol.setAttribute('aria-hidden', 'true');
      const copy = doc.createElement('span');
      copy.className = 'weapon-dock-copy';
      const name = doc.createElement('span');
      name.className = 'weapon-dock-name';
      name.textContent = entry.nameFa;
      const detail = doc.createElement('span');
      detail.className = 'weapon-dock-detail';
      detail.textContent = entry.subtitle || '';
      copy.append(name, detail);
      const shorthand = doc.createElement('span');
      shorthand.className = 'weapon-dock-short';
      shorthand.textContent = entry.shortLabel || entry.nameFa;
      shorthand.setAttribute('aria-hidden', 'true');
      const keyHint = doc.createElement('span');
      keyHint.className = 'weapon-dock-key';
      keyHint.textContent = index < 9 ? String(index + 1) : '⋯';
      keyHint.setAttribute('aria-hidden', 'true');
      button.append(symbol, copy, shorthand, keyHint);

      const click = () => activate(entry.id, false);
      const keydown = event => moveSelection(event, entry.id);
      button.addEventListener('click', click);
      button.addEventListener('keydown', keydown);
      handlers.push([button, 'click', click], [button, 'keydown', keydown]);
      container.appendChild(button);
      buttons.set(entry.id, button);
    }

    filters.forEach(filterButton => {
      const onClick = () => setFilter(filterButton.dataset.filter);
      filterButton.addEventListener('click', onClick);
      handlers.push([filterButton, 'click', onClick]);
    });
    if (collapseButton) {
      const onClick = () => setCollapsed(!collapsed);
      collapseButton.addEventListener('click', onClick);
      handlers.push([collapseButton, 'click', onClick]);
    }
    if (!setSelected(selectedId)) setSelected(weapons[0].id);
    setCollapsed(false);

    return Object.freeze({
      setSelected, setFilter, getFilter: () => currentFilter,
      getSelected: () => currentId, setCollapsed,
      selectAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= weapons.length) return false;
        return activate(weapons[index].id, false);
      },
      destroy() {
        handlers.forEach(([node, type, fn]) => node.removeEventListener(type, fn));
        buttons.forEach(button => button.remove());
        buttons.clear();
      }
    });
  }

  root.GodSmashWeaponDock = Object.freeze({ mount });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashWeaponDock;
})(typeof window !== 'undefined' ? window : globalThis);
