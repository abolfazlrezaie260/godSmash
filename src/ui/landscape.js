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
  function toLocalPoint(clientX,clientY,rect,rotated){
    if(!rect||!(rect.width>0)||!(rect.height>0))return {x:.5,y:.5};
    const x=rotated ? (clientY-rect.top)/rect.height :
      (clientX-rect.left)/rect.width;
    const y=rotated ? (rect.right-clientX)/rect.width :
      (clientY-rect.top)/rect.height;
    return {x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};
  }
  function toLocalDelta(dx,dy,rotated){
    return rotated ? {x:dy,y:-dx} : {x:dx,y:dy};
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
    let rotated=false,disposed=false,lockRequested=false;
    function viewport() {
      return {
        width:shell.clientWidth|| (rotated?view.innerHeight:view.innerWidth),
        height:shell.clientHeight|| (rotated?view.innerWidth:view.innerHeight)
      };
    }
    function sync(){
      if(disposed)return;
      rotated=wantsRotation(view.innerWidth,view.innerHeight,touch);
      shell.classList.toggle('is-rotated',rotated);
      shell.setAttribute('data-landscape-mode',rotated?'css-rotated':'native');
      onResize(viewport());
    }
    function tryNativeLock(){
      if(disposed||!touch||lockRequested)return;
      const orientation=view.screen&&view.screen.orientation;
      if(!orientation||typeof orientation.lock!=='function')return;
      lockRequested=true;
      try{
        Promise.resolve(orientation.lock('landscape')).catch(()=>{
          // Fall back to CSS if fullscreen/permission/OS policy rejects locking.
        });
      }catch(error){
        // CSS mode remains available even when the call throws synchronously.
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
      point:(x,y,rect)=>toLocalPoint(x,y,rect,rotated),
      delta:(dx,dy)=>toLocalDelta(dx,dy,rotated),
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
