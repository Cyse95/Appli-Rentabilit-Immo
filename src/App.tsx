import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)

function Num({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v:number)=>void; suffix?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label style={{ display: 'block', fontSize: 12, color: '#555' }}>{label}</Label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e)=> onChange(parseFloat(e.target.value.replace(',', '.')) || 0)}
          style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8, width: 220 }}
        />
        {suffix && <span style={{ fontSize: 12, color: '#777' }}>{suffix}</span>}
      </div>
    </div>
  )
}

export default function App() {
  // Entrées principales
  const [prix, setPrix] = useState(150000)
  const [frais, setFrais] = useState(10000)
  const [travaux, setTravaux] = useState(60000)
  const [apport, setApport] = useState(20000)
  const [taux, setTaux] = useState(4.2) // % annuel
  const [duree, setDuree] = useState(20) // années
  const [margeCiblePct, setMargeCiblePct] = useState(12) // % du coût total

  const coutTotal = useMemo(()=> prix + frais + travaux, [prix, frais, travaux])
  const emprunt = useMemo(()=> Math.max(coutTotal - apport, 0), [coutTotal, apport])

  // Mensualité (amortissement classique)
  const mensualite = useMemo(()=> {
    const i = (taux/100) / 12
    const n = duree * 12
    if (i === 0) return emprunt / n
    return emprunt * (i * Math.pow(1+i, n)) / (Math.pow(1+i, n) - 1)
  }, [emprunt, taux, duree])

  const prixDeVenteCible = useMemo(()=> Math.ceil(coutTotal * (1 + margeCiblePct/100)), [coutTotal, margeCiblePct])
  const margeBrute = useMemo(()=> Math.max(prixDeVenteCible - coutTotal, 0), [prixDeVenteCible, coutTotal])
  const coutMensuel = useMemo(()=> mensualite, [mensualite])

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Appli Rentabilité Immo – Version Défilante (prototype)</h1>
      <p style={{ color: '#555', marginBottom: 24 }}>Renseigne les paramètres puis fais défiler pour voir les KPI. Tout est calculé en direct.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <CardHeader><CardTitle>Acquisition & travaux</CardTitle></CardHeader>
          <CardContent>
            <Num label="Prix du bien (€)" value={prix} onChange={setPrix} suffix="€" />
            <Num label="Frais (notaire, agence...) (€)" value={frais} onChange={setFrais} suffix="€" />
            <Num label="Travaux (€)" value={travaux} onChange={setTravaux} suffix="€" />
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <strong>Coût total :</strong> {fmt(coutTotal)} €
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financement</CardTitle></CardHeader>
          <CardContent>
            <Num label="Apport (€)" value={apport} onChange={setApport} suffix="€" />
            <Num label="Taux (%)" value={taux} onChange={setTaux} suffix="%" />
            <Num label="Durée (années)" value={duree} onChange={setDuree} />
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div><strong>Emprunt :</strong> {fmt(emprunt)} €</div>
              <div><strong>Mensualité estimée :</strong> {fmt(coutMensuel)} € / mois</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Objectif de marge</CardTitle></CardHeader>
          <CardContent>
            <Num label="Marge cible (%)" value={margeCiblePct} onChange={setMargeCiblePct} suffix="%" />
            <div style={{ marginTop: 12, fontSize: 14 }}>
              <div><strong>Prix de vente cible :</strong> {fmt(prixDeVenteCible)} €</div>
              <div><strong>Marge brute :</strong> {fmt(margeBrute)} €</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Résumé</CardTitle></CardHeader>
          <CardContent>
            <ul style={{ lineHeight: 1.8, paddingLeft: 16 }}>
              <li>Coût total projet : <strong>{fmt(coutTotal)} €</strong></li>
              <li>Apport : <strong>{fmt(apport)} €</strong></li>
              <li>Emprunt : <strong>{fmt(emprunt)} €</strong></li>
              <li>Mensualité : <strong>{fmt(coutMensuel)} €</strong></li>
              <li>Prix de vente cible (marge {margeCiblePct}%): <strong>{fmt(prixDeVenteCible)} €</strong></li>
              <li>Marge brute : <strong>{fmt(margeBrute)} €</strong></li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div style={{ marginTop: 32, fontSize: 12, color: '#777' }}>
        <p>Prototype minimal. Ajuste librement les formules selon tes besoins (SCCV/EURL, frais détaillés, travaux, IS, etc.).</p>
      </div>
    </div>
  )
}