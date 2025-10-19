
import type React from "react";

type Targets = { sccv: boolean; eurl: boolean; synth: boolean; travaux: boolean };

export default function ExportDialog({
  targets, setTargets,
  includeExcel, setIncludeExcel,
  onConfirm, onClose,
}: {
  targets: Targets;
  setTargets: (t: Targets) => void;
  includeExcel: boolean;
  setIncludeExcel: (v: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" data-html2canvas-ignore>
      <div className="bg-white rounded-2xl shadow-xl w-[380px] p-4">
        <div className="text-lg font-semibold mb-2">Exporter</div>

        <div className="space-y-2 text-sm">
          {([["sccv","SCCV"],["eurl","EURL"],["synth","TRAVAUX – Synthèse"],["travaux","TRAVAUX – Chiffrage"]] as [keyof Targets,string][]).map(([key,label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={targets[key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargets({ ...targets, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}

          <hr className="my-2"/>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeExcel}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeExcel(e.target.checked)}
            />
            Export Excel en plus du PDF
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50" onClick={onClose}>Annuler</button>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm" onClick={onConfirm}>Exporter</button>
        </div>
      </div>
    </div>
  );
}
