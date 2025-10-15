import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import html2pdf from "html2pdf.js";

type TabKey = "sccv" | "eurl";

type EURLState = {
  url?: string;
  travaux: number;
  matPct: number;
  moPct: number;
  caAutresPct: number;
  tauxIS: number;
  manualTravaux?: boolean;
};

type SCCVState = {
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

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

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
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) =>
            onChange(parseFloat(e.target.value.replace(",", ".")) || 0)
          }
          className={`bg-white/60 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={disabled}
          readOnly={disabled}
        />
        {suffix && (
          <span className="text-xs text-slate-500 w-10 select-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/60"
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3 text-sm bg-white/80">
      <div className="text-slate-500 text-[11px] tracking-wide">{label}</div>
      <div className="text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Tabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const btn = (isActive: boolean) =>
    `px-4 py-2 rounded-xl text-sm transition-colors border ${
      isActive
        ? "bg-indigo-600 text-white border-indigo-600 shadow"
        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
    }`;
  return (
    <div className="flex gap-2 mb-5" data-html2canvas-ignore>
      {(["sccv", "eurl"] as const).map((k) => (
        <button key={k} onClick={() => onChange(k)} className={btn(active === k)}>
          {k.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ------------ Onglet EURL ------------ */
function CalculateurEURL({
  eurl,
  setEurl,
  sccvTravaux,
}: {
  eurl: EURLState;
  setEurl: (s: EURLState) => void;
  sccvTravaux: number;
}) {
  const caTotal = useMemo(() => eurl.travaux, [eurl.travaux]);
  const coutMat = useMemo(
    () => (eurl.travaux * eurl.matPct) / 100,
    [eurl.travaux, eurl.matPct]
  );
  const coutMO = useMemo(
    () => (eurl.travaux * eurl.moPct) / 100,
    [eurl.travaux, eurl.moPct]
  );
  const coutAutres = useMemo(
    () => (eurl.travaux * eurl.caAutresPct) / 100,
    [eurl.travaux, eurl.caAutresPct]
  );

  const benefBrut = useMemo(
    () => caTotal - (coutMat + coutMO + coutAutres),
    [caTotal, coutMat, coutMO, coutAutres]
  );
  const impots = useMemo(
    () => Math.max(benefBrut, 0) * (eurl.tauxIS / 100),
    [benefBrut, eurl.tauxIS]
  );
  const benefNet = useMemo(() => benefBrut - impots, [benefBrut, impots]);

  useEffect(() => {
    if (!eurl.manualTravaux && eurl.travaux !== sccvTravaux) {
      setEurl({ ...eurl, travaux: sccvTravaux });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sccvTravaux, eurl.manualTravaux]);

  return (
    <Card className="mb-6 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">
          EURL – Rentabilité brute
        </CardTitle>
        <div className="mt-2">
          <TextField
            label="URL (optionnel)"
            value={eurl.url}
            placeholder="Colle un lien (drive, dossier, annonce...)"
            onChange={(v) => setEurl({ ...eurl, url: v })}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            id="chk-manual-travaux"
            type="checkbox"
            className="h-4 w-4 accent-indigo-600"
            checked={!!eurl.manualTravaux}
            onChange={(e) => {
              const manual = e.target.checked;
              if (manual) {
                setEurl({ ...eurl, manualTravaux: true });
              } else {
                setEurl({ ...eurl, manualTravaux: false, travaux: sccvTravaux });
              }
            }}
          />
          <Label htmlFor="chk-manual-travaux" className="text-xs text-slate-600">
            Modifier manuellement le « CA (Travaux) » EURL (sinon réplique automatiquement la SCCV)
          </Label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Num
            label={`Chiffre d'affaires (Travaux)${eurl.manualTravaux ? "" : " – répliqué SCCV"}`}
            value={eurl.travaux}
            suffix="€"
            disabled={!eurl.manualTravaux}
            onChange={(v) => setEurl({ ...eurl, travaux: v })}
          />
          <Num label="% Matériaux" value={eurl.matPct} suffix="%" onChange={(v) => setEurl({ ...eurl, matPct: v })}/>
          <Num label="% Main d'œuvre" value={eurl.moPct} suffix="%" onChange={(v) => setEurl({ ...eurl, moPct: v })}/>
          <Num label="% Autres frais" value={eurl.caAutresPct} suffix="%" onChange={(v) => setEurl({ ...eurl, caAutresPct: v })}/>
          <Num label="Taux IS" value={eurl.tauxIS} suffix="%" onChange={(v) => setEurl({ ...eurl, tauxIS: v })}/>
          <Kpi label="Coût matériaux" value={`€ ${fmt(coutMat)}`} />
          <Kpi label="Coût main d'œuvre" value={`€ ${fmt(coutMO)}`} />
          <Kpi label="Autres coûts" value={`€ ${fmt(coutAutres)}`} />
          <Kpi label="Bénéfice brut" value={`€ ${fmt(benefBrut)}`} />
          <Kpi label="Impôts IS" value={`€ ${fmt(impots)}`} />
          <Kpi label="Bénéfice net" value={`€ ${fmt(benefNet)}`} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------ Onglet SCCV ------------ */
function CalculateurSCCV({
  sccv,
  setSccv,
}: {
  sccv: SCCVState;
  setSccv: (s: SCCVState) => void;
}) {
  const travaux = useMemo(
    () => sccv.prixRenovM2 * sccv.surfaceM2,
    [sccv.prixRenovM2, sccv.surfaceM2]
  );
  const base = useMemo(() => sccv.bien + travaux, [sccv.bien, travaux]);
  const apport = useMemo(() => (sccv.apportPct / 100) * base, [sccv.apportPct, base]);
  const chargeCredit = useMemo(() => (base - apport) * (sccv.chargeCreditPct / 100), [base, apport, sccv.chargeCreditPct]);
  const fraisDossier = useMemo(() => (base - apport) * (sccv.fraisDossierPct / 100), [base, apport, sccv.fraisDossierPct]);
  const fraisAgence = useMemo(() => base * (sccv.fraisAgencePct / 100), [base, sccv.fraisAgencePct]);
  const coutProjet = useMemo(() => sccv.bien + travaux + fraisAgence + fraisDossier + chargeCredit, [sccv.bien, travaux, fraisAgence, fraisDossier, chargeCredit]);
  const totalApresApport = useMemo(() => coutProjet - apport, [coutProjet, apport]);

  const prixRevente = useMemo(() => sccv.surfaceM2 * sccv.prixReventeM2, [sccv.surfaceM2, sccv.prixReventeM2]);
  const benefBrut = useMemo(() => prixRevente - coutProjet + apport, [prixRevente, coutProjet, apport]);
  const is15 = useMemo(() => Math.min(Math.max(benefBrut, 0), 42500) * 0.15, [benefBrut]);
  const is25 = useMemo(() => Math.max(benefBrut - 42500, 0) * 0.25, [benefBrut]);
  const impotsIS = useMemo(() => is15 + is25, [is15, is25]);
  const netRevente = useMemo(() => benefBrut - impotsIS, [benefBrut, impotsIS]);
  const tresorerieHolding = useMemo(() => netRevente * (1 - sccv.regimeHoldingPct / 100), [netRevente, sccv.regimeHoldingPct]);

  const rendementBrutGlobal = useMemo(() => (benefBrut / totalApresApport) * 100, [benefBrut, totalApresApport]);
  const rendementNetGlobal = useMemo(() => (netRevente / totalApresApport) * 100, [netRevente, totalApresApport]);
  const rendementApport = useMemo(() => (apport > 0 ? (netRevente / apport) * 100 : 0), [netRevente, apport]);

  return (
    <Card className="mb-6 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">
          SCCV – Marchand de biens
        </CardTitle>
        <div className="mt-2">
          <TextField
            label="URL (optionnel)"
            value={sccv.url}
            placeholder="Colle un lien (drive, cadastre, annonce...)"
            onChange={(v) => setSccv({ ...sccv, url: v })}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Prix d'achat (Bien)" value={sccv.bien} suffix="€" onChange={(v) => setSccv({ ...sccv, bien: v })}/>
          <Num label="Prix rénovation (€/m²)" value={sccv.prixRenovM2} suffix="€" onChange={(v) => setSccv({ ...sccv, prixRenovM2: v })}/>
          <Num label="Surface" value={sccv.surfaceM2} suffix="m²" onChange={(v) => setSccv({ ...sccv, surfaceM2: v })}/>
          <Num label="Prix revente (€/m²)" value={sccv.prixReventeM2} suffix="€" onChange={(v) => setSccv({ ...sccv, prixReventeM2: v })}/>
          <Num label="Apport" value={sccv.apportPct} suffix="%" onChange={(v) => setSccv({ ...sccv, apportPct: v })}/>
          <Num label="Charge crédit" value={sccv.chargeCreditPct} suffix="%" onChange={(v) => setSccv({ ...sccv, chargeCreditPct: v })}/>
          <Num label="Frais dossier" value={sccv.fraisDossierPct} suffix="%" onChange={(v) => setSccv({ ...sccv, fraisDossierPct: v })}/>
          <Num label="Frais d'agence" value={sccv.fraisAgencePct} suffix="%" onChange={(v) => setSccv({ ...sccv, fraisAgencePct: v })}/>
          <Num label="Régime mère-fille holding" value={sccv.regimeHoldingPct} suffix="%" onChange={(v) => setSccv({ ...sccv, regimeHoldingPct: v })}/>
          <Kpi label="Travaux (calculés)" value={`€ ${fmt(travaux)}`} />
          <Kpi label="Coût projet (après apport)" value={`€ ${fmt(totalApresApport)}`} />
          <Kpi label="Prix de revente" value={`€ ${fmt(prixRevente)}`} />
          <Kpi label="Marge brute (base IS)" value={`€ ${fmt(benefBrut)}`} />
          <Kpi label="IS total" value={`€ ${fmt(impotsIS)}`} />
          <Kpi label="Net à la revente" value={`€ ${fmt(netRevente)}`} />
          <Kpi label="Trésorerie holding" value={`€ ${fmt(tresorerieHolding)}`} />
        </div>
        <div className="border-t mt-4 pt-4 grid grid-cols-2 gap-3">
          <Kpi label="Rendement brut projet global" value={`${fmt(rendementBrutGlobal)} %`} />
          <Kpi label="Rendement net projet global" value={`${fmt(rendementNetGlobal)} %`} />
          <Kpi label="Net sur apport (effet de levier)" value={`${fmt(rendementApport)} %`} />
        </div>
      </CardContent>
    </Card>
  );
}

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

export default function App() {
  const [tab, setTab] = useState<TabKey>("sccv");
  const [eurl, setEurl] = useState<EURLState>(() => {
    try { const raw = localStorage.getItem("calc:eurl"); return raw ? { ...DEFAULT_EURL, ...JSON.parse(raw) } : DEFAULT_EURL; }
    catch { return DEFAULT_EURL; }
  });
  const [sccv, setSccv] = useState<SCCVState>(() => {
    try { const raw = localStorage.getItem("calc:sccv"); return raw ? { ...DEFAULT_SCCV, ...JSON.parse(raw) } : DEFAULT_SCCV; }
    catch { return DEFAULT_SCCV; }
  });

  useEffect(() => { try { localStorage.setItem("calc:eurl", JSON.stringify(eurl)); } catch {} }, [eurl]);
  useEffect(() => { try { localStorage.setItem("calc:sccv", JSON.stringify(sccv)); } catch {} }, [sccv]);

  const sccvTravaux = useMemo(() => sccv.prixRenovM2 * sccv.surfaceM2, [sccv.prixRenovM2, sccv.surfaceM2]);
  useEffect(() => {
    if (!eurl.manualTravaux && eurl.travaux !== sccvTravaux) {
      setEurl((prev) => ({ ...prev, travaux: sccvTravaux }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sccvTravaux, eurl.manualTravaux]);

  // ----- EXPORT PDF -----
  const printableRef = useRef<HTMLDivElement>(null);
  const exportPDF = async () => {
    if (!printableRef.current) return;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `SCCV-EURL_${tab}_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}.pdf`;

    const opt = {
      margin: 10,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] as const },
    };

    await (html2pdf() as any).set(opt).from(printableRef.current).save();
  };

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gradient-to-b from-slate-50 to-zinc-100 text-slate-900">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-4" data-html2canvas-ignore>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Calculateur Rentabilité – SCCV / EURL
            </h1>
            <p className="text-sm text-slate-600">Version de prévisualisation (couleurs et champ URL)</p>
          </div>
          <button
            onClick={exportPDF}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm shadow hover:bg-indigo-700"
            title="Exporter la vue actuelle en PDF"
          >
            Exporter en PDF
          </button>
        </div>

        <Tabs active={tab} onChange={setTab} />

        <div ref={printableRef}>
          {tab === "sccv" ? (
            <CalculateurSCCV sccv={sccv} setSccv={setSccv} />
          ) : (
            <CalculateurEURL eurl={eurl} setEurl={setEurl} sccvTravaux={sccvTravaux} />
          )}
          <footer className="mt-6 text-[11px] text-slate-500">
            Accent principal: <span className="text-indigo-600 font-medium">indigo</span>. Fond: slate/zinc.
          </footer>
        </div>
      </div>
    </div>
  );
}
