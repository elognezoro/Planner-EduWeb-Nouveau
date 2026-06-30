import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { CohorteForm, CohorteCard, type CohorteVue } from "@/components/app/formation/components";

export const metadata: Metadata = { title: "CAFOP — Détail" };
export const dynamic = "force-dynamic";

export default async function CafopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin"]);
  const { id } = await params;

  // Contrôle d'accès par périmètre.
  if (u.roleReel === "cafop_admin" && u.portee.cafopId !== id) redirect("/app/systeme/cafop");

  let nom = "";
  let cohortes: CohorteVue[] = [];
  let erreur = false;
  let introuvable = false;

  try {
    const cafop = await prisma.cafop.findUnique({
      where: { id },
      select: {
        nom: true,
        region: { select: { nom: true } },
        cohortes: {
          orderBy: { creeLe: "desc" },
          include: { apprenants: { orderBy: { nom: "asc" } } },
        },
      },
    });
    if (!cafop) introuvable = true;
    else {
      nom = cafop.nom;
      cohortes = cafop.cohortes.map((c) => ({
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
    console.error("[cafop-detail] :", e);
    erreur = true;
  }

  if (introuvable) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="CAFOP introuvable" />
        <Link href="/app/systeme/cafop" className="text-sm font-semibold text-forest-700 hover:text-forest-900">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const totalApprenants = cohortes.reduce((a, c) => a + c.apprenants.length, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {u.roleReel === "admin" && (
        <Link href="/app/systeme/cafop" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
          <ArrowLeft size={15} /> Tous les CAFOP
        </Link>
      )}
      <PageHeader
        titre={nom || "CAFOP"}
        description={`Promotions d'élèves-maîtres · ${cohortes.length} promotion(s) · ${totalApprenants} élève(s)-maître(s).`}
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger ce CAFOP.</p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Nouvelle promotion</h2>
            <CohorteForm type="cafop_promotion" cafopId={id} />
          </Card>

          <div className="space-y-3">
            {cohortes.length === 0 ? (
              <Card>
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <GraduationCap size={16} /> Aucune promotion. Créez-en une ci-dessus.
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
