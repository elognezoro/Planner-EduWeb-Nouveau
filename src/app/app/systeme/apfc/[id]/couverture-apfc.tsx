"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2, Upload, FileDown, Loader2, Check, X, AlertTriangle, CheckCircle2, Info, HelpCircle } from "lucide-react";
import {
  ajouterCouvertureApfc,
  retirerCouvertureApfc,
  importerCouverturesApfcCSV,
  previsualiserImportCouvertureApfc,
  type EtatForm,
} from "@/lib/formation/actions";
import type { AnalyseImportCouvertureApfc } from "@/lib/apfc-couverture-import";
import { SelecteurEtabCascade, type EtabCascade } from "@/app/app/systeme/comptes/selecteur-etab-cascade";
import { rechercherEtablissementsPaysAction } from "@/app/app/systeme/comptes/recherche-action";
import { FormAlert, SubmitButton } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export interface CouvertureVue {
  /** Identifiant du rattachement (`CouvertureApfc.id`), pas de l'établissement. */
  id: string;
  etablissementId: string;
  nom: string;
  ville: string | null;
  code: string | null;
}

const LIBELLE_STATUT: Record<string, { texte: string; classe: string; Icone: typeof CheckCircle2 }> = {
  ok: { texte: "Valide", classe: "text-forest-700", Icone: CheckCircle2 },
  erreur: { texte: "Introuvable", classe: "text-red-600", Icone: AlertTriangle },
  doublon: { texte: "Doublon", classe: "text-ink-700/50", Icone: Info },
  deja_couvert: { texte: "Déjà couvert", classe: "text-gold-700", Icone: AlertTriangle },
  ambigu: { texte: "Ambigu", classe: "text-gold-700", Icone: HelpCircle },
};

/** Ligne du tableau — retrait en 2 CLICS (jamais de window.confirm) : « Retirer » → Confirmer/Annuler. */
function LigneCouverture({ c, pending, onRetirer }: { c: CouvertureVue; pending: boolean; onRetirer: () => void }) {
  const [confirme, setConfirme] = useState(false);
  return (
    <tr className="border-b border-cream-100 last:border-0">
      <td className="px-3 py-2 font-medium text-forest-900">{c.nom}</td>
      <td className="px-3 py-2 text-ink-700/70">{c.ville ?? "—"}</td>
      <td className="px-3 py-2 font-mono text-xs text-ink-700/60">{c.code ?? "—"}</td>
      <td className="px-3 py-2 text-center">
        {confirme ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="text-xs font-medium text-red-700">Retirer ?</span>
            <button type="button" disabled={pending} onClick={onRetirer} title="Confirmer" className="rounded-lg p-1 text-red-600 hover:bg-red-50 disabled:opacity-50">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button type="button" onClick={() => setConfirme(false)} title="Annuler" className="rounded-lg p-1 text-ink-700/50 hover:bg-cream-100">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button type="button" disabled={pending} onClick={() => setConfirme(true)} title={`Retirer ${c.nom}`} className="text-ink-700/40 hover:text-red-600 disabled:opacity-50">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * Dépôt du CSV — même UX que l'import du personnel (glisser/déposer, collage, aperçu ligne à
 * ligne, modèle téléchargeable). Différence : le répertoire des établissements (41 000+ au total)
 * est bien trop volumineux pour être expédié au client — le rapprochement est donc rejoué CÔTÉ
 * SERVEUR à chaque changement de texte (anti-rebond) via `previsualiserImportCouvertureApfc`.
 */
function ImportCouvertureCSV({ apfcId }: { apfcId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(importerCouverturesApfcCSV, initial);
  const [texte, setTexte] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [survole, setSurvole] = useState(false);
  const [analyse, setAnalyse] = useState<AnalyseImportCouvertureApfc | null>(null);
  const [enCours, setEnCours] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const dernierTraite = useRef<typeof initial>(initial);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le déclenchement de l'analyse (mise à « en cours », remise à zéro si le texte est vidé) est
  // posé directement dans les gestionnaires d'événement (onChange du textarea, dépôt de fichier)
  // — jamais synchroniquement dans le corps de l'effet, qui ne fait que la requête différée.
  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (!texte.trim()) return;
    minuteur.current = setTimeout(async () => {
      try {
        const r = await previsualiserImportCouvertureApfc(apfcId, texte);
        setAnalyse(r);
      } finally {
        setEnCours(false);
      }
    }, 400);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [texte, apfcId]);

  useEffect(() => {
    if (etat.ok && dernierTraite.current !== etat) {
      dernierTraite.current = etat;
      setTexte("");
      setNomFichier("");
      setAnalyse(null);
      router.refresh();
    }
  }, [etat, router]);

  /** Bascule l'indicateur « analyse en cours » / vide l'aperçu — appelé depuis les gestionnaires
   * d'événement (jamais depuis l'effet, qui ne fait que la requête différée). */
  function noterChangementTexte(v: string) {
    if (!v.trim()) {
      setAnalyse(null);
      setEnCours(false);
    } else {
      setEnCours(true);
    }
  }

  const chargerFichier = async (fichier: File | undefined) => {
    if (!fichier) return;
    const contenu = await fichier.text();
    setTexte(contenu);
    setNomFichier(fichier.name);
    noterChangementTexte(contenu);
  };

  const telechargerModele = () => {
    const entete = "code;nom;ville";
    const exemples = [`CI-ABJ-0012;EPP Cocody Centre;Abidjan`, `;Collège Moderne Bingerville;Bingerville`];
    const csv = [entete, ...exemples].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-etablissements-couverts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importable = Boolean(analyse?.ok && analyse.nbValides > 0);

  return (
    <div className="mt-3 space-y-3 border-t border-cream-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-forest-900">Importer les établissements couverts (CSV)</p>
        <button type="button" onClick={telechargerModele} className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-semibold text-forest-800 hover:bg-cream-100">
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
      <input ref={fichierRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void chargerFichier(e.target.files?.[0]); e.target.value = ""; }} />

      <p className="text-xs text-ink-700/60">
        Colonnes : <code>code</code> (prioritaire pour le rapprochement) et/ou <code>nom</code>, avec{" "}
        <code>ville</code> optionnelle pour lever une ambiguïté entre homonymes — rapprochés du répertoire
        du pays, insensible casse/accents. Séparateur « ; » ou « , » (détecté automatiquement).
      </p>

      <textarea
        value={texte}
        onChange={(e) => { setTexte(e.target.value); setNomFichier(""); noterChangementTexte(e.target.value); }}
        rows={3}
        placeholder={"Ou collez le CSV ici…\ncode;nom;ville\nCI-ABJ-0012;EPP Cocody Centre;Abidjan"}
        className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />

      {enCours && (
        <p className="text-xs text-ink-700/55">
          <Loader2 size={12} className="mr-1 inline animate-spin" /> Analyse en cours…
        </p>
      )}
      {analyse && !analyse.ok && <FormAlert ton="erreur">{analyse.messageFatal ?? "CSV invalide."}</FormAlert>}

      {analyse?.ok && (
        <div className="space-y-2 rounded-2xl border border-cream-200 bg-cream-50/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-2.5 py-1 font-semibold text-forest-800">
              <CheckCircle2 size={13} /> {analyse.nbValides} importable(s)
            </span>
            {analyse.nbErreurs > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
                <AlertTriangle size={13} /> {analyse.nbErreurs} introuvable(s)
              </span>
            )}
            {analyse.nbAmbigus > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 font-semibold text-gold-800">
                <HelpCircle size={13} /> {analyse.nbAmbigus} ambigu(s)
              </span>
            )}
            {analyse.nbDejaCouverts > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-2.5 py-1 font-semibold text-gold-800">
                <AlertTriangle size={13} /> {analyse.nbDejaCouverts} déjà couvert(s) ailleurs
              </span>
            )}
            {analyse.nbDoublons > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-2.5 py-1 font-semibold text-ink-700/70">
                <Info size={13} /> {analyse.nbDoublons} doublon(s)
              </span>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-cream-100 bg-white">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-cream-50">
                <tr className="border-b border-cream-200 text-left font-semibold uppercase tracking-wide text-ink-700/55">
                  <th className="px-2.5 py-1.5">L.</th>
                  <th className="px-2.5 py-1.5">Code</th>
                  <th className="px-2.5 py-1.5">Établissement</th>
                  <th className="px-2.5 py-1.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {analyse.lignes.map((l, i) => {
                  const s = LIBELLE_STATUT[l.statut];
                  return (
                    <tr key={i} className="border-b border-cream-100 last:border-0">
                      <td className="px-2.5 py-1.5 text-ink-700/50">{l.ligne}</td>
                      <td className="px-2.5 py-1.5 font-mono text-ink-700/70">{l.saisieCode || "—"}</td>
                      <td className="px-2.5 py-1.5 font-medium text-forest-900">{l.etablissementNom || l.saisieNom || "—"}</td>
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
        <input type="hidden" name="apfcId" value={apfcId} />
        <input type="hidden" name="texte" value={texte} />
        <SubmitButton className="w-auto px-6" disabled={!importable}>
          <Upload size={14} /> {importable ? `Importer ${analyse!.nbValides} établissement(s)` : "Importer"}
        </SubmitButton>
      </form>
    </div>
  );
}

/**
 * Bloc « Établissements couverts » (compétence territoriale de l'antenne) : tableau des
 * établissements rattachés + retrait 2 clics, ajout manuel par recherche (répertoire du pays
 * consulté/effectif) et import CSV en lot. Même style que le bloc « Personnel de l'APFC ».
 */
export function CouvertureApfc({
  apfcId,
  couvertures,
  pays,
}: {
  apfcId: string;
  couvertures: CouvertureVue[];
  pays: string;
}) {
  const router = useRouter();
  const [pendingSuppr, startSuppr] = useTransition();
  const [pendingAjout, startAjout] = useTransition();
  const [selection, setSelection] = useState<EtabCascade | null>(null);
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);

  const trie = useMemo(() => [...couvertures].sort((a, b) => a.nom.localeCompare(b.nom, "fr")), [couvertures]);

  function retirer(id: string) {
    startSuppr(async () => {
      const r = await retirerCouvertureApfc(id);
      if (r.ok) router.refresh();
    });
  }

  function ajouter() {
    if (!selection) return;
    setErreurAjout(null);
    startAjout(async () => {
      const fd = new FormData();
      fd.set("apfcId", apfcId);
      fd.set("etablissementId", selection.id);
      const r = await ajouterCouvertureApfc(initial, fd);
      if (r.ok) {
        setSelection(null);
        router.refresh();
      } else {
        setErreurAjout(r.message ?? "Erreur.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Building2 size={16} className="text-forest-600" />
        <h3 className="font-display text-base font-bold text-forest-900">Établissements couverts</h3>
        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{couvertures.length}</span>
      </div>
      <p className="mb-3 text-sm text-ink-700/60">Établissements sous compétence territoriale de cette antenne.</p>

      {trie.length > 0 && (
        <div className="mb-4 max-h-72 overflow-auto rounded-xl border border-cream-100">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-cream-50">
              <tr className="border-b border-cream-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-3 py-2">Établissement</th>
                <th className="px-3 py-2">Ville</th>
                <th className="px-3 py-2">Code</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {trie.map((c) => (
                <LigneCouverture key={c.id} c={c} pending={pendingSuppr} onRetirer={() => retirer(c.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {erreurAjout && (
        <div className="mb-3">
          <FormAlert ton="erreur">{erreurAjout}</FormAlert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3">
        <div className="min-w-[16rem] flex-1">
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Ajouter un établissement</span>
          <SelecteurEtabCascade
            etabs={null}
            rechercheServeur={(q) => rechercherEtablissementsPaysAction(pays, q)}
            indication="Tapez au moins 2 caractères pour rechercher dans le répertoire."
            selection={selection}
            onChange={setSelection}
            pays={pays}
          />
        </div>
        <button
          type="button"
          disabled={!selection || pendingAjout}
          onClick={ajouter}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          {pendingAjout ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Ajouter
        </button>
      </div>

      <ImportCouvertureCSV apfcId={apfcId} />
    </section>
  );
}
