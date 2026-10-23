const test=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../src/defense/catalog.js');
const defense=require('../src/defense/orbital-defense.js');

const types=catalog.listTypes();
const build=()=>defense.createSystem({
  type:catalog.getType('orbital-laser'),types,planetRadius:10,count:0
});
function target(id,position,health=1,weapon={damage:4,speed:1}){
  return {id,position:{...position},health,progress:.6,incoming:true,
    destroyed:false,weapon,flight:{velocity:weapon.speed}};
}
test('all three defence categories are implemented and differ in cost/behavior',()=>{
  assert.deepEqual(types.map(t=>t.mode),['laser','interceptor','shield']);
  assert.ok(types[1].damage>types[0].damage);
  assert.ok(types[2].cooldown>types[0].cooldown);
  assert.ok(types.every(t=>t.defaultCount===0));
});

test('selected orbital placement is exact at deployment and moves on its own orbit',()=>{
  const engine=build();
  const id=engine.addSatellite({typeId:'orbital-laser',anchor:{x:0,y:0,z:50}});
  assert.ok(id);
  const unit=engine.getUnits()[0];
  assert.equal(unit.typeId,'orbital-laser');
  assert.ok(Math.abs(unit.position.z-13.3)<1e-9);
  assert.ok(Math.abs(unit.position.x)<1e-9);
  engine.step(.1,[]);
  assert.notDeepEqual(engine.getUnits()[0].position,unit.position);
  assert.ok(Math.abs(Math.hypot(...Object.values(engine.getUnits()[0].position))-13.3)<1e-8);
});

test('different types coexist and retain exact placement after loading a planet fleet',()=>{
  const a=build();
  a.addSatellite({typeId:'orbital-laser',anchor:{x:1,y:.2,z:0}});
  a.addSatellite({typeId:'orbital-interceptor',anchor:{x:0,y:1,z:0}});
  a.addSatellite({typeId:'orbital-shield',anchor:{x:0,y:0,z:-1}});
  a.step(.15,[]);
  const snapshot=a.exportDeployment();
  assert.equal(snapshot.length,3);
  const b=build();
  b.loadDeployment(snapshot);
  assert.deepEqual(b.exportDeployment(),snapshot);
  assert.deepEqual(b.getUnits().map(x=>x.typeId),
    ['orbital-laser','orbital-interceptor','orbital-shield']);
  b.removeSatellite(b.getUnits()[1].id);
  assert.deepEqual(b.getUnits().map(x=>x.typeId),['orbital-laser','orbital-shield']);
  b.reset();
  assert.equal(b.getState().count,2,'reset preserves player-selected deployment');
  assert.throws(()=>b.addSatellite({typeId:'unknown',anchor:{x:1,y:0,z:0}}),RangeError);
  assert.throws(()=>b.loadDeployment([{typeId:'orbital-laser',anchor:{x:0,y:0,z:0}}]),RangeError);
  assert.equal(b.getState().count,2,'invalid fleet must not corrupt existing state');
});

test('heavy interceptor destroys armoured threat faster than laser',()=>{
  const laser=build(),heavy=build();
  laser.addSatellite({typeId:'orbital-laser',anchor:{x:1,y:0,z:0}});
  heavy.addSatellite({typeId:'orbital-interceptor',anchor:{x:1,y:0,z:0}});
  const one=target('one',{x:17,y:0,z:0},2.6);
  const two=target('two',{x:17,y:0,z:0},2.6);
  const resultLaser=laser.step(.01,[one]);
  const resultHeavy=heavy.step(.01,[two]);
  assert.equal(resultLaser[0].mode,'laser');
  assert.equal(resultHeavy[0].mode,'interceptor');
  assert.equal(one.destroyed,false);
  assert.equal(two.destroyed,true);
  assert.equal(heavy.getState().interceptions,1);
});

test('shield only protects a local near-surface zone, with recharge time',()=>{
  const engine=build();
  engine.addSatellite({typeId:'orbital-shield',anchor:{x:1,y:0,z:0}});
  const tooFar=target('far',{x:20,y:0,z:0},5);
  assert.equal(engine.step(.01,[tooFar]).length,0);
  const wrongSide=target('back',{x:-10.2,y:0,z:0},5);
  assert.equal(engine.step(.01,[wrongSide]).length,0);
  const near=target('near',{x:10.7,y:0,z:0},3);
  assert.equal(engine.step(.01,[near]).length,1);
  assert.equal(near.destroyed,true);
  assert.equal(engine.step(.01,[target('new',{x:10.8,y:0,z:0},3)]).length,0,
    'shield requires recharge');
});

test('radar priorities change which in-range threat is intercepted first',()=>{
  const data=[
    target('near',{x:16,y:0,z:0},1,{damage:2,speed:.4}),
    target('fast',{x:19,y:0,z:0},1,{damage:1,speed:5}),
    target('heavy',{x:18,y:0,z:0},1,{damage:12,speed:1})
  ];
  for(const [policy,expected] of [
    ['nearest','near'],['fastest','fast'],['strongest','heavy']
  ]){
    const engine=build();
    engine.addSatellite({typeId:'orbital-laser',anchor:{x:1,y:0,z:0}});
    engine.setPriority(policy);
    const contacts=data.map(t=>target(t.id,t.position,1,t.weapon));
    assert.equal(engine.getRadar(contacts)[0].id,expected);
    assert.equal(engine.step(.01,contacts)[0].targetId,expected);
    assert.equal(engine.getState().priority,policy);
  }
  assert.throws(()=>build().setPriority('invalid'),RangeError);
});

test('defence beams cannot pass through planet, out-of-range targets remain untouched',()=>{
  const engine=build();
  engine.addSatellite({typeId:'orbital-interceptor',anchor:{x:1,y:0,z:0}});
  const hidden=target('hidden',{x:-14,y:0,z:0},2);
  const far=target('far',{x:100,y:0,z:0},2);
  assert.deepEqual(engine.step(.01,[hidden,far]),[]);
  assert.equal(hidden.health,2);
  assert.equal(far.health,2);
  assert.equal(engine.getRadar([hidden,far]).length,2);
});

test('capped six-unit fleet, no default units and disabled mode never fires',()=>{
  const engine=build();
  assert.equal(engine.getState().count,0);
  for(let i=0;i<6;i++)assert.ok(engine.addSatellite({
    typeId:types[i%3].id,anchor:{x:1,y:i*.1,z:.2}
  }));
  assert.equal(engine.addSatellite({typeId:types[0].id,anchor:{x:1,y:0,z:0}}),false);
  assert.equal(engine.getUnits().length,6);
  engine.configure({enabled:false});
  assert.equal(engine.getUnits().length,0);
  assert.equal(engine.step(.01,[target('t',{x:17,y:0,z:0})]).length,0);
  engine.configure({enabled:true});
  assert.equal(engine.getUnits().length,6);
});
