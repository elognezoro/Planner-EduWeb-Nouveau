import type { Metadata } from "next";
import { Trash2, UserCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { AffectationForm } from "./form";
import { supprimerAffectation } from "./actions";

export const metadata: Metadata = { title: "Affectations" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/affectations";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function AffectationsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "super_admin_etablissements", "chef_etablissement"]);
  const { etab } = await searchParams;
  const ctx = await resoudreEtablissement(u, etab);

  if (ctx.estAdmin && !ctx.etabId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          titre="Affectations des enseignants"
          description="Choisissez un établissement pour gérer les affectations."
        />
        <SelecteurEtablissement basePath={BASE} etablissements={ctx.etablissements} etabId={null} />
      </div>
    );
  }
  if (!ctx.etabId) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Affectations des enseignants" />
        <Card>
          <p className="text-sm text-ink-700/70">
            Aucun établissement n'est rattaché à votre compte.
          </p>
        </Card>
      </div>
    );
  }

  const etabId = ctx.etabId;
  let data:
    | {
        enseignants: { id: string; prenoms: string | null; nom: string | null; email: string }[];
        classes: { id: string; nom: string }[];
        disciplines: { id: string; nom: string }[];
        affectations: {
          id: string;
          enseignant: { prenoms: string | null; nom: string | null; email: string };
          classe: { nom: string };
          discipline: { nom: string };
        }[];
      }
    | "erreur" = "erreur";
  try {
    const [enseignants, classes, disciplines, affectations] = await Promise.all([
      prisma.utilisateur.findMany({
        where: { etablissementId: etabId, roleActif: { nomTechnique: "enseignant" } },
        orderBy: { nom: "asc" },
        select: { id: true, prenoms: true, nom: true, email: true },
      }),
      prisma.classe.findMany({
        where: { etablissementId: etabId },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
      prisma.affectationEnseignant.findMany({
        where: { classe: { etablissementId: etabId } },
        orderBy: { creeLe: "desc" },
        include: {
          enseignant: { select: { prenoms: true, nom: true, email: true } },
          classe: { select: { nom: true } },
          discipline: { select: { nom: true } },
        },
      }),
    ]);
    data = { enseignants, classes, disciplines, affectations };
  } catch (e) {
    console.error("[affectations] DB indisponible :", e);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        titre="Affectations des enseignants"
        description="Reliez chaque enseignant aux classes et disciplines qu'il enseigne."
      />

      {ctx.estAdmin && (
        <SelecteurEtablissement basePath={BASE} etablissements={ctx.etablissements} etabId={etabId} />
      )}

      {data === "erreur" ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les données. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-4 font-display text-lg font-bold text-forest-900">
              Nouvelle affectation
            </h2>
            <AffectationForm
              etablissementId={etabId}
              enseignants={data.enseignants.map((e) => ({ id: e.id, nom: nomComplet(e) }))}
              classes={data.classes}
              disciplines={data.disciplines}
            />
          </Card>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
              <UserCheck size={18} /> Affectations ({data.affectations.length})
            </h2>
            {data.affectations.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune affectation pour le moment.</p>
            ) : (
              <ul className="divide-y divide-cream-100">
                {data.affectations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-forest-900">
                        {nomComplet(a.enseignant)}
                      </p>
                      <p className="text-xs text-ink-700/60">
                        {a.classe.nom} · {a.discipline.nom}
                      </p>
                    </div>
                    <form action={supprimerAffectation}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Supprimer l'affectation"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
