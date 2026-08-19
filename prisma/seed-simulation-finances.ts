/**
 * SIMULATION FINANCES / ÉCONOMAT — données fictives dans TOUS les espaces « Finances »
 * pour l'établissement EDUWEB ACADEMY 3, + comptes de test CONNECTABLES des nouveaux rôles
 * financiers (Économe, Gestionnaire Financier, Comptable, Caissier, Magasinier, Auditeur) et
 * des acteurs Transport (Chef, Parent abonné, Conducteur).
 *
 *   npm run db:seed:simulation-finances            → purge la simulation puis la (re)crée
 *   RESET=1 npm run db:seed:simulation-finances    → SUPPRIME uniquement la simulation
 *
 * Idempotent : la purge ne touche QUE les comptes marqués « .acad3@eduweb.ci » et les données
 * financières de l'établissement cible (académie de démonstration, code 000003). Mot de passe
 * commun des comptes : « EduWeb@2026 ».
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile();
} catch {
  /* .env déjà injecté */
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const ETAB = "cms1k4qbj000104l0nspex5n4"; // EDUWEB ACADEMY 3
const PAYS = "Côte d'Ivoire";
const MDP = "EduWeb@2026";
const MARQUE = ".acad3@eduweb.ci"; // marqueur de purge des comptes de test
const AUJ = new Date();
const dansJours = (n: number) => new Date(AUJ.getTime() + n * 86_400_000);

// ── Numérotation (réplique fidèle de src/lib/finances/commun/numerotation.ts, séquence pérenne) ──
async function prochainNumero(
  tx: Prisma.TransactionClient,
  type: string,
  prefixe: string,
): Promise<{ numero: number; reference: string }> {
  const annee = AUJ.getFullYear();
  const cle = { etablissementId: ETAB, exerciceId: null, type };
  const fmt = (p: string, n: number, w: number) => `${p}-${annee}-${String(n).padStart(Math.max(1, w), "0")}`;
  const maj = await tx.sequenceNumerotation.updateMany({ where: cle, data: { prochainNumero: { increment: 1 } } });
  if (maj.count === 0) {
    const creee = await tx.sequenceNumerotation.create({
      data: { ...cle, prefixe, prochainNumero: 2 },
      select: { prefixe: true, largeur: true },
    });
    return { numero: 1, reference: fmt(creee.prefixe, 1, creee.largeur) };
  }
  const seq = await tx.sequenceNumerotation.findFirst({ where: cle, select: { prochainNumero: true, prefixe: true, largeur: true } });
  const numero = (seq?.prochainNumero ?? 2) - 1;
  return { numero, reference: fmt(seq?.prefixe ?? prefixe, numero, seq?.largeur ?? 6) };
}

// ─────────────────────────────────────────────────────────────
//  PURGE (réinitialisation propre, ciblée sur la simulation)
// ─────────────────────────────────────────────────────────────
async function purge() {
  // Données financières de l'établissement (académie de démonstration).
  await prisma.mouvementBancaire.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.operationFinanciere.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.sessionCaisse.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.caisseEtablissement.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.compteBancaire.deleteMany({ where: { etablissementId: ETAB } });

  await prisma.paiementScolarite.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.fraisScolarite.deleteMany({ where: { etablissementId: ETAB } });

  await prisma.mouvementStock.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.articleEconomat.deleteMany({ where: { etablissementId: ETAB } });

  await prisma.demandeAchat.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.fournisseur.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.demandeDepense.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.budgetLigne.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.budget.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.immobilisation.deleteMany({ where: { etablissementId: ETAB } }); // événements en cascade

  await prisma.transportSubscription.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.transportDriver.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.transportBus.deleteMany({ where: { etablissementId: ETAB } }); // positions en cascade
  await prisma.transportSlot.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.transportSettings.deleteMany({ where: { id: ETAB } });

  // Classes de démo (marqueur « SIM-FIN ») → inscriptions en cascade.
  await prisma.classe.deleteMany({ where: { etablissementId: ETAB, nom: { startsWith: "SIM-FIN" } } });

  // Comptes de test (finance + acteurs + élèves de démo) → liens/inscriptions en cascade.
  await prisma.utilisateur.deleteMany({ where: { email: { contains: MARQUE } } });
}

// ─────────────────────────────────────────────────────────────
//  CRÉATION
// ─────────────────────────────────────────────────────────────
async function creer() {
  const hash = await bcrypt.hash(MDP, 12);

  // Résolution des rôles (déjà seedés par npm run db:seed).
  const rolesNoms = [
    "econome", "gestionnaire_financier", "comptable", "caissier", "magasinier", "auditeur",
    "chef_etablissement", "parent", "eleve",
  ];
  const roles = await prisma.role.findMany({ where: { nomTechnique: { in: rolesNoms } }, select: { id: true, nomTechnique: true } });
  const roleId = (t: string) => {
    const r = roles.find((x) => x.nomTechnique === t)?.id;
    if (!r) throw new Error(`Rôle introuvable : ${t} — lancez d'abord « npm run db:seed ».`);
    return r;
  };

  // ── Comptes de test connectables (rôles à périmètre établissement) ──
  const compte = async (local: string, prenoms: string, nom: string, role: string, avecEtab = true) => {
    const email = `${local}${MARQUE}`;
    return prisma.utilisateur.create({
      data: {
        email, motDePasseHash: hash, prenoms, nom, statutCompte: "actif", emailVerifieLe: AUJ,
        roleActifId: roleId(role), etablissementId: avecEtab ? ETAB : null, pays: PAYS,
      },
    });
  };

  const econome = await compte("econome", "Aya", "KONÉ", "econome");
  await compte("gestion", "Kouadio", "TRAORÉ", "gestionnaire_financier");
  const comptable = await compte("comptable", "Rita", "BAMBA", "comptable");
  const caissier = await compte("caissier", "Yao", "KOUASSI", "caissier");
  await compte("magasinier", "Serge", "N'GUESSAN", "magasinier");
  await compte("auditeur", "Chantal", "AKA", "auditeur");
  await compte("chef", "Emmanuel", "BROU", "chef_etablissement");
  const parent = await compte("parent", "Clarisse", "YÉO", "parent", false);
  const conducteur = await compte("conducteur", "Ibrahim", "COULIBALY", "chef_etablissement"); // acteur transport (désigné conducteur)

  // ── Élèves de démo + parent ──
  const prenomsEleves = ["Adjoua", "Koffi", "Amenan", "N'Guessan", "Awa", "Konan"];
  const eleves: { id: string }[] = [];
  for (let i = 0; i < prenomsEleves.length; i++) {
    const e = await prisma.utilisateur.create({
      data: {
        email: `eleve${i + 1}${MARQUE}`, motDePasseHash: hash, prenoms: prenomsEleves[i], nom: "DEMO",
        statutCompte: "actif", roleActifId: roleId("eleve"), etablissementId: ETAB, pays: PAYS,
        matricule: `EA3-${String(i + 1).padStart(4, "0")}`,
      },
    });
    eleves.push({ id: e.id });
  }
  // Le parent est rattaché aux 2 premiers élèves.
  for (const el of eleves.slice(0, 2)) {
    await prisma.lienParentEleve.create({ data: { parentId: parent.id, eleveId: el.id, lien: "parent" } });
  }

  // ── Année scolaire + niveau + classe ──
  let annee = await prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } });
  if (!annee) annee = await prisma.anneeScolaire.create({ data: { libelle: "2025-2026", active: true }, select: { id: true } });
  const niveau =
    (await prisma.niveau.findFirst({ where: { nom: "6e", etablissementId: null }, select: { id: true } })) ??
    (await prisma.niveau.create({ data: { nom: "6e" }, select: { id: true } }));
  const classe = await prisma.classe.create({
    data: { nom: "SIM-FIN 6e A", etablissementId: ETAB, niveauId: niveau.id, anneeScolaireId: annee.id },
  });
  await prisma.inscription.createMany({ data: eleves.map((el) => ({ eleveId: el.id, classeId: classe.id, anneeScolaireId: annee!.id })) });

  // ── Frais scolaires ──
  const fraisScolarite = await prisma.fraisScolarite.create({
    data: { etablissementId: ETAB, libelle: "Scolarité", montant: 150000, anneeScolaireId: annee.id },
  });
  await prisma.fraisScolarite.create({
    data: { etablissementId: ETAB, libelle: "Droits d'inscription", montant: 25000, anneeScolaireId: annee.id },
  });

  // ── Paiements de scolarité (reçus numérotés REC via la séquence « recu ») ──
  for (let i = 0; i < 4; i++) {
    const el = eleves[i];
    await prisma.$transaction(async (tx) => {
      const { numero } = await prochainNumero(tx, "recu", "REC");
      await tx.paiementScolarite.create({
        data: {
          etablissementId: ETAB, eleveId: el.id, libelle: "Scolarité — 1re tranche", montant: 75000,
          numeroRecu: numero, fraisId: fraisScolarite.id, mode: i % 2 ? "mobile_money" : "especes",
          date: dansJours(-20 + i), dateComptable: dansJours(-20 + i), encaisseParId: caissier.id,
        },
      });
    });
  }

  // ── Économat : articles + entrées + ventes (reçus VE) ──
  const catalogue: { nom: string; prixVente: number; prixAchat: number; cat: string }[] = [
    { nom: "Cahier 200 pages", prixVente: 500, prixAchat: 350, cat: "Fournitures" },
    { nom: "Cahier 100 pages", prixVente: 300, prixAchat: 200, cat: "Fournitures" },
    { nom: "Stylo bille bleu", prixVente: 150, prixAchat: 80, cat: "Fournitures" },
    { nom: "Crayon HB", prixVente: 100, prixAchat: 50, cat: "Fournitures" },
    { nom: "Trousse scolaire", prixVente: 1500, prixAchat: 1000, cat: "Fournitures" },
    { nom: "Uniforme (chemise)", prixVente: 4500, prixAchat: 3200, cat: "Uniformes" },
    { nom: "Uniforme (jupe/pantalon)", prixVente: 5000, prixAchat: 3600, cat: "Uniformes" },
    { nom: "Règle 30 cm", prixVente: 250, prixAchat: 150, cat: "Fournitures" },
  ];
  for (let i = 0; i < catalogue.length; i++) {
    const a = catalogue[i];
    const article = await prisma.articleEconomat.create({
      data: { etablissementId: ETAB, nom: a.nom, prixVente: a.prixVente, prixAchat: a.prixAchat, categorie: a.cat, seuilAlerte: 5 },
    });
    // Entrée d'approvisionnement (stock initial).
    const qteEntree = 100;
    await prisma.mouvementStock.create({
      data: {
        articleId: article.id, etablissementId: ETAB, type: "entree", quantite: qteEntree,
        montant: a.prixAchat * qteEntree, date: dansJours(-30), dateComptable: dansJours(-30), saisiParId: econome.id,
      },
    });
    await prisma.articleEconomat.update({ where: { id: article.id }, data: { stock: qteEntree } });

    // Quelques ventes au comptoir (reçu numéroté VE).
    const nbVentes = 2 + (i % 3);
    for (let v = 0; v < nbVentes; v++) {
      const qte = 1 + (v % 3);
      await prisma.$transaction(async (tx) => {
        const { reference } = await prochainNumero(tx, "recu_vente_economat", "VE");
        await tx.mouvementStock.create({
          data: {
            articleId: article.id, etablissementId: ETAB, type: "vente", quantite: qte, montant: a.prixVente * qte,
            mode: v % 2 ? "mobile_money" : "especes", acheteur: "Comptoir", numeroRecu: reference,
            date: dansJours(-10 + v), dateComptable: dansJours(-10 + v), saisiParId: econome.id,
          },
        });
        await tx.articleEconomat.update({ where: { id: article.id }, data: { stock: { decrement: qte } } });
      });
    }
  }

  // ── Trésorerie : caisse, session, compte bancaire, opérations, mouvement bancaire ──
  const caisse = await prisma.caisseEtablissement.create({
    data: { etablissementId: ETAB, nom: "Caisse principale", type: "physique", code: "CP", statut: "active", devise: "XOF" },
  });
  const session = await prisma.sessionCaisse.create({
    data: { etablissementId: ETAB, caisseId: caisse.id, caissierId: caissier.id, fondsInitial: 50000, statut: "ouverte", dateComptable: AUJ },
  });
  const compteBancaire = await prisma.compteBancaire.create({
    data: { etablissementId: ETAB, nom: "Compte courant SGCI", banque: "SGCI", type: "courant", soldeInitial: 500000, statut: "actif", devise: "XOF", dateOuverture: dansJours(-120) },
  });

  const operations: Prisma.OperationFinanciereCreateManyInput[] = [
    { etablissementId: ETAB, sens: "recette", categorie: "706", libelle: "Droits d'examen", montant: 60000, mode: "especes", date: dansJours(-5), dateComptable: dansJours(-5), saisiParId: caissier.id, sessionCaisseId: session.id },
    { etablissementId: ETAB, sens: "recette", categorie: "75", libelle: "Don d'un parent d'élève", montant: 100000, mode: "mobile_money", date: dansJours(-7), dateComptable: dansJours(-7), saisiParId: econome.id },
    { etablissementId: ETAB, sens: "depense", categorie: "605", libelle: "Facture CIE (électricité)", montant: 85000, mode: "virement", reference: "CIE-2026-014", date: dansJours(-6), dateComptable: dansJours(-6), saisiParId: econome.id },
    { etablissementId: ETAB, sens: "depense", categorie: "62", libelle: "Frais de transport & mission", montant: 30000, mode: "especes", date: dansJours(-3), dateComptable: dansJours(-3), saisiParId: econome.id, sessionCaisseId: session.id },
  ];
  await prisma.operationFinanciere.createMany({ data: operations });

  await prisma.mouvementBancaire.create({
    data: { etablissementId: ETAB, compteId: compteBancaire.id, type: "depot", montant: 300000, libelle: "Dépôt d'espèces au guichet", pieceJustificative: "BORD-2026-003", reference: "VERS-778", dateOperation: dansJours(-8), dateComptable: dansJours(-8), saisiParId: econome.id },
  });
  await prisma.mouvementBancaire.create({
    data: { etablissementId: ETAB, compteId: compteBancaire.id, type: "frais_bancaires", montant: 5000, libelle: "Frais de tenue de compte", pieceJustificative: "REL-2026-06", dateOperation: dansJours(-2), dateComptable: dansJours(-2), saisiParId: comptable.id },
  });

  // ── Fournisseurs ──
  const fournisseurs = [
    { code: "FRS-2026-000001", raisonSociale: "Librairie Centrale de Côte d'Ivoire SARL", type: "biens" },
    { code: "FRS-2026-000002", raisonSociale: "Uniformes Scolaires du Plateau", type: "biens" },
    { code: "FRS-2026-000003", raisonSociale: "InfoTech Services", type: "services" },
  ];
  const fournisseursCrees: { id: string }[] = [];
  for (const f of fournisseurs) {
    const c = await prisma.fournisseur.create({ data: { etablissementId: ETAB, code: f.code, raisonSociale: f.raisonSociale, type: f.type, statut: "actif" } });
    fournisseursCrees.push({ id: c.id });
  }

  // ── Achats : demandes d'achat (approuvées) ──
  await prisma.demandeAchat.create({
    data: { etablissementId: ETAB, exercice: "2025-2026", numero: "DA-2026-000001", objet: "Fournitures de rentrée pour l'économat", justification: "Réapprovisionnement du stock avant la rentrée", categorieBudget: "601", montantEstime: 500000, typeAchat: "biens", demandeurNom: "Économe de l'établissement", statut: "approuvee" },
  });
  await prisma.demandeAchat.create({
    data: { etablissementId: ETAB, exercice: "2025-2026", numero: "DA-2026-000002", objet: "Maintenance de la salle informatique", justification: "Contrat d'entretien annuel des postes", categorieBudget: "62", montantEstime: 300000, typeAchat: "services", demandeurNom: "Gestionnaire Financier", statut: "approuvee" },
  });

  // ── Budgets ──
  const budget = await prisma.budget.create({
    data: { etablissementId: ETAB, exercice: "2025-2026", libelle: "Budget de fonctionnement 2025-2026", type: "fonctionnement", statut: "execution" },
  });
  const lignes: Prisma.BudgetLigneCreateManyInput[] = [
    { etablissementId: ETAB, exercice: "2025-2026", categorie: "706", sens: "recette", montantPrevu: 20000000, budgetId: budget.id },
    { etablissementId: ETAB, exercice: "2025-2026", categorie: "601", sens: "depense", montantPrevu: 3000000, budgetId: budget.id },
    { etablissementId: ETAB, exercice: "2025-2026", categorie: "605", sens: "depense", montantPrevu: 1500000, budgetId: budget.id },
    { etablissementId: ETAB, exercice: "2025-2026", categorie: "62", sens: "depense", montantPrevu: 2000000, budgetId: budget.id },
  ];
  await prisma.budgetLigne.createMany({ data: lignes });

  // ── Immobilisations ──
  const immos = [
    { code: "IMM-2026-000001", designation: "Lot 10 ordinateurs portables salle informatique", categorie: "materiel_informatique", cout: 2400000, compteImmo: "24", compteAmort: "284", dureeMois: 36 },
    { code: "IMM-2026-000002", designation: "Mobilier de bureau administration", categorie: "mobilier", cout: 900000, compteImmo: "24", compteAmort: "284", dureeMois: 120 },
  ];
  for (const im of immos) {
    const created = await prisma.immobilisation.create({
      data: {
        etablissementId: ETAB, code: im.code, designation: im.designation, categorie: im.categorie,
        dateAcquisition: dansJours(-40), coutAcquisition: im.cout, valeurBrute: im.cout,
        compteImmo: im.compteImmo, compteAmort: im.compteAmort, dureeMois: im.dureeMois, statut: "acquisition",
        fournisseurId: fournisseursCrees[2].id,
      },
    });
    await prisma.evenementImmobilisation.create({
      data: { immobilisationId: created.id, type: "acquisition", description: `Fiche créée (${im.designation})`, montant: im.cout },
    });
  }

  // ── Dépenses (workflow) ──
  await prisma.demandeDepense.create({
    data: { etablissementId: ETAB, exercice: "2025-2026", numero: "DEP-2026-000001", objet: "Mission pédagogique à Yamoussoukro", categorie: "61", montantEstime: 120000, description: "Participation à un séminaire régional", demandeurNom: "Gestionnaire Financier", statut: "approuvee" },
  });
  await prisma.demandeDepense.create({
    data: { etablissementId: ETAB, exercice: "2025-2026", numero: "DEP-2026-000002", objet: "Achat de produits d'entretien", categorie: "605", montantEstime: 45000, description: "Réapprovisionnement mensuel", demandeurNom: "Économe de l'établissement", statut: "soumise" },
  });

  // ── Transport d'élèves ──
  await prisma.transportSettings.upsert({
    where: { id: ETAB },
    update: { priceMonthFcfa: 3000, priceYearFcfa: 25000 },
    create: { id: ETAB, priceMonthFcfa: 3000, priceYearFcfa: 25000, upgradePenaltyPct: 20, beepIntervalMin: 5, centerLat: 5.3599, centerLng: -4.0083 },
  });
  const bus = await prisma.transportBus.create({ data: { etablissementId: ETAB, matricule: "1234 EA 01", label: "Car Nord", active: true } });
  await prisma.transportSlot.create({ data: { etablissementId: ETAB, label: "Ramassage matin", direction: "aller", days: [1, 2, 3, 4, 5], startTime: "06:30", endTime: "07:30", active: true } });
  await prisma.transportDriver.create({ data: { userId: conducteur.id, email: conducteur.email, etablissementId: ETAB } });
  await prisma.transportSubscription.create({ data: { userId: parent.id, active: true, period: "year", expiresAt: dansJours(300), etablissementId: ETAB } });
  await prisma.busPosition.create({ data: { busId: bus.id, driverId: conducteur.id, lat: 5.362, lng: -4.011, direction: "aller" } });

  return {
    comptes: 9 + eleves.length,
    articles: catalogue.length,
    fournisseurs: fournisseurs.length,
    paiements: 4,
    operations: operations.length,
    budgetLignes: lignes.length,
    immobilisations: immos.length,
  };
}

async function main() {
  const etab = await prisma.etablissement.findUnique({ where: { id: ETAB }, select: { nom: true } });
  if (!etab) throw new Error(`Établissement ${ETAB} introuvable.`);
  console.log(`Simulation Finances — établissement : ${etab.nom} (${ETAB})`);

  await purge();
  if (process.env.RESET === "1") {
    console.log("RESET : simulation supprimée.");
    return;
  }
  const bilan = await creer();
  console.log("Créé :", JSON.stringify(bilan));
  console.log(`Comptes de test (mot de passe « ${MDP} ») : *${MARQUE}`);
  console.log("Terminé.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
