/* Flat regional tactical map. Local Natural Earth polygons, full-resolution
 * bundled Earth image and DOM/SVG-only cinematic flight. No globe view,
 * external map service or real-world ballistics/navigation.
 */
(function (root) {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const BOUNDS=Object.freeze({
    asia:[192,9,156,114], europe:[153,7,92,81],
    africa:[155,44,95,114], 'north-america':[0,0,149,103],
    'south-america':[82,67,96,113], oceania:[277,70,105,110]
  });
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const xy=(lat,lon)=>({x:lon+180,y:90-lat});
  function ringsOf(feature) {
    if (!feature || !feature.geometry) return [];
    const g=feature.geometry;
    return g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  }
  function polygonPath(feature, offset=0) {
    const paths=[];
    for (const polygon of ringsOf(feature)) for(const ring of polygon) {
      let previous=null, segment='';
      for (const [lon,lat] of ring) {
        let x=lon+180+offset,y=90-lat;
        if (previous && Math.abs(x-previous.x)>180) {
          if(segment)paths.push(segment);
          segment='';previous=null;
        }
        segment+=(previous?'L':'M')+x.toFixed(3)+' '+y.toFixed(3);
        previous={x,y};
      }
      if(segment)paths.push(segment+'Z');
    }
    return paths.join(' ');
  }
  function anchor(feature, geography) {
    for (const continent of geography.listContinents()) {
      const known=continent.countries.find(c=>c.id===feature.id);
      if (known) return {lat:known.lat,lon:known.lon};
    }
    // Lightweight fallback centroid: the median of the largest outer ring's
    // latitude and longitude bounds (visual marker only, not a firing base).
    const outer=ringsOf(feature).map(poly=>poly[0]||[]).sort((a,b)=>b.length-a.length)[0]||[];
    if(!outer.length)return {lat:0,lon:0};
    const lons=outer.map(c=>c[0]),lats=outer.map(c=>c[1]);
    return {lat:(Math.min(...lats)+Math.max(...lats))/2,
      lon:(Math.min(...lons)+Math.max(...lons))/2};
  }
  function routePoints(a,b) {
    const start=xy(a.lat,a.lon),end=xy(b.lat,b.lon);
    // For Pacific crossings, follow the short map-wrap connection.
    if(end.x-start.x>180)end.x-=360;
    if(end.x-start.x< -180)end.x+=360;
    const distance=Math.hypot(end.x-start.x,end.y-start.y);
    const height=clamp(distance*0.14,2.5,12);
    return {start,end,control:{
      x:(start.x+end.x)/2,
      y:(start.y+end.y)/2-height
    }};
  }
  function pointAt(route,t) {
    const u=1-t,a=route.start,b=route.control,c=route.end;
    return {x:u*u*a.x+2*u*t*b.x+t*t*c.x,
      y:u*u*a.y+2*u*t*b.y+t*t*c.y};
  }
  function svgEl(doc,tag,attributes) {
    const el=doc.createElementNS(NS,tag);
    for(const [key,val] of Object.entries(attributes||{}))el.setAttribute(key,String(val));
    return el;
  }
  function mount(opts) {
    const {geography,continentContainer,panel,mapShell,svg,continentLabel,
      routeSummary,launchButton,changeSourceButton,worldButton,fitButton,
      onChoose,onImpact,onSound,getWeapon,getTimeScale,getSalvoMode,onError} = opts||{};
    if(!geography||!continentContainer||!panel||!mapShell||!svg||
        !continentLabel||!routeSummary||!launchButton||!changeSourceButton||
        !worldButton||!fitButton||typeof onChoose!=='function'||
        typeof onImpact!=='function'||typeof getWeapon!=='function')
      throw new TypeError('Flat continent mode needs a map, controls and callbacks');

    const doc=svg.ownerDocument,buttons=new Map();
    let continentId=null,source=null,target=null,selection='source';
    let mapData=null,loadPromise=null,view={x:0,y:0,w:360,h:180};
    let regionalView=null,paths=[],markersLayer=null,animationLayer=null;
    let held=null,dragged=false,flights=[],explosions=[],loadToken=0;
    let lastWorld=false;

    function setView(bounds) {
      view={x:bounds[0],y:bounds[1],w:bounds[2],h:bounds[3]};
      redrawViewport();
    }
    function redrawViewport() {
      // Preserve map aspect ratio by using meet; pan gestures use its scale.
      view.w=clamp(view.w,12,360);
      view.h=clamp(view.h,8,180);
      view.x=clamp(view.x,0,Math.max(0,720-view.w));
      view.y=clamp(view.y,0,Math.max(0,180-view.h));
      svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
    }
    function zoom(factor) {
      const cx=view.x+view.w/2,cy=view.y+view.h/2;
      const nw=clamp(view.w*factor,12,360),nh=clamp(view.h*factor,8,180);
      setView([cx-nw/2,cy-nh/2,nw,nh]);
    }
    function fitContinent() {
      if(!continentId)return;
      lastWorld=false;
      setView(regionalView);
    }
    function world() {
      lastWorld=true;
      // Still a 2D map; selecting another continent never reveals a sphere.
      setView([0,0,360,180]);
      status('نمای تخت جهان — برای انتخاب کشور دورتر روی نقشه بزنید.');
    }
    function setButtons() {
      for(const [id,button] of buttons) {
        button.classList.toggle('is-selected',id===continentId);
        button.setAttribute('aria-pressed',String(id===continentId));
      }
    }
    function status(message) { routeSummary.textContent=message; }
    function updatePanel() {
      if(!continentId)return;
      const continent=geography.getContinent(continentId);
      continentLabel.textContent='نقشهٔ '+(continent?continent.nameFa:'جهان');
      if(!source) status('۱. روی کشور مبدأ در نقشه لمس یا کلیک کنید.');
      else if(!target) status('مبدأ: '+source.fa+' — ۲. کشور مقصد را از روی نقشه انتخاب کنید.');
      else status('از '+source.fa+' به '+target.fa+' — نوع موشک را انتخاب و شلیک کنید.');
      launchButton.disabled=!source||!target;
      changeSourceButton.disabled=!source;
    }
    function displayName(country) {return country.fa||country.en||country.id;}
    function renderMarkers() {
      if(!markersLayer)return;
      markersLayer.replaceChildren();
      for (const [country,color] of [[source,'#22d3ee'],[target,'#fb923c']]) {
        if(!country)continue;
        let point=xy(country.anchor.lat,country.anchor.lon);
        if(continentId==='oceania'&&point.x<100)point.x+=360;
        for(const shift of [0,-360,360]) {
          const p={x:point.x+shift,y:point.y};
          if(p.x<view.x-20||p.x>view.x+view.w+20)continue;
          const circle=svgEl(doc,'circle',{cx:p.x,cy:p.y,r:0.95,fill:color,
            stroke:'#0f172a','stroke-width':0.25,'pointer-events':'none'});
          const label=svgEl(doc,'text',{x:p.x+1.5,y:p.y-1.6,fill:'#ffffff',
            'font-size':clamp(view.w/65,1.6,4.3),'font-weight':'700',
            'paint-order':'stroke',stroke:'#06101f','stroke-width':0.9,
            'pointer-events':'none'});
          label.textContent=displayName(country);
          markersLayer.append(circle,label);
        }
      }
      if(source&&target) {
        const r=routePoints(source.anchor,target.anchor);
        let shift=continentId==='oceania'&&r.start.x<100?360:0;
        const routePath=svgEl(doc,'path',{d:'M '+(r.start.x+shift)+' '+r.start.y+
          ' Q '+(r.control.x+shift)+' '+r.control.y+
          ' '+(r.end.x+shift)+' '+r.end.y,fill:'none',
          stroke:'#67e8f9','stroke-width':0.38,'stroke-dasharray':'1.5 1',
          opacity:0.9,'vector-effect':'non-scaling-stroke','pointer-events':'none'});
        markersLayer.insertBefore(routePath,markersLayer.firstChild);
      }
      for(const item of paths) {
        const selectedSource=source&&item.id===source.id;
        const selectedTarget=target&&item.id===target.id;
        item.element.classList.toggle('geo-source',!!selectedSource);
        item.element.classList.toggle('geo-target',!!selectedTarget);
      }
    }
    function countryFor(id) {return mapData&&mapData.features.find(f=>f.id===id);}
    function choose(id) {
      const chosen=countryFor(id);
      if(!chosen)return false;
      if(!source||selection==='source') {
        source=chosen;target=null;selection='target';
      } else if(chosen.id===source.id) {
        status('برای مقصد کشور دیگری را انتخاب کنید؛ یا «تغییر مبدأ» را بزنید.');
        return false;
      } else {
        target=chosen;selection='target';
      }
      updatePanel();renderMarkers();
      return true;
    }
    function clearEffects() {
      flights=[];explosions=[];
      if(animationLayer)animationLayer.replaceChildren();
    }
    function clear() {
      loadToken++;
      continentId=null;source=null;target=null;selection='source';
      mapShell.hidden=true;panel.hidden=true;clearEffects();
      setButtons();
    }
    function isActive(){return !!continentId;}
    function loadData() {
      if(mapData)return Promise.resolve(mapData);
      if(!loadPromise)loadPromise=fetch('./assets/data/countries-110m.json')
        .then(r=>{if(!r.ok)throw Error('Country map HTTP '+r.status);return r.json();})
        .then(data=>{
          if(!data||!Array.isArray(data.features)||data.features.length<150)
            throw Error('Country polygon data missing');
          data.features.forEach(country=>{
            country.anchor=anchor(country,geography);
          });
          mapData=data;return data;
        }).catch(err=>{loadPromise=null;throw err;});
      return loadPromise;
    }
    function paintMap() {
      svg.replaceChildren();paths=[];
      // Two image tiles let Pacific island countries be selected past 180°.
      for(const offset of [0,360]) {
        const image=svgEl(doc,'image',{href:'./assets/textures/earth/earth_atmos_4096.jpg',
          x:offset,y:0,width:360,height:180,preserveAspectRatio:'none'});
        svg.appendChild(image);
      }
      const overlay=svgEl(doc,'rect',{x:0,y:0,width:720,height:180,
        fill:'#0b1830',opacity:0.26,'pointer-events':'none'});
      svg.appendChild(overlay);
      const borders=svgEl(doc,'g',{'aria-label':'مرزهای کشورها'});
      const featureCopies=(f)=>f.continent==='oceania'?[0,360]:[0];
      for(const f of mapData.features) {
        for(const offset of featureCopies(f)) {
          const path=svgEl(doc,'path',{
            d:polygonPath(f,offset),'data-country-id':f.id,
            class:'geo-country',tabindex:'0',role:'button',
            'aria-label':displayName(f),'vector-effect':'non-scaling-stroke'
          });
          const title=svgEl(doc,'title');title.textContent=displayName(f);
          path.appendChild(title);
          path.addEventListener('click',event=>{
            if(dragged||!continentId)return;
            event.stopPropagation();choose(f.id);
          });
          path.addEventListener('keydown',event=>{
            if(event.key==='Enter'||event.key===' '){
              event.preventDefault();choose(f.id);
            }
          });
          borders.appendChild(path);paths.push({id:f.id,element:path});
        }
      }
      svg.appendChild(borders);
      markersLayer=svgEl(doc,'g',{'pointer-events':'none'});
      animationLayer=svgEl(doc,'g',{'pointer-events':'none'});
      svg.append(markersLayer,animationLayer);
      renderMarkers();
    }
    async function setContinent(id) {
      if(!geography.getContinent(id))return false;
      const token=++loadToken;
      continentId=id;source=null;target=null;selection='source';
      clearEffects();mapShell.hidden=false;panel.hidden=false;
      regionalView=BOUNDS[id];
      lastWorld=false;setView(regionalView);setButtons();updatePanel();
      status('در حال آماده‌سازی نقشهٔ کشورها...');
      try {
        await loadData();
        if(token!==loadToken||continentId!==id)return false;
        paintMap();updatePanel();return true;
      }catch(error) {
        if(token===loadToken){
          status('بارگذاری مرز کشورها انجام نشد. دوباره قاره را انتخاب کنید.');
          if(typeof onError==='function')onError(error);
        }
        return false;
      }
    }
    function startShot() {
      if(!isActive()||!source||!target)return false;
      const weapon=getWeapon();
      if(!weapon||weapon.kind!=='missile'){
        status('ابتدا یک موشک از فهرست سلاح‌ها انتخاب کنید.');
        return false;
      }
      if(flights.length>=8){status('ظرفیت موشک‌های فعال پر است.');return false;}
      const number=getSalvoMode&&getSalvoMode()?3:1;
      const r=routePoints(source.anchor,target.anchor);
      const shift=continentId==='oceania'&&r.start.x<100?360:0;
      // Animate a fictional tactical missile over the 2D map. This is not
      // a real-world range/trajectory calculation.
      for(let i=0;i<number;i++) {
        const glyph=svgEl(doc,'g',{class:'geo-missile'});
        const trail=svgEl(doc,'path',{class:'geo-trail',d:'',fill:'none',
          'vector-effect':'non-scaling-stroke'});
        const body=svgEl(doc,'path',{d:'M 2.4 0 L -1.7 -0.85 L -1.25 0 L -1.7 0.85 Z',
          fill:'#fff7ed',stroke:'#f97316','stroke-width':0.25});
        const plume=svgEl(doc,'path',{d:'M -1.4 0 L -3.6 -0.5 L -2.5 0 L -3.6 0.5 Z',
          fill:'#fb923c',opacity:0.85});
        glyph.append(plume,body);animationLayer.append(trail,glyph);
        flights.push({r,shift,source,target,weapon,flight:root.GodSmashMissilePhysics.createFlight(weapon),
          delay:i*0.23,trail,glyph,passed:0});
      }
      if(typeof onSound==='function')onSound();
      status('در حال پرواز '+weapon.nameFa+' از '+source.fa+' به '+target.fa);
      return true;
    }
    function strike(shot) {
      const p=pointAt(shot.r,1);
      const x=p.x+shot.shift,y=p.y;
      const outer=svgEl(doc,'circle',{cx:x,cy:y,r:0.5,class:'geo-shockwave'});
      const inner=svgEl(doc,'circle',{cx:x,cy:y,r:0.4,class:'geo-fireball'});
      animationLayer.append(outer,inner);
      explosions.push({outer,inner,age:0,x,y});
      onImpact(shot.target,shot.weapon);
    }
    function update(dt) {
      if(!isActive()||!animationLayer||!Number.isFinite(dt)||dt<=0)return;
      for(let i=flights.length-1;i>=0;i--) {
        const s=flights[i];
        if(s.delay>0){s.delay-=dt;continue;}
        const step=root.GodSmashMissilePhysics.stepFlight(s.flight,dt);
        s.passed=step.progress;
        const p=pointAt(s.r,s.passed),q=pointAt(s.r,Math.min(1,s.passed+0.016));
        const angle=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;
        const scale=clamp(view.w/115,0.45,1.7);
        s.glyph.setAttribute('transform','translate('+(p.x+s.shift)+' '+p.y+
          ') rotate('+angle+') scale('+scale+')');
        const tail=pointAt(s.r,Math.max(0,s.passed-0.12));
        s.trail.setAttribute('d','M '+(tail.x+s.shift)+' '+tail.y+
          ' Q '+(pointAt(s.r,Math.max(0,s.passed-0.06)).x+s.shift)+' '+
          pointAt(s.r,Math.max(0,s.passed-0.06)).y+
          ' '+(p.x+s.shift)+' '+p.y);
        if(s.passed>=1){
          s.glyph.remove();s.trail.remove();flights.splice(i,1);strike(s);
        }
      }
      for(let i=explosions.length-1;i>=0;i--) {
        const e=explosions[i];e.age+=dt;
        if(e.age>=2.8){e.outer.remove();e.inner.remove();explosions.splice(i,1);continue;}
        const grow=e.age/2.8;
        e.outer.setAttribute('r',String(1+grow*9));
        e.outer.setAttribute('opacity',String(1-grow));
        e.inner.setAttribute('r',String(0.8+grow*2.6));
        e.inner.setAttribute('opacity',String(Math.max(0,1-grow*1.5)));
      }
    }
    // Selection and pan/zoom are pointer-driven, including mobile touch.
    svg.addEventListener('pointerdown',event=>{
      if(!isActive())return;
      held={x:event.clientX,y:event.clientY,original:{...view}};
      dragged=false;
    });
    svg.addEventListener('pointermove',event=>{
      if(!held)return;
      const dx=event.clientX-held.x,dy=event.clientY-held.y;
      if(Math.hypot(dx,dy)<7&&!dragged)return;
      dragged=true;
      const rect=svg.getBoundingClientRect();
      const scale=Math.min(rect.width/held.original.w,rect.height/held.original.h);
      setView([held.original.x-dx/scale,held.original.y-dy/scale,
        held.original.w,held.original.h]);
    });
    const release=()=>{held=null;};
    svg.addEventListener('pointerup',release);
    svg.addEventListener('pointercancel',release);
    svg.addEventListener('wheel',event=>{
      event.preventDefault();zoom(event.deltaY<0?0.84:1.19);
    },{passive:false});

    for(const continent of geography.listContinents()) {
      const button=doc.createElement('button');
      button.type='button';button.className='continent-choice';
      button.textContent=continent.nameFa;button.dataset.continentId=continent.id;
      button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>onChoose(continent.id));
      continentContainer.appendChild(button);buttons.set(continent.id,button);
    }
    launchButton.addEventListener('click',startShot);
    changeSourceButton.addEventListener('click',()=>{
      source=null;target=null;selection='source';updatePanel();renderMarkers();
    });
    worldButton.addEventListener('click',world);
    fitButton.addEventListener('click',fitContinent);
    mapShell.hidden=true;panel.hidden=true;
    return Object.freeze({setContinent,clear,isActive,getRoute:()=>source&&target?{
      source,target
    }:null,fire:startShot,choose,update,resetEffects:clearEffects,
      zoom,world,fitContinent,getSelected:()=>({source,target}),getView:()=>({...view})});
  }
  root.GodSmashContinentMode=Object.freeze({
    mount,polygonPath,routePoints,pointAt,xy
  });
  if(typeof module!=='undefined'&&module.exports)
    module.exports=root.GodSmashContinentMode;
})(typeof window!=='undefined'?window:globalThis);
