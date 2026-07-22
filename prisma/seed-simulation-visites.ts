/**
 * SIMULATION — cas de démonstration du module INSPECTION (« Mes visites ») sur les
 * établissements de la simulation catholique : un inspecteur fictif (spécialité
 * Mathématiques) et un conseiller pédagogique fictif (primaires), avec des visites
 * variées : programmée réalisée (note + recommandations), programmée à venir (avec
 * heure de séance), suivi inopiné réalisé, visite d'établissement planifiée, annulée.
 *
 *   npm run db:seed:simulation-visites            → (re)crée les cas (purge d'abord)
 *   RESET=1 npm run db:seed:simulation-visites    → SUPPRIME uniquement
 *
 * Tout pend aux comptes @simulation.eduweb.ci — la purge de la simulation principale
 * (seed-simulation-catholique) supprime AUSSI ces visites avant les comptes.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DOMAINE = "@simulation.eduweb.ci";
const EMAIL_INSPECTEUR = `inspecteur.insp${DOMAINE}`;
const EMAIL_CONSEILLER = `conseiller.insp${DOMAINE}`;
const jour = (decalage: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + decalage);
  return d;
};

async function purger(): Promise<void> {
  // Visites des encadreurs fictifs (les recommandations cascadent avec la visite).
  const encadreurs = await prisma.utilisateur.findMany({
    where: { email: { in: [EMAIL_INSPECTEUR, EMAIL_CONSEILLER] } },
    select: { id: true },
  });
  if (encadreurs.length > 0) {
    const ids = encadreurs.map((e) => e.id);
    const v = await prisma.visite.deleteMany({ where: { inspecteurId: { in: ids } } });
    await prisma.utilisateur.deleteMany({ where: { id: { in: ids } } });
    console.log(`Purge : ${v.count} visite(s) et ${ids.length} encadreur(s) fictif(s) supprimés.`);
  } else {
    console.log("Purge : aucun encadreur fictif de visites à supprimer.");
  }
}

async function main() {
  if (process.env.RESET === "1") {
    await purger();
    console.log("Réinitialisation terminée.");
    return;
  }
  await purger();

  const [roles, bingerville, jp2, aboboTe, sainteFamille, apfcAgboville] = await Promise.all([
    prisma.role.findMany({ where: { nomTechnique: { in: ["inspecteur", "conseiller_pedagogique"] } }, select: { id: true, nomTechnique: true } }),
    prisma.etablissement.findFirst({ where: { code: "000323" }, select: { id: true, nom: true, regionId: true } }),
    prisma.etablissement.findFirst({ where: { code: "033289" }, select: { id: true, nom: true } }),
    prisma.etablissement.findFirst({ where: { nom: { contains: "Abobo-Té" }, type: "primaire" }, select: { id: true, nom: true } }),
    prisma.etablissement.findFirst({ where: { code: "SIM-CATH-AGB-PRIM" }, select: { id: true, nom: true } }),
    prisma.apfc.findFirst({ where: { nom: "APFC Agboville" }, select: { id: true } }),
  ]);
  const roleId = (t: string) => {
    const r = roles.find((x) => x.nomTechnique === t)?.id;
    if (!r) throw new Error(`Rôle introuvable : ${t}`);
    return r;
  };
  if (!bingerville || !jp2) throw new Error("Établissements de la simulation introuvables — lancez d'abord db:seed:simulation-catholique.");

  const hash = randomBytes(32).toString("hex"); // comptes fictifs NON connectables

  // ── Encadreurs fictifs ──
  const inspecteur = await prisma.utilisateur.create({
    data: {
      email: EMAIL_INSPECTEUR, motDePasseHash: hash, prenoms: "Norbert", nom: "GNAKOURI", sexe: "M",
      statutCompte: "actif", emailVerifieLe: new Date(), roleActifId: roleId("inspecteur"),
      regionId: bingerville.regionId, pays: "Côte d'Ivoire",
      specialites: ["Mathématiques"],
    },
  });
  const conseiller = await prisma.utilisateur.create({
    data: {
      email: EMAIL_CONSEILLER, motDePasseHash: hash, prenoms: "Madeleine", nom: "AKA", sexe: "F",
      statutCompte: "actif", emailVerifieLe: new Date(), roleActifId: roleId("conseiller_pedagogique"),
      apfcId: apfcAgboville?.id ?? null, pays: "Côte d'Ivoire",
    },
  });

  // Couverture territoriale : la primaire fictive d'Agboville rejoint l'APFC Agboville
  // (créée après le seed de couverture — skipDuplicates respecte l'unicité par établissement).
  if (apfcAgboville && sainteFamille) {
    await prisma.couvertureApfc.createMany({
      data: [{ apfcId: apfcAgboville.id, etablissementId: sainteFamille.id }],
      skipDuplicates: true,
    });
  }

  // ── Enseignants et classes des établissements de simulation ──
  const profMaths = async (etablissementId: string) =>
    prisma.utilisateur.findFirst({
      where: {
        etablissementId, email: { endsWith: DOMAINE },
        roleActif: { nomTechnique: "enseignant" },
        competences: { some: { discipline: { nom: "Mathématiques" } } },
      },
      select: { id: true, prenoms: true, nom: true },
    });
  const maitreDe = async (etablissementId: string) =>
    prisma.utilisateur.findFirst({
      where: { etablissementId, email: { endsWith: DOMAINE }, roleActif: { nomTechnique: "enseignant" } },
      select: { id: true, prenoms: true, nom: true },
    });
  // Classe par nom ; repli : première classe de l'école ; dernier repli : nom dénormalisé
  // sans id (le modèle Visite le permet — l'affichage reste correct même sans la classe).
  const classeDe = async (etablissementId: string, nom: string) => {
    const exacte = await prisma.classe.findFirst({ where: { etablissementId, nom }, select: { id: true, nom: true } });
    if (exacte) return exacte;
    const premiere = await prisma.classe.findFirst({ where: { etablissementId }, orderBy: { nom: "asc" }, select: { id: true, nom: true } });
    return premiere ?? { id: null as string | null, nom };
  };

  const [pmB, pmJ, maitreA, maitreS] = await Promise.all([
    profMaths(bingerville.id), profMaths(jp2.id),
    aboboTe ? maitreDe(aboboTe.id) : null, sainteFamille ? maitreDe(sainteFamille.id) : null,
  ]);
  const [c6A, c3B, c5A, cCE1, cCM2B] = await Promise.all([
    classeDe(bingerville.id, "6ème A"), classeDe(bingerville.id, "3ème B"), classeDe(jp2.id, "5ème A"),
    aboboTe ? classeDe(aboboTe.id, "CE1") : null, sainteFamille ? classeDe(sainteFamille.id, "CM2 B") : null,
  ]);

  let crees = 0;
  const creer = async (v: Parameters<typeof prisma.visite.create>[0]["data"], recos: { texte: string; priorite?: "haute" | "moyenne" | "basse"; statut?: "ouverte" | "en_cours" | "traitee" }[] = []) => {
    const visite = await prisma.visite.create({ data: v });
    if (recos.length > 0) {
      await prisma.recommandation.createMany({
        data: recos.map((r) => ({ visiteId: visite.id, texte: r.texte, priorite: r.priorite ?? "moyenne", statut: r.statut ?? "ouverte" })),
      });
    }
    crees++;
  };

  // 1. Visite de classe PROGRAMMÉE et RÉALISÉE (note + observations + recommandations).
  if (pmB && c6A) {
    await creer({
      inspecteurId: inspecteur.id, etablissementId: bingerville.id, enseignantId: pmB.id,
      classeId: c6A.id, classeNom: c6A.nom, type: "classe", modalite: "programmee", statut: "realisee",
      date: jour(-9), heureSeance: "08h30 - 09h25",
      objet: "Visite de classe — séquence sur les fractions (6ème)",
      observations: "Séance bien structurée : rappel des prérequis, manipulation concrète puis exercices différenciés. Bonne gestion du tableau ; veiller à interroger davantage les élèves du fond de la classe et à formaliser la trace écrite avant la sonnerie.",
      noteGlobale: 15.5,
    }, [
      { texte: "Prévoir une trace écrite synthétique systématique en fin de séance.", priorite: "haute" },
      { texte: "Instaurer un tutorat entre pairs pour les élèves en difficulté sur les fractions.", statut: "en_cours" },
    ]);
  }
  // 2. Visite de classe PROGRAMMÉE À VENIR (l'enseignant serait notifié via le formulaire).
  if (pmB && c3B) {
    await creer({
      inspecteurId: inspecteur.id, etablissementId: bingerville.id, enseignantId: pmB.id,
      classeId: c3B.id, classeNom: c3B.nom, type: "classe", modalite: "programmee", statut: "planifiee",
      date: jour(4), heureSeance: "10h15 - 11h10",
      objet: "Visite de classe — préparation au BEPC (théorème de Thalès)",
    });
  }
  // 3. Visite de SUIVI INOPINÉE réalisée (vérification des recommandations antérieures).
  if (pmB && c6A) {
    await creer({
      inspecteurId: inspecteur.id, etablissementId: bingerville.id, enseignantId: pmB.id,
      classeId: c6A.id, classeNom: c6A.nom, type: "suivi", modalite: "inopinee", statut: "realisee",
      date: jour(-2), heureSeance: "08h30 - 09h25",
      objet: "Suivi inopiné des recommandations de la visite du mois",
      observations: "La trace écrite est désormais systématique ; le tutorat entre pairs se met en place sur deux binômes. Poursuivre l'effort d'interrogation équitable de toute la classe.",
      noteGlobale: 16,
    }, [{ texte: "Étendre le tutorat à quatre binômes d'ici la fin du trimestre.", priorite: "basse" }]);
  }
  // 4. Visite D'ÉTABLISSEMENT planifiée (sans enseignant ni classe).
  await creer({
    inspecteurId: inspecteur.id, etablissementId: jp2.id, type: "etablissement", modalite: "programmee",
    statut: "planifiee", date: jour(8),
    objet: "Visite d'établissement — organisation pédagogique et tenue des documents officiels",
  });
  // 5. Visite de classe ANNULÉE (cycle complet visible).
  if (pmJ && c5A) {
    await creer({
      inspecteurId: inspecteur.id, etablissementId: jp2.id, enseignantId: pmJ.id,
      classeId: c5A.id, classeNom: c5A.nom, type: "classe", modalite: "programmee", statut: "annulee",
      date: jour(-5), heureSeance: "07h30 - 08h25",
      objet: "Visite de classe — reportée (mouvement de grève local)",
    });
  }
  // 6-7. PRIMAIRES — par la conseillère pédagogique (libellé sans spécialité au primaire).
  if (aboboTe && maitreA && cCE1) {
    await creer({
      inspecteurId: conseiller.id, etablissementId: aboboTe.id, enseignantId: maitreA.id,
      classeId: cCE1.id, classeNom: cCE1.nom, type: "classe", modalite: "programmee", statut: "realisee",
      date: jour(-6), heureSeance: "09h00 - 09h55",
      objet: "Accompagnement pédagogique — lecture au CE1 (méthode syllabique)",
      observations: "Bonne progression de la classe en déchiffrage ; renforcer la compréhension par des questions ouvertes après chaque texte et afficher les sons étudiés.",
      noteGlobale: 14,
    }, [{ texte: "Constituer un coin lecture avec les supports disponibles à l'école.", priorite: "moyenne" }]);
  }
  if (sainteFamille && maitreS && cCM2B) {
    await creer({
      inspecteurId: conseiller.id, etablissementId: sainteFamille.id, enseignantId: maitreS.id,
      classeId: cCM2B.id, classeNom: cCM2B.nom, type: "classe", modalite: "inopinee", statut: "planifiee",
      date: jour(2), heureSeance: "10h15 - 11h10",
      objet: "Visite inopinée — préparation du CEPE (production d'écrit)",
    });
  }

  console.log(`Simulation Inspection créée : ${crees} visite(s) — inspecteur fictif ${inspecteur.prenoms} ${inspecteur.nom} (Mathématiques, secondaire) et conseillère pédagogique fictive ${conseiller.prenoms} ${conseiller.nom} (primaires).`);
  console.log("Réinitialisation : RESET=1 npm run db:seed:simulation-visites");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
