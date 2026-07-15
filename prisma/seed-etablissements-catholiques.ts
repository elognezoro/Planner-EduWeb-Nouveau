/**
 * Croisement du répertoire des établissements catholiques de Côte d'Ivoire
 * (Repertoire_etablissements_catholiques_Cote_d_Ivoire.xlsx, feuille « Répertoire »,
 * données figées ci-dessous) avec les établissements existants de la plateforme,
 * puis rattachement de chacun à son diocèse (réseau SEDEC).
 *
 *   npx tsx prisma/seed-etablissements-catholiques.ts          → SIMULATION (rapport, aucune écriture)
 *   APPLY=1 npx tsx prisma/seed-etablissements-catholiques.ts  → application
 *
 * Anti-doublons (règle centrale) :
 *  - un établissement du répertoire qui correspond à un établissement EXISTANT
 *    (similarité de Dice sur le nom normalisé) est MIS À JOUR (statut confessionnel,
 *    réseau SEDEC, diocèse) — jamais recréé ;
 *  - sinon il est créé une seule fois ; au second passage il devient une
 *    correspondance exacte → mise à jour sans effet (seed idempotent) ;
 *  - deux lignes du répertoire ne peuvent pas cibler le même établissement.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { diocesesDuPays } from "../src/lib/referentiels/dioceses";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PAYS = "Côte d'Ivoire";
const APPLY = process.env.APPLY === "1";
// Seuils de décision (score de Dice sur le nom normalisé) :
/** Même établissement quel que soit le contexte (quasi-identique). */
const SEUIL_SUR = 0.93;
/** Même établissement si aucune ville ne CONTREDIT le rapprochement. */
const SEUIL_SANS_CONFLIT = 0.85;
/** Même établissement si la localité CONCORDE (nom court type « EPC Botro »). */
const SEUIL_AVEC_VILLE = 0.6;

type Cycle = "Maternelle" | "Primaire" | "Secondaire";
interface LigneRepertoire {
  diocese: string;
  cycle: Cycle;
  nom: string;
  localite: string | null;
}

// Feuille « Répertoire » du fichier source (39 établissements nommément recensés).
const REPERTOIRE: LigneRepertoire[] = [
  { diocese: "Archidiocèse d’Abidjan", cycle: "Primaire", nom: "École primaire catholique Saint-Augustin d’Abobo-Té", localite: "Abobo-Té" },
  { diocese: "Archidiocèse d’Abidjan", cycle: "Secondaire", nom: "Collège Notre-Dame d’Afrique de Biétry", localite: "Biétry, Abidjan" },
  { diocese: "Archidiocèse d’Abidjan", cycle: "Secondaire", nom: "Collège catholique Saint-Gaspard-Bertoni", localite: "Abobo PK 18" },
  { diocese: "Archidiocèse d’Abidjan", cycle: "Secondaire", nom: "Collège Saint-Viateur d’Abidjan", localite: "Abidjan" },
  { diocese: "Diocèse de Grand-Bassam", cycle: "Secondaire", nom: "Petit Séminaire Alberto-Fontana", localite: "Aboisso" },
  { diocese: "Diocèse de Yopougon", cycle: "Primaire", nom: "École primaire catholique Saint-Vincent-de-Paul d’Abobodoumé", localite: "Abobodoumé" },
  { diocese: "Diocèse de Yopougon", cycle: "Secondaire", nom: "Collège Notre-Dame-de-la-Paix", localite: "Dabou" },
  { diocese: "Diocèse de Yopougon", cycle: "Secondaire", nom: "Lycée Monseigneur-Kouassi", localite: "Dabou" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Bounda", localite: "Bounda" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Saint-Georges de Brobo", localite: "Brobo" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "NDR Belleville", localite: "Belleville, Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Saint-André 1", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Saint-André 2", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Tiéplé", localite: "Tiéplé" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Béoumi 1", localite: "Béoumi" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Béoumi 2", localite: "Béoumi" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Botro", localite: "Botro" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC NDA 1", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC NDA 2", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Saint-Jean Koko", localite: "Koko, Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC N’Djébonoua", localite: "N’Djébonoua" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Broukro", localite: "Broukro, Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC 1 Sakassou", localite: "Sakassou" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC 2 Sakassou", localite: "Sakassou" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPPC M’Bahiakro", localite: "M’Bahiakro" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Sainte-Marie de Daoukro", localite: "Daoukro" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC Saint-Paul de Daoukro", localite: "Daoukro" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Primaire", nom: "EPC FND Air France", localite: "Air France, Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Maternelle", nom: "École maternelle catholique Thérésina – NDA", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Maternelle", nom: "École maternelle catholique FND – Air France", localite: "Air France, Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Maternelle", nom: "École maternelle catholique de M’Bahiakro", localite: "M’Bahiakro" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Secondaire", nom: "Collège catholique Saint-André de Bouaké", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Secondaire", nom: "Collège Saint-Pierre-et-Saint-Paul de Daoukro", localite: "Daoukro" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Secondaire", nom: "Collège Saint-Michel de Belleville", localite: "Belleville, Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Secondaire", nom: "Collège Saint-Viateur", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Secondaire", nom: "Collège Saint-Marcellin-Champagnat", localite: "Bouaké" },
  { diocese: "Archidiocèse de Bouaké", cycle: "Secondaire", nom: "Collège catholique de jeunes filles de Béoumi", localite: "Béoumi" },
  { diocese: "Diocèse de Yamoussoukro", cycle: "Secondaire", nom: "Collège catholique Saint-Michel de Toumodi", localite: "Toumodi" },
  { diocese: "Diocèse de Daloa", cycle: "Secondaire", nom: "Collège catholique Pierre-Pango", localite: "Daloa" },
];

// ── Normalisation & similarité (mêmes règles que src/lib/etablissements/rapprochement.ts) ──
function normaliser(s: string): string {
  return s
    .replace(/[’‘`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function similarite(a: string, b: string): number {
  const bigrammes = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const A = bigrammes(a);
  const B = bigrammes(b);
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0;
  let commun = 0;
  for (const [bg, n] of A) commun += Math.min(n, B.get(bg) ?? 0);
  let totalA = 0;
  for (const n of A.values()) totalA += n;
  let totalB = 0;
  for (const n of B.values()) totalB += n;
  return (2 * commun) / (totalA + totalB);
}

/** Libellé canonique du diocèse (référentiel dioceses.ts), à partir du libellé du fichier. */
function dioceseCanonique(brut: string): string {
  const cible = normaliser(brut);
  const trouve = diocesesDuPays(PAYS).find((d) => normaliser(d) === cible);
  if (!trouve) throw new Error(`Diocèse hors référentiel : « ${brut} »`);
  return trouve;
}

function typeDepuis(l: LigneRepertoire): string {
  if (l.cycle === "Maternelle") return "prescolaire";
  if (l.cycle === "Primaire") return "primaire";
  return normaliser(l.nom).startsWith("lycee") ? "lycee" : "college";
}

// ── Garde-fous du rapprochement ──

/** Cycle déduit d'un nom d'établissement (« epc … » → primaire ; « college … » → secondaire), ou null. */
function cycleDuNom(nomN: string): "prescolaire" | "primaire" | "secondaire" | null {
  if (/\bmaternelle\b/.test(nomN)) return "prescolaire";
  if (/^(epc|epp|eppc|epv|ecole primaire|ecole catholique)\b/.test(nomN)) return "primaire";
  if (/^(college|lycee|cours secondaire|institution secondaire)\b/.test(nomN) || /\bseminaire\b/.test(nomN)) return "secondaire";
  return null; // groupe scolaire, institut… : indéterminé, compatible avec tout
}
const CYCLE_EXCEL: Record<Cycle, "prescolaire" | "primaire" | "secondaire"> = {
  Maternelle: "prescolaire",
  Primaire: "primaire",
  Secondaire: "secondaire",
};

/** Localité canonique : les communes/quartiers d'Abidjan et de Bouaké remontent à leur ville. */
const QUARTIERS_ABIDJAN = ["cocody", "abobo", "yopougon", "adjame", "treichville", "koumassi", "marcory", "plateau", "port bouet", "attecoube", "bietry", "riviera", "abobodoume", "anyama", "bingerville", "m badon", "mbadon"];
const QUARTIERS_BOUAKE = ["belleville", "koko", "air france", "broukro", "dar es salam"];
function villeCanonique(brut: string | null | undefined): string {
  const n = normaliser(brut ?? "");
  if (!n) return "";
  if (n.includes("abidjan") || QUARTIERS_ABIDJAN.some((q) => n.includes(q))) return "abidjan";
  if (n.includes("bouake") || QUARTIERS_BOUAKE.some((q) => n.includes(q))) return "bouake";
  return n;
}

async function main() {
  console.log(APPLY ? "MODE APPLICATION (écritures en base)" : "MODE SIMULATION (aucune écriture)\n");

  // Sanity : les diocèses du fichier doivent tous exister dans le référentiel.
  const dioceses = new Set(REPERTOIRE.map((l) => dioceseCanonique(l.diocese)));
  console.log(`Diocèses concernés (${dioceses.size}) : ${[...dioceses].join(" · ")}\n`);

  const existants = await prisma.etablissement.findMany({
    where: { pays: { equals: PAYS, mode: "insensitive" } },
    select: { id: true, nom: true, ville: true, statut: true, reseauConfessionnel: true, diocese: true },
  });
  console.log(`Établissements « ${PAYS} » en base : ${existants.length}`);
  if (existants.length === 0) {
    const tous = await prisma.etablissement.groupBy({ by: ["pays"], _count: { _all: true } });
    console.log("⚠ Aucun établissement pour ce pays. Répartition en base :", tous.map((t) => `${t.pays}:${t._count._all}`).join(", "));
  }

  const indexes = existants.map((e) => ({
    ...e,
    nomN: normaliser(e.nom),
    villeC: villeCanonique(e.ville),
    cycleN: cycleDuNom(normaliser(e.nom)),
  }));
  const dejaCibles = new Set<string>(); // anti-doublon : un établissement ne peut être ciblé qu'une fois
  let nbMaj = 0, nbDejaOk = 0, nbCrees = 0;

  for (const ligne of REPERTOIRE) {
    const diocese = dioceseCanonique(ligne.diocese);
    const nomN = normaliser(ligne.nom);
    const villeC = villeCanonique(ligne.localite);
    const cycle = CYCLE_EXCEL[ligne.cycle];

    // Meilleur candidat ACCEPTABLE parmi les existants non encore ciblés :
    //  - cycle compatible (une école primaire ne « matche » jamais un collège) ;
    //  - concordance de localité (ville canonique, ou localité présente dans le nom) ;
    //  - veto si les deux villes sont connues et contradictoires (sauf quasi-identité).
    let meilleur: (typeof indexes)[number] | null = null;
    let scoreMax = 0;
    let indice: { nom: string; score: number } | null = null; // meilleur brut, pour le rapport
    for (const e of indexes) {
      if (dejaCibles.has(e.id)) continue;
      const score = Math.max(similarite(nomN, e.nomN), e.villeC ? similarite(nomN, `${e.nomN} ${e.villeC}`) : 0);
      if (!indice || score > indice.score) indice = { nom: e.nom, score };
      if (e.cycleN && e.cycleN !== cycle) continue; // garde de cycle
      const concorde = Boolean(villeC && (e.villeC === villeC || e.nomN.includes(villeC)));
      const conflit = Boolean(villeC && e.villeC && e.villeC !== villeC && !e.nomN.includes(villeC));
      const acceptable =
        score >= SEUIL_SUR ||
        (score >= SEUIL_SANS_CONFLIT && !conflit) ||
        (score >= SEUIL_AVEC_VILLE && concorde);
      if (acceptable && score > scoreMax) { scoreMax = score; meilleur = e; }
    }

    if (meilleur) {
      dejaCibles.add(meilleur.id);
      const conforme = meilleur.statut === "confessionnel" && meilleur.reseauConfessionnel === "SEDEC" && meilleur.diocese === diocese;
      if (conforme) {
        nbDejaOk++;
        console.log(`= DÉJÀ-OK  (${scoreMax.toFixed(2)}) ${ligne.nom}  →  ${meilleur.nom} (ville: ${meilleur.ville ?? "?"})`);
      } else {
        nbMaj++;
        console.log(`~ MAJ      (${scoreMax.toFixed(2)}) ${ligne.nom}  →  ${meilleur.nom} (ville: ${meilleur.ville ?? "?"})  [${diocese}]`);
        if (APPLY) {
          await prisma.etablissement.update({
            where: { id: meilleur.id },
            data: {
              statut: "confessionnel",
              reseauConfessionnel: "SEDEC",
              diocese,
              ...(meilleur.ville ? {} : ligne.localite ? { ville: ligne.localite } : {}),
            },
          });
        }
      }
    } else {
      nbCrees++;
      const proche = indice ? ` (plus proche écarté : ${indice.nom} à ${indice.score.toFixed(2)})` : "";
      console.log(`+ CRÉATION ${ligne.nom} [${diocese} · ${typeDepuis(ligne)} · ${ligne.localite ?? "?"}]${proche}`);
      if (APPLY) {
        const cree = await prisma.etablissement.create({
          data: {
            nom: ligne.nom,
            pays: PAYS,
            ville: ligne.localite,
            type: typeDepuis(ligne),
            statut: "confessionnel",
            reseauConfessionnel: "SEDEC",
            diocese,
          },
          select: { id: true },
        });
        dejaCibles.add(cree.id);
        indexes.push({ id: cree.id, nom: ligne.nom, ville: ligne.localite, statut: "confessionnel", reseauConfessionnel: "SEDEC", diocese, nomN, villeC, cycleN: cycle });
      } else {
        // En simulation aussi, éviter qu'une ligne suivante « matche » une création fictive.
        indexes.push({ id: `simu-${nbCrees}`, nom: ligne.nom, ville: ligne.localite, statut: "confessionnel", reseauConfessionnel: "SEDEC", diocese, nomN, villeC, cycleN: cycle });
        dejaCibles.add(`simu-${nbCrees}`);
      }
    }
  }

  console.log(`\nBilan : ${nbMaj} mise(s) à jour · ${nbCrees} création(s) · ${nbDejaOk} déjà conforme(s) — total ${REPERTOIRE.length} lignes.`);
  if (APPLY) {
    const parDiocese = await prisma.etablissement.groupBy({
      by: ["diocese"],
      where: { pays: { equals: PAYS, mode: "insensitive" }, statut: "confessionnel", reseauConfessionnel: "SEDEC" },
      _count: { _all: true },
    });
    console.log("\nÉtablissements catholiques (SEDEC) par diocèse :");
    parDiocese
      .sort((a, b) => (a.diocese ?? "").localeCompare(b.diocese ?? "", "fr"))
      .forEach((d) => console.log(`  ${d.diocese ?? "(sans diocèse)"} : ${d._count._all}`));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
