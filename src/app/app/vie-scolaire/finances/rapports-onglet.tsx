"use client";

/**
 * Onglet RAPPORTS (18) — moteur de restitution : catalogue unifié groupé par catégorie
 * (filtré par le RBAC côté serveur), aperçu interactif à la demande, impression A4/A3
 * (portrait/paysage selon le rapport, en-tête institutionnel), exports CSV/JSON respectant
 * les droits. Aucune donnée recréée : tout est dérivé des sous-modules.
 */

import { useState, useTransition } from "react";
import { Download, FileBarChart, FileText, Loader2, Printer, X } from "lucide-react";
import { Card } from "@/components/app/ui";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { genererRapportApercu } from "@/lib/finances/actions-rapports";
import {
  LIBELLE_CATEGORIE_RAPPORT, type ColonneRapport, type RapportDefinition, type RapportGenere,
} from "@/lib/finances/rapports/catalogue";
import type { EnteteEtablissement } from "./finances-vue";
import { fcfa } from "./types";

function formater(valeur: string | number | null, format: ColonneRapport["format"]): string {
  if (valeur === null || valeur === undefined || valeur === "") return format === "fcfa" || format === "nombre" ? "0" : "";
  if (format === "fcfa") return typeof valeur === "number" ? fcfa(valeur) : String(valeur);
  if (format === "nombre") return typeof valeur === "number" ? valeur.toLocaleString("fr-FR") : String(valeur);
  if (format === "pourcent") return `${valeur} %`;
  if (format === "date") {
    const d = new Date(String(valeur));
    return Number.isNaN(d.getTime()) ? String(valeur) : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
  }
  return String(valeur);
}
const aligneDroite = (f: ColonneRapport["format"]) => f === "fcfa" || f === "nombre" || f === "pourcent";

export function OngletRapports({
  etablissementId, catalogue, entete,
}: {
  etablissementId: string;
  catalogue: RapportDefinition[];
  entete: EnteteEtablissement;
}) {
  const [rapport, setRapport] = useState<RapportGenere | null>(null);
  const [codeSelection, setCodeSelection] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [impression, setImpression] = useState(false);
  const [pending, startTransition] = useTransition();

  const categories = [...new Set(catalogue.map((r) => r.categorie))];

  function ouvrir(def: RapportDefinition) {
    setCodeSelection(def.code);
    setMessage(null);
    startTransition(async () => {
      const r = await genererRapportApercu({ etablissementId, code: def.code });
      if (r.ok && r.rapport) setRapport(r.rapport);
      else { setRapport(null); setMessage(r.message ?? "Génération impossible."); }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileBarChart size={18} className="text-forest-600" /> Catalogue des rapports
        </h2>
        <p className="mt-1 text-xs text-ink-700/60">
          {catalogue.length} rapport(s) accessible(s) selon votre profil. Les rapports sont dérivés
          en temps réel des données validées ; les exports respectent vos droits.
        </p>
        {message && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>}

        <div className="mt-4 space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">{LIBELLE_CATEGORIE_RAPPORT[cat] ?? cat}</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {catalogue.filter((r) => r.categorie === cat).map((def) => (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => ouvrir(def)}
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      codeSelection === def.code ? "border-forest-700 bg-forest-50" : "border-cream-200 bg-white hover:bg-cream-100"
                    }`}
                  >
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-900">
                      <FileText size={14} className="text-forest-600" /> {def.nom}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-700/60">{def.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {(pending || rapport) && (
        <Card>
          {pending && !rapport ? (
            <p className="inline-flex items-center gap-2 text-sm text-ink-700/60"><Loader2 size={15} className="animate-spin" /> Génération…</p>
          ) : rapport ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-forest-900">{rapport.titre}</h3>
                  <p className="text-xs text-ink-700/60">{rapport.sousTitre} · généré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(rapport.genereLe))}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setImpression(true)} className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                    <Printer size={13} /> Imprimer (A4/A3)
                  </button>
                  <a href={`/api/finances/rapport?code=${rapport.code}&format=csv`} className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                    <Download size={13} /> CSV
                  </a>
                  <a href={`/api/finances/rapport?code=${rapport.code}&format=json`} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">
                    <Download size={13} /> JSON
                  </a>
                </div>
              </div>
              <TableRapport rapport={rapport} />
            </div>
          ) : null}
        </Card>
      )}

      {impression && rapport && <RapportImprimable rapport={rapport} entete={entete} onFermer={() => setImpression(false)} />}
    </div>
  );
}

function TableRapport({ rapport }: { rapport: RapportGenere }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
            {rapport.colonnes.map((c) => (
              <th key={c.cle} className={`px-2 py-2 ${aligneDroite(c.format) ? "text-right" : ""}`}>{c.libelle}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rapport.lignes.length === 0 ? (
            <tr><td colSpan={rapport.colonnes.length} className="px-2 py-3 text-sm text-ink-700/60">Aucune donnée pour ce rapport.</td></tr>
          ) : (
            rapport.lignes.map((row, i) => (
              <tr key={i} className="border-b border-cream-100">
                {rapport.colonnes.map((c) => (
                  <td key={c.cle} className={`px-2 py-1.5 ${aligneDroite(c.format) ? "text-right" : ""}`}>{formater(row[c.cle], c.format)}</td>
                ))}
              </tr>
            ))
          )}
          {rapport.totaux && (
            <tr className="border-t-2 border-forest-200 font-bold">
              {rapport.colonnes.map((c) => (
                <td key={c.cle} className={`px-2 py-2 ${aligneDroite(c.format) ? "text-right" : ""}`}>{formater(rapport.totaux![c.cle], c.format)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RapportImprimable({ rapport, entete, onFermer }: { rapport: RapportGenere; entete: EnteteEtablissement; onFermer: () => void }) {
  const taille = rapport.orientation === "paysage" ? "A4 landscape" : "A4 portrait";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`@media print { body * { visibility: hidden; } #rapport-impression, #rapport-impression * { visibility: visible; } #rapport-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; overflow: visible; } @page { size: ${taille}; margin: 12mm; } }`}</style>
      <div id="rapport-impression" className="mx-auto my-8 w-full max-w-5xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Aperçu avant impression</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer"><X size={16} /></button>
        </div>
        <EnTeteOfficielDoc etab={entete} titre={rapport.titre.toUpperCase()} sousTitre={rapport.sousTitre} />
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y-2 border-forest-800 text-left uppercase tracking-wide">
              {rapport.colonnes.map((c) => (
                <th key={c.cle} className={`py-1.5 pr-2 ${aligneDroite(c.format) ? "text-right" : ""}`}>{c.libelle}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rapport.lignes.map((row, i) => (
              <tr key={i} className="border-b border-cream-200">
                {rapport.colonnes.map((c) => (
                  <td key={c.cle} className={`py-1 pr-2 ${aligneDroite(c.format) ? "text-right" : ""}`}>{formater(row[c.cle], c.format)}</td>
                ))}
              </tr>
            ))}
            {rapport.totaux && (
              <tr className="border-t-2 border-forest-800 font-bold">
                {rapport.colonnes.map((c) => (
                  <td key={c.cle} className={`py-2 pr-2 ${aligneDroite(c.format) ? "text-right" : ""}`}>{formater(rapport.totaux![c.cle], c.format)}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-4 text-[10px] text-ink-700/50">
          Généré le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(rapport.genereLe))} — EduWeb Planner.
        </p>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"><Printer size={16} /> Imprimer / PDF</button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
        </div>
      </div>
    </div>
  );
}
