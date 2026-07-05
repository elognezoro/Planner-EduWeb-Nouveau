"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { resoudre } from "@/lib/solveur";
import {
  periodesParBloc,
  periodesMatinApresMidi,
  creneauxHoraires,
  bandesPause,
} from "@/lib/emploi-du-temps/horaires";
import { construireProbleme } from "@/lib/emploi-du-temps/construire-probleme";
import { tableauEdtHtml, gabaritEdtClasse } from "@/lib/emploi-du-temps/email";
import { envoyerEmail } from "@/lib/email/send";

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

  // Plage sans cours de l'établissement : on ne peut pas y déposer un cours.
  const decoupeMA = periodesMatinApresMidi(etab);
  const plagesSC = Array.isArray(etab.plagesSansCours)
    ? (etab.plagesSansCours as { jour?: unknown; moment?: unknown }[])
    : [];
  for (const pl of plagesSC) {
    if (Number(pl?.jour) !== jour) continue;
    const moment = String(pl?.moment ?? "");
    const fermees = new Set<number>(
      moment === "journee"
        ? Array.from({ length: N }, (_, i) => i)
        : moment === "matin"
          ? decoupeMA?.matin ?? []
          : moment === "apresmidi"
            ? decoupeMA?.apresMidi ?? []
            : [],
    );
    for (let d = 0; d < cr.duree; d++) {
      if (fermees.has(periode + d)) {
        return { ok: false, message: "Impossible : ce créneau est une plage sans cours de l'établissement." };
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

    const couvre = await tableCompositionDisciplines();
    const probleme = construireProbleme({
      etab,
      etablissementId: id,
      classes,
      sallesDb,
      grilles,
      effectifs,
      enseignantsReels,
      couvre,
    });

    if (probleme.blocs.length === 0) {
      return { ok: false, message: "Aucun volume horaire défini. Renseignez la grille (Volumes horaires)." };
    }

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

/** Adresse interne générée par la plateforme (comptes créés en masse) : ne pas y expédier. */
function estAdresseInterne(email: string): boolean {
  const domaine = email.split("@")[1]?.toLowerCase() ?? "";
  return domaine !== "eduweb.ci" && domaine.endsWith(".eduweb.ci");
}

/**
 * Envoie l'emploi du temps de la classe PAR E-MAIL aux concernés : les élèves inscrits,
 * leurs parents et les enseignants intervenant dans la classe. Les adresses internes
 * (comptes générés automatiquement, sans boîte réelle) sont ignorées et comptées.
 */
export async function envoyerEdtParEmail(
  _prev: EtatGeneration,
  formData: FormData,
): Promise<EtatGeneration> {
  const id = String(formData.get("etablissementId") ?? "");
  const classeId = String(formData.get("classeId") ?? "");
  if (!id || !classeId) return { ok: false, message: "Paramètres manquants." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const classe = await prisma.classe.findUnique({
      where: { id: classeId },
      select: { nom: true, etablissementId: true },
    });
    if (!classe || classe.etablissementId !== id) {
      return { ok: false, message: "Classe introuvable dans cet établissement." };
    }
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    if (!etab) return { ok: false, message: "Établissement introuvable." };

    const creneaux = await prisma.creneau.findMany({
      where: { etablissementId: id, classeId },
      orderBy: [{ jour: "asc" }, { periode: "asc" }],
    });
    if (creneaux.length === 0) {
      return { ok: false, message: "Aucun emploi du temps généré pour cette classe." };
    }

    // Destinataires concernés : élèves inscrits (année active), leurs parents,
    // enseignants nominatifs de la classe.
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } });
    const inscriptions = await prisma.inscription.findMany({
      where: { classeId, ...(annee ? { anneeScolaireId: annee.id } : {}) },
      select: { eleveId: true, eleve: { select: { email: true } } },
    });
    const liens = await prisma.lienParentEleve.findMany({
      where: { eleveId: { in: inscriptions.map((i) => i.eleveId) } },
      select: { parent: { select: { email: true } } },
    });
    // Les créneaux issus d'effectifs déclarés portent des enseignants ANONYMES
    // (« cycle:disciplineId#k », jamais un id de compte) : ils n'ont pas d'e-mail. On
    // ne requête que les vrais comptes et on compte les créneaux orphelins pour le rapport.
    const idsCreneaux = [...new Set(creneaux.map((c) => c.enseignantId))];
    const idsReels = idsCreneaux.filter((x) => !x.includes(":") && !x.includes("#"));
    const enseignantsAnonymes = idsCreneaux.length - idsReels.length;
    const enseignants = idsReels.length
      ? await prisma.utilisateur.findMany({ where: { id: { in: idsReels } }, select: { email: true } })
      : [];

    const groupes: [string, string[]][] = [
      ["élèves", inscriptions.map((i) => i.eleve.email)],
      ["parents", liens.map((l) => l.parent.email)],
      ["enseignants", enseignants.map((e) => e.email)],
    ];
    const vus = new Set<string>();
    const destinataires: string[] = [];
    const detail: string[] = [];
    let internes = 0;
    for (const [libelle, emails] of groupes) {
      let retenus = 0;
      for (const email of emails) {
        const propre = email.trim().toLowerCase();
        if (!propre || vus.has(propre)) continue;
        vus.add(propre);
        if (estAdresseInterne(propre)) {
          internes++;
          continue;
        }
        destinataires.push(propre);
        retenus++;
      }
      detail.push(`${retenus} ${libelle}`);
    }

    if (destinataires.length === 0) {
      return {
        ok: false,
        message: `Aucune adresse e-mail réelle parmi les concernés (${internes} adresse(s) interne(s) de comptes générés ignorée(s)). Renseignez les vraies adresses dans les comptes.`,
      };
    }

    const horaires = creneauxHoraires(etab);
    const bandes = bandesPause(etab);
    const lienApp = `${process.env.NEXTAUTH_URL ?? "https://planning.eduweb.ci"}/app/vie-scolaire/emplois-du-temps`;
    const { subject, html } = gabaritEdtClasse({
      classeNom: classe.nom,
      etablissementNom: etab.nom,
      anneeScolaire: etab.anneeScolaire,
      tableau: tableauEdtHtml(creneaux, horaires, bandes),
      lienApp,
    });

    // Envoi par petits lots (limites de débit du fournisseur).
    let envoyes = 0;
    let echecs = 0;
    let simule = false;
    const LOT = 8;
    for (let i = 0; i < destinataires.length; i += LOT) {
      const resultats = await Promise.allSettled(
        destinataires.slice(i, i + LOT).map((to) => envoyerEmail({ to, subject, html })),
      );
      for (const r of resultats) {
        if (r.status === "fulfilled") {
          envoyes++;
          if (r.value.simule) simule = true;
        } else {
          echecs++;
          console.error("[edt email] échec :", r.reason);
        }
      }
    }

    const complements = [
      internes > 0 ? `${internes} adresse(s) interne(s) ignorée(s)` : "",
      enseignantsAnonymes > 0
        ? `${enseignantsAnonymes} enseignant(s) non nominatif(s) (effectifs déclarés) sans e-mail`
        : "",
      echecs > 0 ? `${echecs} échec(s)` : "",
      simule ? "envoi SIMULÉ (clé Resend absente)" : "",
    ].filter(Boolean).join(" · ");
    return {
      ok: echecs === 0,
      message: `Emploi du temps de ${classe.nom} envoyé à ${envoyes} destinataire(s) (${detail.join(", ")}).${complements ? ` ${complements}.` : ""}`,
    };
  } catch (e) {
    console.error("[edt email] erreur :", e);
    return { ok: false, message: "Erreur technique lors de l'envoi." };
  }
}
