/* Surface-conforming, layered planetary impacts.
 * All sizes are visual game-space units, never physical blast predictions.
 * One shared effect factory is used for every planet and missile.
 */
(function(root){
  'use strict';
  const timing = root.GodSmashImpactTiming ||
    (typeof module !== 'undefined' && module.exports
      ? require('./impact-timing.js') : null);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,t)=>{
    const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);
  };
  const PLANETS=Object.freeze({
    earth:Object.freeze({
      heat:'#ffbc69',outer:'#a64a29',dust:'#625d58',rim:'#c7a080',
      smoke:1,linger:1,fire:1,wave:1,plume:1
    }),
    mars:Object.freeze({
      heat:'#ffb76b',outer:'#9d523a',dust:'#a26a50',rim:'#bf7957',
      smoke:0.58,linger:1.18,fire:0.85,wave:0.58,plume:0.9
    }),
    moon:Object.freeze({
      heat:'#ffe5b5',outer:'#b9aa91',dust:'#939397',rim:'#b6b5ad',
      smoke:0,linger:0.7,fire:0.55,wave:0.16,plume:0.35
    }),
    venus:Object.freeze({
      heat:'#ffe2a2',outer:'#d79256',dust:'#ad885a',rim:'#e4af72',
      smoke:1.3,linger:1.25,fire:0.82,wave:0.52,plume:1.2
    })
  });
  function planetStyle(id){
    return PLANETS[id] || PLANETS.earth;
  }

  // Relative to a hit point on a sphere: +Z is the surface normal. The
  // ring lies at the actual curved surface height, not on an airborne plane.
  function surfacePoint(radius, angle, sphereRadius, lift=0.04){
    const r=clamp(radius,0,sphereRadius*0.49);
    return {
      x:r*Math.cos(angle),y:r*Math.sin(angle),
      z:Math.sqrt(sphereRadius*sphereRadius-r*r)-sphereRadius+lift
    };
  }
  function setSurfaceRing(geometry,inner,outer,sphereRadius,segments,lift){
    const positions=geometry.attributes.position;
    for(let i=0;i<=segments;i++){
      const angle=i*2*Math.PI/segments;
      const a=surfacePoint(inner,angle,sphereRadius,lift);
      const b=surfacePoint(outer,angle,sphereRadius,lift);
      const k=i*2;
      positions.setXYZ(k,a.x,a.y,a.z);
      positions.setXYZ(k+1,b.x,b.y,b.z);
    }
    positions.needsUpdate=true;
  }
  function makeSurfaceRing(THREE,segments){
    const data=new Float32Array((segments+1)*2*3);
    const indices=[];
    for(let i=0;i<segments;i++){
      const n=i*2;
      indices.push(n,n+1,n+2,n+1,n+3,n+2);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data,3));
    geometry.setIndex(indices);
    return geometry;
  }
  // 3D local-position turbulence removes the latitude-longitude UV stripes
  // and seams of the old spherical blast texture.
  const fireVertex=`
    varying vec3 vLocal;
    varying vec3 vNormalLocal;
    void main(){
      vLocal=position;
      vNormalLocal=normal;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }
  `;
  const fireFragment=`
    precision highp float;
    varying vec3 vLocal;
    varying vec3 vNormalLocal;
    uniform float uTime;
    uniform float uAlpha;
    uniform vec3 uHot;
    uniform vec3 uCool;
    float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float n(vec3 p){
      vec3 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
      return mix(
        mix(mix(h(i),h(i+vec3(1,0,0)),f.x),
            mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),
            mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm(vec3 p){
      float v=0.,a=.54;
      for(int i=0;i<4;i++){v+=a*n(p);p=p*2.07+vec3(11.3,3.7,8.2);a*=.49;}
      return v;
    }
    void main(){
      vec3 p=normalize(vLocal)*5.0+vec3(uTime*.52,-uTime*.28,uTime*.31);
      float turbulence=fbm(p)+.28*fbm(p*2.2-vec3(uTime));
      float heat=smoothstep(.20,.78,turbulence);
      float irregular=smoothstep(.24,.48,turbulence);
      float silhouette=.76+.24*abs(dot(normalize(vNormalLocal),vec3(0.,0.,1.)));
      vec3 color=mix(uCool,uHot,heat);
      color+=uHot*pow(max(heat-.52,0.),2.)*.55;
      gl_FragColor=vec4(color,uAlpha*irregular*silhouette);
    }
  `;

  function createEffect(THREE,weapon,size,lowQuality,options={}){
    if(!timing)throw new Error('Impact timing must load before impact effects');
    const planetId=typeof options==='string'?options:(options.planetId||'earth');
    const style=planetStyle(planetId);
    const sphereRadius=typeof options==='object'&&Number.isFinite(options.planetRadius)
      ?Math.max(1,options.planetRadius):10;
    const group=new THREE.Group();
    group.name='Surface-bound multi-stage planetary impact';
    const span=clamp(Number(size)||1,0.4,sphereRadius*0.48);
    const quality=lowQuality?'low':'high';
    const hot=weapon.fireColor||style.heat;
    const outer=weapon.plasmaColor||style.outer;
    const fireMat=new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},uAlpha:{value:0},
        uHot:{value:new THREE.Color(hot)},uCool:{value:new THREE.Color(outer)}
      },
      vertexShader:fireVertex,fragmentShader:fireFragment,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      blending:THREE.AdditiveBlending
    });
    const fire=new THREE.Mesh(
      new THREE.IcosahedronGeometry(1,lowQuality?1:2),fireMat
    );
    fire.position.z=span*.11;
    group.add(fire);
    // Cooler, restrained outer skin turns from fire to soot without a
    // second opaque sphere engulfing the surface.
    const shellMat=new THREE.MeshBasicMaterial({
      color:outer,transparent:true,opacity:0,
      depthWrite:false,side:THREE.DoubleSide
    });
    const shell=new THREE.Mesh(
      new THREE.IcosahedronGeometry(1,lowQuality?1:2),shellMat
    );
    shell.position.z=span*.14;
    group.add(shell);

    const segments=lowQuality?24:48;
    const rings=[];
    for(const [tint,width,offset] of [
      [style.rim,0.085,0.05],[outer,0.05,0.078]
    ]){
      const geometry=makeSurfaceRing(THREE,segments);
      const material=new THREE.MeshBasicMaterial({
        color:tint,transparent:true,opacity:0,side:THREE.DoubleSide,
        depthWrite:false
      });
      const mesh=new THREE.Mesh(geometry,material);
      mesh.frustumCulled=false;
      mesh.userData.width=width;
      mesh.userData.lift=offset;
      group.add(mesh);
      rings.push(mesh);
    }

    // Irregular individually drifting charcoal clouds. On the Moon there
    // is no atmospheric smoke; lunar debris is supplied by the main game.
    const smoke=[];
    const count=style.smoke===0?0:Math.round((lowQuality?6:13)*style.smoke);
    const cloudGeometry=new THREE.IcosahedronGeometry(1,lowQuality?0:1);
    for(let i=0;i<count;i++){
      const angle=i*2.399963229728653;
      const band=.28+.72*Math.sqrt((i+.6)/Math.max(1,count));
      const mat=new THREE.MeshBasicMaterial({
        color:style.dust,transparent:true,opacity:0,
        depthWrite:false,side:THREE.DoubleSide
      });
      const puff=new THREE.Mesh(cloudGeometry,mat);
      puff.visible=false;
      group.add(puff);
      smoke.push({mesh:puff,angle,band,phase:(i%5)*.037,
        turn:((i*17)%7-3)*.23,
        shape:.7+(i%4)*.23});
    }

    const flash=lowQuality?null:new THREE.PointLight(
      new THREE.Color(style.heat),0,span*3.2
    );
    if(flash){
      flash.position.z=span*.2;
      group.add(flash);
    }

    const maxWave=Math.min(sphereRadius*.33,span*1.38);
    let disposed=false;
    function update(progress){
      if(disposed)return;
      const t=clamp(Number(progress)||0,0,1);
      const phase=timing.sample(t);
      const early=smooth(.008,.16,t);
      const cooling=1-smooth(.16,.45,t);
      const radius=span*style.fire*(.06+.52*early);
      fire.scale.setScalar(radius);
      fire.position.z=span*(.10+.19*early);
      fireMat.uniforms.uTime.value=t*6.7;
      fireMat.uniforms.uAlpha.value=phase.flame*.78*style.fire;
      shell.scale.setScalar(radius*1.24);
      shell.position.z=span*(.08+.19*early);
      shellMat.opacity=phase.plasma*.13*cooling;

      const expanding=smooth(.04,.47,t);
      const r=Math.max(.08,maxWave*(.15+.85*expanding));
      rings.forEach((ring,index)=>{
        const width=ring.userData.width*span;
        setSurfaceRing(ring.geometry,Math.max(.02,r-width),r,
          sphereRadius,segments,ring.userData.lift);
        ring.material.opacity=phase.shock*style.wave*(index===0?.34:.15);
      });

      for(const p of smoke){
        const mesh=p.mesh;
        const visible=smooth(.13+p.phase,.32+p.phase,t)*
          (1-smooth(.76,1,t));
        mesh.visible=visible>.008;
        const age=clamp((t-.13-p.phase)/.8,0,1);
        const spread=span*style.plume*(.12+.59*age)*p.band;
        const direction=p.angle+p.turn*age;
        mesh.position.set(
          Math.cos(direction)*spread,Math.sin(direction)*spread,
          span*(.035+.82*age)*style.plume
        );
        const puffSize=span*(.12+.27*age)*p.shape;
        mesh.scale.set(puffSize,puffSize*(.8+age*.3),puffSize*.65);
        mesh.material.opacity=visible*(lowQuality?.13:.17);
      }
      if(flash)flash.intensity=2.4*phase.flash*style.fire;
    }
    function dispose(){
      if(disposed)return;
      disposed=true;
      const geometries=new Set(),materials=new Set();
      group.traverse(node=>{
        if(node.geometry)geometries.add(node.geometry);
        if(node.material){
          (Array.isArray(node.material)?node.material:[node.material])
            .forEach(material=>materials.add(material));
        }
      });
      geometries.forEach(g=>g.dispose());
      materials.forEach(m=>m.dispose());
    }
    update(0);
    return {group,update,dispose,duration:timing.duration(span,lowQuality)*style.linger,
      planetId,smokeCount:count,rings};
  }
  const api=Object.freeze({
    createEffect,planetStyle,surfacePoint,setSurfaceRing
  });
  root.GodSmashImpactEffects=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
