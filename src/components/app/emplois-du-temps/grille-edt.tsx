import "server-only";
import { Fragment } from "react";
import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  creneauxHoraires,
  bandesPause,
  minutesParPeriode,
  type CreneauHoraire,
  type BandePause,
} from "@/lib/emploi-du-temps/horaires";
import type { EtablissementEnTete } from "./en-tete-officiel-edt";
import { EdtJourMobile } from "@/components/app/mobile/edt-jour-mobile";
import { COULEURS_GRAPHIQUE } from "@/lib/mobile/couleurs";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export interface CreneauVue {
  etablissementId: string;
  classeNom: string;
  disciplineNom: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
  duree: number;
}

/** Créneaux d'emploi du temps correspondant à un filtre Prisma (classe ou enseignant). */
export async function chargerCreneaux(where: object): Promise<CreneauVue[]> {
  return prisma.creneau.findMany({
    where,
    orderBy: [{ jour: "asc" }, { periode: "asc" }],
    select: { etablissementId: true, classeNom: true, disciplineNom: true, enseignantNom: true, salleNom: true, jour: true, periode: true, duree: true },
  });
}

export interface ContexteHoraires {
  horaires: CreneauHoraire[] | null;
  bandes: BandePause[] | null;
  minutes: number[] | null;
  enTete: EtablissementEnTete;
}

/** Horaires réels, bandes de pause et en-tête officiel de l'établissement d'un jeu de créneaux. */
export async function contexteHoraires(creneaux: CreneauVue[]): Promise<ContexteHoraires | null> {
  const etabId = creneaux[0]?.etablissementId;
  if (!etabId) return null;
  const etab = await prisma.etablissement.findUnique({
    where: { id: etabId },
    select: {
      nom: true, pays: true, ministere: true, sloganBulletin: true, anneeScolaire: true, emblemeUrl: true,
      creneauxParJour: true, horaireDebutMatin: true, horairePauseMatinDebut: true, horairePauseMatinFin: true,
      horairePauseMidiDebut: true, horaireRepriseApresMidi: true, horaireFinJournee: true,
    },
  });
  if (!etab) return null;
  return {
    horaires: creneauxHoraires(etab),
    bandes: bandesPause(etab),
    minutes: minutesParPeriode(etab),
    enTete: {
      nom: etab.nom,
      pays: etab.pays,
      ministere: etab.ministere,
      sloganBulletin: etab.sloganBulletin,
      anneeScolaire: etab.anneeScolaire,
      emblemeUrl: etab.emblemeUrl,
    },
  };
}

/**
 * Grille d'emploi du temps (jours × périodes). `modeEnseignant` : affiche la CLASSE
 * dans chaque case (EDT d'un enseignant) au lieu de l'ENSEIGNANT (EDT d'une classe).
 */
export function GrilleEDT({
  creneaux,
  modeEnseignant,
  horaires,
  bandes,
}: {
  creneaux: CreneauVue[];
  modeEnseignant: boolean;
  horaires?: CreneauHoraire[] | null;
  bandes?: BandePause[] | null;
}) {
  if (creneaux.length === 0) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-ink-700/60">
        <CalendarDays size={16} /> Aucun emploi du temps disponible pour l&apos;instant.
      </p>
    );
  }
  const maxPeriode = Math.max(...creneaux.map((c) => c.periode));
  const periodes = Array.from({ length: maxPeriode + 1 }, (_, i) => i);
  // Plusieurs cours par case = GROUPES SIMULTANÉS (ex. Allemand + Espagnol au même créneau).
  const map = new Map<string, CreneauVue[]>();
  for (const c of creneaux) map.set(`${c.jour}|${c.periode}`, [...(map.get(`${c.jour}|${c.periode}`) ?? []), c]);
  // Téléphone : une couleur stable par discipline (palette de la charte) pour les cartes du jour.
  const disciplines = [...new Set(creneaux.map((c) => c.disciplineNom))].sort((a, b) => a.localeCompare(b, "fr"));
  const couleurs = Object.fromEntries(disciplines.map((d, i) => [d, COULEURS_GRAPHIQUE[i % COULEURS_GRAPHIQUE.length]]));
  const jours = JOURS.slice(0, Math.max(5, ...creneaux.map((c) => c.jour + 1)));

  return (
    <>
    {/* Téléphone : la journée en cartes — FRÈRE de la grille (qui reste celle de l'ordinateur et
        du papier, masquée à l'écran mobile par « mobile:hidden »). */}
    <div className="lg:hidden print:hidden">
      <EdtJourMobile
        seances={creneaux.map((c, i) => ({
          id: `${c.jour}-${c.periode}-${i}`, jour: c.jour, periode: c.periode, duree: c.duree, disciplineId: c.disciplineNom,
          disciplineNom: c.disciplineNom, enseignantNom: c.enseignantNom, salleNom: c.salleNom, classeNom: c.classeNom,
        }))}
        jours={jours}
        horaires={horaires ?? undefined}
        bandes={bandes ?? undefined}
        couleurs={couleurs}
        creneauxParJour={horaires?.length ?? maxPeriode + 1}
        vue={modeEnseignant ? "enseignant" : "classe"}
      />
    </div>
    <div className="edt-grille-wrap overflow-x-auto mobile:hidden">
      <table className="w-full min-w-[680px] table-fixed border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-20 border border-cream-200 bg-cream-50 p-2 font-semibold text-ink-700/60">Horaire</th>
            {JOURS.map((j) => (
              <th key={j} className="border border-cream-200 bg-cream-50 p-2 font-semibold text-forest-800">{j}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodes.map((p) => (
            <Fragment key={p}>
              <tr className="h-20 print:h-auto">
                <td className="whitespace-nowrap border border-cream-200 bg-cream-50/60 p-2 text-center font-semibold text-ink-700/60">
                  {horaires?.[p] ? (
                    <span className="leading-tight">
                      {horaires[p].debut}
                      <span className="block text-ink-700/40">{horaires[p].fin}</span>
                    </span>
                  ) : (
                    `P${p + 1}`
                  )}
                </td>
                {JOURS.map((_, j) => {
                  const groupe = map.get(`${j}|${p}`);
                  return (
                    <td key={j} className="border border-cream-200 p-1.5 align-top">
                      {groupe ? (
                        <div className="h-full space-y-1 rounded-lg bg-forest-50 px-2 py-0.5">
                          {groupe.map((c, i) => (
                            <div key={i} className={i > 0 ? "border-t border-cream-200 pt-1" : undefined}>
                              <p className="font-semibold text-forest-900">{c.disciplineNom}</p>
                              <p className="text-ink-700/65">{modeEnseignant ? c.classeNom : c.enseignantNom}</p>
                              <p className="text-[0.65rem] text-ink-700/45">{c.salleNom}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="block h-8" />
                      )}
                    </td>
                  );
                })}
              </tr>
              {bandes
                ?.filter((b) => b.apresPeriode === p)
                .map((b) => (
                  <tr key={`pause-${p}-${b.libelle}`} className="edt-pause">
                    <td colSpan={JOURS.length + 1} className="border border-cream-200 bg-gold-100/80 p-0">
                      <p className="py-1.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.4em] text-gold-800">
                        {b.libelle}
                      </p>
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
