const V='v32';
const CACHE='merkava-clock-'+V;       /* app shell */
const FONTS='merkava-fonts-'+V;       /* Google Fonts css + font files (cross-origin) */
const CORE=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-512-maskable.png','./icon-180.png'];
const OPT=['./pro.enc'];              /* optional, present only in the protected build */
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  await c.addAll(CORE);
  await Promise.all(OPT.map(u=>fetch(u,{cache:'no-cache'}).then(r=>r.ok&&c.put(u,r)).catch(()=>{})));
  /* warm the fonts so first offline launch keeps the typography */
  try{const f=await caches.open(FONTS);const u='https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@400;500;700&display=swap';
    const r=await fetch(u);if(r.ok){await f.put(u,r.clone());const css=await r.text();
      await Promise.all((css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g)||[]).map(x=>fetch(x).then(y=>y.ok&&f.put(x,y)).catch(()=>{})));}}catch(x){}
  self.skipWaiting();
})());});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==FONTS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin){
    /* fonts: cache-first, refresh in background. Everything else cross-origin (payment / license API) goes straight to the network. */
    if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
      e.respondWith(caches.open(FONTS).then(async c=>{const hit=await c.match(r);
        const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res;}).catch(()=>hit);
        return hit||net;}));
    }
    return;
  }
  if(r.mode==='navigate'){
    /* app shell: network first with a short timeout, fall back to the cached page so it always opens offline */
    e.respondWith((async()=>{const c=await caches.open(CACHE);
      try{const res=await Promise.race([fetch(r),new Promise((_,j)=>setTimeout(j,3500))]);if(res&&res.ok)c.put('./index.html',res.clone());return res;}
      catch(x){return (await c.match('./index.html'))||(await c.match('./'))||Response.error();}})());
    return;
  }
  /* static assets: stale-while-revalidate */
  e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(r,{ignoreSearch:true});
    const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res;}).catch(()=>hit);
    return hit||net;}));
});
