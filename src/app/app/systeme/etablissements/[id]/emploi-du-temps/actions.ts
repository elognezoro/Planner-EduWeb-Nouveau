"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { resoudre, type BlocCours, type SalleSolveur, type Probleme, type EnseignantUnite } from "@/lib/solveur";
import { periodesParBloc, periodesDansPlages } from "@/lib/emploi-du-temps/horaires";

export interface EtatGeneration {
  ok: boolean;
  message?: string;
  blocages?: string[];
  stats?: { blocs: number; places: number };
  qualite?: {
    score: number;
    scoreInitial: number;
    penalites: { trous: number; repartition: number; consecutives: number; finJournee: number; pauseMidi: number };
  };
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin") return u;
  // Le gestionnaire de l'établissement (admin d'établissements ou chef) génère LE SIEN —
  // même règle que la console de configuration et que la page emploi-du-temps.
  if (
    (u.roleReel === "etablissements_admin" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  return null;
}

// Disciplines nécessitant un type de salle spécifique (cahier §5.3.0-c).
// La clé est le nom de la discipline ; la valeur, le `type` de salle requis (enum TypeSalle).
const TYPE_SALLE_REQUIS: Record<string, string> = {
  Informatique: "salle_informatique",
  EPS: "salle_eps", // Éducation physique : sur un plateau sportif, jamais en salle de classe.
};

// Libellé générique d'une salle synthétisée selon son type.
const NOM_SALLE_TYPE: Record<string, string> = {
  salle_informatique: "Salle informatique",
  salle_eps: "Plateau sportif",
  laboratoire: "Laboratoire",
  atelier: "Atelier",
  ordinaire: "Salle",
};

/**
 * Répartit AUTOMATIQUEMENT les enseignants dans les classes pédagogiques (crée les affectations),
 * selon leurs disciplines (compétences) et les niveaux où ils interviennent. Équilibrage de charge
 * en round-robin. Remplace les affectations existantes de l'établissement.
 */
export async function affecterAutomatiquement(
  _prev: EtatGeneration,
  formData: FormData,
): Promise<EtatGeneration> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const paysEtab = (await prisma.etablissement.findUnique({ where: { id }, select: { pays: true } }))?.pays ?? "Côte d'Ivoire";
    const [classes, grilles, teachers] = await Promise.all([
      prisma.classe.findMany({ where: { etablissementId: id }, include: { niveau: { select: { id: true, nom: true } } } }),
      prisma.grilleHoraire.findMany({ where: { OR: [{ etablissementId: id }, { etablissementId: null, pays: paysEtab }] }, include: { discipline: { select: { id: true, nom: true } } } }),
      prisma.utilisateur.findMany({
        where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } },
        include: { competences: { select: { disciplineId: true } }, niveauxIntervention: { select: { niveauId: true } } },
      }),
    ]);
    if (classes.length === 0) {
      return { ok: false, message: "Aucune classe. Calculez d'abord les classes pédagogiques." };
    }

    const gEtab = new Map<string, { disc: { id: string; nom: string }; seances: number[] }>();
    const gNat = new Map<string, { disc: { id: string; nom: string }; heures: number }>();
    for (const g of grilles) {
      const k = `${g.niveauId}:${g.disciplineId}`;
      if (g.etablissementId === id) gEtab.set(k, { disc: g.discipline, seances: g.seancesMinutes });
      else gNat.set(k, { disc: g.discipline, heures: g.heuresHebdo });
    }
    const disciplinesDuNiveau = (niveauId: string): { id: string; nom: string }[] => {
      const m = new Map<string, { id: string; nom: string }>();
      for (const [k, v] of gEtab) if (k.startsWith(`${niveauId}:`) && v.seances.length > 0) m.set(v.disc.id, v.disc);
      for (const [k, v] of gNat) if (k.startsWith(`${niveauId}:`) && !m.has(v.disc.id) && v.heures > 0) m.set(v.disc.id, v.disc);
      return [...m.values()];
    };
    // Un bivalent attribué au couple « X / Y » est qualifié pour X et pour Y.
    const couvre = await tableCompositionDisciplines();
    const qualifies = (niveauId: string, disciplineId: string) =>
      teachers.filter(
        (t) =>
          t.competences.some((c) => (couvre.get(c.disciplineId) ?? [c.disciplineId]).includes(disciplineId)) &&
          t.niveauxIntervention.some((n) => n.niveauId === niveauId),
      );

    await prisma.affectationEnseignant.deleteMany({ where: { classe: { etablissementId: id } } });

    const charge = new Map<string, number>();
    const aCreer: { enseignantId: string; classeId: string; disciplineId: string }[] = [];
    const manquants = new Set<string>();
    for (const classe of classes) {
      for (const d of disciplinesDuNiveau(classe.niveau.id)) {
        const pool = qualifies(classe.niveau.id, d.id);
        if (pool.length === 0) {
          manquants.add(`${d.nom} (niveau ${classe.niveau.nom})`);
          continue;
        }
        pool.sort((a, b) => (charge.get(a.id) ?? 0) - (charge.get(b.id) ?? 0));
        const t = pool[0];
        charge.set(t.id, (charge.get(t.id) ?? 0) + 1);
        aCreer.push({ enseignantId: t.id, classeId: classe.id, disciplineId: d.id });
      }
    }
    if (aCreer.length > 0) {
      await prisma.affectationEnseignant.createMany({ data: aCreer, skipDuplicates: true });
    }

    revalidatePath(`/app/systeme/etablissements/${id}/emploi-du-temps`);
    revalidatePath(`/app/systeme/etablissements/${id}`);

    const note = manquants.size > 0 ? ` Disciplines sans enseignant compétent : ${[...manquants].slice(0, 8).join(", ")}.` : "";
    return {
      ok: true,
      message: `${aCreer.length} affectation(s) créée(s) automatiquement.${note}`,
      blocages: manquants.size > 0 ? [...manquants].map((m) => `Aucun enseignant compétent pour ${m}.`) : undefined,
    };
  } catch (e) {
    console.error("[auto-affectation] erreur :", e);
    return { ok: false, message: "Erreur lors de l'affectation automatique." };
  }
}

/**
 * Déplace un créneau (glisser-déposer) avec RE-VÉRIFICATION des contraintes dures (cahier §5.3.0-g) :
 * ne valide jamais un conflit enseignant / classe / salle.
 */
export async function deplacerCreneau(
  creneauId: string,
  jour: number,
  periode: number,
): Promise<{ ok: boolean; message?: string }> {
  const cr = await prisma.creneau.findUnique({ where: { id: creneauId } });
  if (!cr) return { ok: false, message: "Créneau introuvable." };
  const u = await peutGerer(cr.etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const etab = await prisma.etablissement.findUnique({ where: { id: cr.etablissementId } });
  if (!etab) return { ok: false, message: "Établissement introuvable." };
  const N = Math.max(1, etab.creneauxParJour);
  if (jour < 0 || jour > 4 || periode < 0 || periode + cr.duree > N) {
    return { ok: false, message: "Position hors de la grille." };
  }

  // Un cours de plusieurs périodes ne peut pas traverser une pause (RÉCRÉATION / PAUSE
  // DÉJEUNER) — même règle que le solveur, re-vérifiée au glisser-déposer.
  const decoupe = periodesParBloc(etab);
  if (cr.duree > 1 && decoupe && decoupe.reduce((a, b) => a + b, 0) === N) {
    let fin = 0;
    for (const taille of decoupe) {
      fin += taille;
      if (periode < fin) {
        if (periode + cr.duree > fin) {
          return { ok: false, message: "Impossible : ce cours traverserait une pause (récréation ou pause déjeuner)." };
        }
        break;
      }
    }
  }

  const autres = await prisma.creneau.findMany({
    where: { etablissementId: cr.etablissementId, id: { not: creneauId } },
  });
  for (let d = 0; d < cr.duree; d++) {
    const p = periode + d;
    for (const o of autres) {
      if (o.jour !== jour) continue;
      if (p < o.periode || p >= o.periode + o.duree) continue;
      if (o.enseignantId === cr.enseignantId)
        return { ok: false, message: `Conflit : ${cr.enseignantNom} a déjà cours à ce créneau.` };
      if (o.classeId === cr.classeId)
        return { ok: false, message: `Conflit : ${cr.classeNom} a déjà cours à ce créneau.` };
      if (o.salleNom === cr.salleNom)
        return { ok: false, message: `Conflit : la salle ${cr.salleNom} est déjà occupée.` };
    }
  }

  await prisma.creneau.update({ where: { id: creneauId }, data: { jour, periode } });
  revalidatePath(`/app/systeme/etablissements/${cr.etablissementId}/emploi-du-temps`);
  return { ok: true };
}

const CYCLE_LABEL: Record<string, string> = { college: "collège", lycee: "lycée", primaire: "primaire", prescolaire: "préscolaire" };

/**
 * Décomposition des couples de spécialités : une compétence ou un effectif déclaré sur la
 * discipline couple « X / Y » couvre les disciplines simples X et Y. Renvoie, pour une
 * discipline, la liste des ids couverts (elle-même + ses composantes résolues par nom).
 */
async function tableCompositionDisciplines(): Promise<Map<string, string[]>> {
  const toutes = await prisma.discipline.findMany({ select: { id: true, nom: true } });
  const idParNom = new Map(toutes.map((d) => [d.nom.trim(), d.id]));
  const couvre = new Map<string, string[]>();
  for (const d of toutes) {
    const ids = new Set<string>([d.id]);
    if (d.nom.includes("/")) {
      for (const part of d.nom.split("/")) {
        const composant = idParNom.get(part.trim());
        if (composant) ids.add(composant);
      }
    }
    couvre.set(d.id, [...ids]);
  }
  return couvre;
}

export async function genererEmploiDuTemps(
  _prev: EtatGeneration,
  formData: FormData,
): Promise<EtatGeneration> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    if (!etab) return { ok: false, message: "Établissement introuvable." };

    const [classes, sallesDb, grilles, effectifs, enseignantsReels, anneeActive] = await Promise.all([
      prisma.classe.findMany({
        where: { etablissementId: id },
        orderBy: [{ niveauId: "asc" }, { nom: "asc" }],
        include: { niveau: { select: { id: true, nom: true, cycle: true } } },
      }),
      prisma.salle.findMany({ where: { etablissementId: id } }),
      prisma.grilleHoraire.findMany({
        where: { OR: [{ etablissementId: id }, { etablissementId: null, pays: etab.pays ?? "Côte d'Ivoire" }] },
        include: { discipline: { select: { id: true, nom: true } } },
      }),
      prisma.effectifEnseignant.findMany({ where: { etablissementId: id }, include: { discipline: { select: { nom: true } } } }),
      prisma.utilisateur.findMany({
        where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } },
        select: {
          id: true, prenoms: true, nom: true, email: true,
          competences: { select: { disciplineId: true } },
          niveauxIntervention: { select: { niveau: { select: { cycle: true } } } },
        },
      }),
      prisma.anneeScolaire.findFirst({ where: { active: true } }),
    ]);

    if (classes.length === 0) {
      return { ok: false, message: "Aucune classe. Calculez d'abord les classes pédagogiques." };
    }

    // Grille effective par (niveau, discipline) : surcharge établissement prioritaire.
    const grilleEtab = new Map<string, { seances: number[]; disc: { id: string; nom: string } }>();
    const grilleNat = new Map<string, { heures: number; disc: { id: string; nom: string } }>();
    const niveauxAvecOverride = new Set<string>();
    for (const g of grilles) {
      const cle = `${g.niveauId}:${g.disciplineId}`;
      if (g.etablissementId === id) {
        grilleEtab.set(cle, { seances: g.seancesMinutes, disc: g.discipline });
        if (g.seancesMinutes.length > 0) niveauxAvecOverride.add(g.niveauId);
      } else {
        grilleNat.set(cle, { heures: g.heuresHebdo, disc: g.discipline });
      }
    }

    // Unités-enseignants par pool (cycle:disciplineId).
    // On privilégie les VRAIS comptes enseignants (compétence = discipline, niveaux → cycle) afin
    // que l'emploi du temps affiche leurs noms. À défaut, on retombe sur des unités anonymes issues
    // des effectifs déclarés (compatibilité : pas besoin de comptes nominatifs pour générer).
    // Les couples de spécialités sont décomposés : un bivalent « X / Y » alimente les pools de X
    // ET de Y avec la MÊME unité (id partagé) — le solveur garantit par l'id qu'il n'enseigne
    // qu'à un endroit à la fois.
    const couvre = await tableCompositionDisciplines();
    const unitesParPool = new Map<string, EnseignantUnite[]>();
    const ajouterUnite = (pool: string, id: string, nom: string) => {
      const arr = unitesParPool.get(pool) ?? [];
      if (!arr.some((u) => u.id === id)) arr.push({ id, pool, nom });
      unitesParPool.set(pool, arr);
    };

    const poolsReels = new Set<string>();
    for (const t of enseignantsReels) {
      const cycles = new Set(t.niveauxIntervention.map((n) => n.niveau.cycle));
      const nom = [t.prenoms, t.nom].filter(Boolean).join(" ") || t.email;
      for (const comp of t.competences) {
        for (const cycle of cycles) {
          for (const dId of couvre.get(comp.disciplineId) ?? [comp.disciplineId]) {
            const pool = `${cycle}:${dId}`;
            ajouterUnite(pool, t.id, nom);
            poolsReels.add(pool);
          }
        }
      }
    }

    for (const ef of effectifs) {
      if (ef.nombre <= 0) continue;
      const lib = CYCLE_LABEL[ef.cycle] ?? ef.cycle;
      for (const dId of couvre.get(ef.disciplineId) ?? [ef.disciplineId]) {
        const pool = `${ef.cycle}:${dId}`;
        // Des comptes réels couvrent déjà ce pool : ils priment sur les unités anonymes.
        if (poolsReels.has(pool)) continue;
        for (let k = 1; k <= ef.nombre; k++) {
          ajouterUnite(pool, `${ef.cycle}:${ef.disciplineId}#${k}`, `${ef.discipline.nom} (${lib}) #${k}`);
        }
      }
    }

    const enseignants: EnseignantUnite[] = [...unitesParPool.values()].flat();

    // Plages horaires d'EPS de l'établissement → indices de périodes autorisées pour l'EPS.
    // Null si aucune plage configurée : l'EPS reste libre sur toute la journée.
    const periodesEPS = periodesDansPlages(etab, [
      { debut: etab.epsMatinDebut, fin: etab.epsMatinFin },
      { debut: etab.epsApresMidiDebut, fin: etab.epsApresMidiFin },
    ]);

    // Conditions de vacation « X → double vacation : Non » (paramétrées par le chef) :
    // pour une classe en DOUBLE vacation, le jour où X (ex : EPS) est programmée devient
    // VACATION SIMPLE — la classe vient la journée entière ce jour-là, et les séances de X
    // y sont fixées. Le jour est réparti en tourniquet entre les classes concernées.
    const joursOuvres = 5;
    const normCond = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const conditionsBrutes = Array.isArray(etab.conditionsVacation)
      ? (etab.conditionsVacation as { libelle?: unknown; doubleVacation?: unknown }[])
      : [];
    const conditionsSimples = conditionsBrutes
      .filter((c) => c && c.doubleVacation === false && typeof c.libelle === "string")
      .map((c) => normCond(String(c.libelle)));
    const disciplinesVacationSimple = new Set<string>();
    if (conditionsSimples.length > 0) {
      for (const g of grilles) {
        const nomN = normCond(g.discipline.nom);
        if (nomN.length < 3) continue;
        // Correspondance par MOTS ENTIERS (« Cours d'EPS » ↔ « EPS ») — pas de sous-chaîne
        // libre (« Tice » ne matcherait pas « artice »). Les noms multi-mots (couples,
        // « Histoire-Géographie ») se comparent en sous-chaîne, peu ambigus.
        const multiMots = /[^a-z0-9]/.test(nomN);
        const correspond = conditionsSimples.some((cond) => {
          if (cond === nomN) return true;
          if (multiMots) return cond.includes(nomN);
          return cond.split(/[^a-z0-9]+/).includes(nomN);
        });
        if (correspond) disciplinesVacationSimple.add(g.disciplineId);
      }
    }
    let compteurJourSimple = 0;

    // Groupes de vacation : par niveau, on alterne les classes en double vacation.
    const compteurNiveau = new Map<string, number>();
    const blocs: BlocCours[] = [];

    for (const classe of classes) {
      const cycle = classe.niveau.cycle;
      const cycleLib = CYCLE_LABEL[cycle] ?? cycle;
      const disciplinesNiveau = new Map<string, { nom: string; seances: number[] }>();
      // Si l'établissement a sa propre grille pour ce niveau, on l'utilise EXCLUSIVEMENT
      // (on n'ajoute pas les disciplines du modèle national non configurées).
      if (niveauxAvecOverride.has(classe.niveau.id)) {
        for (const [k, v] of grilleEtab) {
          if (k.startsWith(`${classe.niveau.id}:`) && v.seances.length > 0) {
            disciplinesNiveau.set(v.disc.id, { nom: v.disc.nom, seances: v.seances });
          }
        }
      } else {
        for (const [k, v] of grilleNat) {
          if (k.startsWith(`${classe.niveau.id}:`) && v.heures > 0) {
            const nb = Math.max(1, Math.round(v.heures));
            // Séances unitaires de 55 minutes (modèle national ivoirien).
            disciplinesNiveau.set(v.disc.id, { nom: v.disc.nom, seances: Array.from({ length: nb }, () => 55) });
          }
        }
      }

      let vacationGroupe: 0 | 1 | null = null;
      if (classe.regimeVacation === "double") {
        const idx = compteurNiveau.get(classe.niveau.id) ?? 0;
        vacationGroupe = (idx % 2) as 0 | 1;
        compteurNiveau.set(classe.niveau.id, idx + 1);
      }

      // Jour de vacation simple de la classe (condition « X → double vacation : Non »).
      let jourSimple: number | null = null;
      let vacationParJour: (0 | 1 | null)[] | undefined;
      if (vacationGroupe !== null && disciplinesVacationSimple.size > 0) {
        const concernee = [...disciplinesNiveau.keys()].some((dId) => disciplinesVacationSimple.has(dId));
        if (concernee) {
          jourSimple = compteurJourSimple++ % joursOuvres;
          vacationParJour = Array.from({ length: joursOuvres }, (_, j) =>
            j === jourSimple ? null : vacationGroupe,
          );
        }
      }

      for (const [discId, info] of disciplinesNiveau) {
        info.seances.forEach((minutes, i) => {
          blocs.push({
            id: `${classe.id}:${discId}:${i}`,
            classeId: classe.id,
            classeNom: classe.nom,
            effectif: classe.effectif,
            vacationGroupe,
            vacationParJour,
            disciplineId: discId,
            disciplineNom: info.nom,
            enseignantPool: `${cycle}:${discId}`,
            poolLabel: `${info.nom} (${cycleLib})`,
            duree: Math.max(1, Math.round(minutes / 60)),
            salleTypeRequis: TYPE_SALLE_REQUIS[info.nom] ?? null,
            // L'EPS est confinée aux plages horaires d'EPS configurées par l'établissement.
            periodesAutorisees:
              TYPE_SALLE_REQUIS[info.nom] === "salle_eps" && periodesEPS ? periodesEPS : null,
            // Les séances de la discipline conditionnée sont fixées au jour de vacation simple.
            joursAutorises:
              jourSimple !== null && disciplinesVacationSimple.has(discId) ? [jourSimple] : null,
          });
        });
      }
    }

    if (blocs.length === 0) {
      return { ok: false, message: "Aucun volume horaire défini. Renseignez la grille (Volumes horaires)." };
    }

    const periodesParJour = Math.max(1, etab.creneauxParJour);

    // ── Salles ──
    // Salles ordinaires : détaillées + synthétisées jusqu'au NOMBRE DÉCLARÉ.
    // Salles spécialisées (EPS, informatique, labo…) : celles configurées, sinon on synthétise
    // le nombre nécessaire pour couvrir la demande — afin que ces cours ne tombent JAMAIS en
    // salle de classe (ex : l'EPS se fait sur un plateau sportif).
    const cap = Math.max(etab.effectifSouhaiteParClasse, ...classes.map((c) => c.effectif), 40);
    const detaillees: SalleSolveur[] = sallesDb.map((s) => ({ nom: s.nom, capacite: s.capacite, type: s.type }));

    const salles: SalleSolveur[] = [];
    // Ordinaires
    const ordinairesDetaillees = detaillees.filter((s) => s.type === "ordinaire");
    salles.push(...ordinairesDetaillees);
    const cibleOrdinaires = Math.max(etab.nbSallesDisponibles, ordinairesDetaillees.length, 1);
    for (let i = ordinairesDetaillees.length; i < cibleOrdinaires; i++) {
      salles.push({ nom: `Salle ${i + 1}`, capacite: cap, type: "ordinaire" });
    }

    // Types spécialisés requis par les cours.
    const demandeParType = new Map<string, number>();
    for (const b of blocs) {
      if (b.salleTypeRequis) demandeParType.set(b.salleTypeRequis, (demandeParType.get(b.salleTypeRequis) ?? 0) + b.duree);
    }
    for (const [type, demande] of demandeParType) {
      const existantes = detaillees.filter((s) => s.type === type);
      salles.push(...existantes);
      // Nombre requis pour écouler la demande, avec une marge pour laisser respirer le
      // solveur. Une salle confinée à des plages horaires (ex : plateau EPS) n'offre que
      // |plages| × jours créneaux par semaine — pas la journée entière.
      const periodesUtiles =
        type === "salle_eps" && periodesEPS ? Math.max(1, periodesEPS.length) : periodesParJour;
      const slotsParSalle = joursOuvres * periodesUtiles;
      const requis = Math.max(1, Math.ceil(demande / Math.max(1, slotsParSalle)) + 1);
      const libelle = NOM_SALLE_TYPE[type] ?? "Salle spécialisée";
      for (let i = existantes.length; i < requis; i++) {
        salles.push({ nom: `${libelle} ${i + 1}`, capacite: cap, type });
      }
    }

    // Autres salles détaillées non ordinaires et non requises (ex : atelier configuré) : conservées.
    for (const s of detaillees) {
      if (s.type !== "ordinaire" && !demandeParType.has(s.type)) salles.push(s);
    }

    const appliquerTypeSalle = demandeParType.size > 0 || detaillees.some((s) => s.type !== "ordinaire");

    const probleme: Probleme = {
      joursOuvres,
      periodesParJour,
      salles,
      enseignants,
      blocs,
      appliquerTypeSalle,
      blocsPeriodes: periodesParBloc(etab) ?? undefined,
      // Contraintes enseignants paramétrées par l'établissement.
      reposEnseignant: etab.reposEnseignant,
      optimiserEnseignants: etab.regrouperHeuresCreuses,
      // Choix du chef : autoriser des heures creuses dans l'EDT des élèves (pour souffler).
      autoriserHeuresCreusesEleves: etab.autoriserHeuresCreuses,
    };

    const resultat = resoudre(probleme);

    if (!resultat.ok) {
      return { ok: false, message: "Aucune solution complète trouvée.", blocages: resultat.blocages, stats: resultat.stats };
    }

    // Persistance : on remplace l'emploi du temps de l'établissement.
    await prisma.creneau.deleteMany({ where: { etablissementId: id } });
    await prisma.creneau.createMany({
      data: resultat.placements.map((pl) => ({
        etablissementId: id,
        classeId: pl.classeId,
        classeNom: pl.classeNom,
        disciplineId: pl.disciplineId,
        disciplineNom: pl.disciplineNom,
        enseignantId: pl.enseignantId,
        enseignantNom: pl.enseignantNom,
        salleNom: pl.salleNom,
        jour: pl.jour,
        periode: pl.periode,
        duree: pl.duree,
        anneeScolaireId: anneeActive?.id ?? null,
      })),
    });

    revalidatePath(`/app/systeme/etablissements/${id}/emploi-du-temps`);
    const q = resultat.qualite;
    return {
      ok: true,
      message: q
        ? `Emploi du temps généré : ${resultat.stats.places} créneaux placés sans conflit. Qualité ${q.score}/100 (optimisé depuis ${q.scoreInitial}/100).`
        : `Emploi du temps généré : ${resultat.stats.places} créneaux placés sans conflit.`,
      stats: resultat.stats,
      qualite: q,
    };
  } catch (e) {
    console.error("[generation edt] erreur :", e);
    return { ok: false, message: "Erreur technique lors de la génération." };
  }
}
