import type { Metadata } from "next";
import { Network } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { PageHeader, Card } from "@/components/app/ui";
import { VueFormationContinue, type AntenneVue } from "./vue-formation-continue";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTermeApfc("Formation continue — APFC", await termeApfcCourant()) };
}
export const dynamic = "force-dynamic";

/**
 * Page DÉDIÉE de planification des « Sessions de formation continue » des antennes APFC
 * (cohortes de type `apfc_session`) — consigne client : la définition des sessions quitte la
 * fiche APFC (qui n'en garde que l'affichage) pour cette entrée au même rang que les autres
 * pages de la section APFC.
 *
 * Cloisonnements (mêmes règles que Supervision APFC) :
 * - apfc_admin / chef_antenne / conseiller_pedagogique → UNIQUEMENT leur antenne (portee.apfcId) ;
 * - rôles globaux / pays (admin, superviseur international, super admin APFC, représentant-pays)
 *   → toutes les antennes du PAYS CONSULTÉ (region.pays), avec sélecteur d'antenne.
 *
 * Écriture : la garde serveur de `creerCohorte` / `supprimerCohorte` (peutGerer) n'autorise que
 * l'admin système et l'apfc_admin sur SA structure — les autres rôles (dont conseiller_pedagogique,
 * lecture seule) ne voient aucun contrôle d'édition.
 */
export default async function FormationContinuePage() {
  const u = await requireRole([
    "admin",
    "superviseur_international",
    "super_admin_apfc",
    "representant_pays",
    "apfc_admin",
    "chef_antenne",
    "conseiller_pedagogique",
  ]);
  const pays = await paysConsulte();
  const terme = await libelleApfc(pays);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  // Portées « apfc » et « antenne » partagent le même champ Utilisateur.apfcId (cf. Supervision APFC).
  const estRoleAntenne =
    u.roleReel === "apfc_admin" || u.roleReel === "chef_antenne" || u.roleReel === "conseiller_pedagogique";
  const apfcAntenne = estRoleAntenne ? u.portee.apfcId : null;

  if (estRoleAntenne && !apfcAntenne) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          titre="Formation continue"
          description={T("Planification des sessions de formation continue des antennes APFC.")}
        />
        <Card>
          <p className="flex items-center gap-2 text-sm text-ink-700/70">
            <Network size={16} />
            {T("Votre compte n'est rattaché à aucune antenne APFC. Contactez votre administrateur pour faire compléter votre rattachement.")}
          </p>
        </Card>
      </div>
    );
  }

  const where = estRoleAntenne ? { id: apfcAntenne ?? "__aucune__" } : { region: { pays } };

  let antennes: AntenneVue[] = [];
  let erreur = false;
  try {
    const apfcs = await prisma.apfc.findMany({
      where,
      orderBy: { nom: "asc" },
      select: {
        id: true,
        nom: true,
        region: { select: { nom: true } },
        cohortes: {
          where: { type: "apfc_session" },
          orderBy: { creeLe: "desc" },
          include: { apprenants: { orderBy: { nom: "asc" } } },
        },
      },
    });
    antennes = apfcs.map((a) => ({
      id: a.id,
      nom: a.nom,
      region: a.region?.nom ?? null,
      cohortes: a.cohortes.map((c) => ({
        id: c.id,
        libelle: c.libelle,
        anneeDebut: c.anneeDebut,
        anneeFin: c.anneeFin,
        lieu: c.lieu,
        statut: c.statut,
        apprenants: c.apprenants.map((ap) => ({
          id: ap.id,
          nom: ap.nom,
          prenoms: ap.prenoms,
          email: ap.email,
          matricule: ap.matricule,
        })),
      })),
    }));
  } catch (e) {
    console.error("[apfc-formation-continue] chargement :", e);
    erreur = true;
  }

  // Écriture bornée par la garde serveur des actions (admin système, ou apfc_admin/chef_antenne
  // sur SA structure) — jamais en mode aperçu. Sert uniquement à MASQUER les contrôles d'édition.
  const peutEcrire =
    !u.apercuActif &&
    (u.roleReel === "admin" ||
      ((u.roleReel === "apfc_admin" || u.roleReel === "chef_antenne") && Boolean(apfcAntenne)));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Formation continue"
        description={T(
          "Planifier les sessions de formation continue des antennes APFC et gérer leurs participants.",
        )}
      />
      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">{T("Impossible de charger les antennes APFC.")}</p>
        </Card>
      ) : (
        <VueFormationContinue antennes={antennes} peutEcrire={peutEcrire} cloisonne={estRoleAntenne} terme={terme} />
      )}
    </div>
  );
}
