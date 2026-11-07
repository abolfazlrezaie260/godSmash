/* GodSmash mission scoring and browser-local personal records.
 * Real visible play-time is counted from the first actual attack to rupture.
 * The controls' simulation-speed setting does not multiply elapsed scoring time.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'godsmash:scores:v1';
  const BASE_POINTS = Object.freeze({earth:1400,mars:1200,venus:1600,moon:1000});
  const MAX_HISTORY = 20;
  const validNumber = (value, fallback = 0) =>
    Number.isFinite(value) && value >= 0 ? value : fallback;

  function emptyRun() {
    return {active:false,completed:false,elapsedSeconds:0,launches:0,
      impacts:0,interceptions:0,weapons:new Map()};
  }
  function readRecords(storage) {
    const empty = {totalScore:0,completions:0,bestByPlanet:{},history:[]};
    if (!storage) return empty;
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
      empty.totalScore = validNumber(parsed.totalScore);
      empty.completions = validNumber(parsed.completions);
      if (parsed.bestByPlanet && typeof parsed.bestByPlanet === 'object' &&
          !Array.isArray(parsed.bestByPlanet)) {
        for (const id of Object.keys(BASE_POINTS)) {
          const record = parsed.bestByPlanet[id];
          if (record && Number.isFinite(record.score) && record.score > 0)
            empty.bestByPlanet[id] = record;
        }
      }
      if (Array.isArray(parsed.history)) {
        empty.history = parsed.history.filter(r =>
          r && typeof r === 'object' && BASE_POINTS[r.planetId] !== undefined &&
          Number.isFinite(r.score) && r.score > 0).slice(0,MAX_HISTORY);
      }
    } catch (_) { /* Private mode, blocked storage or outdated data. */ }
    return empty;
  }

  function createSystem(options = {}) {
    let storage = options.storage;
    if (storage === undefined) {
      try { storage = root.localStorage; } catch (_) { storage = null; }
    }
    const records = readRecords(storage);
    let run = emptyRun();

    function counter(weapon) {
      if (!weapon || !weapon.id) throw new TypeError('Catalog weapon required');
      let value = run.weapons.get(weapon.id);
      if (!value) {
        value = {id:weapon.id,nameFa:weapon.nameFa || weapon.id,
          icon:weapon.icon || '●',kind:weapon.kind || 'missile',
          launched:0,hit:0,intercepted:0};
        run.weapons.set(weapon.id,value);
      }
      return value;
    }
    function recordLaunch(weapon) {
      if (run.completed) return false;
      run.active = true;
      run.launches++;
      counter(weapon).launched++;
      return true;
    }
    function recordImpact(weapon) {
      if (run.completed) return false;
      run.active = true;
      run.impacts++;
      counter(weapon).hit++;
      return true;
    }
    function recordIntercept(weapon) {
      if (!run.active || run.completed) return false;
      run.interceptions++;
      counter(weapon).intercepted++;
      return true;
    }
    function tick(seconds) {
      if (run.active && !run.completed && Number.isFinite(seconds) && seconds > 0)
        run.elapsedSeconds += Math.min(seconds,0.25);
    }
    function complete(planet, extra = {}) {
      if (!planet || BASE_POINTS[planet.id] === undefined ||
          run.completed || !run.active || run.impacts === 0) return null;
      run.completed = true;
      const durationSeconds = Math.round(run.elapsedSeconds * 10) / 10;
      const timeBonus = Math.max(0,Math.round(900 - durationSeconds * 3));
      const efficiencyBonus = Math.max(0,700 - Math.max(0,run.launches - 1) * 24);
      const varietyBonus = Math.min(200,run.weapons.size * 50);
      const basePoints = BASE_POINTS[planet.id];
      const points = basePoints + timeBonus + efficiencyBonus + varietyBonus;
      const performance = timeBonus + efficiencyBonus + varietyBonus;
      const grade = performance >= 1500 ? 'S' :
        performance >= 1200 ? 'A' : performance >= 850 ? 'B' : 'C';
      const previousBest = records.bestByPlanet[planet.id];
      const isNewBest = !previousBest || points > previousBest.score;
      const entry = {
        planetId:planet.id,planetNameFa:planet.nameFa,planetNameEn:planet.nameEn,
        durationSeconds,launches:run.launches,impacts:run.impacts,
        interceptions:run.interceptions,
        breaches:Math.floor(validNumber(extra.breaches)),
        surfaceDamage:Math.round(validNumber(extra.surfaceDamage) * 10) / 10,
        weapons:[...run.weapons.values()].map(w=>({...w})).sort((a,b)=>b.hit-a.hit),
        grade,score:points,basePoints,timeBonus,efficiencyBonus,varietyBonus,
        completedAt:new Date().toISOString()
      };
      records.totalScore += points;
      records.completions++;
      if (isNewBest) records.bestByPlanet[planet.id] = entry;
      records.history.unshift(entry);
      records.history.length = Math.min(records.history.length,MAX_HISTORY);
      try { storage?.setItem(STORAGE_KEY,JSON.stringify(records)); }
      catch (_) { /* Scores still work for the current session. */ }
      return {...entry,isNewBest,totalScore:records.totalScore,completions:records.completions};
    }
    function resetRun() { run = emptyRun(); }
    function snapshot() {
      return {
        totalScore:records.totalScore,completions:records.completions,
        bestByPlanet:{...records.bestByPlanet},history:[...records.history],
        active:run.active,elapsedSeconds:run.elapsedSeconds,
        launches:run.launches,impacts:run.impacts
      };
    }
    return Object.freeze({recordLaunch,recordImpact,recordIntercept,tick,
      complete,resetRun,snapshot});
  }

  const api = Object.freeze({createSystem,BASE_POINTS,STORAGE_KEY});
  root.GodSmashScores = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
