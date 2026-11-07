/* Surface-conforming, layered planetary impacts.
 * All sizes are visual game-space units, never physical blast predictions.
 * One shared effect factory is used for every planet and missile.
 */
(function(root){
  'use strict';
  const timing = root.GodSmashImpactTiming ||
    (typeof module !== 'undefined' && module.exports
      ? require('./impact-timing.js') : null);
  const gpuClouds = root.GodSmashImpactClouds ||
    (typeof module !== 'undefined' && module.exports
      ? require('./impact-gpu-clouds.js') : null);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
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
    const across=new Float32Array((segments+1)*2);
    for(let i=0;i<=segments;i++){across[i*2]=0;across[i*2+1]=1;}
    geometry.setAttribute('aAcross',new THREE.BufferAttribute(across,1));
    geometry.setIndex(indices);
    return geometry;
  }
  // Local-space turbulence breaks up both the geometry and the emissive edge.
  // Unlike the old additive opaque ball, front faces are softly masked.
  const noiseGLSL=`
    float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float noise3(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(
        mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
            mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
            mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm(vec3 p){
      float v=0.0,a=0.52;
      for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.07+vec3(11.3,3.7,8.2);a*=0.48;}
      return v;
    }
  `;
  const fireVertex=`
    uniform float uTime;
    varying vec3 vLocal;
    varying float vFacing;
    ${noiseGLSL}
    void main(){
      vec3 direction=normalize(position);
      float broad=fbm(direction*3.2+vec3(uTime*.17,-uTime*.13,uTime*.11));
      float fine=noise3(direction*11.2+vec3(0.0,uTime*.54,0.0));
      float displacement=0.83+0.52*broad+0.13*(fine-0.5);
      vec3 displaced=position*displacement;
      vec4 viewPos=modelViewMatrix*vec4(displaced,1.0);
      vLocal=displaced;
      vFacing=max(0.0,dot(normalize(normalMatrix*normal),normalize(-viewPos.xyz)));
      gl_Position=projectionMatrix*viewPos;
    }
  `;
  const fireFragment=`
    precision highp float;
    varying vec3 vLocal;
    varying float vFacing;
    uniform float uTime;
    uniform float uAlpha;
    uniform vec3 uHot;
    uniform vec3 uCool;
    ${noiseGLSL}
    void main(){
      vec3 direction=normalize(vLocal);
      vec3 flow=direction*5.4+vec3(uTime*.29,-uTime*.48,uTime*.22);
      float broad=fbm(flow);
      float detail=fbm(flow*2.18+vec3(2.3,-4.7,1.2));
      float cells=clamp(broad*0.75+detail*0.40,0.0,1.0);
      // Mask the silhouette: no hard sphere boundary or flat white disc.
      float softRim=smoothstep(0.08,0.65,vFacing);
      float ragged=smoothstep(0.24,0.64,cells);
      float alpha=uAlpha*softRim*(0.12+0.72*ragged);
      if(alpha<0.008)discard;
      float heat=smoothstep(0.34,0.88,cells);
      vec3 color=mix(uCool*0.34,uHot*0.95,heat);
      color=mix(color,vec3(1.0,0.62,0.22),pow(heat,5.0)*0.18);
      gl_FragColor=vec4(color,min(0.70,alpha));
    }
  `;
  const waveVertex=`
    attribute float aAcross;
    varying float vAcross;
    varying float vAngle;
    void main(){
      vAcross=aAcross;
      vAngle=atan(position.y,position.x);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `;
  const waveFragment=`
    precision mediump float;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAcross;
    varying float vAngle;
    void main(){
      float feather=pow(max(0.0,sin(vAcross*3.14159265)),1.8);
      float broken=0.70+0.17*sin(vAngle*13.0)+0.13*sin(vAngle*29.0+3.0);
      float alpha=uOpacity*feather*broken;
      if(alpha<0.004)discard;
      gl_FragColor=vec4(uColor,alpha);
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
    // Ground-impact combustion/soot uses the planet's physical palette.
    // Fictional purple/teal missile exhaust should not tint the explosion.
    const hot=style.heat;
    const outer=style.outer;
    const fireMat=new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},uAlpha:{value:0},
        uHot:{value:new THREE.Color(hot)},uCool:{value:new THREE.Color(outer)}
      },
      vertexShader:fireVertex,fragmentShader:fireFragment,
      transparent:true,depthWrite:false,depthTest:true,
      side:THREE.FrontSide,blending:THREE.NormalBlending
    });
    const fire=new THREE.Mesh(
      new THREE.SphereGeometry(1,lowQuality?14:28,lowQuality?9:18),fireMat
    );
    fire.position.z=span*.11;
    group.add(fire);
    const segments=lowQuality?24:48;
    const rings=[];
    for(const [tint,width,offset] of [
      [style.rim,0.085,0.05],[outer,0.05,0.078]
    ]){
      const geometry=makeSurfaceRing(THREE,segments);
      const material=new THREE.ShaderMaterial({
        uniforms:{
          uColor:{value:new THREE.Color(tint)},
          uOpacity:{value:0}
        },
        vertexShader:waveVertex,fragmentShader:waveFragment,
        transparent:true,depthWrite:false,depthTest:true,
        side:THREE.DoubleSide,blending:THREE.NormalBlending
      });
      material.opacity=0;
      const mesh=new THREE.Mesh(geometry,material);
      mesh.frustumCulled=false;
      mesh.userData.width=width;
      mesh.userData.lift=offset;
      group.add(mesh);
      rings.push(mesh);
    }

    // Three draw calls per impact instead of dozens of low-poly smoke rocks.
    // Procedural sprites are shaded and moved on the GPU, with the dust layer
    // following the actual curvature of the planet.
    const clouds=gpuClouds?gpuClouds.createSystem(
      THREE,style,span,sphereRadius,lowQuality):null;
    if(clouds)group.add(clouds.group);
    const count=clouds?clouds.smokeCount:0;

    const flash=lowQuality?null:new THREE.PointLight(
      new THREE.Color(style.heat),0,span*2.4
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
      const radius=span*style.fire*(.055+.33*early);
      fire.scale.setScalar(radius);
      fire.position.z=span*(.075+.20*early);
      fireMat.uniforms.uTime.value=t*6.7;
      fireMat.uniforms.uAlpha.value=Math.min(.82,
        (phase.flame*.74+phase.flash*.21)*style.fire);

      const expanding=smooth(.04,.47,t);
      const r=Math.max(.08,maxWave*(.15+.85*expanding));
      rings.forEach((ring,index)=>{
        const width=ring.userData.width*span;
        setSurfaceRing(ring.geometry,Math.max(.02,r-width),r,
          sphereRadius,segments,ring.userData.lift);
        ring.material.opacity=phase.shock*style.wave*(index===0?.18:.075);
        ring.material.uniforms.uOpacity.value=ring.material.opacity;
      });

      if(clouds)clouds.update(t,phase);
      if(flash)flash.intensity=1.65*phase.flash*style.fire;
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
      planetId,smokeCount:count,rings,gpuDust:!!clouds};
  }
  const api=Object.freeze({
    createEffect,planetStyle,surfacePoint,setSurfaceRing
  });
  root.GodSmashImpactEffects=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
