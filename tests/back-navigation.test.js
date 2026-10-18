const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// Run the real navigation functions with a session-history and dialog adapter.
// The optional Chrome intervention adapter models the observed contract that
// pushState without transient activation makes the preceding entry skippable
// by browser UI Back. Physical Android gestures still need device checks.
const app=fs.readFileSync(require.resolve('../dist/app.js'),'utf8');
const navigationSource=app.slice(app.indexOf('function appHistoryEntry('),app.indexOf('  renderScreenChrome();',app.indexOf('function showScreen(')))+'\n}';
const scope='https://example.test/old-world-roster/';
const entry=(screen,root=false)=>({towNavigation:{version:1,scope,screen,root,scrollY:0}});

function setup({initial='home',navigationAPI=true,state=null,chromeIntervention=false,asyncTraversal=false}={}){
  const listeners=new Map(),documentListeners=new Map(),navigationListeners=[],dialogs=[];
  const body={style:{},dataset:{screen:initial}};
  const items=[{url:'https://outside.test/',sameDocument:false,state:null},{url:scope,sameDocument:true,state}];
  let index=1,exits=0,menu=false,closeClicks=0,traversals=0;
  const traversalQueue=[];
  const dispatch=(type,event={})=>{for(const fn of listeners.get(type)||[])fn(event);};
  const history={
    get state(){return items[index].state;},
    replaceState(state){items[index]={...items[index],state:structuredClone(state)};entryChanged(-1);},
    pushState(state){
      if(chromeIntervention){
        if(context.navigator.userActivation.isActive){for(const item of items)if(item.sameDocument)item.skip=false;}
        else items[index].skip=true;
      }
      const from=index;items.splice(index+1);items.push({url:scope,sameDocument:true,state:structuredClone(state)});index++;entryChanged(from);
    },
    back(){requestMove(-1);},forward(){requestMove(1);}
  };
  function entryChanged(from){for(const fn of navigationListeners)fn({from:{index:from}});}
  function requestMove(delta,browserUI=false){
    if(asyncTraversal)traversalQueue.push(()=>move(delta,browserUI));
    else move(delta,browserUI);
  }
  function move(delta,browserUI=false){
    assert.ok(++traversals<1000,'history traversal must settle');
    let next=index+delta;
    if(browserUI&&chromeIntervention)while(next>=0&&next<items.length&&items[next].skip)next+=delta;
    if(next<0||next>=items.length)return;
    const from=index;index=next;if(!items[index].sameDocument){exits++;return;}
    entryChanged(from);
    dispatch('popstate',{state:history.state});
  }
  const context={
    APP_SCREENS:['home','factions','reference','forge','roster','rules','quicksheet','tutorial','saved','play'],
    APP_NAV_KEY:'towNavigation',screen:initial,navigationReady:false,navigatingHistory:false,trustedBackGuard:false,traversingAppBack:false,restoringAppHistory:null,
    history,navigator:{userActivation:{isActive:true}},location:{origin:'https://example.test',pathname:'/old-world-roster/'},URL,
    addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},
    document:{body,hidden:false,addEventListener(type,fn){documentListeners.set(type,[...(documentListeners.get(type)||[]),fn]);},querySelector(){return {classList:{contains:()=>menu}};}},
    window:{scrollY:0,scrollTo(x,y){this.scrollY=y;},TOWUIAccessibility:{getActiveDialog:()=>dialogs.at(-1)||null}},
    $(id){return id?{click(){closeClicks++;dialogs.pop();}}:null;},closeMenu(){menu=false;}
  };
  if(navigationAPI)context.window.navigation={addEventListener(type,fn){if(type==='currententrychange')navigationListeners.push(fn);},entries:()=>items.map((item,index)=>({...item,index})),get currentEntry(){return {index};}};
  vm.createContext(context);vm.runInContext(navigationSource,context);
  context.initializeAppNavigation();
  return {
    context,history,items,dispatch,
    browserBack:()=>requestMove(-1,true),
    flushOne:()=>traversalQueue.shift()?.(),
    flush(){while(traversalQueue.length)traversalQueue.shift()();},
    get pending(){return traversalQueue.length;},
    get screen(){return context.screen;},get exits(){return exits;},get closeClicks(){return closeClicks;},get index(){return index;},
    show:next=>context.showScreen(next),
    touch:()=>dispatch('pointerup',{isTrusted:true}),
    dialog(id){dialogs.push({closest:()=>({id})});context.ensureAppBackEntry();},
    get dialogs(){return dialogs.length;},
    openMenu(){menu=true;context.ensureAppBackEntry();},get menu(){return menu;},
    visibility(){for(const fn of documentListeners.get('visibilitychange')||[])fn();}
  };
}

test('repeated Back at home stays inside the app, including after reload',()=>{
  for(const navigationAPI of [true,false]){
    const app=setup({navigationAPI});app.touch();
    for(let i=0;i<30;i++){app.history.back();assert.equal(app.screen,'home');}
    assert.equal(app.exits,0);
    const restored=setup({navigationAPI,state:structuredClone(app.history.state)});
    for(let i=0;i<20;i++)restored.history.back();
    assert.equal(restored.exits,0);
  }
});

test('Back from a direct screen link reaches home and remains there',()=>{
  const app=setup({initial:'roster'});app.touch();app.history.back();
  assert.equal(app.screen,'home');
  for(let i=0;i<20;i++)app.history.back();
  assert.equal(app.exits,0);
});

test('ordinary screen Back and Forward preserve the screen order',()=>{
  const app=setup();app.touch();app.show('reference');app.show('roster');app.show('play');
  app.history.back();assert.equal(app.screen,'roster');
  app.history.back();assert.equal(app.screen,'reference');
  app.history.forward();assert.equal(app.screen,'roster');
  app.history.forward();assert.equal(app.screen,'play');
  assert.equal(app.exits,0);
});

test('Forward across a gesture boundary stays on that screen',()=>{
  const app=setup();app.show('reference');app.touch();app.show('roster');
  app.history.back();assert.equal(app.screen,'reference');
  app.history.back();assert.equal(app.screen,'home');
  app.history.forward();assert.equal(app.screen,'reference');
  // Crossing the same-screen gesture entry while moving forward must not
  // trigger an automatic Back and lose the later roster screen.
  app.history.forward();assert.equal(app.screen,'reference');
  app.history.forward();assert.equal(app.screen,'roster');
  assert.equal(app.exits,0);
});

test('Back closes only the top dialog using its existing cancel action',()=>{
  const app=setup();app.touch();app.show('reference');
  app.dialog('configBackdrop');app.dialog('ruleBackdrop');
  app.history.back();assert.equal(app.dialogs,1);assert.equal(app.closeClicks,1);assert.equal(app.screen,'reference');
  app.history.back();assert.equal(app.dialogs,0);assert.equal(app.closeClicks,2);assert.equal(app.screen,'reference');
  app.history.back();assert.equal(app.screen,'home');assert.equal(app.exits,0);
});

test('Back dismisses the menu before changing screens',()=>{
  const app=setup();app.touch();app.show('rules');app.openMenu();
  app.history.back();assert.equal(app.menu,false);assert.equal(app.screen,'rules');
  app.history.back();assert.equal(app.screen,'home');assert.equal(app.exits,0);
});

test('a restored entry with no same-document guard receives a new boundary',()=>{
  const app=setup({initial:'home',state:entry('saved')});
  assert.equal(app.screen,'saved');app.history.back();assert.equal(app.screen,'home');
  for(let i=0;i<10;i++)app.history.back();assert.equal(app.exits,0);
});

test('unknown same-document state and return to visibility repair the boundary',()=>{
  const app=setup();app.touch();app.history.replaceState(null);app.show('reference');
  app.history.back();assert.equal(app.screen,'home');
  app.history.replaceState(null);app.visibility();app.dispatch('pageshow');
  for(let i=0;i<10;i++)app.history.back();assert.equal(app.exits,0);
});

test('the trusted gesture boundary is installed once and untrusted events do not add it',()=>{
  const app=setup({initial:'reference'}),before=app.items.length;
  app.dispatch('pointerup',{isTrusted:false});assert.equal(app.items.length,before);
  app.context.navigator.userActivation.isActive=false;
  app.touch();assert.equal(app.items.length,before);
  app.context.navigator.userActivation.isActive=true;
  app.touch();assert.equal(app.items.length,before+1);
  app.touch();app.dispatch('keydown',{isTrusted:true});assert.equal(app.items.length,before+1);
  app.history.back();assert.equal(app.screen,'home');assert.equal(app.exits,0);
});

test('browser UI Back remains inside after transient activation expires',()=>{
  for(const navigationAPI of [true,false]){
    const app=setup({navigationAPI,chromeIntervention:true});app.touch();
    app.context.navigator.userActivation.isActive=false;
    const length=app.items.length;
    for(let i=0;i<30;i++){
      app.browserBack();
      assert.equal(app.exits,0,`browser Back ${i+1} must not skip the app boundary`);
      assert.equal(app.screen,'home');
    }
    assert.equal(app.items.length,length,'Back must reuse existing entries after activation expires');
  }
});

test('expired-activation browser Back cancels nested dialogs before returning home',()=>{
  const app=setup({chromeIntervention:true});app.touch();app.show('reference');
  app.dialog('configBackdrop');app.dialog('ruleBackdrop');
  app.context.navigator.userActivation.isActive=false;
  const length=app.items.length;
  app.browserBack();assert.equal(app.dialogs,1);assert.equal(app.screen,'reference');
  app.browserBack();assert.equal(app.dialogs,0);assert.equal(app.screen,'reference');
  app.browserBack();assert.equal(app.screen,'home');
  for(let i=0;i<10;i++)app.browserBack();
  assert.equal(app.exits,0);
  assert.equal(app.closeClicks,2);
  assert.equal(app.items.length,length);
});

test('visibility and modal observers do not add entries during asynchronous root restoration',()=>{
  const app=setup({chromeIntervention:true,asyncTraversal:true});app.touch();
  app.context.navigator.userActivation.isActive=false;
  // The first Back consumes the extra gesture entry. The next reaches the
  // root; its forward restoration is a separate, asynchronous traversal.
  app.browserBack();app.flush();
  app.browserBack();app.flushOne();
  assert.equal(app.pending,1);
  const length=app.items.length;
  app.visibility();app.dispatch('pageshow');app.context.ensureAppBackEntry();
  assert.equal(app.items.length,length);
  app.flush();
  assert.equal(app.context.restoringAppHistory,null);
  for(let i=0;i<20;i++){app.browserBack();app.flush();}
  assert.equal(app.exits,0);
  assert.equal(app.screen,'home');
});
