const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1] || '';

test('mission results dialog and lifetime HUD are discoverable and styled for mobile',()=>{
  assert.match(html,/src="\.\/src\/simulation\/score-system\.js"/);
  for(const id of ['btn-scores','score-total','score-completions','score-modal',
    'score-title','score-earned','score-duration','score-launches','score-hits',
    'score-breaches','score-weapons','score-parts','score-bests',
    'score-close','score-retry','score-planets']){
    assert.ok(html.includes('id="'+id+'"'),id+' must exist');
  }
  assert.match(html,/id="score-modal"[^>]*hidden/);
  assert.match(html,/class="score-sheet" role="dialog" aria-modal="true"/);
  assert.match(html,/#score-modal\[hidden\]\s*\{\s*display:none/);
  assert.match(html,/@media \(max-height:510px\)/);
  assert.match(html,/score-sheet[^}]*max-height:calc\(100dvh - 24px\)/);
  assert.match(script,/scoreModal\.addEventListener\('keydown'/);
  assert.match(script,/e\.key==='Escape'/);
  assert.match(script,/scoreModal\.querySelectorAll\('button:not\(:disabled\)'\)/);
});

test('all attack types record launches and every successful surface change is recorded',()=>{
  assert.match(script,/function launchMissileAtWorldPoint[\s\S]*?scores\.recordLaunch\(selected\)/);
  assert.match(script,/function triggerNuclearDetonation[\s\S]*?scores\.recordImpact\(selected\)/);
  assert.match(script,/fleet\.sim\.pointAt\([\s\S]*?scores\.recordLaunch\(selected\)/);
  assert.match(script,/fleet\.sim\.attack\([\s\S]*?scores\.recordLaunch\(selected\)/);
  assert.match(script,/scene\.add\(beam\);\s*scores\.recordLaunch\(selected\)/);
  assert.match(script,/scores\.recordIntercept\(m\.weapon\)/);
  assert.match(script,/scores\.recordImpact\(catalog\.getWeapon\('harvester'\)\)/);
  assert.match(script,/if\(state\.integrity<=0 && !state\.shattered\)triggerPlanetaryShatter\(\)/);
});

test('shatter creates one score report, reset clears active run and modal cannot outlive reset',()=>{
  assert.match(script,/const report = scores\.complete\(planet, \{/);
  assert.match(script,/breaches:planetDamage\.getBreachCount\(\)/);
  assert.match(script,/surfaceDamage:planetDamage\.getDamagePercent\(\)/);
  assert.match(script,/if\(finishedGeneration===generation && state\.shattered\)/);
  assert.match(script,/openScoreModal\(report\)/);
  assert.match(script,/function resetEarth\(\) \{\s*generation\+\+;\s*closeScoreModal\(\);\s*scores\.resetRun\(\)/);
  assert.match(script,/if\(!document\.hidden\) scores\.tick\(frameDt\)/);
  assert.match(script,/scoreRetry\.addEventListener\('click'/);
  assert.match(script,/scorePlanets\.addEventListener\('click'/);
  assert.match(script,/scoreButton\.addEventListener\('click'/);
});
