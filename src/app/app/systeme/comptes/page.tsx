import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Users, UserCheck, MailWarning, ClipboardCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { KpiCard } from "@/components/app/kpi-card";
import { Reveal } from "@/components/ui/reveal";
import { ComptesActions } from "./comptes-actions";
import { BoutonRappelRattachement } from "./bouton-rappel-rattachement";
import { TableauComptes, type LigneCompte } from "./tableau-comptes";
import { FiltresComptes, RechercheComptes, PaginationComptes, type ValeursFiltres } from "./filtres-comptes";
import { ROLES, filtreUtilisateurs } from "@/lib/rbac";
import { termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

export const metadata: Metadata = { title: "Comptes utilisateurs" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/comptes";

function nomComplet(p: { prenoms: string | null; nom: string | null }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || "—";
}

export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; role?: string; statut?: string; demande?: string; pays?: string;
    etab?: string; cohorte?: string; app?: string; appDu?: string; appAu?: string;
    page?: string; taille?: string;
  }>;
}) {
  // Seul l'Admin Système accède à la page « Comptes utilisateurs » centrale. Les autres
  // gestionnaires administrent les comptes de LEUR périmètre via la page « Habilitations ».
  const u = await requireRole(["admin"]);
  const sp = await searchParams;
  // Termes locaux (libellés de rôle « … CAFOP » / « … APFC »).
  const [terme, termeApfc] = await Promise.all([termeCafopCourant(), termeApfcCourant()]);
  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, terme), termeApfc);

  // Périmètre : REFUSÉ PAR DÉFAUT — chaque rôle ne voit que les comptes de son périmètre.
  // Seul l'admin système voit tous les comptes (filtre centralisé, jamais réécrit ici).
  const perimetre: Prisma.UtilisateurWhereInput = filtreUtilisateurs(u.portee);

  // Filtres actifs.
  const q = sp.q?.trim() || null;
  const statut = sp.statut && ["actif", "en_attente_verification", "suspendu", "archive"].includes(sp.statut) ? sp.statut : null;
  const role = sp.role?.trim() || null;
  // Un rôle à périmètre « pays » est verrouillé sur son pays : le filtre « pays » ne peut pas
  // écraser cette restriction (la clé `pays` du périmètre serait sinon remplacée → fuite inter-pays).
  const pays = ROLES[u.portee.roleId].portee === "pays" ? null : sp.pays?.trim() || null;
  const etab = sp.etab?.trim() || null;
  const cohorte = sp.cohorte && /^\d{4}$/.test(sp.cohorte) ? Number(sp.cohorte) : null;
  const demande = sp.demande === "1";
  // Filtre « Approbations » : date d'approbation (DemandeRole.traiteLe) des demandes de rôle.
  const estIsoJour = (s: string | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
  const app = ["approuves", "7j", "30j", "date", "periode"].includes(sp.app ?? "") ? (sp.app as string) : null;
  const appDu = estIsoJour(sp.appDu) ? sp.appDu : null;
  const appAu = estIsoJour(sp.appAu) ? sp.appAu : null;
  const taille = [10, 25, 50, 100].includes(Number(sp.taille)) ? Number(sp.taille) : 10;
  const pageDemandee = Math.max(1, Number(sp.page) || 1);
  const filtreActif = Boolean(q || statut || role || demande || pays || etab || cohorte || app);

  const where: Prisma.UtilisateurWhereInput = { ...perimetre };
  if (statut) where.statutCompte = statut as Prisma.UtilisateurWhereInput["statutCompte"];
  if (role) where.roleActif = { nomTechnique: role };
  if (pays) where.pays = pays;
  if (etab) where.etablissementId = etab;
  // Cohorte = année d'inscription sur la plateforme.
  if (cohorte)
    where.creeLe = { gte: new Date(Date.UTC(cohorte, 0, 1)), lt: new Date(Date.UTC(cohorte + 1, 0, 1)) };

  // Fenêtre de dates d'approbation selon le mode choisi (bornes en UTC, fin de journée incluse).
  let traiteLe: Prisma.DateTimeNullableFilter | undefined;
  if (app === "7j" || app === "30j") {
    const maintenant = new Date();
    traiteLe = { gte: new Date(maintenant.getTime() - (app === "7j" ? 7 : 30) * 86_400_000) };
  } else if (app === "date" && appDu) {
    const debut = new Date(`${appDu}T00:00:00.000Z`);
    traiteLe = { gte: debut, lt: new Date(debut.getTime() + 86_400_000) };
  } else if (app === "periode" && (appDu || appAu)) {
    traiteLe = {
      ...(appDu ? { gte: new Date(`${appDu}T00:00:00.000Z`) } : {}),
      ...(appAu ? { lt: new Date(new Date(`${appAu}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
    };
  }
  // « demande en attente » et « approbations » peuvent se cumuler : chacun dans son propre some().
  const clausesDemandes: Prisma.UtilisateurWhereInput[] = [];
  if (demande) clausesDemandes.push({ demandes: { some: { statut: "en_attente" } } });
  if (app) clausesDemandes.push({ demandes: { some: { statut: "approuvee", ...(traiteLe ? { traiteLe } : {}) } } });
  if (clausesDemandes.length > 0) {
    where.AND = Array.isArray(where.AND) ? [...where.AND, ...clausesDemandes] : where.AND ? [where.AND, ...clausesDemandes] : clausesDemandes;
  }
  if (q) {
    // Recherche multi-mots : chaque mot saisi doit apparaître dans l'e-mail, le nom ou les
    // prénoms — « konan ka » trouve Konan Kanga (prénom + début du nom).
    const clauses = q.split(/\s+/).filter(Boolean).slice(0, 5).map((t) => ({
      OR: [
        { email: { contains: t, mode: "insensitive" as const } },
        { nom: { contains: t, mode: "insensitive" as const } },
        { prenoms: { contains: t, mode: "insensitive" as const } },
      ],
    }));
    where.AND = Array.isArray(where.AND) ? [...where.AND, ...clauses] : where.AND ? [where.AND, ...clauses] : clauses;
  }

  let erreur = false;
  let kpi = { total: 0, actifs: 0, nonConfirmes: 0, avecDemande: 0 };
  let liste: LigneCompte[] = [];
  let totalFiltres = 0;
  let page = pageDemandee;
  let options = { pays: [] as string[], etablissements: [] as { id: string; nom: string }[], cohortes: [] as string[] };

  try {
    const [total, actifs, nonConfirmes, avecDemande, nbFiltres, paysBruts, etabsAvecComptes, plusAncien] =
      await Promise.all([
        prisma.utilisateur.count({ where: perimetre }),
        prisma.utilisateur.count({ where: { ...perimetre, statutCompte: "actif" } }),
        prisma.utilisateur.count({ where: { ...perimetre, statutCompte: "en_attente_verification" } }),
        prisma.utilisateur.count({ where: { ...perimetre, demandes: { some: { statut: "en_attente" } } } }),
        prisma.utilisateur.count({ where }),
        prisma.utilisateur.findMany({ where: perimetre, distinct: ["pays"], select: { pays: true } }),
        prisma.etablissement.findMany({
          where: { utilisateurs: { some: perimetre } },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
          take: 300,
        }),
        prisma.utilisateur.aggregate({ where: perimetre, _min: { creeLe: true } }),
      ]);
    totalFiltres = nbFiltres;
    const pages = Math.max(1, Math.ceil(totalFiltres / taille));
    page = Math.min(pageDemandee, pages);

    const anneeMin = plusAncien._min.creeLe?.getUTCFullYear() ?? new Date().getUTCFullYear();
    options = {
      pays: paysBruts.map((p) => p.pays).filter((p): p is string => Boolean(p)).sort((a, b) => a.localeCompare(b, "fr")),
      etablissements: etabsAvecComptes,
      cohortes: Array.from({ length: new Date().getUTCFullYear() - anneeMin + 1 }, (_, i) =>
        String(new Date().getUTCFullYear() - i),
      ),
    };

    const brutes = await prisma.utilisateur.findMany({
      where,
      orderBy: { creeLe: "desc" },
      skip: (page - 1) * taille,
      take: taille,
      include: {
        roleActif: true,
        etablissement: { select: { id: true, nom: true, regionId: true, region: { select: { nom: true } } } },
        // Rattachements SECONDAIRES (groupes scolaires) — pré-remplissent la liste multi-
        // établissements de la modale d'habilitation, à la suite de l'établissement principal.
        etablissementsSecondaires: {
          orderBy: { creeLe: "asc" },
          select: { etablissement: { select: { id: true, nom: true } } },
        },
        region: { select: { nom: true } },
        // Choix du demandeur en attente d'approbation — synchronisés avec la modale d'habilitation.
        demandes: {
          where: { statut: "en_attente" },
          orderBy: { creeLe: "desc" },
          take: 1,
          select: {
            roleDemande: { select: { nomTechnique: true, libelle: true } },
            structureDeclaree: true,
            etablissementDeclareId: true,
            regionDeclareeId: true,
            cafopDeclareId: true,
            apfcDeclareId: true,
          },
        },
      },
    });
    kpi = { total, actifs, nonConfirmes, avecDemande };
    // Noms des établissements DÉCLARÉS par les demandeurs (pré-sélection de la modale).
    const idsEtabDeclares = [...new Set(brutes.map((c) => c.demandes[0]?.etablissementDeclareId).filter((x): x is string => Boolean(x)))];
    const nomEtabDeclare = new Map(
      idsEtabDeclares.length
        ? (await prisma.etablissement.findMany({ where: { id: { in: idsEtabDeclares } }, select: { id: true, nom: true } })).map((e) => [e.id, e.nom] as const)
        : [],
    );
    liste = brutes.map((c) => ({
      id: c.id,
      prenoms: c.prenoms ?? "",
      nom: c.nom ?? "",
      nomAffiche: nomComplet(c),
      email: c.email,
      roleTech: c.roleActif.nomTechnique,
      roleLibelle: T(c.roleActif.libelle),
      etablissement: c.etablissement?.nom ?? null,
      // Région propre (rôles régionaux) ou, à défaut, celle de l'établissement de rattachement
      // (chef, ACE, enseignant… dont le périmètre est l'établissement, sans regionId propre).
      region: c.region?.nom ?? c.etablissement?.region?.nom ?? null,
      pays: c.pays,
      statut: c.statutCompte,
      creeLe: c.creeLe.toISOString(),
      essaiFinLe: c.essaiFinLe ? c.essaiFinLe.toISOString() : null,
      // Affectation ACTUELLE du compte — pré-remplit la modale d'habilitation quand il n'y a
      // pas (ou plus) de demande en attente : l'établissement choisi à l'inscription reste
      // ainsi visible après l'approbation de la demande.
      affectation: {
        etab: c.etablissement ? { id: c.etablissement.id, nom: c.etablissement.nom } : null,
        etabsSecondaires: c.etablissementsSecondaires.map((a) => a.etablissement),
        // Région propre (rôles régionaux) ou, à défaut, celle de l'établissement de rattachement
        // (pré-sélectionne la direction régionale dans la modale, comme colonne « Région »).
        regionId: c.regionId ?? c.etablissement?.regionId ?? null,
        cafopId: c.cafopId,
        apfcId: c.apfcId,
        diocese: c.diocese,
      },
      demandeRole: c.demandes[0]
        ? {
            roleTech: c.demandes[0].roleDemande.nomTechnique,
            roleLibelle: T(c.demandes[0].roleDemande.libelle),
            structure: c.demandes[0].structureDeclaree,
            etab:
              c.demandes[0].etablissementDeclareId && nomEtabDeclare.has(c.demandes[0].etablissementDeclareId)
                ? { id: c.demandes[0].etablissementDeclareId, nom: nomEtabDeclare.get(c.demandes[0].etablissementDeclareId)! }
                : null,
            regionId: c.demandes[0].regionDeclareeId,
            cafopId: c.demandes[0].cafopDeclareId,
            apfcId: c.demandes[0].apfcDeclareId,
          }
        : null,
    }));
  } catch (e) {
    console.error("[comptes] :", e);
    erreur = true;
  }

  const rolesOptions = Object.entries(ROLES)
    .map(([v, r]) => ({ v, l: T(r.libelle) }))
    .sort((a, b) => a.l.localeCompare(b.l));

  const valeurs: ValeursFiltres = {
    q: q ?? "",
    role: role ?? "",
    statut: statut ?? "",
    pays: pays ?? "",
    etab: etab ?? "",
    cohorte: cohorte ? String(cohorte) : "",
    app: app ?? "",
    appDu: appDu ?? "",
    appAu: appAu ?? "",
    taille,
  };
  const pages = Math.max(1, Math.ceil(totalFiltres / taille));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Comptes utilisateurs"
        description="Gérez et filtrez les comptes de votre périmètre."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {u.roleReel === "admin" && !u.apercuActif && <BoutonRappelRattachement />}
            <ComptesActions terme={terme} termeApfc={termeApfc} />
          </div>
        }
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les comptes.</p>
        </Card>
      ) : (
        <>
          {/* KPI cliquables (filtres rapides) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard index={0} libelle="Comptes" valeur={kpi.total} icone={<Users size={22} />} href={BASE} />
            <KpiCard index={1} libelle="Actifs" valeur={kpi.actifs} ton="forest" icone={<UserCheck size={22} />} href={`${BASE}?statut=actif`} />
            <KpiCard index={2} libelle="E-mail non confirmé" valeur={kpi.nonConfirmes} ton="gold" icone={<MailWarning size={22} />} href={`${BASE}?statut=en_attente_verification`} />
            <KpiCard index={3} libelle="Demande en attente" valeur={kpi.avecDemande} ton={kpi.avecDemande > 0 ? "red" : "cream"} icone={<ClipboardCheck size={22} />} href={`${BASE}?demande=1`} />
          </div>

          {/* Barre FILTRES (listes auto-appliquées) puis recherche dédiée */}
          <Reveal>
            <div className="space-y-4">
              <FiltresComptes base={BASE} valeurs={valeurs} options={{ roles: rolesOptions, ...options }} />
              <RechercheComptes base={BASE} valeurs={valeurs} />
            </div>
          </Reveal>

          {/* Table */}
          <Reveal delayIndex={1}>
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3">
                <p className="text-sm font-semibold text-forest-900">
                  {totalFiltres.toLocaleString("fr-FR")} compte(s){filtreActif ? " (filtrés)" : ""}
                </p>
              </div>
              {liste.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-ink-700/55">Aucun compte ne correspond à ces critères.</p>
              ) : (
                <TableauComptes
                  lignes={liste}
                  monId={u.id}
                  peutIncarner={u.roleReel === "admin" && !u.apercuActif}
                  peutEssai={u.roleReel === "admin" && !u.apercuActif}
                  terme={terme}
                  termeApfc={termeApfc}
                />
              )}
            </Card>
            {/* Pagination : « Afficher N par page · X élément(s) » + numéros de pages */}
            <PaginationComptes base={BASE} valeurs={valeurs} page={page} pages={pages} total={totalFiltres} />
          </Reveal>
        </>
      )}
    </div>
  );
}
