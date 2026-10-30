const test=require('node:test');
const assert=require('node:assert/strict');
const effects=require('../src/render/impact-effects.js');
const fs=require('node:fs');
const path=require('node:path');

function fakeTHREE(){
  const created={geometries:[],materials:[]};
  class Vec {
    constructor(x=0,y=0,z=0){this.set(x,y,z);}
    set(x,y,z){this.x=x;this.y=y;this.z=z;}
  }
  class Node {
    constructor(geometry,material){
      this.geometry=geometry;this.material=material;this.children=[];
      this.position=new Vec();this.scale={setScalar(n){this.x=this.y=this.z=n;},
        set(x,y,z){this.x=x;this.y=y;this.z=z;}};
      this.userData={};this.visible=true;
    }
    add(x){this.children.push(x);}
    traverse(fn){fn(this);this.children.forEach(x=>x.traverse(fn));}
  }
  class Geometry {
    constructor(){this.disposals=0;created.geometries.push(this);this.attributes={};}
    setAttribute(name,value){this.attributes[name]=value;}
    setIndex(indices){this.indices=indices;}
    dispose(){this.disposals++;}
  }
  class Attribute {
    constructor(array,size){this.array=array;this.size=size;}
    setXYZ(i,x,y,z){
      this.array[i*3]=x;this.array[i*3+1]=y;this.array[i*3+2]=z;
    }
  }
  class Material {
    constructor(options){Object.assign(this,options);this.disposals=0;created.materials.push(this);}
    dispose(){this.disposals++;}
  }
  class Light extends Node {
    constructor(color,intensity,range){super();this.color=color;this.intensity=intensity;this.distance=range;}
  }
  return {
    created,
    THREE:{
      Group:Node, Mesh:Node, PointLight:Light, Color:class {constructor(c){this.value=c;}},
      ShaderMaterial:Material,MeshBasicMaterial:Material,
      IcosahedronGeometry:Geometry,BufferGeometry:Geometry,BufferAttribute:Attribute,
      DoubleSide:'both',AdditiveBlending:'add'
    }
  };
}
const weapon={fireColor:'#ffbb80',plasmaColor:'#e76b36',waveColor:'#ffd18c'};

test('every planet has an atmospheric impact signature',()=>{
  const earth=effects.planetStyle('earth');
  const mars=effects.planetStyle('mars');
  const moon=effects.planetStyle('moon');
  const venus=effects.planetStyle('venus');
  assert.ok(earth.smoke>mars.smoke && mars.smoke>moon.smoke);
  assert.equal(moon.smoke,0);
  assert.ok(venus.smoke>earth.smoke);
  assert.ok(moon.wave<earth.wave);
  assert.equal(effects.planetStyle('unknown'),earth);
});

test('shockwave vertices hug a spherical surface instead of a flat ring',()=>{
  const R=10;
  const center=effects.surfacePoint(0,0,R,0.05);
  const outer=effects.surfacePoint(2.8,0,R,0.05);
  assert.equal(center.z,0.05);
  assert.ok(outer.z<-0.30);
  assert.ok(outer.z> -0.6);
  const diagonal=effects.surfacePoint(2.8,Math.PI/2,R,0.05);
  assert.ok(Math.abs(diagonal.x)<1e-8);
  assert.ok(Math.abs(diagonal.z-outer.z)<1e-8);
  const mock=fakeTHREE();
  const segments=8;
  const geo=new mock.THREE.BufferGeometry();
  geo.setAttribute('position',new mock.THREE.BufferAttribute(
    new Float32Array((segments+1)*6),3));
  effects.setSurfaceRing(geo,2.4,2.8,R,segments,0.05);
  assert.ok(geo.attributes.position.needsUpdate);
  assert.ok(geo.attributes.position.array[2]<0);
  assert.ok(geo.attributes.position.array[5]<0);
});

test('multistage Earth impact expands, cools and cleans up every GPU resource',()=>{
  const {THREE,created}=fakeTHREE();
  const effect=effects.createEffect(THREE,weapon,2.1,false,{planetId:'earth',planetRadius:10});
  assert.equal(effect.planetId,'earth');
  assert.ok(effect.smokeCount>=10);
  assert.equal(effect.rings.length,2);
  assert.ok(effect.group.children.length>15);
  const fire=effect.group.children[0],flash=effect.group.children.find(x=>x instanceof THREE.PointLight);
  effect.update(.16);
  const hotOpacity=fire.material.uniforms.uAlpha.value;
  const ringOpacity=effect.rings[0].material.opacity;
  const radius=effect.rings[0].geometry.attributes.position.array[3];
  assert.ok(hotOpacity>0);
  assert.ok(ringOpacity>0);
  assert.ok(flash.intensity>=0);
  effect.update(.83);
  assert.ok(fire.material.uniforms.uAlpha.value<hotOpacity);
  assert.ok(effect.rings[0].material.opacity<ringOpacity);
  assert.ok(Math.abs(effect.rings[0].geometry.attributes.position.array[3])>=Math.abs(radius));
  effect.dispose();
  effect.dispose();
  assert.ok(created.geometries.length>0);
  assert.ok(created.geometries.every(x=>x.disposals===1));
  assert.ok(created.materials.every(x=>x.disposals===1));
});

test('Moon has no suspended smoke and low-quality effects use fewer resources',()=>{
  const high=fakeTHREE();
  const lunar=effects.createEffect(high.THREE,weapon,2.3,false,
    {planetId:'moon',planetRadius:10});
  const low=fakeTHREE();
  const martian=effects.createEffect(low.THREE,weapon,2.3,true,
    {planetId:'mars',planetRadius:10});
  assert.equal(lunar.smokeCount,0);
  assert.ok(martian.smokeCount>0);
  assert.ok(martian.smokeCount<effects.createEffect(
    low.THREE,weapon,2.3,false,{planetId:'earth',planetRadius:10}).smokeCount);
  assert.equal(martian.rings.length,2);
  assert.equal(martian.rings[0].geometry.attributes.position.array.length,(24+1)*6);
  assert.ok(lunar.duration>0);
  lunar.dispose();martian.dispose();
});

test('planetary hit integration supplies environment parameters and suppresses lunar smoke',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/planetId:planet.id, planetRadius:EARTH_RADIUS/);
  assert.match(html,/atmosphericDust: planet.id!=='moon'/);
  assert.match(html,/if \(planet.id !== 'moon'\)/);
  assert.match(html,/if \(effect.atmosphericDust &&/);
  const fx=fs.readFileSync(path.join(__dirname,'../src/render/impact-effects.js'),'utf8');
  assert.doesNotMatch(fx,/vUv \* vec2\(17\.0, 10\.0\)/);
  assert.match(fx,/vLocal=position/);
  assert.match(fx,/setSurfaceRing\(ring.geometry/);
});
