"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, FileUp, AlertTriangle, BookOpen, ListChecks, FileText, Video, ExternalLink, Info, type LucideIcon } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { analyserImportCsv } from "@/lib/lms-import";
import { importerCoursCsv } from "@/app/app/aide-formation/import-actions";

const initial = { ok: false } as { ok: boolean; message?: string };

const MODELE_CSV =
  "cours;categorie;niveau;description;lecon;type;contenu;duree\n" +
  "Prise en main;Découverte;debutant;Premiers pas sur EduWeb Planner;Bienvenue;texte;Bienvenue dans ce cours d'introduction.;5\n" +
  "Prise en main;Découverte;debutant;;Tutoriel vidéo;video;https://www.youtube.com/watch?v=ID;8\n" +
  "Prise en main;Découverte;debutant;;Documentation officielle;lien;https://exemple.org/doc;3\n" +
  "Prise en main;Découverte;debutant;;Quiz de validation;quiz;;5\n";

const ICONE_TYPE: Record<string, LucideIcon> = {
  texte: FileText, video: Video, lien: ExternalLink, quiz: ListChecks,
};

function telechargerModele() {
  // BOM UTF-8 + séparateur « ; » → Excel FR ouvre directement en colonnes avec accents corrects.
  const blob = new Blob(["﻿" + MODELE_CSV], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "modele-import-cours.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImportClient() {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [etat, action] = useActionState(importerCoursCsv, initial);
  // Réinitialise à chaque succès DISTINCT (chaque appel renvoie un nouvel objet `etat`).
  const dernierTraite = useRef<typeof initial>(initial);

  const analyse = useMemo(() => (texte.trim() ? analyserImportCsv(texte) : null), [texte]);

  useEffect(() => {
    if (etat.ok && dernierTraite.current !== etat) {
      dernierTraite.current = etat;
      setTexte(""); setNomFichier("");
      router.refresh();
    }
  }, [etat, router]);

  const lireFichier = async (f: File | undefined) => {
    if (!f) return;
    const contenu = await f.text();
    setTexte(contenu);
    setNomFichier(f.name);
  };

  const importable = analyse?.ok && analyse.cours.length > 0;

  return (
    <div className="space-y-5">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      {/* Source */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white shadow-soft hover:bg-forest-700">
            <FileUp size={15} /> Choisir un fichier CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; lireFichier(f); }} />
          </label>
          <button type="button" onClick={telechargerModele} className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-2 text-xs font-semibold text-forest-800 hover:bg-forest-50">
            <Download size={14} /> Modèle CSV
          </button>
          {nomFichier && <span className="text-xs text-ink-700/60">{nomFichier}</span>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-forest-900">…ou collez le contenu CSV</label>
          <textarea
            value={texte}
            onChange={(e) => { setTexte(e.target.value); setNomFichier(""); }}
            rows={5}
            placeholder="cours;categorie;niveau;description;lecon;type;contenu;duree"
            className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        <p className="flex items-start gap-1.5 rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-700/70">
          <Info size={14} className="mt-0.5 shrink-0" />
          Colonnes : <strong>cours</strong> et <strong>lecon</strong> obligatoires ; <em>categorie, niveau (debutant/intermediaire/avance), description, type (texte/video/lien/quiz), contenu (Markdown ou URL), duree</em> facultatives. Les lignes d&apos;un même cours se suivent. Séparateur ; ou , (détecté). Enregistrez en « CSV UTF-8 ».
        </p>
      </div>

      {/* Aperçu */}
      {analyse && !analyse.ok && (
        <FormAlert ton="erreur">{analyse.messageFatal}</FormAlert>
      )}

      {analyse?.ok && (
        <div className="space-y-3 rounded-2xl border border-cream-200 bg-cream-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 font-semibold text-forest-800"><BookOpen size={14} /> {analyse.cours.length} cours</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 font-semibold text-forest-700"><ListChecks size={14} /> {analyse.totalLecons} leçon(s)</span>
            {analyse.nbErreurs > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700"><AlertTriangle size={14} /> {analyse.nbErreurs} erreur(s)</span>}
            {analyse.nbAvertissements > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 font-semibold text-gold-800"><AlertTriangle size={14} /> {analyse.nbAvertissements} avertissement(s)</span>}
          </div>

          {analyse.messages.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-white p-3 text-xs">
              {analyse.messages.map((m, i) => (
                <li key={i} className={`flex items-start gap-1.5 ${m.niveau === "erreur" ? "text-red-700" : "text-gold-800"}`}>
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span><strong>L.{m.ligne}</strong> — {m.message}</span>
                </li>
              ))}
            </ul>
          )}

          {analyse.cours.length > 0 && (
            <ul className="space-y-2">
              {analyse.cours.map((c, i) => (
                <li key={i} className="rounded-xl bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-forest-900">{c.titre}</span>
                    {c.categorie && <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-forest-800">{c.categorie}</span>}
                    {c.niveau && <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[11px] text-ink-700/70">{c.niveau}</span>}
                    <span className="text-xs text-ink-700/50">{c.lecons.length} leçon(s)</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.lecons.map((l, j) => {
                      const Icone = ICONE_TYPE[l.type] ?? FileText;
                      return (
                        <span key={j} className="inline-flex items-center gap-1 rounded-lg bg-cream-100 px-2 py-0.5 text-[11px] text-ink-700/75" title={l.type}>
                          <Icone size={11} /> {l.titre}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Confirmation */}
      <form action={action} className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 pt-4">
        <input type="hidden" name="texte" value={texte} />
        <label className="inline-flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" name="publier" className="accent-forest-600" />
          Publier directement (sinon importé en brouillon)
        </label>
        <SubmitButton className="w-auto px-6" disabled={!importable}>
          <Upload size={15} /> Importer{importable ? ` ${analyse!.cours.length} cours` : ""}
        </SubmitButton>
      </form>
    </div>
  );
}
