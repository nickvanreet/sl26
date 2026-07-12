/*
 * Rookproef. Draai dit voor elke deploy:  npm install jsdom && node test/smoke.js
 *
 * Dekt de twee bugs die we echt hebben gehad:
 *   1. de tabbalk was er niet (position:fixed onderaan, viel buiten beeld)
 *   2. de tabs deden niets bij een tweede bezoek (setWho() draaide voordat
 *      `ticks` bestond -> undefined.forEach -> hele script afgebroken)
 */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const TABS = ["dagen", "avontuur", "missies", "spellen", "billie"];
let failed = 0;

function ok(cond, label) {
  console.log(`  ${cond ? "OK  " : "FOUT"}  ${label}`);
  if (!cond) failed++;
}

function load(seed, storageWorks = true) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://x.test/",
    beforeParse(w) {
      const store = { ...seed };
      const boom = () => { throw new Error("storage geblokkeerd"); };
      Object.defineProperty(w, "localStorage", {
        value: {
          getItem: (k) => (storageWorks ? (k in store ? store[k] : null) : boom()),
          setItem: (k, v) => (storageWorks ? (store[k] = String(v)) : boom()),
          removeItem: (k) => (storageWorks ? delete store[k] : boom()),
          clear: () => {},
        },
      });
      w.addEventListener("error", (e) => errors.push(e.message));
    },
  });
  return { dom, doc: dom.window.document, errors };
}

function click(dom, el) {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function scenario(label, seed, storageWorks = true) {
  console.log("\n" + label);
  const { dom, doc, errors } = load(seed, storageWorks);

  ok(errors.length === 0, `geen JS-fouten${errors.length ? " -> " + errors.join(" | ") : ""}`);

  const tabs = doc.querySelectorAll("nav.tabs button");
  ok(tabs.length === 5, `5 tabbladen aanwezig (${tabs.length})`);

  let switched = 0;
  tabs.forEach((b, i) => {
    click(dom, b);
    const active = doc.querySelector(".tabpane.active");
    if (active && active.id === "t-" + TABS[i]) switched++;
  });
  ok(switched === 5, `alle 5 tabbladen wisselen (${switched}/5)`);

  ok(doc.querySelectorAll("details.day").length === 18, "18 dagkaarten");
  ok(doc.querySelectorAll("input[data-m]").length === 30, "30 missies");
  ok(doc.querySelectorAll("textarea.daynote").length === 18, "18 dagboek-velden (1 per dag)");
  ok(!!doc.getElementById("journal"), "reisdagboek-vak aanwezig");
  ok(doc.querySelectorAll("#bingo button").length === 16, "16 bingotegels");
  ok(doc.querySelectorAll("#badges .badge").length === 6, "6 badges getoond");
  ok(doc.querySelectorAll("#routemap .mapnode").length === 6, "routekaart met 6 stops");
  ok(!!doc.getElementById("night"), "kampvuur-knop aanwezig");
  ok(doc.querySelectorAll("#intro .namebtn").length === 5, "5 spelers kiesbaar (incl. Mama & Papa)");
  ok(doc.querySelectorAll("#scoreboard > div").length === 5, "scorebord toont 5 spelers");
  ok(!!doc.getElementById("shareScore") && !!doc.getElementById("family"), "familie-scorebord aanwezig");
  ok(!/€|budget|prijs per/i.test(doc.body.textContent), "geen prijzen of budget in de kids-versie");

  const warned = doc.getElementById("nostore").style.display === "block";
  ok(storageWorks ? !warned : warned, storageWorks
      ? "geen valse waarschuwing als opslag werkt"
      : "waarschuwt de kinderen als opslag niet werkt");

  if (storageWorks && seed["sl26:who"]) {
    ok(doc.getElementById("intro").style.display === "none", "naamkeuze overgeslagen bij terugkeer");
    ok(doc.getElementById("rankcount").textContent === "2", "eerder aangevinkte missies teruggeladen");
  }
  dom.window.close();
}

scenario("1. Eerste opening (nog geen naam gekozen)", {});
scenario("2. Terugkerende gebruiker  <- dit scenario crashte ooit", {
  "sl26:who": "Willem",
  "sl26:Willem:m01": "1",
  "sl26:Willem:m02": "1",
});
scenario("3. Als bestand geopend, opslag geblokkeerd", {}, false);

console.log("\n4. Nieuwe features (dagboek + eigen bingokaart)");
const order = (d) => [...d.querySelectorAll("#bingo button")].map((x) => x.textContent).join("|");
const loes = load({ "sl26:who": "Loes" });
const willem = load({ "sl26:who": "Willem" });
const loes2 = load({ "sl26:who": "Loes" });
ok(order(loes.doc) !== order(willem.doc), "Loes en Willem krijgen een andere bingokaart");
ok(order(loes.doc) === order(loes2.doc), "zelfde kind = zelfde kaart bij herladen");
[loes, willem, loes2].forEach((x) => x.dom.window.close());

const jrnl = load({
  "sl26:who": "Willem",
  "sl26:Willem:note:2026-07-18": "Rafting was gek!",
});
const ta = [...jrnl.doc.querySelectorAll("textarea.daynote")].find((t) => t.dataset.date === "2026-07-18");
ok(jrnl.errors.length === 0, "geen JS-fouten met een opgeslagen notitie");
ok(!!ta && ta.value === "Rafting was gek!", "dagboek-notitie teruggeladen in het juiste dagveld");
ok(/Rafting was gek!/.test(jrnl.doc.getElementById("journal").textContent), "notitie verschijnt in het reisdagboek-overzicht");
jrnl.dom.window.close();

console.log("\n5. Kampvuur-modus + één badge afronden");
const night = load({ "sl26:who": "Loes" });
ok(!night.doc.body.classList.contains("night"), "start in dagmodus");
click(night.dom, night.doc.getElementById("night"));
ok(night.doc.body.classList.contains("night"), "kampvuur-modus aan na klik");
click(night.dom, night.doc.getElementById("night"));
ok(!night.doc.body.classList.contains("night"), "en weer uit na tweede klik");
// Waterrat = m01,m09,m14,m27 -> alle vier aanvinken maakt de badge "on"
["m01", "m09", "m14", "m27"].forEach((m) => {
  const inp = night.doc.querySelector(`input[data-m="${m}"]`);
  inp.checked = true;
  inp.dispatchEvent(new night.dom.window.Event("change", { bubbles: true }));
});
const waterrat = [...night.doc.querySelectorAll("#badges .badge")].find((b) => /Waterrat/.test(b.textContent));
ok(!!waterrat && waterrat.classList.contains("on"), "Waterrat-badge ontgrendeld na 4 missies");
ok(night.errors.length === 0, "geen JS-fouten tijdens badges + modus-wissel");
night.dom.window.close();

console.log("\n6. Ouder als speler (Papa)");
const papa = load({ "sl26:who": "Papa", "sl26:Papa:m01": "1" });
ok(papa.errors.length === 0, "geen JS-fouten voor een ouder-speler");
ok(papa.doc.getElementById("intro").style.display === "none", "Papa slaat naamkeuze over bij terugkeer");
ok(papa.doc.getElementById("rankcount").textContent === "1", "Papa's missie teruggeladen");
papa.dom.window.close();

console.log("\n7. Score delen & vergelijken");
const fam = load({ "sl26:who": "Loes", "sl26:Loes:m01": "1", "sl26:Loes:m02": "1" });
const famTxt = () => fam.doc.getElementById("family").textContent;
ok(/Loes/.test(famTxt()), "eigen score staat in het familie-scorebord");
// een geldige code van Willem plakken en toevoegen
fam.doc.getElementById("pasteScore").value = "v1~Willem~15~2~2~20260721";
click(fam.dom, fam.doc.getElementById("addScore"));
ok(/Willem/.test(famTxt()) && /15\/30/.test(famTxt()), "geplakte score van Willem verschijnt");
// een gedeelde link (met #s=) wordt ook herkend
fam.doc.getElementById("pasteScore").value = "https://x.test/#s=" + encodeURIComponent("v1~Charlotte~7~1~1~20260722");
click(fam.dom, fam.doc.getElementById("addScore"));
ok(/Charlotte/.test(famTxt()), "score uit een gedeelde link wordt herkend");
// onzin wordt netjes geweigerd
fam.doc.getElementById("pasteScore").value = "rommel";
click(fam.dom, fam.doc.getElementById("addScore"));
ok(/snap ik niet/.test(fam.doc.getElementById("shareMsg").textContent), "onzin-code wordt geweigerd");
ok(fam.errors.length === 0, "geen JS-fouten bij delen/vergelijken");
fam.dom.window.close();

console.log(failed ? `\n${failed} test(s) GEFAALD\n` : "\nAlles in orde.\n");
process.exit(failed ? 1 : 0);
