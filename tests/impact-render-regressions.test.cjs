const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const clouds=require('../src/render/impact-gpu-clouds.js');

const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('GPU plume sprites fade to zero before their square boundary',()=>{
  const fragment=clouds.fragmentShader;
  assert.match(fragment,/if\(r>=0\.47\)discard;/);
  assert.match(fragment,/float radial=1\.0-smoothstep\(0\.31,0\.468,r\)/);
  assert.match(fragment,/softEdge\*radial/);
  assert.match(fragment,/min\(0\.24,alpha\)/);
  assert.doesNotMatch(fragment,/vec4\(vec3\(1\.0\),1\.0\)/);
});

test('GPU plumes have independent budgeted smoke, surface dust and tiny embers',()=>{
  assert.match(clouds.vertexShader,/sqrt\(max\(0\.0,uSphereRadius\*uSphereRadius-radius\*radius\)\)/);
  assert.match(clouds.vertexShader,/uKind>1\.5\?13\.0/);
  assert.match(clouds.vertexShader,/uKind>0\.5\?78\.0:112\.0/);
  const material=source('src/render/impact-gpu-clouds.js');
  assert.match(material,/const dustCount=lowQuality\?12:24/);
  assert.match(material,/const emberCount=lowQuality\?8:18/);
  assert.match(material,/smokeCount=style\.smoke===0\?0/);
});

test('impact scene does not double-emit the legacy canvas smoke over GPU clouds',()=>{
  const html=source('index.html');
  assert.match(html,/atmosphericDust: planet\.id!=='moon' && !blast\.gpuDust/);
  assert.match(html,/if \(!blast\.gpuDust\) rocketFx\.burst\(/);
  const rocket=source('src/render/rocket-fx.js');
  assert.match(rocket,/globalCompositeOperation = 'destination-in'/);
  assert.match(rocket,/edgeMask\.addColorStop\(1, 'rgba\(255,255,255,0\)'\)/);
});

test('surface crater lip is restrained, without a bright brown raised ring',()=>{
  const damage=source('src/render/planet-damage.js');
  assert.match(damage,/altitude: 0\.065 \+ power \* 0\.008/);
  assert.doesNotMatch(damage,/altitude: 0\.14 \+ power \* 0\.018/);
});
