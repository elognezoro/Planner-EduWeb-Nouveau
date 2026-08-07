import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { configEtablissementExportee } from "@/lib/etablissements/config-transfert";

/** Exporte la configuration d'un établissement au format JSON (téléchargement). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = await getUtilisateurCourant();
  if (!u) return new Response("Non autorisé", { status: 401 });
  if (u.roleReel !== "admin" && u.portee.etablissementId !== id) {
    return new Response("Accès refusé", { status: 403 });
  }

  const etab = await prisma.etablissement.findUnique({ where: { id } });
  if (!etab) return new Response("Introuvable", { status: 404 });

  const [niveauxConfig, champs, grilles] = await Promise.all([
    prisma.niveauEtablissement.findMany({ where: { etablissementId: id } }),
    prisma.champEnseignant.findMany({ where: { etablissementId: id }, orderBy: { ordre: "asc" } }),
    prisma.grilleHoraire.findMany({ where: { etablissementId: id } }),
  ]);

  const config = {
    version: 1,
    etablissement: configEtablissementExportee(etab),
    niveauxConfig: niveauxConfig.map((n) => ({ niveauId: n.niveauId, effectif: n.effectif, vacation: n.vacation, nbClasses: n.nbClasses })),
    champs: champs.map((c) => ({ etiquette: c.etiquette, type: c.type, placeholder: c.placeholder, requis: c.requis, ordre: c.ordre })),
    grilles: grilles.map((g) => ({ niveauId: g.niveauId, disciplineId: g.disciplineId, seancesMinutes: g.seancesMinutes, coefficient: g.coefficient, heuresHebdo: g.heuresHebdo, nbSeances: g.nbSeances })),
  };

  const slug = (etab.nom || "etablissement").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="config-${slug}.json"`,
    },
  });
}
