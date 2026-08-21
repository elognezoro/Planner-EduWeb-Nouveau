/**
 * Grille horaire NATIONALE par défaut de l'enseignement secondaire général de CÔTE D'IVOIRE,
 * d'après la Circulaire N° 0311/MENA/CAB/DPFC (année scolaire 2025-2026).
 *
 * Conventions (validées avec le client) :
 *  - 1 heure = 55 minutes → N heures de cours = N séances de 55 min.
 *  - Sciences (Physique-Chimie, SVT), notation « a + b + (c) » : chaque terme = UNE séance de
 *    sa durée ; 1h30 = 82,5 → 83 min ; 2h = 110 ; 2h30 = 138 ; 3h = 165 ; « 0 » = rien ;
 *    « QZ » (quinzaine) = TP bihebdomadaire → porté à MOITIÉ (1h30 QZ ≈ 41 min) pour coller au
 *    total officiel ; la demi-classe est gérée hors grille.
 *  - Matières FACULTATIVES (« fac », LV2 en 1èreC/D et TleC/D) : facultatif=true — proposées par
 *    le modèle national mais NON générées par défaut ; chaque établissement les inclut s'il peut.
 *  - TleA2 et 1èreA = colonne « Tle A » / « 1re A » série A2 (Maths : TleA2=4, 1èreA=3).
 *
 * Disciplines (choix « Nettoyer les noms ») : renomme « Histoire-Géographie\ FR » →
 * « Histoire-Géographie » et « SVT\PC » → « SVT » ; crée « LV2 » ; « Dessin/Éd. musicale »
 * porté par « Arts Plastiques ». La grille est NATIONALE (etablissementId nul, pays CI) :
 * chaque établissement en hérite et peut la surcharger localement.
 *
 * Idempotent : remplace intégralement la grille nationale CI existante.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try { process.loadEnvFile(); } catch { /* variables déjà présentes */ }
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PAYS = "Côte d'Ivoire";
// Ordre des colonnes de la circulaire → niveaux nationaux de la base.
const NIVEAUX = ["6ème", "5ème", "4ème", "3ème", "2ndeA", "2ndeC", "1èreA", "1èreC", "1èreD", "TleA2", "TleC", "TleD"] as const;

const s55 = (n: number): number[] => Array(n).fill(55);

// Disciplines RÉGULIÈRES : heures entières → N séances de 55 min (null = pas de ligne).
const REGULIERES: Record<string, (number | null)[]> = {
  //                        6e 5e 4e 3e 2A 2C 1A 1C 1D TA2 TC TD
  "Anglais":               [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2],
  "Arts Plastiques":       [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Dessin/Éd. musicale
  "EDHC":                  [1, 1, 1, 1, null, null, null, null, null, null, null, null],
  "EPS":                   [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  "Français":              [5, 5, 6, 6, 4, 4, 4, 3, 3, 4, 3, 3],
  "Histoire-Géographie":   [2, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  "LV2":                   [null, null, 3, 3, 3, 3, 3, null, null, 3, null, null], // fac exclus
  "Mathématiques":         [4, 4, 4, 4, 3, 5, 3, 6, 5, 4, 8, 6], // 1èreA=A2=3, TleA2=A2=4
  "TICE":                  [1, 1, 1, 1, null, null, null, null, null, null, null, null],
  "Philosophie":           [null, null, null, null, null, null, 3, 2, 2, 8, 3, 3],
};

// Sciences : séances explicites (minutes réelles), null = pas de ligne.
// 1èreA (index 6) : TP « (1h30) QZ » porté à moitié → 41 min (quinzaine), pour le total officiel.
const SCIENCES: Record<string, (number[] | null)[]> = {
  //                 6e     5e     4e     3e      2ndeA       2ndeC            1èreA      1èreC            1èreD           TleA2      TleC              TleD
  "Physique-Chimie": [[83], [83], [83], [110], [110, 83], [55, 110, 110], [55, 41], [55, 138, 110], [55, 110, 83], null, [110, 110, 110], [55, 110, 110]],
  "SVT":             [[83], [83], [83], [110], [83],      [110],          [55, 41], [110],           [55, 110],     [110], [110],          [55, 55, 165]],
};

// Disciplines FACULTATIVES : proposées mais NON générées par défaut (facultatif=true).
// LV2 « 2 fac » = 2 séances de 55 min, en 1èreC (7), 1èreD (8), TleC (10), TleD (11).
const FACULTATIVES: Record<string, (number[] | null)[]> = {
  //         6e    5e    4e    3e    2A    2C    1A    1C          1D          TA2   TC          TD
  "LV2":    [null, null, null, null, null, null, null, [55, 55], [55, 55], null, [55, 55], [55, 55]],
};

async function renommerDisciplineNationale(ancien: string, nouveau: string) {
  const cible = await prisma.discipline.findFirst({ where: { nom: ancien, etablissementId: null }, select: { id: true } });
  if (cible) {
    await prisma.discipline.update({ where: { id: cible.id }, data: { nom: nouveau } });
    console.log(`  renommée : « ${ancien} » → « ${nouveau} »`);
  }
}

async function main() {
  console.log("→ Nettoyage des noms de disciplines (national)…");
  await renommerDisciplineNationale("Histoire-Géographie\\ FR", "Histoire-Géographie");
  await renommerDisciplineNationale("SVT\\PC", "SVT");

  // LV2 (créneau 2e langue vivante) : créée au national si absente.
  const lv2 = await prisma.discipline.findFirst({ where: { nom: "LV2", etablissementId: null }, select: { id: true } });
  if (!lv2) {
    await prisma.discipline.create({ data: { nom: "LV2", couleur: "#2f7d5e", etablissementId: null } });
    console.log("  créée : « LV2 »");
  }

  // Résolution des niveaux et disciplines nationaux par nom.
  const niveaux = await prisma.niveau.findMany({ where: { etablissementId: null }, select: { id: true, nom: true } });
  const idNiveau = new Map(niveaux.map((n) => [n.nom, n.id]));
  for (const n of NIVEAUX) if (!idNiveau.has(n)) throw new Error(`Niveau national introuvable : ${n}`);

  const nomsDisciplines = [...new Set([...Object.keys(REGULIERES), ...Object.keys(SCIENCES), ...Object.keys(FACULTATIVES)])];
  const disciplines = await prisma.discipline.findMany({ where: { nom: { in: nomsDisciplines }, etablissementId: null }, select: { id: true, nom: true } });
  const idDiscipline = new Map(disciplines.map((d) => [d.nom, d.id]));
  for (const d of nomsDisciplines) if (!idDiscipline.has(d)) throw new Error(`Discipline nationale introuvable : ${d}`);

  // Construction des lignes de grille (etablissementId nul, pays CI).
  type Ligne = { niveauId: string; disciplineId: string; seancesMinutes: number[]; nbSeances: number; heuresHebdo: number; facultatif: boolean };
  const lignes: Ligne[] = [];
  const ajouter = (discNom: string, niveauIdx: number, seances: number[], facultatif = false) => {
    lignes.push({
      niveauId: idNiveau.get(NIVEAUX[niveauIdx])!,
      disciplineId: idDiscipline.get(discNom)!,
      seancesMinutes: seances,
      nbSeances: seances.length,
      // heuresHebdo = NOMBRE DE SÉANCES (convention plateforme, entier propre pour l'éditeur
      // national) ; les DURÉES réelles vivent dans seancesMinutes (source du solveur/affichage).
      heuresHebdo: seances.length,
      facultatif,
    });
  };
  for (const [nom, valeurs] of Object.entries(REGULIERES)) {
    valeurs.forEach((h, i) => { if (h && h > 0) ajouter(nom, i, s55(h)); });
  }
  for (const [nom, valeurs] of Object.entries(SCIENCES)) {
    valeurs.forEach((arr, i) => { if (arr && arr.length) ajouter(nom, i, arr); });
  }
  for (const [nom, valeurs] of Object.entries(FACULTATIVES)) {
    valeurs.forEach((arr, i) => { if (arr && arr.length) ajouter(nom, i, arr, true); });
  }

  // Remplacement intégral de la grille nationale CI (transaction).
  const supprimees = await prisma.grilleHoraire.count({ where: { etablissementId: null, pays: PAYS } });
  await prisma.$transaction([
    prisma.grilleHoraire.deleteMany({ where: { etablissementId: null, pays: PAYS } }),
    prisma.grilleHoraire.createMany({
      data: lignes.map((l) => ({ ...l, etablissementId: null, pays: PAYS, coefficient: 1 })),
    }),
  ]);

  const nbFac = lignes.filter((l) => l.facultatif).length;
  console.log(`\n✓ Grille nationale CI : ${supprimees} ligne(s) remplacée(s) par ${lignes.length} ligne(s) (dont ${nbFac} facultative(s)) — circulaire N° 0311.`);
  // Total ÉLÈVE généré par défaut = hors facultatives (celles-ci ne sont pas générées d'office).
  const parNiveau = new Map<string, number>();
  for (const l of lignes) {
    if (l.facultatif) continue;
    const nom = niveaux.find((n) => n.id === l.niveauId)!.nom;
    parNiveau.set(nom, (parNiveau.get(nom) ?? 0) + l.seancesMinutes.reduce((a, b) => a + b, 0));
  }
  for (const n of NIVEAUX) {
    const min = parNiveau.get(n) ?? 0;
    console.log(`   ${n.padEnd(7)} : ${(min / 55).toFixed(2)} h officielles (${min} min réels)`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
