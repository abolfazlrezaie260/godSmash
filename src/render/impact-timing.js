/* Explicit phases for visible, restrained cinematic impacts.
 * Game time, not wall clock, drives every envelope at all speed settings.
 */
(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
  function duration(size,lowQuality){
    return size>=5 ? (lowQuality?6.6:8.0) : (lowQuality?4.8:6.0);
  }
  function sample(progress){
    const t=clamp(progress,0,1);
    const flame=smooth(0,.09,t)*(1-smooth(.26,.56,t));
    const plasma=smooth(.012,.09,t)*(1-smooth(.19,.44,t));
    const shock=smooth(.07,.18,t)*(1-smooth(.31,.68,t));
    const dust=smooth(.14,.31,t)*(1-smooth(.74,1,t));
    const flash=1-smooth(.015,.12,t);
    return Object.freeze({
      flame,plasma,shock,dust,flash,
      fireScale:.08+1.75*smooth(.02,.33,t),
      shellScale:.12+1.82*smooth(.04,.47,t),
      dustScale:.25+2.05*smooth(.12,.89,t),
      shockScale:.2+2.6*smooth(.09,.73,t)
    });
  }
  const api=Object.freeze({duration,sample});
  root.GodSmashImpactTiming=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
