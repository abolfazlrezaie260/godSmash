/* Mobile-first planet picker. Uses the same local Earth image and procedural
 * surface generator as the game, without loading any third-party preview assets.
 */
(function (root) {
  'use strict';

  function mount(options) {
    const {modal, container, trigger, closeButton, planets, selectedId, onSelect, textures} = options || {};
    if (!modal || !container || !trigger || !closeButton ||
        !Array.isArray(planets) || !planets.length || typeof onSelect !== 'function') {
      throw new TypeError('Planet picker requires modal, controls, planets and onSelect');
    }
    const doc = modal.ownerDocument;
    const choices = new Map();
    let active = null;
    let returnFocus = trigger;

    function imageFor(planet) {
      if (planet.id === 'earth') {
        return 'url("./assets/textures/earth/earth_atmos_4096.jpg")';
      }
      if (textures && typeof textures.paint === 'function') {
        try {
          const canvas = doc.createElement('canvas');
          canvas.width = 320;
          canvas.height = 160;
          const surface = canvas.getContext('2d');
          const empty = doc.createElement('canvas').getContext('2d');
          if (surface && empty) {
            textures.paint(planet, surface, empty, canvas.width, canvas.height);
            return 'url("' + canvas.toDataURL('image/png') + '")';
          }
        } catch (error) {
          // A CSS fallback is still usable on devices without 2D canvas.
        }
      }
      return 'linear-gradient(115deg,' + planet.palette.join(',') + ')';
    }

    function syncSelected(id) {
      if (!choices.has(id)) return false;
      active = id;
      choices.forEach((button, key) => {
        const chosen = key === id;
        button.setAttribute('aria-pressed', String(chosen));
        button.classList.toggle('is-selected', chosen);
      });
      trigger.setAttribute('aria-label', 'انتخاب سیاره، ' +
        (planets.find(p => p.id === id) || planets[0]).nameFa);
      return true;
    }

    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      returnFocus.focus();
    }
    function open() {
      returnFocus = doc.activeElement || trigger;
      modal.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const chosen = choices.get(active);
      (chosen || closeButton).focus();
    }

    for (const planet of planets) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'planet-choice';
      button.dataset.planetId = planet.id;
      button.setAttribute('aria-pressed','false');
      const preview = doc.createElement('span');
      preview.className = 'planet-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.style.backgroundImage = imageFor(planet);
      const caption = doc.createElement('span');
      caption.className = 'planet-choice-copy';
      const title = doc.createElement('strong');
      title.textContent = planet.nameFa;
      const english = doc.createElement('span');
      english.className = 'planet-english';
      english.textContent = planet.nameEn;
      const description = doc.createElement('small');
      description.textContent = planet.descriptionFa || (
        planet.cloudOpacity > 0 ? 'دارای جو و پوشش ابری' : 'سطح سنگی و بدون ابر'
      );
      caption.append(title, english, description);
      const marker = doc.createElement('span');
      marker.className = 'planet-choice-check';
      marker.textContent = '✓';
      marker.setAttribute('aria-hidden', 'true');
      button.append(preview, caption, marker);
      button.addEventListener('click', () => {
        if (planet.id !== active) onSelect(planet.id);
        syncSelected(planet.id);
        close();
      });
      container.appendChild(button);
      choices.set(planet.id, button);
    }

    if (!syncSelected(selectedId)) syncSelected(planets[0].id);
    trigger.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const ordered = [closeButton, ...choices.values()];
      const first = ordered[0], last = ordered[ordered.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    return Object.freeze({open, close, setSelected:syncSelected, getSelected:()=>active});
  }

  const api = Object.freeze({mount});
  root.GodSmashPlanetPicker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
