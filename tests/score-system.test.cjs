const test = require('node:test');
const assert = require('node:assert/strict');
const scoring = require('../src/simulation/score-system.js');

const earth = {id:'earth',nameFa:'زمین',nameEn:'EARTH'};
const moon = {id:'moon',nameFa:'ماه',nameEn:'MOON'};
const icbm = {id:'icbm',nameFa:'موشک هسته‌ای',kind:'missile',icon:'🚀'};
const specter = {id:'specter',nameFa:'موشک شبح',kind:'missile',icon:'🚀'};

function memoryStorage() {
  const map = new Map();
  return {
    getItem:key=>map.get(key)||null,
    setItem:(key,value)=>map.set(key,value),
    map
  };
}

test('no passive points: operation begins at actual attack, awards exactly once', () => {
  const scores = scoring.createSystem({storage:memoryStorage()});
  scores.tick(90);
  assert.equal(scores.snapshot().elapsedSeconds,0);
  assert.equal(scores.complete(moon),null);
  scores.recordLaunch(icbm);
  scores.tick(12.4);
  scores.recordImpact(icbm);
  const report=scores.complete(moon,{breaches:2,surfaceDamage:19.5});
  assert.ok(report.score>scoring.BASE_POINTS.moon);
  assert.equal(report.durationSeconds,0.3,'scoring timers clamp abnormal single frame spikes');
  assert.equal(report.launches,1);
  assert.equal(report.impacts,1);
  assert.equal(report.weapons[0].nameFa,'موشک هسته‌ای');
  assert.equal(report.breaches,2);
  assert.equal(report.surfaceDamage,19.5);
  assert.equal(report.isNewBest,true);
  assert.equal(scores.complete(moon),null);
  assert.equal(scores.snapshot().completions,1);
  scores.tick(100);
  assert.equal(scores.snapshot().elapsedSeconds,0.25);
});

test('different weapons, interceptions and time affect the final grade and score',()=>{
  const storage=memoryStorage();
  const scores=scoring.createSystem({storage});
  for(let k=0;k<40;k++)scores.tick(.2);
  scores.recordLaunch(icbm);
  for(let k=0;k<50;k++)scores.tick(.2);
  scores.recordIntercept(icbm);
  scores.recordLaunch(specter);
  scores.recordImpact(specter);
  const report=scores.complete(earth,{breaches:1,surfaceDamage:20});
  assert.equal(report.durationSeconds,10);
  assert.equal(report.launches,2);
  assert.equal(report.impacts,1);
  assert.equal(report.interceptions,1);
  assert.equal(report.weapons.length,2);
  assert.equal(report.varietyBonus,100);
  assert.equal(report.efficiencyBonus,676);
  assert.equal(report.timeBonus,870);
  assert.equal(report.grade,'S');
  assert.equal(report.score,3046);
});

test('reset loses incomplete progress but retains saved lifetime and planetary best',()=>{
  const storage=memoryStorage();
  const scores=scoring.createSystem({storage});
  scores.recordLaunch(icbm);scores.recordImpact(icbm);
  const first=scores.complete(moon);
  scores.resetRun();
  scores.recordLaunch(icbm);
  for(let i=0;i<500;i++)scores.tick(.05);
  scores.recordImpact(icbm);
  const slower=scores.complete(moon);
  assert.equal(slower.isNewBest,false);
  assert.equal(scores.snapshot().bestByPlanet.moon.score,first.score);
  assert.equal(scores.snapshot().totalScore,first.score+slower.score);
  assert.equal(scores.snapshot().completions,2);
  const loaded=scoring.createSystem({storage});
  assert.equal(loaded.snapshot().totalScore,first.score+slower.score);
  assert.equal(loaded.snapshot().history.length,2);
  assert.equal(loaded.snapshot().bestByPlanet.moon.score,first.score);
  loaded.recordLaunch(specter);loaded.resetRun();
  assert.equal(loaded.snapshot().active,false);
  assert.equal(loaded.snapshot().launches,0);
});

test('storage failures and corrupt historical data do not stop scoring',()=>{
  const blocked={
    getItem(){throw Error('denied');},setItem(){throw Error('denied');}
  };
  const scores=scoring.createSystem({storage:blocked});
  scores.recordLaunch(icbm);
  scores.recordImpact(icbm);
  assert.doesNotThrow(()=>scores.complete(moon));
  assert.equal(scores.snapshot().completions,1);
  assert.equal(scoring.createSystem({storage:{
    getItem:()=>'{not json',setItem(){}
  }}).snapshot().completions,0);
});

test('swarm sorties count as one launch but multiple hits, and no duplicate completion',()=>{
  const scores=scoring.createSystem({storage:memoryStorage()});
  const swarm={id:'drone-swarm',kind:'swarm',nameFa:'ازدحام پهپادها',icon:'◈'};
  scores.recordLaunch(swarm);
  for(let i=0;i<6;i++)scores.recordImpact(swarm);
  const result=scores.complete(earth);
  assert.equal(result.launches,1);
  assert.equal(result.impacts,6);
  assert.equal(result.weapons[0].hit,6);
  assert.equal(scores.recordImpact(swarm),false);
});
