/**
 * Migration : dans les GRILLES horaires, les lignes d'OPTION (LV2-Allemand, LV2-Espagnol,
 * Arts Plastiques, Musique, Éducation musicale) sont remplacées par la ligne de la discipline-PARENT
 * générique (LV2, « Arts (Plastiques & Musicale) »). La grille liste désormais la discipline ; c'est
 * le solveur qui décline l'option par classe à la génération.
 *
 * Portée : grille NATIONALE (etablissementId null) ET toutes les grilles d'établissement.
 * Fusion : une classe ne fait qu'UNE option de la famille → volume du parent = celui de la ligne
 * d'option la PLUS FOURNIE (max minutes) parmi les options du même (niveau, portée) ; les autres
 * lignes d'option sont supprimées. Une ligne parent préexistante est conservée si elle est ≥.
 * Idempotent : sans ligne d'option, rien à faire. DRY-RUN par défaut ; APPLIQUER=1 pour écrire.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { FAMILLES_OPTIONS, parentDeOption } from "../src/lib/disciplines/options-disciplines";
config({ path: ".env" });
config({ path: ".env.local", override: true });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLIQUER = process.env.APPLIQUER === "1";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const minutes = (arr: number[]) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

type Row = {
  id: string; niveauId: string; disciplineId: string; etablissementId: string | null;
  seancesMinutes: number[]; nbSeances: number | null; coefficient: number; heuresHebdo: number; facultatif: boolean;
};

async function main() {
  const [disciplines, rows, niveaux] = await Promise.all([
    prisma.discipline.findMany({ select: { id: true, nom: true } }),
    prisma.grilleHoraire.findMany({
      select: { id: true, niveauId: true, disciplineId: true, etablissementId: true, seancesMinutes: true, nbSeances: true, coefficient: true, heuresHebdo: true, facultatif: true },
    }),
    prisma.niveau.findMany({ select: { id: true, nom: true } }),
  ]);
  const nomDe = new Map(disciplines.map((d) => [d.id, d.nom]));
  const nivNom = new Map(niveaux.map((n) => [n.id, n.nom]));
  // id de la discipline-parent NATIONALE par famille (norm(parent) → id).
  const parentIdParFamille = new Map<string, string>();
  for (const fam of FAMILLES_OPTIONS) {
    const d = disciplines.find((x) => norm(x.nom) === norm(fam.parent) );
    if (d) parentIdParFamille.set(norm(fam.parent), d.id);
  }

  // Grouper les lignes d'OPTION par (portée, niveau, parent).
  const groupes = new Map<string, { parentNorm: string; parentId: string; scope: string | null; niveauId: string; options: Row[]; parentRow?: Row }>();
  const cle = (scope: string | null, niveauId: string, parentNorm: string) => `${scope ?? "NAT"}::${niveauId}::${parentNorm}`;
  for (const r of rows as Row[]) {
    const nom = nomDe.get(r.disciplineId) ?? "";
    const parent = parentDeOption(nom);
    if (!parent) continue;
    const pN = norm(parent);
    const parentId = parentIdParFamille.get(pN);
    if (!parentId) continue;
    const k = cle(r.etablissementId, r.niveauId, pN);
    const g = groupes.get(k) ?? { parentNorm: pN, parentId, scope: r.etablissementId, niveauId: r.niveauId, options: [] };
    g.options.push(r);
    groupes.set(k, g);
  }
  // Attacher une éventuelle ligne PARENT préexistante (même portée/niveau).
  for (const r of rows as Row[]) {
    const nom = nomDe.get(r.disciplineId) ?? "";
    const pN = norm(nom);
    if (!parentIdParFamille.has(pN)) continue;
    const k = cle(r.etablissementId, r.niveauId, pN);
    const g = groupes.get(k);
    if (g) g.parentRow = r;
  }

  let nbGroupes = 0, nbSuppr = 0, nbUpserts = 0;
  const suppressions: string[] = [];
  const upserts: { niveauId: string; disciplineId: string; etablissementId: string | null; row: Row }[] = [];

  for (const g of groupes.values()) {
    // VOLUME PRÉSERVÉ : on CUMULE les séances de toutes les lignes d'option (55 + 55 → [55,55]) —
    // le solveur en fera UNE option concrète par classe, mais le volume horaire total est conservé
    // (jamais d'heures perdues). Une ligne parent préexistante n'est gardée que si elle est ≥.
    const combineSeances = g.options.flatMap((o) => o.seancesMinutes);
    let seances = combineSeances;
    let coef = g.options.reduce((a, b) => (minutes(b.seancesMinutes) > minutes(a.seancesMinutes) ? b : a)).coefficient;
    let facultatif = g.options.every((o) => o.facultatif);
    if (g.parentRow && minutes(g.parentRow.seancesMinutes) >= minutes(combineSeances)) {
      seances = g.parentRow.seancesMinutes; coef = g.parentRow.coefficient; facultatif = g.parentRow.facultatif;
    }
    nbGroupes++;
    const scopeLib = g.scope ? `ÉTAB ${g.scope.slice(0, 8)}…` : "NATIONALE";
    const detail = g.options.map((o) => `${nomDe.get(o.disciplineId)} [${minutes(o.seancesMinutes)}min]`).join(" + ");
    const cumul = g.options.length > 1 ? " ⟵ CUMUL" : "";
    console.log(`[${scopeLib}] ${nivNom.get(g.niveauId) ?? g.niveauId} : ${detail}${g.parentRow ? ` (+ parent ${minutes(g.parentRow.seancesMinutes)}min)` : ""} → ${nomDe.get(g.parentId)} [${minutes(seances)}min, ${seances.length} séance(s)]${cumul}`);
    upserts.push({ niveauId: g.niveauId, disciplineId: g.parentId, etablissementId: g.scope, row: { ...g.options[0], seancesMinutes: seances, coefficient: coef, facultatif } });
    nbUpserts++;
    // Supprimer toutes les lignes d'option du groupe (jamais la ligne parent préexistante).
    for (const o of g.options) { suppressions.push(o.id); nbSuppr++; }
  }

  if (APPLIQUER) {
    for (const u of upserts) {
      const existant = await prisma.grilleHoraire.findFirst({
        where: { niveauId: u.niveauId, disciplineId: u.disciplineId, etablissementId: u.etablissementId },
        select: { id: true },
      });
      const data = {
        seancesMinutes: u.row.seancesMinutes,
        nbSeances: u.row.seancesMinutes.length,
        heuresHebdo: minutes(u.row.seancesMinutes) / 60,
        coefficient: u.row.coefficient,
        facultatif: u.row.facultatif,
      };
      if (existant) await prisma.grilleHoraire.update({ where: { id: existant.id }, data });
      else await prisma.grilleHoraire.create({ data: { niveauId: u.niveauId, disciplineId: u.disciplineId, etablissementId: u.etablissementId, pays: "Côte d'Ivoire", ...data } });
    }
    // Supprimer les lignes d'option APRÈS avoir posé les parents (une ligne parent préexistante n'est jamais dans la liste).
    if (suppressions.length > 0) await prisma.grilleHoraire.deleteMany({ where: { id: { in: suppressions } } });
  }

  console.log(`\n${APPLIQUER ? "APPLIQUÉ" : "DRY-RUN"} — ${nbGroupes} groupe(s), ${nbUpserts} ligne(s) parent, ${nbSuppr} ligne(s) d'option supprimée(s).`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
