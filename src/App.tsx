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
  suffix?: st
