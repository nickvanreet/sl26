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

console.log(failed ? `\n${failed} test(s) GEFAALD\n` : "\nAlles in orde.\n");
process.exit(failed ? 1 : 0);
