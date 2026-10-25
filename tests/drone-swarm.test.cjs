const test=require('node:test');
const assert=require('node:assert/strict');
const {createSwarm}=require('../src/simulation/drone-swarm.js');

function run(count=192,scale=1){
  const swarm=createSwarm({count,planetRadius:10,batchSize:12});
  assert.equal(swarm.attack({x:1,y:0,z:0}),true);
  const events=[];
  let wall=0;
  while(swarm.getState().mode!=='spent' && wall<60){
    swarm.step((1/60)*scale,e=>events.push({time:wall, ...e}));
    wall+=1/60;
  }
  return {swarm,events,wall};
}

test('hundreds of drones visibly orbit without attacking until tapped',()=>{
  const swarm=createSwarm({count:192,planetRadius:10,batchSize:12});
  const drones=swarm.getDrones();
  assert.equal(drones.length,192);
  assert.ok(drones.every(d=>d.visible&&!d.done));
  assert.equal(swarm.getState().mode,'orbit');
  const original={...drones[25].position};
  assert.ok(Math.hypot(...Object.values(original))>10);
  assert.deepEqual(swarm.step(.1),[]);
  assert.notDeepEqual(drones[25].position,original);
  assert.equal(swarm.getState().impacts,0);
  assert.ok(swarm.getDrones().every(d=>Math.hypot(...Object.values(d.position))>10));
  swarm.dispose();
  assert.equal(swarm.getDrones().length,0);
  assert.equal(swarm.getState().mode,'spent');
});

test('each 192/312-unit attack converges into continuous staggered impacts',()=>{
  for(const count of [192,312]){
    const {swarm,events,wall}=run(count);
    assert.equal(swarm.getState().alive,0);
    assert.equal(events.length,count/12);
    assert.equal(swarm.getState().impacts,count/12);
    assert.equal(events.reduce((n,e)=>n+e.count,0),count);
    assert.ok(events[0].time>2.5,'first impact should be visible only after an approach');
    assert.ok(events.at(-1).time-events[0].time>3,
      'cascading damage should unfold over many seconds');
    assert.ok(wall>6&&wall<13,'swarm finishes in bounded game time');
    assert.ok(events.every(e=>e.count===12&&Math.abs(Math.hypot(...Object.values(e.normal))-1)<1e-7));
    assert.ok(events.every(e=>Math.hypot(...Object.values(e.position))>9.99));
    assert.equal(swarm.attack({x:0,y:1,z:0}),false,'spent swarm must be replaced');
    swarm.dispose();
  }
});

test('second click redirects every surviving drone while mid-flight',()=>{
  const swarm=createSwarm({count:192,planetRadius:10});
  swarm.attack({x:1,y:0,z:0});
  for(let i=0;i<47;i++)swarm.step(.05);
  const before={...swarm.getDrones()[70].position};
  assert.equal(swarm.attack({x:-1,y:0,z:0}),true);
  assert.deepEqual(swarm.getState().target,{x:-1,y:0,z:0});
  for(let i=0;i<12;i++)swarm.step(.05);
  assert.notDeepEqual(swarm.getDrones()[70].position,before);
  const hits=[];
  for(let i=0;i<260&&swarm.getState().mode!=='spent';i++)swarm.step(.05,e=>hits.push(e));
  assert.ok(hits.length>0);
  assert.ok(hits.every(e=>e.normal.x<-.99),'remaining swarm moved toward changed target');
  assert.equal(swarm.getState().alive,0);
});

test('0.5x and 2x speed settings drive the same deterministic simulation',()=>{
  const slow=run(192,.5),normal=run(192,1),fast=run(192,2);
  assert.ok(Math.abs(slow.wall/normal.wall-2)<.04);
  assert.ok(Math.abs(fast.wall/normal.wall-.5)<.04);
  for(const r of [slow,normal,fast])
    assert.equal(r.events.reduce((n,e)=>n+e.count,0),192);
});

test('invalid counts, deltas and target directions are rejected',()=>{
  assert.throws(()=>createSwarm({count:361}),RangeError);
  assert.throws(()=>createSwarm({count:0}),RangeError);
  assert.throws(()=>createSwarm({count:192,batchSize:300}),RangeError);
  const swarm=createSwarm({count:192});
  assert.throws(()=>swarm.attack({x:0,y:0,z:0}),RangeError);
  assert.throws(()=>swarm.attack({x:Infinity,y:0,z:0}),TypeError);
  assert.throws(()=>swarm.step(-.1),TypeError);
});
