const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overlay=require('../src/render/continent-projectiles.js');

test('map screen projection handles zoom and letterboxing',()=>{
  assert.deepEqual(overlay.projectPoint({x:50,y:25},{x:0,y:0,w:100,h:50},1000,600),{x:500,y:300,scale:10});
  assert.equal(overlay.projectPoint({x:0,y:0},{x:0,y:0,w:100,h:50},1000,1000).y,250);
  assert.throws(()=>overlay.projectPoint(null,{w:1,h:1},20,20),TypeError);
});
test('map wrap selects the copy nearest the screen',()=>{
  assert.equal(overlay.pickWrappedPoint({x:5,y:30},{x:350,w:120}).x,365);
  assert.equal(overlay.pickWrappedPoint({x:355,y:30},{x:0,w:120}).x,-5);
});
test('real missile model uses the selected weapon profile and is disposed',()=>{
  const made=[],disposed=[];
  class Vec {constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
  class Renderer {setClearColor(){}setPixelRatio(){}setSize(){}clear(){}render(){}dispose(){}}
  class Scene {add(){}remove(){}}
  class Light {constructor(){this.position={set(){}};}}
  class Camera {constructor(){this.position={set(){}};}lookAt(){}updateProjectionMatrix(){}}
  const THREE={WebGLRenderer:Renderer,Vector3:Vec,Scene,OrthographicCamera:Camera,
    HemisphereLight:Light,DirectionalLight:Light,sRGBEncoding:3001,ACESFilmicToneMapping:4};
  const modelFactory={createMissile(three,profile,quality,radius){
    assert.equal(three,THREE);made.push([profile,quality,radius]);
    return {group:{scale:{setScalar(x){this.size=x;}},position:{set(x,y,z){this.x=x;this.y=y;}},
      quaternion:{setFromUnitVectors(a,b){this.heading=b;}},rotateY(){},visible:false},
      dispose(){disposed.push(profile);}};
  }};
  const canvas={clientWidth:1200,clientHeight:800},svg={clientWidth:1200,clientHeight:800};
  const renderer=overlay.mount({canvas,svg,THREE,projectileModels:modelFactory});
  renderer.setActive(true);
  const missile=renderer.launch({kind:'missile',visualProfile:'cruise'});
  assert.deepEqual(made,[['cruise','high',10]]);
  // Full missile body (not the tiny orbital size) remains > 80 screen pixels.
  assert.ok(missile.displayLength>=82);
  assert.ok(missile.displayLength<=148);
  assert.ok(missile.model.group.scale.size>=30);
  renderer.position(missile,{x:220,y:45},{x:225,y:45},{x:180,y:0,w:180,h:90});
  assert.equal(missile.model.group.visible,true);
  renderer.render();
  assert.equal(renderer.getActiveCount(),1);
  renderer.remove(missile);renderer.remove(missile);
  assert.deepEqual(disposed,['cruise']);
  renderer.setActive(false);
  assert.equal(canvas.hidden,true);
  renderer.dispose();
});
test('continental flight uses WebGL model rather than the old arrow',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../src/ui/continent-mode.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.doesNotMatch(src,/const body=svgEl/);
  assert.doesNotMatch(src,/const plume=svgEl/);
  assert.match(src,/missileVisuals.launch\(weapon\)/);
  assert.match(src,/missileVisuals.position\(s.model,p,q,view\)/);
  assert.match(html,/id="geo-projectile-canvas"/);
  assert.match(html,/missileVisuals: continentProjectiles/);
  assert.match(src,/BlueMarble_NextGeneration/);
});
