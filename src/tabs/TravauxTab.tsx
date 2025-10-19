
import type React from "react";
import { useMemo, useState, useEffect, type RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import type { TravauxState, CatalogueItem, ChiffrageRow } from "../App";

/** helpers */
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

/** Champ nombre compact */
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full border rounded-md px-2 py-1"
          value={isFinite(value) ? value : 0}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value || "0"))}
          disabled={disabled}
        />
        {suffix && <span className="text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

/** Petit champ lecture seule */
function TextField({
  label,
  value,
  onChange,
  readOnly = true,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        className="w-full border rounded-md px-2 py-1 bg-white/60"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
        readOnly={readOnly}
      />
    </label>
  );
}

export default function TravauxTab({
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
  chiffrageAnchorRef: RefObject<HTMLDivElement>;
  synthRef: RefObject<HTMLDivElement>;
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
    () =>
      rows.reduce(
        (s, r) => s + (Number.isFinite(r.totalHT) ? r.totalHT : 0),
        0
      ),
    [rows]
  );
  const totalsByCat = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      if (!r.categorie) return;
      map[r.categorie] =
        (map[r.categorie] || 0) +
        (Number.isFinite(r.totalHT) ? r.totalHT : 0);
    });
    return map;
  }, [rows]);
  const ttva = useMemo(() => totalHT * tva, [totalHT, tva]);
  const ttc = useMemo(() => totalHT + ttva, [totalHT, ttva]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const emptyDraft: ChiffrageRow = {
    qte: 0,
    prixUnitaire: 0,
    coeffLocal: 1,
    totalHT: 0,
    commentaires: "",
  };
  const [draft, setDraft] = useState<ChiffrageRow>(emptyDraft);

  const openNew = () => {
    setEditIndex(null);
    setDraft(emptyDraft);
    setDrawerOpen(true);
  };
  const openEdit = (i: number) => {
    setEditIndex(i);
    setDraft(rows[i]);
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!draft.categorie || !draft.sousPoste) return;
    const item = sousByCat[draft.categorie]?.find(
      (x) => x.sousPoste === draft.sousPoste
    );
    if (!item) return;
    const pu = item.prix.moyen || 0; // prix "moyen" uniquement
    const q = Number(draft.qte) || 0;
    const k = Number(draft.coeffLocal) || 1;
    setDraft((d: ChiffrageRow) => ({
      ...d,
      unite: item.unite,
      prixUnitaire: pu,
      totalHT: q * pu * k,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.categorie, draft.sousPoste, draft.qte, draft.coeffLocal]);

  const saveDraft = () => {
    const row = { ...draft };
    if (editIndex === null) setTravaux({ ...travaux, rows: [...rows, row] });
    else {
      const copy = [...rows];
      copy[editIndex] = row;
      setTravaux({ ...travaux, rows: copy });
    }
    setDrawerOpen(false);
  };

  const removeRow = (i: number) =>
    setTravaux({ ...travaux, rows: rows.filter((_, idx) => idx !== i) });

  return (
    <>
      {/* CHIFFRAGE */}
      <div ref={chiffrageAnchorRef}>
        <Card className="mb-4 shadow-sm border-slate-200 bg-white/90 backdrop-blur">
          <CardHeader className="pb-1 flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                TRAVAUX – Chiffrage
              </CardTitle>
              <div className="mt-1 min-w-0 text-[12px] text-slate-600">
                Lignes:{" "}
                <span className="font-semibold text-slate-800">
                  {rows.length}
                </span>
                <span className="ml-3">
                  Total HT:{" "}
                  <span className="font-semibold text-indigo-700">
                    € {fmt(totalHT)}
                  </span>
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
                    <th className="px-2 py-2 w-[12%] text-right">
                      Total HT (€)
                    </th>
                    <th className="px-2 py-2 w-[8%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="px-2 py-2">{r.categorie || "—"}</td>
                      <td className="px-2 py-2">{r.sousPoste || "—"}</td>
                      <td className="px-2 py-2 text-right">
                        € {fmt(r.totalHT)}
                      </td>
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
            <CardTitle className="text-base font-semibold text-slate-900">
              Synthèse
            </CardTitle>
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
                      if (val === 0) return null; // n'afficher que les catégories présentes
                      const pct = totalHT > 0 ? val / totalHT : 0;
                      return (
                        <tr key={c} className="bg-white rounded-xl">
                          <td className="px-2 py-1">{c}</td>
                          <td className="px-2 py-1 font-medium">
                            € {fmt(val)}
                          </td>
                          <td className="px-2 py-1">{fmt(pct * 100)} %</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50">
                      <td className="px-2 py-1 font-semibold">
                        TOTAL TRAVAUX HT
                      </td>
                      <td className="px-2 py-1 font-semibold">
                        € {fmt(totalHT)}
                      </td>
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

      {/* Drawer vertical */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          data-html2canvas-ignore
        >
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[92vw] max-w-[560px] max-h-[86vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">
                {editIndex === null ? "Nouvelle ligne" : "Modifier la ligne"}
              </div>
              <button
                className="px-3 py-1 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
                onClick={closeDrawer}
              >
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              {/* Catégorie */}
              <div>
                <Label className="text-xs text-slate-600">Catégorie</Label>
                <select
                  className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm bg-white"
                  value={draft.categorie || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const cat = e.target.value || undefined;
                    const firstSous = cat
                      ? sousByCat[cat]?.[0]?.sousPoste
                      : undefined;
                    setDraft((d: ChiffrageRow) => ({
                      ...d,
                      categorie: cat,
                      sousPoste: firstSous,
                      commentaires: d.commentaires || "",
                    }));
                  }}
                >
                  <option value="">—</option>
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sous-poste */}
              <div>
                <Label className="text-xs text-slate-600">Sous-poste</Label>
                <select
                  className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm bg-white"
                  value={draft.sousPoste || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraft((d: ChiffrageRow) => ({
                      ...d,
                      sousPoste: e.target.value || undefined,
                    }))
                  }
                  disabled={!draft.categorie}
                >
                  <option value="">
                    {draft.categorie ? "—" : "Choisir catégorie"}
                  </option>
                  {(draft.categorie ? sousByCat[draft.categorie] || [] : []).map(
                    (sp) => (
                      <option key={sp.sousPoste} value={sp.sousPoste}>
                        {sp.sousPoste}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Quantités */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Num
                  label="Quantité"
                  value={draft.qte}
                  onChange={(v) =>
                    setDraft((d: ChiffrageRow) => ({ ...d, qte: v }))
                  }
                />
                <Num
                  label="Coeff. local"
                  value={draft.coeffLocal ?? 1}
                  onChange={(v) =>
                    setDraft((d: ChiffrageRow) => ({
                      ...d,
                      coeffLocal: v || 1,
                    }))
                  }
                />
              </div>

              {/* Auto (lecture seule) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField label="Unité (auto)" value={draft.unite || ""} />
                <TextField
                  label="Prix unitaire (moyen, auto)"
                  value={String(draft.prixUnitaire || 0)}
                />
                <TextField
                  label="Total HT (auto)"
                  value={`€ ${fmt(draft.totalHT)}`}
                />
              </div>

              {/* Commentaires */}
              <div>
                <Label className="text-xs text-slate-600">Commentaires</Label>
                <Input
                  className="bg-white/60 h-10 px-3"
                  value={draft.commentaires ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDraft((d: ChiffrageRow) => ({
                      ...d,
                      commentaires: e.target.value,
                    }))
                  }
                  placeholder="Notes internes, précisions..."
                />
              </div>

              {/* Actions */}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                  onClick={closeDrawer}
                >
                  Annuler
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  onClick={saveDraft}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
