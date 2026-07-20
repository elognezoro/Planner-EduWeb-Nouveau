import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerApfc } from "@/lib/rbac/scope";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { PageHeader, Card } from "@/components/app/ui";
import { CohorteForm, CohorteCard, type CohorteVue } from "@/components/app/formation/components";
import { FicheApfc } from "./fiche-apfc";
import type { PersonnelApfcVue } from "./personnel-apfc";

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
  let docs = { logo: null as string | null, cachet: null as string | null, signature: null as string | null };
  let personnel: PersonnelApfcVue[] = [];
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
        logoUrl: true,
        cachetUrl: true,
        signatureUrl: true,
        personnel: { orderBy: { nom: "asc" } },
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

  // Terme local : celui du pays de l'APFC si connu, sinon le pays consulté (aperçu, APFC introuvable).
  const paysEffectif = apfcPays ?? (await paysConsulte());
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

  // Périmètre (hors du try : redirect() doit se propager) : global, apfc_admin (sa structure),
  // représentant-pays (APFC de son pays, via la région). Superviseur national exclu des APFC.
  if (!peutAdministrerApfc(u.portee, id, apfcPays)) redirect("/app/systeme/apfc");

  // Réservé au renommage/rattachement régional (même garde que la création sur la page Gestion) :
  // admin système, ou Super Admin APFC dans son pays. apfc_admin gère ses sessions, pas sa fiche.
  const peutModifierFiche = !u.apercuActif && (u.roleReel === "admin" || u.roleReel === "super_admin_apfc");
  let regions: { id: string; nom: string }[] = [];
  let disciplinesRef: string[] = [];
  if (peutModifierFiche) {
    try {
      const [regionsTrouvees, disciplinesTrouvees] = await Promise.all([
        prisma.region.findMany({ where: { pays: paysEffectif }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
        prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
      ]);
      regions = regionsTrouvees;
      disciplinesRef = disciplinesTrouvees.map((d) => d.nom);
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
              docs={docs}
              pays={paysEffectif}
              personnel={personnel}
              disciplinesRef={disciplinesRef}
              terme={terme}
            />
          )}

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Nouvelle session</h2>
            <CohorteForm type="apfc_session" apfcId={id} />
          </Card>

          <div className="space-y-3">
            {cohortes.length === 0 ? (
              <Card>
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <Network size={16} /> Aucune session. Créez-en une ci-dessus.
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
