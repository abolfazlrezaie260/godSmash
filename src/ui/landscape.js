/* Mobile/tablet landscape viewport controller.
 * Screen Orientation locking is a best effort: browsers may require fullscreen,
 * and Safari may not expose lock(). The CSS landscape fallback always works.
 */
(function(root){
  'use strict';
  function wantsRotation(width,height,touch){
    return Boolean(touch && Number.isFinite(width) && Number.isFinite(height) &&
      width>0 && height>0 && height>width);
  }
  function toLocalPoint(clientX,clientY,rect,rotated,direction=1){
    if(!rect||!(rect.width>0)||!(rect.height>0))return {x:.5,y:.5};
    const x=rotated
      ? (direction<0 ? rect.bottom-clientY : clientY-rect.top)/rect.height
      : (clientX-rect.left)/rect.width;
    const y=rotated
      ? (direction<0 ? clientX-rect.left : rect.right-clientX)/rect.width
      : (clientY-rect.top)/rect.height;
    return {x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};
  }
  function toLocalDelta(dx,dy,rotated,direction=1){
    if(!rotated)return {x:dx,y:dy};
    return direction<0 ? {x:-dy,y:dx} : {x:dy,y:-dx};
  }
  function mount(options){
    const view=options&&options.view;
    const document=options&&options.document;
    const shell=options&&options.shell;
    const onResize=options&&options.onResize;
    if(!view||!document||!shell||typeof onResize!=='function')
      throw new TypeError('Landscape controller needs window, document, shell and onResize');

    const touch=options.touch!==undefined ? !!options.touch :
      Boolean(view.navigator?.maxTouchPoints>0 ||
        (typeof view.matchMedia==='function' && view.matchMedia('(pointer: coarse)').matches));
    let rotated=false,disposed=false,lockRequested=false,direction=1;
    function viewport() {
      return {
        width:shell.clientWidth|| (rotated?view.innerHeight:view.innerWidth),
        height:shell.clientHeight|| (rotated?view.innerWidth:view.innerHeight)
      };
    }
    function sync(){
      if(disposed)return;
      rotated=wantsRotation(view.innerWidth,view.innerHeight,touch);
      direction=view.screen?.orientation?.type==='portrait-secondary' ? -1 : 1;
      shell.classList.toggle('is-rotated',rotated);
      shell.classList.toggle('is-counterclockwise',rotated&&direction<0);
      shell.setAttribute('data-landscape-mode',rotated?'css-rotated':'native');
      onResize(viewport());
    }
    function tryNativeLock(){
      if(disposed||!touch||lockRequested)return;
      const orientation=view.screen&&view.screen.orientation;
      if(!orientation||typeof orientation.lock!=='function')return;
      lockRequested=true;
      // The fullscreen promise is initiated during the user's actual tap;
      // most mobile browsers require fullscreen before screen orientation lock.
      try{
        const target=document.documentElement;
        const entering= !document.fullscreenElement &&
          typeof target?.requestFullscreen==='function'
          ? target.requestFullscreen() : Promise.resolve();
        Promise.resolve(entering).catch(()=>{}).then(()=>
          orientation.lock('landscape')
        ).catch(()=>{
          // Native lock is optional. Portrait CSS fallback stays active.
        });
      }catch(error){
        // Unsupported fullscreen/lock must never block the game.
      }
    }
    view.addEventListener('resize',sync);
    if(view.screen?.orientation?.addEventListener)
      view.screen.orientation.addEventListener('change',sync);
    // Attempt native lock on a genuine user gesture; never force fullscreen.
    view.addEventListener('pointerdown',tryNativeLock,{once:true,passive:true});
    sync();
    return Object.freeze({
      sync,tryNativeLock,
      getViewport:viewport,
      isRotated:()=>rotated,
      point:(x,y,rect)=>toLocalPoint(x,y,rect,rotated,direction),
      delta:(dx,dy)=>toLocalDelta(dx,dy,rotated,direction),
      dispose(){
        if(disposed)return;
        disposed=true;
        view.removeEventListener('resize',sync);
        if(view.screen?.orientation?.removeEventListener)
          view.screen.orientation.removeEventListener('change',sync);
        view.removeEventListener('pointerdown',tryNativeLock);
      }
    });
  }
  const api=Object.freeze({wantsRotation,toLocalPoint,toLocalDelta,mount});
  root.GodSmashLandscape=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
