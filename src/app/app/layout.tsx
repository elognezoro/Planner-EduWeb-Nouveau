import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { accesCheminAutorise, navigationEffective } from "@/lib/rbac/permissions-dynamiques";
import { peutUtiliserApercu, rolesConsultablesEnApercu, ROLES } from "@/lib/rbac";
import { estLectureSeuleCafop } from "@/lib/rbac/scope";
import { trouverPays, drapeauUrl, PAYS_ONU } from "@/lib/referentiels/pays";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";
import { chargerNotifications } from "@/lib/notifications/actions";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { AppShell, type UtilisateurShell } from "@/components/app/app-shell";
import { PreservationScroll } from "@/components/preservation-scroll";
import type { OutilsBarre } from "@/components/app/barre-outils";

/** Données de la barre d'outils (pays, années scolaires, langue, aperçu de rôle). */
async function chargerOutils(u: Awaited<ReturnType<typeof requireUtilisateur>>): Promise<OutilsBarre> {
  const store = await cookies();
  let annees: { libelle: string; active: boolean }[] = [];
  try {
    annees = await prisma.anneeScolaire.findMany({
      orderBy: { libelle: "desc" },
      select: { libelle: true, active: true },
    });
  } catch (e) {
    console.error("[layout/outils] :", e);
  }

  // Pays : l'admin système peut consulter TOUS les pays de l'ONU (choix mémorisé en cookie) ;
  // tout autre utilisateur ne voit que SON pays (celui de son établissement, sinon de son profil),
  // sans possibilité d'en changer.
  const estAdminEffectif = u.roleActif === "admin";
  let listePays: { nom: string; drapeau: string | null }[];
  let paysActuel: string;
  if (estAdminEffectif) {
    listePays = PAYS_ONU.map((p) => ({ nom: p.nom, drapeau: drapeauUrl(p.code) }));
    paysActuel = store.get("eduweb_pays")?.value ?? PAYS_DEFAUT;
  } else {
    let paysUtilisateur: string | null = null;
    try {
      if (u.portee.etablissementId) {
        const etab = await prisma.etablissement.findUnique({ where: { id: u.portee.etablissementId }, select: { pays: true } });
        paysUtilisateur = etab?.pays ?? null;
      }
      if (!paysUtilisateur) {
        const compte = await prisma.utilisateur.findUnique({ where: { id: u.id }, select: { pays: true } });
        paysUtilisateur = compte?.pays ?? null;
      }
    } catch (e) {
      console.error("[layout/outils pays] :", e);
    }
    paysActuel = paysUtilisateur ?? PAYS_DEFAUT;
    const info = trouverPays(paysActuel);
    listePays = [{ nom: paysActuel, drapeau: info ? drapeauUrl(info.code) : null }];
  }
  const infoActuel = trouverPays(paysActuel);
  const anneeActive = annees.find((a) => a.active) ?? null;
  const anneeActuelle =
    store.get("eduweb_annee")?.value ?? anneeActive?.libelle ?? annees[0]?.libelle ?? "";

  return {
    pays: listePays,
    paysActuel,
    paysModifiable: estAdminEffectif,
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

  // Terme local des CAFOP (par pays consulté) appliqué au menu et au fil d'Ariane.
  const termeCafop = await libelleCafop(outils.paysActuel);
  const sectionsTerme =
    termeCafop === "CAFOP"
      ? sections
      : sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, libelle: appliquerTerme(i.libelle, termeCafop) })) }));

  const utilisateur: UtilisateurShell = {
    nomComplet: u.nomComplet,
    email: u.email,
    roleActif: u.roleActif,
    libelleRoleActif: u.libelleRoleActif,
    photoUrl: u.photoUrl,
    accesRestreint: u.accesRestreint,
    apercuActif: u.apercuActif,
    // ADC / DELC : rôles CAFOP en lecture seule → bandeau permanent + contrôles masqués.
    lectureSeule: estLectureSeuleCafop(u.roleActif),
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
      sections={sectionsTerme}
      termeCafop={termeCafop}
      notificationsInitiales={notifications}
      nonLuesInitiales={nombreNonLues}
      outils={outils}
    >
      <PreservationScroll />
      {children}
    </AppShell>
  );
}
