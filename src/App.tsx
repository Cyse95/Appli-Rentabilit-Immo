import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TabKey = "sccv" | "eurl";

type EURLState = {
  travaux: number;
  matPct: number;
  moPct: number;
  caAutresPct: number;
  tauxIS: number;
};

type SCCVState = {
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) =>
            onChange(parseFloat(e.target.value.replace(",", ".")) || 0)
          }
        />
        {suffix && <span className="text-xs text-gray-600 w-10">{suffix}</span>}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3 text-sm">
      <div className="text-gray-600 text-xs">{label}</div>
      <div className="text-base font-semibold">{value}</div>
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
  return (
    <div className="flex gap-2 mb-4">
      {(["sccv", "eurl"] as const).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-4 py-2 rounded-2xl border text-sm ${
            active === k ? "bg-gray-900 text-white" : "bg-white"
          }`}
        >
          {k.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ------------ Onglet EURL (contrôlé par App) ------------ */
function CalculateurEURL({
  eurl,
  setEurl,
  markTravauxTouched,
}: {
  eurl: EURLState;
  setEurl: (s: EURLState) => void;
  markTravauxTouched: () => void;
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

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">EURL – Rentabilité brute</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Num
            label="Chiffre d'affaires (Travaux)"
            value={eurl.travaux}
            suffix="€"
            onChange={(v) => {
              markTravauxTouched();               // <- stoppe la sync auto
              setEurl({ ...eurl, travaux: v });
            }}
          />
          <Num
            label="% Matériaux"
            value={eurl.matPct}
            suffix="%"
            onChange={(v) => setEurl({ ...eurl, matPct: v })}
          />
          <Num
            label="% Main d'œuvre"
            value={eurl.moPct}
            suffix="%"
            onChange={(v) => setEurl({ ...eurl, moPct: v })}
          />
          <Num
            label="% Autres frais"
            value={eurl.caAutresPct}
            suffix="%"
            onChange={(v) => setEurl({ ...eurl, caAutresPct: v })}
          />
          <Num
            label="Taux IS"
            value={eurl.tauxIS}
            suffix="%"
            onChange={(v) => setEurl({ ...eurl, tauxIS: v })}
          />

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

/* ------------ Onglet SCCV (contrôlé par App) ------------ */
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
  const apport = useMemo(
    () => (sccv.apportPct / 100) * base,
    [sccv.apportPct, base]
  );
  const chargeCredit = useMemo(
    () => (base - apport) * (sccv.chargeCreditPct / 100),
    [base, apport, sccv.chargeCreditPct]
  );
  const fraisDossier = useMemo(
    () => (base - apport) * (sccv.fraisDossierPct / 100),
    [base, apport, sccv.fraisDossierPct]
  );
  const fraisAgence = useMemo(
    () => base * (sccv.fraisAgencePct / 100),
    [base, sccv.fraisAgencePct]
  );
  const coutProjet = useMemo(
    () => sccv.bien + travaux + fraisAgence + fraisDossier + chargeCredit,
    [sccv.bien, travaux, fraisAgence, fraisDossier, chargeCredit]
  );
  const totalApresApport = useMemo(
    () => coutProjet - apport,
    [coutProjet, apport]
  );

  const prixRevente = useMemo(
    () => sccv.surfaceM2 * sccv.prixReventeM2,
    [sccv.surfaceM2, sccv.prixReventeM2]
  );
  const benefBrut = useMemo(
    () => prixRevente - coutProjet + apport,
    [prixRevente, coutProjet, apport]
  );
  const is15 = useMemo(
    () => Math.min(Math.max(benefBrut, 0), 42500) * 0.15,
    [benefBrut]
  );
  const is25 = useMemo(
    () => Math.max(benefBrut - 42500, 0) * 0.25,
    [benefBrut]
  );
  const impotsIS = useMemo(() => is15 + is25, [is15, is25]);
  const netRevente = useMemo(() => benefBrut - impotsIS, [benefBrut, impotsIS]);
  const tresorerieHolding = useMemo(
    () => netRevente * (1 - sccv.regimeHoldingPct / 100),
    [netRevente, sccv.regimeHoldingPct]
  );

  const rendementBrutGlobal = useMemo(
    () => (benefBrut / totalApresApport) * 100,
    [benefBrut, totalApresApport]
  );
  const rendementNetGlobal = useMemo(
    () => (netRevente / totalApresApport) * 100,
    [netRevente, totalApresApport]
  );
  const rendementApport = useMemo(
    () => (apport > 0 ? (netRevente / apport) * 100 : 0),
    [netRevente, apport]
  );

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">SCCV – Marchand de biens</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Num
            label="Prix d'achat (Bien)"
            value={sccv.bien}
            suffix="€"
            onChange={(v) => setSccv({ ...sccv, bien: v })}
          />
          <Num
            label="Prix rénovation (€/m²)"
            value={sccv.prixRenovM2}
            suffix="€"
            onChange={(v) => setSccv({ ...sccv, prixRenovM2: v })}
          />
          <Num
            label="Surface"
            value={sccv.surfaceM2}
            suffix="m²"
            onChange={(v) => setSccv({ ...sccv, surfaceM2: v })}
          />
          <Num
            label="Prix revente (€/m²)"
            value={sccv.prixReventeM2}
            suffix="€"
            onChange={(v) => setSccv({ ...sccv, prixReventeM2: v })}
          />
          <Num
            label="Apport"
            value={sccv.apportPct}
            suffix="%"
            onChange={(v) => setSccv({ ...sccv, apportPct: v })}
          />
          <Num
            label="Charge crédit"
            value={sccv.chargeCreditPct}
            suffix="%"
            onChange={(v) => setSccv({ ...sccv, chargeCreditPct: v })}
          />
          <Num
            label="Frais dossier"
            value={sccv.fraisDossierPct}
            suffix="%"
            onChange={(v) => setSccv({ ...sccv, fraisDossierPct: v })}
          />
          <Num
            label="Frais d'agence"
            value={sccv.fraisAgencePct}
            suffix="%"
            onChange={(v) => setSccv({ ...sccv, fraisAgencePct: v })}
          />
          <Num
            label="Régime mère-fille holding"
            value={sccv.regimeHoldingPct}
            suffix="%"
            onChange={(v) => setSccv({ ...sccv, regimeHoldingPct: v })}
          />

          <Kpi label="Travaux (calculés)" value={`€ ${fmt(travaux)}`} />
          <Kpi
            label="Coût projet (après apport)"
            value={`€ ${fmt(totalApresApport)}`}
          />
          <Kpi label="Prix de revente" value={`€ ${fmt(prixRevente)}`} />
          <Kpi label="Marge brute (base IS)" value={`€ ${fmt(benefBrut)}`} />
          <Kpi label="IS total" value={`€ ${fmt(impotsIS)}`} />
          <Kpi label="Net à la revente" value={`€ ${fmt(netRevente)}`} />
          <Kpi label="Trésorerie holding" value={`€ ${fmt(tresorerieHolding)}`} />
        </div>
        <div className="border-t mt-4 pt-4 grid grid-cols-2 gap-3">
          <Kpi
            label="Rendement brut projet global"
            value={`${fmt(rendementBrutGlobal)} %`}
          />
          <Kpi
            label="Rendement net projet global"
            value={`${fmt(rendementNetGlobal)} %`}
          />
          <Kpi
            label="Net sur apport (effet de levier)"
            value={`${fmt(rendementApport)} %`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- App -------------------- */
const DEFAULT_EURL: EURLState = {
  travaux: 360000,
  matPct: 60,
  moPct: 25,
  caAutresPct: 15,
  tauxIS: 25,
};

const DEFAULT_SCCV: SCCVState = {
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

  // flags pour savoir si on écrase ou pas
  const hadEurlInStorage = (() => {
    try {
      return !!localStorage.getItem("calc:eurl");
    } catch {
      return false;
    }
  })();

  // états contrôlés
  const [eurl, setEurl] = useState<EURLState>(() => {
    try {
      const raw = localStorage.getItem("calc:eurl");
      return raw ? { ...DEFAULT_EURL, ...JSON.parse(raw) } : DEFAULT_EURL;
    } catch {
      return DEFAULT_EURL;
    }
  });

  const [sccv, setSccv] = useState<SCCVState>(() => {
    try {
      const raw = localStorage.getItem("calc:sccv");
      return raw ? { ...DEFAULT_SCCV, ...JSON.parse(raw) } : DEFAULT_SCCV;
    } catch {
      return DEFAULT_SCCV;
    }
  });

  // si l'utilisateur touche le champ "Travaux" EURL, on stoppe la sync auto
  const [eurlTravauxTouched, setEurlTravauxTouched] = useState<boolean>(
    hadEurlInStorage // si on avait déjà des valeurs, on ne les écrase pas
  );

  // Persistance
  useEffect(() => {
    try {
      localStorage.setItem("calc:eurl", JSON.stringify(eurl));
    } catch {}
  }, [eurl]);

  useEffect(() => {
    try {
      localStorage.setItem("calc:sccv", JSON.stringify(sccv));
    } catch {}
  }, [sccv]);

  // --- Sync par défaut: EURL.travaux suit le "travaux" SCCV tant que non touché
  useEffect(() => {
    const sccvTravaux = sccv.prixRenovM2 * sccv.surfaceM2;
    if (!eurlTravauxTouched && eurl.travaux !== sccvTravaux) {
      setEurl((prev) => ({ ...prev, travaux: sccvTravaux }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sccv.prixRenovM2, sccv.surfaceM2, eurlTravauxTouched]);

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 max-w-md mx-auto">
      <Tabs active={tab} onChange={setTab} />
      {tab === "sccv" ? (
        <CalculateurSCCV sccv={sccv} setSccv={setSccv} />
      ) : (
        <CalculateurEURL
          eurl={eurl}
          setEurl={setEurl}
          markTravauxTouched={() => setEurlTravauxTouched(true)}
        />
      )}
    </div>
  );
}
