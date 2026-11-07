/* Batched GPU point-sprite plumes for curved planetary impacts.
 * No image downloads, GIF frames, large flying rock meshes, or per-puff draw calls.
 * The source position of each point is computed in the vertex shader in local
 * impact coordinates (+Z is the outward planetary surface normal).
 */
(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const vertexShader=`
    precision highp float;
    attribute vec4 aMotion; // angle, radial spread, size, birth time
    attribute vec2 aSeed;   // noise seed, height variation
    uniform float uTime;
    uniform float uSpan;
    uniform float uSphereRadius;
    uniform float uPixelScale;
    uniform float uKind;    // 0 smoke, 1 ground-hugging dust, 2 embers
    varying float vLife;
    varying float vOpacity;
    varying float vSeed;
    void main(){
      float life=clamp((uTime-aMotion.w)/(1.0-aMotion.w),0.0,1.0);
      float expansion=life*life*(3.0-2.0*life);
      float angle=aMotion.x+0.2*sin(life*3.7+aSeed.x*6.283);
      float radius;
      float height;
      if(uKind<0.5){
        radius=uSpan*(0.06+0.68*expansion)*aMotion.y;
        height=uSpan*(0.08+0.96*expansion)*aSeed.y;
      }else if(uKind<1.5){
        radius=uSpan*(0.1+1.28*expansion)*aMotion.y;
        radius=min(radius,uSphereRadius*0.46);
        // Follow the exact curved surface instead of a screen-space disc.
        height=sqrt(max(0.0,uSphereRadius*uSphereRadius-radius*radius))
          -uSphereRadius+uSpan*(0.02+0.07*life)*aSeed.y;
      }else{
        radius=uSpan*(0.04+0.62*life)*aMotion.y;
        height=uSpan*(0.1+1.15*life-0.62*life*life)*aSeed.y;
      }
      vec3 pos=vec3(cos(angle)*radius,sin(angle)*radius,height);
      vec4 viewPos=modelViewMatrix*vec4(pos,1.0);
      gl_Position=projectionMatrix*viewPos;
      float size=uSpan*aMotion.z*(1.0+(uKind>1.5?0.0:1.6*expansion));
      gl_PointSize=clamp(size*uPixelScale/max(0.2,-viewPos.z),0.0,180.0);
      vLife=life;
      vSeed=aSeed.x;
      float appear=smoothstep(0.0,0.14,life);
      float fade=1.0-smoothstep(uKind>1.5?0.17:0.66,1.0,life);
      vOpacity=appear*fade*step(aMotion.w,uTime);
    }
  `;
  const fragmentShader=`
    precision highp float;
    uniform vec3 uColor;
    uniform vec3 uWarm;
    uniform float uOpacity;
    uniform float uKind;
    varying float vLife;
    varying float vOpacity;
    varying float vSeed;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){
      float v=0.0,a=0.55;
      for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.11+17.6;a*=0.49;}
      return v;
    }
    void main(){
      vec2 uv=gl_PointCoord-0.5;
      float r=length(uv);
      if(r>0.5)discard;
      if(uKind>1.5){
        float glow=pow(max(0.0,1.0-r*2.0),3.5);
        gl_FragColor=vec4(mix(uColor,uWarm,0.6)*1.65,
          glow*vOpacity*uOpacity);
        return;
      }
      // Broken-up, soft cloud silhouette (no opaque polygonal rocks).
      vec2 flow=uv*5.0+vec2(vSeed*7.2,vSeed*3.4+vLife*0.56);
      float detail=fbm(flow)+0.34*fbm(flow*2.18);
      float contour=r+(0.5-detail)*0.19;
      float softEdge=1.0-smoothstep(0.28,0.51,contour);
      float density=clamp((detail-0.19)*1.25,0.0,1.0);
      float alpha=softEdge*(0.28+0.72*density)*vOpacity*uOpacity;
      vec3 color=mix(uWarm,uColor,clamp(vLife*2.8,0.0,1.0));
      color*=0.75+0.38*density;
      if(alpha<0.006)discard;
      gl_FragColor=vec4(color,alpha);
    }
  `;

  function makeCloud(THREE,count,kind,span,sphereRadius,style,lowQuality){
    if(count<=0)return null;
    const positions=new Float32Array(count*3);
    const motion=new Float32Array(count*4);
    const seeds=new Float32Array(count*2);
    const golden=2.399963229728653;
    for(let i=0;i<count;i++){
      const j=i*4,k=i*2;
      const wave=(i*37%101)/101;
      motion[j]=i*golden+wave*0.28;
      motion[j+1]=0.28+0.72*Math.sqrt((i+0.6)/count);
      motion[j+2]=(kind===0?0.26:kind===1?0.20:0.035)*(0.68+(i%7)*0.095);
      motion[j+3]=(kind===0?0.09:kind===1?0.018:0)+(i%9)*(kind===0?0.014:0.006);
      seeds[k]=((i*53)%97)/97;
      seeds[k+1]=0.62+((i*29)%43)/55;
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aMotion',new THREE.BufferAttribute(motion,4));
    geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,2));
    const pointScale=typeof window!=='undefined'
      ?clamp(window.innerHeight*(window.devicePixelRatio||1)*1.1,480,1200):700;
    const color=kind===0?'#313134':kind===1?style.dust:'#ff9a42';
    const warm=kind===0?'#9a6a50':kind===1?style.rim:'#fff2b0';
    const material=new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},uSpan:{value:span},uSphereRadius:{value:sphereRadius},
        uPixelScale:{value:pointScale},uKind:{value:kind},
        uOpacity:{value:0},uColor:{value:new THREE.Color(color)},
        uWarm:{value:new THREE.Color(warm)}
      },
      vertexShader,fragmentShader,transparent:true,depthWrite:false,
      depthTest:true,blending:kind===2?THREE.AdditiveBlending:THREE.NormalBlending
    });
    const points=new THREE.Points(geometry,material);
    points.frustumCulled=false; // shader moves the points away from the origin.
    points.name=['Volumetric soot GPU sprites','Curved surface ejecta GPU sprites','Incandescent GPU embers'][kind];
    return points;
  }

  function createSystem(THREE,style,span,sphereRadius,lowQuality){
    const group=new THREE.Group();
    group.name='Cinematic impact GPU particle layers';
    const smokeCount=style.smoke===0?0:Math.round((lowQuality?15:38)*style.smoke);
    const dustCount=lowQuality?13:30;
    const emberCount=lowQuality?9:22;
    const smoke=makeCloud(THREE,smokeCount,0,span,sphereRadius,style,lowQuality);
    const dust=makeCloud(THREE,dustCount,1,span,sphereRadius,style,lowQuality);
    const embers=makeCloud(THREE,emberCount,2,span,sphereRadius,style,lowQuality);
    for(const layer of [smoke,dust,embers])if(layer)group.add(layer);
    function update(progress,phase){
      const t=clamp(progress,0,1);
      for(const layer of group.children)layer.material.uniforms.uTime.value=t;
      if(smoke)smoke.material.uniforms.uOpacity.value=
        phase.dust*(lowQuality?0.39:0.48)*style.smoke;
      if(dust)dust.material.uniforms.uOpacity.value=
        phase.dust*(lowQuality?0.26:0.35)*(style.wave===0?0.75:1.0);
      if(embers)embers.material.uniforms.uOpacity.value=
        Math.min(1,phase.flash*0.65+phase.flame*0.95)*style.fire;
    }
    return {group,update,smokeCount,particleCount:smokeCount+dustCount+emberCount};
  }
  const api=Object.freeze({createSystem,vertexShader,fragmentShader});
  root.GodSmashImpactClouds=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
