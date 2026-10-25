/* Deterministic, offline Martian surface synthesis for phones and tablets.
 * Fictional rendering informed by Martian geography, NOT a measured MOLA
 * elevation product nor a NASA orthophoto. Longitudes are 0..360 east.
 * Physical landmarks: Olympus Mons ~18N/225E, Valles Marineris, Hellas.
 */
(function(root){
  'use strict';
  const PI=Math.PI,DEG=PI/180;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
  const wrap=lon=>((lon%360)+360)%360;
  const distance=(a,b)=>Math.min(Math.abs(wrap(a)-wrap(b)),360-Math.abs(wrap(a)-wrap(b)));
  function hash(x,y){
    let n=Math.imul(x,374761393)+Math.imul(y,668265263)+0x5f3759df;
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  }
  function noise(lon,lat,freq){
    const x=wrap(lon)/360*freq;
    const y=(90-lat)/180*freq*.5;
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy);
    const x0=ix%freq,x1=(ix+1)%freq;
    const v00=hash(x0,iy),v10=hash(x1,iy),v01=hash(x0,iy+1),v11=hash(x1,iy+1);
    return (v00+(v10-v00)*a)*(1-b)+(v01+(v11-v01)*a)*b;
  }
  function fbm(lon,lat){
    return .52*noise(lon,lat,8)+.28*noise(lon,lat,32)+
      .14*noise(lon,lat,96)+.06*noise(lon,lat,256);
  }
  function blob(lon,lat,centerLon,centerLat,lonRadius,latRadius){
    const dx=distance(lon,centerLon)/lonRadius;
    const dy=(lat-centerLat)/latRadius;
    const r2=dx*dx+dy*dy;
    return 1/(1+r2*r2*3.5);
  }
  const volcanoes=Object.freeze([
    Object.freeze({name:'Olympus Mons',lon:225,lat:18,height:18,reach:8}),
    Object.freeze({name:'Ascraeus Mons',lon:248,lat:12,height:8,reach:5}),
    Object.freeze({name:'Pavonis Mons',lon:247,lat:0,height:7,reach:5}),
    Object.freeze({name:'Arsia Mons',lon:239,lat:-9,height:9,reach:6}),
    Object.freeze({name:'Alba Patera',lon:252,lat:42,height:7,reach:12})
  ]);
  const landmarks=Object.freeze({
    olympusMons:Object.freeze({lon:225,lat:18}),
    hellas:Object.freeze({lon:70,lat:-45}),
    syrtisMajor:Object.freeze({lon:70,lat:9}),
    vallesMarineris:Object.freeze({lon:303,lat:-14})
  });

  function terrain(lon,lat){
    const fine=fbm(lon,lat),coarse=noise(lon,lat,8),north=smooth(-6,30,lat);
    let height=2.8-4.2*north+(coarse-.5)*3.4+(fine-.5)*2.3;
    const tharsis=blob(lon,lat,250,3,34,26);
    height+=4.0*tharsis;
    let volcanic=0;
    for(const v of volcanoes){
      const cone=blob(lon,lat,v.lon,v.lat,v.reach,v.reach*.75);
      height+=v.height*cone;
      volcanic=Math.max(volcanic,cone);
    }
    const hellas=blob(lon,lat,70,-45,19,13);
    const argyre=blob(lon,lat,320,-50,14,10);
    height-=8.3*hellas+4.8*argyre;
    // Branching canyon axis from 268E to 342E near 14S.
    const local=distance(lon,304);
    const canyonBand=1-smooth(23,42,local);
    const axialLatitude=-13+3.2*Math.sin((lon-286)*DEG*2.5);
    const dy=Math.abs(lat-axialLatitude);
    const canyon=canyonBand*(1-smooth(1.1,5.6,dy));
    const canyonRim=canyonBand*(smooth(2.0,5,dy)-smooth(5,10,dy));
    height-=7.6*canyon;
    height+=1.1*canyonRim;
    height=clamp(height,-9.5,21.0);
    const syrtis=blob(lon,lat,69,9,19,20);
    const solis=blob(lon,lat,271,-25,24,13);
    const dark=clamp(.82*syrtis+.42*solis+.27*volcanic+.34*canyon,0,1);
    const dust=clamp((fine-.5)*.52+(coarse-.5)*.18, -.35,.35);
    const frostNoise=(noise(lon,lat,64)-.5)*5+(noise(lon,lat,16)-.5)*3;
    const polarNorth=smooth(75+frostNoise,85+frostNoise,lat);
    const polarSouth=1-smooth(-86+frostNoise,-76+frostNoise,lat);
    const polar=clamp(Math.max(polarNorth,polarSouth),0,1);
    let r=153+52*dust-50*dark+23*hellas+20*argyre-22*canyon+10*tharsis;
    let g=82+36*dust-33*dark+20*hellas+16*argyre-18*canyon+6*tharsis;
    let b=57+25*dust-23*dark+15*hellas+11*argyre-11*canyon+3*tharsis;
    const iceGrain=(noise(lon,lat,96)-.5)*17;
    r=r*(1-polar)+(216+iceGrain)*polar;
    g=g*(1-polar)+(217+iceGrain)*polar;
    b=b*(1-polar)+(211+iceGrain)*polar;
    return {elevationKm:height,ice:polar,dark,roughness:clamp(.96-.03*fine+.03*canyon,.9,1),
      color:[Math.round(clamp(r,0,255)),Math.round(clamp(g,0,255)),Math.round(clamp(b,0,255))]};
  }
  function heightAt(lon,lat){return terrain(lon,lat).elevationKm;}
  const cache=new Map();
  function pixels(width,height){
    const key=width+'x'+height;
    if(cache.has(key))return cache.get(key);
    const data=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++){
      const lat=90-(y+.5)*180/height;
      for(let x=0;x<width;x++){
        const lon=(x+.5)*360/width;
        const color=terrain(lon,lat).color;
        const i=(y*width+x)*4;
        data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];data[i+3]=255;
      }
    }
    if(cache.size>=3)cache.clear();
    cache.set(key,data);
    return data;
  }
  function paint(surface,emissive,width,height){
    if(!surface||!emissive||!Number.isInteger(width)||!Number.isInteger(height)||
      width<4||height<2||typeof surface.createImageData!=='function')
      throw new TypeError('Mars painter requires two canvas contexts and pixel dimensions');
    const image=surface.createImageData(width,height);
    image.data.set(pixels(width,height));
    surface.putImageData(image,0,0);
    // Sparse low-contrast crater ejecta rings, tied to deterministic seed;
    // never cover the polar ice with dark crater decals.
    for(let i=0;i<165;i++){
      const longitude=hash(i,19)*360,latitude=(hash(i,83)-.5)*150;
      const x=longitude/360*width,y=(90-latitude)/180*height;
      const rx=(1+hash(i,32)*3.6)*width/1024;
      const ry=rx*(.55+hash(i,43)*.35);
      const ice=terrain(longitude,latitude).ice;
      if(ice>.15)continue;
      surface.beginPath();
      surface.ellipse(x,y,rx,ry,0,0,PI*2);
      surface.lineWidth=Math.max(.55,width/2048);
      surface.strokeStyle='rgba(66,43,35,0.24)';
      surface.stroke();
    }
    emissive.fillStyle='#000000';
    emissive.fillRect(0,0,width,height);
    return true;
  }
  function createBumpTexture(THREE,doc,width=512,height=256){
    if(!THREE?.CanvasTexture||!doc?.createElement)throw new TypeError('Three.js and DOM required');
    const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new TypeError('Canvas 2D unavailable');
    const image=ctx.createImageData(width,height);
    for(let y=0;y<height;y++){
      const latitude=90-(y+.5)*180/height;
      for(let x=0;x<width;x++){
        const value=clamp(Math.round((heightAt((x+.5)*360/width,latitude)+10)/32*255),0,255);
        const i=(y*width+x)*4;
        image.data[i]=value;image.data[i+1]=value;image.data[i+2]=value;image.data[i+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
    const map=new THREE.CanvasTexture(canvas);
    map.wrapS=THREE.RepeatWrapping;
    map.anisotropy=2;
    return map;
  }
  const api=Object.freeze({paint,terrain,heightAt,createBumpTexture,landmarks,volcanoes});
  root.GodSmashMarsSurface=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
