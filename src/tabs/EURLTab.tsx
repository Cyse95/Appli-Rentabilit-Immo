
import type React from "react";
import { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/card";
import { Input } from "../components/input";
import { Label } from "../components/label";
import type { EURLState } from "../App";

type Props = {
  eurl: EURLState;
  setEurl: (s: EURLState) => void;
  sccvTravaux: number;
  cardRef: React.RefObject<HTMLDivElement>;
  onExportClick: () => void;
};

const CalculateurEURL = ({ eurl, setEurl, sccvTravaux, cardRef, onExportClick }: Props) => {
  const set = (patch: Partial<EURLState>) => setEurl({ ...eurl, ...patch });
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR",{ maximumFractionDigits: 2 }).format(n || 0);

  const coutMat = eurl.travaux * (eurl.matPct/100);
  const coutMO = eurl.travaux * (eurl.moPct/100);
  const coutAutres = eurl.travaux * (eurl.caAutresPct/100);
  const benefBrut = eurl.travaux - (coutMat + coutMO + coutAutres);
  const impots = Math.max(benefBrut,0) * (eurl.tauxIS/100);
  const benefNet = benefBrut - impots;

  return (
    <div ref={cardRef}>
      <Card className="shadow-sm border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-1 flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">EURL – Rentabilité</CardTitle>
          <button onClick={onExportClick} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs shadow" data-html2canvas-ignore>Export</button>
        </CardHeader>
        <CardContent className="pt-2 grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>CA (Travaux) €</Label>
            <Input
              value={eurl.travaux}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ travaux: parseFloat(e.target.value || "0") })}
            />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox"
                checked={!eurl.manualTravaux}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ manualTravaux: !e.target.checked, travaux: !e.target.checked ? eurl.travaux : sccvTravaux })}
              />
              Répliquer le coût travaux de l’onglet SCCV ({fmt(sccvTravaux)} €)
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>% Matériaux</Label>
              <Input value={eurl.matPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ matPct: parseFloat(e.target.value || "0") })} />
            </div>
            <div>
              <Label>% Main d'œuvre</Label>
              <Input value={eurl.moPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ moPct: parseFloat(e.target.value || "0") })} />
            </div>
            <div>
              <Label>% Autres frais</Label>
              <Input value={eurl.caAutresPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ caAutresPct: parseFloat(e.target.value || "0") })} />
            </div>
            <div>
              <Label>Taux IS (%)</Label>
              <Input value={eurl.tauxIS} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ tauxIS: parseFloat(e.target.value || "0") })} />
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border p-2">Coût matériaux: <b>€ {fmt(coutMat)}</b></div>
            <div className="rounded-xl border p-2">Coût MO: <b>€ {fmt(coutMO)}</b></div>
            <div className="rounded-xl border p-2">Autres coûts: <b>€ {fmt(coutAutres)}</b></div>
            <div className="rounded-xl border p-2">Bénéfice brut: <b>€ {fmt(benefBrut)}</b></div>
            <div className="rounded-xl border p-2">Impôts IS: <b>€ {fmt(impots)}</b></div>
            <div className="rounded-xl border p-2">Bénéfice net: <b>€ {fmt(benefNet)}</b></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CalculateurEURL;
