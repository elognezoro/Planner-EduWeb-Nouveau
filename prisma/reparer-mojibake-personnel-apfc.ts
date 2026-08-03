/**
 * RÉPARATION des caractères perdus « � » (U+FFFD) du PERSONNEL DES APFC — gravés en base par
 * d'anciens imports CSV Windows-1252 décodés en UTF-8 (corrigé depuis : lireFichierTexte).
 *
 * Remplacements EXPLICITES uniquement (validés par inspection, prisma/inspecter-mojibake.ts) :
 * un « � » est une perte irréversible, on ne restaure que les mots identifiés sans ambiguïté.
 * « M�BAHIA » provient de l'apostrophe typographique de Windows-1252 (0x92) → « M’BAHIA ».
 * Idempotent : un second passage ne trouve plus rien à réparer. Les valeurs qui garderaient
 * un « � » après remplacement sont listées (correction manuelle via l'édition en ligne).
 *   npx tsx prisma/reparer-mojibake-personnel-apfc.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const FFFD = "�";

const REMPLACEMENTS: [string, string][] = [
  ["P�dagogique", "Pédagogique"],
  ["Mo�se", "Moïse"],
  ["M�BAHIA", "M’BAHIA"],
  ["G�ographie", "Géographie"],
  ["Fran�ais", "Français"],
  ["Math�matiques", "Mathématiques"],
];

function reparer(s: string): string {
  let r = s;
  for (const [avant, apres] of REMPLACEMENTS) r = r.split(avant).join(apres);
  return r;
}

async function main() {
  const fiches = await prisma.personnelApfc.findMany({
    where: {
      OR: [
        { nom: { contains: FFFD } },
        { prenoms: { contains: FFFD } },
        { fonction: { contains: FFFD } },
        { email: { contains: FFFD } },
      ],
    },
  });
  // Fiches dont SEULES les disciplines (Json) sont touchées.
  const toutes = await prisma.personnelApfc.findMany();
  const parId = new Map(fiches.map((f) => [f.id, f]));
  for (const f of toutes) {
    if (parId.has(f.id)) continue;
    if (Array.isArray(f.disciplines) && (f.disciplines as unknown[]).some((d) => typeof d === "string" && d.includes(FFFD))) {
      parId.set(f.id, f);
    }
  }

  let reparees = 0;
  const restantes: string[] = [];
  for (const f of parId.values()) {
    const nom = reparer(f.nom);
    const prenoms = f.prenoms ? reparer(f.prenoms) : f.prenoms;
    const fonction = f.fonction ? reparer(f.fonction) : f.fonction;
    const email = f.email ? reparer(f.email) : f.email;
    const disciplines = Array.isArray(f.disciplines)
      ? (f.disciplines as unknown[]).map((d) => (typeof d === "string" ? reparer(d) : d))
      : f.disciplines;

    await prisma.personnelApfc.update({
      where: { id: f.id },
      data: { nom, prenoms, fonction, email, disciplines: disciplines as never },
    });
    reparees++;
    console.log(`✓ ${f.nom} ${f.prenoms ?? ""} → ${nom} ${prenoms ?? ""} · ${fonction ?? ""} · ${JSON.stringify(disciplines)}`);

    const reste = [nom, prenoms ?? "", fonction ?? "", email ?? "", JSON.stringify(disciplines)].join(" ");
    if (reste.includes(FFFD)) restantes.push(`${f.id} : ${reste}`);
  }

  console.log(`\nTerminé : ${reparees} fiche(s) réparée(s).`);
  if (restantes.length > 0) {
    console.log(`⚠ ${restantes.length} valeur(s) encore ambiguë(s) — à corriger à la main (crayon de l'annuaire) :`);
    for (const r of restantes) console.log("  " + r);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
