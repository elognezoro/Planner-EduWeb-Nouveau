"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2, Users, Upload, FileDown, Loader2, Check, X, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  ajouterPersonnelApfc,
  supprimerPersonnelApfc,
  importerPersonnelApfcCSV,
  type EtatForm,
} from "@/lib/formation/actions";
import { analyserImportPersonnelApfc } from "@/lib/apfc-personnel-import";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
// Casse « live » (sans rognage, pour autoriser la saisie d'espaces).
const majLive = (s: string) => s.toUpperCase();
const titreLive = (s: string) => s.toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());

export interface PersonnelApfcVue {
  id: string;
  nom: string;
  prenoms: string | null;
  fonction: string | null;
  disciplines: string[];
  email: string | null;
  telephone: string | null;
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

/**
 * Liste déroulante à choix multiples (cases à cocher) — même mécanique que celle du cahier de
 * texte CAFOP (composantes/thèmes) : bouton compteur qui ouvre un panneau de cases à cocher,
 * fermeture au clic extérieur, un <input type="hidden"> répété par valeur cochée.
 */
function ListeDeroulanteMultiple({
  label,
  name,
  options,
  valeurs,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  valeurs: string[];
  onChange: (v: string[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  function basculer(v: string) {
    onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);
  }

  return (
    <Champ label={label}>
      <div ref={conteneurRef} className="relative">
        {valeurs.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className={`${champCls} flex items-center justify-between text-left`}
        >
          <span className={`truncate ${valeurs.length === 0 ? "text-ink-700/45" : "text-ink-700/85"}`}>
            {valeurs.length === 0 ? "— (aucune)" : `${valeurs.length} sélectionnée${valeurs.length > 1 ? "s" : ""}`}
          </span>
          <ChevronDown size={15} className="shrink-0 text-ink-700/40" />
        </button>
        {ouvert && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-cream-300 bg-white p-1.5 shadow-soft">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-ink-700/55">Aucune discipline au référentiel (Système › Disciplines).</p>
            ) : (
              options.map((o) => (
                <label key={o} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-cream-50">
                  <input type="checkbox" checked={valeurs.includes(o)} onChange={() => basculer(o)} className="h-4 w-4 rounded border-cream-300 text-forest-700 focus:ring-forest-300" />
                  <span className="text-ink-700/85">{o}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </Champ>
  );
}

/** Ligne du tableau — suppression en 2 CLICS (jamais de window.confirm) : « Retirer » → Confirmer/Annuler. */
function LignePersonnel({ p, pending, onSupprimer }: { p: PersonnelApfcVue; pending: boolean; onSupprimer: () => void }) {
  const [confirme, setConfirme] = useState(false);
  const nomComplet = [p.nom, p.prenoms].filter(Boolean).join(" ");
  return (
    <tr className="border-b border-cream-100 last:border-0">
      <td className="px-3 py-2 font-medium text-forest-900">{p.nom}</td>
      <td className="px-3 py-2 text-ink-700/80">{p.prenoms ?? "—"}</td>
      <td className="px-3 py-2 text-ink-700/70">{p.fonction ?? "—"}</td>
      <td className="px-3 py-2">
        {p.disciplines.length === 0 ? (
          <span className="text-ink-700/50">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {p.disciplines.map((d) => (
              <span key={d} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{d}</span>
            ))}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-ink-700/70">
        {p.email ?? "—"}
        {p.telephone && <span className="block text-xs text-ink-700/50">{p.telephone}</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {confirme ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="text-xs font-medium text-red-700">Retirer ?</span>
            <button type="button" disabled={pending} onClick={onSupprimer} title="Confirmer" className="rounded-lg p-1 text-red-600 hover:bg-red-50 disabled:opacity-50">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button type="button" onClick={() => setConfirme(false)} title="Annuler" className="rounded-lg p-1 text-ink-700/50 hover:bg-cream-100">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button type="button" disabled={pending} onClick={() => setConfirme(true)} title={`Retirer ${nomComplet}`} className="text-ink-700/40 hover:text-red-600 disabled:opacity-50">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

const LIBELLE_STATUT: Record<string, { texte: string; classe: string; Icone: typeof CheckCircle2 }> = {
  ok: { texte: "Valide", classe: "text-forest-700", Icone: CheckCircle2 },
  erreur: { texte: "Erreur", classe: "text-red-600", Icone: AlertTriangle },
  doublon: { texte: "Doublon", classe: "text-ink-700/50", Icone: Info },
};

/** Dépôt du personnel par glisser/déposer (ou collage) d'un CSV, avec aperçu ligne à ligne. */
function ImportPersonnelCSV({ apfcId, disciplinesRef, terme }: { apfcId: string; disciplinesRef: string[]; terme: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(importerPersonnelApfcCSV, initial);
  const [texte, setTexte] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [survole, setSurvole] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const dernierTraite = useRef<typeof initial>(initial);

  const analyse = useMemo(() => (texte.trim() ? analyserImportPersonnelApfc(texte, disciplinesRef) : null), [texte, disciplinesRef]);

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

  const telechargerModele = () => {
    const entete = "nom;prenoms;fonction;disciplines;email;telephone";
    const exemples = [
      `KOUAMÉ;Jean Marc;Conseiller pédagogique;Français|Histoire-Géographie;jkouame@exemple.ci;0102030405`,
      `TRAORÉ;Awa;Formateur;Mathématiques;;0708091011`,
    ];
    const csv = [entete, ...exemples].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-personnel-apfc.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importable = Boolean(analyse?.ok && analyse.nbValides > 0);

  return (
    <div className="mt-3 space-y-3 border-t border-cream-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-forest-900">{appliquerTermeApfc("Importer le personnel (CSV)", terme)}</p>
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
        Colonnes : <code>nom</code> (obligatoire), <code>prenoms</code>, <code>fonction</code>, <code>disciplines</code> (plusieurs
        valeurs séparées par « | » ou « / », rapprochées automatiquement du référentiel des disciplines — non reconnues
        conservées telles quelles), <code>email</code>, <code>telephone</code>. Séparateur « ; » ou « , » (détecté automatiquement).
      </p>

      <textarea
        value={texte}
        onChange={(e) => { setTexte(e.target.value); setNomFichier(""); }}
        rows={3}
        placeholder={"Ou collez le CSV ici…\nnom;prenoms;fonction;disciplines;email;telephone\nKOUAMÉ;Jean Marc;Formateur;Français|Histoire-Géographie;;"}
        className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />

      {analyse && !analyse.ok && <FormAlert ton="erreur">{analyse.messageFatal}</FormAlert>}

      {analyse?.ok && (
        <div className="space-y-2 rounded-2xl border border-cream-200 bg-cream-50/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-2.5 py-1 font-semibold text-forest-800">
              <CheckCircle2 size={13} /> {analyse.nbValides} importable(s)
            </span>
            {analyse.nbErreurs > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
                <AlertTriangle size={13} /> {analyse.nbErreurs} erreur(s)
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
                  <th className="px-2.5 py-1.5">Nom</th>
                  <th className="px-2.5 py-1.5">Prénoms</th>
                  <th className="px-2.5 py-1.5">Disciplines</th>
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
                      <td className="px-2.5 py-1.5 text-ink-700/70">{l.prenoms ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-ink-700/70">{l.disciplines.length ? l.disciplines.join(", ") : "—"}</td>
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
          <Upload size={14} /> {importable ? `Importer ${analyse!.nbValides} personne(s)` : "Importer"}
        </SubmitButton>
      </form>
    </div>
  );
}

export function PersonnelApfc({
  apfcId,
  personnel,
  disciplinesRef,
  terme = "APFC",
}: {
  apfcId: string;
  personnel: PersonnelApfcVue[];
  disciplinesRef: string[];
  terme?: string;
}) {
  const router = useRouter();
  const [pendingSuppr, startSuppr] = useTransition();
  const [etatAjout, actionAjout] = useActionState(ajouterPersonnelApfc, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const rafraichi = useRef(false);
  const [disciplinesSel, setDisciplinesSel] = useState<string[]>([]);

  useEffect(() => {
    if (etatAjout.ok && !rafraichi.current) {
      rafraichi.current = true;
      router.refresh();
      formRef.current?.reset();
      setDisciplinesSel([]);
    }
    if (!etatAjout.ok) rafraichi.current = false;
  }, [etatAjout.ok, router]);

  const trie = useMemo(
    () => [...personnel].sort((a, b) => a.nom.localeCompare(b.nom, "fr") || (a.prenoms ?? "").localeCompare(b.prenoms ?? "", "fr")),
    [personnel],
  );

  function supprimer(id: string) {
    startSuppr(async () => {
      const r = await supprimerPersonnelApfc(id);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Users size={16} className="text-forest-600" />
        <h3 className="font-display text-base font-bold text-forest-900">{appliquerTermeApfc("Personnel de l'APFC", terme)}</h3>
        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{personnel.length}</span>
      </div>
      <p className="mb-3 text-sm text-ink-700/60">
        Annuaire selon le profil disciplinaire (conseillers pédagogiques, formateurs…), avec les disciplines rattachées.
      </p>

      {trie.length > 0 && (
        <div className="mb-4 max-h-72 overflow-auto rounded-xl border border-cream-100">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-cream-50">
              <tr className="border-b border-cream-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Prénoms</th>
                <th className="px-3 py-2">Fonction</th>
                <th className="px-3 py-2">Disciplines</th>
                <th className="px-3 py-2">Contact</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {trie.map((p) => (
                <LignePersonnel key={p.id} p={p} pending={pendingSuppr} onSupprimer={() => supprimer(p.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {etatAjout.message && <div className="mb-3"><FormAlert ton={etatAjout.ok ? "succes" : "erreur"}>{etatAjout.message}</FormAlert></div>}
      <form ref={formRef} action={actionAjout} className="grid gap-3 border-t border-cream-100 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="apfcId" value={apfcId} />
        <Champ label="NOM *"><input name="nom" required onChange={(e) => { e.currentTarget.value = majLive(e.currentTarget.value); }} placeholder="KOUAMÉ" className={champCls} /></Champ>
        <Champ label="Prénoms"><input name="prenoms" onChange={(e) => { e.currentTarget.value = titreLive(e.currentTarget.value); }} placeholder="Jean Marc" className={champCls} /></Champ>
        <Champ label="Fonction"><input name="fonction" placeholder="Ex : Conseiller pédagogique" className={champCls} /></Champ>
        <ListeDeroulanteMultiple label="Disciplines" name="disciplines" options={disciplinesRef} valeurs={disciplinesSel} onChange={setDisciplinesSel} />
        <Champ label="E-mail"><input name="email" type="email" placeholder="nom@exemple.ci" className={champCls} /></Champ>
        <Champ label="Téléphone"><input name="telephone" placeholder="01 02 03 04 05" className={champCls} /></Champ>
        <div className="flex items-end sm:col-span-2 lg:col-span-3 lg:justify-end">
          <SubmitButton className="w-auto px-6"><Plus size={15} /> Ajouter</SubmitButton>
        </div>
      </form>

      <ImportPersonnelCSV apfcId={apfcId} disciplinesRef={disciplinesRef} terme={terme} />
    </section>
  );
}
