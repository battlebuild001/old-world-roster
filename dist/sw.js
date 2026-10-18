const CACHE = 'bth-tow-v40-unit-selection';
const ASSETS = ["./index.html","./redesign-preview.html","./redesign-preview.css","./redesign-premium.css","./redesign-crest.svg","./redesign-preview.js","./modern.css","./premium-app.css","./ui-polish.css","./unit-picker.css","./ui-accessibility.js","./app.js","./quicksheet.js","./rules-reader.js","./tutorial.js","./tutorial-diagrams.js","./rules-catalog.json","./i18n.js","./translations-ko.json","./translations-ui-en.json","./tow-core.js","./option-core.js","./matched-play.js","./play-profiles.js","./data/play-weapon-profiles.json","./roster-seed.js","./pwa.js","./manifest.webmanifest","./icon-192.png","./icon-512.png","./data/games/the-old-world/1.5/chaos-dwarfs.json","./data/games/the-old-world/1.5/daemons-of-chaos.json","./data/games/the-old-world/1.5/dark-elves.json","./data/games/the-old-world/1.5/lizardmen.json","./data/games/the-old-world/1.5/magic-items.json","./data/games/the-old-world/1.5/ogre-kingdoms.json","./data/games/the-old-world/1.5/skaven.json","./data/games/the-old-world/1.5/vampire-counts.json","./data/games/the-old-world/beastmen-brayherds.json","./data/games/the-old-world/chaos-dwarfs.json","./data/games/the-old-world/daemons-of-chaos.json","./data/games/the-old-world/dark-elves.json","./data/games/the-old-world/dwarfen-mountain-holds.json","./data/games/the-old-world/empire-of-man.json","./data/games/the-old-world/grand-cathay.json","./data/games/the-old-world/high-elf-realms.json","./data/games/the-old-world/kingdom-of-bretonnia.json","./data/games/the-old-world/lizardmen.json","./data/games/the-old-world/magic-items.json","./data/games/the-old-world/ogre-kingdoms.json","./data/games/the-old-world/orc-and-goblin-tribes.json","./data/games/the-old-world/renegade-crowns.json","./data/games/the-old-world/skaven.json","./data/games/the-old-world/tomb-kings-of-khemri.json","./data/games/the-old-world/vampire-counts.json","./data/games/the-old-world/warriors-of-chaos.json","./data/games/the-old-world/wood-elf-realms.json","./data/games/warhammer-fantasy/dwarfs.json","./data/games/warhammer-fantasy/greenskins.json","./data/games/warhammer-fantasy/magic-items.json","./data/games/warhammer-fantasy/the-empire.json","./data/source.json","./data/src/assets/lores-of-magic-with-spells.json","./data/src/assets/the-old-world.json","./data/src/components/rules-index/rules-index-export.json","./data/src/components/rules-index/rule-aliases.json","./data/src/i18n/cn.json","./data/src/i18n/de.json","./data/src/i18n/en.json","./data/src/i18n/es.json","./data/src/i18n/fr.json","./data/src/i18n/it.json","./data/src/i18n/pl.json"];
const URLS = new Set(ASSETS.map(path => new URL(path,self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const pending = [...ASSETS];
    await Promise.all(Array.from({length:6},async () => {
      while(pending.length) {
        const path=pending.shift();
        const url=new URL(path,self.registration.scope);
        const response=await fetch(url,{cache:'reload'});
        if(!response.ok||response.redirected)throw new Error('Asset unavailable: '+path);
        await cache.put(url,response);
      }
    }));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('bth-tow-')&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),home=new URL('./',self.registration.scope);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'&&(url.pathname===home.pathname||url.pathname===home.pathname+'index.html')) {
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(new URL('./index.html',home)))||fetch(event.request)));
  } else if(URLS.has(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
  }
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const entries=await Promise.all(ASSETS.map(path=>cache.match(new URL(path,self.registration.scope))));
    event.ports[0]?.postMessage({ready:entries.every(Boolean)});
  })());
});
