import type { Metadata } from "next";
import { Fragment } from "react";
import { CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { VolumesHebdo } from "@/components/app/emplois-du-temps/volumes-hebdo";
import { EnTeteOfficielEdt, type EtablissementEnTete } from "@/components/app/emplois-du-temps/en-tete-officiel-edt";
import { BoutonImprimerEdt } from "@/components/app/emplois-du-temps/bouton-imprimer";
import {
  creneauxHoraires,
  bandesPause,
  minutesParPeriode,
  type CreneauHoraire,
  type BandePause,
} from "@/lib/emploi-du-temps/horaires";

export const metadata: Metadata = { title: "Emplois du temps" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/emplois-du-temps";
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface CreneauVue {
  etablissementId: string;
  classeNom: string;
  disciplineNom: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
  duree: number;
}

function Grille({
  creneaux,
  modeEnseignant,
  horaires,
  bandes,
}: {
  creneaux: CreneauVue[];
  modeEnseignant: boolean;
  horaires?: CreneauHoraire[];
  bandes?: BandePause[];
}) {
  if (creneaux.length === 0) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-ink-700/60">
        <CalendarDays size={16} /> Aucun emploi du temps disponible. Générez-le depuis la console
        de configuration de l&apos;établissement.
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
              {/* Hauteur fixe par période : cases de même durée = même hauteur. */}
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
              {/* Bandes de pause : RÉCRÉATION (pause matinale) et PAUSE DÉJEUNER (méridienne). */}
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


async function creneauxDe(where: object): Promise<CreneauVue[]> {
  const liste = await prisma.creneau.findMany({
    where,
    orderBy: [{ jour: "asc" }, { periode: "asc" }],
    select: { etablissementId: true, classeNom: true, disciplineNom: true, enseignantNom: true, salleNom: true, jour: true, periode: true, duree: true },
  });
  return liste;
}

interface ContexteHoraires {
  horaires: CreneauHoraire[] | null;
  bandes: BandePause[] | null;
  minutes: number[] | null;
  /** En-tête officiel pour la version imprimable (PDF). */
  enTete: EtablissementEnTete;
}

// Résout les créneaux horaires réels, les bandes de pause (RÉCRÉATION / PAUSE DÉJEUNER),
// les durées de période et l'en-tête officiel à partir de l'établissement du planning.
async function horairesDe(creneaux: CreneauVue[]): Promise<ContexteHoraires | null> {
  const etabId = creneaux[0]?.etablissementId;
  if (!etabId) return null;
  const etab = await prisma.etablissement.findUnique({
    where: { id: etabId },
    select: {
      nom: true,
      pays: true,
      ministere: true,
      sloganBulletin: true,
      anneeScolaire: true,
      emblemeUrl: true,
      creneauxParJour: true,
      horaireDebutMatin: true,
      horairePauseMatinDebut: true,
      horairePauseMatinFin: true,
      horairePauseMidiDebut: true,
      horaireRepriseApresMidi: true,
      horaireFinJournee: true,
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

export default async function EmploisDuTempsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string; classe?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "super_admin_etablissements",
    "chef_etablissement",
    "adjoint_chef_etablissement",
    "educateur",
    "enseignant",
    "parent",
    "eleve",
    "drena",
    "inspecteur",
  ]);
  const sp = await searchParams;

  // Enseignant : son propre emploi du temps.
  if (u.roleReel === "enseignant") {
    const creneaux = await creneauxDe({ enseignantId: u.id });
    const ctx = await horairesDe(creneaux);
    return (
      <div className="mx-auto max-w-5xl space-y-6 print:space-y-2">
        <div className="print:hidden">
          <PageHeader
            titre="Mon emploi du temps"
            description="Vos cours de la semaine."
            action={creneaux.length > 0 ? <BoutonImprimerEdt /> : undefined}
          />
        </div>
        <Card>
          {ctx && <EnTeteOfficielEdt etab={ctx.enTete} sousTitre={`Enseignant : ${u.nomComplet}`} />}
          <Grille
            creneaux={creneaux}
            modeEnseignant
            horaires={ctx?.horaires ?? undefined}
            bandes={ctx?.bandes ?? undefined}
          />
        </Card>
      </div>
    );
  }

  // Élève : l'emploi du temps de sa classe.
  if (u.roleReel === "eleve") {
    const insc = await prisma.inscription.findFirst({
      where: { eleveId: u.id },
      orderBy: { creeLe: "desc" },
      select: { classeId: true, classe: { select: { nom: true } } },
    });
    const creneaux = insc ? await creneauxDe({ classeId: insc.classeId }) : [];
    const ctx = await horairesDe(creneaux);
    return (
      <div className="mx-auto max-w-5xl space-y-6 print:space-y-2">
        <div className="print:hidden">
          <PageHeader
            titre="Emploi du temps"
            description={insc ? `Classe ${insc.classe.nom}` : "Aucune classe"}
            action={creneaux.length > 0 ? <BoutonImprimerEdt /> : undefined}
          />
        </div>
        <Card>
          {ctx && insc && <EnTeteOfficielEdt etab={ctx.enTete} sousTitre={`Classe ${insc.classe.nom}`} />}
          <Grille
            creneaux={creneaux}
            modeEnseignant={false}
            horaires={ctx?.horaires ?? undefined}
            bandes={ctx?.bandes ?? undefined}
          />
          <VolumesHebdo creneaux={creneaux} minutes={ctx?.minutes ?? null} />
        </Card>
      </div>
    );
  }

  // Parent : classes de ses enfants (sélection).
  if (u.roleReel === "parent") {
    const liens = await prisma.lienParentEleve.findMany({ where: { parentId: u.id }, select: { eleveId: true } });
    const inscriptions = await prisma.inscription.findMany({
      where: { eleveId: { in: liens.map((l) => l.eleveId) } },
      select: { classeId: true, classe: { select: { id: true, nom: true } } },
    });
    const classes = [...new Map(inscriptions.map((i) => [i.classe.id, i.classe.nom])).entries()].map(([id, nom]) => ({ id, nom }));
    const classeSel = classes.find((c) => c.id === sp.classe) ?? classes[0] ?? null;
    const creneaux = classeSel ? await creneauxDe({ classeId: classeSel.id }) : [];
    const ctx = await horairesDe(creneaux);
    return (
      <div className="mx-auto max-w-5xl space-y-6 print:space-y-2">
        <div className="print:hidden">
          <PageHeader
            titre="Emploi du temps"
            description="L'emploi du temps de vos enfants."
            action={creneaux.length > 0 ? <BoutonImprimerEdt /> : undefined}
          />
        </div>
        {classes.length > 1 && (
          <Card className="print:hidden">
            <form method="get" action={BASE} className="flex items-end gap-3">
              <select name="classe" defaultValue={classeSel?.id ?? ""} className="h-11 flex-1 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
              <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">Afficher</button>
            </form>
          </Card>
        )}
        <Card>
          {ctx && classeSel && <EnTeteOfficielEdt etab={ctx.enTete} sousTitre={`Classe ${classeSel.nom}`} />}
          <Grille
            creneaux={creneaux}
            modeEnseignant={false}
            horaires={ctx?.horaires ?? undefined}
            bandes={ctx?.bandes ?? undefined}
          />
          <VolumesHebdo creneaux={creneaux} minutes={ctx?.minutes ?? null} />
        </Card>
      </div>
    );
  }

  // Personnel / pilotage : sélection établissement + classe.
  const peutChoisir = ["admin", "super_admin_etablissements", "drena", "inspecteur"].includes(u.roleReel);
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  if (peutChoisir) {
    const ctx = await resoudreEtablissement(u, sp.etab);
    etablissements = ctx.etablissements;
    etabId = ctx.etabId;
  } else {
    etabId = u.portee.etablissementId;
  }

  if (!etabId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Emplois du temps" description="Choisissez un établissement." />
        {peutChoisir ? (
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/70">Aucun établissement rattaché à votre périmètre.</p>
          </Card>
        )}
      </div>
    );
  }

  const classes = await prisma.classe.findMany({ where: { etablissementId: etabId }, orderBy: { nom: "asc" }, select: { id: true, nom: true } });
  const classeSel = classes.find((c) => c.id === sp.classe) ?? classes[0] ?? null;
  const creneaux = classeSel ? await creneauxDe({ classeId: classeSel.id }) : [];
  const ctx = await horairesDe(creneaux);

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:space-y-2">
      <div className="print:hidden">
        <PageHeader
          titre="Emplois du temps"
          description="Consultez l'emploi du temps d'une classe."
          action={creneaux.length > 0 ? <BoutonImprimerEdt /> : undefined}
        />
      </div>
      {peutChoisir && (
        <div className="print:hidden">
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
        </div>
      )}
      <Card className="print:hidden">
        <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
          {etabId && <input type="hidden" name="etab" value={etabId} />}
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Classe</label>
            <select name="classe" defaultValue={classeSel?.id ?? ""} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400">
              {classes.length === 0 && <option value="">Aucune classe</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">Afficher</button>
        </form>
      </Card>
      {classeSel && (
        <Card>
          {ctx && <EnTeteOfficielEdt etab={ctx.enTete} sousTitre={`Classe ${classeSel.nom}`} />}
          <h2 className="mb-3 font-display text-base font-bold text-forest-900 print:hidden">{classeSel.nom}</h2>
          <Grille
            creneaux={creneaux}
            modeEnseignant={false}
            horaires={ctx?.horaires ?? undefined}
            bandes={ctx?.bandes ?? undefined}
          />
          <VolumesHebdo creneaux={creneaux} minutes={ctx?.minutes ?? null} />
        </Card>
      )}
    </div>
  );
}
