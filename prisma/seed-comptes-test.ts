/**
 * COMPTES TEST EXHAUSTIFS — un compte CONNECTABLE par rôle de la plateforme (les 33 rôles
 * du référentiel RBAC), chacun avec le PÉRIMÈTRE correspondant à la nature de son rôle :
 *  - global → aucun rattachement (tous pays) ;
 *  - pays → Côte d'Ivoire ;
 *  - etablissement → EDUWEB ACADEMY 3 (académie de démonstration) ;
 *  - cafop → premier CAFOP de Côte d'Ivoire ; apfc / antenne → APFC Abidjan 1 ;
 *  - region → région de l'académie de démonstration ;
 *  - diocese (SEDEC) → un diocèse réellement présent au répertoire ;
 *  - personnel → élève de test rattaché à l'académie ; parent LIÉ à cet élève.
 *
 * Idempotent : relançable à volonté ; chaque exécution RÉINITIALISE le mot de passe de ces
 * comptes au mot de passe de test (comptes d'essai assumés — jamais pour l'exploitation réelle).
 *
 *   npm run db:seed:comptes-test
 *   TEST_PASSWORD=... npm run db:seed:comptes-test   (mot de passe personnalisé)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLES_ORDONNES, type RoleId, type TypePortee } from "../src/lib/rbac/roles";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MOT_DE_PASSE = process.env.TEST_PASSWORD ?? "EduWebTest!2026";
const PAYS = "Côte d'Ivoire";
const ETAB_DEMO_ID = "cms1k4qbj000104l0nspex5n4"; // EDUWEB ACADEMY 3

/** E-mails HISTORIQUES des comptes test APFC déjà distribués — conservés à l'identique. */
const EMAILS_HISTORIQUES: Partial<Record<RoleId, string>> = {
  super_admin_apfc: "test.superadmin.apfc@eduweb.ci",
  apfc_admin: "admin.apfc@eduweb.ci",
  chef_antenne: "chef.antenne@eduweb.ci",
  conseiller_pedagogique: "conseiller@eduweb.ci",
};

/** Spécialités d'encadrement des rôles qui planifient des visites (bloc « Ma spécialité »). */
const SPECIALITES: Partial<Record<RoleId, string[]>> = {
  conseiller_pedagogique: ["Français"],
  inspecteur: ["Mathématiques"],
};

async function main() {
  const hash = await bcrypt.hash(MOT_DE_PASSE, 12);

  // ── Référentiels de rattachement ──
  const etab = await prisma.etablissement.findFirst({
    where: { OR: [{ id: ETAB_DEMO_ID }, { nom: { contains: "EDUWEB ACADEMY 3", mode: "insensitive" } }] },
    select: { id: true, nom: true, regionId: true },
  });
  if (!etab) throw new Error("Établissement de démonstration introuvable (EDUWEB ACADEMY 3).");
  const region =
    (etab.regionId ? await prisma.region.findUnique({ where: { id: etab.regionId }, select: { id: true, nom: true } }) : null) ??
    (await prisma.region.findFirst({ where: { pays: PAYS }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }));
  const cafop = await prisma.cafop.findFirst({
    where: { pays: { equals: PAYS, mode: "insensitive" } },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
  const apfc =
    (await prisma.apfc.findFirst({ where: { nom: "APFC Abidjan 1" }, select: { id: true, nom: true } })) ??
    (await prisma.apfc.findFirst({
      where: { region: { pays: { equals: PAYS, mode: "insensitive" } } },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    }));
  const etabSedec = await prisma.etablissement.findFirst({
    where: { pays: { equals: PAYS, mode: "insensitive" }, reseauConfessionnel: "SEDEC", diocese: { not: null } },
    select: { diocese: true },
  });
  const diocese = etabSedec?.diocese ?? "Abidjan";

  const roles = await prisma.role.findMany({ select: { id: true, nomTechnique: true } });
  const roleDbId = (t: RoleId) => {
    const r = roles.find((x) => x.nomTechnique === t)?.id;
    if (!r) throw new Error(`Rôle absent de la table roles : ${t} — lancez d'abord « npm run db:seed ».`);
    return r;
  };

  /** Colonnes de périmètre selon la NATURE du rôle — posées EXPLICITEMENT (y compris à null)
   *  pour que chaque exécution recanonise les comptes. */
  const rattachement = (portee: TypePortee, roleId: RoleId) => {
    const base = { etablissementId: null as string | null, cafopId: null as string | null, apfcId: null as string | null, regionId: null as string | null, diocese: null as string | null, pays: PAYS };
    switch (portee) {
      case "global":
      case "pays":
        return base;
      case "diocese":
        return { ...base, diocese };
      case "region":
        return { ...base, regionId: region?.id ?? null };
      case "etablissement":
        return { ...base, etablissementId: etab.id };
      case "cafop":
        return { ...base, cafopId: cafop?.id ?? null };
      case "apfc":
      case "antenne": // les antennes sont rattachées à une APFC
        return { ...base, apfcId: apfc?.id ?? null };
      case "personnel":
        return roleId === "eleve" ? { ...base, etablissementId: etab.id } : base;
    }
  };

  const lignes: { role: RoleId; libelle: string; email: string; perimetre: string }[] = [];
  let eleveTestId: string | null = null;
  let parentTestId: string | null = null;

  for (const def of ROLES_ORDONNES) {
    const email = EMAILS_HISTORIQUES[def.id] ?? `test.${def.id.replace(/_/g, ".")}@eduweb.ci`;
    const specialites = SPECIALITES[def.id];
    const donnees = {
      motDePasseHash: hash,
      roleActifId: roleDbId(def.id),
      statutCompte: "actif" as const,
      emailVerifieLe: new Date(),
      ...rattachement(def.portee, def.id),
      ...(specialites ? { specialites } : {}),
      ...(def.id === "eleve" ? { matricule: "TEST-0001" } : {}),
    };
    const compte = await prisma.utilisateur.upsert({
      where: { email },
      update: donnees,
      create: { email, prenoms: "Test", nom: def.libelle.toUpperCase(), ...donnees },
      select: { id: true },
    });
    if (def.id === "eleve") eleveTestId = compte.id;
    if (def.id === "parent") parentTestId = compte.id;

    const perimetre =
      def.portee === "global" ? "Global (tous pays)"
      : def.portee === "pays" ? PAYS
      : def.portee === "diocese" ? `Diocèse ${diocese}`
      : def.portee === "region" ? (region?.nom ?? "—")
      : def.portee === "etablissement" ? etab.nom
      : def.portee === "cafop" ? (cafop?.nom ?? "— (aucun CAFOP au répertoire)")
      : def.portee === "apfc" || def.portee === "antenne" ? (apfc?.nom ?? "— (aucune APFC au répertoire)")
      : def.id === "eleve" ? `${etab.nom} (élève TEST-0001)` : "Son enfant : l'élève de test";
    lignes.push({ role: def.id, libelle: def.libelle, email, perimetre });
    console.log(`✓ ${email} — ${def.id} (${perimetre})`);
  }

  // Le parent de test est LIÉ à l'élève de test (périmètre « personnel » = ses enfants).
  if (parentTestId && eleveTestId) {
    const dejaLie = await prisma.lienParentEleve.findFirst({ where: { parentId: parentTestId, eleveId: eleveTestId } });
    if (!dejaLie) {
      await prisma.lienParentEleve.create({ data: { parentId: parentTestId, eleveId: eleveTestId, lien: "parent" } });
      console.log("✓ Lien parent → élève de test créé.");
    }
  }

  // ── Alignement des AUTRES comptes test historiques sur le même mot de passe ──
  // Rôles et périmètres INCHANGÉS : seul le mot de passe est réinitialisé (+ compte actif).
  // admin@eduweb.ci est volontairement EXCLU : il reste piloté par ADMIN_PASSWORD (seed principal).
  const ALIGNES = [
    "admin.cafop@eduweb.ci",
    "junior@eduweb.ci",
    "konan@eduweb.ci",
    "desire@eduweb.ci",
    "drena.abidjan1@eduweb.ci",
    "inspecteur.abidjan1@eduweb.ci",
    "senec@eduweb.ci",
    "sedecabj@eduweb.ci",
  ];
  const r = await prisma.utilisateur.updateMany({
    where: { email: { in: ALIGNES } },
    data: { motDePasseHash: hash, statutCompte: "actif", emailVerifieLe: new Date() },
  });
  console.log(`✓ ${r.count} compte(s) test historique(s) aligné(s) sur le mot de passe de test (rôles/périmètres inchangés).`);

  console.log(`\n${lignes.length} compte(s) de test — mot de passe commun (réinitialisé à chaque exécution) : ${MOT_DE_PASSE}`);
  console.log("role;libelle;email;perimetre");
  for (const l of lignes) console.log(`${l.role};${l.libelle};${l.email};${l.perimetre}`);
  console.log("\n⚠️ Comptes d'essai uniquement — à supprimer ou re-sécuriser avant l'exploitation réelle.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
