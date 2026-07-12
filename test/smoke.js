/* Rookproef v8 — draai voor elke deploy: npm install jsdom && node smoke.js */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const TABS = ["dagen","avontuur","missies","spellen","dagboek","logboek","billie"];
let failed = 0;
const ok = (c,l) => { console.log(`  ${c?"OK  ":"FOUT"}  ${l}`); if(!c) failed++; };

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
  ok(switched === 7, `alle 7 tabbladen wisselen (${switched}/7)`);

  ok(doc.querySelectorAll("details.day").length === 18, "18 dagkaarten");
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
  ok(doc.querySelectorAll("#badges .badge").length === 12, `12 badges (${doc.querySelectorAll("#badges .badge").length})`);
  ok(!!doc.getElementById("t-logboek") && !!doc.getElementById("hsync"), "logboek-tab + header sync-knop aanwezig");
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
  ok(fam.querySelectorAll(".fbar i").length === 2, `2 voortgangsbalken (${fam.querySelectorAll(".fbar i").length})`);
  ok(/👑/.test(fam.textContent), "de leider (Willem, 20) krijgt een kroon");
  ok(/🔥3/.test(fam.textContent), "streak van een gedeelde speler wordt getoond");
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

console.log("\n17. Volledige reset per speler (incl. medailles, badges, bingo)");
{
  const seed = { "sl26:who":"Loes" };
  for(let i=1;i<=36;i++) seed["sl26:Loes:m"+String(i).padStart(2,"0")] = "2026-07-20";
  seed["sl26:Loes:p01"] = "1";
  seed["sl26:Loes:bingo0"] = "1"; seed["sl26:Loes:bingo1"] = "1";
  seed["sl26:Loes:cold"] = "8";
  seed["sl26:Loes:note:2026-07-18"] = "Test-notitie";
  const { dom, doc } = load(seed, "2026-07-20T09:00:00");
  ok(doc.getElementById("rankcount").textContent === "36", `36 missies vóór reset (${doc.getElementById("rankcount").textContent})`);
  ok([...doc.querySelectorAll("#kast button.won")].length > 0, "medailles gewonnen vóór reset");
  ok([...doc.querySelectorAll("#badges .badge.on")].length > 0, "badges verdiend vóór reset");
  dom.window.confirm = () => true;
  click(dom, doc.getElementById("resetme"));
  ok(doc.getElementById("rankcount").textContent === "0", `0 missies na reset (${doc.getElementById("rankcount").textContent})`);
  ok([...doc.querySelectorAll("#kast button.won")].length === 0, "geen medailles meer na reset (trofeeën resetten óók)");
  ok([...doc.querySelectorAll("#badges .badge.on")].length === 0, "geen badges meer na reset");
  ok(doc.querySelectorAll('#bingo button[aria-pressed="true"]').length === 0, "bingo leeg na reset");
  ok(!/8°/.test(doc.getElementById("coldboard").textContent), "koudste-record weg na reset");
  dom.window.close();
}

console.log(failed ? `\n${failed} test(s) GEFAALD\n` : "\nAlles in orde.\n");
process.exit(failed ? 1 : 0);
