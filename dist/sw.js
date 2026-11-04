const CACHE = 'bth-tow-v49-document-rulebook';
const ASSETS = ["./index.html","./redesign-preview.html","./redesign-preview.css","./redesign-premium.css","./redesign-crest.svg","./redesign-preview.js","./modern.css","./premium-app.css","./ui-polish.css","./unit-picker.css","./phonetic.css","./phonetic-names.js","./phonetic.js","./licenses/cmudict.txt","./ui-accessibility.js","./app.js","./quicksheet.js","./rules-reader.js","./tutorial.js","./tutorial-diagrams.js","./rules-catalog.json","./i18n.js","./translations-ko.json","./translations-ui-en.json","./tow-core.js","./option-core.js","./matched-play.js","./play-profiles.js","./data/play-weapon-profiles.json","./roster-seed.js","./pwa.js","./manifest.webmanifest","./icon-192.png","./icon-512.png","./data/games/the-old-world/1.5/chaos-dwarfs.json","./data/games/the-old-world/1.5/daemons-of-chaos.json","./data/games/the-old-world/1.5/dark-elves.json","./data/games/the-old-world/1.5/lizardmen.json","./data/games/the-old-world/1.5/magic-items.json","./data/games/the-old-world/1.5/ogre-kingdoms.json","./data/games/the-old-world/1.5/skaven.json","./data/games/the-old-world/1.5/vampire-counts.json","./data/games/the-old-world/beastmen-brayherds.json","./data/games/the-old-world/chaos-dwarfs.json","./data/games/the-old-world/daemons-of-chaos.json","./data/games/the-old-world/dark-elves.json","./data/games/the-old-world/dwarfen-mountain-holds.json","./data/games/the-old-world/empire-of-man.json","./data/games/the-old-world/grand-cathay.json","./data/games/the-old-world/high-elf-realms.json","./data/games/the-old-world/kingdom-of-bretonnia.json","./data/games/the-old-world/lizardmen.json","./data/games/the-old-world/magic-items.json","./data/games/the-old-world/ogre-kingdoms.json","./data/games/the-old-world/orc-and-goblin-tribes.json","./data/games/the-old-world/renegade-crowns.json","./data/games/the-old-world/skaven.json","./data/games/the-old-world/tomb-kings-of-khemri.json","./data/games/the-old-world/vampire-counts.json","./data/games/the-old-world/warriors-of-chaos.json","./data/games/the-old-world/wood-elf-realms.json","./data/games/warhammer-fantasy/dwarfs.json","./data/games/warhammer-fantasy/greenskins.json","./data/games/warhammer-fantasy/magic-items.json","./data/games/warhammer-fantasy/the-empire.json","./data/source.json","./data/src/assets/lores-of-magic-with-spells.json","./data/src/assets/the-old-world.json","./data/src/components/rules-index/rules-index-export.json","./data/src/components/rules-index/rule-aliases.json","./data/src/i18n/cn.json","./data/src/i18n/de.json","./data/src/i18n/en.json","./data/src/i18n/es.json","./data/src/i18n/fr.json","./data/src/i18n/it.json","./data/src/i18n/pl.json","./rule-summaries.js","./data/rule-summary-overrides.json","./data/rule-procedure-summaries.json","./handbook.js","./handbook.css","./data/handbook-foundations.json","./data/handbook-battles.json","./data/handbook-specials.json","./document-book.js","./document-book.css","./data/document-rulebook.json","./document-book-images/figure-01.webp","./document-book-images/figure-02.webp","./document-book-images/figure-03.webp","./document-book-images/figure-04.webp","./document-book-images/figure-05.webp","./document-book-images/figure-06.webp","./document-book-images/figure-07.webp","./document-book-images/figure-08.webp","./document-book-images/figure-09.webp","./document-book-images/figure-10.webp","./document-book-images/figure-11.webp","./document-book-images/figure-12.webp","./document-book-images/figure-13.webp","./document-book-images/figure-14.webp","./document-book-images/figure-15.webp","./document-book-images/figure-16.webp","./document-book-images/figure-17.webp","./document-book-images/figure-18.webp","./document-book-images/figure-19.webp","./document-book-images/figure-20.webp","./document-book-images/figure-21.webp","./document-book-images/figure-22.webp","./document-book-images/figure-23.webp","./document-book-images/figure-24.webp","./document-book-images/figure-25.webp","./document-book-images/figure-26.webp","./document-book-images/figure-27.webp","./document-book-images/figure-28.webp","./document-book-images/figure-29.webp","./document-book-images/figure-30.webp","./document-book-images/figure-31.webp","./document-book-images/figure-32.webp","./document-book-images/figure-33.webp","./document-book-images/figure-34.webp","./document-book-images/figure-35.webp","./document-book-images/figure-36.webp","./document-book-images/figure-37.webp","./document-book-images/figure-38.webp","./document-book-images/figure-39.webp","./document-book-images/figure-40.webp","./document-book-images/figure-41.webp","./document-book-images/figure-42.webp","./document-book-images/figure-43.webp","./document-book-images/figure-44.webp","./document-book-images/figure-45.webp","./document-book-images/figure-46.webp","./document-book-images/figure-47.webp","./document-book-images/figure-48.webp","./document-book-images/figure-49.webp","./document-book-images/figure-50.webp","./document-book-images/figure-51.webp","./document-book-images/figure-52.webp","./document-book-images/figure-53.webp","./document-book-images/figure-54.webp","./document-book-images/figure-55.webp","./document-book-images/figure-56.webp","./document-book-images/figure-57.webp","./document-book-images/figure-58.webp","./document-book-images/figure-59.webp","./document-book-images/figure-60.webp","./document-book-images/figure-61.webp","./document-book-images/figure-62.webp"];
const URLS = new Set(ASSETS.map(path => new URL(path,self.registration.scope).href));
function cacheableAssetResponse(url,response) {
  if(!response.ok)throw new Error('Asset unavailable: '+url.pathname);
  if(!response.redirected)return response;
  const target=new URL(response.url);
  const canonicalPath=url.pathname.replace(/\/index\.html$/,'/').replace(/\.html$/,'');
  if(!url.pathname.endsWith('.html')||target.origin!==url.origin||target.pathname!==canonicalPath||target.search!==url.search)
    throw new Error('Unexpected asset redirect: '+url.pathname);
  // Sites canonicalizes HTML URLs. Store the verified document without its
  // redirect flag so navigation requests with redirect:manual can reuse it.
  const headers=new Headers(response.headers);
  headers.delete('content-encoding');headers.delete('content-length');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const pending = [...ASSETS];
    await Promise.all(Array.from({length:6},async () => {
      while(pending.length) {
        const path=pending.shift();
        const url=new URL(path,self.registration.scope);
        const response=await fetch(url,{cache:'reload'});
        await cache.put(url,cacheableAssetResponse(url,response));
      }
    }));
    // Activate only after every required asset is safely cached. Older pages
    // keep their current UI; a safe reload is coordinated by pwa.js.
    await self.skipWaiting();
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
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
  if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const entries=await Promise.all(ASSETS.map(path=>cache.match(new URL(path,self.registration.scope))));
    event.ports[0]?.postMessage({ready:entries.every(Boolean),version:CACHE});
  })());
});
