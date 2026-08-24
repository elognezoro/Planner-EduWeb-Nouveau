import "server-only";
import { prisma } from "@/lib/prisma";
import { infosRegime, type InfosRegime } from "@/lib/vie-scolaire/regime";
import { HEURES_DUES_1ER_CYCLE, HEURES_DUES_2ND_CYCLE } from "@/lib/referentiels/service-enseignant";
import { jourModele } from "./edt";

/**
 * BILAN DES HEURES D'ABSENCE — double comptabilité demi-journées / heures réglementaires.
 *
 * Conventions (affichées telles quelles dans l'interface) :
 * - Une journée d'absence = 2 demi-journées ; une matinée ou un après-midi = 1.
 * - Heures réglementaires dues PAR JOUR, selon la nature de l'absence :
 *     · absence d'ENSEIGNANT (registre AbsenceEnseignant) : volume horaire hebdomadaire dû du
 *       cycle de l'intéressé (paramétré dans la configuration de l'établissement ; à défaut
 *       21 h au 1er cycle, 18 h au 2nd cycle — un enseignant intervenant au lycée relève du
 *       2nd cycle, même règle que le solveur) ÷ 6 jours ouvrables (semaine lundi–samedi) ;
 *     · absence de personnel NON enseignant (demande approuvée, estEnseignant=false) :
 *       40 h hebdomadaires réglementaires ÷ 6.
 *   Une demi-journée vaut la moitié des heures dues du jour.
 * - Sources SANS double compte : le registre AbsenceEnseignant (saisies manuelles ET absences
 *   générées par les demandes approuvées des enseignants) + les demandes APPROUVÉES du
 *   personnel non enseignant (qui ne génèrent pas de lignes de registre).
 * - Périodes : mois de l'année scolaire (septembre → août), trimestres (sept.–déc. /
 *   janv.–mars / avr.–août) ou semestres (sept.–janv. / févr.–août) selon le régime de
 *   notation de l'établissement (régime séquentiel : présentation trimestrielle), et année.
 */

const REPLI_HEBDO_1ER_CYCLE = HEURES_DUES_1ER_CYCLE; // dû officiel si le volume n'est pas paramétré (0)
const REPLI_HEBDO_2ND_CYCLE = HEURES_DUES_2ND_CYCLE;
const HEBDO_NON_ENSEIGNANT = 40; // Code du travail : 40 h hebdomadaires
const JOURS_OUVRABLES_SEMAINE = 6; // lundi → samedi (convention EDT/absences)

export interface MoisBilan {
  /** « sept. 25 » */
  libelle: string;
  demiJournees: number;
  heures: number;
  heuresAutorisees: number;
  heuresJustifiees: number;
  heuresNonAutorisees: number;
}

export interface PeriodeBilan {
  /** « 1er trimestre (sept.–déc.) » */
  libelle: string;
  demiJournees: number;
  heures: number;
  enCours: boolean;
}

export interface BilanHeures {
  anneeLibelle: string;
  /** « Trimestriel (3 trimestres) »… */
  regimeLibelle: string;
  /** « Trimestre » / « Semestre » (présentation retenue). */
  libellePeriode: string;
  /** true = régime séquentiel présenté en trimestres. */
  presentationTrimestrielle: boolean;
  parMois: MoisBilan[];
  periodes: PeriodeBilan[];
  annuel: { demiJournees: number; heures: number };
  moisEnCours: { libelle: string; demiJournees: number; heures: number } | null;
  /** Heures réglementaires dues par jour du demandeur, selon son RÔLE ACTUEL (bilan individuel uniquement). */
  heuresDuesParJour: number | null;
}

interface LigneRegistre { date: Date; demiJournee: string; statut: string; enseignantId: string }
interface DemandeNonEnseignant { dateDebut: Date; dateFin: Date; demandeurId: string }

interface Cadre {
  debut: Date;
  fin: Date;
  anneeLibelle: string;
  vol1: number; // h/semaine dues au 1er cycle (repli appliqué)
  vol2: number;
  regime: InfosRegime;
}

/** Année scolaire active (bornes UTC inclusives [1er sept, 31 août]) + volumes + régime. */
async function chargerCadre(etablissementId: string): Promise<Cadre> {
  const [annee, etab, config] = await Promise.all([
    prisma.anneeScolaire.findFirst({ where: { active: true }, select: { libelle: true, debut: true } }),
    prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { volumeHoraire1erCycle: true, volumeHoraire2ndCycle: true, regimeNotation: true, nbSequences: true },
    }),
    prisma.configuration.findUnique({ where: { id: "global" }, select: { regimeNotation: true } }),
  ]);
  let ancre: number | null = null;
  if (annee?.debut) {
    ancre = annee.debut.getUTCMonth() >= 8 ? annee.debut.getUTCFullYear() : annee.debut.getUTCFullYear() - 1;
  } else if (annee?.libelle) {
    const m = annee.libelle.match(/(20\d{2})/);
    if (m) ancre = Number(m[1]);
  }
  if (ancre === null) {
    const now = new Date();
    ancre = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  }
  return {
    debut: new Date(Date.UTC(ancre, 8, 1)),
    fin: new Date(Date.UTC(ancre + 1, 7, 31)),
    anneeLibelle: annee?.libelle ?? `${ancre}-${ancre + 1}`,
    vol1: Math.max(0, etab?.volumeHoraire1erCycle ?? 0) || REPLI_HEBDO_1ER_CYCLE,
    vol2: Math.max(0, etab?.volumeHoraire2ndCycle ?? 0) || REPLI_HEBDO_2ND_CYCLE,
    regime: infosRegime(etab?.regimeNotation, etab?.nbSequences, config?.regimeNotation),
  };
}

/** Registre + demandes approuvées non enseignantes, bornés à l'année scolaire. */
async function chargerDonnees(
  etablissementId: string,
  cadre: Cadre,
  demandeurId?: string,
): Promise<{ absences: LigneRegistre[]; demandes: DemandeNonEnseignant[] }> {
  const [absences, demandes] = await Promise.all([
    prisma.absenceEnseignant.findMany({
      where: {
        etablissementId,
        ...(demandeurId ? { enseignantId: demandeurId } : {}),
        date: { gte: cadre.debut, lte: cadre.fin },
      },
      select: { date: true, demiJournee: true, statut: true, enseignantId: true },
    }),
    // Demandes approuvées du personnel NON enseignant : elles ne génèrent pas de lignes de
    // registre, on les convertit ici (journées entières sur les jours ouvrables).
    prisma.demandeAbsence.findMany({
      where: {
        etablissementId,
        statut: "approuvee",
        estEnseignant: false,
        ...(demandeurId ? { demandeurId } : {}),
        dateDebut: { lte: cadre.fin },
        dateFin: { gte: cadre.debut },
      },
      select: { dateDebut: true, dateFin: true, demandeurId: true },
    }),
  ]);
  return { absences, demandes };
}

/** Heures dues/jour au taux ENSEIGNANT (cycle) de chaque personne + son rôle actuel. */
async function chargerProfils(
  cadre: Cadre,
  ids: string[],
): Promise<{ heuresJourPar: Map<string, number>; rolePar: Map<string, string> }> {
  const heuresJourPar = new Map<string, number>();
  const rolePar = new Map<string, string>();
  if (ids.length === 0) return { heuresJourPar, rolePar };
  const profils = await prisma.utilisateur.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      roleActif: { select: { nomTechnique: true } },
      niveauxIntervention: { select: { niveau: { select: { cycle: true } } } },
    },
  });
  for (const p of profils) {
    const lycee = p.niveauxIntervention.some((n) => n.niveau.cycle === "lycee");
    heuresJourPar.set(p.id, (lycee ? cadre.vol2 : cadre.vol1) / JOURS_OUVRABLES_SEMAINE);
    rolePar.set(p.id, p.roleActif.nomTechnique);
  }
  return { heuresJourPar, rolePar };
}

/** Index 0..11 du mois scolaire (0 = septembre … 11 = août) ; null hors année. */
function indexMoisScolaire(d: Date, debut: Date): number | null {
  const idx = (d.getUTCFullYear() - debut.getUTCFullYear()) * 12 + d.getUTCMonth() - 8;
  return idx >= 0 && idx < 12 ? idx : null;
}

const FMT_MOIS = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

/** Découpage des 12 mois scolaires en périodes de notation (bornes en index de mois). */
function decoupagePeriodes(regime: "trimestre" | "semestre"): { libelle: string; de: number; a: number }[] {
  return regime === "semestre"
    ? [
        { libelle: "1er semestre (sept.–janv.)", de: 0, a: 4 },
        { libelle: "2e semestre (févr.–août)", de: 5, a: 11 },
      ]
    : [
        { libelle: "1er trimestre (sept.–déc.)", de: 0, a: 3 },
        { libelle: "2e trimestre (janv.–mars)", de: 4, a: 6 },
        { libelle: "3e trimestre (avr.–août)", de: 7, a: 11 },
      ];
}

/** Agrège un jeu registre + demandes en bilan complet (mois, périodes, année). */
function construireBilan(
  cadre: Cadre,
  absences: LigneRegistre[],
  demandes: DemandeNonEnseignant[],
  heuresJourPar: Map<string, number>,
  heuresDuesParJour: number | null,
): BilanHeures {
  const mois: MoisBilan[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(cadre.debut.getUTCFullYear(), 8 + i, 1));
    return {
      libelle: `${FMT_MOIS.format(d)} ${String(d.getUTCFullYear() % 100).padStart(2, "0")}`,
      demiJournees: 0, heures: 0, heuresAutorisees: 0, heuresJustifiees: 0, heuresNonAutorisees: 0,
    };
  });

  const cumuler = (idx: number, demiJournees: number, heures: number, statut: string) => {
    const m = mois[idx];
    m.demiJournees += demiJournees;
    m.heures += heures;
    if (statut === "justifiee") m.heuresJustifiees += heures;
    else if (statut === "non_autorisee") m.heuresNonAutorisees += heures;
    else m.heuresAutorisees += heures;
  };

  for (const a of absences) {
    const idx = indexMoisScolaire(a.date, cadre.debut);
    if (idx === null) continue;
    const demi = a.demiJournee === "journee" ? 2 : 1;
    const hJour = heuresJourPar.get(a.enseignantId) ?? cadre.vol1 / JOURS_OUVRABLES_SEMAINE;
    cumuler(idx, demi, (demi / 2) * hJour, a.statut);
  }

  const heuresJourNonEnseignant = HEBDO_NON_ENSEIGNANT / JOURS_OUVRABLES_SEMAINE;
  for (const d of demandes) {
    // Jours ouvrables (hors dimanche) de la demande, bornés à l'année scolaire.
    const cur = new Date(Math.max(d.dateDebut.getTime(), cadre.debut.getTime()));
    const stop = new Date(Math.min(d.dateFin.getTime(), cadre.fin.getTime()));
    let garde = 0;
    while (cur <= stop && garde < 400) {
      if (jourModele(cur) !== null) {
        const idx = indexMoisScolaire(cur, cadre.debut);
        if (idx !== null) cumuler(idx, 2, heuresJourNonEnseignant, "autorisee");
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
      garde++;
    }
  }

  const presentationTrimestrielle = cadre.regime.regime === "sequence";
  const decoupage = decoupagePeriodes(cadre.regime.regime === "semestre" ? "semestre" : "trimestre");

  const aujourdHui = new Date();
  const idxAujourdHui =
    aujourdHui >= cadre.debut && aujourdHui <= new Date(cadre.fin.getTime() + 24 * 3600 * 1000)
      ? indexMoisScolaire(aujourdHui, cadre.debut)
      : null;

  const periodes: PeriodeBilan[] = decoupage.map((p) => {
    const tranche = mois.slice(p.de, p.a + 1);
    return {
      libelle: p.libelle,
      demiJournees: tranche.reduce((s, m) => s + m.demiJournees, 0),
      heures: tranche.reduce((s, m) => s + m.heures, 0),
      enCours: idxAujourdHui !== null && idxAujourdHui >= p.de && idxAujourdHui <= p.a,
    };
  });

  return {
    anneeLibelle: cadre.anneeLibelle,
    regimeLibelle: presentationTrimestrielle
      ? `${cadre.regime.libelle} — totaux présentés par trimestre`
      : cadre.regime.libelle,
    libellePeriode: cadre.regime.regime === "semestre" ? "Semestre" : "Trimestre",
    presentationTrimestrielle,
    parMois: mois,
    periodes,
    annuel: {
      demiJournees: mois.reduce((s, m) => s + m.demiJournees, 0),
      heures: mois.reduce((s, m) => s + m.heures, 0),
    },
    moisEnCours:
      idxAujourdHui === null
        ? null
        : { libelle: mois[idxAujourdHui].libelle, demiJournees: mois[idxAujourdHui].demiJournees, heures: mois[idxAujourdHui].heures },
    heuresDuesParJour,
  };
}

/** Taux « heures dues/jour » du demandeur selon son rôle ACTUEL (note informative du bilan). */
function tauxDemandeur(demandeurId: string, heuresJourPar: Map<string, number>, rolePar: Map<string, string>): number {
  return rolePar.get(demandeurId) === "enseignant"
    ? heuresJourPar.get(demandeurId) ?? HEBDO_NON_ENSEIGNANT / JOURS_OUVRABLES_SEMAINE
    : HEBDO_NON_ENSEIGNANT / JOURS_OUVRABLES_SEMAINE;
}

/**
 * Bilan des heures d'absence d'un établissement, ou d'un seul demandeur si `demandeurId`
 * est fourni. Le périmètre (droit de voir cet établissement / ce demandeur) est vérifié
 * par l'appelant — ici on ne fait qu'agréger.
 */
export async function bilanHeuresAbsences(params: {
  etablissementId: string;
  demandeurId?: string;
}): Promise<BilanHeures> {
  const { etablissementId, demandeurId } = params;
  const cadre = await chargerCadre(etablissementId);
  const { absences, demandes } = await chargerDonnees(etablissementId, cadre, demandeurId);
  const ids = [...new Set([...absences.map((a) => a.enseignantId), ...(demandeurId ? [demandeurId] : [])])];
  const { heuresJourPar, rolePar } = await chargerProfils(cadre, ids);
  return construireBilan(
    cadre, absences, demandes, heuresJourPar,
    demandeurId ? tauxDemandeur(demandeurId, heuresJourPar, rolePar) : null,
  );
}

/**
 * Variante DIRECTION (chef / admin d'établissement / ACE) : bilans de l'établissement ET du
 * demandeur en UN SEUL chargement (le jeu individuel est un sous-ensemble du jeu établissement),
 * pour ne pas doubler les requêtes sur la page des autorisations d'absence.
 */
export async function bilansAbsencesDirection(params: {
  etablissementId: string;
  demandeurId: string;
}): Promise<{ etablissement: BilanHeures; demandeur: BilanHeures }> {
  const { etablissementId, demandeurId } = params;
  const cadre = await chargerCadre(etablissementId);
  const { absences, demandes } = await chargerDonnees(etablissementId, cadre);
  const ids = [...new Set([...absences.map((a) => a.enseignantId), demandeurId])];
  const { heuresJourPar, rolePar } = await chargerProfils(cadre, ids);
  return {
    etablissement: construireBilan(cadre, absences, demandes, heuresJourPar, null),
    demandeur: construireBilan(
      cadre,
      absences.filter((a) => a.enseignantId === demandeurId),
      demandes.filter((d) => d.demandeurId === demandeurId),
      heuresJourPar,
      tauxDemandeur(demandeurId, heuresJourPar, rolePar),
    ),
  };
}
