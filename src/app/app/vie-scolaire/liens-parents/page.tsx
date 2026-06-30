import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Trash2, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { LienForm } from "./form";
import { supprimerLien } from "./actions";

export const metadata: Metadata = { title: "Liens parent-élève" };
export const dynamic = "force-dynamic";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function LiensParentsPage() {
  const u = await requireRole(["admin", "chef_etablissement", "educateur"]);

  // Périmètre : l'admin voit tous les liens ; un chef/éducateur, ceux des élèves de son établissement.
  let where: Prisma.LienParentEleveWhereInput = {};
  if (u.roleReel !== "admin") {
    const etabId = u.portee.etablissementId;
    where = etabId
      ? { eleve: { inscriptions: { some: { classe: { etablissementId: etabId } } } } }
      : { id: { in: [] } };
  }

  let liens:
    | {
        id: string;
        lien: string | null;
        parent: { prenoms: string | null; nom: string | null; email: string };
        eleve: { prenoms: string | null; nom: string | null; email: string };
      }[]
    | "erreur" = "erreur";
  try {
    liens = await prisma.lienParentEleve.findMany({
      where,
      orderBy: { creeLe: "desc" },
      take: 100,
      include: {
        parent: { select: { prenoms: true, nom: true, email: true } },
        eleve: { select: { prenoms: true, nom: true, email: true } },
      },
    });
  } catch (e) {
    console.error("[liens] DB indisponible :", e);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        titre="Liens parent-élève"
        description="Reliez un compte parent à un compte élève pour permettre le suivi de la scolarité."
      />

      <Card>
        <h2 className="mb-4 font-display text-lg font-bold text-forest-900">Nouveau lien</h2>
        <LienForm />
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Users size={18} /> Liens existants {liens !== "erreur" && `(${liens.length})`}
        </h2>
        {liens === "erreur" ? (
          <p className="text-sm text-ink-700/70">
            Impossible de charger les liens. Vérifiez la connexion à la base de données.
          </p>
        ) : liens.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun lien pour le moment.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {liens.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-forest-900">
                    {nomComplet(l.parent)}
                    <span className="font-normal text-ink-700/55">
                      {" "}
                      {l.lien ? `(${l.lien})` : ""} → {nomComplet(l.eleve)}
                    </span>
                  </p>
                  <p className="text-xs text-ink-700/55">
                    {l.parent.email} · {l.eleve.email}
                  </p>
                </div>
                <form action={supprimerLien}>
                  <input type="hidden" name="id" value={l.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Supprimer le lien"
                  >
                    <Trash2 size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
