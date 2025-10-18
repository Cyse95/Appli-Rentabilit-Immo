import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import html2pdf from "html2pdf.js";

/* -------------------------------------------------------
   NOUVEL ONGLET : TRAVAUX (catalogue + chiffrage + synthèse)
   - Colonnes A..J comme l’Excel "Chiffrage"
   - Automatisme: Sous-poste dépend de Catégorie
   - Unité & Prix unitaire auto (Bas/Moyen/Haut + "Par défaut")
   - Total HT, % du total, Synthèse par catégorie + TVA/TTC
   - Bouton: Exporter la SYNTHÈSE uniquement en PDF
-------------------------------------------------------- */

type TabKey = "sccv" | "eurl" | "travaux";

type Level = "Bas" | "Moyen" | "Haut";
type RowLevel = "Par défaut" | Level;

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
  const items: TabKey[] = ["sccv", "eurl", "travaux"];
  const labels: Record<TabKey, string> = { sccv: "SCCV", eurl: "EURL", travaux: "TRAVAUX" };
  return (
    <div className="flex gap-2 mb-5" data-html2canvas-ignore>
      {items.map((k) => (
        <button key={k} onClick={() => onChange(k)} className={btn(active === k)}>
          {labels[k]}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold text-slate-900">{children}</h2>
    </div>
  );
}

/* ------------ CATALOGUE (enrichi) ------------ */
type CatalogueItem = {
  categorie: string;
  sousPoste: string;
  unite: string;
  prix: { bas: number; moyen: number; haut: number };
  note?: string;
};

const CATS = [
  "GROS ŒUVRE",
  "SECOND ŒUVRE",
  "FINITIONS",
  "MENUISERIES",
  "TOITURE",
  "EXTÉRIEUR",
  "DIVERS",
] as const;

const CATALOGUE: CatalogueItem[] = [
  // GROS ŒUVRE
  { categorie: "GROS ŒUVRE", sousPoste: "Démolition cloison simple", unite: "m²", prix: { bas: 10, moyen: 15, haut: 25 } },
  { categorie: "GROS ŒUVRE", sousPoste: "Dépose revêtements sol", unite: "m²", prix: { bas: 5, moyen: 8, haut: 12 } },
  { categorie: "GROS ŒUVRE", sousPoste: "Ouverture mur porteur + IPN", unite: "U", prix: { bas: 1500, moyen: 1800, haut: 2400 } },
  { categorie: "GROS ŒUVRE", sousPoste: "Maçonnerie parpaings 20", unite: "m²", prix: { bas: 90, moyen: 120, haut: 150 } },
  { categorie: "GROS ŒUVRE", sousPoste: "Dalle béton armée 10 cm", unite: "m²", prix: { bas: 90, moyen: 100, haut: 130 } },
  { categorie: "GROS ŒUVRE", sousPoste: "Reprise fondations ponctuelles", unite: "ml", prix: { bas: 150, moyen: 220, haut: 300 } },
  { categorie: "GROS ŒUVRE", sousPoste: "Seuil/linteau béton coulé", unite: "U", prix: { bas: 60, moyen: 80, haut: 100 } },
  // SECOND ŒUVRE
  { categorie: "SECOND ŒUVRE", sousPoste: "Isolation murs 120 mm", unite: "m²", prix: { bas: 40, moyen: 45, haut: 55 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Cloison / doublage BA13", unite: "m²", prix: { bas: 55, moyen: 60, haut: 70 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Plafond BA13 suspendu", unite: "m²", prix: { bas: 45, moyen: 55, haut: 65 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Électricité complète", unite: "m²", prix: { bas: 70, moyen: 80, haut: 90 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Remplacement tableau électrique", unite: "U", prix: { bas: 400, moyen: 500, haut: 700 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Réseau RJ45 (prise double)", unite: "U", prix: { bas: 60, moyen: 80, haut: 120 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Plomberie - création SDE", unite: "U", prix: { bas: 3000, moyen: 4500, haut: 6000 } },
  { categorie: "SECOND ŒUVRE", sousPoste: "Chauffe-eau thermodynamique", unite: "U", prix: { bas: 1600, moyen: 1900, haut: 2400 } },
  // FINITIONS
  { categorie: "FINITIONS", sousPoste: "Peinture murs & plafonds", unite: "m²", prix: { bas: 14, moyen: 18, haut: 25 } },
  { categorie: "FINITIONS", sousPoste: "Sols carrelage 60x60", unite: "m²", prix: { bas: 40, moyen: 45, haut: 60 } },
  { categorie: "FINITIONS", sousPoste: "Sols parquet flottant", unite: "m²", prix: { bas: 30, moyen: 35, haut: 45 } },
  { categorie: "FINITIONS", sousPoste: "Sols vinyle", unite: "m²", prix: { bas: 25, moyen: 30, haut: 40 } },
  { categorie: "FINITIONS", sousPoste: "Faïence murale SDB", unite: "m²", prix: { bas: 40, moyen: 50, haut: 65 } },
  { categorie: "FINITIONS", sousPoste: "Cuisine équipée (pose incluse)", unite: "U", prix: { bas: 3000, moyen: 4500, haut: 6000 } },
  { categorie: "FINITIONS", sousPoste: "Escalier bois/acier", unite: "U", prix: { bas: 3000, moyen: 4500, haut: 6000 } },
  // MENUISERIES
  { categorie: "MENUISERIES", sousPoste: "Fenêtre PVC DV 120x135", unite: "U", prix: { bas: 350, moyen: 400, haut: 500 } },
  { categorie: "MENUISERIES", sousPoste: "Porte intérieure alvéolaire", unite: "U", prix: { bas: 100, moyen: 120, haut: 150 } },
  { categorie: "MENUISERIES", sousPoste: "Porte d’entrée acier isolée", unite: "U", prix: { bas: 1000, moyen: 1200, haut: 1400 } },
  { categorie: "MENUISERIES", sousPoste: "Baie vitrée alu coulissante 2V", unite: "U", prix: { bas: 1500, moyen: 1800, haut: 2200 } },
  // TOITURE
  { categorie: "TOITURE", sousPoste: "Réfection couverture tuiles", unite: "m²", prix: { bas: 90, moyen: 110, haut: 130 } },
  { categorie: "TOITURE", sousPoste: "Charpente partielle", unite: "m²", prix: { bas: 110, moyen: 140, haut: 180 } },
  { categorie: "TOITURE", sousPoste: "Isolation combles soufflée 300mm", unite: "m²", prix: { bas: 30, moyen: 35, haut: 45 } },
  { categorie: "TOITURE", sousPoste: "Fenêtre de toit (Velux)", unite: "U", prix: { bas: 700, moyen: 850, haut: 1100 } },
  // EXTÉRIEUR
  { categorie: "EXTÉRIEUR", sousPoste: "Façade enduit gratté fin", unite: "m²", prix: { bas: 55, moyen: 60, haut: 70 } },
  { categorie: "EXTÉRIEUR", sousPoste: "Isolation thermique par l’extérieur", unite: "m²", prix: { bas: 140, moyen: 160, haut: 190 } },
  { categorie: "EXTÉRIEUR", sousPoste: "VRD / terrassement", unite: "m³", prix: { bas: 35, moyen: 40, haut: 50 } },
  { categorie: "EXTÉRIEUR", sousPoste: "Allée béton désactivé", unite: "m²", prix: { bas: 60, moyen: 80, haut: 100 } },
  { categorie: "EXTÉRIEUR", sousPoste: "Clôture rigide 1,50 m", unite: "ml", prix: { bas: 60, moyen: 75, haut: 100 } },
  { categorie: "EXTÉRIEUR", sousPoste: "Portail motorisé alu 3 m", unite: "U", prix: { bas: 2000, moyen: 2500, haut: 3200 } },
  // DIVERS
  { categorie: "DIVERS", sousPoste: "Étude structure (IPN, etc.)", unite: "U", prix: { bas: 700, moyen: 900, haut: 1200 } },
  { categorie: "DIVERS", sousPoste: "Étude thermique / DPE projet", unite: "U", prix: { bas: 300, moyen: 500, haut: 700 } },
  { categorie: "DIVERS", sousPoste: "Bennes / évacuation déchets", unite: "m³", prix: { bas: 30, moyen: 40, haut: 60 } },
];

const SOUS_POSTES_BY_CAT: Record<string, CatalogueItem[]> = CATALOGUE.reduce((acc, it) => {
  (acc[it.categorie] ||= []).push(it);
  return acc;
}, {} as Record<string, CatalogueItem[]>);

/* ------------ Onglet TRAVAUX (Chiffrage + Synthèse) ------------ */
type ChiffrageRow = {
  categorie?: string;      // A
  sousPoste?: string;      // B
  unite?: string;          // C (auto)
  qte: number;             // D
  prixUnitaire: number;    // E (auto selon niveau)
  coeffLocal: number;      // F (x1 par défaut)
  totalHT: number;         // G (auto)
  pct: number;             // H (auto)
  niveau: RowLevel;        // I ("Par défaut" | Bas | Moyen | Haut)
  commentaires?: string;   // J
};

const DEFAULT_LEVEL: Level = "Moyen";
const DEFAULT_TVA = 0.10;
const START_ROWS = 12;

function TravauxTab() {
  const [defaultLevel, setDefaultLevel] = useState<Level>(DEFAULT_LEVEL);
  const [tva, setTva] = useState<number>(DEFAULT_TVA); // 0.10 = 10%
  const [rows, setRows] = useState<ChiffrageRow[]>(
    Array.from({ length: START_ROWS }, () => ({
      qte: 0, prixUnitaire: 0, coeffLocal: 1, totalHT: 0, pct: 0, niveau: "Par défaut",
    }))
  );

  const totalHT = useMemo(
    () => rows.reduce((s, r) => s + (Number.isFinite(r.totalHT) ? r.totalHT : 0), 0),
    [rows]
  );

  const totalsByCat = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      if (!r.categorie) return;
      map[r.categorie] = (map[r.categorie] || 0) + (Number.isFinite(r.totalHT) ? r.totalHT : 0);
    });
    return map;
  }, [rows]);

  const ttva = useMemo(() => totalHT * tva, [totalHT, tva]);
  const ttc  = useMemo(() => totalHT + ttva, [totalHT, ttva]);

  // recalcul d’une ligne (unité + prix selon niveau + total + %)
  const recalcRow = (idx: number, base?: Partial<ChiffrageRow>) => {
    setRows((prev) => {
      const r = { ...prev[idx], ...base };

      // Si catégorie/sous-poste changent → unité + prix tiers
      let item: CatalogueItem | undefined;
      if (r.categorie && r.sousPoste) {
        item = SOUS_POSTES_BY_CAT[r.categorie]?.find((x) => x.sousPoste === r.sousPoste);
        if (item) {
          r.unite = item.unite;
          const level: Level =
            r.niveau === "Par défaut" ? defaultLevel : (r.niveau as Level);
          const p =
            level === "Bas" ? item.prix.bas :
            level === "Haut" ? item.prix.haut : item.prix.moyen;
          r.prixUnitaire = p;
        }
      }

      // Total HT = qte * prix * coeffLocal
      const q = Number(r.qte) || 0;
      const pu = Number(r.prixUnitaire) || 0;
      const k = Number(r.coeffLocal) || 1;
      r.totalHT = q * pu * k;

      // % du total: (on calcule plus tard après avoir la somme globale)
      const copy = [...prev];
      copy[idx] = r;
      const sum = copy.reduce((s, x) => s + (Number.isFinite(x.totalHT) ? x.totalHT : 0), 0);
      copy.forEach((x) => (x.pct = sum > 0 ? x.totalHT / sum : 0));

      return copy;
    });
  };

  const setCell = (idx: number, patch: Partial<ChiffrageRow>) => recalcRow(idx, patch);

  const handleCatChange = (idx: number, cat?: string) => {
    const firstSous = cat ? SOUS_POSTES_BY_CAT[cat]?.[0]?.sousPoste : undefined;
    recalcRow(idx, {
      categorie: cat,
      sousPoste: firstSous,
      unite: undefined,
      prixUnitaire: 0,
    });
  };

  const handleSousChange = (idx: number, sous?: string) => {
    recalcRow(idx, { sousPoste: sous });
  };

  const handleLevelChange = (idx: number, lvl: RowLevel) => {
    recalcRow(idx, { niveau: lvl });
  };

  const addRow = () => {
    setRows((prev) => [...prev, { qte: 0, prixUnitaire: 0, coeffLocal: 1, totalHT: 0, pct: 0, niveau: "Par défaut" }]);
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Export PDF : Synthèse seulement
  const synthRef = useRef<HTMLDivElement>(null);
  const exportSynthPDF = async () => {
    if (!synthRef.current) return;
    const opt = {
      margin: 12,
      filename: `Synthese_Travaux_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2.2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };
    await (html2pdf() as any).set(opt).from(synthRef.current).save();
  };

  // UI helpers
  const levelOptions: RowLevel[] = ["Par défaut", "Bas", "Moyen", "Haut"];

  return (
    <>
      <Card className="mb-6 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-900">
            TRAVAUX – Chiffrage (comme l’onglet Excel)
          </CardTitle>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Niveau prix par défaut</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm bg-white"
                value={defaultLevel}
                onChange={(e) => setDefaultLevel(e.target.value as Level)}
              >
                <option>Bas</option>
                <option>Moyen</option>
                <option>Haut</option>
              </select>
            </div>
            <Num label="TVA (taux)" value={tva * 100} suffix="%" onChange={(v) => setTva((v || 0) / 100)} />
            <div className="flex items-end">
              <button
                onClick={addRow}
                className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
                data-html2canvas-ignore
              >
                + Ajouter une ligne
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* En-têtes A..J */}
          <div className="grid grid-cols-[16ch,26ch,8ch,9ch,14ch,10ch,14ch,12ch,18ch,1fr] text-[12px] font-semibold text-slate-600 px-2">
            <div>Catégorie (A)</div>
            <div>Sous-poste (B)</div>
            <div>Unité (C)</div>
            <div>Qté (D)</div>
            <div>Prix unitaire € (E)</div>
            <div>Coeff (F)</div>
            <div>Total HT € (G)</div>
            <div>% total (H)</div>
            <div>Niveau (I)</div>
            <div>Commentaires (J)</div>
          </div>

          <div className="mt-2 space-y-2">
            {rows.map((r, i) => {
              const sousList = r.categorie ? SOUS_POSTES_BY_CAT[r.categorie] ?? [] : [];
              return (
                <div
                  key={i}
                  className="grid grid-cols-[16ch,26ch,8ch,9ch,14ch,10ch,14ch,12ch,18ch,1fr] items-center gap-2 bg-white rounded-xl border border-slate-200 px-2 py-2"
                >
                  {/* Catégorie */}
                  <div>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
                      value={r.categorie || ""}
                      onChange={(e) => handleCatChange(i, e.target.value || undefined)}
                    >
                      <option value="">—</option>
                      {CATS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sous-poste (dépend de Catégorie) */}
                  <div>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
                      value={r.sousPoste || ""}
                      onChange={(e) => handleSousChange(i, e.target.value || undefined)}
                      disabled={!r.categorie}
                    >
                      <option value="">{r.categorie ? "—" : "Choisir catégorie"}</option>
                      {sousList.map((sp) => (
                        <option key={sp.sousPoste} value={sp.sousPoste}>{sp.sousPoste}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unité (auto) */}
                  <div>
                    <Input
                      className="bg-white/60 text-sm"
                      value={r.unite ?? ""}
                      readOnly
                    />
                  </div>

                  {/* Qté */}
                  <div>
                    <Input
                      inputMode="decimal"
                      className="bg-white/60 text-sm"
                      value={Number.isFinite(r.qte) ? r.qte : 0}
                      onChange={(e) => setCell(i, { qte: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                    />
                  </div>

                  {/* Prix unitaire (auto par niveau) */}
                  <div>
                    <Input
                      className="bg-white/60 text-sm"
                      value={Number.isFinite(r.prixUnitaire) ? r.prixUnitaire : 0}
                      readOnly
                    />
                  </div>

                  {/* Coeff local */}
                  <div>
                    <Input
                      inputMode="decimal"
                      className="bg-white/60 text-sm"
                      value={Number.isFinite(r.coeffLocal) ? r.coeffLocal : 1}
                      onChange={(e) => setCell(i, { coeffLocal: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                    />
                  </div>

                  {/* Total HT (auto) */}
                  <div className="text-sm font-medium">
                    € {fmt(r.totalHT)}
                  </div>

                  {/* % du total (auto) */}
                  <div className="text-sm">{(r.pct * 100 > 0 ? fmt(r.pct * 100) : "0")}%</div>

                  {/* Niveau (Par défaut/Bas/Moyen/Haut) */}
                  <div>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white"
                      value={r.niveau}
                      onChange={(e) => handleLevelChange(i, e.target.value as RowLevel)}
                    >
                      {["Par défaut", "Bas", "Moyen", "Haut"].map((lv) => (
                        <option key={lv} value={lv}>{lv}</option>
                      ))}
                    </select>
                  </div>

                  {/* Commentaires */}
                  <div className="flex items-center gap-2">
                    <Input
                      className="bg-white/60 text-sm"
                      value={r.commentaires ?? ""}
                      onChange={(e) => setCell(i, { commentaires: e.target.value })}
                    />
                    <button
                      className="text-xs px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-50"
                      onClick={() => removeRow(i)}
                      title="Supprimer la ligne"
                      data-html2canvas-ignore
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* SYNTHÈSE (Excel "Synthese") */}
      <Card className="shadow-sm border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">Synthèse</CardTitle>
          <button
            onClick={exportSynthPDF}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm shadow hover:bg-indigo-700"
            data-html2canvas-ignore
          >
            Exporter la synthèse en PDF
          </button>
        </CardHeader>
        <CardContent ref={synthRef}>
          {/* Tableau synthèse par catégorie */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="px-2 py-1">Catégorie</th>
                  <th className="px-2 py-1">Total HT (€)</th>
                  <th className="px-2 py-1">% du total</th>
                </tr>
              </thead>
              <tbody>
                {CATS.map((c) => {
                  const val = totalsByCat[c] || 0;
                  const pct = totalHT > 0 ? val / totalHT : 0;
                  return (
                    <tr key={c} className="bg-white rounded-xl">
                      <td className="px-2 py-1">{c}</td>
                      <td className="px-2 py-1 font-medium">€ {fmt(val)}</td>
                      <td className="px-2 py-1">{fmt(pct * 100)} %</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50">
                  <td className="px-2 py-1 font-semibold">TOTAL TRAVAUX HT</td>
                  <td className="px-2 py-1 font-semibold">€ {fmt(totalHT)}</td>
                  <td className="px-2 py-1" />
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-2 py-1 font-semibold">TVA</td>
                  <td className="px-2 py-1 font-semibold">€ {fmt(ttva)}</td>
                  <td className="px-2 py-1" />
                </tr>
                <tr className="bg-slate-100">
                  <td className="px-2 py-1 font-semibold">TOTAL TTC</td>
                  <td className="px-2 py-1 font-semibold">€ {fmt(ttc)}</td>
                  <td className="px-2 py-1" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Réglages récap synthèse */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kpi label="Niveau par défaut" value={defaultLevel} />
            <Kpi label="TVA" value={`${fmt(tva * 100)} %`} />
            <Kpi label="Total HT calculé" value={`€ ${fmt(totalHT)}`} />
          </div>
        </CardContent>
      </Card>
    </>
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
  const [exporting, setExporting] = useState(false);

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

  // ----- EXPORT PDF global (SCCV/EURL) (inchangé) -----
  const printableRef = useRef<HTMLDivElement>(null);
  const exportPDF = async () => {
    setExporting(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    if (!printableRef.current) { setExporting(false); return; }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `Dossier_SCCV-EURL_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}.pdf`;

    const opt = {
      margin: 12,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2.2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] as const },
    };

    await (html2pdf() as any).set(opt).from(printableRef.current).save();
    setExporting(false);
  };

  const pdfStyles = `
  .pdf-mode{ background:#fff; padding:16px; line-height:1.4; }
  .pdf-mode h1{ font-size:20px; margin:0 0 8px; }
  .pdf-mode h2{ font-size:18px; margin:8px 0 12px; }
  .pdf-mode .rounded-2xl{ box-shadow:none!important; }
  .pdf-mode .border-slate-200{ border-color:#e5e7eb!important; }
  .pdf-mode input{ background:transparent!important; }
  .pdf-mode [data-html2canvas-ignore]{ display:none!important; }
  .html2pdf__page-break{ page-break-before:always; }
  `;

  return (
    <div className="min-h-screen p-6 md:p-8 bg-gradient-to-b from-slate-50 to-zinc-100 text-slate-900">
      <div className="max-w-2xl mx-auto">

        {/* Barre d'action (non incluse dans le PDF) */}
        <div className="flex items-center justify-between mb-4" data-html2canvas-ignore>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Calculateur Rentabilité – SCCV / EURL / TRAVAUX
            </h1>
            <p className="text-sm text-slate-600">Version avec onglet TRAVAUX (chiffrage + synthèse + export PDF synthèse)</p>
          </div>
          <button
            onClick={exportPDF}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm shadow hover:bg-indigo-700"
            title="Exporter SCCV + EURL en PDF"
          >
            Exporter en PDF
          </button>
        </div>

        {/* Tabs écran */}
        <Tabs active={tab} onChange={setTab} />

        {/* ===== Zone visible écran OU dossier PDF ===== */}
        <div ref={printableRef} className={exporting ? "pdf-mode" : ""}>
          {exporting && <style>{pdfStyles}</style>}

          {!exporting && (
            <>
              {tab === "sccv" ? (
                <CalculateurSCCV sccv={sccv} setSccv={setSccv} />
              ) : tab === "eurl" ? (
                <CalculateurEURL eurl={eurl} setEurl={setEurl} sccvTravaux={sccvTravaux} />
              ) : (
                <TravauxTab />
              )}
              <footer className="mt-6 text-[11px] text-slate-500">
                Accent principal: <span className="text-indigo-600 font-medium">indigo</span>. Fond: slate/zinc.
              </footer>
            </>
          )}

          {/* Export PDF global (inchangé) */}
          {exporting && (
            <>
              <h1>Dossier SCCV / EURL – Synthèse</h1>

              <SectionTitle>SCCV – Marchand de biens</SectionTitle>
              <CalculateurSCCV sccv={sccv} setSccv={setSccv} />

              <div className="html2pdf__page-break" />

              <SectionTitle>EURL – Rentabilité brute</SectionTitle>
              <CalculateurEURL eurl={eurl} setEurl={setEurl} sccvTravaux={sccvTravaux} />

              <div className="mt-6 text-[11px] text-slate-500">
                Généré automatiquement – {new Date().toLocaleDateString("fr-FR")}{" "}
                {new Date().toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"})}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
