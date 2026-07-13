/* Slovenie 2026 - kids editie: alles offline beschikbaar na 1x laden */
var CACHE = "sl26-v23";
var FILES = ["./", "./index.html", "./manifest.webmanifest",
             "./icon-192.png", "./icon-512.png", "./icon-maskable.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  var req = e.request;
  var isPage = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0;

  if(isPage){
    /* network-first voor de pagina: thuis op wifi zie je meteen de nieuwste versie,
       op de camping (geen bereik) valt hij terug op de opgeslagen kopie. */
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(h){ return h || caches.match(req); });
      })
    );
    return;
  }

  /* overige bestanden (icons, manifest): cache-first — snel en offline */
  e.respondWith(
    caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        return res;
      }).catch(function(){ return caches.match("./index.html"); });
    })
  );
});
