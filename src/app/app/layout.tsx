import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { accesCheminAutorise, navigationEffective } from "@/lib/rbac/permissions-dynamiques";
import { peutUtiliserApercu, rolesConsultablesEnApercu, ROLES } from "@/lib/rbac";
import { trouverPays, drapeauUrl } from "@/lib/referentiels/pays";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";
import { chargerNotifications } from "@/lib/notifications/actions";
import { AppShell, type UtilisateurShell } from "@/components/app/app-shell";
import type { OutilsBarre } from "@/components/app/barre-outils";

/** Données de la barre d'outils (pays, années scolaires, langue, aperçu de rôle). */
async function chargerOutils(u: Awaited<ReturnType<typeof requireUtilisateur>>): Promise<OutilsBarre> {
  const store = await cookies();
  let listePays: { nom: string; drapeau: string | null }[] = [];
  let annees: { libelle: string; active: boolean }[] = [];
  try {
    const [paysRows, anneesRows] = await Promise.all([
      prisma.region.findMany({
        select: { pays: true },
        distinct: ["pays"],
        orderBy: { pays: "asc" },
      }),
      prisma.anneeScolaire.findMany({
        orderBy: { libelle: "desc" },
        select: { libelle: true, active: true },
      }),
    ]);
    listePays = paysRows
      .map((r) => r.pays!)
      .map((nom) => {
        const info = trouverPays(nom);
        return { nom, drapeau: info ? drapeauUrl(info.code) : null };
      });
    annees = anneesRows;
  } catch (e) {
    console.error("[layout/outils] :", e);
  }

  const paysActuel = store.get("eduweb_pays")?.value ?? PAYS_DEFAUT;
  const infoActuel = trouverPays(paysActuel);
  const anneeActive = annees.find((a) => a.active) ?? null;
  const anneeActuelle =
    store.get("eduweb_annee")?.value ?? anneeActive?.libelle ?? annees[0]?.libelle ?? "";

  return {
    pays: listePays,
    paysActuel,
    drapeauActuel: infoActuel ? drapeauUrl(infoActuel.code) : null,
    annees,
    anneeActuelle,
    anneeEnCours: Boolean(anneeActive && anneeActuelle === anneeActive.libelle),
    langue: u.langue,
    rolesApercu: peutUtiliserApercu(u.roleReel)
      ? rolesConsultablesEnApercu(u.roleReel).map((id) => ({ id, libelle: ROLES[id].libelle }))
      : [],
    apercuActif: u.apercuActif,
    libelleRoleActif: u.libelleRoleActif,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUtilisateur();

  // Garde centrale : la matrice des droits (dynamique) s'applique à TOUTES les pages /app.
  // Les gardes propres de chaque page (requireRole) restent en défense en profondeur.
  const chemin = (await headers()).get("x-pathname");
  if (chemin && chemin !== "/app" && !(await accesCheminAutorise(chemin, u.roleActif))) {
    redirect("/app");
  }

  const [{ notifications, nombreNonLues }, sections, outils] = await Promise.all([
    chargerNotifications(),
    navigationEffective(u.roleActif),
    chargerOutils(u),
  ]);

  const utilisateur: UtilisateurShell = {
    nomComplet: u.nomComplet,
    email: u.email,
    roleActif: u.roleActif,
    libelleRoleActif: u.libelleRoleActif,
    photoUrl: u.photoUrl,
    accesRestreint: u.accesRestreint,
    apercuActif: u.apercuActif,
    demandeEnAttente: u.demandeEnAttente
      ? {
          id: u.demandeEnAttente.id,
          roleDemande: u.demandeEnAttente.roleDemande,
          libelleRoleDemande: u.demandeEnAttente.libelleRoleDemande,
          structureDeclaree: u.demandeEnAttente.structureDeclaree,
          creeLe: u.demandeEnAttente.creeLe.toISOString(),
        }
      : null,
  };

  return (
    <AppShell
      utilisateur={utilisateur}
      sections={sections}
      notificationsInitiales={notifications}
      nonLuesInitiales={nombreNonLues}
      outils={outils}
    >
      {children}
    </AppShell>
  );
}
