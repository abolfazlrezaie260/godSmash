/* Real lunar LRO photographic albedo and topographic relief.
 * Sources: NASA Scientific Visualization Studio CGI Moon Kit, LROC WAC / LOLA:
 * https://svs.gsfc.nasa.gov/4720/
 * Preferred assets are the locally vendored ORIGINAL NASA 2025 4K color
 * raster and LOLA height preview. Remote fallbacks remain available.
 * Surface painting stays in the existing canvas so crater scars persist.
 */
(function(root){
  'use strict';

  const sources=Object.freeze({
    albedo: Object.freeze([
      './assets/textures/moon/moon_4096.jpg',
      'https://raw.githubusercontent.com/MaxwellLee/physics-lab/main/assets/textures/moon_4096.jpg',
      'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'
    ]),
    relief: Object.freeze([
      './assets/textures/moon/moon_height_1024.jpg',
      'https://raw.githubusercontent.com/MaxwellLee/physics-lab/main/assets/textures/moon_height_1024.jpg',
      'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg'
    ]),
    credits: 'https://svs.gsfc.nasa.gov/4720/'
  });

  let albedo=null;
  let relief=null;
  let ongoing=null;
  let bumpTexture=null;

  function getImage(url){
    return new Promise((resolve,reject)=>{
      const picture=new root.Image();
      // CanvasTexture is uploaded to WebGL and also painted during crater
      // strikes; a cross-origin image without CORS would taint the canvas.
      picture.crossOrigin='anonymous';
      picture.decoding='async';
      picture.onload=()=>{
        if(picture.naturalWidth<1024 || picture.naturalHeight<512){
          reject(new Error('Lunar map dimensions are unexpectedly small'));
          return;
        }
        resolve(picture);
      };
      picture.onerror=()=>reject(new Error('Lunar map could not be loaded'));
      picture.src=url;
    });
  }

  async function loadFirstAvailable(urls){
    let failure=null;
    for(const url of urls){
      try{return await getImage(url);}
      catch(error){failure=error;}
    }
    throw failure||new Error('No lunar image sources available');
  }

  function preload(){
    if(albedo)return Promise.resolve(albedo);
    if(!ongoing){
      ongoing=(async()=>{
        const color=await loadFirstAvailable(sources.albedo);
        albedo=color;
        // Relief is optional. Do not delay the color map or fail the whole
        // Moon when this secondary remote image is unavailable.
        loadFirstAvailable(sources.relief).then(image=>{
          relief=image;
          if(typeof onReliefReady==='function')onReliefReady();
        }).catch(()=>{});
        return color;
      })().catch(error=>{
        ongoing=null;
        throw error;
      });
    }
    return ongoing;
  }

  let onReliefReady=null;
  function setReliefReadyListener(listener){
    onReliefReady=typeof listener==='function'?listener:null;
    if(relief&&onReliefReady)onReliefReady();
  }

  function isReady(){return !!albedo;}

  // Painting is the only writer to the crater canvas on a new Moon/reset.
  function paint(surfaceCtx,emissiveCtx,width,height){
    if(!isReady())return false;
    surfaceCtx.clearRect(0,0,width,height);
    surfaceCtx.drawImage(albedo,0,0,width,height);
    emissiveCtx.fillStyle='#000000';
    emissiveCtx.fillRect(0,0,width,height);
    return true;
  }

  function getBumpTexture(THREE){
    if(!relief||!THREE||!THREE.Texture)return null;
    if(!bumpTexture){
      bumpTexture=new THREE.Texture(relief);
      bumpTexture.wrapS=THREE.RepeatWrapping;
      bumpTexture.anisotropy=4;
      bumpTexture.needsUpdate=true;
    }
    return bumpTexture;
  }

  const api=Object.freeze({
    sources,preload,isReady,paint,getBumpTexture,setReliefReadyListener,
    hasRelief:()=>!!relief
  });
  root.GodSmashRealMoon=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
