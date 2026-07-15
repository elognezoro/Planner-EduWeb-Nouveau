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
  const map = new Map<string, CreneauVue>();
  for (const c of creneaux) map.set(`${c.jour}|${c.periode}`, c);

  return (
    <div className="edt-grille-wrap overflow-x-auto">
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
                  const c = map.get(`${j}|${p}`);
                  return (
                    <td key={j} className="border border-cream-200 p-1.5 align-top">
                      {c ? (
                        <div className="h-full rounded-lg bg-forest-50 px-2 py-0.5">
                          <p className="font-semibold text-forest-900">{c.disciplineNom}</p>
                          <p className="text-ink-700/65">{modeEnseignant ? c.classeNom : c.enseignantNom}</p>
                          <p className="text-[0.65rem] text-ink-700/45">{c.salleNom}</p>
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
  );
}
