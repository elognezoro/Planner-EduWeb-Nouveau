"use client";

import { useState, useTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Calculator, Save, Trash2, Plus, Loader2, UserPlus } from "lucide-react";
import {
  calculerClasses,
  enregistrerEffectifsNiveaux,
  genererComptesEleves,
  supprimerNiveau,
  ajouterNiveau,
  type EtatForm,
} from "./config-actions";
import { FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

/**
 * Les deux boutons du bloc : « Enregistrer » sauvegarde les saisies au fur et à mesure ;
 * « Calculer les classes pédagogiques » synchronise les classes quand tout est renseigné.
 * (Enfant du formulaire pour partager l'état d'envoi via useFormStatus.)
 */
function BoutonsNiveaux({ actionCalcul }: { actionCalcul: (fd: FormData) => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-forest-700 disabled:pointer-events-none disabled:opacity-70"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer
      </button>
      <button
        type="submit"
        formAction={actionCalcul}
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-300 bg-white px-6 text-sm font-semibold text-forest-800 transition-all hover:-translate-y-0.5 hover:bg-forest-50 disabled:pointer-events-none disabled:opacity-70"
      >
        <Calculator size={16} /> Calculer les classes pédagogiques
      </button>
    </div>
  );
}

interface LigneNiveau {
  niveauId: string;
  nom: string;
  effectif: number;
  vacation: string;
  nbClasses: number;
}

export function NiveauxForm({
  etablissementId,
  lignes,
  indexation,
}: {
  etablissementId: string;
  lignes: LigneNiveau[];
  /** Indexation des classes : « @ » = lettres (6ème A…), « # » = chiffres (6ème 1…). */
  indexation: string;
}) {
  const [etat, action] = useActionState(calculerClasses, initial);
  const [etatSauvegarde, actionSauvegarde] = useActionState(enregistrerEffectifsNiveaux, initial);
  const [pending, startTransition] = useTransition();
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauCycle, setNouveauCycle] = useState("lycee");
  const [message, setMessage] = useState<string | null>(null);

  const totalClasses = lignes.reduce((acc, l) => acc + l.nbClasses, 0);
  const totalEleves = lignes.reduce((acc, l) => acc + (l.effectif || 0), 0);

  function supprimer(niveauId: string) {
    setMessage(null);
    startTransition(async () => {
      const r = await supprimerNiveau(niveauId, etablissementId);
      if (!r.ok && r.message) setMessage(r.message);
    });
  }
  function ajouter() {
    if (!nouveauNom.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const r = await ajouterNiveau(etablissementId, nouveauNom, nouveauCycle);
      if (r.ok) setNouveauNom("");
      else if (r.message) setMessage(r.message);
    });
  }

  return (
    // Action par défaut : Enregistrer (le calcul passe par le formAction du second bouton).
    <form action={actionSauvegarde} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etatSauvegarde.message && (
        <FormAlert ton={etatSauvegarde.ok ? "succes" : "erreur"}>{etatSauvegarde.message}</FormAlert>
      )}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      {message && <FormAlert ton="erreur">{message}</FormAlert>}

      <div className="relative overflow-x-auto">
        {pending && (
          <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 text-xs text-ink-700/60">
            <Loader2 size={13} className="animate-spin" /> mise à jour…
          </div>
        )}
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left">
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Niveau</th>
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Effectif élèves</th>
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Vacation</th>
              <th className="py-2.5 pr-4 text-right font-semibold text-ink-700/70">Classes</th>
              <th className="w-10 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.niveauId} className="border-b border-cream-100 last:border-0">
                <td className="py-2 pr-4 font-medium text-forest-900">{l.nom}</td>
                <td className="py-2 pr-4">
                  {/* key incluant la valeur serveur : après enregistrement, React remonte
                      le champ avec la valeur persistée (sinon le reset de formulaire des
                      actions serveur ferait « disparaître » la saisie à l'écran). */}
                  <input
                    key={`${l.niveauId}:${l.effectif}`}
                    type="number"
                    name={`effectif_${l.niveauId}`}
                    min={0}
                    defaultValue={l.effectif || ""}
                    placeholder="0"
                    className="h-9 w-28 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </td>
                <td className="py-2 pr-4">
                  <select
                    key={`${l.niveauId}:${l.vacation}`}
                    name={`vacation_${l.niveauId}`}
                    defaultValue={l.vacation}
                    className="h-9 w-28 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  >
                    <option value="simple">Simple</option>
                    <option value="double">Double</option>
                  </select>
                </td>
                <td className="py-2 pr-4 text-right font-semibold text-forest-800">
                  {l.nbClasses || "—"}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => supprimer(l.niveauId)}
                    disabled={pending}
                    title={`Supprimer le niveau ${l.nom}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/45 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    aria-label={`Supprimer ${l.nom}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Ligne d'ajout d'un niveau */}
            <tr>
              <td className="pt-3 pr-4" colSpan={2}>
                <div className="flex gap-2">
                  <input
                    value={nouveauNom}
                    onChange={(e) => setNouveauNom(e.target.value)}
                    placeholder="Nouveau niveau (ex : Tle D, 6ème G…)"
                    className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                  <select
                    value={nouveauCycle}
                    onChange={(e) => setNouveauCycle(e.target.value)}
                    className="h-9 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  >
                    <option value="college">Collège</option>
                    <option value="lycee">Lycée</option>
                  </select>
                </div>
              </td>
              <td className="pt-3 pr-4" colSpan={2}>
                <button
                  type="button"
                  onClick={ajouter}
                  disabled={pending || !nouveauNom.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </td>
              <td />
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-cream-200">
              <td className="py-2.5 pr-4 text-sm font-medium text-ink-700/70">
                Total élèves : <span className="font-bold text-forest-900">{totalEleves}</span>
              </td>
              <td colSpan={2} className="py-2.5 pr-4 text-right text-sm font-medium text-ink-700/70">
                Total des divisions
              </td>
              <td className="py-2.5 pr-4 text-right font-display text-lg font-bold text-forest-900">
                {totalClasses}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Indexation des classes au calcul : « @ » lettres ou « # » chiffres. */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="indexationClasses" className="text-sm font-medium text-forest-900">
          Indexation des classes
        </label>
        <select
          key={`idx:${indexation}`}
          id="indexationClasses"
          name="indexationClasses"
          defaultValue={indexation === "#" ? "#" : "@"}
          className="h-10 rounded-xl border border-cream-300 bg-white px-3 pr-8 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          <option value="@">@ — Lettres (6ème A, 6ème B…)</option>
          <option value="#"># — Chiffres (6ème 1, 6ème 2…)</option>
        </select>
      </div>

      <BoutonsNiveaux actionCalcul={action} />
      <p className="text-xs text-ink-700/55">
        « Enregistrer » sauvegarde les effectifs et vacations au fur et à mesure, sans toucher aux
        classes. « Calculer les classes pédagogiques » synchronise ensuite les classes (effectif du
        niveau ÷ effectif souhaité par classe, arrondi au supérieur) quand tout est renseigné.
        La poubelle retire un niveau et ses classes ; « Ajouter » crée un nouveau niveau.
      </p>

      <GenerationComptesEleves etablissementId={etablissementId} />
    </form>
  );
}

/**
 * Génération des comptes élèves depuis les effectifs : crée les comptes manquants et les
 * répartit dans les classes pédagogiques de chaque niveau. Confirmation en deux temps,
 * hors soumission du formulaire parent (type="button").
 */
function GenerationComptesEleves({ etablissementId }: { etablissementId: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const [retour, setRetour] = useState<EtatForm | null>(null);
  const [enCours, demarrer] = useTransition();

  function generer() {
    if (!confirmation) {
      setConfirmation(true);
      setRetour(null);
      return;
    }
    setConfirmation(false);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      setRetour(await genererComptesEleves({ ok: false }, fd));
    });
  }

  return (
    <div className="border-t border-cream-100 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generer}
          disabled={enCours}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-70 ${
            confirmation
              ? "bg-gold-600 text-white hover:bg-gold-700"
              : "border border-forest-300 bg-white text-forest-800 hover:-translate-y-0.5 hover:bg-forest-50"
          }`}
        >
          {enCours ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {confirmation
            ? "Confirmer : générer les comptes manquants"
            : "Générer les comptes depuis les effectifs"}
        </button>
        {confirmation && (
          <button
            type="button"
            onClick={() => setConfirmation(false)}
            className="text-sm font-medium text-ink-700/60 hover:text-ink-900"
          >
            Annuler
          </button>
        )}
      </div>
      {retour?.message && (
        <p className={`mt-2 text-sm font-medium ${retour.ok ? "text-forest-700" : "text-red-600"}`}>
          {retour.message}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-700/55">
        Crée les comptes élèves manquants d&apos;après l&apos;effectif de chaque niveau et les
        répartit équitablement entre les classes pédagogiques du niveau concerné. Les comptes et
        inscriptions déjà présents sont conservés (l&apos;action ne crée que le complément).
        Chaque compte est créé avec un matricule et un e-mail internes ; l&apos;administrateur
        définit ensuite le mot de passe des comptes remis aux élèves.
      </p>
    </div>
  );
}
