/* Registry for expandable, fictional planetary defence systems.
 * Each category is data only; implementations are supplied by the defence runtime.
 */
(function (root) {
  'use strict';
  const types = new Map();

  function registerType(config) {
    if (!config || !/^[a-z][a-z0-9-]*$/.test(config.id || '') ||
        !/^[a-z][a-z0-9-]*$/.test(config.category || '') ||
        !config.nameFa || !Number.isFinite(config.orbitRadius) ||
        config.orbitRadius <= 0 ||
        !Number.isFinite(config.range) || config.range <= 0 ||
        !Number.isFinite(config.damage) || config.damage <= 0 ||
        !Number.isFinite(config.cooldown) || config.cooldown <= 0 ||
        !Number.isFinite(config.angularSpeed) || config.angularSpeed < 0) {
      throw new TypeError('Invalid planetary defence type');
    }
    if (types.has(config.id)) throw new Error('Defence ID already registered: ' + config.id);
    const entry = Object.freeze({
      ...config,
      allowedCounts: Object.freeze([...(config.allowedCounts || [0, 1, 2, 3, 4, 5, 6])])
    });
    types.set(config.id, entry);
    return entry;
  }

  registerType({
    id: 'orbital-laser', category: 'satellites',
    nameFa: 'ماهواره لیزری', nameEn: 'Orbital Laser',
    descriptionFa: 'شناسایی پرتابه‌های ورودی و انهدام آن‌ها با لیزر دفاعی',
    orbitRadius: 13.3, range: 19, damage: 0.95,
    cooldown: 0.42, angularSpeed: 0.19, maxShotsPerStep: 6,
    allowedCounts: [0, 1, 2, 3, 4, 5, 6], defaultCount: 0,
    beamColor: '#38e8ff', mode: 'laser'
  });

  registerType({
    id: 'orbital-interceptor', category: 'satellites',
    nameFa: 'رهگیر موشکی', nameEn: 'Interceptor',
    descriptionFa: 'ضربه سنگین به شهاب‌سنگ‌ها و پرتابه‌های زرهی؛ شلیک کندتر',
    orbitRadius: 13.5, range: 21, damage: 2.8,
    cooldown: 1.55, angularSpeed: 0.15, maxShotsPerStep: 4,
    allowedCounts: [0,1,2,3,4,5,6], defaultCount: 0,
    beamColor: '#ffae65', mode: 'interceptor'
  });
  registerType({
    id: 'orbital-shield', category: 'satellites',
    nameFa: 'ماهواره سپرساز', nameEn: 'Shield Projector',
    descriptionFa: 'حفاظت منطقه‌ای نزدیک سطح سیاره با سپر انرژی قابل شارژ',
    orbitRadius: 12.6, range: 7.5, damage: 12,
    cooldown: 2.65, angularSpeed: 0.085, maxShotsPerStep: 3,
    allowedCounts: [0,1,2,3,4,5,6], defaultCount: 0,
    beamColor: '#91ffba', mode: 'shield'
  });

  const api = Object.freeze({
    registerType,
    getType: id => types.get(id) || null,
    listTypes: () => Array.from(types.values())
  });
  root.GodSmashDefenseCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
