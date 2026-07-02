import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUtilisateur } from "@/lib/auth/session";
import { accesCheminAutorise, navigationEffective } from "@/lib/rbac/permissions-dynamiques";
import { chargerNotifications } from "@/lib/notifications/actions";
import { AppShell, type UtilisateurShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUtilisateur();

  // Garde centrale : la matrice des droits (dynamique) s'applique à TOUTES les pages /app.
  // Les gardes propres de chaque page (requireRole) restent en défense en profondeur.
  const chemin = (await headers()).get("x-pathname");
  if (chemin && chemin !== "/app" && !(await accesCheminAutorise(chemin, u.roleActif))) {
    redirect("/app");
  }

  const [{ notifications, nombreNonLues }, sections] = await Promise.all([
    chargerNotifications(),
    navigationEffective(u.roleActif),
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
    >
      {children}
    </AppShell>
  );
}
