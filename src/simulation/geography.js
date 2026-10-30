/* Curated country-center coordinates for a fictional continent-to-continent
 * globe game mode. Coordinates are approximate visual markers, not borders,
 * military locations, geopolitical claims or real-world flight planning.
 * Longitudes match Three.js SphereGeometry's equirectangular Earth UV map.
 */
(function (root) {
  'use strict';

  const entries = [
    ['asia', 'آسیا', [
      ['ir','ایران',32.5,53.7], ['iq','عراق',33.2,43.7],
      ['tr','ترکیه',39.0,35.2], ['sa','عربستان سعودی',24.0,45.0],
      ['sy','سوریه',35.0,38.5], ['jo','اردن',31.2,36.8],
      ['kw','کویت',29.3,47.5], ['ae','امارات',24.3,54.2],
      ['qa','قطر',25.3,51.2], ['om','عمان',21.3,57.0],
      ['af','افغانستان',33.9,67.7], ['pk','پاکستان',30.4,69.4],
      ['in','هند',22.8,79.0], ['cn','چین',35.0,103.5],
      ['jp','ژاپن',36.2,138.3], ['kr','کره جنوبی',36.4,127.9],
      ['kp','کره شمالی',40.3,127.5], ['id','اندونزی',-2.5,118.0],
      ['my','مالزی',4.2,102.2], ['th','تایلند',15.0,101.0],
      ['vn','ویتنام',16.3,107.8], ['ph','فیلیپین',12.8,122.0],
      ['bd','بنگلادش',23.7,90.4], ['np','نپال',28.4,84.1],
      ['kz','قزاقستان',48.2,67.3], ['uz','ازبکستان',41.4,64.6],
      ['ge','گرجستان',42.2,43.5], ['az','جمهوری آذربایجان',40.3,47.7]
    ]],
    ['europe','اروپا', [
      ['de','آلمان',51.0,10.5], ['fr','فرانسه',46.6,2.4],
      ['gb','بریتانیا',54.1,-2.6], ['es','اسپانیا',40.3,-3.7],
      ['it','ایتالیا',42.8,12.6], ['pt','پرتغال',39.5,-8.0],
      ['nl','هلند',52.1,5.3], ['be','بلژیک',50.6,4.7],
      ['ch','سوئیس',46.8,8.3], ['at','اتریش',47.5,14.5],
      ['pl','لهستان',52.1,19.1], ['cz','جمهوری چک',49.8,15.4],
      ['sk','اسلواکی',48.7,19.5], ['hu','مجارستان',47.2,19.1],
      ['gr','یونان',39.0,22.5], ['ro','رومانی',45.8,24.9],
      ['bg','بلغارستان',42.7,25.5], ['ua','اوکراین',49.0,31.4],
      ['se','سوئد',62.0,15.0], ['no','نروژ',61.2,8.5],
      ['fi','فنلاند',64.1,26.0], ['dk','دانمارک',56.0,9.5],
      ['ie','ایرلند',53.2,-8.0], ['hr','کرواسی',45.1,15.4],
      ['rs','صربستان',44.1,20.8], ['by','بلاروس',53.7,27.9],
      ['ru','روسیه',55.7,37.6]
    ]],
    ['africa','آفریقا', [
      ['eg','مصر',26.8,30.8], ['ly','لیبی',27.0,17.0],
      ['tn','تونس',34.0,9.2], ['dz','الجزایر',28.0,2.6],
      ['ma','مراکش',31.8,-6.0], ['sd','سودان',15.5,30.2],
      ['et','اتیوپی',9.1,40.5], ['ke','کنیا',0.2,37.9],
      ['ug','اوگاندا',1.4,32.3], ['tz','تانزانیا',-6.4,35.0],
      ['ng','نیجریه',9.1,8.7], ['gh','غنا',7.9,-1.0],
      ['sn','سنگال',14.5,-14.4], ['cm','کامرون',5.7,12.6],
      ['cd','جمهوری دموکراتیک کنگو',-3.0,23.5],
      ['ao','آنگولا',-12.3,17.5], ['za','آفریقای جنوبی',-29.0,24.0],
      ['na','نامیبیا',-22.6,17.0], ['zm','زامبیا',-13.0,27.9],
      ['zw','زیمبابوه',-19.0,29.9], ['mg','ماداگاسکار',-19.0,46.8]
    ]],
    ['north-america','آمریکای شمالی', [
      ['us','ایالات متحده',39.8,-98.5], ['ca','کانادا',56.0,-106.0],
      ['mx','مکزیک',23.6,-102.5], ['gt','گواتمالا',15.7,-90.4],
      ['bz','بلیز',17.2,-88.7], ['hn','هندوراس',14.8,-86.5],
      ['sv','السالوادور',13.8,-88.9], ['ni','نیکاراگوئه',12.8,-85.0],
      ['cr','کاستاریکا',9.7,-84.1], ['pa','پاناما',8.5,-80.0],
      ['cu','کوبا',21.5,-79.5], ['ht','هائیتی',19.0,-72.7],
      ['do','جمهوری دومینیکن',19.0,-70.7], ['jm','جامائیکا',18.1,-77.3]
    ]],
    ['south-america','آمریکای جنوبی', [
      ['br','برزیل',-10.8,-52.9], ['ar','آرژانتین',-35.5,-64.0],
      ['cl','شیلی',-33.5,-70.8], ['pe','پرو',-9.2,-75.0],
      ['bo','بولیوی',-16.7,-64.7], ['co','کلمبیا',4.5,-74.0],
      ['ve','ونزوئلا',7.0,-66.0], ['ec','اکوادور',-1.3,-78.5],
      ['py','پاراگوئه',-23.4,-58.4], ['uy','اروگوئه',-32.8,-56.0],
      ['gy','گویان',4.9,-58.9], ['sr','سورینام',3.9,-56.0]
    ]],
    ['oceania','اقیانوسیه', [
      ['au','استرالیا',-25.3,133.8], ['nz','نیوزیلند',-41.2,172.0],
      ['pg','پاپوآ گینه نو',-6.3,145.0], ['fj','فیجی',-17.8,178.0],
      ['sb','جزایر سلیمان',-9.6,160.0], ['vu','وانواتو',-16.0,167.0],
      ['ws','ساموآ',-13.8,-172.1], ['to','تونگا',-21.2,-175.2]
    ]]
  ];

  const continents = Object.freeze(entries.map(([id, nameFa, countries]) =>
    Object.freeze({
      id, nameFa,
      countries: Object.freeze(countries.map(([countryId, label, lat, lon]) =>
        Object.freeze({id:countryId, nameFa:label, lat, lon})))
    })));

  function getContinent(id) {
    return continents.find(c => c.id === id) || null;
  }
  function getCountry(continentId, countryId) {
    const c = getContinent(continentId);
    return c ? c.countries.find(country => country.id === countryId) || null : null;
  }
  function toCartesian(lat, lon, radius = 1) {
    if (![lat,lon,radius].every(Number.isFinite) || lat < -90 || lat > 90 ||
        lon < -180 || lon > 180 || radius <= 0) {
      throw new TypeError('Invalid geographic position');
    }
    const phi = lat * Math.PI / 180;
    const lambda = lon * Math.PI / 180;
    return {x:radius * Math.cos(phi) * Math.cos(lambda),
      y:radius * Math.sin(phi), z:radius * Math.cos(phi) * Math.sin(lambda)};
  }
  function createRoute(continentId, sourceId, destinationId, radius = 10) {
    const source = getCountry(continentId, sourceId);
    const destination = getCountry(continentId, destinationId);
    if (!source || !destination || source.id === destination.id) {
      throw new TypeError('Choose two different countries in the same continent');
    }
    const a = toCartesian(source.lat, source.lon, 1);
    const b = toCartesian(destination.lat, destination.lon, 1);
    const dot = Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z));
    const angle = Math.acos(dot);
    // Spherical midpoint of the two country markers, not a ground-track
    // flight solution. The arc has enough clearance to stay above the globe.
    const mid = {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z};
    const length = Math.hypot(mid.x,mid.y,mid.z);
    if (length < 1e-6) throw new TypeError('Antipodal country pair unsupported');
    const altitude = Math.max(4, Math.min(9, radius * angle * 0.75));
    const control = {
      x:mid.x/length*(radius+altitude),
      y:mid.y/length*(radius+altitude),
      z:mid.z/length*(radius+altitude)
    };
    return Object.freeze({
      continentId, source, destination, angle,
      start:toCartesian(source.lat,source.lon,radius),
      target:toCartesian(destination.lat,destination.lon,radius),
      control
    });
  }

  const api = Object.freeze({
    listContinents: () => continents,
    getContinent, getCountry, toCartesian, createRoute
  });
  root.GodSmashGeography = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
