/* Durable native Preferences mirror for scores and lightweight settings.
 * The current web game still uses localStorage synchronously. In a native
 * WebView, the official Preferences plugin additionally keeps OS-backed data.
 */
(function (root) {
  'use strict';
  const SETTINGS_KEY = 'godsmash:settings:v1';
  const SCORE_KEY = 'godsmash:scores:v1';

  function read(storage,key) {
    try { return storage?.getItem(key) || null; } catch (_) { return null; }
  }
  function write(storage,key,value) {
    try { storage?.setItem(key,value); return true; } catch (_) { return false; }
  }
  function parseSettings(raw) {
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const timeScale = [0.5,1,2].includes(value.timeScale) ? value.timeScale : 1;
      return {
        muted: value.muted === true,
        autoRotate: value.autoRotate !== false,
        salvoMode: value.salvoMode === true,
        timeScale,
        updatedAt: Number.isSafeInteger(value.updatedAt) && value.updatedAt >= 0
          ? value.updatedAt : 0
      };
    } catch (_) { return null; }
  }
  function parseScoreSummary(raw) {
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      if (!Number.isSafeInteger(value.completions) || value.completions < 0 ||
          !Number.isSafeInteger(value.totalScore) || value.totalScore < 0) return null;
      return {completions:value.completions,totalScore:value.totalScore};
    } catch (_) { return null; }
  }
  function chooseScores(localRaw,nativeRaw) {
    const local=parseScoreSummary(localRaw), native=parseScoreSummary(nativeRaw);
    if (!native) return local ? localRaw : null;
    if (!local) return nativeRaw;
    if (native.completions > local.completions ||
        native.completions === local.completions && native.totalScore > local.totalScore) {
      return nativeRaw;
    }
    return localRaw;
  }

  function create(options = {}) {
    const local = options.localStorage === undefined ? root.localStorage : options.localStorage;
    const preferences = options.preferences === undefined ?
      root.Capacitor?.Plugins?.Preferences : options.preferences;
    const scoreKey = options.scoreKey || SCORE_KEY;
    const settingsKey = options.settingsKey || SETTINGS_KEY;
    let queue = Promise.resolve();
    function queueWrite(key,value) {
      if (!preferences || typeof preferences.set !== 'function') return;
      queue = queue.then(() => preferences.set({key,value})).catch(() => {
        // A transient native failure must not crash or overwrite local records.
      });
    }
    const scoreStorage = {
      getItem(key) { return read(local,key); },
      setItem(key,value) {
        write(local,key,value);
        if (key === scoreKey) queueWrite(key,String(value));
      }
    };
    function settingsNow() { return parseSettings(read(local,settingsKey)); }
    function saveSettings(input) {
      const previous=settingsNow();
      const normalized=parseSettings(JSON.stringify({
        ...input,
        updatedAt:Math.max(Date.now(),(previous?.updatedAt||0)+1)
      }));
      if (!normalized) return null;
      const raw=JSON.stringify(normalized);
      write(local,settingsKey,raw);
      queueWrite(settingsKey,raw);
      return normalized;
    }
    async function hydrate(scores) {
      let currentSettings=settingsNow();
      if (!preferences || typeof preferences.get !== 'function') return currentSettings;
      try {
        const [scoreResult,settingsResult] = await Promise.all([
          preferences.get({key:scoreKey}),
          preferences.get({key:settingsKey})
        ]);
        const localScores=read(local,scoreKey);
        const nativeScores=scoreResult?.value||null;
        const chosen=chooseScores(localScores,nativeScores);
        if (chosen && chosen === nativeScores && chosen !== localScores) {
          // The score system validates imported records and never changes the
          // active in-progress mission when restoring lifetime totals.
          if (scores && typeof scores.importRecords === 'function') {
            scores.importRecords(chosen);
          }
          write(local,scoreKey,chosen);
        } else if (chosen && chosen !== nativeScores) {
          queueWrite(scoreKey,chosen);
        }

        const nativeSettings=parseSettings(settingsResult?.value||null);
        if (nativeSettings && (!currentSettings ||
            nativeSettings.updatedAt > currentSettings.updatedAt)) {
          currentSettings=nativeSettings;
          write(local,settingsKey,JSON.stringify(currentSettings));
        } else if (currentSettings && (!nativeSettings ||
            nativeSettings.updatedAt < currentSettings.updatedAt)) {
          queueWrite(settingsKey,JSON.stringify(currentSettings));
        }
      } catch (_) {
        // Offline or unavailable native storage: local records still work.
      }
      return currentSettings;
    }
    return Object.freeze({
      scoreStorage,settingsNow,saveSettings,hydrate,
      flush:()=>queue,
      scoreKey,settingsKey
    });
  }
  const api=Object.freeze({create,parseSettings,chooseScores,SETTINGS_KEY,SCORE_KEY});
  root.GodSmashPersistence=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
