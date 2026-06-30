import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Table2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { GrilleNiveauForm } from "./grille-editor";

export const metadata: Metadata = { title: "Grille horaire" };
export const dynamic = "force-dynamic";

async function charger(id: string) {
  try {
    const etablissement = await prisma.etablissement.findUnique({ where: { id } });
    if (!etablissement) return { statut: "introuvable" as const };
    const [niveaux, disciplines, grilles] = await Promise.all([
      prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
      prisma.discipline.findMany({ orderBy: { nom: "asc" } }),
      prisma.grilleHoraire.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId: id }] },
      }),
    ]);
    return { statut: "ok" as const, etablissement, niveaux, disciplines, grilles };
  } catch (e) {
    console.error("[grille] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function GrillePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(["admin", "etablissements_admin"]);
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const data = await charger(id);
  if (data.statut === "introuvable") redirect("/app/systeme/etablissements");

  if (data.statut !== "ok") {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Grille horaire" />
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger la grille. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      </div>
    );
  }

  const { etablissement, niveaux, disciplines, grilles } = data;

  // Modèle national (etablissementId null) et surcharges établissement.
  const national = new Map<string, number>();
  const surcharge = new Map<string, number>();
  for (const g of grilles) {
    const cle = `${g.niveauId}:${g.disciplineId}`;
    if (g.etablissementId === null) national.set(cle, g.heuresHebdo);
    else surcharge.set(cle, g.heuresHebdo);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/app/systeme/etablissements/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Retour à l'établissement
      </Link>

      <PageHeader
        titre={`Grille horaire — ${etablissement.nom}`}
        description="Volume horaire hebdomadaire par niveau et discipline. Les valeurs partent du modèle national ; toute modification crée une surcharge propre à cet établissement (base du module Emplois du temps)."
      />

      {u.apercuActif && (
        <Card className="border-gold-300/70 bg-gold-50">
          <p className="text-sm text-gold-900">Mode aperçu : édition désactivée (lecture seule).</p>
        </Card>
      )}

      {niveaux.length === 0 || disciplines.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/60">
            Référentiels non initialisés. Exécutez « npm run db:seed ».
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {niveaux.map((n) => {
            const lignes = disciplines.map((d) => {
              const cle = `${n.id}:${d.id}`;
              const valSurcharge = surcharge.get(cle);
              const valNational = national.get(cle);
              const effectif = valSurcharge ?? valNational ?? "";
              return {
                disciplineId: d.id,
                nom: d.nom,
                couleur: d.couleur,
                valeur: (effectif === "" ? "" : effectif) as number | "",
                surcharge: valSurcharge !== undefined,
              };
            });
            return (
              <GrilleNiveauForm
                key={n.id}
                etablissementId={id}
                niveauId={n.id}
                niveauNom={n.nom}
                lignes={lignes}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
