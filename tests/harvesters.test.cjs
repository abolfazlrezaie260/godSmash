const test=require('node:test');
const assert=require('node:assert/strict');
const {createFleet}=require('../src/simulation/harvesters.js');
const mag=v=>Math.hypot(v.x,v.y,v.z);

function simulate(count=6,speed=1){
  const fleet=createFleet({count,radius:10});
  fleet.pointAt({x:0,y:0,z:1});
  const events=[];let wallTime=0;
  while(fleet.getState().mode!=='spent'&&wallTime<35){
    const hits=fleet.step(speed/60);
    events.push(...hits.map(e=>({...e,time:wallTime})));
    wallTime+=1/60;
  }
  return {fleet,events,wallTime};
}

test('6 or 9 hovering UFOs continually move above the planet before extraction',()=>{
  for(const count of [6,9]){
    const fleet=createFleet({count,radius:10});
    assert.equal(fleet.getState().mode,'hover');
    assert.equal(fleet.getShips().length,count);
    const first={...fleet.getShips()[0].position};
    assert.deepEqual(fleet.step(.05),[]);
    assert.notDeepEqual(fleet.getShips()[0].position,first);
    assert.ok(fleet.getShips().every(s=>mag(s.position)>12.5 && !s.beamActive));
    fleet.dispose();
    assert.equal(fleet.getState().mode,'spent');
    assert.equal(fleet.getShips().length,0);
  }
});

test('all vessels approach, extract crust twice and exit out of bounds',()=>{
  for(const count of [6,9]){
    const {fleet,events,wallTime}=simulate(count);
    assert.equal(fleet.getState().mode,'spent');
    assert.equal(fleet.getState().active,0);
    assert.equal(events.length,count*2);
    assert.equal(events[0].cycle,1);
    assert.equal(fleet.getState().extractions,count*2);
    assert.ok(events[0].time>=2,'the UFOs must approach before drilling');
    assert.ok(events.at(-1).time-events[0].time>1.2,'harvesting takes visible time');
    assert.ok(wallTime>6.5&&wallTime<12,'exit is a bounded mission');
    assert.ok(fleet.getShips().every(s=>s.done&&s.phase==='gone'&&mag(s.position)>30));
    assert.ok(events.every(e=>e.radius>0 && e.depth>0 && Math.abs(mag(e.normal)-1)<1e-6));
    assert.equal(fleet.pointAt({x:1,y:0,z:0}),false);
  }
});

test('retargeting halfway through harvesting sends surviving ships to new spot',()=>{
  const fleet=createFleet({count:6,radius:10});
  fleet.pointAt({x:0,y:0,z:1});
  for(let i=0;i<70;i++)fleet.step(.05);
  assert.equal(fleet.pointAt({x:0,y:1,z:0}),true);
  const hits=[];
  for(let i=0;i<300&&fleet.getState().mode!=='spent';i++){
    fleet.step(.05,e=>hits.push(e));
  }
  assert.equal(hits.length,12);
  assert.ok(hits.every(h=>h.normal.y>.98),'new taps determine all remaining extraction targets');
  assert.equal(fleet.getState().mode,'spent');
});

test('0.5x and 2x game-time speed scale the mission duration, not extraction counts',()=>{
  const slow=simulate(6,.5),normal=simulate(6,1),fast=simulate(6,2);
  assert.ok(Math.abs(slow.wallTime/normal.wallTime-2)<.04);
  assert.ok(Math.abs(fast.wallTime/normal.wallTime-.5)<.04);
  for(const result of [slow,normal,fast])assert.equal(result.events.length,12);
});

test('invalid scene dimensions, target vectors and elapsed times are rejected',()=>{
  assert.throws(()=>createFleet({count:13}),RangeError);
  assert.throws(()=>createFleet({count:0}),RangeError);
  assert.throws(()=>createFleet({radius:Infinity}),RangeError);
  const fleet=createFleet();
  assert.throws(()=>fleet.pointAt({x:0,y:0,z:0}),RangeError);
  assert.throws(()=>fleet.pointAt({x:Infinity,y:0,z:0}),TypeError);
  assert.throws(()=>fleet.step(-.5),TypeError);
  assert.deepEqual(fleet.step(0),[]);
});
