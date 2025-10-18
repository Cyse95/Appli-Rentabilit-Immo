import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

/* -------------------------------------------------------
   Calculette investissement immo
   - Onglets : SCCV / EURL / TRAVAUX (chiffrage via drawer)
   - Prix catalogue = "Moyen" uniquement
   - Catalogue chargé live depuis Google Sheets (CSV)
   - Export (PDF/Excel) : même sélecteur pour tous les boutons "Export"
-------------------------------------------------------- */

type TabKey = "sccv" | "eurl" | "travaux";
type Level = "Bas" | "Moyen" | "Haut";

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

type CatalogueItem = {
  categorie: string;
  sousPoste: string;
  unite: string;
  prix: { bas: number; moyen: number; haut: number };
  note?: string;
};

type ChiffrageRow = {
  categorie?: string;
  sousPoste?: string;
  unite?: string;
  qte: number;
  prixUnitaire: number; // auto = "moyen"
  coeffLocal: number;
  totalHT: number;
  commentaires?: string;
};

type TravauxState = {
  rows: ChiffrageRow[];
  tva: number; // ex: 0.10
};

/* ---------- Utils ---------- */
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

/* ---------- Catalogue (live depuis Google Sheets) ---------- */
const SHEET_ID = "1RqfPjc9r-jFrZksmYb5tOwTfjKbgY8Sx4BORMsVwZXo";
const SHEET_GID = "1104107230";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

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
function TravauxTab({
  travaux,
  setTravaux,
  catalogue,
  openExportSelector,
  chiffrageAnchorRef,
  synthRef,
}: {
  travaux: TravauxState;
  setTravaux: (t: TravauxState) => void;
  catalogue: CatalogueItem[];
  openExportSelector: () => void;
  chiffrageAnchorRef: React.RefObject<HTMLDivElement>;
  synthRef: React.RefObject<HTMLDivElement>;
}) {
  const { rows, tva } = travaux;

  const CATS = useMemo(
    () => Array.from(new Set(catalogue.map((c) => c.categorie))),
    [catalogue]
  );
  const sousByCat = useMemo(() => {
    const m: Record<string, CatalogueItem[]> = {};
    catalogue.forEach((it) => (m[it.categorie] ||= []).push(it));
    return m;
  }, [catalogue]);

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
  const ttc = useMemo(() => totalHT + ttva, [totalHT, ttva]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const emptyDraft: ChiffrageRow = { qte: 0, prixUnitaire: 0, coeffLocal: 1, totalHT: 0, commentaires: "" };
  const [draft, setDraft] = useState<ChiffrageRow>(emptyDraft);

  const openNew = () => { setEditIndex(null); setDraft(emptyDraft); setDrawerOpen(true); };
  const openEdit = (i: number) => { setEditIndex(i); setDraft(rows[i]); setDrawerOpen(true); };
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!draft.categorie || !draft.sousPoste) return;
    const item = sousByCat[draft.categorie]?.find((x) => x.sousPoste === draft.sousPoste);
    if (!item) return;
    const pu = item.prix.moyen || 0; // UNIQUEMENT prix moyen
    const q = Number(draft.qte) || 0;
    const k = Number(draft.coeffLocal) || 1;
    setDraft((d) => ({ ...d, unite: item.unite, prixUnitaire: pu, totalHT: q * pu * k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.categorie, draft.sousPoste, draft.qte, draft.coeffLocal]);

  const saveDraft = () => {
    const row = { ...draft };
    if (editIndex === null) setTravaux({ ...travaux, rows: [...rows, row] });
    else {
      const copy = [...rows]; copy[editIndex] = row;
      setTravaux({ ...travaux, rows: copy });
    }
    setDrawerOpen(false);
  };

  const removeRow = (i: number) =>
    setTravaux({ ...travaux, rows: rows.filter((_, idx) => idx !== i) });

  return (
    <>
      {/* CHIFFRAGE (liste minimaliste) */}
      <div ref={chiffrageAnchorRef}>
        <Card className="mb-4 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
          <CardHeader className="pb-1 flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                TRAVAUX – Chiffrage
              </CardTitle>
              <div className="mt-1 min-w-0 text-[12px] text-slate-600">
                Lignes : <span className="font-semibold text-slate-800">{rows.length}</span>
                <span className="ml-3">
                  Total HT : <span className="font-semibold text-indigo-700">€ {fmt(totalHT)}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openExportSelector}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs shadow hover:bg-indigo-700"
                data-html2canvas-ignore
                title="Export"
              >
                Export
              </button>
              <button
                onClick={openNew}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
                data-html2canvas-ignore
                aria-label="Ajouter une ligne"
                title="Ajouter une ligne"
              >
                +
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-2 py-2 w-[28%]">Catégorie</th>
                    <th className="px-2 py-2 w-[52%]">Sous-poste</th>
                    <th className="px-2 py-2 w-[12%] text-right">Total HT (€)</th>
                    <th className="px-2 py-2 w-[8%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="px-2 py-2">{r.categorie || "—"}</td>
                      <td className="px-2 py-2">{r.sousPoste || "—"}</td>
                      <td className="px-2 py-2 text-right">€ {fmt(r.totalHT)}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="text-xs px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100"
                            onClick={() => openEdit(i)}
                            data-html2canvas-ignore
                          >
                            Éditer
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded-md border border-slate-200 hover:bg-red-50 hover:border-red-300 text-red-600"
                            onClick={() => removeRow(i)}
                            data-html2canvas-ignore
                          >
                            Suppr.
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-2 py-4 text-slate-500" colSpan={4}>
                        Aucune ligne. Clique sur “+” pour ajouter une ligne.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SYNTHÈSE */}
      <div ref={synthRef}>
        <Card className="shadow-sm border-slate-200 bg-white/90 backdrop-blur">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-semibold text-slate-900">Synthèse</CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5">
            <div id="travaux-synth">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-separate border-spacing-y-1">
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
                      <td className="px-2 py-1 font-semibold">TVA (taux)</td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-2">
                          <span>€ {fmt(ttva)}</span>
                          <span className="text-slate-500 text-[11px]">
                            (taux {fmt(travaux.tva * 100)} %)
                          </span>
                        </div>
                      </td>
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawer vertical (recentré, padding intérieur) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50" data-html2canvas-ignore>
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div className="absolute top-0 right-0 h-full w-[420px] bg-white shadow-2xl p-4">
            <div className="h-full w-full overflow-y-auto">
              <div className="mx-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-lg font-semibold">{editIndex === null ? "Nouvelle ligne" : "Modifier la ligne"}</div>
                  <button
                    className="px-2 py-1 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
                    onClick={closeDrawer}
                  >
                    Fermer
                  </button>
                </div>

                {/* Sélection Catégorie / Sous-poste */}
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-slate-600">Catégorie</Label>
                    <select
                      className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm bg-white"
                      value={draft.categorie || ""}
                      onChange={(e) => {
                        const cat = e.target.value || undefined;
                        const firstSous = cat ? sousByCat[cat]?.[0]?.sousPoste : undefined;
                        setDraft((d) => ({ ...d, categorie: cat, sousPoste: firstSous, commentaires: d.commentaires || "" }));
                      }}
                    >
                      <option value="">—</option>
                      {CATS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Sous-poste</Label>
                    <select
                      className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm bg-white"
                      value={draft.sousPoste || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, sousPoste: e.target.value || undefined }))}
                      disabled={!draft.categorie}
                    >
                      <option value="">{draft.categorie ? "—" : "Choisir catégorie"}</option>
                      {(draft.categorie ? sousByCat[draft.categorie] || [] : []).map((sp) => (
                        <option key={sp.sousPoste} value={sp.sousPoste}>{sp.sousPoste}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Champs numériques */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Num label="Quantité" value={draft.qte} onChange={(v) => setDraft((d) => ({ ...d, qte: v }))} />
                  <Num label="Coeff. local" value={draft.coeffLocal ?? 1} onChange={(v) => setDraft((d) => ({ ...d, coeffLocal: v || 1 }))} />
                  <TextField label="Unité (auto)" value={draft.unite || ""} onChange={() => {}} />
                  <TextField label="Prix unitaire (moyen, auto)" value={String(draft.prixUnitaire || 0)} onChange={() => {}} />
                  <TextField label="Total HT (auto)" value={`€ ${fmt(draft.totalHT)}`} onChange={() => {}} />
                </div>

                {/* Commentaires */}
                <div className="mt-3">
                  <Label className="text-xs text-slate-600">Commentaires</Label>
                  <Input
                    className="bg-white/60 h-8 px-2 py-1"
                    value={draft.commentaires ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, commentaires: e.target.value }))}
                    placeholder="Notes internes, précisions..."
                  />
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50" onClick={closeDrawer}>Annuler</button>
                  <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700" onClick={saveDraft}>Enregistrer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------ EURL ------------ */
function CalculateurEURL({
  eurl,
  setEurl,
  sccvTravaux,
  cardRef,
  onExportClick,
}: {
  eurl: EURLState;
  setEurl: (s: EURLState) => void;
  sccvTravaux: number;
  cardRef: React.RefObject<HTMLDivElement>;
  onExportClick: () => void; // <= même fonction partout
}) {
  const caTotal = useMemo(() => eurl.travaux, [eurl.travaux]);
  const coutMat = useMemo(() => (eurl.travaux * eurl.matPct) / 100, [eurl.travaux, eurl.matPct]);
  const coutMO = useMemo(() => (eurl.travaux * eurl.moPct) / 100, [eurl.travaux, eurl.moPct]);
  const coutAutres = useMemo(() => (eurl.travaux * eurl.caAutresPct) / 100, [eurl.travaux, eurl.caAutresPct]);
  const benefBrut = useMemo(() => caTotal - (coutMat + coutMO + coutAutres), [caTotal, coutMat, coutMO, coutAutres]);
  const impots = useMemo(() => Math.max(benefBrut, 0) * (eurl.tauxIS / 100), [benefBrut, eurl.tauxIS]);
  const benefNet = useMemo(() => benefBrut - impots, [benefBrut, impots]);

  useEffect(() => {
    if (!eurl.manualTravaux && eurl.travaux !== sccvTravaux) {
      setEurl({ ...eurl, travaux: sccvTravaux });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sccvTravaux, eurl.manualTravaux]);

  return (
    <div ref={cardRef}>
      <Card className="mb-4 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-1 flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">
            EURL – Rentabilité brute
          </CardTitle>
          <button
            onClick={onExportClick}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs shadow hover:bg-indigo-700"
            data-html2canvas-ignore
            title="Export"
          >
            Export
          </button>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
}

/* ------------ SCCV ------------ */
function CalculateurSCCV({
  sccv,
  setSccv,
  cardRef,
  onExportClick,
}: {
  sccv: SCCVState;
  setSccv: (s: SCCVState) => void;
  cardRef: React.RefObject<HTMLDivElement>;
  onExportClick: () => void; // <= même fonction partout
}) {
  const travaux = useMemo(() => sccv.prixRenovM2 * sccv.surfaceM2, [sccv.prixRenovM2, sccv.surfaceM2]);
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
    <div ref={cardRef}>
      <Card className="mb-4 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-1 flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">
            SCCV – Marchand de biens
          </CardTitle>
          <button
            onClick={onExportClick}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs shadow hover:bg-indigo-700"
            data-html2canvas-ignore
            title="Export"
          >
            Export
          </button>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 gap-2">
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
            <Kpi label="Rdt brut projet" value={`${fmt(rendementBrutGlobal)} %`} />
            <Kpi label="Rdt net projet" value={`${fmt(rendementNetGlobal)} %`} />
            <Kpi label="Net sur apport" value={`${fmt(rendementApport)} %`} />
          </div>
        </CardContent>
      </Card>
    </div>
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

  // ---- Catalogue (live) ----
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
      } catch (_e) { /* fallback silencieux */ }
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
  const travauxChiffrageRef = useRef<HTMLDivElement>(null);
  const travauxSynthRef = useRef<HTMLDivElement>(null);

  type ExportTargets = {
    sccv: boolean;
    eurl: boolean;
    travauxSynth: boolean;
    travauxChiffrage: boolean;
  };
  const defaultTargetsByTab: Record<TabKey, ExportTargets> = {
    sccv: { sccv: true, eurl: false, travauxSynth: false, travauxChiffrage: false },
    eurl: { sccv: false, eurl: true, travauxSynth: false, travauxChiffrage: false },
    travaux: { sccv: false, eurl: false, travauxSynth: true, travauxChiffrage: true },
  };
  const [showExport, setShowExport] = useState(false);
  const [targets, setTargets] = useState<ExportTargets>(defaultTargetsByTab[tab]);
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

    const addCloned = (ref?: React.RefObject<HTMLDivElement>, title?: string, sanitize = true) => {
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
    if (targets.travauxSynth) addCloned(travauxSynthRef, "TRAVAUX – Synthèse");
    if (targets.travauxChiffrage) {
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

  // EXPORT EXCEL (formules + 1 onglet / section)
  const runExcelExport = () => {
    const wb = XLSX.utils.book_new();

    // SCCV sheet
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

    // EURL sheet
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

    // TRAVAUX sheet (toutes colonnes + formules)
    {
      const header = ["Catégorie","Sous-poste","Unité","Qté","Prix unitaire (€)","Coeff","Total (€)","Commentaires"];
      const body = travaux.rows.map((r) => [
        r.categorie ?? "",
        r.sousPoste ?? "",
        r.unite ?? "",
        r.qte || 0,
        r.prixUnitaire || 0,
        r.coeffLocal || 1,
        null, // formule après
        r.commentaires ?? "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([header, ...body] as any);
      // Formule Total = D * E * F (par ligne)
      for (let i = 0; i < body.length; i++) {
        const rowIndex = 2 + i; // 1-based + header
        const cell = XLSX.utils.encode_cell({ r: i + 1, c: 6 }); // colonne G (index 6)
        (ws as any)[cell] = { t: "n", f: `D${rowIndex}*E${rowIndex}*F${rowIndex}` };
      }
      // Total général (à la fin)
      const totalRow = body.length + 2;
      const totalCell = XLSX.utils.encode_cell({ r: totalRow - 1, c: 6 });
      (ws as any)[totalCell] = { t: "n", f: `SUM(G2:G${totalRow - 1})` };
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" data-html2canvas-ignore>
          <div className="bg-white rounded-2xl shadow-xl w-[380px] p-4">
            <div className="text-lg font-semibold text-slate-900 mb-2">Export</div>
            <div className="text-sm text-slate-600 mb-3">Choisis les pages à inclure :</div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={targets.sccv} onChange={(e) => setTargets({ ...targets, sccv: e.target.checked })} />
                <span>SCCV – Marchand de biens</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={targets.eurl} onChange={(e) => setTargets({ ...targets, eurl: e.target.checked })} />
                <span>EURL – Rentabilité brute</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={targets.travauxSynth} onChange={(e) => setTargets({ ...targets, travauxSynth: e.target.checked })} />
                <span>TRAVAUX – Synthèse</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={targets.travauxChiffrage} onChange={(e) => setTargets({ ...targets, travauxChiffrage: e.target.checked })} />
                <span>TRAVAUX – Chiffrage</span>
              </label>
            </div>
            <div className="mt-4 border-t pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeExcel} onChange={(e) => setIncludeExcel(e.target.checked)} />
                <span>Inclure un export Excel (avec formules, 1 onglet/section)</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50" onClick={() => setShowExport(false)}>Annuler</button>
              <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700" onClick={runExport}>Export</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3" data-html2canvas-ignore>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Calculette investissement immo
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3" data-html2canvas-ignore>
          {(["sccv","eurl","travaux"] as TabKey[]).map((k) => (
            <button
              key={k}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                tab === k ? "bg-indigo-600 text-white border-indigo-600 shadow"
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
            chiffrageAnchorRef={travauxChiffrageRef}
            synthRef={travauxSynthRef}
          />
        )}

        <footer className="mt-4 text-[10px] text-slate-500">
          Accent principal: <span className="text-indigo-600 font-medium">indigo</span>. Fond: slate/zinc.
        </footer>
      </div>
    </div>
  );
}
