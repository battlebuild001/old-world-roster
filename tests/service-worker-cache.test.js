const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const workerSource=fs.readFileSync(require.resolve('../dist/sw.js'),'utf8');

function worker({scope='https://roster.example/',canonicalHTML=true,overrides={}}={}){
  const handlers=new Map(),stores=new Map(),writes=[],requests=[];
  let skipWaitingCalls=0;
  const key=request=>typeof request==='string'?request:request.url||request.href;
  function clone(response){
    const copy=response.clone();
    // Real fetched responses retain these internal values when cloned. The
    // network adapter sets them explicitly on native Response fixtures.
    Object.defineProperties(copy,{redirected:{value:response.redirected},url:{value:response.url}});
    return copy;
  }
  const caches={
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());
      const store=stores.get(name);
      return {
        async put(request,response){writes.push({url:key(request),redirected:response.redirected});store.set(key(request),clone(response));},
        async match(request){const response=store.get(key(request));return response?clone(response):undefined;}
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);}
  };
  const self={registration:{scope},location:{origin:new URL(scope).origin},clients:{async claim(){}},
    addEventListener(type,handler){handlers.set(type,handler);},
    async skipWaiting(){skipWaitingCalls++;}
  };
  const network=async request=>{
    const url=new URL(key(request));
    requests.push(url.href);
    const override=overrides[url.pathname]||{};
    if(override.error)throw override.error;
    const html=url.pathname.endsWith('.html');
    const canonical=new URL(url.href);canonical.pathname=canonical.pathname.replace(/index\.html$/,'').replace(/\.html$/,'');
    const target=override.target||(html&&canonicalHTML?canonical.href:url.href);
    const body=html?'<main>Current roster and play mode</main>':'cached asset';
    const response=new Response(body,{status:override.status||200,headers:{
      'content-type':override.contentType||(html?'text/html; charset=utf-8':url.pathname.endsWith('.webp')?'image/webp':'application/octet-stream'),
      'content-encoding':'gzip','content-length':'9999','x-version':'latest'
    }});
    Object.defineProperties(response,{redirected:{value:target!==url.href},url:{value:target}});
    return response;
  };
  vm.runInNewContext(workerSource,{self,caches,fetch:network,URL,Headers,Response});
  async function dispatch(type,event={}){
    const pending=[];let response;
    handlers.get(type)({...event,waitUntil(promise){pending.push(promise);},respondWith(promise){response=promise;}});
    await Promise.all(pending);
    return response?await response:undefined;
  }
  return {writes,stores,requests,scope,get skipWaitingCalls(){return skipWaitingCalls;},
    install:()=>dispatch('install'),
    activate:()=>dispatch('activate'),
    image:(name='unit-photo-images/example.webp')=>dispatch('fetch',{request:{method:'GET',mode:'no-cors',destination:'image',url:new URL(name,scope).href}}),
    async status(){let result;await dispatch('message',{data:{type:'CACHE_STATUS'},ports:[{postMessage(value){result=value;}}]});return result;},
    navigate:()=>dispatch('fetch',{request:{method:'GET',mode:'navigate',redirect:'manual',url:scope}})
  };
}

test('Sites canonical HTML redirects cache successfully and serve nonredirected offline navigation',async()=>{
  for(const scope of ['https://roster.example/','https://roster.example/old-world-roster/']){
    const app=worker({scope});await app.install();
    assert.equal(app.skipWaitingCalls,1);
    assert.equal((await app.status()).ready,true);
    const htmlWrites=app.writes.filter(item=>item.url.endsWith('.html'));
    assert.equal(htmlWrites.length,2);
    assert(htmlWrites.every(item=>item.redirected===false),'canonical documents must lose their redirect flag before caching');
    const response=await app.navigate();
    assert.equal(response.redirected,false);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-encoding'),null);
    assert.equal(response.headers.get('content-length'),null);
    assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8');
    assert.equal(response.headers.get('x-version'),'latest');
    assert.match(await response.text(),/Current roster and play mode/);
  }
});

test('unit photographs are cached on first view without adding them to the required installation or deleting them on activation',async()=>{
  const app=worker();await app.install();
  assert(!app.requests.some(url=>url.includes('/unit-photo-images/')),'Photos are loaded only when viewed');
  const first=await app.image();assert.equal(first.status,200);
  const count=app.requests.length;const second=await app.image();
  assert.equal(second.status,200);assert.equal(app.requests.length,count,'Second view uses the photo cache');
  assert(app.stores.get('tow-unit-photo-v1').size===1);
  await app.activate();assert(app.stores.has('tow-unit-photo-v1'),'App activation preserves already viewed photographs');
  assert.equal((await app.status()).ready,true);
});

test('an unavailable or nonimage response does not poison the unit photo cache',async()=>{
  for(const override of [{status:404},{contentType:'text/html'}]){
    const app=worker({overrides:{'/unit-photo-images/example.webp':override}});
    await app.image();await app.image();
    assert.equal(app.requests.length,2);assert.equal(app.stores.get('tow-unit-photo-v1').size,0);
  }
});

test('direct HTML responses still install on hosts without canonical redirects',async()=>{
  const app=worker({canonicalHTML:false});await app.install();
  assert.equal(app.skipWaitingCalls,1);
  assert.equal((await app.status()).ready,true);
  assert.equal((await app.navigate()).redirected,false);
});

for(const [name,path,target] of [
  ['foreign origin','/index.html','https://outside.example/'],
  ['login route','/index.html','https://roster.example/login'],
  ['query','/index.html','https://roster.example/?login=1'],
  ['non-HTML asset','/app.js','https://roster.example/app']
])test(`an unexpected ${name} redirect cannot activate the new worker`,async()=>{
  const app=worker({overrides:{[path]:{target}}});
  await assert.rejects(app.install(),/Unexpected asset redirect/);
  assert.equal(app.skipWaitingCalls,0);
  assert.equal((await app.status()).ready,false);
});

test('an unavailable required asset prevents activation',async()=>{
  const app=worker({overrides:{'/app.js':{status:500}}});
  await assert.rejects(app.install(),/Asset unavailable/);
  assert.equal(app.skipWaitingCalls,0);
  assert.equal((await app.status()).ready,false);
});

test('a failed network request prevents activation',async()=>{
  const app=worker({overrides:{'/app.js':{error:new Error('network interrupted')}}});
  await assert.rejects(app.install(),/network interrupted/);
  assert.equal(app.skipWaitingCalls,0);
  assert.equal((await app.status()).ready,false);
});
