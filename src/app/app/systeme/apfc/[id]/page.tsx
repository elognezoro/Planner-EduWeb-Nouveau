import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerApfc } from "@/lib/rbac/scope";
import { PageHeader, Card } from "@/components/app/ui";
import { CohorteForm, CohorteCard, type CohorteVue } from "@/components/app/formation/components";

export const metadata: Metadata = { title: "APFC — Détail" };
export const dynamic = "force-dynamic";

export default async function ApfcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_apfc", "representant_pays", "apfc_admin"]);
  const { id } = await params;

  let apfcPays: string | null = null;
  let nom = "";
  let cohortes: CohorteVue[] = [];
  let erreur = false;
  let introuvable = false;

  try {
    const apfc = await prisma.apfc.findUnique({
      where: { id },
      select: {
        nom: true,
        region: { select: { pays: true } },
        cohortes: {
          orderBy: { creeLe: "desc" },
          include: { apprenants: { orderBy: { nom: "asc" } } },
        },
      },
    });
    if (!apfc) introuvable = true;
    else {
      nom = apfc.nom;
      apfcPays = apfc.region?.pays ?? null;
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

  if (introuvable) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="APFC introuvable" />
        <Link href="/app/systeme/apfc" className="text-sm font-semibold text-forest-700 hover:text-forest-900">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  // Périmètre (hors du try : redirect() doit se propager) : global, apfc_admin (sa structure),
  // représentant-pays (APFC de son pays, via la région). Superviseur national exclu des APFC.
  if (!peutAdministrerApfc(u.portee, id, apfcPays)) redirect("/app/systeme/apfc");

  const totalApprenants = cohortes.reduce((a, c) => a + c.apprenants.length, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {u.roleReel === "admin" && (
        <Link href="/app/systeme/apfc" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
          <ArrowLeft size={15} /> Toutes les APFC
        </Link>
      )}
      <PageHeader
        titre={nom || "APFC"}
        description={`Sessions de formation continue · ${cohortes.length} session(s) · ${totalApprenants} participant(s).`}
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger cette APFC.</p>
        </Card>
      ) : (
        <>
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
