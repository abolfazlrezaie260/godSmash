const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const moonModuleSource = fs.readFileSync(
  path.join(__dirname, '../src/render/real-moon.js'), 'utf8');

function setup({failPrimary=false,failAll=false}={}){
  const calls=[];
  class MockImage {
    constructor(){this.naturalWidth=2048;this.naturalHeight=1024;}
    set src(url){
      this.url=url;calls.push(this);
      queueMicrotask(()=>{
        if(failAll || (failPrimary && url.includes('moon_4096.jpg'))){
          this.onerror(new Error('offline'));
        }else{
          this.onload();
        }
      });
    }
  }
  const root={Image:MockImage};
  const mod={exports:{}};
  new Function('window','module',moonModuleSource)(root,mod);
  return {moon:mod.exports,calls};
}

test('lunar imagery is a global NASA-derived equirectangular map with a real fallback',()=>{
  const {moon}=setup();
  assert.match(moon.sources.albedo[0],/moon_4096\.jpg$/);
  assert.match(moon.sources.albedo[1],/svs\.gsfc\.nasa\.gov/);
  assert.match(moon.sources.relief,/moon_height_1024\.jpg$/);
  assert.match(moon.sources.credits,/svs\.gsfc\.nasa\.gov\/4720/);
});

test('Moon image loader is asynchronous, CORS safe, cached and paints mutable crater canvas',async()=>{
  const {moon,calls}=setup();
  assert.equal(moon.paint({}, {}, 200,100),false);
  const [first,second]=await Promise.all([moon.preload(),moon.preload()]);
  assert.equal(first,second);
  assert.equal(moon.isReady(),true);
  assert.ok(calls.every(img=>img.crossOrigin==='anonymous'));
  const draw=[];
  const surface={
    clearRect(...a){draw.push(['clear',...a]);},
    drawImage(...a){draw.push(['photo',...a]);}
  };
  const emissive={fillRect(...a){draw.push(['dark',...a]);}};
  assert.equal(moon.paint(surface,emissive,4096,2048),true);
  assert.equal(draw[1][0],'photo');
  assert.equal(draw[1][1],first);
  assert.deepEqual(draw[1].slice(2),[0,0,4096,2048]);
  assert.deepEqual(draw[2],['dark',0,0,4096,2048]);
  assert.equal(emissive.fillStyle,'#000000');
  await Promise.resolve();await Promise.resolve();
  class Texture{constructor(image){this.image=image;this.needsUpdate=false;}}
  const THREE={Texture,RepeatWrapping:1000};
  const bump=moon.getBumpTexture(THREE);
  assert.ok(bump);
  assert.equal(bump.image.url,moon.sources.relief);
  assert.equal(bump.wrapS,THREE.RepeatWrapping);
  assert.equal(bump.needsUpdate,true);
  assert.equal(moon.getBumpTexture(THREE),bump);
  const seen=[];
  moon.setReliefReadyListener(()=>seen.push('ready'));
  assert.deepEqual(seen,['ready']);
  assert.ok(calls.length<=3);
});

test('lunar source retries the official NASA image after a mirror failure',async()=>{
  const {moon,calls}=setup({failPrimary:true});
  const result=await moon.preload();
  assert.ok(result.url.includes('svs.gsfc.nasa.gov'));
  assert.equal(calls.filter(img=>img.url.includes('moon_4096.jpg')).length,1);
  assert.equal(moon.isReady(),true);
});

test('when offline, lunar image fails gracefully and retry can work',async()=>{
  const {moon,calls}=setup({failAll:true});
  await assert.rejects(moon.preload(),/Lunar map could not be loaded/);
  assert.equal(moon.isReady(),false);
  assert.equal(moon.paint({}, {}, 1024,512),false);
  await assert.rejects(moon.preload());
  assert.ok(calls.length>=4);
});

test('game entry uses realistic lunar image with protected damage and matte relief',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/src\/render\/real-moon\.js/);
  assert.match(html,/GodSmashRealMoon\.paint\(surfaceCtx, emissiveCtx/);
  assert.match(html,/earthMat\.bumpMap=window\.GodSmashRealMoon\.getBumpTexture/);
  assert.match(html,/earthMat\.roughness=0\.98/);
  assert.match(html,/state\.impacts>0 \|\| state\.shattered/);
  assert.match(html,/surfaceTexture\.needsUpdate=true/);
});
