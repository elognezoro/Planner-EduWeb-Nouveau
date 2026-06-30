import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, DoorOpen, Users2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { SalleForm, ClasseForm } from "../forms";

export const metadata: Metadata = { title: "Structure — salles & classes" };
export const dynamic = "force-dynamic";

const libelleTypeSalle: Record<string, string> = {
  ordinaire: "Ordinaire",
  laboratoire: "Laboratoire",
  salle_informatique: "Salle informatique",
  atelier: "Atelier",
  salle_eps: "EPS",
  autre: "Autre",
};

async function charger(id: string) {
  try {
    const etablissement = await prisma.etablissement.findUnique({ where: { id } });
    if (!etablissement) return { statut: "introuvable" as const };
    const [salles, classes, niveaux] = await Promise.all([
      prisma.salle.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" } }),
      prisma.classe.findMany({
        where: { etablissementId: id },
        orderBy: { nom: "asc" },
        include: { niveau: true },
      }),
      prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
    ]);
    return { statut: "ok" as const, etablissement, salles, classes, niveaux };
  } catch (e) {
    console.error("[structure] DB indisponible :", e);
    return { statut: "erreur" as const };
  }
}

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
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
        <PageHeader titre="Structure" />
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les données.</p>
        </Card>
      </div>
    );
  }

  const { etablissement: e, salles, classes, niveaux } = data;
  const peutGerer = !u.apercuActif && (u.roleReel === "admin" || u.portee.etablissementId === id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href={`/app/systeme/etablissements/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Configuration de l'établissement
      </Link>

      <PageHeader titre={`Salles & classes — ${e.nom}`} description="Gestion détaillée des salles physiques et des classes (capacité, type)." />

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <DoorOpen size={18} /> Salles ({salles.length})
        </h2>
        {salles.length > 0 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {salles.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-xl border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-forest-900">{s.nom}</span>
                <span className="text-xs text-ink-700/60">
                  {libelleTypeSalle[s.type] ?? s.type} · {s.capacite} pl.
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mb-5 text-sm text-ink-700/60">Aucune salle enregistrée.</p>
        )}
        {peutGerer && <SalleForm etablissementId={id} />}
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Users2 size={18} /> Classes ({classes.length})
        </h2>
        {classes.length > 0 ? (
          <div className="mb-5 overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left">
                  <th className="py-2 pr-4 font-semibold text-ink-700/70">Classe</th>
                  <th className="py-2 pr-4 font-semibold text-ink-700/70">Niveau</th>
                  <th className="py-2 pr-4 font-semibold text-ink-700/70">Effectif</th>
                  <th className="py-2 font-semibold text-ink-700/70">Vacation</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-cream-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-forest-900">{c.nom}</td>
                    <td className="py-2 pr-4 text-ink-800">{c.niveau.nom}</td>
                    <td className="py-2 pr-4 text-ink-800">{c.effectif}</td>
                    <td className="py-2 text-ink-800">{c.regimeVacation === "double" ? "Double" : "Simple"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-5 text-sm text-ink-700/60">Aucune classe enregistrée.</p>
        )}
        {peutGerer && <ClasseForm etablissementId={id} niveaux={niveaux} />}
      </Card>
    </div>
  );
}
