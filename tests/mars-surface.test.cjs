const test=require('node:test');
const assert=require('node:assert/strict');
const mars=require('../src/render/mars-surface.js');
const catalog=require('../src/content/catalog.js');
const textures=require('../src/render/planet-textures.js');

function context(){
  const ctx={
    image:null,fillStyle:null,strokeStyle:null,lineWidth:0,strokeCount:0,fillCount:0,
    createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
    putImageData(image,x,y){assert.equal(x,0);assert.equal(y,0);this.image=image;},
    fillRect(x,y,w,h){this.fillCount++;this.lastFill={x,y,w,h,style:this.fillStyle};},
    beginPath(){},ellipse(){},stroke(){this.strokeCount++;}
  };
  return ctx;
}
function colorAt(ctx,x,y){
  const i=(y*ctx.image.width+x)*4;
  return Array.from(ctx.image.data.slice(i,i+4));
}
test('Mars geography contains polar ice and contrasting high/low albedo terrain',()=>{
  const equator=mars.terrain(30,0),north=mars.terrain(30,88),south=mars.terrain(30,-88);
  assert.equal(north.ice,1);
  assert.equal(south.ice,1);
  assert.equal(equator.ice,0);
  assert.ok(north.color[0]>equator.color[0]+35);
  assert.ok(north.color[2]>equator.color[2]+80);
  assert.ok(mars.terrain(70,9).dark>mars.terrain(93,9).dark+.5,
    'Syrtis Major must remain distinguishably darker');
});

test('major topographical signatures are geographically placed and measurable',()=>{
  assert.ok(mars.heightAt(225,18)>mars.heightAt(235,18)+8,'Olympus Mons summit');
  assert.ok(mars.heightAt(70,-45)<mars.heightAt(85,-45)-4,'Hellas basin');
  assert.ok(mars.heightAt(303,-14)<mars.heightAt(303,-30)-2,'Valles Marineris');
  assert.equal(mars.landmarks.olympusMons.lon,225);
  assert.equal(mars.landmarks.hellas.lat,-45);
  assert.equal(mars.volcanoes.length,5);
});

test('seam remains identical across 0 and 360 E and sampling is deterministic',()=>{
  for(const lat of [-88,-45,-14,0,18,85]){
    assert.deepEqual(mars.terrain(0,lat),mars.terrain(360,lat));
    assert.deepEqual(mars.terrain(-360,lat),mars.terrain(720,lat));
    assert.deepEqual(mars.terrain(303,lat),mars.terrain(303,lat));
    assert.ok(mars.heightAt(303,lat)>=-10);
    assert.ok(mars.heightAt(303,lat)<=22);
  }
});

test('Mars painter outputs opaque RGB map, zero emissive glow, repeatable resets',()=>{
  const surface=context(),emissive=context();
  const p=catalog.getPlanet('mars');
  assert.equal(textures.paint(p,surface,emissive,192,96),true);
  assert.equal(surface.image.data.length,192*96*4);
  assert.equal(emissive.lastFill.style,'#000000');
  assert.deepEqual([emissive.lastFill.w,emissive.lastFill.h],[192,96]);
  const snapshot=Array.from(surface.image.data);
  assert.ok(surface.strokeCount>20,'subtle crater terrain detail must be generated');
  const northern=colorAt(surface,23,3);
  const equatorial=colorAt(surface,23,48);
  assert.equal(northern[3],255);
  assert.ok(northern[2]>equatorial[2]);
  assert.equal(textures.paint(p,surface,emissive,192,96),true);
  assert.deepEqual(Array.from(surface.image.data),snapshot);
});

test('bump map is grayscale, geographic, and has reusable GPU resource',()=>{
  const canvases=[];
  const doc={createElement(tag){
    assert.equal(tag,'canvas');
    const c={width:0,height:0,context:context(),getContext(){return this.context;}};
    canvases.push(c);return c;
  }};
  class CanvasTexture{constructor(canvas){this.image=canvas;this.disposeCount=0;}
    dispose(){this.disposeCount++;}}
  const THREE={CanvasTexture,RepeatWrapping:1000};
  const map=mars.createBumpTexture(THREE,doc,72,36);
  assert.equal(map.wrapS,1000);
  assert.equal(map.anisotropy,2);
  assert.equal(map.image.width,72);
  const pixels=map.image.context.image.data;
  assert.equal(pixels.length,72*36*4);
  for(let i=0;i<pixels.length;i+=4){
    assert.equal(pixels[i],pixels[i+1]);
    assert.equal(pixels[i],pixels[i+2]);
    assert.equal(pixels[i+3],255);
  }
  assert.throws(()=>mars.createBumpTexture({},doc),TypeError);
  map.dispose();assert.equal(map.disposeCount,1);
});
