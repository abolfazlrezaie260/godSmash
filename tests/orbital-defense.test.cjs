const test=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../src/defense/catalog.js');
const {createSystem,visibleLine}=require('../src/defense/orbital-defense.js');

function setUp(opts={}) {
  const type=catalog.getType('orbital-laser');
  return createSystem({type,planetRadius:10,count:opts.count??4,enabled:opts.enabled??true});
}
function target(id,position,health=0.95) {
  return {id,position:{...position},health,progress:0.4,incoming:true,destroyed:false};
}
function guaranteedTarget(system,id='incoming',health=0.95) {
  const satellite=system.getUnits()[0].position;
  return target(id,{
    x:satellite.x*1.2,y:satellite.y*1.2,z:satellite.z*1.2
  },health);
}

test('catalog supports future defence categories with strict validation',()=>{
  assert.equal(catalog.listTypes().length>=1,true);
  const d=catalog.getType('orbital-laser');
  assert.equal(d.category,'satellites');
  assert.deepEqual(d.allowedCounts,[0,1,2,3,4,5,6]);
  assert.equal(d.defaultCount,0);
  assert.throws(()=>catalog.registerType({...d}),/already registered/);
  assert.throws(()=>catalog.registerType({id:'bad',category:'future',nameFa:'x',range:-1}),TypeError);
});

test('satellites detect approaching weapons and intercept before planetary impact',()=>{
  const engine=setUp();
  const incoming=guaranteedTarget(engine);
  const shots=engine.step(0.016,[incoming]);
  assert.ok(shots.length>=1);
  assert.equal(shots[0].targetId,incoming.id);
  assert.ok(incoming.destroyed);
  assert.equal(incoming.health,0);
  assert.equal(engine.getState().interceptions,1);
  assert.ok(engine.getState().totalShots>=1);
  assert.equal(engine.step(0.016,[incoming]).length,0,'dead projectile cannot be targeted twice');
});

test('disabled or zero satellites never shoot, while configuration takes effect immediately',()=>{
  const engine=setUp({enabled:false});
  let t=target('ignored',{x:17,y:0,z:0});
  assert.equal(engine.getUnits().length,0);
  assert.equal(engine.step(1,[t]).length,0);
  engine.configure({enabled:true,count:0});
  assert.equal(engine.getUnits().length,0);
  assert.equal(engine.step(1,[t]).length,0);
  engine.configure({count:4});
  t=guaranteedTarget(engine);
  assert.ok(engine.step(0.016,[t]).length>0);
  assert.throws(()=>engine.configure({count:7}),RangeError);
});

test('orbital movement respects simulation delta and cooldown prevents unlimited lasers',()=>{
  const type=catalog.getType('orbital-laser');
  const a=createSystem({type,planetRadius:10,count:2});
  const b=createSystem({type,planetRadius:10,count:2});
  const p0=a.getUnits()[0].position;
  a.step(0.04,[]);
  b.step(0.02,[]);
  b.step(0.02,[]);
  assert.ok(Math.abs(a.getUnits()[0].position.x-b.getUnits()[0].position.x)<1e-10);
  assert.notDeepEqual(a.getUnits()[0].position,p0);
  const t=guaranteedTarget(a,'heavy',6);
  const shots=a.step(0.001,[t]);
  assert.ok(shots.length>0);
  assert.equal(a.step(0.001,[t]).length,0,'all in-range guns should cool down');
  a.step(1.0,[]);
  a.reset();
  assert.equal(a.getState().totalShots,0);
  assert.equal(a.getState().interceptions,0);
});

test('orbital geometry prevents beams through planet and rejects out-of-range threats',()=>{
  assert.equal(visibleLine({x:15,y:0,z:0},{x:-15,y:0,z:0},10),false);
  assert.equal(visibleLine({x:15,y:0,z:0},{x:25,y:0,z:0},10),true);
  const engine=setUp();
  const far=target('far',{x:800,y:0,z:0});
  assert.equal(engine.step(.05,[far]).length,0);
  const outbound=guaranteedTarget(engine,'leaving');
  outbound.incoming=false;
  assert.equal(engine.step(.05,[outbound]).length,0);
});

test('simultaneous shots and active satellites stay inside capped budgets',()=>{
  const engine=setUp({count:6});
  const threats=Array.from({length:30},(_,i)=>guaranteedTarget(engine,'t'+i,20));
  for(let i=0;i<40;i++) {
    const events=engine.step(.05,threats);
    assert.ok(events.length<=6);
  }
  assert.equal(engine.getUnits().length,6);
  assert.ok(engine.getState().totalShots<=6*40);
  engine.reset();
  assert.equal(engine.getState().totalShots,0);
});

test('zero defenders at launch: only player add actions deploy orbiting interceptors',()=>{
  const type=catalog.getType('orbital-laser');
  const engine=createSystem({type,planetRadius:10});
  assert.equal(engine.getState().count,0);
  assert.deepEqual(engine.getUnits(),[]);
  assert.equal(engine.step(0.05,[target('hostile',{x:16,y:0,z:0})]).length,0);
  assert.match(engine.addSatellite(),/^defence-\d+$/);
  assert.equal(engine.getState().count,1);
  assert.equal(engine.getUnits().length,1);
  const hostile=guaranteedTarget(engine);
  assert.equal(engine.step(0.01,[hostile]).length,1,'manually deployed drone can intercept');
  assert.ok(hostile.destroyed);
  engine.reset();
  assert.equal(engine.getState().count,1,'planet repair must keep deployed fleet');
  assert.equal(engine.getState().interceptions,0);
  assert.equal(engine.removeSatellite(),true);
  assert.equal(engine.getUnits().length,0);
  assert.equal(engine.removeSatellite(),false);
});

test('deployment never exceeds a six-unit capacity and removal is incremental',()=>{
  const type=catalog.getType('orbital-laser');
  const engine=createSystem({type,planetRadius:10,enabled:true,count:0});
  for(let n=1;n<=6;n++){
    assert.match(engine.addSatellite(),/^defence-\d+$/);
    assert.equal(engine.getState().count,n);
    assert.equal(engine.getUnits().length,n);
  }
  assert.equal(engine.addSatellite(),false);
  assert.equal(engine.getState().count,6);
  assert.equal(engine.removeSatellite(),true);
  assert.equal(engine.getState().count,5);
  assert.match(engine.addSatellite(),/^defence-\d+$/);
  assert.equal(engine.getState().count,6);
  engine.configure({enabled:false});
  assert.equal(engine.getUnits().length,0);
  assert.equal(engine.getState().count,6,'turning off system must not delete fleet');
  engine.configure({enabled:true});
  assert.equal(engine.getUnits().length,6);
});
