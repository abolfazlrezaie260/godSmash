const test=require('node:test');
const assert=require('node:assert/strict');
const timing=require('../src/render/impact-timing.js');

test('shock/fire flash is brief while ash remains visible in later stages',()=>{
  const ignition=timing.sample(.025);
  const fire=timing.sample(.16);
  const settling=timing.sample(.52);
  const tail=timing.sample(.83);
  assert.ok(ignition.flash>fire.flash);
  assert.ok(fire.flame>settling.flame);
  assert.ok(settling.dust>fire.dust);
  assert.ok(tail.dust>0);
  assert.ok(fire.shock>0);
  assert.ok(tail.shock<fire.shock);
  assert.ok(tail.fireScale>=fire.fireScale);
});

test('longer blast timing is independent of visual detail level',()=>{
  assert.ok(timing.duration(2.2,true)>=4.5);
  assert.ok(timing.duration(2.2,false)>=6);
  assert.ok(timing.duration(7,true)>timing.duration(2.2,true));
  assert.ok(timing.duration(7,false)>timing.duration(2.2,false));
});

test('all cinematic phase envelopes remain bounded at every progress input',()=>{
  for(let n=-10;n<=120;n++){
    const frame=timing.sample(n/100);
    for(const key of ['flame','plasma','shock','dust','flash']){
      assert.ok(frame[key]>=0 && frame[key]<=1,key+' must remain normalized');
    }
    for(const key of ['fireScale','shellScale','dustScale','shockScale']){
      assert.ok(frame[key]>0 && Number.isFinite(frame[key]));
    }
  }
  assert.equal(timing.sample(1).flash,0);
  assert.equal(timing.sample(1).dust,0);
});
