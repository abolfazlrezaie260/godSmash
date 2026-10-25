/* Planetary damage: real openings in the render/collision mesh, fractured crater
 * walls and a recessed interior. Fictional, stylized physics; visual units only.
 * Designed to work without external assets and to be reset between planets.
 */
(function (root) {
  'use strict';

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function severity(weapon, planet) {
    const resistance = Math.max(0.1, planet.resistance || 1);
    return clamp(weapon.damage / resistance, 0.2, 16);
  }

  function createSystem(THREE, options) {
    if (!THREE || !options || !options.geometry || !options.group) {
      throw new TypeError('Three.js, the sphere geometry and planet group are required');
    }
    const geometry = options.geometry;
    const group = options.group;
    const radius = options.radius || 10;
    const coreRadius = radius * 0.805;
    const coreExposureDepth = radius - coreRadius;
    const maxBreaches = options.lowQuality ? 6 : 12;
    const spherePositions = new Float32Array(geometry.attributes.position.array);
    const originalPositions = new Float32Array(spherePositions);
    const initialIndex = geometry.index ? Array.from(geometry.index.array) : [];
    if (!initialIndex.length) throw new Error('Indexed planet geometry required');

    const holes = [];
    const scars = [];
    const maxImpactSites = options.lowQuality ? 72 : 160;
    const impactSites = [];
    let damagePercent = 0;
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius, options.lowQuality ? 24 : 40, 20),
      new THREE.MeshStandardMaterial({
        color: 0x292523, emissive: 0x30211a, emissiveIntensity: 0.12,
        roughness: 1, metalness: 0, side: THREE.DoubleSide
      })
    );
    inner.name = 'Exposed interior';
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius + radius * 0.015, options.lowQuality ? 20 : 32, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff5a1f, transparent: true, opacity: 0.38,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    coreGlow.name = 'Molten core glow halo';
    inner.add(coreGlow);
    inner.visible = false;
    group.add(inner);
    let shattered = false;

    function rebuildIndex() {
      if (!holes.length) {
        geometry.setIndex(initialIndex);
        return;
      }
      const pos = geometry.attributes.position;
      const selected = [];
      const ax = new THREE.Vector3();
      const bx = new THREE.Vector3();
      const cx = new THREE.Vector3();
      const centroid = new THREE.Vector3();
      for (let i = 0; i < initialIndex.length; i += 3) {
        const ia = initialIndex[i], ib = initialIndex[i + 1], ic = initialIndex[i + 2];
        ax.fromBufferAttribute(pos, ia);
        bx.fromBufferAttribute(pos, ib);
        cx.fromBufferAttribute(pos, ic);
        centroid.copy(ax).add(bx).add(cx).normalize();
        const removed = holes.some(h => centroid.dot(h.normal) > h.cosThreshold);
        if (!removed) selected.push(ia, ib, ic);
      }
      geometry.setIndex(selected);
    }

    function makeRim(normal, aperture, power, planet) {
      const up = Math.abs(normal.y) > 0.89 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tangent = up.clone().cross(normal).normalize();
      const bitangent = normal.clone().cross(tangent).normalize();
      const rings = [
        { angle: 1.35, altitude: 0.012 },
        { angle: 1.035, altitude: 0.14 + power * 0.018 },
        { angle: 0.85, altitude: -0.06 },
        { angle: 0.50, altitude: -radius * 0.125 },
        { angle: 0.24, altitude: -radius * 0.195 }
      ];
      const segments = options.lowQuality ? 28 : 48;
      const positions = [];
      const colors = [];
      const indices = [];
      const isCold = planet.id === 'moon';
      const shades = isCold
        ? ['#595b65', '#8a8c92', '#34343d', '#1e2026', '#282c33']
        : planet.id === 'mars'
          ? ['#744d3d', '#a77759', '#694b3f', '#4d3530', '#634638']
          : ['#46423e', '#806f62', '#363330', '#292523', '#453c36'];
      const randomScale = [];
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        randomScale.push(1 + 0.055 * Math.sin(angle * 7) + 0.042 * Math.sin(angle * 13 + 0.8));
      }

      for (let r = 0; r < rings.length; r++) {
        const row = rings[r];
        const color = new THREE.Color(shades[r]);
        for (let s = 0; s <= segments; s++) {
          const angle = (s / segments) * Math.PI * 2;
          const circle = tangent.clone().multiplyScalar(Math.cos(angle))
            .addScaledVector(bitangent, Math.sin(angle));
          const theta = aperture * row.angle * randomScale[s];
          const dir = normal.clone().multiplyScalar(Math.cos(theta))
            .addScaledVector(circle, Math.sin(theta)).normalize();
          const distance = radius + row.altitude + (r === 1 ? 0.07 * Math.sin(s * 3.7) : 0);
          const point = dir.multiplyScalar(distance);
          positions.push(point.x, point.y, point.z);
          colors.push(color.r, color.g, color.b);
          if (r < rings.length - 1 && s < segments) {
            const a = r * (segments + 1) + s;
            const b = a + segments + 1;
            indices.push(a, a + 1, b, a + 1, b + 1, b);
          }
        }
      }

      const meshGeometry = new THREE.BufferGeometry();
      meshGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      meshGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      meshGeometry.setIndex(indices);
      meshGeometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true, side: THREE.DoubleSide,
        roughness: 0.93, metalness: 0.0
      });
      const rim = new THREE.Mesh(meshGeometry, material);
      rim.name = 'Exposed fractured crust';
      return rim;
    }

    function deform(normal, blastRadius, power, incidence, impactDirection) {
      const positions = geometry.attributes.position;
      const vertex = new THREE.Vector3();
      const direction = new THREE.Vector3();
      let tangent = null;
      if (impactDirection && typeof impactDirection.clone === 'function') {
        tangent = impactDirection.clone()
          .addScaledVector(normal, -impactDirection.dot(normal)).normalize();
      }
      if (!tangent || tangent.length() < 1e-5) {
        const up = Math.abs(normal.y) > 0.89
          ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        tangent = up.cross(normal).normalize();
      }
      const bitangent = normal.clone().cross(tangent).normalize();
      const depth = clamp((0.3 + 0.11 * power) * (0.62 + 0.38 * incidence), 0.24, 1.85);
      const rimHeight = clamp((0.1 + 0.025 * power) * (0.65 + 0.35 * incidence), 0.08, 0.38);
      const elongation = 1 + (1 - incidence) * 0.72;

      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        const currentLength = vertex.length() || 1;
        direction.copy(vertex).multiplyScalar(1 / currentLength);
        const cosTheta = clamp(direction.dot(normal), -1, 1);
        // Use local tangent coordinates: grazing impacts create an elongated, shallower crater.
        const along = Math.atan2(direction.dot(tangent), cosTheta) * radius;
        const across = Math.atan2(direction.dot(bitangent), cosTheta) * radius;
        const t = Math.sqrt(
          Math.pow(along / (blastRadius * elongation), 2) +
          Math.pow(across / blastRadius, 2)
        );
        if (t < 0.86) {
          const bowl = Math.pow(Math.max(0, 1 - t * t / (0.86 * 0.86)), 1.5);
          vertex.multiplyScalar(Math.max(radius * 0.66, currentLength - depth * bowl) / currentLength);
        } else if (t < 1.38) {
          const ridge = Math.sin((t - 0.86) * Math.PI / 0.52);
          vertex.multiplyScalar((currentLength + rimHeight * Math.max(0, ridge)) / currentLength);
        } else {
          continue;
        }
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      positions.needsUpdate = true;
      return depth;
    }

    function recordImpact(normal, effectiveRadius, power, depth) {
      const footprintRadius = clamp((effectiveRadius / radius) * 1.25, 0.015, 0.88);
      let nearest = null;
      let nearestAngle = Infinity;
      for (const site of impactSites) {
        const angle = Math.acos(clamp(site.normal.dot(normal), -1, 1));
        if (angle < nearestAngle) {
          nearest = site;
          nearestAngle = angle;
        }
      }

      const overlaps = nearest && nearestAngle < nearest.radius + footprintRadius * 0.55;
      const merged = !!overlaps || impactSites.length >= maxImpactSites;
      if (merged) {
        if (!nearest) return {hits: 1, radius: footprintRadius, cumulativeDepth: depth, coreExposed: false};
        nearest.normal = nearest.normal.clone().multiplyScalar(nearest.hits)
          .add(normal).normalize();
        nearest.radius = Math.min(0.92, Math.max(
          nearest.radius,
          nearestAngle + footprintRadius * 0.68,
          (nearest.radius + footprintRadius) * 0.66
        ));
        nearest.severity = Math.min(32, nearest.severity + power * 0.16);
        nearest.hits += 1;
        nearest.cumulativeDepth = Math.min(radius * 2, nearest.cumulativeDepth + depth);
        nearest.coreExposed = nearest.coreExposed || nearest.cumulativeDepth >= coreExposureDepth;
      } else {
        impactSites.push({
          normal: normal.clone(),
          radius: footprintRadius,
          severity: power,
          hits: 1,
          cumulativeDepth: depth,
          coreExposed: depth >= coreExposureDepth
        });
      }

      // Spherical-cap coverage estimate; nearby hits are merged into one site.
      let remaining = 1;
      for (const site of impactSites) {
        const capFraction = (1 - Math.cos(site.radius)) * 0.5;
        remaining *= 1 - capFraction;
      }
      damagePercent = clamp((1 - remaining) * 100, 0, 100);
      return {
        hits: merged && nearest ? nearest.hits : 1,
        radius: merged && nearest ? nearest.radius : footprintRadius,
        cumulativeDepth: merged && nearest ? nearest.cumulativeDepth : impactSites[impactSites.length - 1].cumulativeDepth,
        coreExposed: merged && nearest ? nearest.coreExposed : impactSites[impactSites.length - 1].coreExposed
      };
    }

    function impact(localPoint, blastRadius, config) {
      const normal = localPoint.clone().normalize();
      const p = config.planet;
      const weapon = config.weapon;
      const power = severity(weapon, p);
      const incidence = clamp(Number.isFinite(config.incidence) ? config.incidence : 1, 0, 1);
      const effectiveRadius = blastRadius * (1 + (1 - incidence) * 0.72);
      const depth = deform(normal, blastRadius, power, incidence, config.impactDirection);
      const site = recordImpact(normal, effectiveRadius, power, depth);
      // The core only becomes visible once accumulated penetration reaches its radius.
      // It remains hidden behind intact crust, but appears naturally at a sufficiently deep crater floor.
      if (site.coreExposed && !shattered) inner.visible = true;

      let breached = false;
      let aperture = 0;
      if (config.breach && holes.length < maxBreaches) {
        aperture = clamp((effectiveRadius / radius) * (0.65 + power * 0.065), 0.085, 0.39);
        const overlaps = holes.some(h => Math.acos(clamp(h.normal.dot(normal), -1, 1)) < (h.aperture + aperture) * 0.78);
        if (!overlaps) {
          holes.push({
            normal: normal.clone(), aperture, cosThreshold: Math.cos(aperture)
          });
          const scar = makeRim(normal, aperture, power, p);
          group.add(scar);
          scars.push(scar);
          inner.visible = !shattered;
          breached = true;
        }
      }
      if (breached) rebuildIndex();
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      return {
        breached, depth, aperture, power, incidence, effectiveRadius,
        damagePercent, impactSiteCount: impactSites.length, siteHits: site.hits,
        cumulativeDepth: site.cumulativeDepth, coreExposed: site.coreExposed
      };
    }

    // Extraction lowers the real surface vertices, rather than producing a
    // normal blast/scorch, removing topology, or showing molten impact effects.
    // Repeated harvest passes deepen one smooth, clean-edged bowl. Existing
    // crater sites and the rebuild/reset budget remain shared with weapons.
    function extract(localPoint, extractionRadius, depth = 0.49) {
      if(shattered)return {extracted:false,depth:0};
      if(!localPoint||typeof localPoint.clone!=='function'||
        !Number.isFinite(extractionRadius)||extractionRadius<=0||
        !Number.isFinite(depth)||depth<=0)
        throw new TypeError('Valid extraction point, radius and depth required');
      const normal=localPoint.clone().normalize();
      const attr=geometry.attributes.position;
      const v=new THREE.Vector3(),direction=new THREE.Vector3();
      const width=clamp(extractionRadius,0.25,radius*.26);
      const amount=clamp(depth,.05,radius*.105);
      let affected=0;
      for(let i=0;i<attr.count;i++){
        v.fromBufferAttribute(attr,i);
        const length=v.length()||1;
        direction.copy(v).multiplyScalar(1/length);
        const cos=clamp(direction.dot(normal),-1,1);
        const distance=Math.acos(cos)*radius;
        const t=distance/width;
        if(t>=1)continue;
        // Flat clean center, feathered ramp at rim, no explosion uplift.
        const falloff=t<.25?1:
          (1-((t-.25)/.75)**2)**2;
        const wanted=Math.max(radius*.69,length-amount*falloff);
        if(wanted>=length)continue;
        v.multiplyScalar(wanted/length);
        attr.setXYZ(i,v.x,v.y,v.z);
        affected++;
      }
      if(affected>0){
        attr.needsUpdate=true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      }
      const site=recordImpact(normal,width,1.2,amount);
      if(site.coreExposed)inner.visible=true;
      return {extracted:affected>0,vertices:affected,depth:amount,
        siteHits:site.hits,damagePercent,coreExposed:site.coreExposed};
    }

    // Replace pristine terrain only between planets, never over active damage.
    // Existing impact/debris/reset code continues to use originalPositions, which
    // becomes the per-planet baseline instead of the Earth-only sphere.
    function setTerrain(sampleElevationKm) {
      if (sampleElevationKm !== null && typeof sampleElevationKm !== 'function')
        throw new TypeError('Elevation must be a sampler or null');
      if (holes.length || impactSites.length || scars.length)
        throw new Error('Reset damage before changing terrain');
      const positions=geometry.attributes.position;
      const vector=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        const j=i*3;
        const x=spherePositions[j],y=spherePositions[j+1],z=spherePositions[j+2];
        // Match THREE.SphereGeometry UVs (u = 1 - azimuth / 2π);
        // previous crater-only mapping used a different longitude origin.
        const longitude=((1-Math.atan2(z,-x)/(Math.PI*2))*360+360)%360;
        const latitude=Math.asin(clamp(y/radius,-1,1))*180/Math.PI;
        const km=sampleElevationKm ? sampleElevationKm(longitude,latitude) : 0;
        if(!Number.isFinite(km))throw new TypeError('Elevation must be finite');
        const factor=1+clamp(km,-10,22)/3389.5;
        originalPositions[j]=x*factor;
        originalPositions[j+1]=y*factor;
        originalPositions[j+2]=z*factor;
      }
      positions.array.set(originalPositions);
      positions.needsUpdate=true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    }

    function setPlanet(planet) {
      if (planet.id === 'moon') {
        inner.material.color.set('#252831');
        inner.material.emissive.set('#2d303c');
        inner.material.emissiveIntensity = 0.35;
        coreGlow.material.color.set('#7b8296');
        coreGlow.material.opacity = 0.12;
      } else if (planet.id === 'mars') {
        inner.material.color.set('#492019');
        inner.material.emissive.set('#f05418');
        inner.material.emissiveIntensity = 1.8;
        coreGlow.material.color.set('#ff4d20');
        coreGlow.material.opacity = 0.36;
      } else {
        inner.material.color.set('#351917');
        inner.material.emissive.set('#ed621a');
        inner.material.emissiveIntensity = 2.2;
        coreGlow.material.color.set('#ff641f');
        coreGlow.material.opacity = 0.42;
      }
    }

    function setShattered(value) {
      shattered = !!value;
      inner.visible = (holes.length > 0 || impactSites.some(site => site.coreExposed)) && !shattered;
      for (const scar of scars) scar.visible = !shattered;
    }

    function reset() {
      geometry.attributes.position.array.set(originalPositions);
      geometry.attributes.position.needsUpdate = true;
      holes.length = 0;
      impactSites.length = 0;
      damagePercent = 0;
      rebuildIndex();
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      for (const scar of scars) {
        group.remove(scar);
        scar.geometry.dispose();
        scar.material.dispose();
      }
      scars.length = 0;
      shattered = false;
      inner.visible = false;
    }

    return Object.freeze({
      impact, extract, reset, setPlanet, setShattered, setTerrain,
      getBreachCount: () => holes.length,
      getMaxBreaches: () => maxBreaches,
      getDamagePercent: () => damagePercent,
      getImpactSiteCount: () => impactSites.length,
      getMaxImpactSites: () => maxImpactSites,
      getCoreExposureCount: () => impactSites.filter(site => site.coreExposed).length,
      isCoreExposed: () => impactSites.some(site => site.coreExposed)
    });
  }

  root.GodSmashPlanetDamage = Object.freeze({createSystem, severity});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GodSmashPlanetDamage;
})(typeof window !== 'undefined' ? window : globalThis);
