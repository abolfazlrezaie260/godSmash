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
test('missile display lengths respect screen size, country distance and weapon profile',()=>{
  const calc=overlay.missileDisplayLength;
  assert.ok(calc(1600,1000,'strategic')<65);
  assert.ok(calc(1600,1000,'strategic')>45);
  assert.ok(calc(1600,70,'strategic')<=20);
  assert.ok(calc(420,1000,'cruise')<20);
  assert.ok(calc(1200,500,'siege')>calc(1200,500,'interceptor'));
  assert.ok(calc(1200,250,'strategic')<calc(1200,900,'strategic'));
  const view={x:180,y:0,w:180,h:90};
  const small={start:{x:210,y:20},end:{x:220,y:20}};
  const large={start:{x:210,y:20},end:{x:280,y:20}};
  assert.ok(overlay.routePixelLength(small,view,1200,800) <
    overlay.routePixelLength(large,view,1200,800));
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
  let cameraInstance;
  class Camera {
    constructor(){
      cameraInstance=this;
      this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    }
    lookAt(x,y,z){this.target=[x,y,z];}
    updateProjectionMatrix(){}
  }
  const THREE={WebGLRenderer:Renderer,Vector3:Vec,Scene,OrthographicCamera:Camera,
    HemisphereLight:Light,DirectionalLight:Light,sRGBEncoding:3001,ACESFilmicToneMapping:4};
  const modelFactory={createMissile(three,profile,quality,radius){
    assert.equal(three,THREE);made.push([profile,quality,radius]);
    return {group:{scale:{setScalar(x){this.size=x;}},position:{set(x,y,z){this.x=x;this.y=y;}},
      quaternion:{setFromUnitVectors(a,b){this.heading={x:b.x,y:b.y,z:b.z};}},
      rotateZ(angle){this.roll=angle;},visible:false},
      dispose(){disposed.push(profile);}};
  }};
  const canvas={clientWidth:1200,clientHeight:800},svg={clientWidth:1200,clientHeight:800};
  const renderer=overlay.mount({canvas,svg,THREE,projectileModels:modelFactory});
  renderer.setActive(true);
  assert.equal(cameraInstance.left,0);
  assert.equal(cameraInstance.right,1200);
  assert.equal(cameraInstance.top,0);
  assert.equal(cameraInstance.bottom,-800);
  assert.equal(cameraInstance.position.x,0);
  assert.equal(cameraInstance.position.y,0);
  assert.deepEqual(cameraInstance.target,[0,0,0]);
  const route={start:{x:200,y:30},end:{x:270,y:55}};
  const missile=renderer.launch({kind:'missile',visualProfile:'cruise'},route);
  assert.deepEqual(made,[['cruise','high',10]]);
  assert.equal(missile.displayLength,0); // scale is calculated once the view is known
  const view={x:180,y:0,w:180,h:90};
  const mapPoint={x:220,y:45};
  renderer.position(missile,mapPoint,{x:225,y:45},view);
  assert.ok(missile.displayLength>=14 && missile.displayLength<62);
  assert.ok(missile.model.group.scale.size>0);
  assert.equal(missile.model.group.scale.size,missile.displayLength/missile.bodyLength);
  assert.ok(missile.model.group.quaternion.heading.x>0.9);
  assert.ok(missile.model.group.quaternion.heading.z>0);
  assert.equal(missile.model.group.roll,0.16);
  const projected=overlay.projectPoint(mapPoint,view,1200,800);
  assert.equal(missile.model.group.position.x,projected.x);
  assert.equal(missile.model.group.position.y,-projected.y);
  assert.equal(missile.model.group.visible,true);
  // Rockets must remain visible even on the western edge of the screen.
  renderer.position(missile,{x:185,y:5},{x:190,y:6},view);
  assert.equal(missile.model.group.visible,true);
  assert.ok(missile.model.group.position.x<120);
  // Heading must follow all cardinal directions without the previous
  // rotateY side-slip: the nose tracks travel, even when firing west.
  renderer.position(missile,{x:250,y:40},{x:245,y:40},view);
  assert.ok(missile.model.group.quaternion.heading.x < -0.9);
  renderer.position(missile,{x:240,y:35},{x:240,y:40},view);
  assert.ok(missile.model.group.quaternion.heading.y < -0.9);
  renderer.position(missile,{x:240,y:45},{x:240,y:40},view);
  assert.ok(missile.model.group.quaternion.heading.y > 0.9);
  const beforeZoom=missile.displayLength;
  renderer.position(missile,{x:185,y:5},{x:190,y:6},
    {x:180,y:0,w:360,h:180});
  assert.ok(missile.displayLength<=beforeZoom);
  assert.ok(missile.model.group.quaternion.heading.y<0);
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
  assert.match(src,/missileVisuals.launch\(weapon, r\)/);
  assert.match(src,/missileVisuals.position\(s.model,p,q,view\)/);
  assert.match(html,/id="geo-projectile-canvas"/);
  assert.match(html,/missileVisuals: continentProjectiles/);
  assert.match(src,/BlueMarble_NextGeneration/);
});
