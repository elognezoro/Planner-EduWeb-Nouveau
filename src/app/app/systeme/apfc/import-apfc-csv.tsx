"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileDown, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { importerApfcCSV } from "@/lib/formation/actions";
import { analyserImportApfc } from "@/lib/apfc-import";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

const initial = { ok: false } as { ok: boolean; message?: string };

/** Modèle CSV proposé au téléchargement (BOM UTF-8 + séparateur « ; » — Excel FR). */
function telechargerModele(terme: string) {
  const nomExemple = appliquerTermeApfc("APFC", terme);
  const entete = "nom;region";
  const exemples = [`${nomExemple} d'Abidjan;Abidjan`, `${nomExemple} de Bouaké;Vallée du Bandama`];
  const csv = [entete, ...exemples].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-apfc.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const LIBELLE_STATUT: Record<string, { texte: string; classe: string; Icone: typeof CheckCircle2 }> = {
  ok: { texte: "Valide", classe: "text-forest-700", Icone: CheckCircle2 },
  avertissement: { texte: "Sans région", classe: "text-gold-800", Icone: AlertTriangle },
  erreur: { texte: "Erreur", classe: "text-red-600", Icone: AlertTriangle },
  doublon: { texte: "Doublon", classe: "text-ink-700/50", Icone: Info },
};

/**
 * Dépôt d'APFC en lot par glisser/déposer (ou collage) d'un CSV, avec aperçu ligne à ligne
 * (valides / avertissements / erreurs) AVANT import. Miroir du dépôt de cohorte CAFOP
 * (src/app/app/systeme/cafop/[id]/configurer-cafop.tsx) pour le style, avec un aperçu
 * client (à l'image de src/app/app/aide-formation/gestion/import/import-client.tsx).
 */
export function ImportApfcCSV({ regions, terme = "APFC" }: { regions: { id: string; nom: string }[]; terme?: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(importerApfcCSV, initial);
  const [texte, setTexte] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [survole, setSurvole] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const dernierTraite = useRef<typeof initial>(initial);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  const analyse = useMemo(() => (texte.trim() ? analyserImportApfc(texte, regions) : null), [texte, regions]);

  useEffect(() => {
    if (etat.ok && dernierTraite.current !== etat) {
      dernierTraite.current = etat;
      setTexte("");
      setNomFichier("");
      router.refresh();
    }
  }, [etat, router]);

  const chargerFichier = async (fichier: File | undefined) => {
    if (!fichier) return;
    const contenu = await fichier.text();
    setTexte(contenu);
    setNomFichier(fichier.name);
  };

  const importable = Boolean(analyse?.ok && analyse.nbValides > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-forest-900">{T("Importer des APFC (CSV)")}</p>
        <button
          type="button"
          onClick={() => telechargerModele(terme)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-semibold text-forest-800 hover:bg-cream-100"
        >
          <FileDown size={13} /> Télécharger le modèle
        </button>
      </div>

      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div
        onDragOver={(e) => { e.preventDefault(); setSurvole(true); }}
        onDragLeave={() => setSurvole(false)}
        onDrop={(e) => { e.preventDefault(); setSurvole(false); void chargerFichier(e.dataTransfer.files[0]); }}
        onClick={() => fichierRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fichierRef.current?.click(); } }}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          survole ? "border-forest-400 bg-forest-50" : "border-cream-300 bg-cream-50/60 hover:border-forest-300"
        }`}
      >
        <Upload size={20} className="mx-auto mb-1 text-forest-500" />
        <p className="text-sm font-medium text-forest-900">Glissez-déposez le fichier CSV ici</p>
        <p className="text-xs text-ink-700/55">ou cliquez pour parcourir{nomFichier ? ` · ${nomFichier}` : ""}</p>
      </div>
      <input
        ref={fichierRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => { void chargerFichier(e.target.files?.[0]); e.target.value = ""; }}
      />

      <p className="text-xs text-ink-700/60">
        Colonnes : <code>nom</code> (obligatoire), <code>region</code> (nom de la direction régionale — facultatif,
        rapproché automatiquement du référentiel du pays consulté, insensible à la casse et aux accents). Séparateur
        « ; » ou « , » (détecté automatiquement). UTF-8, avec ou sans BOM.
      </p>

      <textarea
        value={texte}
        onChange={(e) => { setTexte(e.target.value); setNomFichier(""); }}
        rows={3}
        placeholder={`Ou collez le CSV ici…\nnom;region\n${T("APFC")} d'Abidjan;Abidjan`}
        className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />

      {/* Aperçu — valides / erreurs AVANT import */}
      {analyse && !analyse.ok && <FormAlert ton="erreur">{analyse.messageFatal}</FormAlert>}

      {analyse?.ok && (
        <div className="space-y-2 rounded-2xl border border-cream-200 bg-cream-50/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-2.5 py-1 font-semibold text-forest-800">
              <CheckCircle2 size={13} /> {analyse.nbValides} importable(s)
            </span>
            {analyse.nbAvertissements > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 font-semibold text-gold-800">
                <AlertTriangle size={13} /> {analyse.nbAvertissements} sans région
              </span>
            )}
            {analyse.nbErreurs > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
                <AlertTriangle size={13} /> {analyse.nbErreurs} erreur(s)
              </span>
            )}
            {analyse.nbDoublons > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-2.5 py-1 font-semibold text-ink-700/70">
                <Info size={13} /> {analyse.nbDoublons} doublon(s) dans le fichier
              </span>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-cream-100 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-cream-50">
                <tr className="border-b border-cream-200 text-left font-semibold uppercase tracking-wide text-ink-700/55">
                  <th className="px-2.5 py-1.5">L.</th>
                  <th className="px-2.5 py-1.5">Nom</th>
                  <th className="px-2.5 py-1.5">Région</th>
                  <th className="px-2.5 py-1.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {analyse.lignes.map((l, i) => {
                  const s = LIBELLE_STATUT[l.statut];
                  return (
                    <tr key={i} className="border-b border-cream-100 last:border-0">
                      <td className="px-2.5 py-1.5 text-ink-700/50">{l.ligne}</td>
                      <td className="px-2.5 py-1.5 font-medium text-forest-900">{l.nom || "—"}</td>
                      <td className="px-2.5 py-1.5 text-ink-700/70">
                        {l.regionNom ?? (l.regionSaisie ? `« ${l.regionSaisie} » ?` : "—")}
                      </td>
                      <td className={`px-2.5 py-1.5 ${s.classe}`} title={l.message ?? undefined}>
                        <span className="inline-flex items-center gap-1">
                          <s.Icone size={12} /> {s.texte}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form action={action} className="flex justify-end">
        <input type="hidden" name="texte" value={texte} />
        <SubmitButton className="w-auto px-6" disabled={!importable}>
          <Upload size={14} /> {importable ? `Importer ${analyse!.nbValides} APFC` : "Importer"}
        </SubmitButton>
      </form>
    </div>
  );
}
