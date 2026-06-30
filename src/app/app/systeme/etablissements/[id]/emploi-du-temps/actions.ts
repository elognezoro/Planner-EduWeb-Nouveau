"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { resoudre, type BlocCours, type SalleSolveur, type Probleme } from "@/lib/solveur";

export interface EtatGeneration {
  ok: boolean;
  message?: string;
  blocages?: string[];
  stats?: { blocs: number; places: number };
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
const TYPE_SALLE_REQUIS: Record<string, string> = {
  Informatique: "salle_informatique",
};

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
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

    const [classes, sallesDb, grilles, affectations, anneeActive] = await Promise.all([
      prisma.classe.findMany({
        where: { etablissementId: id },
        orderBy: [{ niveauId: "asc" }, { nom: "asc" }],
        include: { niveau: { select: { id: true, nom: true } } },
      }),
      prisma.salle.findMany({ where: { etablissementId: id } }),
      prisma.grilleHoraire.findMany({ where: { OR: [{ etablissementId: id }, { etablissementId: null }] }, include: { discipline: { select: { id: true, nom: true } } } }),
      prisma.affectationEnseignant.findMany({
        where: { classe: { etablissementId: id } },
        include: { enseignant: { select: { id: true, prenoms: true, nom: true, email: true } }, discipline: { select: { id: true, nom: true } } },
      }),
      prisma.anneeScolaire.findFirst({ where: { active: true } }),
    ]);

    if (classes.length === 0) {
      return { ok: false, message: "Aucune classe. Calculez d'abord les classes pédagogiques." };
    }

    // Grille effective par (niveau, discipline) : surcharge établissement prioritaire.
    const grilleEtab = new Map<string, { seances: number[]; disc: { id: string; nom: string } }>();
    const grilleNat = new Map<string, { heures: number; disc: { id: string; nom: string } }>();
    for (const g of grilles) {
      const cle = `${g.niveauId}:${g.disciplineId}`;
      if (g.etablissementId === id) grilleEtab.set(cle, { seances: g.seancesMinutes, disc: g.discipline });
      else grilleNat.set(cle, { heures: g.heuresHebdo, disc: g.discipline });
    }

    // Affectation : (classeId:disciplineId) -> enseignant
    const affMap = new Map<string, { id: string; nom: string }>();
    for (const a of affectations) {
      affMap.set(`${a.classeId}:${a.disciplineId}`, { id: a.enseignant.id, nom: nomComplet(a.enseignant) });
    }

    // Groupes de vacation : par niveau, on alterne les classes en double vacation.
    const compteurNiveau = new Map<string, number>();

    const blocs: BlocCours[] = [];
    const blocages: string[] = [];

    for (const classe of classes) {
      const cle = (discId: string) => `${classe.niveau.id}:${discId}`;
      // Construit la liste des disciplines de ce niveau depuis la grille.
      const disciplinesNiveau = new Map<string, { nom: string; seances: number[] }>();
      for (const [k, v] of grilleEtab) {
        if (k.startsWith(`${classe.niveau.id}:`) && v.seances.length > 0) {
          disciplinesNiveau.set(v.disc.id, { nom: v.disc.nom, seances: v.seances });
        }
      }
      for (const [k, v] of grilleNat) {
        if (k.startsWith(`${classe.niveau.id}:`) && !disciplinesNiveau.has(v.disc.id) && v.heures > 0) {
          const nb = Math.max(1, Math.round(v.heures));
          disciplinesNiveau.set(v.disc.id, { nom: v.disc.nom, seances: Array.from({ length: nb }, () => 60) });
        }
      }

      // Vacation
      let vacationGroupe: 0 | 1 | null = null;
      if (classe.regimeVacation === "double") {
        const idx = compteurNiveau.get(classe.niveau.id) ?? 0;
        vacationGroupe = (idx % 2) as 0 | 1;
        compteurNiveau.set(classe.niveau.id, idx + 1);
      }

      for (const [discId, info] of disciplinesNiveau) {
        const ens = affMap.get(`${classe.id}:${discId}`);
        if (!ens) {
          const msg = `Aucun enseignant affecté à ${info.nom} pour ${classe.nom}.`;
          if (!blocages.includes(msg)) blocages.push(msg);
          continue;
        }
        info.seances.forEach((minutes, i) => {
          blocs.push({
            id: `${classe.id}:${discId}:${i}`,
            classeId: classe.id,
            classeNom: classe.nom,
            effectif: classe.effectif,
            vacationGroupe,
            disciplineId: discId,
            disciplineNom: info.nom,
            enseignantId: ens.id,
            enseignantNom: ens.nom,
            duree: Math.max(1, Math.round(minutes / 60)),
            salleTypeRequis: TYPE_SALLE_REQUIS[info.nom] ?? null,
          });
        });
      }
      void cle;
    }

    if (blocages.length > 0) {
      return {
        ok: false,
        message: "Génération impossible : des affectations manquent.",
        blocages,
      };
    }
    if (blocs.length === 0) {
      return { ok: false, message: "Aucun volume horaire défini. Renseignez la grille (Volumes horaires)." };
    }

    // Salles : individuelles si déclarées, sinon synthétisées depuis le nombre déclaré.
    let salles: SalleSolveur[];
    let appliquerTypeSalle: boolean;
    if (sallesDb.length > 0) {
      salles = sallesDb.map((s) => ({ nom: s.nom, capacite: s.capacite, type: s.type }));
      appliquerTypeSalle = true;
    } else {
      const cap = Math.max(etab.effectifSouhaiteParClasse, ...classes.map((c) => c.effectif), 40);
      const nb = Math.max(1, etab.nbSallesDisponibles);
      salles = Array.from({ length: nb }, (_, i) => ({ nom: `Salle ${i + 1}`, capacite: cap, type: "ordinaire" }));
      appliquerTypeSalle = false;
    }

    const probleme: Probleme = {
      joursOuvres: 5,
      periodesParJour: Math.max(1, etab.creneauxParJour),
      salles,
      blocs,
      appliquerTypeSalle,
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
    return {
      ok: true,
      message: `Emploi du temps généré : ${resultat.stats.places} créneaux placés sans conflit.`,
      stats: resultat.stats,
    };
  } catch (e) {
    console.error("[generation edt] erreur :", e);
    return { ok: false, message: "Erreur technique lors de la génération." };
  }
}
