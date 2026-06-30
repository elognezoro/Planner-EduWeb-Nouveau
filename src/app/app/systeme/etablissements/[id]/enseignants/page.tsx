import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { enregistrerCompetences } from "./actions";

export const metadata: Metadata = { title: "Compétences des enseignants" };
export const dynamic = "force-dynamic";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function CompetencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(["admin", "etablissements_admin"]);
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  let etab: { nom: string } | null = null;
  let enseignants: {
    id: string; prenoms: string | null; nom: string | null; email: string;
    competences: { disciplineId: string }[]; niveauxIntervention: { niveauId: string }[];
  }[] = [];
  let disciplines: { id: string; nom: string }[] = [];
  let niveaux: { id: string; nom: string }[] = [];
  let erreur = false;
  try {
    [etab, enseignants, disciplines, niveaux] = await Promise.all([
      prisma.etablissement.findUnique({ where: { id }, select: { nom: true } }),
      prisma.utilisateur.findMany({
        where: { etablissementId: id, roleActif: { nomTechnique: "enseignant" } },
        orderBy: { nom: "asc" },
        select: {
          id: true, prenoms: true, nom: true, email: true,
          competences: { select: { disciplineId: true } },
          niveauxIntervention: { select: { niveauId: true } },
        },
      }),
      prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
      prisma.niveau.findMany({ orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
    ]);
  } catch (e) {
    console.error("[competences] DB indisponible :", e);
    erreur = true;
  }
  if (!erreur && !etab) redirect("/app/systeme/etablissements");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/app/systeme/etablissements/${id}#competences`} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={16} /> Configuration de l'établissement
      </Link>

      <PageHeader
        titre={`Compétences — ${etab?.nom ?? ""}`}
        description="Disciplines et niveaux d'intervention de chaque enseignant. Ces données sont pré-remplies à l'import CSV et servent à la répartition automatique dans les classes."
      />

      {erreur ? (
        <Card><p className="text-sm text-ink-700/70">Impossible de charger les données.</p></Card>
      ) : enseignants.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-50 text-forest-500"><Users size={24} /></span>
          <p className="mt-3 text-sm text-ink-700/65">Aucun enseignant. Ajoutez-en depuis la configuration (bloc « Utilisateurs »).</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {enseignants.map((ens) => {
            const acquis = new Set(ens.competences.map((c) => c.disciplineId));
            const nivAcquis = new Set(ens.niveauxIntervention.map((n) => n.niveauId));
            return (
              <li key={ens.id}>
                <Card>
                  <form action={enregistrerCompetences}>
                    <input type="hidden" name="etablissementId" value={id} />
                    <input type="hidden" name="enseignantId" value={ens.id} />
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-forest-900">{nomComplet(ens)}</p>
                        <p className="text-xs text-ink-700/55">{ens.email}</p>
                      </div>
                      <button type="submit" className="inline-flex h-9 items-center rounded-full bg-forest-700 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-600">Enregistrer</button>
                    </div>
                    <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/50">Disciplines</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {disciplines.map((d) => (
                        <label key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-2.5 py-1 text-xs text-forest-800">
                          <input type="checkbox" name={`disc_${d.id}`} defaultChecked={acquis.has(d.id)} className="h-3.5 w-3.5" />
                          {d.nom}
                        </label>
                      ))}
                    </div>
                    <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/50">Niveaux d'intervention</p>
                    <div className="flex flex-wrap gap-2">
                      {niveaux.map((n) => (
                        <label key={n.id} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-2.5 py-1 text-xs text-forest-800">
                          <input type="checkbox" name={`niveau_${n.id}`} defaultChecked={nivAcquis.has(n.id)} className="h-3.5 w-3.5" />
                          {n.nom}
                        </label>
                      ))}
                    </div>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
