import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/card";
import { Input } from "../components/input";
import { Label } from "../components/label";

export default function CalculateurEURL({
  eurl,
  setEurl,
  sccvTravaux,
  cardRef,
  onExportClick,
}: any) {
  const handleChange = (field: string, value: number) => {
    setEurl((prev: any) => ({ ...prev, [field]: value }));
  };

  const mat = (eurl.travaux * eurl.matPct) / 100;
  const mo = (eurl.travaux * eurl.moPct) / 100;
  const autres = (eurl.travaux * eurl.caAutresPct) / 100;
  const benefBrut = eurl.travaux - (mat + mo + autres);
  const impots = benefBrut * (eurl.tauxIS / 100);
  const benefNet = benefBrut - impots;

  return (
    <div ref={cardRef} className="transition-all">
      <Card className="shadow-md border rounded-2xl">
        <CardHeader className="flex flex-row justify-between items-center border-b pb-3">
          <CardTitle className="text-lg font-semibold tracking-tight">
            EURL – Rentabilité
          </CardTitle>
          <button
            onClick={onExportClick}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            Export
          </button>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {/* Bloc des entrées */}
          <section>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Entrées</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CA (Travaux) avec checkbox à droite du titre */}
              <div>
                <Label
                  htmlFor="travaux"
                  className="text-sm font-medium flex items-center justify-between"
                >
                  <span>CA (Travaux) €</span>

                  {/* ✅ coche = saisie manuelle (déverrouille le champ) */}
                  <label className="inline-flex items-center gap-2 text-xs font-normal text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!eurl.manualTravaux}
                      onChange={(e) =>
                        setEurl((prev: any) => ({
                          ...prev,
                          manualTravaux: e.target.checked,
                        }))
                      }
                    />
                    Saisie manuelle
                  </label>
                </Label>

                <Input
                  id="travaux"
                  type="number"
                  value={eurl.travaux}
                  onChange={(e) =>
                    handleChange("travaux", parseFloat(e.target.value) || 0)
                  }
                  disabled={!eurl.manualTravaux}   // 🔒 verrouillé si suivi SCCV
                  readOnly={!eurl.manualTravaux}
                  className={!eurl.manualTravaux ? "opacity-60 cursor-not-allowed" : ""}
                />

                {/* Indication du suivi SCCV lorsqu'on est verrouillé */}
                {!eurl.manualTravaux && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Suivi SCCV actif — valeur actuelle : {sccvTravaux.toLocaleString()} €
                  </div>
                )}
              </div>

              <div>
                <Label>% Matériaux</Label>
                <Input
                  type="number"
                  value={eurl.matPct}
                  onChange={(e) =>
                    handleChange("matPct", parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div>
                <Label>% Main d'œuvre</Label>
                <Input
                  type="number"
                  value={eurl.moPct}
                  onChange={(e) =>
                    handleChange("moPct", parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div>
                <Label>% Autres frais</Label>
                <Input
                  type="number"
                  value={eurl.caAutresPct}
                  onChange={(e) =>
                    handleChange("caAutresPct", parseFloat(e.target.value) || 0)
                  }
                />
              </div>

              <div>
                <Label>Taux IS (%)</Label>
                <Input
                  type="number"
                  value={eurl.tauxIS}
                  onChange={(e) =>
                    handleChange("tauxIS", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </section>

          {/* Bloc des résultats */}
          <section>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Résultats</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border text-sm flex justify-between">
                <span>Coût matériaux :</span>
                <span className="font-semibold text-slate-800">
                  € {mat.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border text-sm flex justify-between">
                <span>Coût MO :</span>
                <span className="font-semibold text-slate-800">
                  € {mo.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border text-sm flex justify-between">
                <span>Autres coûts :</span>
                <span className="font-semibold text-slate-800">
                  € {autres.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border text-sm flex justify-between">
                <span>Bénéfice brut :</span>
                <span className="font-semibold text-slate-800">
                  € {benefBrut.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border text-sm flex justify-between">
                <span>Impôts IS :</span>
                <span className="font-semibold text-slate-800">
                  € {impots.toLocaleString()}
                </span>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 border text-sm flex justify-between font-semibold text-indigo-700">
                <span>Bénéfice net :</span>
                <span>€ {benefNet.toLocaleString()}</span>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
