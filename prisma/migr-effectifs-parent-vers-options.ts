/**
 * Migration : les effectifs des familles à options (LV2, Arts) passent du PARENT vers ses OPTIONS.
 *
 * Nouveau modèle : l'effectif se déclare PAR OPTION (éditable) ; le parent n'affiche que la SOMME
 * (lecture seule). Cette bascule répartit l'effectif actuellement porté par le parent sur ses
 * options — proportionnellement au nombre réel d'enseignants compétents (repli : répartition égale,
 * reste sur la 1re option) — PUIS met l'effectif du parent à 0 (pour ne pas doubler au solveur).
 *
 * Idempotent : si les options portent déjà un effectif (> 0), la famille est ignorée (déjà migrée).
 * Lecture EN MASSE puis traitement en mémoire (rapide). DRY-RUN par défaut ; APPLIQUER=1 pour écrire.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { FAMILLES_OPTIONS, parentDeOption, optionCanonique } from "../src/lib/disciplines/options-disciplines";
config({ path: ".env" });
config({ path: ".env.local", override: true });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLIQUER = process.env.APPLIQUER === "1";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function repartir(total: number, poids: number[]): number[] {
  const n = poids.length;
  if (n === 0 || total <= 0) return poids.map(() => 0);
  const sommePoids = poids.reduce((a, b) => a + b, 0);
  const base = sommePoids > 0 ? poids : poids.map(() => 1);
  const sb = base.reduce((a, b) => a + b, 0);
  const bruts = base.map((p) => (total * p) / sb);
  const parts = bruts.map((x) => Math.floor(x));
  let reste = total - parts.reduce((a, b) => a + b, 0);
  const ordre = bruts.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < ordre.length && reste > 0; k++, reste--) parts[ordre[k].i]++;
  return parts;
}

async function main() {
  const [etabs, disciplines, effsAll, comptesAll] = await Promise.all([
    prisma.etablissement.findMany({ select: { id: true, nom: true, disciplinesMasquees: true } }),
    prisma.discipline.findMany({ select: { id: true, nom: true, etablissementId: true } }),
    prisma.effectifEnseignant.findMany({ select: { etablissementId: true, disciplineId: true, cycle: true, nombre: true } }),
    prisma.competenceEnseignant.groupBy({ by: ["etablissementId", "disciplineId"], _count: { _all: true } }),
  ]);

  const nat = disciplines.filter((d) => d.etablissementId === null);
  const propresParEtab = new Map<string, typeof disciplines>();
  for (const d of disciplines) if (d.etablissementId) propresParEtab.set(d.etablissementId, [...(propresParEtab.get(d.etablissementId) ?? []), d]);
  const eff = new Map<string, number>();
  for (const x of effsAll) eff.set(`${x.etablissementId}:${x.disciplineId}:${x.cycle}`, x.nombre);
  const compte = new Map<string, number>();
  for (const c of comptesAll) compte.set(`${c.etablissementId}:${c.disciplineId}`, c._count._all);

  const effDe = (etab: string, id: string, cy: string) => eff.get(`${etab}:${id}:${cy}`) ?? 0;
  const ecritures: { etab: string; disc: string; cycle: "college" | "lycee"; nombre: number }[] = [];
  let familles = 0;

  for (const e of etabs) {
    const masquees = new Set(e.disciplinesMasquees);
    const ds = [...nat, ...(propresParEtab.get(e.id) ?? [])];
    for (const fam of FAMILLES_OPTIONS) {
      const parent = ds.find((d) => norm(d.nom) === norm(fam.parent));
      if (!parent) continue;
      const pc = effDe(e.id, parent.id, "college");
      const pl = effDe(e.id, parent.id, "lycee");
      if (pc <= 0 && pl <= 0) continue;

      const optDisc = ds.filter((d) => norm(parentDeOption(d.nom) ?? "") === norm(fam.parent));
      const groupes = new Map<string, { cibleId: string; comptesDisc: string[] }>();
      for (const d of optDisc) {
        const canon = norm(optionCanonique(d.nom));
        const g = groupes.get(canon) ?? { cibleId: "", comptesDisc: [] };
        g.comptesDisc.push(d.id);
        if (!masquees.has(d.id)) {
          const nomCanon = optionCanonique(d.nom);
          if (!g.cibleId || norm(d.nom) === norm(nomCanon)) g.cibleId = d.id;
        }
        groupes.set(canon, g);
      }
      const cibles = [...groupes.values()].filter((g) => g.cibleId);
      if (cibles.length === 0) continue;
      if (cibles.some((g) => effDe(e.id, g.cibleId, "college") > 0 || effDe(e.id, g.cibleId, "lycee") > 0)) continue;

      const poids = cibles.map((g) => g.comptesDisc.reduce((s, id) => s + (compte.get(`${e.id}:${id}`) ?? 0), 0));
      const partsC = repartir(pc, poids);
      const partsL = repartir(pl, poids);

      familles++;
      console.log(`\n[${e.nom}] ${fam.parent}  parent col=${pc} lyc=${pl}  poids=[${poids.join(",")}]`);
      for (let i = 0; i < cibles.length; i++) {
        const nom = ds.find((d) => d.id === cibles[i].cibleId)?.nom ?? cibles[i].cibleId;
        console.log(`    ${nom.padEnd(24)} col=${partsC[i]} lyc=${partsL[i]}`);
        ecritures.push({ etab: e.id, disc: cibles[i].cibleId, cycle: "college", nombre: partsC[i] });
        ecritures.push({ etab: e.id, disc: cibles[i].cibleId, cycle: "lycee", nombre: partsL[i] });
      }
      console.log(`    ${fam.parent} → col=0 lyc=0 (remis à zéro)`);
      ecritures.push({ etab: e.id, disc: parent.id, cycle: "college", nombre: 0 });
      ecritures.push({ etab: e.id, disc: parent.id, cycle: "lycee", nombre: 0 });
    }
  }

  if (APPLIQUER && ecritures.length > 0) {
    await Promise.all(
      ecritures.map((w) =>
        prisma.effectifEnseignant.upsert({
          where: { etablissementId_disciplineId_cycle: { etablissementId: w.etab, disciplineId: w.disc, cycle: w.cycle } },
          update: { nombre: w.nombre },
          create: { etablissementId: w.etab, disciplineId: w.disc, cycle: w.cycle, nombre: w.nombre },
        }),
      ),
    );
  }
  console.log(`\n${APPLIQUER ? "APPLIQUÉ" : "DRY-RUN"} — ${familles} famille(s), ${ecritures.length} écriture(s).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
