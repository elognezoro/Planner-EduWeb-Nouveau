"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { resoudre, type BlocCours, type SalleSolveur, type Probleme, type EnseignantUnite } from "@/lib/solveur";
import { periodesParBloc } from "@/lib/emploi-du-temps/horaires";

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
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId === etablissementId) {
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
    const qualifies = (niveauId: string, disciplineId: string) =>
      teachers.filter(
        (t) =>
          t.competences.some((c) => c.disciplineId === disciplineId) &&
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
    const unitesReellesParPool = new Map<string, EnseignantUnite[]>();
    for (const t of enseignantsReels) {
      const cycles = new Set(t.niveauxIntervention.map((n) => n.niveau.cycle));
      const nom = [t.prenoms, t.nom].filter(Boolean).join(" ") || t.email;
      for (const comp of t.competences) {
        for (const cycle of cycles) {
          const pool = `${cycle}:${comp.disciplineId}`;
          const arr = unitesReellesParPool.get(pool) ?? [];
          arr.push({ id: t.id, pool, nom });
          unitesReellesParPool.set(pool, arr);
        }
      }
    }

    const enseignants: EnseignantUnite[] = [];
    const poolsEffectifs = new Set<string>();
    for (const ef of effectifs) {
      const pool = `${ef.cycle}:${ef.disciplineId}`;
      poolsEffectifs.add(pool);
      const reels = unitesReellesParPool.get(pool);
      if (reels && reels.length > 0) {
        enseignants.push(...reels);
      } else {
        const lib = CYCLE_LABEL[ef.cycle] ?? ef.cycle;
        for (let k = 1; k <= ef.nombre; k++) {
          enseignants.push({ id: `${pool}#${k}`, pool, nom: `${ef.discipline.nom} (${lib}) #${k}` });
        }
      }
    }
    // Vrais enseignants dont le pool n'a pas d'effectif déclaré : on les inclut quand même.
    for (const [pool, reels] of unitesReellesParPool) {
      if (!poolsEffectifs.has(pool)) enseignants.push(...reels);
    }

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

      for (const [discId, info] of disciplinesNiveau) {
        info.seances.forEach((minutes, i) => {
          blocs.push({
            id: `${classe.id}:${discId}:${i}`,
            classeId: classe.id,
            classeNom: classe.nom,
            effectif: classe.effectif,
            vacationGroupe,
            disciplineId: discId,
            disciplineNom: info.nom,
            enseignantPool: `${cycle}:${discId}`,
            poolLabel: `${info.nom} (${cycleLib})`,
            duree: Math.max(1, Math.round(minutes / 60)),
            salleTypeRequis: TYPE_SALLE_REQUIS[info.nom] ?? null,
          });
        });
      }
    }

    if (blocs.length === 0) {
      return { ok: false, message: "Aucun volume horaire défini. Renseignez la grille (Volumes horaires)." };
    }

    const joursOuvres = 5;
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
    const slotsSemaine = joursOuvres * periodesParJour;
    for (const [type, demande] of demandeParType) {
      const existantes = detaillees.filter((s) => s.type === type);
      salles.push(...existantes);
      // Nombre requis pour écouler la demande, avec une marge pour laisser respirer le solveur.
      const requis = Math.max(1, Math.ceil(demande / Math.max(1, slotsSemaine)) + 1);
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
