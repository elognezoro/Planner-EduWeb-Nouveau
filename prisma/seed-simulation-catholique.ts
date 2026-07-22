/**
 * SIMULATION — données fictives de vie scolaire greffées sur des établissements
 * catholiques du répertoire (les fiches des établissements RÉELS ne sont PAS modifiées) :
 *   1. École primaire catholique Saint-Augustin d'Abobo-Té — Archidiocèse d'Abidjan
 *      (réel, seul « primaire » du diocèse) → CP1…CM2, ~180 élèves ;
 *   2. Collège Jean-Paul II d'Agboville (réel, code 033289) — Diocèse d'Agboville
 *      → 6ème…3ème, ~220 élèves ;
 *   3. Cours Secondaire Catholique Bingerville (réel, code 000323) — Archidiocèse
 *      d'Abidjan → GRAND établissement 6ème…Tle A/C/D, ~3 100 élèves, enseignants par
 *      discipline, éducateurs, inspecteurs d'orientation, adjoint (ACE) ;
 *   4. École Primaire Catholique Sainte-Famille d'Agboville (FICTIVE, code
 *      SIM-CATH-AGB-PRIM) — Diocèse d'Agboville → CP1…CM2 en double flux, 600 élèves.
 *      (Aucun primaire catholique réel n'est enregistré dans ce diocèse : l'établissement
 *      est créé par le seed et ENTIÈREMENT supprimé au reset.)
 * Chaque établissement reçoit : classes + effectifs, élèves et personnels fictifs
 * (comptes non connectables sur @simulation.eduweb.ci), affectations et spécialités,
 * NOTES (→ bulletins calculés), CAHIERS DE TEXTE publiés, REGISTRES D'APPEL
 * (présences, absences, retards) et un EMPLOI DU TEMPS hebdomadaire.
 *
 * RÉINITIALISABLE SANS TOUCHER AUX ÉTABLISSEMENTS RÉELS : la purge supprime les
 * classes contenant des élèves de démo, les créneaux des enseignants de démo, les
 * comptes @simulation.eduweb.ci et les établissements FICTIFS (codes SIM-CATH-*).
 *
 *   npm run db:seed:simulation-catholique            → (re)crée la simulation (purge d'abord)
 *   RESET=1 npm run db:seed:simulation-catholique    → SUPPRIME uniquement (place aux données réelles)
 *
 * NB : les niveaux PRIMAIRES (CP1…CM2) sont ajoutés au référentiel national s'ils
 * manquent — ils ne sont PAS supprimés au reset (référentiel légitime, réutilisable).
 */
import { randomBytes } from "node:crypto";
import { Prisma, PrismaClient, type Etablissement } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DOMAINE = "@simulation.eduweb.ci";
/** Établissements FICTIFS créés par le seed (v1 incluse) — supprimés en ENTIER à la purge. */
const CODES_FICTIFS = ["SIM-CATH-PRIM", "SIM-CATH-SEC", "SIM-CATH-AGB-PRIM"];
const PAYS = "Côte d'Ivoire";
const FILTRE_CATHOLIQUE = { statut: "confessionnel" as const, reseauConfessionnel: "SEDEC" };

// ── Générateur pseudo-aléatoire DÉTERMINISTE (relances stables) ──
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const alea = mulberry32(20260717);
const tirer = <T,>(l: readonly T[]): T => l[Math.floor(alea() * l.length)];

const PRENOMS_F = ["Aya", "Adjoua", "Affoué", "Akissi", "Amenan", "Ahou", "Adjo", "Fatou", "Mariam", "Awa", "Chantal", "Rita", "Grâce", "Rachelle", "Estelle", "Nadège", "Sylvie", "Clarisse", "Solange", "Aminata", "Rebecca", "Prisca", "Émilienne", "Josiane"];
const PRENOMS_M = ["Kouadio", "Koffi", "Yao", "Kouassi", "N'Guessan", "Konan", "Kouamé", "Brou", "Aristide", "Ibrahim", "Serge", "Désiré", "Franck", "Emmanuel", "Boubacar", "Landry", "Junior", "Cyprien", "Patrick", "Éric", "Moussa", "Wilfried", "Arsène", "Parfait"];
const NOMS = ["Koné", "Ouattara", "Traoré", "Yao", "Kouassi", "Aka", "Bamba", "Coulibaly", "Diarra", "Touré", "Gnamien", "Assi", "Ehui", "Kacou", "N'Dri", "Kouamé", "Konan", "Brou", "Yéo", "Soro", "Diabaté", "Guéi", "Zadi", "Tanoh", "Adou", "Loukou", "Séka", "Djédjé", "Kanga", "Amani", "Doumbia", "Fofana", "Cissé", "Sangaré", "Bakayoko", "Méité", "Silué", "Gbané", "Zaba", "Irié"];

const NIVEAUX_PRIMAIRES = ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"] as const;
const DISCIPLINES_PRIMAIRE = ["Français", "Mathématiques", "EDHC", "Anglais", "Arts & Musique", "EPS"] as const;
const DISCIPLINES_COLLEGE = ["Français", "Mathématiques", "Anglais", "Histoire-Géographie", "SVT", "Physique-Chimie", "EDHC", "EPS"] as const;
const DISCIPLINES_LYCEE = ["Français", "Mathématiques", "Anglais", "LV2", "Histoire-Géographie", "SVT", "Physique-Chimie", "Philosophie", "EDHC", "EPS"] as const;
const HEURES_SEANCE = ["07h30 - 08h30", "08h30 - 09h30", "10h15 - 11h15", "11h15 - 12h15", "15h00 - 16h00"] as const;

const estLycee = (niveau: string) => /^(2nde|1ère|Tle)/.test(niveau);

const jourUTC = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Jours ouvrables (lun-ven) entre deux dates incluses. */
function joursOuvrables(debut: Date, fin: Date): Date[] {
  const jours: Date[] = [];
  const cur = new Date(debut);
  while (cur <= fin) {
    const d = cur.getUTCDay();
    if (d >= 1 && d <= 5) jours.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return jours;
}

interface ConfClasse { nom: string; niveau: string; eleves: number }
/** « 6ème » × 10 → 6ème A … 6ème J (collège, lettres). */
const serieLettres = (niveau: string, n: number, eleves: number): ConfClasse[] =>
  Array.from({ length: n }, (_, i) => ({ nom: n > 1 ? `${niveau} ${String.fromCharCode(65 + i)}` : niveau, niveau, eleves }));
/** « 2nde A » × 3 → 2nde A1 … 2nde A3 (lycée, la lettre de série fait partie du niveau). */
const serieNumeros = (niveau: string, n: number, eleves: number): ConfClasse[] =>
  Array.from({ length: n }, (_, i) => ({ nom: n > 1 ? `${niveau}${i + 1}` : niveau, niveau, eleves }));

// ── PURGE CHIRURGICALE (au reset ET avant chaque recréation — idempotence). Les
// établissements réels ne sont jamais touchés : on supprime uniquement ce qui pend
// aux comptes de démo, plus les établissements FICTIFS créés par le seed. ──
async function purger(): Promise<void> {
  const simUsers = await prisma.utilisateur.findMany({ where: { email: { endsWith: DOMAINE } }, select: { id: true } });
  const ids = simUsers.map((u) => u.id);

  // Créneaux d'EDT (dénormalisés, pas de cascade depuis la classe) : par enseignant de démo.
  const creneaux = ids.length > 0 ? await prisma.creneau.deleteMany({ where: { enseignantId: { in: ids } } }) : { count: 0 };
  // Classes de démo = celles où des élèves de démo sont inscrits (cascade : inscriptions,
  // notes, appels → présences, cahiers de texte, affectations, événements d'appel).
  const classes = await prisma.classe.deleteMany({
    where: { inscriptions: { some: { eleve: { email: { endsWith: DOMAINE } } } } },
  });

  // Établissements entièrement fictifs (v1 et école primaire d'Agboville).
  const fictifs = await prisma.etablissement.findMany({ where: { code: { in: CODES_FICTIFS } }, select: { id: true } });
  if (fictifs.length > 0) {
    await prisma.creneau.deleteMany({ where: { etablissementId: { in: fictifs.map((e) => e.id) } } });
    await prisma.etablissement.deleteMany({ where: { id: { in: fictifs.map((e) => e.id) } } });
  }

  // Visites d'inspection de la simulation (pas de cascade depuis Utilisateur : à purger AVANT
  // les comptes — encadreurs fictifs du seed-simulation-visites et enseignants visités).
  await prisma.visite.deleteMany({
    where: {
      OR: [
        { inspecteur: { email: { endsWith: DOMAINE } } },
        { enseignant: { email: { endsWith: DOMAINE } } },
      ],
    },
  });

  // Comptes de démo (cascade : compétences, niveaux d'intervention, affectations restantes).
  const comptes = await prisma.utilisateur.deleteMany({ where: { email: { endsWith: DOMAINE } } });
  console.log(
    `Purge : ${classes.count} classe(s), ${creneaux.count} créneau(x) et ${comptes.count} compte(s) ${DOMAINE} supprimés` +
      (fictifs.length > 0 ? ` (+ ${fictifs.length} établissement(s) fictif(s))` : "") + ".",
  );
}

async function main() {
  if (process.env.RESET === "1") {
    await purger();
    console.log("Réinitialisation terminée — les établissements réels sont intacts, place aux données réelles.");
    return;
  }

  await purger(); // relançable : on repart d'un état propre

  // ── Référentiels ──
  const ROLES_UTILISES = ["chef_etablissement", "adjoint_chef_etablissement", "enseignant", "educateur", "inspecteur_orientation", "eleve"] as const;
  const [roles, annee, disciplines] = await Promise.all([
    prisma.role.findMany({ where: { nomTechnique: { in: [...ROLES_UTILISES] } }, select: { id: true, nomTechnique: true } }),
    prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true, libelle: true } }),
    prisma.discipline.findMany({ select: { id: true, nom: true } }),
  ]);
  const roleId = (t: string) => {
    const r = roles.find((x) => x.nomTechnique === t)?.id;
    if (!r) throw new Error(`Rôle introuvable : ${t}`);
    return r;
  };
  const disciplineId = new Map(disciplines.map((d) => [d.nom, d.id]));
  const anneeId = annee?.id ?? null;

  // Niveaux primaires (référentiel national) — créés s'ils manquent, AVANT la 6ème.
  const ordreMin = (await prisma.niveau.aggregate({ _min: { ordre: true } }))._min.ordre ?? 1;
  for (let i = 0; i < NIVEAUX_PRIMAIRES.length; i++) {
    await prisma.niveau.upsert({
      where: { nom: NIVEAUX_PRIMAIRES[i] },
      update: {},
      create: { nom: NIVEAUX_PRIMAIRES[i], ordre: ordreMin - NIVEAUX_PRIMAIRES.length + i, cycle: "primaire" },
    });
  }
  const niveaux = await prisma.niveau.findMany({ select: { id: true, nom: true } });
  const niveauId = new Map(niveaux.map((n) => [n.nom, n.id]));

  // ── Cibles : trois établissements RÉELS + une école primaire FICTIVE ──
  const ciblePrimaireAbidjan = await prisma.etablissement.findFirst({
    where: { ...FILTRE_CATHOLIQUE, diocese: "Archidiocèse d'Abidjan", type: "primaire" },
    orderBy: { nom: "asc" },
  });
  const cibleCollegeAgboville =
    (await prisma.etablissement.findFirst({ where: { ...FILTRE_CATHOLIQUE, code: "033289" } })) ??
    (await prisma.etablissement.findFirst({
      where: { ...FILTRE_CATHOLIQUE, diocese: "Diocèse d'Agboville", type: "college" },
      orderBy: { nom: "asc" },
    }));
  const cibleGrandSecondaire =
    (await prisma.etablissement.findFirst({ where: { ...FILTRE_CATHOLIQUE, code: "000323" } })) ??
    (await prisma.etablissement.findFirst({
      where: { ...FILTRE_CATHOLIQUE, diocese: "Archidiocèse d'Abidjan", type: { in: ["college", "lycee"] }, classes: { none: {} } },
      orderBy: { nom: "asc" },
    }));
  if (!ciblePrimaireAbidjan) throw new Error("Aucun établissement primaire catholique trouvé dans l'Archidiocèse d'Abidjan.");
  if (!cibleCollegeAgboville) throw new Error("Aucun collège catholique trouvé dans le Diocèse d'Agboville.");
  if (!cibleGrandSecondaire) throw new Error("Aucun grand établissement secondaire catholique trouvé dans l'Archidiocèse d'Abidjan.");

  // Aucun primaire catholique réel n'existe dans le Diocèse d'Agboville → établissement
  // FICTIF, clairement marqué « (Démo) », supprimé en entier au reset.
  const regionAgboville = await prisma.region.findFirst({ where: { nom: "Agboville", pays: PAYS }, select: { id: true } });
  const primaireAgboville = await prisma.etablissement.create({
    data: {
      nom: "École Primaire Catholique Sainte-Famille d'Agboville (Démo)",
      code: "SIM-CATH-AGB-PRIM", type: "primaire", statut: "confessionnel", reseauConfessionnel: "SEDEC",
      diocese: "Diocèse d'Agboville", pays: PAYS, ville: "Agboville", regionId: regionAgboville?.id ?? null,
      adresse: "Agboville — quartier de la Mission catholique (données de démonstration)",
      email: `contact.sim-cath-agb-prim${DOMAINE}`, telephone: "+225 07 00 00 00 00",
      ministere: "Ministère de l'Éducation Nationale et de l'Alphabétisation",
      anneeScolaire: annee?.libelle ?? "2025-2026",
      fonctionChef: "Directrice", prenomsChef: "Sœur Bernadette", nomChef: "ADJOBI",
      nbSallesDisponibles: 14, effectifSouhaiteParClasse: 50,
    },
  });

  const hash = randomBytes(32).toString("hex"); // non-bcrypt : comptes fictifs NON connectables

  // ── Configuration de la simulation par établissement ──
  interface ConfEtab {
    etab: Etablissement;
    slug: string;
    fonctionChef: string; prenomsChef: string; nomChef: string; sexeChef: "F" | "M";
    /** Personnel supplémentaire (rôle technique → effectif) : ACE, éducateurs, inspecteurs… */
    personnelSupplementaire: { roleTech: string; n: number; libelle: string }[];
    classes: ConfClasse[];
    /** Disciplines enseignées selon le niveau de la classe (collège ≠ lycée). */
    disciplinesDe: (niveau: string) => readonly string[];
    notesParPeriode: string[];
    naissance: readonly [number, number];
    prefixeMatricule: string;
    /** primaire : un maître polyvalent par classe ; secondaire : viviers par discipline. */
    polyvalent: boolean;
  }
  const ETABS: ConfEtab[] = [
    {
      etab: ciblePrimaireAbidjan, slug: "prim",
      fonctionChef: "Directrice", prenomsChef: "Sœur Marie-Claire", nomChef: "KOUADIO", sexeChef: "F",
      personnelSupplementaire: [],
      classes: NIVEAUX_PRIMAIRES.map((n) => ({ nom: n, niveau: n, eleves: 30 })),
      disciplinesDe: () => DISCIPLINES_PRIMAIRE, notesParPeriode: ["Devoir", "Composition"],
      naissance: [2014, 2019], prefixeMatricule: "26P", polyvalent: true,
    },
    {
      etab: cibleCollegeAgboville, slug: "sec",
      fonctionChef: "Principal", prenomsChef: "Père Jean-Baptiste", nomChef: "AKASSI", sexeChef: "M",
      personnelSupplementaire: [],
      classes: [
        { nom: "6ème A", niveau: "6ème", eleves: 40 }, { nom: "6ème B", niveau: "6ème", eleves: 38 },
        { nom: "5ème A", niveau: "5ème", eleves: 38 }, { nom: "4ème A", niveau: "4ème", eleves: 36 },
        { nom: "3ème A", niveau: "3ème", eleves: 35 }, { nom: "3ème B", niveau: "3ème", eleves: 33 },
      ],
      disciplinesDe: () => DISCIPLINES_COLLEGE, notesParPeriode: ["Devoir 1", "Devoir 2", "Composition"],
      naissance: [2009, 2013], prefixeMatricule: "26S", polyvalent: false,
    },
    {
      // GRAND établissement : > 3 000 élèves, 6ème → Tle A/C/D (55 classes).
      etab: cibleGrandSecondaire, slug: "bing",
      fonctionChef: "Directeur", prenomsChef: "Frère Théodore", nomChef: "N'GORAN", sexeChef: "M",
      personnelSupplementaire: [
        { roleTech: "adjoint_chef_etablissement", n: 1, libelle: "adjoint (ACE)" },
        { roleTech: "educateur", n: 10, libelle: "éducateurs" },
        { roleTech: "inspecteur_orientation", n: 3, libelle: "inspecteurs d'orientation" },
      ],
      classes: [
        ...serieLettres("6ème", 10, 60), ...serieLettres("5ème", 10, 58),
        ...serieLettres("4ème", 9, 58), ...serieLettres("3ème", 9, 56),
        ...serieNumeros("2nde A", 2, 55), ...serieNumeros("2nde C", 3, 55),
        ...serieNumeros("1ère A", 2, 52), ...serieNumeros("1ère C", 2, 52), ...serieNumeros("1ère D", 2, 52),
        ...serieNumeros("Tle A", 2, 50), ...serieNumeros("Tle C", 2, 50), ...serieNumeros("Tle D", 2, 50),
      ],
      disciplinesDe: (niveau) => (estLycee(niveau) ? DISCIPLINES_LYCEE : DISCIPLINES_COLLEGE),
      notesParPeriode: ["Devoir 1", "Devoir 2", "Composition"],
      naissance: [2007, 2013], prefixeMatricule: "26B", polyvalent: false,
    },
    {
      // École primaire FICTIVE d'Agboville : 600 élèves en double flux (CP1 A … CM2 B).
      etab: primaireAgboville, slug: "agbo",
      fonctionChef: "Directrice", prenomsChef: "Sœur Bernadette", nomChef: "ADJOBI", sexeChef: "F",
      personnelSupplementaire: [],
      classes: NIVEAUX_PRIMAIRES.flatMap((n) => serieLettres(n, 2, 50)),
      disciplinesDe: () => DISCIPLINES_PRIMAIRE, notesParPeriode: ["Devoir", "Composition"],
      naissance: [2014, 2019], prefixeMatricule: "26A", polyvalent: true,
    },
  ];

  const compteur = { eleves: 0, personnels: 0, notes: 0, appels: 0, presences: 0, cahiers: 0, creneaux: 0 };
  let numeroCompte = 0;

  const creerPersonne = async (roleTech: string, prefixe: string, etabId: string, fixe?: { prenoms: string; nom: string; sexe: "F" | "M" }) => {
    const sexe = fixe?.sexe ?? (alea() < 0.5 ? "F" : "M");
    const prenoms = fixe?.prenoms ?? (sexe === "F" ? tirer(PRENOMS_F) : tirer(PRENOMS_M));
    const nom = fixe?.nom ?? tirer(NOMS);
    numeroCompte++;
    const u = await prisma.utilisateur.create({
      data: {
        email: `${prefixe}.${numeroCompte}${DOMAINE}`, motDePasseHash: hash, prenoms, nom, sexe,
        statutCompte: "actif", emailVerifieLe: new Date(),
        roleActifId: roleId(roleTech), etablissementId: etabId, pays: PAYS,
      },
    });
    compteur.personnels++;
    return { id: u.id, prenoms, nom };
  };

  for (const E of ETABS) {
    console.log(`\n── ${E.etab.nom} (${E.etab.diocese}) ──`);

    // Direction fictive + personnel supplémentaire (ACE, éducateurs, inspecteurs d'orientation…).
    const chef = await creerPersonne("chef_etablissement", "chef", E.etab.id, { prenoms: E.prenomsChef, nom: E.nomChef, sexe: E.sexeChef });
    for (const P of E.personnelSupplementaire) {
      for (let i = 0; i < P.n; i++) await creerPersonne(P.roleTech, P.roleTech.replace(/_/g, "-"), E.etab.id);
    }

    // Enseignants : au primaire un maître polyvalent par classe ; au secondaire un VIVIER
    // par discipline dimensionné pour ~7 classes par enseignant.
    const toutesDisciplines = [...new Set(E.classes.flatMap((c) => E.disciplinesDe(c.niveau)))];
    const pools = new Map<string, { id: string; prenoms: string; nom: string }[]>();
    let nbEnseignants = 0;
    if (E.polyvalent) {
      const maitres = [];
      for (let i = 0; i < E.classes.length; i++) maitres.push(await creerPersonne("enseignant", "prof", E.etab.id));
      nbEnseignants = maitres.length;
      for (const d of toutesDisciplines) pools.set(d, maitres);
    } else {
      for (const d of toutesDisciplines) {
        const nClasses = E.classes.filter((c) => E.disciplinesDe(c.niveau).includes(d)).length;
        const taille = Math.max(1, Math.ceil(nClasses / 7));
        const pool = [];
        for (let i = 0; i < taille; i++) pool.push(await creerPersonne("enseignant", "prof", E.etab.id));
        pools.set(d, pool);
        nbEnseignants += taille;
      }
    }
    /** Enseignant de la discipline d pour la ci-ème classe (stable — maître de la classe au primaire). */
    const profDe = (ci: number, d: string) => {
      const pool = pools.get(d)!;
      return pool[ci % pool.length];
    };

    // Classes + élèves + inscriptions.
    const classes: { id: string; nom: string; niveau: string; eleves: { id: string }[] }[] = [];
    for (const C of E.classes) {
      const nid = niveauId.get(C.niveau);
      if (!nid) throw new Error(`Niveau introuvable : ${C.niveau}`);
      const classe = await prisma.classe.create({
        data: { nom: C.nom, etablissementId: E.etab.id, niveauId: nid, effectif: C.eleves, anneeScolaireId: anneeId },
      });

      const donneesEleves = Array.from({ length: C.eleves }, (_, k) => {
        const sexe = k % 2 === 0 ? "F" : "M";
        const prenoms = sexe === "F" ? tirer(PRENOMS_F) : tirer(PRENOMS_M);
        const nom = tirer(NOMS);
        numeroCompte++;
        const [aMin, aMax] = E.naissance;
        const naissance = jourUTC(aMin + Math.floor(alea() * (aMax - aMin + 1)), 1 + Math.floor(alea() * 12), 1 + Math.floor(alea() * 28));
        return {
          email: `eleve.${numeroCompte}${DOMAINE}`, motDePasseHash: hash, prenoms, nom, sexe,
          matricule: `${E.prefixeMatricule}${String(numeroCompte).padStart(5, "0")}`,
          dateNaissance: naissance, statutCompte: "actif" as const, emailVerifieLe: new Date(),
          roleActifId: roleId("eleve"), etablissementId: E.etab.id, pays: PAYS,
        };
      });
      await prisma.utilisateur.createMany({ data: donneesEleves });
      const eleves = await prisma.utilisateur.findMany({
        where: { email: { in: donneesEleves.map((d) => d.email) } },
        select: { id: true },
      });
      await prisma.inscription.createMany({
        data: eleves.map((el) => ({ eleveId: el.id, classeId: classe.id, anneeScolaireId: anneeId })),
      });
      compteur.eleves += eleves.length;
      classes.push({ id: classe.id, nom: C.nom, niveau: C.niveau, eleves });
    }

    // Affectations + spécialités : « qui enseigne quoi à qui » (sert aussi aux fiches Personnel).
    const affectations: { enseignantId: string; classeId: string; disciplineId: string }[] = [];
    const competences = new Set<string>();
    const cyclesNiveaux = new Set<string>();
    classes.forEach((c, ci) =>
      E.disciplinesDe(c.niveau).forEach((d) => {
        const did = disciplineId.get(d);
        if (!did) return;
        const prof = profDe(ci, d);
        affectations.push({ enseignantId: prof.id, classeId: c.id, disciplineId: did });
        competences.add(`${prof.id}|${did}`);
        cyclesNiveaux.add(`${prof.id}|${niveauId.get(c.niveau)}`);
      }),
    );
    await prisma.affectationEnseignant.createMany({ data: affectations, skipDuplicates: true });
    await prisma.competenceEnseignant.createMany({
      data: [...competences].map((k) => { const [enseignantId, did] = k.split("|"); return { enseignantId, disciplineId: did, etablissementId: E.etab.id }; }),
      skipDuplicates: true,
    });
    await prisma.niveauEnseignant.createMany({
      data: [...cyclesNiveaux].map((k) => { const [enseignantId, nid] = k.split("|"); return { enseignantId, niveauId: nid, etablissementId: E.etab.id }; }),
      skipDuplicates: true,
    });

    // NOTES (périodes 1 et 2) → les bulletins se calculent automatiquement à l'affichage.
    for (const [ci, c] of classes.entries()) {
      const lotNotes: Prisma.NoteCreateManyInput[] = [];
      for (const el of c.eleves) {
        const aptitude = 7 + alea() * 10; // profil stable par élève (6,5 → 17,5 environ)
        for (const d of E.disciplinesDe(c.niveau)) {
          const did = disciplineId.get(d);
          if (!did) continue;
          const prof = profDe(ci, d);
          for (const periode of [1, 2]) {
            for (const libelle of E.notesParPeriode) {
              const valeur = Math.min(19.5, Math.max(2, aptitude + (alea() - 0.5) * 6));
              lotNotes.push({
                eleveId: el.id, classeId: c.id, disciplineId: did, libelle,
                valeur: Math.round(valeur * 2) / 2, sur: 20, periode, saisiParId: prof.id,
              });
            }
          }
        }
      }
      await prisma.note.createMany({ data: lotNotes });
      compteur.notes += lotNotes.length;
    }

    // REGISTRES D'APPEL : ~2-3 appels/semaine/classe sur les 5 dernières semaines de cours
    // (insertion PAR CLASSE en 3 requêtes : appels, relecture, présences — tient les gros volumes).
    const jours = joursOuvrables(jourUTC(2026, 6, 8), jourUTC(2026, 7, 10));
    for (const [ci, c] of classes.entries()) {
      const liste = E.disciplinesDe(c.niveau);
      const joursClasse = jours.filter((_, i) => (i + ci) % 2 === 0); // décalés par classe
      const lotAppels: Prisma.AppelCreateManyInput[] = joursClasse.map((date, ji) => ({
        classeId: c.id, disciplineId: disciplineId.get(liste[(ji + ci) % liste.length]) ?? null,
        date, heureSeance: HEURES_SEANCE[ji % HEURES_SEANCE.length],
        saisiParId: profDe(ci, liste[(ji + ci) % liste.length]).id,
      }));
      await prisma.appel.createMany({ data: lotAppels });
      const appels = await prisma.appel.findMany({ where: { classeId: c.id }, select: { id: true } });
      const lotPresences: Prisma.PresenceCreateManyInput[] = [];
      for (const a of appels) {
        for (const el of c.eleves) {
          const r = alea();
          if (r < 0.93) lotPresences.push({ appelId: a.id, eleveId: el.id, statut: "present" });
          else if (r < 0.97) lotPresences.push({ appelId: a.id, eleveId: el.id, statut: "absent", motif: tirer(["Maladie", "Raison familiale", "Non justifiée"]), justifie: alea() < 0.5 });
          else lotPresences.push({ appelId: a.id, eleveId: el.id, statut: "retard", motif: "Retard de transport", justifie: true });
        }
      }
      await prisma.presence.createMany({ data: lotPresences });
      compteur.appels += appels.length;
      compteur.presences += lotPresences.length;
    }

    // CAHIERS DE TEXTE : séances publiées (2 disciplines phares × 3 dates par classe).
    const themes: Record<string, string[]> = {
      "Français": ["La phrase et ses constituants", "Lecture suivie : « L'enfant noir »", "L'accord du participe passé", "Production écrite : le récit"],
      "Mathématiques": ["Les fractions : addition et comparaison", "Géométrie : le cercle et le disque", "Proportionnalité et pourcentages", "Résolution de problèmes"],
      "Anglais": ["Greetings and introductions", "The simple present tense", "My family and my school"],
      "Histoire-Géographie": ["Les grands royaumes africains", "Le relief de la Côte d'Ivoire", "La colonisation et ses conséquences"],
      "SVT": ["La respiration chez les êtres vivants", "L'appareil digestif", "Les écosystèmes"],
      "Physique-Chimie": ["Les états de la matière", "Le circuit électrique simple", "Masse et volume"],
      "EDHC": ["Les valeurs de la République", "Le respect du bien commun", "La solidarité à l'école"],
      "EPS": ["Course de vitesse : technique de départ", "Jeux collectifs : le handball"],
      "Arts & Musique": ["Le chant choral : hymne national", "Dessin : les couleurs primaires"],
      "LV2": ["Saludos y presentaciones", "Los números y la familia"],
      "Philosophie": ["La conscience et l'inconscient", "La liberté et le déterminisme"],
    };
    const lotCahiers: Prisma.CahierTexteCreateManyInput[] = [];
    for (const [ci, c] of classes.entries()) {
      const liste = E.disciplinesDe(c.niveau);
      const matieresPhares = [liste[0], liste[1]]; // Français + Mathématiques
      for (const [mi, d] of matieresPhares.entries()) {
        const did = disciplineId.get(d);
        if (!did) continue;
        const prof = profDe(ci, d);
        const sujets = themes[d] ?? ["Séance de cours"];
        for (let s = 0; s < 3; s++) {
          const date = jours[(ci * 3 + s * 4 + mi) % jours.length];
          const titre = sujets[(ci + s) % sujets.length];
          lotCahiers.push({
            classeId: c.id, disciplineId: did, date, statut: "publie",
            titre, heureDebut: "08:00", dureeMin: 55, typeActivite: s === 2 ? "Évaluation" : "Cours",
            contenu: `${titre} — séance menée avec la classe de ${c.nom} : rappel des prérequis, découverte de la notion, exercices d'application au tableau puis en binômes. (Données de démonstration.)`,
            travailAFaire: s === 2 ? null : `Exercices ${s + 1} et ${s + 2} du cahier d'activités, à rendre à la prochaine séance.`,
            sousTitres: [
              { niveau: 1, texte: "Rappel des prérequis" },
              { niveau: 1, texte: "Découverte et institutionnalisation" },
              { niveau: 2, texte: "Exercices d'application" },
            ],
            enseignantId: prof.id, saisiParId: prof.id,
          });
        }
      }
    }
    await prisma.cahierTexte.createMany({ data: lotCahiers });
    compteur.cahiers += lotCahiers.length;

    // EMPLOI DU TEMPS hebdomadaire (créneaux dénormalisés — alimente l'onglet EDT).
    const lotCreneaux: Prisma.CreneauCreateManyInput[] = [];
    for (const [ci, c] of classes.entries()) {
      const liste = E.disciplinesDe(c.niveau);
      let slot = 0;
      for (let jour = 0; jour < 5; jour++) {
        for (let periode = 0; periode < 4; periode++) {
          const d = liste[(slot + ci) % liste.length];
          const did = disciplineId.get(d);
          const prof = profDe(ci, d);
          if (did) {
            lotCreneaux.push({
              etablissementId: E.etab.id, classeId: c.id, classeNom: c.nom,
              disciplineId: did, disciplineNom: d,
              enseignantId: prof.id, enseignantNom: `${prof.prenoms} ${prof.nom}`,
              salleNom: `Salle ${c.nom}`, jour, periode, duree: 1, anneeScolaireId: anneeId,
            });
          }
          slot++;
        }
      }
    }
    await prisma.creneau.createMany({ data: lotCreneaux });
    compteur.creneaux += lotCreneaux.length;

    const extras = E.personnelSupplementaire.map((p) => `${p.n} ${p.libelle}`).join(", ");
    console.log(
      `✓ ${classes.length} classes, ${classes.reduce((s, c) => s + c.eleves.length, 0)} élèves, ${nbEnseignants} enseignants` +
        (extras ? `, ${extras}` : "") + ` (+ ${E.fonctionChef.toLowerCase()} fictif : ${chef.prenoms} ${chef.nom}).`,
    );
  }

  console.log(`\nSimulation créée : ${compteur.eleves.toLocaleString("fr-FR")} élèves · ${compteur.personnels} personnels · ${compteur.notes.toLocaleString("fr-FR")} notes · ${compteur.appels.toLocaleString("fr-FR")} appels (${compteur.presences.toLocaleString("fr-FR")} présences) · ${compteur.cahiers} séances de cahier de texte · ${compteur.creneaux.toLocaleString("fr-FR")} créneaux d'EDT.`);
  console.log(`Réinitialisation : RESET=1 npm run db:seed:simulation-catholique`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
