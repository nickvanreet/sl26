/* Rookproef v8 — draai voor elke deploy: npm install jsdom && node smoke.js */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const TABS = ["dagen","avontuur","missies","spellen","dagboek","logboek","billie","familie"];
let failed = 0;
const ok = (c,l) => { console.log(`  ${c?"OK  ":"FOUT"}  ${l}`); if(!c) failed++; };

/* FNV-1a — zelfde als _seed/pinHash in de app, om een geldige config met pincode te zaaien */
const _seed = str => { let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,16777619); } return h>>>0; };
const pinHash = p => String(_seed("pin:" + p));
const CFG = pin => JSON.stringify(Object.assign({ url:"https://x.supabase.co", key:"anon_key_0123456789_abcdef", fam:"SMOKEFAM1" }, pin ? { pinh: pinHash(pin) } : {}));

function load(seed, when, storageWorks = true){
  const errors = [];
  const dom = new JSDOM(fs.readFileSync("index.html","utf8"), {
    runScripts:"dangerously", url:"https://x.test/",
    beforeParse(w){
      const store = {...seed};
      const boom = () => { throw new Error("geblokkeerd"); };
      Object.defineProperty(w,"localStorage",{value:{
        getItem:k=>storageWorks?(k in store?store[k]:null):boom(),
        setItem:(k,v)=>storageWorks?(store[k]=String(v)):boom(),
        removeItem:k=>storageWorks?delete store[k]:boom(),
        key:i=>{ const ks=Object.keys(store); return i<ks.length?ks[i]:null; },
        get length(){ return Object.keys(store).length; },
        clear:()=>{ for(const k of Object.keys(store)) delete store[k]; }}});
      /* de cloud-calls (sync/wissen) inert maken: altijd 'ok', lege body */
      w.fetch = () => Promise.resolve({ ok:true, status:200, text:()=>Promise.resolve("[]"), json:()=>Promise.resolve([]) });
      if(when){
        const T = new w.Date(when).getTime();
        const Real = w.Date;
        function Fake(...a){ return a.length ? new Real(...a) : new Real(T); }
        Fake.now = () => T;
        Fake.prototype = Real.prototype;
        w.Date = Fake;
      }
      w.addEventListener("error", e => errors.push(e.message));
    }});
  return { dom, doc: dom.window.document, errors, store: seed };
}
const click = (dom, el) => el.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true}));

function scenario(label, seed, when, storageWorks = true){
  console.log("\n" + label);
  const { dom, doc, errors } = load(seed, when, storageWorks);
  ok(errors.length === 0, `geen JS-fouten${errors.length ? " -> " + errors.join(" | ") : ""}`);

  const tabs = doc.querySelectorAll("nav.tabs button");
  let switched = 0;
  tabs.forEach((b,i) => { click(dom,b); const a = doc.querySelector(".tabpane.active"); if(a && a.id === "t-"+TABS[i]) switched++; });
  ok(switched === 8, `alle 8 tabbladen wisselen (${switched}/8)`);

  ok(doc.querySelectorAll("details.day").length === 18, "18 dagkaarten");
  ok(!!doc.querySelector("#weerbox .weercard") && !!doc.getElementById("weerref"), "weerbericht-kaart + ververs-knop in de Dagen-tab");
  ok(doc.querySelectorAll("#weerbox .weerchip").length === 4, `weer: 4 plaats-chips (${doc.querySelectorAll("#weerbox .weerchip").length})`);
  ok(doc.querySelectorAll("input[data-m]").length === 46, `46 missies (36 + 10 foto) (${doc.querySelectorAll("input[data-m]").length})`);
  ok(!!doc.getElementById("t-dagboek"), "dagboek-tab aanwezig");
  ok(doc.querySelectorAll("#dagboek .dbentry").length === 18, `dagboek heeft 18 dag-entries (${doc.querySelectorAll("#dagboek .dbentry").length})`);
  ok(doc.querySelectorAll("#wheel path").length === 5, "Het Rad met 5 vakken (incl. Mama & Papa)");
  ok(doc.querySelectorAll("#wheeltasks button").length === 12, `rad heeft 12 kiesbare klussen (${doc.querySelectorAll("#wheeltasks button").length})`);
  ok(doc.querySelectorAll("#bingo button").length === 25, `bingo is 5x5 (${doc.querySelectorAll("#bingo button").length} tegels)`);
  ok(/Vraag 1\/10/.test((doc.getElementById("quiz")||{}).textContent||""), "quiz toont vraag 1 van 10");
  ok(doc.querySelectorAll(".lnk a").length >= 40, `links aanwezig (${doc.querySelectorAll(".lnk a").length})`);
  ok([...doc.querySelectorAll(".lnk a")].every(a => /^https:\/\//.test(a.href)), "alle links zijn https");
  ok(doc.querySelectorAll("#kast button").length === 46, `prijzenkast heeft 46 medailles (${doc.querySelectorAll("#kast button").length})`);
  ok(doc.querySelectorAll("#badges .badge").length === 14, `14 badges (${doc.querySelectorAll("#badges .badge").length})`);
  ok(doc.querySelectorAll("#t-avontuur [data-adv]").length === 10, `10 afvinkbare avonturen (${doc.querySelectorAll("#t-avontuur [data-adv]").length})`);
  ok(!!doc.getElementById("darewheel") && doc.querySelectorAll("#darewheel path").length === 5, "durf-rad met 5 namen");
  ok(doc.querySelectorAll("#spotters .spot").length === 8, `dieren-spotter met 8 dieren (${doc.querySelectorAll("#spotters .spot").length})`);
  ok(!!doc.getElementById("t-logboek") && !!doc.getElementById("hsync"), "logboek-tab + header sync-knop aanwezig");
  ok(!!doc.getElementById("t-familie"), "aparte Familie-tab aanwezig");
  ok(!!doc.querySelector("#t-familie #syncbox") && !!doc.querySelector("#t-familie #family") && !!doc.querySelector("#t-familie #scoreboard"), "sync + familie-scorebord + toestel-scorebord staan in de Familie-tab");
  ok(!doc.querySelector("#t-missies #syncbox") && !doc.querySelector("#t-missies #family"), "sync/scorebord zijn WEG uit de Missies-tab");
  ok(!doc.getElementById("shareScore") && !doc.getElementById("pasteScore"), "WhatsApp 'deel mijn score' is verwijderd");
  ok(!!doc.querySelector("#billiehero .bface") && !!doc.getElementById("petbtn"), "Billie-humeur + aai-knop aanwezig");
  ok(doc.querySelectorAll("#billiecare .check").length === 5, `Billie heeft 5 dagtaken (${doc.querySelectorAll("#billiecare .check").length})`);
  ok(!!doc.getElementById("resetwalk") && !!doc.getElementById("bphoto") && !!doc.getElementById("resetcuddle"), "reset-wandelrapport + Billie-foto + reset-knuffels knoppen aanwezig");
  ok(doc.querySelectorAll("#counters .cnt").length === 6, `Billie-wandelrapport heeft 6 tellers (${doc.querySelectorAll("#counters .cnt").length})`);
  ok(doc.querySelectorAll("#billiemedals .badge").length === 7, `Billie's prijzenkast heeft 7 medailles (${doc.querySelectorAll("#billiemedals .badge").length})`);
  ok(doc.querySelectorAll("#billietricks .spot").length === 8, `Billie heeft 8 trucjes (${doc.querySelectorAll("#billietricks .spot").length})`);
  ok(doc.querySelectorAll("#billiepass .passrow").length === 6, `Billie's paspoort heeft 6 velden (${doc.querySelectorAll("#billiepass .passrow").length})`);
  ok(doc.querySelectorAll(".soundboard .sbtn").length === 3, `soundboard heeft 3 geluiden (${doc.querySelectorAll(".soundboard .sbtn").length})`);
  ok(!!doc.querySelector("#family .fam.bilrow"), "Billie staat als eigen rij op het familie-scorebord");
  ok(/dagboekje/i.test((doc.getElementById("billiediary")||{}).textContent||""), "Billie's dagboekje rendert");
  ok(/droomt Billie van/.test((doc.getElementById("billiediary")||{}).textContent||""), "Billie's wens van de dag verschijnt");
  ok(!doc.querySelector('input[data-p="b01"]'), "oude vaste zorg-checkboxes (b01) zijn weg");
  ok(!!doc.querySelector("#t-billie #dagklus") && !doc.querySelector("#t-dagen #dagklus"), "de Billie-klus staat nu op de Billie-tab (weg uit Dagen)");
  ok(!!doc.getElementById("lbsync"), "logboek heeft een eigen 'Haal het logboek op'-knop");
  ok(!!doc.getElementById("resetscores") && !doc.getElementById("resetme"), "spel-reset knop bestaat (oude alles-wisknop is weg)");
  ok(/Papa/.test((doc.getElementById("wipemem")||{}).textContent||""), "aparte foto's&dagboek-wisknop is voorbehouden aan Papa");
  ok(!!doc.querySelector("#t-logboek #wipemem"), "foto's&dagboek-wisknop staat nu onder het Logboek");
  ok(!/€|budget/i.test(doc.body.textContent), "nog steeds geen prijzen");
  return { dom, doc };
}

scenario("1. Voor vertrek (12 juli)", {}, "2026-07-12T09:00:00");

console.log("\n2. Dag 5 van de reis (21 juli) — Willem");
{
  const { dom, doc } = load({"sl26:who":"Willem"}, "2026-07-21T09:00:00");
  const klus = doc.getElementById("dagklus");
  ok(/dag 5/i.test(klus.textContent), "toont dag 5");
  ok(/Water|Tekencheck|Wandeling/.test(klus.textContent), "toont een Billie-klus");
  ok(doc.querySelectorAll("#rota .r").length === 3, "rota toont alle drie de kinderen");

  const jobs = ["Loes","Willem","Charlotte"].map(k =>
    [...doc.querySelectorAll("#rota .r")].find(r => r.textContent.includes(k)).querySelector(".jb").textContent);
  ok(new Set(jobs).size === 3, `alle drie een andere klus (${jobs.join(" / ")})`);

  const btn = doc.getElementById("klusbtn");
  ok(!!btn, "afvinkknop aanwezig");
  click(dom, btn);
  ok(/🔥 dagen op rij/.test(doc.getElementById("dagklus").textContent), "streak-teller verschijnt");
  ok(doc.getElementById("dagklus").querySelector(".streak .v").textContent === "1", "streak staat op 1 na afvinken");
  dom.window.close();
}

console.log("\n3. Rotatie over de dagen (Loes)");
{
  const seen = [];
  for(const d of ["2026-07-18","2026-07-19","2026-07-20"]){
    const { dom, doc } = load({"sl26:who":"Loes"}, d + "T09:00:00");
    seen.push(doc.getElementById("dagklus").querySelector(".k2").textContent.trim());
    dom.window.close();
  }
  ok(new Set(seen).size === 3, `Loes krijgt 3 dagen op rij een andere klus (${seen.join(" -> ")})`);
}

console.log("\n4. Datumstempel op een missie");
{
  const { dom, doc } = load({"sl26:who":"Loes"}, "2026-07-19T09:00:00");
  const m = doc.querySelector('input[data-m="m02"]');
  m.checked = true;
  m.dispatchEvent(new dom.window.Event("change",{bubbles:true}));
  const tile = doc.querySelectorAll("#kast button")[1];
  click(dom, tile);
  const info = doc.getElementById("kastinfo").textContent;
  ok(/19 juli/.test(info), `prijzenkast toont de datum ("${info.trim().slice(0,46)}")`);
  dom.window.close();
}

console.log("\n5. Badge ontgrendelt met datum-waarden (v8-migratie, was kapot)");
{
  const { dom, doc } = load({
    "sl26:who":"Loes",
    "sl26:Loes:m01":"2026-07-18", "sl26:Loes:m09":"2026-07-22",
    "sl26:Loes:m14":"2026-07-25", "sl26:Loes:m27":"2026-07-30"
  }, "2026-07-30T09:00:00");
  const waterrat = [...doc.querySelectorAll("#badges .badge")].find(b => /Waterrat/.test(b.textContent));
  ok(!!waterrat && waterrat.classList.contains("on"), "Waterrat-badge ontgrendeld met datum-waarden");
  ok(waterrat && /4\/4/.test(waterrat.textContent), "badge toont 4/4");
  // en een oude "1"-waarde telt nog steeds mee (achterwaarts compatibel)
  const legacy = load({ "sl26:who":"Willem", "sl26:Willem:m02":"1","sl26:Willem:m03":"1","sl26:Willem:m10":"1","sl26:Willem:m13":"1" }, "2026-07-30T09:00:00");
  const durfal = [...legacy.doc.querySelectorAll("#badges .badge")].find(b => /Durfal/.test(b.textContent));
  ok(!!durfal && durfal.classList.contains("on"), "oude \"1\"-waarden tellen nog steeds mee");
  dom.window.close(); legacy.dom.window.close();
}

console.log("\n6. Familie-scorebord toont /46 (MIDS.length), niet /30");
{
  const { dom, doc } = load({ "sl26:who":"Loes", "sl26:Loes:m01":"2026-07-18" }, "2026-07-18T09:00:00");
  const fam = doc.getElementById("family").textContent;
  ok(/1\/46/.test(fam), `familie-scorebord noemer is /46 ("${fam.replace(/\s+/g,' ').trim().slice(0,42)}")`);
  ok(!/\/30/.test(fam) && !/\/40/.test(fam), "geen oude noemer (/30 of /40) meer");
  dom.window.close();
}

console.log("\n7. Na de reis: dagklus toont een afgeronde staat");
{
  const { dom, doc } = load({ "sl26:who":"Loes" }, "2026-08-10T09:00:00");
  const klus = doc.getElementById("dagklus").textContent;
  ok(/reis zit erop/i.test(klus), "toont afgeronde staat na de reis");
  ok(!/Vanaf 17 juli/.test(klus), "niet meer de 'binnenkort'-preview");
  dom.window.close();
}

console.log("\n8. Geen privé-GPS-pin op de Besigheim-overnachting");
{
  const { dom, doc } = load({}, "2026-07-12T09:00:00");
  const link = [...doc.querySelectorAll("details.day")][0].querySelector(".lnk a");
  ok(!!link && !/48\.99/.test(link.href) && /query=Besigheim/i.test(link.href), "Besigheim-link is een naam-zoekopdracht, geen privé-pin");
  dom.window.close();
}

console.log("\n9. Dagboek in eigen tab: notitie teruggeladen");
{
  const { dom, doc } = load({ "sl26:who":"Loes", "sl26:Loes:note:2026-07-18":"Rafting was episch!" }, "2026-07-20T09:00:00");
  const notes = [...doc.querySelectorAll("#dagboek .dbentry .dbnote")];
  const day2 = notes.find(t => t.dataset.date === "2026-07-18");
  ok(notes.length === 18, `18 dagboek-notitievelden (${notes.length})`);
  ok(!!day2 && day2.value === "Rafting was episch!", "notitie teruggeladen in de eigen dagboek-tab");
  dom.window.close();
}

console.log("\n10. Koudste-water-leaderboard (koudste eerst)");
{
  const { dom, doc } = load({
    "sl26:who":"Willem",
    "sl26:Loes:cold":"14", "sl26:Willem:cold":"12", "sl26:Charlotte:cold":"19"
  }, "2026-07-20T09:00:00");
  const rows = [...doc.querySelectorAll("#coldboard .cb")].map(r => r.querySelector(".cbn").textContent + " " + r.querySelector(".cbt").textContent);
  ok(rows.length === 3, `3 records op het bord (${rows.length})`);
  ok(/Willem/.test(rows[0]) && /12/.test(rows[0]), `koudste record staat bovenaan ("${rows[0]}")`);
  doc.getElementById("coldinput").value = "8";
  click(dom, doc.getElementById("coldsave"));
  ok(doc.querySelector("#coldboard .cb .cbt").textContent === "8°", "kouder record (8°) wordt het nieuwe record");
  dom.window.close();
}

console.log("\n11. Slovenië-quiz: antwoord wordt gemarkeerd (shuffle-proof)");
{
  const { dom, doc } = load({ "sl26:who":"Loes" }, "2026-07-20T09:00:00");
  const opts = doc.querySelectorAll("#quiz .opts button");
  ok(opts.length >= 3, `vraag heeft meerdere opties (${opts.length})`);
  click(dom, opts[0]);
  ok(opts[0].classList.contains("good") || opts[0].classList.contains("bad"), "gekozen antwoord wordt gemarkeerd (goed of fout)");
  ok((doc.getElementById("qfoot").textContent || "").length > 0, "quiz geeft feedback terug");
  dom.window.close();
}

console.log("\n12. Nieuwe spellen renderen zonder fouten");
{
  const { dom, doc, errors } = load({ "sl26:who":"Loes" }, "2026-07-20T09:00:00");
  ok(doc.querySelectorAll("#wrpacks button").length === 4, `woordraden: 4 pakjes (${doc.querySelectorAll("#wrpacks button").length})`);
  // start a heads-up round -> a word shows
  click(dom, doc.querySelectorAll("#wrpacks button")[0]);
  ok(!!doc.getElementById("wrword") && doc.getElementById("wrword").textContent.length > 0, "woordraden toont een woord na start");
  // verhaal-estafette: add a sentence
  ok(/Er was eens/.test(doc.getElementById("verhaal").textContent), "verhaal start met 'Er was eens…'");
  doc.getElementById("vhinput").value = "De draak niesde.";
  click(dom, doc.getElementById("vhadd"));
  ok(/De draak niesde/.test(doc.getElementById("verhaal").querySelector(".vh-last").textContent), "toegevoegde zin wordt de laatste zin");
  // nummerplaat hall of fame
  doc.getElementById("npletters").value = "ljk";
  doc.getElementById("npsentence").value = "Leeuwen Jagen Katten";
  click(dom, doc.getElementById("npsave"));
  ok(/Leeuwen Jagen Katten/.test(doc.getElementById("nphall").textContent) && /LJK/.test(doc.getElementById("nphall").textContent), "nummerplaat-zin in de eregalerij (letters upcased)");
  // aankomsttijd: seal a guess
  ok(doc.querySelectorAll("#etanames button").length === 5, "aankomsttijd: 5 naam-chips");
  click(dom, [...doc.querySelectorAll("#etanames button")].find(b => b.textContent === "Willem"));
  doc.getElementById("etatime").value = "14:30";
  click(dom, doc.getElementById("etaseal"));
  ok(/Willem/.test(doc.getElementById("etalist").textContent) && /verzegeld/.test(doc.getElementById("etalist").textContent), "gok wordt verzegeld getoond");
  // kampvuurkaart shows a question
  ok((doc.getElementById("kvcard").textContent || "").length > 5, "kampvuurkaart toont een vraag");
  ok(errors.length === 0, `geen JS-fouten in de nieuwe spellen${errors.length ? " -> " + errors.join(" | ") : ""}`);
  dom.window.close();
}

console.log("\n13. Inpak-trofee: 🎒 ontgrendelt als de rugzak vol is");
{
  const seed = { "sl26:who":"Loes" };
  for(let i=1;i<=20;i++) seed["sl26:Loes:p"+String(i).padStart(2,"0")] = "2026-07-15";
  const { dom, doc } = load(seed, "2026-07-15T09:00:00");
  const trofee = [...doc.querySelectorAll("#badges .badge")].find(b => /Ingepakt/.test(b.textContent));
  ok(!!trofee, "de Ingepakt!-trofee bestaat");
  ok(trofee && trofee.classList.contains("on"), "trofee ontgrendeld met volle rugzak (20/20)");
  ok(trofee && /20\/20/.test(trofee.textContent), "trofee toont 20/20");
  // en niet ontgrendeld als er nog iets mist
  const partial = load({ "sl26:who":"Willem", "sl26:Willem:p01":"1" }, "2026-07-15T09:00:00");
  const t2 = [...partial.doc.querySelectorAll("#badges .badge")].find(b => /Ingepakt/.test(b.textContent));
  ok(t2 && !t2.classList.contains("on") && /1\/20/.test(t2.textContent), "trofee nog niet ontgrendeld bij 1/20");
  dom.window.close(); partial.dom.window.close();
}

console.log("\n14. Bingo 5x5: punten per volle lijn");
{
  const { dom, doc } = load({ "sl26:who":"Loes" }, "2026-07-20T09:00:00");
  const btns = doc.querySelectorAll("#bingo button");
  ok(btns.length === 25, `25 tegels (${btns.length})`);
  for(let i=0;i<5;i++) click(dom, btns[i]);   // bovenste rij (posities 0-4)
  ok(doc.getElementById("bingolines").textContent === "1", `1 volle lijn (${doc.getElementById("bingolines").textContent})`);
  ok(doc.getElementById("bingopts").textContent === "10", `10 punten voor 1 lijn (${doc.getElementById("bingopts").textContent})`);
  dom.window.close();
}

console.log("\n15. Familie-scorebord: balk, kroon & streak van anderen");
{
  const { dom, doc } = load({
    "sl26:who":"Loes", "sl26:Loes:m01":"2026-07-18",
    "sl26:shared:Willem":"20~2~2~20260721~3"
  }, "2026-07-20T09:00:00");
  const fam = doc.getElementById("family");
  ok(fam.querySelectorAll(".fam:not(.bilrow) .fbar i").length === 2, `2 kinder-voortgangsbalken (${fam.querySelectorAll(".fam:not(.bilrow) .fbar i").length})`);
  ok(/👑/.test(fam.textContent), "de leider (Willem, 20) krijgt een kroon");
  ok(/🔥3/.test(fam.textContent), "streak van een gedeelde speler wordt getoond");
  ok(!!fam.querySelector(".fam.bilrow"), "Billie heeft haar eigen rij bovenaan het scorebord");
  dom.window.close();
}

console.log("\n16. Verhaal-estafette: voorlees-knop (TTS)");
{
  const { dom, doc } = load({ "sl26:who":"Loes", "sl26:fam:story":JSON.stringify(["Er was eens een draak."]) }, "2026-07-20T09:00:00");
  ok(/Lees voor/.test(doc.getElementById("vhread").textContent), "voorlees-knop aanwezig");
  ok(!!doc.getElementById("vhstop"), "stop-knop aanwezig");
  click(dom, doc.getElementById("vhread"));
  ok(/draak/.test(doc.getElementById("vhfull").textContent), "verhaal wordt ook getoond bij voorlezen");
}

console.log("\n17a. Spel resetten (elke speler z'n eigen): scores op nul, FOTO's & DAGBOEK blijven");
{
  const seed = { "sl26:who":"Loes" };            // géén cloud nodig; puur lokaal
  for(let i=1;i<=36;i++) seed["sl26:Loes:m"+String(i).padStart(2,"0")] = "2026-07-20";
  seed["sl26:Loes:bingo0"] = "1"; seed["sl26:Loes:bingo1"] = "1";
  seed["sl26:Loes:cold"] = "8";
  seed["sl26:Loes:note:2026-07-18"] = "Rafting was episch!";   // dagboek — moet BLIJVEN
  seed["sl26:Loes:note:2026-07-20"] = "Beste dag ooit";        // dagboek — moet BLIJVEN
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  ok(doc.getElementById("rankcount").textContent === "36", `36 missies vóór reset (${doc.getElementById("rankcount").textContent})`);
  ok([...doc.querySelectorAll("#badges .badge.on")].length > 0, "badges verdiend vóór reset");
  dom.window.confirm = () => true;
  dom.window.alert = () => {};
  click(dom, doc.getElementById("resetscores"));
  ok(doc.getElementById("rankcount").textContent === "0", `0 missies na reset (${doc.getElementById("rankcount").textContent})`);
  ok([...doc.querySelectorAll("#badges .badge.on")].length === 0, "geen badges meer na reset");
  ok(doc.querySelectorAll('#bingo button[aria-pressed="true"]').length === 0, "bingo leeg na reset");
  ok(!/8°/.test(doc.getElementById("coldboard").textContent), "koudste-record weg na reset");
  // en de HERINNERINGEN blijven staan:
  ok(dom.window.localStorage.getItem("sl26:Loes:note:2026-07-18") === "Rafting was episch!", "dagboektekst 1 BLIJFT bewaard na spel-reset");
  ok(dom.window.localStorage.getItem("sl26:Loes:note:2026-07-20") === "Beste dag ooit", "dagboektekst 2 BLIJFT bewaard na spel-reset");
  const notes = [...doc.querySelectorAll("#dagboek .dbentry .dbnote")];
  const d1 = notes.find(t => t.dataset.date === "2026-07-18");
  ok(!!d1 && d1.value === "Rafting was episch!", "dagboek toont de notitie nog steeds na de reset");
  dom.window.close();
}

console.log("\n17b. Foto's & dagboek wissen — zonder ingestelde pincode uitgeschakeld");
{
  const seed = { "sl26:who":"Papa", "sl26:fam:sb": CFG(null) };
  seed["sl26:Papa:note:2026-07-18"] = "Blijft staan zonder pincode";
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  dom.window.confirm = () => true;
  dom.window.prompt = () => "9999";
  dom.window.alert = () => {};
  click(dom, doc.getElementById("wipemem"));
  ok(dom.window.localStorage.getItem("sl26:Papa:note:2026-07-18") === "Blijft staan zonder pincode", "geen pincode ingesteld = niets gewist");
  dom.window.close();
}

console.log("\n17c. Papa wist foto's & dagboek van een speler — maar de SCORES blijven staan");
{
  const seed = { "sl26:who":"Papa", "sl26:fam:sb": CFG("1234") };
  for(let i=1;i<=36;i++) seed["sl26:Papa:m"+String(i).padStart(2,"0")] = "2026-07-20";
  seed["sl26:Papa:bingo0"] = "1";
  seed["sl26:Papa:note:2026-07-18"] = "Deze tekst wordt gewist";
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  ok(doc.getElementById("rankcount").textContent === "36", "36 missies vóór");
  dom.window.confirm = () => true;
  dom.window.alert = () => {};
  dom.window.prompt = (msg) => /wis-pincode/.test(msg) ? "1234" : (/wissen/.test(msg) ? "Papa" : null);
  click(dom, doc.getElementById("wipemem"));
  ok(dom.window.localStorage.getItem("sl26:Papa:note:2026-07-18") === null, "dagboektekst is gewist");
  ok(doc.getElementById("rankcount").textContent === "36", `SCORES blijven staan na foto's&dagboek-wis (${doc.getElementById("rankcount").textContent})`);
  ok(dom.window.localStorage.getItem("sl26:Papa:m01") === "2026-07-20", "missie-datum staat er nog");
  dom.window.close();
}

console.log("\n17d. Foto's & dagboek: verkeerde pincode wist niets");
{
  const seed = { "sl26:who":"Papa", "sl26:fam:sb": CFG("1234") };
  seed["sl26:Papa:note:2026-07-18"] = "Overleeft een foute pincode";
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  dom.window.confirm = () => true;
  dom.window.alert = () => {};
  dom.window.prompt = (msg) => /wis-pincode/.test(msg) ? "0000" : (/wissen/.test(msg) ? "Papa" : null);
  click(dom, doc.getElementById("wipemem"));
  ok(dom.window.localStorage.getItem("sl26:Papa:note:2026-07-18") === "Overleeft een foute pincode", "verkeerde pincode → dagboek blijft");
  dom.window.close();
}

console.log("\n18. Papa stelt de wis-pincode in via de familie-cloud (control in sync-tab)");
{
  const seed = { "sl26:who":"Papa", "sl26:fam:sb": CFG(null) };
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  const setpin = doc.getElementById("setpin");
  ok(!!setpin && /instellen/.test(setpin.textContent), "'instellen'-knop verschijnt als er nog geen pincode is");
  dom.window.prompt = (msg) => /Nieuwe wis-pincode/.test(msg) ? "4321" : null;
  click(dom, setpin);
  const cfg = JSON.parse(dom.window.localStorage.getItem("sl26:fam:sb"));
  ok(cfg.pinh === pinHash("4321"), "pincode-hash staat nu in de familie-config (reist mee in de sync-link)");
  ok(dom.window.localStorage.getItem("sl26:fam:pinlock") === pinHash("4321"), "pincode staat ook in de sticky 'pinlock' (blijft na loskoppelen)");
  ok(/ingesteld ✅/.test(doc.getElementById("syncbox").textContent), "sync-tab toont nu 'ingesteld ✅'");
  dom.window.close();
}

console.log("\n19. Sticky pincode: opnieuw verbinden met een pinloze config omzeilt de wis-pincode NIET");
{
  // config zónder pinh (zoals na 'loskoppelen' + opnieuw verbinden via de invite-link), maar pinlock staat lokaal
  const seed = { "sl26:who":"Papa", "sl26:fam:sb": CFG(null), "sl26:fam:pinlock": pinHash("1234") };
  seed["sl26:Papa:note:2026-07-18"] = "Beschermd door pinlock";
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  dom.window.confirm = () => true;
  dom.window.alert = () => {};
  // verkeerde pin -> niets gewist (bewijst dat pinlock de gate voedt, niet de lege config.pinh)
  dom.window.prompt = (msg) => /Papa's wis-pincode/.test(msg) ? "0000" : (/wissen/.test(msg) ? "Papa" : null);
  click(dom, doc.getElementById("wipemem"));
  ok(dom.window.localStorage.getItem("sl26:Papa:note:2026-07-18") === "Beschermd door pinlock", "pinloze config + pinlock: verkeerde pin wist niets");
  ok(/wijzig/.test(doc.getElementById("setpin").textContent), "setpin toont 'wijzig' door pinlock (ook al mist config.pinh)");
  // setpin met pinlock: verkeerde oude pin wijzigt niets
  dom.window.prompt = (msg) => /Huidige wis-pincode/.test(msg) ? "0000" : (/Nieuwe wis-pincode/.test(msg) ? "5555" : null);
  click(dom, doc.getElementById("setpin"));
  ok(dom.window.localStorage.getItem("sl26:fam:pinlock") === pinHash("1234"), "verkeerde oude pin → pinlock ongewijzigd");
  // juiste oude pin -> pinlock wijzigt
  dom.window.prompt = (msg) => /Huidige wis-pincode/.test(msg) ? "1234" : (/Nieuwe wis-pincode/.test(msg) ? "5555" : null);
  click(dom, doc.getElementById("setpin"));
  ok(dom.window.localStorage.getItem("sl26:fam:pinlock") === pinHash("5555"), "juiste oude pin → pinlock gewijzigd");
  dom.window.close();
}

console.log("\n20. Durfjacht: 'Ik durfde het!' geeft durfpunten; eng-rating & toggle werken");
{
  const { dom, doc } = load({ "sl26:who":"Loes" }, "2026-07-20T09:00:00");
  ok(doc.querySelectorAll("#t-avontuur [data-adv]").length === 10, "10 avontuurkaarten met durf-knop");
  ok(/0 \/ 27/.test(doc.getElementById("durfmeter").textContent), "durfmeter start op 0/27 (canyoning 12+ zit niet in het doel)");
  const btn = doc.querySelector('#t-avontuur [data-adv="av02"] .durfbtn');   // zipline = 5 bliksems
  ok(!!btn && /Ik durfde het/.test(btn.textContent), "av02 heeft een 'Ik durfde het!'-knop");
  click(dom, btn);
  ok(dom.window.localStorage.getItem("sl26:Loes:av02") !== null, "av02 is afgevinkt in de opslag");
  ok(/5 \/ 27/.test(doc.getElementById("durfmeter").textContent), "durfmeter staat nu op 5 durfpunten");
  const stars = doc.querySelectorAll('#t-avontuur [data-adv="av02"] .engstar');
  ok(stars.length === 5, `eng-rating met 5 sterren verschijnt na afvinken (${stars.length})`);
  click(dom, stars[2]);   // 3 bliksems eng
  ok(dom.window.localStorage.getItem("sl26:Loes:eng:av02") === "3", "eng-rating opgeslagen (3)");
  click(dom, doc.querySelector('#t-avontuur [data-adv="av02"] .durfbtn'));   // nogmaals = uit
  ok(dom.window.localStorage.getItem("sl26:Loes:av02") === null, "nogmaals tikken maakt av02 weer leeg");
  ok(/0 \/ 27/.test(doc.getElementById("durfmeter").textContent), "durfmeter terug op 0");
  dom.window.close();
}

console.log("\n21. Avonturier- & Dierenspotter-trofee ontgrendelen (tellen mee in de badges)");
{
  const seed = { "sl26:who":"Willem" };
  ["av01","av02","av04","av06","av08","av10"].forEach(a => seed["sl26:Willem:"+a] = "2026-07-20");  // 6 must-do
  ["dz01","dz02","dz03","dz05","dz08"].forEach(d => seed["sl26:Willem:"+d] = "2026-07-20");          // 5 dieren
  const { dom, doc } = load(seed, "2026-07-25T09:00:00");
  const avon = [...doc.querySelectorAll("#badges .badge")].find(b => /Avonturier/.test(b.textContent));
  ok(!!avon && avon.classList.contains("on"), "Avonturier-trofee ontgrendeld met de 6 must-do avonturen");
  ok(avon && /6\/6/.test(avon.textContent), "Avonturier toont 6/6");
  const spot = [...doc.querySelectorAll("#badges .badge")].find(b => /Dierenspotter/.test(b.textContent));
  ok(!!spot && spot.classList.contains("on"), "Dierenspotter-trofee ontgrendeld met 5 dieren");
  ok(/19 \/ 27/.test(doc.getElementById("durfmeter").textContent), "durfmeter telt de bliksems correct op (4+5+4+3+2+1=19)");
  ok(/5\/8/.test(doc.getElementById("spotmeter").textContent), "spotmeter toont 5/8 gespot");
  dom.window.close();
}

console.log("\n22. Billie: dagtaken (per dag) vullen de Blij-meter; aaien + reset knuffels");
{
  const { dom, doc } = load({ "sl26:who":"Loes" }, "2026-07-20T09:00:00");
  ok(/0\/5 verzorgd/.test(doc.getElementById("billiehero").textContent), "Blij-meter start op 0/5 (5 dagtaken)");
  ok(/dorst/.test(doc.querySelector("#billiehero .bbubble").textContent), "trieste Billie zonder zorg");
  const cares = [...doc.querySelectorAll("#billiecare input[type=checkbox]")];
  ok(cares.length === 5, `5 dagtaken (${cares.length})`);
  cares.forEach(inp => { inp.checked = true; inp.dispatchEvent(new dom.window.Event("change",{bubbles:true})); });
  ok(/5\/5 verzorgd/.test(doc.getElementById("billiehero").textContent), "Blij-meter 5/5 na alle dagtaken");
  ok(/Kwispel/i.test(doc.querySelector("#billiehero .bbubble").textContent), "dolgelukkige Billie bij volledige zorg");
  ok(doc.querySelector("#billiehero .blijbar i").style.width === "100%", "Blij-balk 100% vol");
  // dagtaken staan per dag onder de datum (familie-breed), niet per speler
  ok(dom.window.localStorage.getItem("sl26:fam:care:2026-07-20:water") !== null, "dagtaak opgeslagen onder de datum (sl26:fam:care:2026-07-20:water)");
  ok(dom.window.localStorage.getItem("sl26:Loes:b01") === null, "geen oude per-speler zorg-sleutel meer");
  // aai 3x, dagboekje ververst, dan reset knuffels
  const pet = doc.getElementById("petbtn");
  click(dom, pet); click(dom, pet); click(dom, pet);
  ok(dom.window.localStorage.getItem("sl26:fam:cuddles") === "3", "aaien telt knuffels (3)");
  ok(/3 knuffels/.test(doc.getElementById("billiediary").textContent), "dagboekje ververst live na het aaien");
  dom.window.confirm = () => true;
  click(dom, doc.getElementById("resetcuddle"));
  ok((dom.window.localStorage.getItem("sl26:fam:cuddles") || "0") === "0", "↺ reset knuffels zet ze weer op nul");
  dom.window.close();
}

console.log("\n22b. Billie: dagtaken resetten vanzelf op een nieuwe dag");
{
  // taak gedaan op 20 juli
  const { dom, doc } = load({ "sl26:who":"Loes", "sl26:fam:care:2026-07-20:water":"2026-07-20" }, "2026-07-20T09:00:00");
  ok(/1\/5 verzorgd/.test(doc.getElementById("billiehero").textContent), "op 20 juli telt de gedane taak mee (1/5)");
  dom.window.close();
  // volgende dag: dezelfde opslag, maar Billie begint weer op 0
  const day2 = load({ "sl26:who":"Loes", "sl26:fam:care:2026-07-20:water":"2026-07-20" }, "2026-07-21T09:00:00");
  ok(/0\/5 verzorgd/.test(day2.doc.getElementById("billiehero").textContent), "op 21 juli staat de Blij-meter weer op 0/5");
  day2.dom.window.close();
}

console.log("\n23. Billie: tellers voeden het dagboekje en de prijzenkast");
{
  const seed = { "sl26:who":"Willem", "sl26:fam:c1":"5", "sl26:fam:c3":"10", "sl26:fam:cuddles":"50" };
  const { dom, doc } = load(seed, "2026-07-22T09:00:00");
  ok(/sprong ik in 5 rivieren/.test(doc.getElementById("billiediary").textContent), "dagboekje verwerkt de tellers");
  ok(/50 knuffels/.test(doc.getElementById("billiediary").textContent), "dagboekje noemt de knuffels");
  const meds = [...doc.querySelectorAll("#billiemedals .badge")];
  const water = meds.find(b => /Waterhond/.test(b.textContent));
  const soc = meds.find(b => /Sociale vlinder/.test(b.textContent));
  const knuf = meds.find(b => /Knuffelkoning/.test(b.textContent));
  const stok = meds.find(b => /Stokkenkampioen/.test(b.textContent));
  ok(!!water && water.classList.contains("on"), "Waterhond ontgrendeld bij 5 rivieren");
  ok(!!soc && soc.classList.contains("on"), "Sociale vlinder ontgrendeld bij 10 honden");
  ok(!!knuf && knuf.classList.contains("on"), "Knuffelkoning ontgrendeld bij 50 knuffels");
  ok(!!stok && !stok.classList.contains("on"), "Stokkenkampioen nog niet ontgrendeld (0/10)");
  dom.window.close();
}

console.log("\n24. Billie: trucjes tellen mee; Billie staat op het familiebord met punten");
{
  const seed = { "sl26:who":"Loes", "sl26:fam:cuddles":"12", "sl26:fam:c1":"3", "sl26:fam:c2":"4" };
  ["zit","poot","af"].forEach(t => seed["sl26:fam:trick:"+t] = "2026-07-20");   // 3 trucjes geleerd
  const { dom, doc } = load(seed, "2026-07-22T09:00:00");
  const tricks = [...doc.querySelectorAll("#billietricks .spot")];
  ok(tricks.length === 8, `8 trucjes (${tricks.length})`);
  ok(tricks.filter(r => r.classList.contains("on")).length === 3, "3 trucjes al geleerd");
  const learnBtn = [...doc.querySelectorAll("#billietricks .stick")].find(b => /Leren/.test(b.textContent));
  click(dom, learnBtn);
  ok([...doc.querySelectorAll("#billietricks .spot.on")].length === 4, "na tikken zijn er 4 trucjes geleerd");
  // Familie-tab -> Billie-rij met punten = cuddles(12) + walk(7) + tricks(4)*5 = 39
  click(dom, doc.querySelector('nav.tabs button[data-tab="familie"]'));
  const brow = doc.querySelector("#family .fam.bilrow");
  ok(!!brow, "Billie-rij op het familiebord");
  ok(brow.querySelector(".fsc").textContent.trim() === "39", `Billie-punten = 12+7+20 = 39 ("${brow.querySelector(".fsc").textContent.trim()}")`);
  ok(/12 knuffels/.test(brow.textContent) && /4 trucjes/.test(brow.textContent), "Billie-rij toont knuffels & trucjes");
  dom.window.close();
}

console.log("\n25. Billie's paspoort onthoudt wat je invult");
{
  const { dom, doc } = load({ "sl26:who":"Willem" }, "2026-07-20T09:00:00");
  const ras = [...doc.querySelectorAll("#billiepass .passinp")][0];
  ras.value = "Setter"; ras.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
  ok(dom.window.localStorage.getItem("sl26:fam:pass:ras") === "Setter", "paspoort-veld wordt opgeslagen");
  dom.window.close();
  const again = load({ "sl26:who":"Willem", "sl26:fam:pass:ras":"Setter" }, "2026-07-20T09:00:00");
  ok([...again.doc.querySelectorAll("#billiepass .passinp")][0].value === "Setter", "paspoort-veld wordt teruggeladen");
  again.dom.window.close();
}

console.log("\n26. Weerbericht: toont een opgeslagen (offline) voorspelling met kid-tip");
{
  const cache = { t: new Date("2026-07-20T09:00:00").getTime(), d: {
    time: ["2026-07-20","2026-07-21","2026-07-22"],
    weather_code: [0, 61, 3],
    temperature_2m_max: [28, 19, 24],
    temperature_2m_min: [15, 12, 14],
    precipitation_probability_max: [10, 80, 30]
  }};
  const { dom, doc } = load({ "sl26:weer:soca": JSON.stringify(cache) }, "2026-07-20T09:00:00");
  const days = doc.querySelectorAll("#weerbox .weerday");
  ok(days.length === 3, `3 voorspelde dagen uit cache (${days.length})`);
  const wt = doc.getElementById("weerbox").textContent;
  ok(/28°/.test(wt), "toont de maximumtemperatuur (28°)");
  ok(/Zwemweer/.test(wt), "zonnige warme dag → Zwemweer-tip");
  ok(/Laatst opgehaald/.test(wt), "toont wanneer het weer laatst opgehaald is");
  dom.window.close();
}

console.log("\n26b. Weerbericht: kapotte/onvolledige cache crasht niet");
{
  // 'time' aanwezig maar de andere reeksen ontbreken -> ongeldig, mag NIET crashen
  const bad = { t: new Date("2026-07-20T09:00:00").getTime(), d: { time: ["2026-07-20","2026-07-21"] } };
  const { dom, doc, errors } = load({ "sl26:weer:soca": JSON.stringify(bad) }, "2026-07-20T09:00:00");
  ok(errors.length === 0, `geen JS-fouten bij kapotte weer-cache${errors.length?" -> "+errors.join(" | "):""}`);
  ok(doc.querySelectorAll("#weerbox .weerday").length === 0, "onvolledige cache → geen voorspelling (leeg), maar geen crash");
  ok(!!doc.querySelector("#weerbox .weercard"), "weerkaart rendert nog steeds");
  dom.window.close();
}

console.log(failed ? `\n${failed} test(s) GEFAALD\n` : "\nAlles in orde.\n");
process.exit(failed ? 1 : 0);
