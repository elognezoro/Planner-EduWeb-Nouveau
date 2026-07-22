"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, CheckCircle2, XCircle, ClipboardCheck, Info, Loader2, CalendarDays } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import {
  creerVisite,
  chargerContexteVisite,
  chargerEdtEnseignantVisite,
  enregistrerCompteRendu,
  ajouterRecommandation,
  changerStatutVisite,
  changerStatutRecommandation,
  supprimerVisite,
  type EtatForm,
  type ContexteVisite,
  type CreneauEdtVisite,
} from "./actions";

const initial: EtatForm = { ok: false };

const LIBELLE_TYPE: Record<string, string> = {
  classe: "Visite de classe",
  etablissement: "Visite d'établissement",
  suivi: "Visite de suivi",
};
const STATUT_VISITE: Record<string, { texte: string; classe: string }> = {
  planifiee: { texte: "Planifiée", classe: "bg-gold-100 text-gold-800" },
  realisee: { texte: "Réalisée", classe: "bg-forest-100 text-forest-800" },
  annulee: { texte: "Annulée", classe: "bg-red-100 text-red-700" },
};
const MODALITE: Record<string, { texte: string; classe: string }> = {
  programmee: { texte: "Programmée", classe: "bg-cream-200 text-forest-800" },
  inopinee: { texte: "Inopinée", classe: "bg-red-50 text-red-700 border border-red-200" },
};
const PRIORITE: Record<string, { texte: string; classe: string }> = {
  basse: { texte: "Basse", classe: "bg-cream-200 text-forest-800" },
  moyenne: { texte: "Moyenne", classe: "bg-gold-100 text-gold-800" },
  haute: { texte: "Haute", classe: "bg-red-100 text-red-700" },
};
const STATUT_RECO: { v: string; l: string }[] = [
  { v: "ouverte", l: "Ouverte" },
  { v: "en_cours", l: "En cours" },
  { v: "traitee", l: "Traitée" },
];
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function dateFr(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));
}

const inputCls =
  "h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/** Établissement proposé à la planification, avec sa catégorie pédagogique EFFECTIVE. */
export interface EtabPlanification {
  id: string;
  nom: string;
  /** « prescolaire » | « primaire » | « secondaire » | « superieur » (dérivée si non déclarée). */
  categorie: string;
}

export function NouvelleVisiteForm({
  etablissements,
  encadreurNom,
  encadreurSpecialites,
}: {
  etablissements: EtabPlanification[];
  /** Nom complet de l'utilisateur courant (champ automatique « Encadreur »). */
  encadreurNom: string;
  /** Spécialités d'encadrement renseignées à Mon Profil (affichées hors préscolaire/primaire). */
  encadreurSpecialites: string[];
}) {
  const [etat, action] = useActionState(creerVisite, initial);
  const [etabId, setEtabId] = useState("");
  const [type, setType] = useState("classe");
  const [enseignantId, setEnseignantId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [heureSeance, setHeureSeance] = useState("");
  // Le sélecteur d'heure natif attend « HH:MM » — les créneaux d'EDT arrivent en « 07h30 - 08h25 » :
  // on en extrait l'heure de DÉBUT au clic sur la grille.
  const versHeureInput = (h: string) => {
    const m = /(\d{1,2})h(\d{2})/.exec(h);
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : h;
  };
  const [ctx, setCtx] = useState<ContexteVisite | null>(null);
  const [edt, setEdt] = useState<CreneauEdtVisite[] | null>(null);
  const [chargementCtx, demarrerCtx] = useTransition();
  const [chargementEdt, demarrerEdt] = useTransition();

  // Les champs Enseignant + Classe n'apparaissent que pour les visites de CLASSE et de SUIVI.
  const besoinEnseignant = type === "classe" || type === "suivi";

  // Chargement (serveur) des enseignants/classes de l'établissement choisi — la restriction
  // par spécialité de l'encadreur est appliquée CÔTÉ SERVEUR (jamais confiée au client).
  function chargerCtxPour(id: string) {
    demarrerCtx(async () => {
      setCtx(await chargerContexteVisite(id));
    });
  }

  function surChangementEtablissement(id: string) {
    setEtabId(id);
    setEnseignantId("");
    setClasseId("");
    setEdt(null);
    setCtx(null);
    if (id && besoinEnseignant) chargerCtxPour(id);
  }

  function surChangementType(t: string) {
    setType(t);
    const besoin = t === "classe" || t === "suivi";
    if (besoin && etabId && !ctx && !chargementCtx) chargerCtxPour(etabId);
  }

  // EDT hebdomadaire de l'enseignant sélectionné (aide au choix de la séance à visiter).
  function surChangementEnseignant(id: string) {
    setEnseignantId(id);
    setHeureSeance("");
    setEdt(null);
    if (!id || !etabId) return;
    demarrerEdt(async () => {
      const r = await chargerEdtEnseignantVisite(etabId, id);
      setEdt(r.ok ? r.creneaux : []);
    });
  }

  // ── Champ automatique « Encadreur » (lecture seule) ──
  // Établissement PRÉSCOLAIRE/PRIMAIRE → « Conseiller Pédagogique » SANS spécialité
  // (non nécessaire au primaire) ; sinon « Inspecteur (Encadreur Pédagogique) — Spécialité(s) ».
  const etabSel = etablissements.find((e) => e.id === etabId) ?? null;
  const primaire = etabSel != null && (etabSel.categorie === "prescolaire" || etabSel.categorie === "primaire");
  const libelleEncadreur = primaire
    ? `${encadreurNom} — Conseiller Pédagogique`
    : `${encadreurNom} — Inspecteur (Encadreur Pédagogique)${
        encadreurSpecialites.length > 0 ? ` — ${encadreurSpecialites.join(" / ")}` : ""
      }`;

  return (
    <form action={action} className="space-y-4">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      {/* Encadreur : champ automatique, non modifiable, mis à jour selon l'établissement. */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Encadreur</label>
        <input
          value={libelleEncadreur}
          readOnly
          disabled
          aria-readonly="true"
          className={`${inputCls} bg-cream-50 text-ink-700/80`}
        />
        <p className="mt-1 text-xs text-ink-700/50">
          Champ automatique — il s&apos;adapte à la catégorie de l&apos;établissement choisi.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Établissement</label>
          <select
            name="etablissementId"
            required
            value={etabId}
            onChange={(e) => surChangementEtablissement(e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {etablissements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Type</label>
          <select name="type" value={type} onChange={(e) => surChangementType(e.target.value)} className={inputCls}>
            <option value="classe">Visite de classe</option>
            <option value="etablissement">Visite d&apos;établissement</option>
            <option value="suivi">Visite de suivi</option>
          </select>
        </div>
      </div>

      {/* Enseignant + Classe : uniquement pour les visites de classe / de suivi. */}
      {besoinEnseignant && (
        <>
          {ctx?.sansSpecialite && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
              <Info size={17} className="mt-0.5 shrink-0" />
              <span>
                Vous n&apos;avez renseigné aucune spécialité : la liste des enseignants n&apos;est pas
                restreinte. Renseignez votre spécialité dans{" "}
                <Link href="/app/mon-profil" className="font-semibold underline">
                  Mon Profil
                </Link>{" "}
                (bloc « Ma spécialité ») pour ne voir que les enseignants de votre discipline.
              </span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">Enseignant</label>
              <select
                name="enseignantId"
                required
                value={enseignantId}
                onChange={(e) => surChangementEnseignant(e.target.value)}
                disabled={!etabId || chargementCtx}
                className={inputCls}
              >
                <option value="" disabled>
                  {!etabId
                    ? "Choisir d'abord l'établissement…"
                    : chargementCtx
                      ? "Chargement…"
                      : (ctx?.enseignants.length ?? 0) === 0
                        ? "Aucun enseignant correspondant"
                        : "Choisir…"}
                </option>
                {(ctx?.enseignants ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.libelle}
                  </option>
                ))}
              </select>
              {ctx?.restreinte && (
                <p className="mt-1 text-xs text-ink-700/55">
                  Liste restreinte à votre ou vos spécialités : {ctx.specialites.join(" / ")}.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">Classe</label>
              <select
                name="classeId"
                required
                value={classeId}
                onChange={(e) => setClasseId(e.target.value)}
                disabled={!etabId || chargementCtx}
                className={inputCls}
              >
                <option value="" disabled>
                  {!etabId
                    ? "Choisir d'abord l'établissement…"
                    : chargementCtx
                      ? "Chargement…"
                      : (ctx?.classes.length ?? 0) === 0
                        ? "Aucune classe enregistrée"
                        : "Choisir…"}
                </option>
                {(ctx?.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* EDT hebdomadaire de l'enseignant : un clic sur un créneau renseigne classe + heure. */}
          {enseignantId && (
            <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <CalendarDays size={13} /> Emploi du temps hebdomadaire de l&apos;enseignant
              </p>
              {chargementEdt ? (
                <p className="flex items-center gap-2 py-2 text-sm text-ink-700/55">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </p>
              ) : edt && edt.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-xs">
                      <thead>
                        <tr>
                          {JOURS_COURTS.map((j) => (
                            <th key={j} className="border border-cream-200 bg-cream-50 p-1.5 font-semibold text-forest-800">
                              {j}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...new Set(edt.map((c) => c.periode))]
                          .sort((a, b) => a - b)
                          .map((p) => (
                            <tr key={p}>
                              {JOURS_COURTS.map((_, j) => {
                                const c = edt.find((x) => x.jour === j && x.periode === p);
                                return (
                                  <td key={j} className="border border-cream-200 p-1 align-top">
                                    {c ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setClasseId(c.classeId);
                                          setHeureSeance(versHeureInput(c.heure));
                                        }}
                                        title="Renseigner l'heure de séance et la classe"
                                        className={`w-full rounded-lg px-1.5 py-1 text-left transition-colors ${
                                          classeId === c.classeId && heureSeance === versHeureInput(c.heure)
                                            ? "bg-forest-700 text-cream-50"
                                            : "bg-forest-50 hover:bg-forest-100"
                                        }`}
                                      >
                                        <span className="block font-semibold">{c.heure}</span>
                                        <span className="block">{c.classeNom}</span>
                                        <span className="block opacity-70">{c.disciplineNom}</span>
                                      </button>
                                    ) : (
                                      <span className="block h-6" />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-700/50">
                    Cliquez sur un créneau pour renseigner automatiquement l&apos;heure de séance et la classe.
                  </p>
                </>
              ) : (
                <p className="py-1 text-sm text-ink-700/55">
                  Aucun emploi du temps trouvé pour cet enseignant dans cet établissement.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Date</label>
          <input type="date" name="date" required className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            Heure de la séance <span className="font-normal text-ink-700/50">(facultatif)</span>
          </label>
          {/* Horloge native (sélection heures + minutes) — un clic sur l'EDT la pré-remplit. */}
          <input
            type="time"
            name="heureSeance"
            value={heureSeance}
            onChange={(e) => setHeureSeance(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Modalité</label>
          <select name="modalite" defaultValue="programmee" className={inputCls}>
            <option value="programmee">Programmée (annoncée)</option>
            <option value="inopinee">Inopinée (non annoncée)</option>
          </select>
          <p className="mt-1 text-xs text-ink-700/50">
            Programmée : la direction et l&apos;enseignant sont notifiés. Inopinée : aucune notification.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Objet</label>
          <input type="text" name="objet" required placeholder="Objet de la visite" className={inputCls} />
        </div>
      </div>
      <SubmitButton className="w-auto px-8">Planifier la visite</SubmitButton>
    </form>
  );
}

export interface VisiteVue {
  id: string;
  etablissementNom: string;
  inspecteurNom: string;
  enseignantNom: string | null;
  classeNom: string | null;
  date: string;
  heureSeance: string | null;
  type: string;
  modalite: string;
  statut: string;
  objet: string;
  observations: string | null;
  noteGlobale: number | null;
  recommandations: { id: string; texte: string; priorite: string; statut: string }[];
}

export function VisiteCard({ visite, gerable }: { visite: VisiteVue; gerable: boolean }) {
  const [pending, start] = useTransition();
  const [etatCR, actionCR] = useActionState(enregistrerCompteRendu, initial);
  const [etatReco, actionReco] = useActionState(ajouterRecommandation, initial);
  const st = STATUT_VISITE[visite.statut] ?? STATUT_VISITE.planifiee;
  const mod = MODALITE[visite.modalite] ?? MODALITE.programmee;

  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-forest-900">{visite.etablissementNom}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.classe}`}>{st.texte}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${mod.classe}`}>{mod.texte}</span>
            {visite.noteGlobale != null && (
              <span className="rounded-full bg-forest-800 px-2.5 py-0.5 text-xs font-semibold text-gold-300">
                {visite.noteGlobale}/20
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {LIBELLE_TYPE[visite.type] ?? visite.type} · {dateFr(visite.date)}
            {visite.heureSeance ? ` · ${visite.heureSeance}` : ""} · par {visite.inspecteurNom}
          </p>
          {(visite.enseignantNom || visite.classeNom) && (
            <p className="mt-1 text-xs text-ink-700/70">
              {visite.enseignantNom ? `Enseignant : ${visite.enseignantNom}` : ""}
              {visite.enseignantNom && visite.classeNom ? " · " : ""}
              {visite.classeNom ? `Classe : ${visite.classeNom}` : ""}
            </p>
          )}
          <p className="mt-2 text-sm text-ink-900">{visite.objet}</p>
        </div>
        {gerable && (
          <div className="flex items-center gap-1.5">
            {visite.statut !== "annulee" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => void (await changerStatutVisite(visite.id, "annulee")))}
                title="Annuler la visite"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-semibold text-ink-700/70 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <XCircle size={13} /> Annuler
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => void (await supprimerVisite(visite.id)))}
              title="Supprimer la visite"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {visite.observations && (
        <p className="mt-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3 text-sm text-ink-900">
          {visite.observations}
        </p>
      )}

      {/* Compte-rendu (gérable) */}
      {gerable && visite.statut !== "annulee" && (
        <details className="mt-3 rounded-xl border border-cream-200 bg-cream-50/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-forest-800">
            <ClipboardCheck size={14} className="mr-1 inline" /> Compte-rendu / appréciation
          </summary>
          <form action={actionCR} className="mt-3 space-y-3">
            {etatCR.message && <FormAlert ton={etatCR.ok ? "succes" : "erreur"}>{etatCR.message}</FormAlert>}
            <input type="hidden" name="visiteId" value={visite.id} />
            <textarea
              name="observations"
              rows={3}
              defaultValue={visite.observations ?? ""}
              placeholder="Observations, constats, points forts et axes d'amélioration…"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-forest-900">Appréciation /20</label>
                <input
                  type="number"
                  name="noteGlobale"
                  min={0}
                  max={20}
                  step={0.5}
                  defaultValue={visite.noteGlobale ?? ""}
                  className="h-10 w-24 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                />
              </div>
              <SubmitButton className="w-auto px-6">
                <CheckCircle2 size={15} /> Enregistrer (réalisée)
              </SubmitButton>
            </div>
          </form>
        </details>
      )}

      {/* Recommandations */}
      <div className="mt-4 border-t border-cream-100 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/50">
          Recommandations ({visite.recommandations.length})
        </p>
        {visite.recommandations.length > 0 && (
          <ul className="mb-3 space-y-2">
            {visite.recommandations.map((r) => {
              const p = PRIORITE[r.priorite] ?? PRIORITE.moyenne;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-cream-50/40 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${p.classe}`}>{p.texte}</span>
                    <span className="text-ink-900">{r.texte}</span>
                  </span>
                  {gerable ? (
                    <select
                      defaultValue={r.statut}
                      disabled={pending}
                      onChange={(e) =>
                        start(async () =>
                          void (await changerStatutRecommandation(r.id, e.target.value as "ouverte" | "en_cours" | "traitee")))
                      }
                      className="h-8 rounded-lg border border-cream-300 bg-white px-2 text-xs outline-none focus:border-forest-400"
                    >
                      {STATUT_RECO.map((s) => (
                        <option key={s.v} value={s.v}>
                          {s.l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-ink-700/60">
                      {STATUT_RECO.find((s) => s.v === r.statut)?.l}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {gerable && (
          <form action={actionReco} className="flex flex-wrap items-end gap-2">
            {etatReco.message && !etatReco.ok && (
              <div className="w-full">
                <FormAlert ton="erreur">{etatReco.message}</FormAlert>
              </div>
            )}
            <input type="hidden" name="visiteId" value={visite.id} />
            <input
              type="text"
              name="texte"
              required
              placeholder="Nouvelle recommandation…"
              className="h-9 min-w-[12rem] flex-1 rounded-lg border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
            <select name="priorite" defaultValue="moyenne" className="h-9 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400">
              <option value="basse">Basse</option>
              <option value="moyenne">Moyenne</option>
              <option value="haute">Haute</option>
            </select>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-forest-200 px-3.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
            >
              <Plus size={13} /> Ajouter
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
