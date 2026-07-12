/* Rookproef v8 — draai voor elke deploy: npm install jsdom && node smoke.js */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const TABS = ["dagen","avontuur","missies","spellen","billie"];
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
        removeItem:k=>storageWorks?delete store[k]:boom(), clear:()=>{}}});
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
  ok(switched === 5, `alle 5 tabbladen wisselen (${switched}/5)`);

  ok(doc.querySelectorAll("details.day").length === 18, "18 dagkaarten");
  ok(doc.querySelectorAll("input[data-m]").length === 40, `40 missies (30 + 10 foto)`);
  ok(doc.querySelectorAll(".lnk a").length >= 40, `links aanwezig (${doc.querySelectorAll(".lnk a").length})`);
  ok([...doc.querySelectorAll(".lnk a")].every(a => /^https:\/\//.test(a.href)), "alle links zijn https");
  ok(doc.querySelectorAll("#kast button").length === 40, "prijzenkast heeft 40 medailles");
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

console.log("\n6. Familie-scorebord toont /40, niet /30");
{
  const { dom, doc } = load({ "sl26:who":"Loes", "sl26:Loes:m01":"2026-07-18" }, "2026-07-18T09:00:00");
  const fam = doc.getElementById("family").textContent;
  ok(/1\/40/.test(fam), `familie-scorebord noemer is /40 ("${fam.replace(/\s+/g,' ').trim().slice(0,42)}")`);
  ok(!/\/30/.test(fam), "geen /30 meer in familie-scorebord");
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

console.log(failed ? `\n${failed} test(s) GEFAALD\n` : "\nAlles in orde.\n");
process.exit(failed ? 1 : 0);
