
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import html2pdf from "html2pdf.js";
import CalculateurEURL from "./tabs/EURLTab";
import CalculateurSCCV from "./tabs/SCCVTab";
import TravauxTab from "./tabs/TravauxTab";
import ExportDialog from "./components/ExportDialog";

type TabKey = "sccv" | "eurl" | "travaux";

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
export type ChiffrageRow = {
  categorie?: string;
  sousPoste?: string;
  unite?: string;
  qte: number;
  prixUnitaire: number;
  coeffLocal: number;
  totalHT: number;
  commentaires?: string;
};
export type TravauxState = {
  rows: ChiffrageRow[];
  tva: number;
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);

const DEFAULT_EURL: EURLState = { url: "", travaux: 360000, matPct: 60, moPct: 25, caAutresPct: 15, tauxIS: 25, manualTravaux: false };
const DEFAULT_SCCV: SCCVState = { url: "", bien: 199000, prixRenovM2: 900, surfaceM2: 400, prixReventeM2: 2150, apportPct: 30, chargeCreditPct: 5.8, fraisDossierPct: 2, fraisAgencePct: 5, regimeHoldingPct: 1.25 };
const DEFAULT_TRAVAUX: TravauxState = { rows: [{ qte: 0, prixUnitaire: 0, coeffLocal: 1, totalHT: 0, commentaires: "" }], tva: 0.10 };

export default function App() {
  const [tab, setTab] = useState<TabKey>("sccv");
  const [eurl, setEurl] = useState<EURLState>(DEFAULT_EURL);
  const [sccv, setSccv] = useState<SCCVState>(DEFAULT_SCCV);
  const [travaux, setTravaux] = useState<TravauxState>(DEFAULT_TRAVAUX);

  const sccvTravaux = useMemo(() => sccv.prixRenovM2 * sccv.surfaceM2, [sccv.prixRenovM2, sccv.surfaceM2]);
  useEffect(() => { if (!eurl.manualTravaux && eurl.travaux !== sccvTravaux) setEurl(prev => ({ ...prev, travaux: sccvTravaux })); }, [sccvTravaux, eurl.manualTravaux]);

  const sccvRef = useRef<HTMLDivElement>(null);
  const eurlRef = useRef<HTMLDivElement>(null);
  const travauxChiffrageRef = useRef<HTMLDivElement>(null);
  const travauxSynthRef = useRef<HTMLDivElement>(null);

  type Targets = { sccv: boolean; eurl: boolean; travaux: boolean; synth: boolean };
  const defaultTargetsByTab: Record<TabKey, Targets> = {
    sccv:   { sccv: true,  eurl: false, travaux: false, synth: false },
    eurl:   { sccv: false, eurl: true,  travaux: false, synth: false },
    travaux:{ sccv: false, eurl: false, travaux: true,  synth: true  },
  };
  const [showExport, setShowExport] = useState(false);
  const [targets, setTargets] = useState<Targets>(defaultTargetsByTab[tab]);
  useEffect(() => { setTargets(defaultTargetsByTab[tab]); }, [tab]);
  const [includeExcel, setIncludeExcel] = useState(true);

  const runPdfExport = async () => {
    const wrap = document.createElement("div");
    wrap.style.padding = "16px";
    wrap.style.background = "#ffffff";

    const pageTitle = (txt: string) => {
      const h = document.createElement("h1");
      h.textContent = txt;
      h.style.fontSize = "18px";
      h.style.margin = "0 0 8px";
      return h;
    };

    const addCloned = (ref?: RefObject<HTMLDivElement>, title?: string) => {
      if (!ref?.current) return;
      const page = document.createElement("div");
      page.style.pageBreakAfter = "always";
      if (title) page.appendChild(pageTitle(title));
      const cloned = ref.current.cloneNode(true) as HTMLElement;
      cloned.querySelectorAll("input, textarea, select").forEach((el) => {
        const span = document.createElement("span");
        const value = (el as HTMLInputElement).value ?? ((el as HTMLSelectElement).selectedOptions?.[0]?.text ?? "");
        span.textContent = value || "";
        span.style.whiteSpace = "pre-wrap";
        el.parentElement?.replaceChild(span, el);
      });
      cloned.querySelectorAll("[data-html2canvas-ignore]").forEach((el) => el.remove());
      page.appendChild(cloned);
      wrap.appendChild(page);
    };

    if (targets.sccv) addCloned(sccvRef, "SCCV – Marchand de biens");
    if (targets.eurl) addCloned(eurlRef, "EURL – Rentabilité");

    if (targets.travaux) {
      // (a) CHIFFRAGE
      const pageA = document.createElement("div");
      pageA.style.pageBreakAfter = "always";
      pageA.appendChild(pageTitle("TRAVAUX – Chiffrage"));
      wrap.appendChild(pageA);

      // (b) SYNTHESE
      const pageB = document.createElement("div");
      pageB.style.pageBreakAfter = "always";
      pageB.appendChild(pageTitle("TRAVAUX – Synthèse"));
      if (travauxSynthRef?.current) {
        const cloned = travauxSynthRef.current.cloneNode(true) as HTMLElement;
        cloned.querySelectorAll("input, textarea, select").forEach((el) => {
          const span = document.createElement("span");
          const value = (el as HTMLInputElement).value ?? ((el as HTMLSelectElement).selectedOptions?.[0]?.text ?? "");
          span.textContent = value || "";
          span.style.whiteSpace = "pre-wrap";
          el.parentElement?.replaceChild(span, el);
        });
        cloned.querySelectorAll("[data-html2canvas-ignore]").forEach((el) => el.remove());
        pageB.appendChild(cloned);
      }
      wrap.appendChild(pageB);

      // (c) RECAP
      const pageC = document.createElement("div");
      pageC.style.pageBreakAfter = "always";
      pageC.appendChild(pageTitle("TRAVAUX – Récapitulatif par catégorie"));
      wrap.appendChild(pageC);
    }

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
    const XLSX = await import("xlsx");
    const rows = travaux.rows.map((r) => ({
      Categorie: r.categorie ?? "",
      "Sous-poste": r.sousPoste ?? "",
      Unite: r.unite ?? "",
      Qte: r.qte || 0,
      "Prix unitaire": r.prixUnitaire || 0,
      "Coeff local": r.coeffLocal || 1,
      "Total HT": r.totalHT || 0,
      Commentaires: r.commentaires ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Travaux");
    XLSX.writeFile(wb, "travaux.xlsx");
  };

  const openExportSelector = () => setShowExport(true);

  const runExport = async () => {
    setShowExport(false);
    await runPdfExport();
    if (includeExcel) runExcelExport();
  };

  return (
    <div className="min-h-screen p-5 md:p-7 bg-gradient-to-b from-slate-50 to-zinc-100 text-slate-900">
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
        <div className="flex items-center justify-between mb-3" data-html2canvas-ignore>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Calculette investissement immo
          </h1>
          <button className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 border" onClick={openExportSelector} data-html2canvas-ignore>Exporter</button>
        </div>

        <div className="flex gap-2 mb-3" data-html2canvas-ignore>
          {(["sccv","eurl","travaux"] as TabKey[]).map((k) => (
            <button
              key={k}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${tab === k ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
              onClick={() => setTab(k)}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "sccv" && (
          <CalculateurSCCV sccv={sccv} setSccv={setSccv} cardRef={sccvRef} onExportClick={openExportSelector} />
        )}
        {tab === "eurl" && (
          <CalculateurEURL eurl={eurl} setEurl={setEurl} sccvTravaux={sccvTravaux} cardRef={eurlRef} onExportClick={openExportSelector} />
        )}
        {tab === "travaux" && (
          <TravauxTab travaux={travaux} setTravaux={setTravaux} catalogue={[]} openExportSelector={openExportSelector} chiffrageAnchorRef={travauxChiffrageRef} synthRef={travauxSynthRef} />
        )}

        <footer className="mt-4 text-[10px] text-slate-500">
          Accent principal: <span className="text-indigo-600 font-medium">indigo</span>. Fond: slate/zinc.
        </footer>
      </div>
    </div>
  );
}
