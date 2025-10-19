
import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/card";
import { Input } from "../components/input";
import { Label } from "../components/label";
import type { SCCVState } from "../App";

type Props = {
  sccv: SCCVState;
  setSccv: (s: SCCVState) => void;
  cardRef: React.RefObject<HTMLDivElement>;
  onExportClick: () => void;
};

const CalculateurSCCV = ({ sccv, setSccv, cardRef, onExportClick }: Props) => {
  const set = (patch: Partial<SCCVState>) => setSccv({ ...sccv, ...patch });
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR",{ maximumFractionDigits: 2 }).format(n || 0);

  const travaux = sccv.prixRenovM2 * sccv.surfaceM2;
  const base = sccv.bien + travaux;
  const apport = base * (sccv.apportPct/100);
  const baseMoinsApport = base - apport;
  const chargeCredit = baseMoinsApport * (sccv.chargeCreditPct/100);
  const fraisDossier = baseMoinsApport * (sccv.fraisDossierPct/100);
  const fraisAgence = base * (sccv.fraisAgencePct/100);
  const coutProjet = sccv.bien + travaux + fraisAgence + fraisDossier + chargeCredit;
  const totalApresApport = coutProjet - apport;
  const prixRevente = sccv.surfaceM2 * sccv.prixReventeM2;
  const margeBrute = prixRevente - coutProjet + apport;

  return (
    <div ref={cardRef}>
      <Card className="shadow-sm border-slate-200 bg-white/90 backdrop-blur">
        <CardHeader className="pb-1 flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">SCCV – Marchand de biens</CardTitle>
          <button onClick={onExportClick} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs shadow" data-html2canvas-ignore>Export</button>
        </CardHeader>
        <CardContent className="pt-2 grid gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Prix d'achat (Bien) €</Label>
              <Input value={sccv.bien} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ bien: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Prix rénovation (€/m²)</Label>
              <Input value={sccv.prixRenovM2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ prixRenovM2: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Surface (m²)</Label>
              <Input value={sccv.surfaceM2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ surfaceM2: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Prix revente (€/m²)</Label>
              <Input value={sccv.prixReventeM2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ prixReventeM2: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Apport (%)</Label>
              <Input value={sccv.apportPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ apportPct: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Charge crédit (%)</Label>
              <Input value={sccv.chargeCreditPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ chargeCreditPct: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Frais dossier (%)</Label>
              <Input value={sccv.fraisDossierPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ fraisDossierPct: parseFloat(e.target.value || "0") })}/>
            </div>
            <div>
              <Label>Frais agence (%)</Label>
              <Input value={sccv.fraisAgencePct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ fraisAgencePct: parseFloat(e.target.value || "0") })}/>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border p-2">Travaux: <b>€ {fmt(travaux)}</b></div>
            <div className="rounded-xl border p-2">Base: <b>€ {fmt(base)}</b></div>
            <div className="rounded-xl border p-2">Apport: <b>€ {fmt(apport)}</b></div>
            <div className="rounded-xl border p-2">Frais agence: <b>€ {fmt(fraisAgence)}</b></div>
            <div className="rounded-xl border p-2">Frais dossier: <b>€ {fmt(fraisDossier)}</b></div>
            <div className="rounded-xl border p-2">Charges crédit: <b>€ {fmt(chargeCredit)}</b></div>
            <div className="rounded-xl border p-2">Coût projet: <b>€ {fmt(coutProjet)}</b></div>
            <div className="rounded-xl border p-2">Total après apport: <b>€ {fmt(totalApresApport)}</b></div>
            <div className="rounded-xl border p-2">Prix revente: <b>€ {fmt(prixRevente)}</b></div>
            <div className="rounded-xl border p-2">Marge brute: <b>€ {fmt(margeBrute)}</b></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalculateurSCCV;
