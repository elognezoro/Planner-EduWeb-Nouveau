/**
 * Séances de SIMULATION du cahier de texte v2 — Lycée moderne de Cocody.
 *
 * Usage : node scripts/seed-cahier-texte-simulation.mjs
 *
 * Idempotent (relançable sans doublons) :
 *  - crée les affectations enseignant ↔ classe ↔ discipline nécessaires ;
 *  - crée 4 séances (2 publiées, 2 brouillons) avec sous-titres hiérarchiques (4 niveaux),
 *    activités d'apprentissage / d'évaluation, amorce et prochaine séance ;
 *  - crée 2 demandes d'accès en attente (parent + conseiller pédagogique).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ── Contexte ──
const etab = await prisma.etablissement.findFirst({
  where: { nom: { contains: "cocody", mode: "insensitive" }, classes: { some: {} } },
  select: { id: true, nom: true },
});
if (!etab) throw new Error("Lycée moderne de Cocody introuvable.");

async function classe(nom) {
  const c = await prisma.classe.findFirst({ where: { etablissementId: etab.id, nom }, select: { id: true, nom: true } });
  if (!c) throw new Error(`Classe « ${nom} » introuvable.`);
  return c;
}
async function discipline(nom) {
  const d = await prisma.discipline.findFirst({ where: { nom }, select: { id: true, nom: true } });
  if (!d) throw new Error(`Discipline « ${nom} » introuvable.`);
  return d;
}
async function enseignant(email) {
  const e = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true, prenoms: true, nom: true } });
  if (!e) throw new Error(`Enseignant « ${email} » introuvable.`);
  return e;
}

const [c3eA, c2ndeC, cTleD] = await Promise.all([classe("3ème A"), classe("2nde C A"), classe("Tle D A")]);
const [dMaths, dFrancais, dSvt, dHistGeo] = await Promise.all([
  discipline("Mathématiques"),
  discipline("Français"),
  discipline("SVT"),
  discipline("Histoire-Géographie"),
]);
const [pKouassi, hBrou, fSilue, kKone] = await Promise.all([
  enseignant("kouame.kouassi.13@lycee-moderne-de-cocody.eduweb.ci"),
  enseignant("estelle.brou.32@lycee-moderne-de-cocody.eduweb.ci"),
  enseignant("fatou.silue.18@lycee-moderne-de-cocody.eduweb.ci"),
  enseignant("kouadio.kone.1@lycee-moderne-de-cocody.eduweb.ci"),
]);

// ── 1) Affectations enseignant (nécessaires au périmètre de saisie) ──
const AFFECTATIONS = [
  { enseignantId: pKouassi.id, classeId: c3eA.id, disciplineId: dMaths.id },
  { enseignantId: hBrou.id, classeId: c2ndeC.id, disciplineId: dFrancais.id },
  { enseignantId: fSilue.id, classeId: cTleD.id, disciplineId: dSvt.id },
  { enseignantId: kKone.id, classeId: c3eA.id, disciplineId: dHistGeo.id },
];
for (const a of AFFECTATIONS) {
  await prisma.affectationEnseignant.upsert({
    where: { enseignantId_classeId_disciplineId: a },
    update: {},
    create: a,
  });
}
console.log(`✔ ${AFFECTATIONS.length} affectations enseignant en place.`);

// ── 2) Séances (dont sous-titres sur les 4 niveaux hiérarchiques) ──
const SEANCES = [
  {
    titre: "Théorème de Thalès",
    classeId: c3eA.id,
    disciplineId: dMaths.id,
    enseignant: pKouassi,
    statut: "publie",
    date: new Date("2026-06-09T00:00:00.000Z"),
    heureDebut: "07:30",
    dureeMin: 55,
    typeActivite: "Cours",
    amorce:
      "Comment mesurer la hauteur du mât du drapeau de la cour sans y grimper ? Discussion à partir d'une photo et de l'ombre portée.",
    contenu:
      "Énoncé du théorème de Thalès dans le triangle, configurations de Thalès, calculs de longueurs par proportionnalité. Applications à des mesures indirectes.",
    sousTitres: [
      { niveau: 1, texte: "I. Configuration de Thalès" },
      { niveau: 2, texte: "1. Triangles emboîtés" },
      { niveau: 3, texte: "a) Repérage des droites parallèles" },
      { niveau: 4, texte: "Exemple guidé : l'ombre du mât" },
      { niveau: 2, texte: "2. Triangles en papillon" },
      { niveau: 1, texte: "II. Calculs de longueurs" },
    ],
    activitesApprentissage: [
      "Activité de découverte : mesurer une hauteur inaccessible à partir des ombres",
      "Exercices d'application n° 12 à 15 page 148",
    ],
    activitesEvaluation: ["Interrogation écrite de 15 min à la prochaine séance"],
    prochaineSeanceLe: new Date("2026-06-16T00:00:00.000Z"),
  },
  {
    titre: "L'argumentation",
    classeId: c2ndeC.id,
    disciplineId: dFrancais.id,
    enseignant: hBrou,
    statut: "publie",
    date: new Date("2026-06-08T00:00:00.000Z"),
    heureDebut: "10:00",
    dureeMin: 110,
    typeActivite: "Cours",
    amorce:
      "Lecture d'un extrait de débat radiophonique : qui a raison, et surtout, qui convainc ? Relevé des procédés employés par chaque intervenant.",
    contenu:
      "Thèse, arguments et exemples ; distinction convaincre / persuader / délibérer ; étude des connecteurs logiques dans un texte argumentatif.",
    sousTitres: [
      { niveau: 1, texte: "I. La structure du texte argumentatif" },
      { niveau: 2, texte: "1. Thèse et arguments" },
      { niveau: 3, texte: "a) Les types d'arguments" },
      { niveau: 2, texte: "2. Les connecteurs logiques" },
    ],
    activitesApprentissage: [
      "Repérage de la thèse et des arguments dans un corpus de trois textes",
      "Rédaction d'un paragraphe argumenté (travail en binômes)",
    ],
    activitesEvaluation: ["Devoir maison : essai argumentatif à rendre le 15 juin"],
    prochaineSeanceLe: new Date("2026-06-15T00:00:00.000Z"),
  },
  {
    titre: "La reproduction cellulaire",
    classeId: cTleD.id,
    disciplineId: dSvt.id,
    enseignant: fSilue,
    statut: "brouillon",
    date: new Date("2026-06-11T00:00:00.000Z"),
    heureDebut: "08:30",
    dureeMin: 55,
    typeActivite: "Travaux pratiques",
    amorce: "Observation au microscope de cellules de racine d'oignon : que voit-on aux différents stades ?",
    contenu:
      "Les phases de la mitose ; observation de cellules en division ; schématisation des étapes et rôle de la mitose dans la croissance.",
    sousTitres: [
      { niveau: 1, texte: "I. Les étapes de la mitose" },
      { niveau: 2, texte: "1. Prophase et métaphase" },
      { niveau: 2, texte: "2. Anaphase et télophase" },
    ],
    activitesApprentissage: ["TP : observation microscopique et dessin d'observation"],
    activitesEvaluation: [],
    prochaineSeanceLe: null,
  },
  {
    titre: "La Côte d'Ivoire coloniale",
    classeId: c3eA.id,
    disciplineId: dHistGeo.id,
    enseignant: kKone,
    statut: "brouillon",
    date: new Date("2026-06-12T00:00:00.000Z"),
    heureDebut: "14:30",
    dureeMin: 55,
    typeActivite: "Cours",
    amorce: "",
    contenu: "",
    sousTitres: [{ niveau: 1, texte: "I. L'implantation coloniale" }],
    activitesApprentissage: [],
    activitesEvaluation: [],
    prochaineSeanceLe: null,
  },
];

const seancesCreees = new Map();
for (const s of SEANCES) {
  const existante = await prisma.cahierTexte.findFirst({
    where: { classeId: s.classeId, disciplineId: s.disciplineId, titre: s.titre },
    select: { id: true },
  });
  const donnees = {
    classeId: s.classeId,
    disciplineId: s.disciplineId,
    date: s.date,
    statut: s.statut,
    titre: s.titre,
    heureDebut: s.heureDebut,
    dureeMin: s.dureeMin,
    typeActivite: s.typeActivite,
    amorce: s.amorce || null,
    contenu: s.contenu || s.titre,
    sousTitres: s.sousTitres,
    activitesApprentissage: s.activitesApprentissage,
    activitesEvaluation: s.activitesEvaluation,
    prochaineSeanceLe: s.prochaineSeanceLe,
    enseignantId: s.enseignant.id,
    saisiParId: s.enseignant.id,
  };
  const rec = existante
    ? await prisma.cahierTexte.update({ where: { id: existante.id }, data: donnees, select: { id: true } })
    : await prisma.cahierTexte.create({ data: donnees, select: { id: true } });
  seancesCreees.set(s.titre, rec.id);
  console.log(`✔ Séance « ${s.titre} » (${s.statut}) ${existante ? "mise à jour" : "créée"}.`);
}

// ── 3) Demandes d'accès en attente (parent + conseiller pédagogique) ──
const parent = await prisma.utilisateur.findFirst({
  where: { roleActif: { nomTechnique: "parent" }, nom: { contains: "Traor", mode: "insensitive" } },
  select: { id: true, prenoms: true, nom: true },
});
const conseiller = await prisma.utilisateur.findFirst({
  where: { roleActif: { nomTechnique: "conseiller_pedagogique" } },
  select: { id: true, prenoms: true, nom: true },
});
const DEMANDES = [
  { demandeurId: parent?.id, cahierId: seancesCreees.get("Théorème de Thalès"), libelle: "parent → Thalès" },
  { demandeurId: conseiller?.id, cahierId: seancesCreees.get("L'argumentation"), libelle: "conseiller → Argumentation" },
];
for (const d of DEMANDES) {
  if (!d.demandeurId || !d.cahierId) {
    console.warn(`⚠ Demande ${d.libelle} ignorée (demandeur ou séance introuvable).`);
    continue;
  }
  const existante = await prisma.demandeAccesCahier.findFirst({
    where: { cahierId: d.cahierId, demandeurId: d.demandeurId },
  });
  if (existante) {
    if (existante.statut !== "en_attente") {
      await prisma.demandeAccesCahier.update({
        where: { id: existante.id },
        data: { statut: "en_attente", traiteLe: null },
      });
      console.log(`✔ Demande ${d.libelle} remise en attente.`);
    } else console.log(`• Demande ${d.libelle} déjà en attente.`);
  } else {
    await prisma.demandeAccesCahier.create({ data: { cahierId: d.cahierId, demandeurId: d.demandeurId } });
    console.log(`✔ Demande ${d.libelle} créée.`);
  }
}

console.log("\nSimulation du cahier de texte en place.");
await prisma.$disconnect();
