"use client";

import { useActionState, useState } from "react";
import { ClipboardList, Eye, FileSignature, Save } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { Card } from "@/components/app/ui";
import {
  COMPETENCES,
  ECHELLE,
  cleIndicateur,
  compterReponses,
  TOUTES_CLES,
  type CodeAppreciation,
  type ReponsesGrille,
  type SeanceObservee,
} from "@/lib/inspection/grille-supervision";
import { enregistrerGrilleSupervision } from "./actions";
import type { EtatForm } from "../../actions";

const initial: EtatForm = { ok: false };

const inputCls =
  "h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70";

/** Valeurs initiales de la grille (chargées côté serveur — vides si la grille n'existe pas). */
export interface GrilleInitiale {
  reponses: ReponsesGrille;
  seance: SeanceObservee;
  pointsForts: string;
  pointsAmeliorer: string;
  propositions: string;
}

const TON_CODE: Record<CodeAppreciation, string> = {
  TS: "bg-forest-100 text-forest-800",
  S: "bg-forest-50 text-forest-700",
  P: "bg-gold-100 text-gold-800",
  I: "bg-red-100 text-red-700",
};

export function GrilleSupervisionForm({
  visiteId,
  lectureSeule,
  initiale,
}: {
  visiteId: string;
  /** Vrai si l'utilisateur ne peut pas modifier la visite (drena, mode aperçu…) : tout est figé. */
  lectureSeule: boolean;
  initiale: GrilleInitiale;
}) {
  const [etat, action] = useActionState(enregistrerGrilleSupervision.bind(null, visiteId), initial);
  const [reponses, setReponses] = useState<ReponsesGrille>(initiale.reponses);
  const { total, parCode } = compterReponses(reponses);

  /** Coche un code pour un indicateur (sélection normale, souris ou clavier). */
  function choisir(cle: string, code: CodeAppreciation) {
    setReponses((prev) => ({ ...prev, [cle]: code }));
  }

  /** Décoche l'indicateur (clic sur la case DÉJÀ cochée) — les radios ne sont pas requis. */
  function retirer(cle: string) {
    setReponses((prev) => {
      const suivant = { ...prev };
      delete suivant[cle];
      return suivant;
    });
  }

  return (
    <form action={action} className="space-y-6">
      {lectureSeule && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          <Eye size={17} className="mt-0.5 shrink-0" />
          <span>
            Lecture seule — vous consultez cette grille sans pouvoir la modifier (seuls
            l&apos;auteur de la visite, un gestionnaire dont le périmètre couvre
            l&apos;établissement ou l&apos;administrateur peuvent l&apos;enregistrer).
          </span>
        </div>
      )}

      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      {/* Barre de progression sticky : total apprécié + répartition par code, en direct. */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white/95 px-4 py-2.5 shadow-soft backdrop-blur">
        <p className="text-sm font-semibold text-forest-900">
          {total} / {TOUTES_CLES.length} indicateurs appréciés
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {ECHELLE.map((e) => (
            <span
              key={e.code}
              title={e.libelle}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TON_CODE[e.code]}`}
            >
              {e.code} : {parCode[e.code]}
            </span>
          ))}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-100">
          <div
            className="h-full rounded-full bg-forest-600 transition-all"
            style={{ width: `${Math.round((total / TOUTES_CLES.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Volet « Séance observée » : champs libres non portés par la visite. */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ClipboardList size={18} /> Séance observée
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Nature de la séance</label>
            <input
              type="text"
              name="seance-nature"
              maxLength={200}
              defaultValue={initiale.seance.nature}
              disabled={lectureSeule}
              placeholder="Ex. cours, TP, TD…"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Titre</label>
            <input
              type="text"
              name="seance-titre"
              maxLength={200}
              defaultValue={initiale.seance.titre}
              disabled={lectureSeule}
              placeholder="Titre de la leçon/séance"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Durée</label>
            <input
              type="text"
              name="seance-duree"
              maxLength={200}
              defaultValue={initiale.seance.duree}
              disabled={lectureSeule}
              placeholder="Ex. 55 min"
              className={inputCls}
            />
          </div>
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
          Effectif — Filles (présentes) / Garçons (présents)
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Filles</label>
            <input
              type="text"
              name="seance-effectifFilles"
              maxLength={200}
              defaultValue={initiale.seance.effectifFilles}
              disabled={lectureSeule}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">dont présentes</label>
            <input
              type="text"
              name="seance-effectifFillesPresentes"
              maxLength={200}
              defaultValue={initiale.seance.effectifFillesPresentes}
              disabled={lectureSeule}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Garçons</label>
            <input
              type="text"
              name="seance-effectifGarcons"
              maxLength={200}
              defaultValue={initiale.seance.effectifGarcons}
              disabled={lectureSeule}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">dont présents</label>
            <input
              type="text"
              name="seance-effectifGarconsPresents"
              maxLength={200}
              defaultValue={initiale.seance.effectifGarconsPresents}
              disabled={lectureSeule}
              className={inputCls}
            />
          </div>
        </div>
      </Card>

      {/* Les 4 compétences : même structure visuelle que le référentiel, avec des radios TS/S/P/I
          par indicateur. Un clic sur la case DÉJÀ cochée la décoche (aucun indicateur requis). */}
      {COMPETENCES.map((comp) => (
        <Card key={comp.numero}>
          <h2 className="mb-3 font-display text-base font-bold text-forest-900">
            {comp.numero} — {comp.titre}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-cream-50 text-left text-xs uppercase tracking-wide text-forest-800">
                  <th className="border border-cream-200 p-2 font-semibold">Élément d&apos;appréciation</th>
                  <th className="border border-cream-200 p-2 font-semibold">Critère</th>
                  <th className="border border-cream-200 p-2 font-semibold">Indicateurs</th>
                  {ECHELLE.map((e) => (
                    <th
                      key={e.code}
                      title={e.libelle}
                      className="w-10 border border-cream-200 p-2 text-center font-semibold"
                    >
                      {e.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comp.items.map((item) =>
                  item.indicateurs.map((indicateur, i) => {
                    const cle = cleIndicateur(item.numero, i);
                    return (
                      <tr key={cle} className="align-top">
                        {i === 0 && (
                          <td rowSpan={item.indicateurs.length} className="border border-cream-200 p-2 text-ink-900">
                            <span className="font-semibold text-forest-900">{item.numero}</span> {item.enonce}
                          </td>
                        )}
                        {i === 0 && (
                          <td rowSpan={item.indicateurs.length} className="border border-cream-200 p-2 text-ink-700/80">
                            {item.critere}
                          </td>
                        )}
                        <td className="border border-cream-200 p-2 text-ink-900">{indicateur}</td>
                        {ECHELLE.map((e) => (
                          <td key={e.code} className="border border-cream-200 p-2 text-center">
                            <input
                              type="radio"
                              name={`rep-${cle}`}
                              value={e.code}
                              checked={reponses[cle] === e.code}
                              disabled={lectureSeule}
                              aria-label={`${e.libelle} — indicateur ${cle}`}
                              title={`${e.libelle} (cliquer à nouveau pour décocher)`}
                              onChange={() => choisir(cle, e.code)}
                              onClick={() => {
                                if (reponses[cle] === e.code) retirer(cle);
                              }}
                              className="h-4 w-4 accent-forest-700 disabled:opacity-60"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Synthèse de la supervision (rubriques de fin de grille officielle). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileSignature size={18} /> Synthèse de la supervision
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Points forts</label>
            <textarea
              name="pointsForts"
              rows={3}
              maxLength={4000}
              defaultValue={initiale.pointsForts}
              disabled={lectureSeule}
              placeholder="Constats positifs relevés au cours de la séance observée…"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Points à améliorer</label>
            <textarea
              name="pointsAmeliorer"
              rows={3}
              maxLength={4000}
              defaultValue={initiale.pointsAmeliorer}
              disabled={lectureSeule}
              placeholder="Insuffisances et difficultés relevées au cours de la séance…"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">
              Propositions d&apos;amélioration du (de la) superviseur.e
            </label>
            <textarea
              name="propositions"
              rows={3}
              maxLength={4000}
              defaultValue={initiale.propositions}
              disabled={lectureSeule}
              placeholder="Conseils et pistes de remédiation formulés à l'issue de la supervision…"
              className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
            />
          </div>
        </div>
        {!lectureSeule && (
          <div className="mt-5 flex justify-end">
            <SubmitButton className="w-auto px-8">
              <Save size={15} /> Enregistrer la grille
            </SubmitButton>
          </div>
        )}
      </Card>
    </form>
  );
}
