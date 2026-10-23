/* Content definitions and validation; no dependency on Three.js or the DOM. */
(function (root) {
  'use strict';

  const planets = new Map();
  const weapons = new Map();
  const idPattern = /^[a-z][a-z0-9-]*$/;

  function finiteNumber(value, min, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
      throw new TypeError(label + ' must be a finite number >= ' + min);
    }
    return value;
  }
  function registerPlanet(config) {
    if (!config || !idPattern.test(config.id || '') || planets.has(config.id)) {
      throw new Error('Planet ID must be unique and lowercase (a-z, 0-9, -).');
    }
    if (!config.nameFa || !config.nameEn || !config.surface || !config.palette ||
        !Array.isArray(config.palette) || config.palette.length < 3) {
      throw new Error('Planet requires names, a surface type and three palette colors.');
    }
    finiteNumber(config.population, 0, 'planet.population');
    finiteNumber(config.rotationSpeed, 0, 'planet.rotationSpeed');
    finiteNumber(config.resistance, 0.01, 'planet.resistance');
    finiteNumber(config.cloudOpacity, 0, 'planet.cloudOpacity');
    const planet = Object.freeze({ ...config, palette: Object.freeze([...config.palette]) });
    planets.set(planet.id, planet);
    return planet;
  }
  function registerWeapon(config) {
    if (!config || !idPattern.test(config.id || '') || weapons.has(config.id)) {
      throw new Error('Weapon ID must be unique and lowercase (a-z, 0-9, -).');
    }
    if (!config.nameFa || !config.kind || !['missile', 'asteroid', 'beam'].includes(config.kind)) {
      throw new Error('Weapon requires a name and a supported kind.');
    }
    for (const key of ['blastRadius', 'damage', 'damageVariance', 'casualties',
      'casualtiesVariance', 'speed', 'shake', 'debrisCount']) {
      finiteNumber(config[key], 0, 'weapon.' + key);
    }
    if (!Number.isInteger(config.debrisCount)) throw new TypeError('debrisCount must be an integer');
    for (const key of ['launchSpeed', 'acceleration', 'maxSpeed', 'fuelDuration', 'drag', 'flightPace', 'interceptHealth']) {
      if (config[key] !== undefined) finiteNumber(config[key], 0, 'weapon.' + key);
    }
    if (config.launchSpeed !== undefined && config.maxSpeed !== undefined &&
        config.maxSpeed < config.launchSpeed) {
      throw new Error('weapon.maxSpeed must be >= weapon.launchSpeed');
    }
    if (config.kind !== 'beam' && config.speed <= 0) throw new Error('Projectile speed must be positive');
    if (config.kind !== 'beam' && config.flightPace !== undefined &&
        (config.flightPace <= 0 || config.flightPace > 1)) {
      throw new RangeError('weapon.flightPace must be in (0, 1]');
    }
    if (config.kind !== 'beam' && config.interceptHealth !== undefined &&
        config.interceptHealth <= 0) throw new RangeError('interceptHealth must be positive');
    const weapon = Object.freeze({ ...config });
    weapons.set(weapon.id, weapon);
    return weapon;
  }

  registerPlanet({
    id: 'earth', nameFa: 'زمین', nameEn: 'EARTH', surface: 'earth',
    descriptionFa: 'اقیانوس، قاره و ابرهای واقعی',
    population: 8000000000, rotationSpeed: 0.12, resistance: 1,
    cloudOpacity: 0.65, cloudTint: '#ffffff', atmosphereColor: '#38a6ff',
    palette: ['#0c2d48', '#1f6f43', '#e2e8f0']
  });
  registerPlanet({
    id: 'mars', nameFa: 'مریخ', nameEn: 'MARS', surface: 'rocky',
    descriptionFa: 'سطح سنگی سرخ و جو رقیق',
    population: 0, rotationSpeed: 0.10, resistance: 0.85,
    cloudOpacity: 0, cloudTint: '#ffffff', atmosphereColor: '#b85731',
    palette: ['#692f20', '#b85f39', '#e09d6e']
  });
  registerPlanet({
    id: 'venus', nameFa: 'زهره', nameEn: 'VENUS', surface: 'bands',
    descriptionFa: 'ابرهای متراکم و رنگ‌های گرم',
    population: 0, rotationSpeed: 0.03, resistance: 1.25,
    cloudOpacity: 0.55, cloudTint: '#e7be74', atmosphereColor: '#eec47b',
    palette: ['#95704a', '#d5ad72', '#f3d5a5']
  });
  registerPlanet({
    id: 'moon', nameFa: 'ماه', nameEn: 'MOON', surface: 'rocky',
    descriptionFa: 'سطح پرگودال و فاقد جو',
    population: 0, rotationSpeed: 0.04, resistance: 0.7,
    cloudOpacity: 0, cloudTint: '#ffffff', atmosphereColor: null,
    palette: ['#454b57', '#898d93', '#c0c3c7']
  });

  registerWeapon({
    id: 'icbm', nameFa: 'موشک هسته‌ای', subtitle: 'ICBM · 50 MT', shortLabel: 'سنگین',
    kind: 'missile', icon: '🚀', visualProfile: 'strategic', blastRadius: 1.9,
    damage: 4.2, damageVariance: 1.8,
    casualties: 180000000, casualtiesVariance: 290000000,
    flightPace: 0.34, interceptHealth: 2.7, speed: 0.95, launchSpeed: 0.18, acceleration: 1.05, maxSpeed: 1.55, fuelDuration: 0.72, drag: 0.035, shake: 0.55, debrisCount: 24,
    fireColor: '#fef08a', plasmaColor: '#f97316', waveColor: '#fdba74'
  });
  registerWeapon({
    id: 'swift', nameFa: 'موشک سبک', subtitle: 'GS-02 · SWIFT', shortLabel: 'سبک',
    kind: 'missile', icon: '🚀', visualProfile: 'interceptor', blastRadius: 1.05,
    damage: 1.8, damageVariance: 0.9,
    casualties: 55000000, casualtiesVariance: 110000000,
    flightPace: 0.27, interceptHealth: 1.9, speed: 1.32, launchSpeed: 0.30, acceleration: 1.8, maxSpeed: 2.15, fuelDuration: 0.46, drag: 0.12, shake: 0.28, debrisCount: 12,
    fireColor: '#fef9c3', plasmaColor: '#fb923c', waveColor: '#fcd34d'
  });
  registerWeapon({
    id: 'winged', nameFa: 'موشک بالدار', subtitle: 'GS-03 · WINGED', shortLabel: 'بالدار',
    kind: 'missile', icon: '🚀', visualProfile: 'cruise', blastRadius: 1.35,
    damage: 2.7, damageVariance: 1.1,
    casualties: 80000000, casualtiesVariance: 130000000,
    flightPace: 0.32, interceptHealth: 2.25, speed: 0.83, launchSpeed: 0.22, acceleration: 0.75, maxSpeed: 1.05, fuelDuration: 0.80, drag: 0.04, shake: 0.35, debrisCount: 16,
    fireColor: '#fff7ed', plasmaColor: '#fb923c', waveColor: '#fda4af'
  });
  registerWeapon({
    id: 'asteroid', nameFa: 'شهاب‌سنگ', subtitle: 'KINETIC IMPACT', shortLabel: 'شهاب',
    kind: 'asteroid', icon: '☄️', blastRadius: 2.8,
    damage: 7, damageVariance: 2,
    casualties: 230000000, casualtiesVariance: 390000000,
    flightPace: 0.27, interceptHealth: 5.3, speed: 0.65, launchSpeed: 0.65, acceleration: 0, maxSpeed: 0.65, fuelDuration: 0, drag: 0.008, shake: 0.85, debrisCount: 40,
    fireColor: '#ffcb6b', plasmaColor: '#ff4d2d', waveColor: '#ff8855'
  });
  registerWeapon({
    id: 'laser', nameFa: 'لیزر مداری', subtitle: 'ORBITAL BEAM', shortLabel: 'لیزر',
    kind: 'beam', icon: '⚡', blastRadius: 0.95,
    damage: 1.7, damageVariance: 0.7,
    casualties: 15000000, casualtiesVariance: 40000000,
    speed: 0, shake: 0.25, debrisCount: 10,
    fireColor: '#a5f3fc', plasmaColor: '#22d3ee', waveColor: '#67e8f9'
  });

  registerWeapon({
    id: 'titan', nameFa: 'موشک تایتان', subtitle: 'GS-04 · HEAVY SIEGE', shortLabel: 'تایتان',
    kind: 'missile', icon: '🚀', visualProfile: 'siege', blastRadius: 2.45,
    damage: 5.7, damageVariance: 1.25,
    casualties: 210000000, casualtiesVariance: 205000000,
    flightPace: 0.29, interceptHealth: 4.7, speed: 0.72, launchSpeed: 0.15, acceleration: 0.82, maxSpeed: 1.25, fuelDuration: 0.78, drag: 0.03, shake: 0.68, debrisCount: 32,
    fireColor: '#fff0c2', plasmaColor: '#ef4444', waveColor: '#fb923c'
  });
  registerWeapon({
    id: 'viper', nameFa: 'موشک وایپر', subtitle: 'GS-05 · HYPERSONIC', shortLabel: 'وایپر',
    kind: 'missile', icon: '🚀', visualProfile: 'hypersonic', blastRadius: 1.15,
    damage: 2.35, damageVariance: 0.65,
    casualties: 42000000, casualtiesVariance: 65000000,
    flightPace: 0.19, interceptHealth: 2.4, speed: 1.75, launchSpeed: 0.5, acceleration: 2.5, maxSpeed: 3.0, fuelDuration: 0.45, drag: 0.12, shake: 0.24, debrisCount: 10,
    fireColor: '#ecfeff', plasmaColor: '#0ea5e9', waveColor: '#67e8f9'
  });
  registerWeapon({
    id: 'nova', nameFa: 'موشک نُوا', subtitle: 'GS-06 · PLASMA', shortLabel: 'نُوا',
    kind: 'missile', icon: '🚀', visualProfile: 'plasma', blastRadius: 1.72,
    damage: 3.6, damageVariance: 1.0,
    casualties: 95000000, casualtiesVariance: 145000000,
    flightPace: 0.3, interceptHealth: 3.1, speed: 1.08, launchSpeed: 0.28, acceleration: 1.35, maxSpeed: 1.85, fuelDuration: 0.66, drag: 0.07, shake: 0.42, debrisCount: 20,
    fireColor: '#cffafe', plasmaColor: '#7c3aed', waveColor: '#22d3ee'
  });

  const api = Object.freeze({
    registerPlanet, registerWeapon,
    getPlanet: (id) => planets.get(id) || null,
    getWeapon: (id) => weapons.get(id) || null,
    listPlanets: () => Array.from(planets.values()),
    listWeapons: () => Array.from(weapons.values())
  });
  root.GodSmashCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
