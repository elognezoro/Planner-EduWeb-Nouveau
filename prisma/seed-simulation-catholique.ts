/**
 * SIMULATION — données fictives de vie scolaire greffées sur deux établissements
 * catholiques RÉELS du répertoire (leurs fiches ne sont PAS modifiées) :
 *   1. École primaire catholique Saint-Augustin d'Abobo-Té — Archidiocèse d'Abidjan
 *      (seul établissement de type « primaire » du diocèse) → classes CP1…CM2 ;
 *   2. Collège Jean-Paul II d'Agboville (code 033289) — Diocèse d'Agboville → 6ème…3ème.
 * Chacun reçoit : classes + effectifs, élèves et enseignants fictifs (comptes non
 * connectables sur @simulation.eduweb.ci), affectations et spécialités, NOTES
 * (→ bulletins calculés), CAHIERS DE TEXTE publiés, REGISTRES D'APPEL (présences,
 * absences, retards) et un EMPLOI DU TEMPS hebdomadaire.
 *
 * RÉINITIALISABLE SANS TOUCHER AUX ÉTABLISSEMENTS RÉELS : la purge supprime les
 * classes contenant des élèves de démo, les créneaux de leurs enseignants de démo
 * et tous les comptes @simulation.eduweb.ci — rien d'autre.
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
/** Établissements FICTIFS de la première version de la simulation — purgés s'ils traînent encore. */
const CODES_LEGACY = ["SIM-CATH-PRIM", "SIM-CATH-SEC"];
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
const HEURES_SEANCE = ["07h30 - 08h30", "08h30 - 09h30", "10h15 - 11h15", "11h15 - 12h15", "15h00 - 16h00"] as const;

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

// ── PURGE CHIRURGICALE (au reset ET avant chaque recréation — idempotence). Les
// établissements réels ne sont jamais touchés : on supprime uniquement ce qui pend
// aux comptes de démo. ──
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

  // Reliquat éventuel de la première version (établissements entièrement fictifs).
  const legacy = await prisma.etablissement.findMany({ where: { code: { in: CODES_LEGACY } }, select: { id: true } });
  if (legacy.length > 0) {
    await prisma.creneau.deleteMany({ where: { etablissementId: { in: legacy.map((e) => e.id) } } });
    await prisma.etablissement.deleteMany({ where: { id: { in: legacy.map((e) => e.id) } } });
  }

  // Comptes de démo (cascade : compétences, niveaux d'intervention, affectations restantes).
  const comptes = await prisma.utilisateur.deleteMany({ where: { email: { endsWith: DOMAINE } } });
  console.log(
    `Purge : ${classes.count} classe(s), ${creneaux.count} créneau(x) et ${comptes.count} compte(s) ${DOMAINE} supprimés` +
      (legacy.length > 0 ? ` (+ ${legacy.length} ancien(s) établissement(s) fictif(s))` : "") + ".",
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
  const [roles, annee, disciplines] = await Promise.all([
    prisma.role.findMany({ where: { nomTechnique: { in: ["chef_etablissement", "enseignant", "eleve"] } }, select: { id: true, nomTechnique: true } }),
    prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true, libelle: true } }),
    prisma.discipline.findMany({ select: { id: true, nom: true } }),
  ]);
  const roleId = (t: string) => roles.find((r) => r.nomTechnique === t)?.id;
  if (!roleId("eleve") || !roleId("enseignant") || !roleId("chef_etablissement")) throw new Error("Rôles de base introuvables (seed initial exécuté ?).");
  const disciplineId = new Map(disciplines.map((d) => [d.nom, d.id]));
  const anneeId = annee?.id ?? null;

  // ── Cibles : deux établissements RÉELS du répertoire catholique ──
  const ciblePrimaire = await prisma.etablissement.findFirst({
    where: { ...FILTRE_CATHOLIQUE, diocese: "Archidiocèse d'Abidjan", type: "primaire" },
    orderBy: { nom: "asc" },
  });
  const cibleSecondaire =
    (await prisma.etablissement.findFirst({ where: { ...FILTRE_CATHOLIQUE, code: "033289" } })) ??
    (await prisma.etablissement.findFirst({
      where: { ...FILTRE_CATHOLIQUE, diocese: "Diocèse d'Agboville", type: "college" },
      orderBy: { nom: "asc" },
    }));
  if (!ciblePrimaire) throw new Error("Aucun établissement primaire catholique trouvé dans l'Archidiocèse d'Abidjan.");
  if (!cibleSecondaire) throw new Error("Aucun collège catholique trouvé dans le Diocèse d'Agboville.");

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

  const hash = randomBytes(32).toString("hex"); // non-bcrypt : comptes fictifs NON connectables

  // ── Configuration de la simulation par établissement ──
  const ETABS: {
    etab: Etablissement;
    slug: string;
    fonctionChef: string; prenomsChef: string; nomChef: string; sexeChef: "F" | "M";
    classes: { nom: string; niveau: string; eleves: number }[];
    disciplines: readonly string[]; notesParPeriode: string[];
    naissance: readonly [number, number]; prefixeMatricule: string;
    /** primaire : un maître polyvalent par classe ; secondaire : un enseignant par discipline. */
    polyvalent: boolean;
  }[] = [
    {
      etab: ciblePrimaire, slug: "prim",
      fonctionChef: "Directrice", prenomsChef: "Sœur Marie-Claire", nomChef: "KOUADIO", sexeChef: "F",
      classes: NIVEAUX_PRIMAIRES.map((n) => ({ nom: n, niveau: n, eleves: 30 })),
      disciplines: DISCIPLINES_PRIMAIRE, notesParPeriode: ["Devoir", "Composition"],
      naissance: [2014, 2019], prefixeMatricule: "26P", polyvalent: true,
    },
    {
      etab: cibleSecondaire, slug: "sec",
      fonctionChef: "Principal", prenomsChef: "Père Jean-Baptiste", nomChef: "AKASSI", sexeChef: "M",
      classes: [
        { nom: "6ème A", niveau: "6ème", eleves: 40 }, { nom: "6ème B", niveau: "6ème", eleves: 38 },
        { nom: "5ème A", niveau: "5ème", eleves: 38 }, { nom: "4ème A", niveau: "4ème", eleves: 36 },
        { nom: "3ème A", niveau: "3ème", eleves: 35 }, { nom: "3ème B", niveau: "3ème", eleves: 33 },
      ],
      disciplines: DISCIPLINES_COLLEGE, notesParPeriode: ["Devoir 1", "Devoir 2", "Composition"],
      naissance: [2009, 2013], prefixeMatricule: "26S", polyvalent: false,
    },
  ];

  const compteur = { eleves: 0, enseignants: 0, notes: 0, appels: 0, presences: 0, cahiers: 0, creneaux: 0 };
  let numeroCompte = 0;

  for (const E of ETABS) {
    console.log(`\n── ${E.etab.nom} (${E.etab.diocese}) ──`);

    // Chef d'établissement fictif (compte non connectable) rattaché à l'établissement réel.
    const chef = await prisma.utilisateur.create({
      data: {
        email: `chef.${E.slug}${DOMAINE}`, motDePasseHash: hash,
        prenoms: E.prenomsChef, nom: E.nomChef, sexe: E.sexeChef,
        statutCompte: "actif", emailVerifieLe: new Date(),
        roleActifId: roleId("chef_etablissement")!, etablissementId: E.etab.id, pays: PAYS,
      },
    });

    // Enseignants : au primaire un maître par classe (polyvalent) ; au collège un par discipline.
    const nbEnseignants = E.polyvalent ? E.classes.length : E.disciplines.length;
    const enseignants: { id: string; prenoms: string; nom: string }[] = [];
    for (let i = 0; i < nbEnseignants; i++) {
      const sexe = alea() < 0.5 ? "F" : "M";
      const prenoms = sexe === "F" ? tirer(PRENOMS_F) : tirer(PRENOMS_M);
      const nom = tirer(NOMS);
      numeroCompte++;
      const u = await prisma.utilisateur.create({
        data: {
          email: `prof.${numeroCompte}${DOMAINE}`, motDePasseHash: hash, prenoms, nom, sexe,
          statutCompte: "actif", emailVerifieLe: new Date(), roleActifId: roleId("enseignant")!,
          etablissementId: E.etab.id, pays: PAYS,
        },
      });
      enseignants.push({ id: u.id, prenoms, nom });
    }
    compteur.enseignants += enseignants.length + 1;

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
          matricule: `${E.prefixeMatricule}${String(numeroCompte).padStart(4, "0")}`,
          dateNaissance: naissance, statutCompte: "actif" as const, emailVerifieLe: new Date(),
          roleActifId: roleId("eleve")!, etablissementId: E.etab.id, pays: PAYS,
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
    const profDe = (classeIdx: number, discIdx: number) =>
      E.polyvalent ? enseignants[classeIdx % enseignants.length] : enseignants[discIdx % enseignants.length];
    const affectations: { enseignantId: string; classeId: string; disciplineId: string }[] = [];
    const competences = new Set<string>();
    const cyclesNiveaux = new Set<string>();
    classes.forEach((c, ci) =>
      E.disciplines.forEach((d, di) => {
        const did = disciplineId.get(d);
        if (!did) return;
        const prof = profDe(ci, di);
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
    const lotNotes: { eleveId: string; classeId: string; disciplineId: string; libelle: string; valeur: number; sur: number; periode: number; saisiParId: string }[] = [];
    classes.forEach((c, ci) => {
      for (const el of c.eleves) {
        const aptitude = 7 + alea() * 10; // profil stable par élève (6,5 → 17,5 environ)
        E.disciplines.forEach((d, di) => {
          const did = disciplineId.get(d);
          if (!did) return;
          const prof = profDe(ci, di);
          for (const periode of [1, 2]) {
            for (const libelle of E.notesParPeriode) {
              const valeur = Math.min(19.5, Math.max(2, aptitude + (alea() - 0.5) * 6));
              lotNotes.push({
                eleveId: el.id, classeId: c.id, disciplineId: did, libelle,
                valeur: Math.round(valeur * 2) / 2, sur: 20, periode, saisiParId: prof.id,
              });
            }
          }
        });
      }
    });
    await prisma.note.createMany({ data: lotNotes });
    compteur.notes += lotNotes.length;

    // REGISTRES D'APPEL : ~3 appels/semaine/classe sur les 5 dernières semaines de cours.
    const jours = joursOuvrables(jourUTC(2026, 6, 8), jourUTC(2026, 7, 10));
    for (const [ci, c] of classes.entries()) {
      const joursClasse = jours.filter((_, i) => (i + ci) % 2 === 0); // ~2-3/semaine, décalés par classe
      for (const [ji, date] of joursClasse.entries()) {
        const di = (ji + ci) % E.disciplines.length;
        const did = disciplineId.get(E.disciplines[di]);
        const prof = profDe(ci, di);
        const appel = await prisma.appel.create({
          data: { classeId: c.id, disciplineId: did ?? null, date, heureSeance: HEURES_SEANCE[ji % HEURES_SEANCE.length], saisiParId: prof.id },
        });
        const presences = c.eleves.map((el) => {
          const r = alea();
          if (r < 0.93) return { appelId: appel.id, eleveId: el.id, statut: "present" as const };
          if (r < 0.97) return { appelId: appel.id, eleveId: el.id, statut: "absent" as const, motif: tirer(["Maladie", "Raison familiale", "Non justifiée"]), justifie: alea() < 0.5 };
          return { appelId: appel.id, eleveId: el.id, statut: "retard" as const, motif: "Retard de transport", justifie: true };
        });
        await prisma.presence.createMany({ data: presences });
        compteur.appels++;
        compteur.presences += presences.length;
      }
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
    };
    const lotCahiers: Prisma.CahierTexteCreateManyInput[] = [];
    for (const [ci, c] of classes.entries()) {
      const matieresPhares = [E.disciplines[0], E.disciplines[1]]; // Français + Mathématiques
      for (const [mi, d] of matieresPhares.entries()) {
        const did = disciplineId.get(d);
        if (!did) continue;
        const prof = profDe(ci, mi);
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
      let slot = 0;
      for (let jour = 0; jour < 5; jour++) {
        for (let periode = 0; periode < 4; periode++) {
          const di = (slot + ci) % E.disciplines.length;
          const d = E.disciplines[di];
          const did = disciplineId.get(d);
          const prof = profDe(ci, di);
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

    console.log(`✓ ${classes.length} classes, ${classes.reduce((s, c) => s + c.eleves.length, 0)} élèves, ${enseignants.length} enseignants (+ ${E.fonctionChef.toLowerCase()} fictif : ${chef.prenoms} ${chef.nom}).`);
  }

  console.log(`\nSimulation créée : ${compteur.eleves} élèves · ${compteur.enseignants} personnels · ${compteur.notes.toLocaleString("fr-FR")} notes · ${compteur.appels} appels (${compteur.presences.toLocaleString("fr-FR")} présences) · ${compteur.cahiers} séances de cahier de texte · ${compteur.creneaux} créneaux d'EDT.`);
  console.log(`Réinitialisation : RESET=1 npm run db:seed:simulation-catholique`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
