import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { typePortee, type PorteeUtilisateur } from "@/lib/rbac/scope";
import type { TypePortee } from "@/lib/rbac/roles";
import { trouverPays } from "@/lib/referentiels/pays";

/** Pays affiché par défaut tant que l'utilisateur n'a rien sélectionné dans la barre. */
export const PAYS_DEFAUT = "Côte d'Ivoire";

/** Périmètres LOCAUX : leur pays est celui de leur structure de rattachement, pas le cookie. */
const PORTEES_LOCALES = new Set<TypePortee>(["region", "etablissement", "cafop", "apfc", "antenne", "diocese"]);

/** Nom CANONIQUE du référentiel (même orthographe que le sélecteur de la barre et les imports),
 *  ou null si la valeur est vide ou ne correspond à aucun pays connu (→ repli sur le cookie). */
function paysReconnu(pays: string | null | undefined): string | null {
  return trouverPays(pays)?.nom ?? null;
}

/** Structure dont le pays fait foi pour un périmètre local (null : diocèse ou périmètre incomplet). */
function structureDuPerimetre(type: TypePortee, p: PorteeUtilisateur): string | null {
  switch (type) {
    case "region":
      return p.regionId;
    case "etablissement":
      // Établissement PRINCIPAL (les rattachements secondaires d'un groupe scolaire sont du même pays).
      return p.etablissementId ?? p.etablissementIds[0] ?? null;
    case "cafop":
      return p.cafopId;
    case "apfc":
    case "antenne":
      // apfc_admin et rôles d'antenne (chef d'antenne, conseiller pédagogique) partagent Utilisateur.apfcId.
      return p.apfcId;
    default:
      return null;
  }
}

/**
 * Pays RÉEL d'un périmètre LOCAL, lu sur sa structure de rattachement : région → Region.pays ;
 * établissement → Etablissement.pays (sinon celui de sa région) ; CAFOP → Cafop.pays (sinon celui
 * de sa région) ; APFC / antenne → pays de la région de l'APFC (le modèle Apfc n'a pas de pays) ;
 * diocèse (SEDEC) → pays du compte. Null si introuvable ou base indisponible (repli sur le cookie).
 *
 * MÉMOÏSÉ PAR REQUÊTE (React cache, arguments primitifs) : paysConsulte() est appelé plusieurs
 * fois par rendu (layout, termes CAFOP/APFC, sélecteurs…) — une seule lecture en base suffit.
 */
const paysDuPerimetreLocal = cache(
  async (type: TypePortee, structureId: string | null, paysCompte: string | null): Promise<string | null> => {
    if (type === "diocese") return paysReconnu(paysCompte);
    if (!structureId) return null;
    try {
      switch (type) {
        case "region": {
          const r = await prisma.region.findUnique({ where: { id: structureId }, select: { pays: true } });
          return paysReconnu(r?.pays);
        }
        case "etablissement": {
          const e = await prisma.etablissement.findUnique({
            where: { id: structureId },
            select: { pays: true, region: { select: { pays: true } } },
          });
          return paysReconnu(e?.pays) ?? paysReconnu(e?.region?.pays);
        }
        case "cafop": {
          const c = await prisma.cafop.findUnique({
            where: { id: structureId },
            select: { pays: true, region: { select: { pays: true } } },
          });
          return paysReconnu(c?.pays) ?? paysReconnu(c?.region?.pays);
        }
        case "apfc":
        case "antenne": {
          const a = await prisma.apfc.findUnique({
            where: { id: structureId },
            select: { region: { select: { pays: true } } },
          });
          return paysReconnu(a?.region?.pays);
        }
        default:
          return null;
      }
    } catch (e) {
      console.error("[pays-consulte] pays du périmètre :", e);
      return null;
    }
  },
);

/**
 * Pays consulté. Toutes les listes d'établissements des sélecteurs d'interface sont filtrées
 * sur ce pays (cf. etablissementsOperationnels).
 *
 * - Périmètre « global » / « personnel » : sélecteur de la barre supérieure (cookie
 *   « eduweb_pays », posé par src/app/app/barre-actions.ts), sinon PAYS_DEFAUT.
 * - ⚠️ Sécurité : un rôle à périmètre « pays » (superviseur national, représentant-pays) est
 *   VERROUILLÉ sur son propre pays — le sélecteur de la barre ne peut pas lui faire consulter
 *   un autre pays.
 * - Périmètre LOCAL (région, établissement, CAFOP, APFC, antenne, diocèse) : pays RÉEL de sa
 *   structure — un inspecteur, un DRENA ou un chef d'établissement d'Haïti ne doit pas voir des
 *   listes filtrées sur la Côte d'Ivoire (défaut du cookie). Pays introuvable → cookie, comme avant.
 */
export async function paysConsulte(): Promise<string> {
  const u = await getUtilisateurCourant();
  if (u) {
    const type = typePortee(u.portee.roleId);
    if (type === "pays" && u.portee.pays) return u.portee.pays;
    if (PORTEES_LOCALES.has(type)) {
      const paysLocal = await paysDuPerimetreLocal(type, structureDuPerimetre(type, u.portee), u.portee.pays);
      if (paysLocal) return paysLocal;
    }
  }
  const store = await cookies();
  return store.get("eduweb_pays")?.value ?? PAYS_DEFAUT;
}
