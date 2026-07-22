"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ClipboardList, Eye, FileSignature, Save } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { Card } from "@/components/app/ui";
import { SelectRecherche } from "@/components/app/select-recherche";
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

/** Natures de séance proposées (liste indicative — la saisie libre reste possible). */
const NATURES_SEANCE = [
  "Cours",
  "Leçon",
  "Travaux dirigés (TD)",
  "Travaux pratiques (TP)",
  "Séance d'exercices",
  "Séance de révision",
  "Évaluation",
  "Correction d'évaluation",
  "Remédiation",
  "Activité d'intégration",
  "Séance expérimentale",
  "Éducation physique et sportive (EPS)",
].map((n) => ({ id: n, nom: n }));

/** Effectifs proposés de 0 à 150 — une valeur supérieure reste saisissable (valeurLibre). */
const EFFECTIFS = Array.from({ length: 151 }, (_, n) => ({ id: String(n), nom: String(n) }));

/** Valeur enregistrée → option pré-sélectionnée du SelectRecherche (null si champ vide). */
const enDefaut = (v: string) => (v ? { id: v, nom: v } : null);

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
  // Accordéon EXCLUSIF des items (1.1 … 4.6) : un seul déplié à la fois. Les contenus repliés
  // restent MONTÉS (simplement masqués en CSS) pour que leurs radios soient toujours soumis.
  const [itemOuvert, setItemOuvert] = useState<string | null>(null);
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
            {/* Liste déroulante avec recherche rapide — une nature hors liste reste saisissable. */}
            <SelectRecherche
              name="seance-nature"
              options={NATURES_SEANCE}
              defaut={enDefaut(initiale.seance.nature)}
              placeholder="Ex. cours, TP, TD…"
              valeurLibre
              effacable
              grand
              disabled={lectureSeule}
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
        {/* Effectifs : liste déroulante 0-150 avec recherche rapide — une valeur au-delà de 150
            reste saisissable (entrée « Utiliser "…" » du SelectRecherche en mode valeurLibre). */}
        <div className="grid gap-4 sm:grid-cols-4">
          {(
            [
              { nom: "seance-effectifFilles", libelle: "Filles", valeur: initiale.seance.effectifFilles },
              {
                nom: "seance-effectifFillesPresentes",
                libelle: "dont présentes",
                valeur: initiale.seance.effectifFillesPresentes,
              },
              { nom: "seance-effectifGarcons", libelle: "Garçons", valeur: initiale.seance.effectifGarcons },
              {
                nom: "seance-effectifGarconsPresents",
                libelle: "dont présents",
                valeur: initiale.seance.effectifGarconsPresents,
              },
            ] as const
          ).map((champ) => (
            <div key={champ.nom}>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">{champ.libelle}</label>
              <SelectRecherche
                name={champ.nom}
                options={EFFECTIFS}
                defaut={enDefaut(champ.valeur)}
                placeholder="0 à 150, ou plus…"
                valeurLibre
                effacable
                grand
                disabled={lectureSeule}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Les 4 compétences : chaque ITEM (1.1 … 4.6) se présente en ACCORDÉON exclusif — ouvrir
          un item referme automatiquement les autres. L'en-tête montre la progression de l'item
          (codes cochés) ; le contenu déplié montre le critère et les radios TS/S/P/I par
          indicateur (un clic sur la case DÉJÀ cochée la décoche — aucun indicateur requis). */}
      {COMPETENCES.map((comp) => {
        const clesComp = comp.items.flatMap((item) => item.indicateurs.map((_, i) => cleIndicateur(item.numero, i)));
        const totalComp = clesComp.filter((c) => reponses[c]).length;
        return (
          <Card key={comp.numero}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-bold text-forest-900">
                {comp.numero} — {comp.titre}
              </h2>
              <span className="text-xs font-semibold text-ink-700/55">
                {totalComp} / {clesComp.length} indicateurs appréciés
              </span>
            </div>
            <div className="space-y-2">
              {comp.items.map((item) => {
                const cles = item.indicateurs.map((_, i) => cleIndicateur(item.numero, i));
                const nb = cles.filter((c) => reponses[c]).length;
                const ouvert = itemOuvert === item.numero;
                return (
                  <div key={item.numero} className="overflow-hidden rounded-xl border border-cream-200">
                    <button
                      type="button"
                      onClick={() => setItemOuvert(ouvert ? null : item.numero)}
                      aria-expanded={ouvert}
                      className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                        ouvert ? "bg-forest-50" : "bg-cream-50/60 hover:bg-cream-100"
                      }`}
                    >
                      <span className="font-display text-sm font-bold text-forest-800">{item.numero}</span>
                      <span className="min-w-0 flex-1 text-sm text-ink-900">{item.enonce}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {cles.map(
                          (c) =>
                            reponses[c] && (
                              <span
                                key={c}
                                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${TON_CODE[reponses[c]]}`}
                              >
                                {reponses[c]}
                              </span>
                            ),
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                            nb === cles.length
                              ? "bg-forest-100 text-forest-800"
                              : nb > 0
                                ? "bg-gold-100 text-gold-800"
                                : "bg-cream-200 text-ink-700/60"
                          }`}
                        >
                          {nb}/{cles.length}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-ink-700/45 transition-transform ${ouvert ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                    {/* Contenu TOUJOURS monté (masqué si replié) : les radios restent soumis. */}
                    <div className={ouvert ? "space-y-2.5 border-t border-cream-200 bg-white p-3.5" : "hidden"}>
                      <p className="text-xs text-ink-700/70">
                        <span className="font-semibold text-forest-900">Critère :</span> {item.critere}
                      </p>
                      {item.indicateurs.map((indicateur, i) => {
                        const cle = cles[i];
                        return (
                          <div
                            key={cle}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cream-200 bg-cream-50/40 p-3"
                          >
                            <p className="min-w-0 flex-1 text-sm text-ink-900">{indicateur}</p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {ECHELLE.map((e) => {
                                const coche = reponses[cle] === e.code;
                                return (
                                  <label
                                    key={e.code}
                                    title={`${e.libelle}${coche ? " (cliquer à nouveau pour décocher)" : ""}`}
                                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                      coche
                                        ? `border-transparent ${TON_CODE[e.code]}`
                                        : "border-cream-300 bg-white text-ink-700/70 hover:bg-cream-50"
                                    } ${lectureSeule ? "cursor-default opacity-70" : ""}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`rep-${cle}`}
                                      value={e.code}
                                      checked={coche}
                                      disabled={lectureSeule}
                                      aria-label={`${e.libelle} — indicateur ${cle}`}
                                      onChange={() => choisir(cle, e.code)}
                                      onClick={() => {
                                        if (reponses[cle] === e.code) retirer(cle);
                                      }}
                                      className="h-3.5 w-3.5 accent-forest-700 disabled:opacity-60"
                                    />
                                    {e.code}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

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
