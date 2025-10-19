
type Targets = { sccv: boolean; eurl: boolean; travaux: boolean; synth: boolean };
export default function ExportDialog({
  targets, setTargets, includeExcel, setIncludeExcel, onExportPdf, onExportExcel, onClose
}: {
  targets: Targets;
  setTargets: (t: Targets)=>void;
  includeExcel: boolean;
  setIncludeExcel: (v: boolean)=>void;
  onExportPdf: ()=>void;
  onExportExcel: ()=>void;
  onClose: ()=>void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" data-html2canvas-ignore>
      <div className="bg-white rounded-2xl shadow-xl w-[380px] p-4">
        <div className="text-lg font-semibold text-slate-900 mb-2">Export</div>
        <div className="text-sm text-slate-600 mb-3">Choisis les pages à inclure :</div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={targets.sccv} onChange={(e)=>setTargets({ ...targets, sccv: e.target.checked })} />
            <span>SCCV – Marchand de biens</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={targets.eurl} onChange={(e)=>setTargets({ ...targets, eurl: e.target.checked })} />
            <span>EURL – Rentabilité brute</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={targets.travaux} onChange={(e)=>setTargets({ ...targets, travaux: e.target.checked })} />
            <span>Travaux – Chiffrage</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={targets.synth} onChange={(e)=>setTargets({ ...targets, synth: e.target.checked })} />
            <span>Synthèse</span>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeExcel} onChange={(e)=>setIncludeExcel(e.target.checked)} />
            <span>Inclure Excel</span>
          </label>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-md bg-slate-100" onClick={onClose}>Annuler</button>
            <button className="px-3 py-1.5 rounded-md bg-slate-900 text-white" onClick={()=>{ onExportPdf(); if (includeExcel) onExportExcel(); }}>Exporter</button>
          </div>
        </div>
      </div>
    </div>
  );
}
