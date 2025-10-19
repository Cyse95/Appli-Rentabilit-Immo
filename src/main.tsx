
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import html2pdf from "html2pdf.js";
import CalculateurEURL from "./tabs/EURLTab";
import CalculateurSCCV from "./tabs/SCCVTab";
import TravauxTab from "./tabs/TravauxTab";
import ExportDialog from "./components/ExportDialog";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // garde-le si tu utilises Tailwind ou un style global

// Monte l'application React sur la div#root de index.html
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

