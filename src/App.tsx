import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import html2pdf from "html2pdf.js";
import CalculateurEURL from "./tabs/EURLTab";
import CalculateurSCCV from "./tabs/SCCVTab";
import TravauxTab from "./tabs/TravauxTab";
import ExportDialog from "./components/ExportDialog";


/* -------------------------------------------------------
   Calculette investissement immo
   - Onglets : SCCV / EURL / TRAVAUX (chiffrage via drawer)
   - Prix catalogue = "Moyen" uniquement
   - Catalogue chargé live depuis Google Sheets (CSV)
   - Export (PDF/Excel) : même sélecteur pour tous les boutons "Export"
-------------------------------------------------------- */

type TabKey = "sccv" | "eurl" | "travaux";
type Level = "Bas" | "Moyen" | "Haut";
export type EURLState = {
  url?: string;
  travaux: number;
  matPct: number;
  moPct: number;
  caAutresPct: number;
  tauxIS: number;
  manualTravaux?: boolean;
};
export type SCCVState = {
  url?: string;
  bien: number;
  prixRenovM2: number;
  surfaceM2: number;
  prixReventeM2: number;
  apportPct: number;
  chargeCreditPct: number;
  fraisDossierPct: number;
  fraisAgencePct: number;
  regimeHoldingPct: number;
};
export type CatalogueItem = {
  categorie: string;
  sousPoste: string;
  unite: string;
  prix: { bas: number; moyen: number; haut: number };
  note?: string;
};
export type ChiffrageRow = {
  categorie?: string;
  sousPoste?: string;
  unite?: string;
  qte: number;
  prixUnitaire: number; // auto = "moyen"
  coeffLocal: number;
  totalHT: number;
  commentaires?: string;
};
export type TravauxState = {
  rows: ChiffrageRow[];
  tva: number; // ex: 0.10
};

/** Affichage formaté de nombres en FR */
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

/** Champ numérique compact avec label + suffixe optionnel */
function Num({
  label,
  value,
  onChange,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-slate-500">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) =>
            onChange(parseFloat(e.target.value.replace(",", ".")) || 0)
          }
          className={`bg-white/60 h-8 px-2 py-1 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
          disabled={disabled}
          readOnly={disabled}
        />
        {suffix && (
          <span className="text-[10px] text-slate-500 w-8 select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Champ texte compact avec label */
function TextField({
  label,
  value,
  placeholder,
  onChange,
  readOnly,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-slate-500">{label}</Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/60 h-8 px-2 py-1"
        readOnly={readOnly}
      />
    </div>
  );
}

/** Petit KPI (étiquette + valeur) */
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-2 text-[12px] bg-white/80">
      <div className="text-slate-500 text-[10px] tracking-wide">{label}</div>
      <div className="text-[13px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

/* ---------- Catalogue (live depuis Google Sheets) ---------- */
const SHEET_ID = "1RqfPjc9r-jFrZksmYb5tOwTfjKbgY8Sx4BORMsVwZXo";
const SHEET_GID = "1104107230";
/*const SHEET_URL = "https://script.google.com/macros/s/AKfyc.../exec";*/
const SHEET_CSV_URL =`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;


const FALLBACK_CATALOGUE: CatalogueItem[] = [
  { categorie: "GROS ŒUVRE", sousPoste: "Démolition cloison simple", unite: "m²", prix: { bas: 10, moyen: 15, haut: 25 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Électricité complète", unite: "m²", prix: { bas: 70, moyen: 80, haut: 90 } },
  { categorie: "FINITIONS", sousPoste: "Peinture murs & plafonds", unite: "m²", prix: { bas: 14, moyen: 18, haut: 25 } },
  { categorie: "MENUISERIES", sousPoste: "Fenêtre PVC DV 120x135", unite: "U", prix: { bas: 350, moyen: 400, haut: 500 } },
];

/* CSV parser robuste (gère ; , tab, guillets, accents, en-têtes variées) */
function smartSplit(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (!inQ && (c === ";" || c === "," || c === "\t")) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "");

function parseCatalogueCsv(csv: string): CatalogueItem[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = smartSplit(lines[0]).map(norm);
  const pos = (aliases: string[]) =>
    header.findIndex((h) => aliases.some((a) => h.includes(a)));

  const iCat = pos(["categorie", "category"]);
  const iSous = pos(["sousposte", "sous-poste", "sousposte", "poste"]);
  const iUnite = pos(["unite", "unite", "unité"]);
  const iBas = pos(["bas"]);
  const iMoy = pos(["moyen", "defaut", "moy"]);
  const iHaut = pos(["haut"]);
  const iNote = pos(["note", "commentaire"]);

  const out: CatalogueItem[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = smartSplit(lines[r]);
    const cat = iCat >= 0 ? cells[iCat] : "";
    const sous = iSous >= 0 ? cells[iSous] : "";
    if (!cat || !sous) continue;
    const unite = iUnite >= 0 ? cells[iUnite] : "";
    const toNum = (v?: string) => parseFloat((v || "").replace(",", ".")) || 0;
    const bas = toNum(iBas >= 0 ? cells[iBas] : undefined);
    const moyen = toNum(iMoy >= 0 ? cells[iMoy] : undefined);
    const haut = toNum(iHaut >= 0 ? cells[iHaut] : undefined);
    const note = iNote >= 0 ? cells[iNote] : undefined;
    out.push({ categorie: cat, sousPoste: sous, unite, prix: { bas, moyen, haut }, note });
  }
  return out;
}

/* ------------ TRAVAUX (drawer) ------------ */


/* ------------ EURL ------------ */


/* ------------ SCCV ------------ */


/* -------------------- App -------------------- */
const DEFAULT_EURL: EURLState = {
  url: "",
  travaux: 360000,
  matPct: 60,
  moPct: 25,
  caAutresPct: 15,
  tauxIS: 25,
  manualTravaux: false,
};
const DEFAULT_SCCV: SCCVState = {
  url: "",
  bien: 199000,
  prixRenovM2: 900,
  surfaceM2: 400,
  prixReventeM2: 2150,
  apportPct: 30,
  chargeCreditPct: 5.8,
  fraisDossierPct: 2,
  fraisAgencePct: 5,
  regimeHoldingPct: 1.25,
};
const DEFAULT_TRAVAUX: TravauxState = {
  rows: [{ qte: 0, prixUnitaire: 0, coeffLocal: 1, totalHT: 0, commentaires: "" }],
  tva: 0.10,
};

export default function App() {
  const [tab, setTab] = useState<TabKey>(() => {
    try { return (localStorage.getItem("calc:tab") as TabKey) || "sccv"; } catch { return "sccv"; }
  });
  const [eurl, setEurl] = useState<EURLState>(() => {
    try { const raw = localStorage.getItem("calc:eurl"); return raw ? { ...DEFAULT_EURL, ...JSON.parse(raw) } : DEFAULT_EURL; }
    catch { return DEFAULT_EURL; }
  });
  const [sccv, setSccv] = useState<SCCVState>(() => {
    try { const raw = localStorage.getItem("calc:sccv"); return raw ? { ...DEFAULT_SCCV, ...JSON.parse(raw) } : DEFAULT_SCCV; }
    catch { return DEFAULT_SCCV; }
  });
  const [travaux, setTravaux] = useState<TravauxState>(() => {
    try { const raw = localStorage.getItem("calc:travaux"); return raw ? { ...DEFAULT_TRAVAUX, ...JSON.parse(raw) } : DEFAULT_TRAVAUX; }
    catch { return DEFAULT_TRAVAUX; }
  });
  useEffect(() => { try { localStorage.setItem("calc:eurl", JSON.stringify(eurl)); } catch {} }, [eurl]);
  useEffect(() => { try { localStorage.setItem("calc:sccv", JSON.stringify(sccv)); } catch {} }, [sccv]);
  useEffect(() => { try { localStorage.setItem("calc:travaux", JSON.stringify(travaux)); } catch {} }, [travaux]);
  useEffect(() => { try { localStorage.setItem("calc:tab", tab); } catch {} }, [tab]);
// ---- Catalogue (state + fetch) ----
const [catalogue, setCatalogue] = useState<CatalogueItem[]>(FALLBACK_CATALOGUE);

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch(SHEET_CSV_URL, { method: "GET" });
      if (!res.ok) throw new Error("http error");
      const csv = await res.text();
      const parsed = parseCatalogueCsv(csv);
      if (!cancelled && parsed.length) setCatalogue(parsed);
    } catch {
      // fallback silencieux : on conserve FALLBACK_CATALOGUE
    }
  })();
  return () => { cancelled = true; };
}, []);


  // Lien SCCV → EURL (CA travaux)
  const sccvTravaux = useMemo(() => sccv.prixRenovM2 * sccv.surfaceM2, [sccv.prixRenovM2, sccv.surfaceM2]);
  useEffect(() => {
    if (!eurl.manualTravaux && eurl.travaux !== sccvTravaux) {
      setEurl((prev) => ({ ...prev, travaux: sccvTravaux }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sccvTravaux, eurl.manualTravaux]);

  // ---------- EXPORT central (même pour tous les boutons) ----------
  const sccvRef = useRef<HTMLDivElement>(null);
  const eurlRef = useRef<HTMLDivElement>(null);
  const travauxRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<HTMLDivElement>(null);

  type Targets = {
    sccv: boolean;
    eurl: boolean;
    synth: boolean;
    travaux: boolean;
  };
  const defaultTargetsByTab: Record<TabKey, Targets> = {
    sccv: { sccv: true, eurl: false, synth: false, travaux: false },
    eurl: { sccv: false, eurl: true, synth: false, travaux: false },
    travaux: { sccv: false, eurl: false, synth: true, travaux: true },
  };
  const [showExport, setShowExport] = useState(false);
  const [targets, setTargets] = useState<Targets>(defaultTargetsByTab[tab]);
  useEffect(() => { setTargets(defaultTargetsByTab[tab]); }, [tab]);

  const openExportSelector = () => setShowExport(true);

  // Remplace inputs/select/textarea par texte (pour PDF sans champs)
  const sanitizeNode = (node: HTMLElement) => {
    node.querySelectorAll("input, textarea, select").forEach((el) => {
      const span = document.createElement("span");
      const isInput = (el as HTMLInputElement).value !== undefined;
      const value =
        (el as HTMLInputElement).value ??
        ((el as HTMLSelectElement).selectedOptions?.[0]?.text ?? "");
      span.textContent = value || "";
      span.style.whiteSpace = "pre-wrap";
      el.parentElement?.replaceChild(span, el);
    });
    node.querySelectorAll("[data-html2canvas-ignore]").forEach((el) => el.remove());
    return node;
  };

  // Sous-table TRAVAUX chiffrage (colonnes limitées pour PDF)
  const buildTravauxChiffrageTable = () => {
    const wrap = document.createElement("div");
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.fontSize = "12px";
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0 6px";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    ["Catégorie","Sous-poste","Unité","Qté","Prix unitaire (€)","Commentaires","Total (€)"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h; th.style.textAlign = ["Qté","Prix unitaire (€)","Total (€)"].includes(h) ? "right" : "left";
      th.style.padding = "4px 6px"; th.style.color = "#475569";
      trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement("tbody");
    travaux.rows.forEach((r) => {
      const tr = document.createElement("tr");
      const cells = [
        r.categorie ?? "",
        r.sousPoste ?? "",
        r.unite ?? "",
        (Number.isFinite(r.qte) ? r.qte : 0).toString(),
        (Number.isFinite(r.prixUnitaire) ? r.prixUnitaire : 0).toString(),
        r.commentaires ?? "",
        (Number.isFinite(r.totalHT) ? r.totalHT : 0).toString(),
      ];
      cells.forEach((c, idx) => {
        const td = document.createElement("td");
        td.textContent = idx === 6 || idx === 4 || idx === 3 ? fmt(parseFloat(c) || 0) : c;
        td.style.textAlign = [3,4,6].includes(idx) ? "right" : "left";
        td.style.padding = "4px 6px";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  };

  // EXPORT PDF
  const runPdfExport = async () => {
    const wrap = document.createElement("div");
    wrap.style.padding = "16px";
    wrap.style.background = "#ffffff";

    const addCloned = (ref?: RefObject<HTMLDivElement>, title?: string, sanitize = true) => {
      if (!ref?.current) return;
      const page = document.createElement("div");
      page.style.pageBreakAfter = "always";
      if (title) {
        const h = document.createElement("h1");
        h.textContent = title;
        h.style.fontSize = "18px";
        h.style.margin = "0 0 8px";
        page.appendChild(h);
      }
      const cloned = ref.current.cloneNode(true) as HTMLElement;
      page.appendChild(sanitize ? sanitizeNode(cloned) : cloned);
      wrap.appendChild(page);
    };

    if (targets.sccv) addCloned(sccvRef, "SCCV – Marchand de biens");
    if (targets.eurl) addCloned(eurlRef, "EURL – Rentabilité brute");
    if (targets.synth) addCloned(synthRef, "TRAVAUX – Synthèse");
    if (targets.travaux) {
      const page = document.createElement("div");
      page.style.pageBreakAfter = "always";
      const h = document.createElement("h1");
      h.textContent = "TRAVAUX – Chiffrage"; h.style.fontSize = "18px"; h.style.margin = "0 0 8px";
      page.appendChild(h);
      page.appendChild(buildTravauxChiffrageTable());
      wrap.appendChild(page);
    }

    if (!wrap.childNodes.length) { setShowExport(false); return; }
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `Export_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}.pdf`;
    const opt = {
      margin: 12,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2.2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["css", "legacy"] as const },
    };
    await (html2pdf() as any).set(opt).from(wrap).save();
  };

const runExcelExport = async () => {
  // @ts-ignore
  const XLSX = await import("xlsx"); // lazy-load

  const wb = XLSX.utils.book_new();

  // --- SCCV ---
  {
    const rows = [
      ["Paramètre", "Valeur", "Unité"],
      ["Prix d'achat (Bien)", sccv.bien, "€"],
      ["Prix rénovation (€/m²)", sccv.prixRenovM2, "€"],
      ["Surface", sccv.surfaceM2, "m²"],
      ["Prix revente (€/m²)", sccv.prixReventeM2, "€"],
      ["Apport (%)", sccv.apportPct, "%"],
      ["Charge crédit (%)", sccv.chargeCreditPct, "%"],
      ["Frais dossier (%)", sccv.fraisDossierPct, "%"],
      ["Frais agence (%)", sccv.fraisAgencePct, "%"],
      ["Régime holding (%)", sccv.regimeHoldingPct, "%"],
      [],
      ["Travaux (€) = PrixRenov/m² * Surface", { f: "B3*B4" }],
      ["Base (€) = Bien + Travaux", { f: "B2+B12" }],
      ["Apport (€) = % * Base", { f: "B6/100*B13" }],
      ["Charge crédit (€) = (Base-Apport)*%", { f: "(B13-B14)*B7/100" }],
      ["Frais dossier (€) = (Base-Apport)*%", { f: "(B13-B14)*B8/100" }],
      ["Frais agence (€) = Base*%", { f: "B13*B9/100" }],
      ["Coût projet (€) = Bien + Travaux + Agence + Dossier + Crédit", { f: "B2+B12+B16+B15+B14" }],
      ["Total après apport (€) = Coût - Apport", { f: "B17-B14" }],
      ["Prix revente (€) = Surface*PrixRev/m²", { f: "B4*B5" }],
      ["Marge brute (€) = Revente - Coût + Apport", { f: "B19-B17+B14" }],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows as any);
    XLSX.utils.book_append_sheet(wb, ws, "SCCV");
  }

  // --- EURL ---
  {
    const rows = [
      ["Paramètre", "Valeur", "Unité"],
      ["CA (Travaux) €", eurl.travaux, "€"],
      ["% Matériaux", eurl.matPct, "%"],
      ["% Main d'œuvre", eurl.moPct, "%"],
      ["% Autres frais", eurl.caAutresPct, "%"],
      ["Taux IS (%)", eurl.tauxIS, "%"],
      [],
      ["Coût matériaux (€)", { f: "B2*B3/100" }],
      ["Coût MO (€)", { f: "B2*B4/100" }],
      ["Autres coûts (€)", { f: "B2*B5/100" }],
      ["Bénéfice brut (€)", { f: "B2-(B8+B9+B10)" }],
      ["Impôts IS (€)", { f: "MAX(B11,0)*B6/100" }],
      ["Bénéfice net (€)", { f: "B11-B12" }],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows as any);
    XLSX.utils.book_append_sheet(wb, ws, "EURL");
  }

  // --- TRAVAUX ---
  {
    const header = ["Catégorie","Sous-poste","Unité","Qté","Prix unitaire (€)","Coeff","Total (€)","Commentaires"];
    const body = travaux.rows.map((r) => [
      r.categorie ?? "",
      r.sousPoste ?? "",
      r.unite ?? "",
      r.qte || 0,
      r.prixUnitaire || 0,
      r.coeffLocal || 1,
      null, // formule G
      r.commentaires ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body] as any);
    for (let i = 0; i < body.length; i++) {
      const rowIndex = 2 + i;
      const cell = XLSX.utils.encode_cell({ r: i + 1, c: 6 }); // col G
      (ws as any)[cell] = { t: "n", f: `D${rowIndex}*E${rowIndex}*F${rowIndex}` };
    }
    XLSX.utils.book_append_sheet(wb, ws, "TRAVAUX");
  }

  XLSX.writeFile(wb, "Export_Calculette_Immo.xlsx");
};


  const runExport = async () => {
    setShowExport(false);
    // On lance PDF puis Excel si l’utilisateur a choisi Excel
    // (ici, on laisse toujours le choix dans le sélecteur ci-dessous)
    await runPdfExport();
    // Excel optionnel : checkbox ci-dessous
    if (includeExcel) runExcelExport();
  };

  // UI du sélecteur (même pour tous)
  const [includeExcel, setIncludeExcel] = useState(true);

     return (
    <div className="min-h-screen p-5 md:p-7 bg-gradient-to-b from-slate-50 to-zinc-100 text-slate-900">
      {/* Dialog export (commun) */}
      {showExport && (
        <ExportDialog
          targets={targets}
          setTargets={setTargets}
          includeExcel={includeExcel}
          setIncludeExcel={setIncludeExcel}
          onExportPdf={runPdfExport}
          onExportExcel={runExcelExport}
          onClose={() => setShowExport(false)}
        />
      )}

      <div className="max-w-5xl mx-auto">
        <div
          className="flex items-center justify-between mb-3"
          data-html2canvas-ignore
        >
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Calculette investissement immo
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3" data-html2canvas-ignore>
          {(["sccv", "eurl", "travaux"] as TabKey[]).map((k) => (
            <button
              key={k}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                tab === k
                  ? "bg-indigo-600 text-white border-indigo-600 shadow"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => setTab(k)}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Sections */}
        {tab === "sccv" && (
          <CalculateurSCCV
            sccv={sccv}
            setSccv={setSccv}
            cardRef={sccvRef}
            onExportClick={openExportSelector}
          />
        )}
        {tab === "eurl" && (
          <CalculateurEURL
            eurl={eurl}
            setEurl={setEurl}
            sccvTravaux={sccvTravaux}
            cardRef={eurlRef}
            onExportClick={openExportSelector}
          />
        )}
        {tab === "travaux" && (
          <TravauxTab
            travaux={travaux}
            setTravaux={setTravaux}
            catalogue={catalogue}
            openExportSelector={openExportSelector}
            chiffrageAnchorRef={travauxRef}
            synthRef={synthRef}
          />
        )}

        <footer className="mt-4 text-[10px] text-slate-500">
          Accent principal :{" "}
          <span className="text-indigo-600 font-medium">indigo</span>. Fond :
          slate/zinc.
        </footer>
      </div>
    </div>
  );
}
