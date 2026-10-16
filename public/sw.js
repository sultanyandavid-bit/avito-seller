/* Cache only public offline assets. Never cache authenticated pages, API or files. */
const VERSION="davio-public-v1";
const STATIC=["/offline","/icon-192.png","/icon-512.png","/icon-maskable.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(STATIC)));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("davio-public-")&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=="GET"||url.pathname.startsWith("/api/"))return;if(event.request.mode==="navigate"){event.respondWith(fetch(event.request).catch(()=>caches.match("/offline").then(response=>response||new Response("DAVIO: нет соединения",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}}))));}else if(STATIC.includes(url.pathname))event.respondWith(caches.match(event.request).then(response=>response||fetch(event.request)));});
