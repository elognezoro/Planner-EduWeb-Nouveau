import { cookies, headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { accesCheminAutorise, navigationEffective } from "@/lib/rbac/permissions-dynamiques";
import { peutUtiliserApercu, rolesConsultablesEnApercu, ROLES } from "@/lib/rbac";
import { estLectureSeuleCafop, estLectureSeule } from "@/lib/rbac/scope";
import { trouverPays, drapeauUrl, PAYS_ONU } from "@/lib/referentiels/pays";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";
import { chargerNotifications } from "@/lib/notifications/actions";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { libelleApfc } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { lireConfigInactivite } from "@/lib/auth/config-inactivite";
import { AppShell, type UtilisateurShell } from "@/components/app/app-shell";
import { PreservationScroll } from "@/components/preservation-scroll";
import { VeilleInactivite } from "@/components/app/veille-inactivite";
import type { OutilsBarre } from "@/components/app/barre-outils";

// Données quasi-statiques relues à CHAQUE page pour CHAQUE utilisateur : mises en cache
// inter-requêtes (unstable_cache de Next, TTL court) pour ne pas taper la base à chaque requête.
// Aucun secret ni donnée personnelle ; staleness bornée (années 5 min, pays d'établissement 10 min).
const chargerAnneesScolaires = unstable_cache(
  async () => prisma.anneeScolaire.findMany({ orderBy: { libelle: "desc" }, select: { libelle: true, active: true } }),
  ["outils-annees-scolaires"],
  { revalidate: 300 },
);
const chargerPaysEtablissement = unstable_cache(
  async (etablissementId: string) => prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { pays: true } }),
  ["outils-pays-etablissement"],
  { revalidate: 600 },
);
// Déconnexion automatique après inactivité (réglage global admin) : TTL court — un changement
// du réglage est pris en compte pour tous en 1 à 2 minutes, sans requête DB à chaque page.
const chargerConfigInactivite = unstable_cache(
  async () => lireConfigInactivite(),
  ["config-inactivite"],
  { revalidate: 60 },
);

/** Données de la barre d'outils (pays, années scolaires, langue, aperçu de rôle). */
async function chargerOutils(u: Awaited<ReturnType<typeof requireUtilisateur>>): Promise<OutilsBarre> {
  const store = await cookies();
  let annees: { libelle: string; active: boolean }[] = [];
  try {
    annees = await chargerAnneesScolaires();
  } catch (e) {
    console.error("[layout/outils] :", e);
  }

  // Pays : l'admin système ET le superviseur international (périmètre global — consigne client
  // 2026-07-20 : « il doit pouvoir éditer dans tous les pays », donc pouvoir aussi CHOISIR le
  // pays consulté) peuvent consulter TOUS les pays de l'ONU (choix mémorisé en cookie) ; tout
  // autre utilisateur ne voit que SON pays (celui de son établissement, sinon de son profil),
  // sans possibilité d'en changer. `paysConsulte()` (src/lib/pays-consulte.ts) applique déjà
  // cette même distinction côté données (rôles à périmètre « global » = libre choix du cookie).
  const estGlobalEffectif = u.roleActif === "admin" || u.roleActif === "superviseur_international";
  let listePays: { nom: string; drapeau: string | null }[];
  let paysActuel: string;
  if (estGlobalEffectif) {
    listePays = PAYS_ONU.map((p) => ({ nom: p.nom, drapeau: drapeauUrl(p.code) }));
    paysActuel = store.get("eduweb_pays")?.value ?? PAYS_DEFAUT;
  } else {
    let paysUtilisateur: string | null = null;
    try {
      if (u.portee.etablissementId) {
        const etab = await chargerPaysEtablissement(u.portee.etablissementId);
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
    paysModifiable: estGlobalEffectif,
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

  const [{ notifications, nombreNonLues }, sections, outils, inactivite] = await Promise.all([
    chargerNotifications(),
    navigationEffective(u.roleActif),
    chargerOutils(u),
    chargerConfigInactivite(),
  ]);

  // Termes locaux des CAFOP et des APFC (par pays consulté) appliqués au menu et au fil d'Ariane.
  const [termeCafop, termeApfc] = await Promise.all([
    libelleCafop(outils.paysActuel),
    libelleApfc(outils.paysActuel),
  ]);
  const sectionsTerme =
    termeCafop === "CAFOP" && termeApfc === "APFC"
      ? sections
      : sections.map((s) => ({
          ...s,
          items: s.items.map((i) => ({ ...i, libelle: appliquerTermeApfc(appliquerTerme(i.libelle, termeCafop), termeApfc) })),
        }));

  const utilisateur: UtilisateurShell = {
    nomComplet: u.nomComplet,
    email: u.email,
    roleActif: u.roleActif,
    libelleRoleActif: u.libelleRoleActif,
    photoUrl: u.photoUrl,
    accesRestreint: u.accesRestreint,
    apercuActif: u.apercuActif,
    assistance: u.assistance,
    enApercu: u.enApercu,
    // ADC / DELC : rôles CAFOP en lecture seule → bandeau permanent + contrôles masqués.
    lectureSeule: estLectureSeuleCafop(u.roleActif) || estLectureSeule(u.roleActif),
    essaiFinLe: u.essaiFinLe ? u.essaiFinLe.toISOString() : null,
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
      termeApfc={termeApfc}
      notificationsInitiales={notifications}
      nonLuesInitiales={nombreNonLues}
      outils={outils}
    >
      <PreservationScroll />
      {/* Déconnexion automatique après inactivité (réglage global admin) : veilleur monté sur
          TOUTES les pages connectées — alerte visuelle et sonore avant la coupure. */}
      {inactivite.active && (
        <VeilleInactivite
          delaiMinutes={inactivite.delaiMinutes}
          avertissementSecondes={inactivite.avertissementSecondes}
        />
      )}
      {children}
    </AppShell>
  );
}
