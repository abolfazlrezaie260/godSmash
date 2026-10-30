/* Continent selector lives inside the existing planet modal; the country
 * route controls remain visible during Earth gameplay. No external map service.
 */
(function (root) {
  'use strict';

  function mount(options) {
    const {geography, continentContainer, panel, fromSelect, toSelect,
      continentLabel, routeSummary, launchButton, onChoose, onRoute, onLaunch} = options || {};
    if (!geography || !continentContainer || !panel || !fromSelect || !toSelect ||
        !continentLabel || !routeSummary || !launchButton ||
        typeof onChoose !== 'function' || typeof onRoute !== 'function' ||
        typeof onLaunch !== 'function') {
      throw new TypeError('Continent mode requires the controls and callbacks');
    }
    const doc = continentContainer.ownerDocument;
    let continentId = null;
    let currentRoute = null;
    const buttons = new Map();

    function fillSelect(select, countries, selectedId) {
      select.replaceChildren();
      for (const country of countries) {
        const item = doc.createElement('option');
        item.value = country.id;
        item.textContent = country.nameFa;
        select.appendChild(item);
      }
      select.value = selectedId;
    }
    function syncRoute(changed) {
      if (!continentId) return;
      if (fromSelect.value === toSelect.value) {
        const continent = geography.getContinent(continentId);
        const alternative = continent.countries.find(c =>
          c.id !== (changed === 'from' ? fromSelect.value : toSelect.value));
        if (changed === 'from') toSelect.value = alternative.id;
        else fromSelect.value = alternative.id;
      }
      currentRoute = geography.createRoute(continentId,fromSelect.value,toSelect.value);
      routeSummary.textContent =
        'از ' + currentRoute.source.nameFa + ' به ' + currentRoute.destination.nameFa +
        ' | موشک را از فهرست سلاح‌ها انتخاب کنید';
      onRoute(currentRoute);
    }
    function setContinent(id) {
      const continent = geography.getContinent(id);
      if (!continent || continent.countries.length < 2) return false;
      continentId = id;
      panel.hidden = false;
      continentLabel.textContent = 'حالت کشورها · ' + continent.nameFa;
      buttons.forEach((button,key)=>{
        button.setAttribute('aria-pressed',String(key===id));
        button.classList.toggle('is-selected',key===id);
      });
      const defaults = id==='asia' ? ['ir','iq'] :
        [continent.countries[0].id,continent.countries[1].id];
      fillSelect(fromSelect,continent.countries,defaults[0]);
      fillSelect(toSelect,continent.countries,defaults[1]);
      syncRoute();
      return true;
    }
    function clear() {
      continentId = null;
      currentRoute = null;
      panel.hidden = true;
      buttons.forEach(button=>{
        button.setAttribute('aria-pressed','false');
        button.classList.remove('is-selected');
      });
      onRoute(null);
    }
    for (const continent of geography.listContinents()) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'continent-choice';
      button.dataset.continentId = continent.id;
      button.setAttribute('aria-pressed','false');
      button.textContent = continent.nameFa;
      button.title = 'انتخاب کشورهای ' + continent.nameFa;
      button.addEventListener('click',()=>onChoose(continent.id));
      continentContainer.appendChild(button);
      buttons.set(continent.id,button);
    }
    fromSelect.addEventListener('change',()=>syncRoute('from'));
    toSelect.addEventListener('change',()=>syncRoute('to'));
    launchButton.addEventListener('click',()=>{
      if (currentRoute) onLaunch(currentRoute);
    });
    panel.hidden = true;
    return Object.freeze({
      setContinent, clear,
      getRoute:()=>currentRoute,
      getContinent:()=>continentId
    });
  }

  const api=Object.freeze({mount});
  root.GodSmashContinentMode=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
