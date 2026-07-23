import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerApfc, typePortee } from "@/lib/rbac/scope";
import { libelleApfc, termeApfcCourant, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { PageHeader, Card } from "@/components/app/ui";
import { CohorteCard, type CohorteVue } from "@/components/app/formation/components";
import { FicheApfc } from "./fiche-apfc";
import type { PersonnelApfcVue } from "./personnel-apfc";
import type { CouvertureVue } from "./couverture-apfc";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTermeApfc("APFC — Configuration", await termeApfcCourant()) };
}
export const dynamic = "force-dynamic";

export default async function ApfcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_apfc", "representant_pays", "apfc_admin"]);
  const { id } = await params;

  let apfcPays: string | null = null;
  let nom = "";
  let regionId: string | null = null;
  let chefAntenneNom: string | null = null;
  let chefAntennePrenoms: string | null = null;
  let coordonnees: { code: string | null; localite: string | null; adresse: string | null; telephone: string | null; email: string | null; chefAntenneContact: string | null } = {
    code: null, localite: null, adresse: null, telephone: null, email: null, chefAntenneContact: null,
  };
  let docs = { logo: null as string | null, cachet: null as string | null, signature: null as string | null };
  let personnel: PersonnelApfcVue[] = [];
  let couvertures: CouvertureVue[] = [];
  let cohortes: CohorteVue[] = [];
  let erreur = false;
  let introuvable = false;

  try {
    const apfc = await prisma.apfc.findUnique({
      where: { id },
      select: {
        nom: true,
        regionId: true,
        region: { select: { pays: true } },
        chefAntenneNom: true,
        chefAntennePrenoms: true,
        code: true,
        localite: true,
        adresse: true,
        telephone: true,
        email: true,
        chefAntenneContact: true,
        logoUrl: true,
        cachetUrl: true,
        signatureUrl: true,
        personnel: { orderBy: { nom: "asc" } },
        couvertures: {
          select: { id: true, etablissementId: true, etablissement: { select: { nom: true, ville: true, code: true } } },
        },
        cohortes: {
          orderBy: { creeLe: "desc" },
          include: { apprenants: { orderBy: { nom: "asc" } } },
        },
      },
    });
    if (!apfc) introuvable = true;
    else {
      nom = apfc.nom;
      regionId = apfc.regionId;
      apfcPays = apfc.region?.pays ?? null;
      chefAntenneNom = apfc.chefAntenneNom;
      chefAntennePrenoms = apfc.chefAntennePrenoms;
      coordonnees = {
        code: apfc.code,
        localite: apfc.localite,
        adresse: apfc.adresse,
        telephone: apfc.telephone,
        email: apfc.email,
        chefAntenneContact: apfc.chefAntenneContact,
      };
      docs = { logo: apfc.logoUrl, cachet: apfc.cachetUrl, signature: apfc.signatureUrl };
      personnel = apfc.personnel.map((p) => ({
        id: p.id,
        nom: p.nom,
        prenoms: p.prenoms,
        fonction: p.fonction,
        disciplines: Array.isArray(p.disciplines) ? (p.disciplines as string[]) : [],
        email: p.email,
        telephone: p.telephone,
      }));
      couvertures = apfc.couvertures.map((c) => ({
        id: c.id,
        etablissementId: c.etablissementId,
        nom: c.etablissement.nom,
        ville: c.etablissement.ville,
        code: c.etablissement.code,
      }));
      cohortes = apfc.cohortes.map((c) => ({
        id: c.id,
        libelle: c.libelle,
        anneeDebut: c.anneeDebut,
        anneeFin: c.anneeFin,
        lieu: c.lieu,
        statut: c.statut,
        apprenants: c.apprenants.map((a) => ({
          id: a.id,
          nom: a.nom,
          prenoms: a.prenoms,
          email: a.email,
          matricule: a.matricule,
        })),
      }));
    }
  } catch (e) {
    console.error("[apfc-detail] :", e);
    erreur = true;
  }

  // Pays effectif : le PAYS CONSULTÉ dans la barre du haut prime (exigence client — les
  // armoiries changent automatiquement avec lui) ; repli sur le pays de la région de l'APFC
  // seulement si aucun pays n'est consulté. Règle centralisée (voir `paysEffectifApfc`),
  // réutilisée à l'identique par tous les documents officiels de l'APFC.
  const paysEffectif = await paysEffectifApfc(apfcPays);
  const terme = await libelleApfc(paysEffectif);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  if (introuvable) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("APFC introuvable")} />
        <Link href="/app/systeme/apfc" className="text-sm font-semibold text-forest-700 hover:text-forest-900">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  // Périmètre (hors du try : redirect() doit se propager) : global (admin, superviseur
  // international — toutes APFC, tous pays), apfc_admin (sa structure), Super Admin APFC /
  // représentant-pays (APFC de leur pays, via la région).
  if (!peutAdministrerApfc(u.portee, id, apfcPays)) redirect("/app/systeme/apfc");

  // Cloisonnement par pays (consigne client) : au-delà du droit d'administrer ci-dessus (basé
  // sur le PROPRE périmètre de l'utilisateur), on bloque aussi l'accès direct par URL à une APFC
  // rattachée à un AUTRE pays que celui actuellement CONSULTÉ dans la barre du haut — ex. un
  // admin (périmètre global, donc non bloqué ci-dessus) qui consulte le Bénin ne doit pas pouvoir
  // ouvrir par URL directe une APFC de Côte d'Ivoire. `apfc_admin` est exclu : son périmètre le
  // cloisonne déjà à sa SEULE structure (peutAdministrerApfc ci-dessus), quel que soit le pays
  // affiché dans la barre — cette dernière ne lui est de toute façon pas modifiable. `paysEffectif`
  // vaut toujours le pays consulté ici (repli sur la région/le défaut seulement si aucun n'est
  // consulté, ce qui n'arrive jamais — `paysConsulte()` renvoie toujours une valeur).
  if (apfcPays && typePortee(u.portee.roleId) !== "apfc" && apfcPays !== paysEffectif) {
    redirect("/app/systeme/apfc");
  }

  // Réservé au renommage/rattachement régional (même garde que la création sur la page Gestion) :
  // admin système, Super Admin APFC dans son pays, ou superviseur international (tous pays).
  // apfc_admin gère ses sessions, pas sa fiche.
  const peutModifierFiche =
    !u.apercuActif && (u.roleReel === "admin" || u.roleReel === "super_admin_apfc" || u.roleReel === "superviseur_international");
  let regions: { id: string; nom: string }[] = [];
  let disciplinesRef: string[] = [];
  if (peutModifierFiche) {
    try {
      const [regionsTrouvees, disciplinesTrouvees] = await Promise.all([
        prisma.region.findMany({ where: { pays: paysEffectif }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
        prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
      ]);
      regions = regionsTrouvees;
      // Le bloc « Personnel de l'APFC » ne propose que des disciplines SIMPLES (choix multiple) —
      // les couples de spécialités du référentiel (ex. « Anglais / EPS ») ne sont pas des options
      // valides ici : chaque discipline simple qui les compose est déjà listée séparément.
      disciplinesRef = disciplinesTrouvees.map((d) => d.nom).filter((n) => !n.includes("/"));
    } catch (e) {
      console.error("[apfc-detail] régions/disciplines :", e);
    }
  }

  const totalApprenants = cohortes.reduce((a, c) => a + c.apprenants.length, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {u.roleReel === "admin" && (
        <Link href="/app/systeme/apfc" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
          <ArrowLeft size={15} /> {T("Toutes les APFC")}
        </Link>
      )}
      <PageHeader
        titre={nom || T("APFC")}
        description={`Sessions de formation continue · ${cohortes.length} session(s) · ${totalApprenants} participant(s).`}
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">{T("Impossible de charger cette APFC.")}</p>
        </Card>
      ) : (
        <>
          {peutModifierFiche && (
            <FicheApfc
              id={id}
              nom={nom}
              regionId={regionId}
              regions={regions}
              chefAntenneNom={chefAntenneNom}
              chefAntennePrenoms={chefAntennePrenoms}
              coordonnees={coordonnees}
              docs={docs}
              pays={paysEffectif}
              personnel={personnel}
              disciplinesRef={disciplinesRef}
              couvertures={couvertures}
              terme={terme}
              parRegion={false}
            />
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-forest-900">Sessions de formation continue</h2>
              {/* La DÉFINITION des sessions se fait sur la page dédiée (consigne client) — ici, affichage seul. */}
              <Link
                href="/app/apfc/formation-continue"
                className="text-sm font-semibold text-forest-700 hover:text-forest-900"
              >
                Planifier les sessions →
              </Link>
            </div>
            {cohortes.length === 0 ? (
              <Card>
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <Network size={16} /> Aucune session enregistrée pour le moment.
                </p>
              </Card>
            ) : (
              cohortes.map((c) => <CohorteCard key={c.id} cohorte={c} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
