const test=require('node:test');
const assert=require('node:assert/strict');
const {createSwarm}=require('../src/simulation/drone-swarm.js');

const mag=v=>Math.hypot(v.x,v.y,v.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function run(count=36,scale=1,target={x:1,y:0,z:0}){
  const swarm=createSwarm({count,planetRadius:10,batchSize:6});
  assert.equal(swarm.attack(target),true);
  const events=[];
  let wall=0;
  let highestActive=0,lowestRadius=Infinity;
  while(swarm.getState().mode==='attack'&&wall<30){
    swarm.step((1/60)*scale,e=>events.push({time:wall,...e}));
    for(const d of swarm.getDrones())if(d.visible){
      highestActive=Math.max(highestActive,swarm.getState().active);
      lowestRadius=Math.min(lowestRadius,mag(d.position));
    }
    wall+=1/60;
  }
  return {swarm,events,wall,highestActive,lowestRadius};
}

test('selecting drone swarm does not scatter hundreds of drone silhouettes around the planet',()=>{
  const swarm=createSwarm({count:36,planetRadius:10,batchSize:6});
  const drones=swarm.getDrones();
  assert.equal(swarm.getState().mode,'ready');
  assert.equal(drones.length,36);
  assert.ok(drones.every(d=>!d.visible));
  assert.equal(swarm.getState().active,0);
  assert.deepEqual(swarm.step(1),[]);
  assert.equal(swarm.getState().impacts,0);
  swarm.dispose();
  assert.equal(swarm.getState().mode,'spent');
  assert.equal(swarm.getDrones().length,0);
});

test('each attack arrives in compact waves, attacks the selected point, then returns and hides',()=>{
  for(const count of [24,36]){
    const {swarm,events,wall,highestActive,lowestRadius}=run(count);
    const state=swarm.getState();
    assert.equal(state.mode,'ready','fleet is reusable after returning');
    assert.equal(state.active,0,'no drones idle in orbit after a sortie');
    assert.ok(swarm.getDrones().every(d=>d.done&&!d.visible&&d.struck));
    assert.equal(events.length,count/6);
    assert.equal(state.impacts,count/6);
    assert.equal(events.reduce((n,e)=>n+e.count,0),count);
    assert.ok(events[0].time>2,'arrival must be visible before impact');
    assert.ok(events.at(-1).time-events[0].time>=1.3,
      'attack waves should cascade rather than all explode simultaneously');
    assert.ok(wall>6&&wall<11,'attack and return finish in bounded game time');
    assert.ok(highestActive>0&&highestActive<=count);
    assert.ok(lowestRadius>10,'drones fly above the surface and do not crash');
    assert.ok(events.every(e=>e.count===6&&Math.abs(mag(e.normal)-1)<1e-7));
    assert.ok(events.every(e=>e.normal.x>.999&&Math.abs(mag(e.position)-10)<1e-7));
    swarm.dispose();
  }
});

test('drone strike actually flies back toward the launch corridor after contact',()=>{
  const swarm=createSwarm({count:24,planetRadius:10,batchSize:6});
  swarm.attack({x:0,y:0,z:1});
  const first=swarm.getDrones()[0];
  const start={...first.start};
  for(let i=0;i<75;i++)swarm.step(.04);
  assert.equal(first.struck,true);
  assert.ok(first.visible,'returning drones remain visible after their attack');
  assert.ok(mag(first.position)>10.1,'drone has begun to climb away');
  assert.ok(mag(first.position)-mag(first.strike)>.05);
  assert.ok(dot(first.position,start)/mag(first.position)/mag(start)>0.90,
    'drone is returning toward its local orbital corridor');
  for(let i=0;i<220&&swarm.getState().mode==='attack';i++)swarm.step(.05);
  assert.equal(swarm.getState().mode,'ready');
  assert.equal(swarm.getState().active,0);
  assert.ok(mag(first.position)>12,'returned drone ends away from the surface');
});

test('retargeting an active sortie cancels the old target and attacks the new point',()=>{
  const swarm=createSwarm({count:36,planetRadius:10,batchSize:6});
  swarm.attack({x:1,y:0,z:0});
  for(let i=0;i<40;i++)swarm.step(.05);
  assert.equal(swarm.getState().impacts,0);
  assert.equal(swarm.attack({x:-1,y:0,z:0}),true);
  assert.deepEqual(swarm.getState().target,{x:-1,y:0,z:0});
  const hits=[];
  for(let i=0;i<240&&swarm.getState().mode==='attack';i++){
    swarm.step(.05,e=>hits.push(e));
    for(const d of swarm.getDrones())if(d.visible){
      assert.ok(dot(d.position,{x:-1,y:0,z:0})>9,
        'retarget must not send drones through the planet');
    }
  }
  assert.equal(swarm.getState().mode,'ready');
  assert.equal(hits.length,6);
  assert.ok(hits.every(e=>e.normal.x<-.999));
});

test('returned drones can launch another complete sortie and damage again',()=>{
  const {swarm,events}=run(24);
  assert.equal(events.length,4);
  assert.equal(swarm.attack({x:0,y:1,z:0}),true);
  const second=[];
  for(let i=0;i<240&&swarm.getState().mode==='attack';i++)
    swarm.step(.05,e=>second.push(e));
  assert.equal(second.length,4,'wave completion flags reset between sorties');
  assert.ok(second.every(e=>e.normal.y>.999));
  assert.equal(swarm.getState().impacts,8);
  assert.equal(swarm.getState().sorties,2);
  assert.equal(swarm.getState().active,0);
});

test('0.5x and 2x game speed preserve deterministic attack and return timing',()=>{
  const slow=run(24,.5),normal=run(24,1),fast=run(24,2);
  assert.ok(Math.abs(slow.wall/normal.wall-2)<.04);
  assert.ok(Math.abs(fast.wall/normal.wall-.5)<.04);
  for(const result of [slow,normal,fast])
    assert.equal(result.events.reduce((n,e)=>n+e.count,0),24);
});

test('invalid counts, deltas and target directions are rejected',()=>{
  assert.throws(()=>createSwarm({count:361}),RangeError);
  assert.throws(()=>createSwarm({count:0}),RangeError);
  assert.throws(()=>createSwarm({count:24,batchSize:30}),RangeError);
  const swarm=createSwarm({count:24});
  assert.throws(()=>swarm.attack({x:0,y:0,z:0}),RangeError);
  assert.throws(()=>swarm.attack({x:Infinity,y:0,z:0}),TypeError);
  assert.throws(()=>swarm.step(-.1),TypeError);
  swarm.dispose();
  assert.equal(swarm.attack({x:1,y:0,z:0}),false);
});
