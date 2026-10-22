const test = require('node:test');
const assert = require('node:assert/strict');
const damage = require('../src/render/planet-damage.js');
const effects = require('../src/render/impact-effects.js');

class Vector3 {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  clone(){return new Vector3(this.x,this.y,this.z);}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
  length(){return Math.hypot(this.x,this.y,this.z);}
  normalize(){const len=this.length()||1;return this.multiplyScalar(1/len);}
  dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
  cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}
  fromBufferAttribute(attr,i){this.x=attr.array[i*3];this.y=attr.array[i*3+1];this.z=attr.array[i*3+2];return this;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Color {
  constructor(value){this.set(value);}
  set(value){
    let hex=typeof value==='number'?value:parseInt(String(value).replace('#',''),16);
    this.r=((hex>>16)&255)/255;this.g=((hex>>8)&255)/255;this.b=(hex&255)/255;
    return this;
  }
}
class Node {
  constructor(geometry,material) {this.geometry=geometry;this.material=material;this.children=[];this.visible=true;this.name='';this.position=new Vector3();this.rotation={z:0};this.scale={setScalar(v){this.value=v;},set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.userData={};}
  add(child){this.children.push(child);}
  remove(child){this.children=this.children.filter(x=>x!==child);}
  traverse(fn){fn(this);for(const child of this.children)child.traverse(fn);}
}
class Geometry {
  constructor(){this.attributes={};this.index=null;this.disposals=0;}
  setAttribute(name,val){this.attributes[name]=val;}
  setIndex(list){this.index={array:Array.from(list)};}
  computeVertexNormals(){}
  computeBoundingSphere(){}
  dispose(){this.disposals++;}
}
class BufferAttribute {
  constructor(list,size){this.array=new Float32Array(list);this.itemSize=size;this.count=list.length/size;this.needsUpdate=false;}
  setXYZ(i,x,y,z){this.array[i*3]=x;this.array[i*3+1]=y;this.array[i*3+2]=z;}
}
class Material {
  constructor(props={}){Object.assign(this,props);this.disposals=0;this.color=new Color(props.color||'#ffffff');this.emissive=new Color(props.emissive||'#000000');}
  dispose(){this.disposals++;}
}
function globe(radius=10,longitude=48,latitude=24) {
  const geo=new Geometry(),points=[],ids=[];
  for(let lat=0;lat<=latitude;lat++){
    const elevation=(lat/latitude-.5)*Math.PI;
    for(let lon=0;lon<=longitude;lon++){
      const angle=lon/longitude*Math.PI*2;
      points.push(radius*Math.cos(elevation)*Math.cos(angle),
        radius*Math.sin(elevation),radius*Math.cos(elevation)*Math.sin(angle));
    }
  }
  for(let a=0;a<latitude;a++)for(let b=0;b<longitude;b++){
    const i=a*(longitude+1)+b,k=i+longitude+1;
    ids.push(i,k,i+1,i+1,k,k+1);
  }
  geo.setAttribute('position',new BufferAttribute(points,3));
  geo.setIndex(ids);return geo;
}
const THREE = {
  Vector3, Color, Group:Node, Mesh:Node,
  SphereGeometry:class extends Geometry {},
  BufferGeometry:Geometry, Float32BufferAttribute:BufferAttribute,
  MeshStandardMaterial:Material, MeshBasicMaterial:Material,
  DoubleSide:2, AdditiveBlending:1,
  IcosahedronGeometry:Geometry, RingGeometry:Geometry,
  ShaderMaterial:Material,
  PointLight:class extends Node {constructor(color,intensity,distance){super();this.color=color;this.intensity=intensity;this.distance=distance;}}
};
const mars={id:'mars',resistance:0.85};
const moon={id:'moon',resistance:0.7};
const asteroid={kind:'asteroid',damage:7,plasmaColor:'#f97316'};

test('asteroid can remove triangles, expose interior, preserve holes and reset topology',()=>{
  const geometry=globe();
  const parent=new Node();
  const engine=damage.createSystem(THREE,{geometry,group:parent,radius:10,lowQuality:false});
  engine.setPlanet(mars);
  const initialCount=geometry.index.array.length;
  const point=new Vector3(0,0,10);
  const hole=engine.impact(point,3.5,{planet:mars,weapon:asteroid,breach:true});
  assert.equal(hole.breached,true);
  assert.ok(geometry.index.array.length < initialCount);
  assert.equal(engine.getBreachCount(),1);
  assert.equal(engine.getImpactSiteCount(),1);
  assert.ok(engine.getDamagePercent() > 0 && engine.getDamagePercent() < 100);
  const firstCoverage = engine.getDamagePercent();
  assert.equal(parent.children[0].visible,true,'exposed core becomes visible');
  assert.equal(parent.children[1].name,'Exposed fractured crust');
  const repeat=engine.impact(point,3.5,{planet:mars,weapon:asteroid,breach:true});
  assert.equal(repeat.breached,false,'overlapping holes do not add duplicate geometry');
  assert.equal(engine.getBreachCount(),1);
  assert.equal(engine.getImpactSiteCount(),1, 'overlapping hits are merged into one persistent damage site');
  assert.ok(engine.getDamagePercent() >= firstCoverage);
  engine.setShattered(true);
  assert.equal(parent.children[0].visible,false);
  engine.reset();
  assert.equal(geometry.index.array.length,initialCount);
  assert.equal(engine.getBreachCount(),0);
  assert.equal(engine.getImpactSiteCount(),0);
  assert.equal(engine.getDamagePercent(),0, 'reset clears accumulated surface damage');
  assert.equal(parent.children.length,1,'scar mesh removed after reset');
  assert.equal(parent.children[0].visible,false);
});
test('rocky planet accepts multiple non-overlapping breaches and quality budget',()=>{
  const geometry=globe(),parent=new Node();
  const engine=damage.createSystem(THREE,{geometry,group:parent,radius:10,lowQuality:true});
  assert.equal(engine.getMaxBreaches(),6);
  const first=engine.impact(new Vector3(0,0,10),3.5,{planet:moon,weapon:asteroid,breach:true});
  const second=engine.impact(new Vector3(0,0,-10),3.5,{planet:moon,weapon:asteroid,breach:true});
  assert.equal(first.breached,true);
  assert.equal(second.breached,true);
  assert.equal(engine.getBreachCount(),2);
});
test('missile crater deforms without deleting triangles until breach is requested',()=>{
  const geometry=globe(), parent=new Node();
  const engine=damage.createSystem(THREE,{geometry,group:parent,radius:10,lowQuality:false});
  const initialIndex=geometry.index.array.length;
  const originalPositions=Array.from(geometry.attributes.position.array);
  const r=engine.impact(new Vector3(10,0,0),1.9,{
    planet:mars,weapon:{damage:4.2},breach:false
  });
  assert.equal(r.breached,false);
  assert.equal(geometry.index.array.length,initialIndex);
  assert.notDeepEqual(Array.from(geometry.attributes.position.array),originalPositions);
  engine.reset();
  assert.deepEqual(Array.from(geometry.attributes.position.array),originalPositions);
});
test('blast factory animates and safely disposes of all unique resources',()=>{
  const eff=effects.createEffect(THREE,{
    plasmaColor:'#f97316',fireColor:'#fff4b4',waveColor:'#ffaa72'
  },2.3,false);
  assert.equal(eff.duration,2.65);
  assert.ok(eff.group.children.length>=4, 'fireball, plasma and two surface shock rings');
  const shaderFire = eff.group.children[0].material;
  assert.ok(shaderFire.uniforms.uTime);
  assert.ok(shaderFire.fragmentShader.includes('fbm'), 'fireball uses a turbulent procedural shader');
  assert.doesNotThrow(()=>eff.update(0.5));
  assert.ok(shaderFire.uniforms.uTime.value > 0);
  assert.doesNotThrow(()=>eff.update(1));
  const mats=new Set(),geos=new Set();
  eff.group.traverse(child=>{if(child.geometry)geos.add(child.geometry);if(child.material)mats.add(child.material);});
  eff.dispose();eff.dispose();
  geos.forEach(g=>assert.equal(g.disposals,1));
  mats.forEach(m=>assert.equal(m.disposals,1));
});

test('grazing impacts create wider, shallower craters than direct impacts', () => {
  const directGeometry = globe(), directParent = new Node();
  const direct = damage.createSystem(THREE, {
    geometry: directGeometry, group: directParent, radius: 10, lowQuality: false
  });
  const directResult = direct.impact(new Vector3(0, 0, 10), 2, {
    planet: mars, weapon: {damage: 4.2}, breach: false,
    incidence: 1, impactDirection: new Vector3(0, 0, -1)
  });

  const grazingGeometry = globe(), grazingParent = new Node();
  const grazing = damage.createSystem(THREE, {
    geometry: grazingGeometry, group: grazingParent, radius: 10, lowQuality: false
  });
  const grazingResult = grazing.impact(new Vector3(0, 0, 10), 2, {
    planet: mars, weapon: {damage: 4.2}, breach: false,
    incidence: 0.15, impactDirection: new Vector3(1, 0, -0.15).normalize()
  });
  assert.ok(grazingResult.effectiveRadius > directResult.effectiveRadius);
  assert.ok(grazingResult.depth < directResult.depth);
  assert.equal(grazingResult.incidence, 0.15);
  direct.reset();
  grazing.reset();
});
