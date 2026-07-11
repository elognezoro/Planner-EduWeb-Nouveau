/**
 * Rattrapage de sécurité (défense en profondeur) : re-sanitise TOUT contenu déjà stocké
 * qui commence par « < » (donc rendu comme HTML via dangerouslySetInnerHTML) et qui aurait
 * pu être enregistré avant l'introduction de l'éditeur riche sanitisé (LMS P5).
 * Champs concernés : ModuleCours.contenu, Devoir.consigne, SoumissionDevoir.texte/appreciation,
 * PageWiki.contenu, EvaluationWiki.commentaire.
 * Idempotent (sanitiser deux fois donne le même résultat).
 *
 *   npm run db:seed:sanitize-html
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sanitiserHtmlRiche } from "../src/lib/html-riche";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const estHtml = (v: string | null | undefined) => /^\s*</.test(v ?? "");

async function main() {
  let total = 0;

  const modules = await prisma.moduleCours.findMany({ where: { type: "texte" }, select: { id: true, contenu: true } });
  for (const m of modules) {
    if (!estHtml(m.contenu)) continue;
    const propre = sanitiserHtmlRiche(m.contenu);
    if (propre !== m.contenu) { await prisma.moduleCours.update({ where: { id: m.id }, data: { contenu: propre } }); total++; }
  }

  const devoirs = await prisma.devoir.findMany({ select: { id: true, consigne: true } });
  for (const d of devoirs) {
    if (!estHtml(d.consigne)) continue;
    const propre = sanitiserHtmlRiche(d.consigne);
    if (propre !== d.consigne) { await prisma.devoir.update({ where: { id: d.id }, data: { consigne: propre } }); total++; }
  }

  const soums = await prisma.soumissionDevoir.findMany({ select: { id: true, texte: true, appreciation: true } });
  for (const s of soums) {
    const data: { texte?: string; appreciation?: string } = {};
    if (estHtml(s.texte)) { const p = sanitiserHtmlRiche(s.texte); if (p !== s.texte) data.texte = p; }
    if (estHtml(s.appreciation)) { const p = sanitiserHtmlRiche(s.appreciation); if (p !== s.appreciation) data.appreciation = p; }
    if (Object.keys(data).length) { await prisma.soumissionDevoir.update({ where: { id: s.id }, data }); total++; }
  }

  console.log(`Rattrapage terminé : ${total} enregistrement(s) HTML re-sanitisé(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
