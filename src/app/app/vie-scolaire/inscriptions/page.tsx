import type { Metadata } from "next";
import { Trash2, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { InscriptionForm } from "./form";
import { FormulaireReplieMobile } from "../_mobile/formulaire-replie";
import { SupprimerConfirmeMobile } from "../_mobile/supprimer-confirme";
import { desinscrire } from "./actions";

export const metadata: Metadata = { title: "Inscriptions" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/inscriptions";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function InscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "super_admin_etablissements", "chef_etablissement", "etablissements_admin", "educateur"]);
  const { etab } = await searchParams;
  const ctx = await resoudreEtablissement(u, etab);

  if (ctx.estAdmin && !ctx.etabId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          titre="Inscriptions des élèves"
          description="Choisissez un établissement pour gérer les inscriptions."
        />
        <SelecteurEtablissement basePath={BASE} etablissements={ctx.etablissements} etabId={null} />
      </div>
    );
  }
  if (!ctx.etabId) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader titre="Inscriptions des élèves" />
        <Card>
          <p className="text-sm text-ink-700/70">
            Aucun établissement n&apos;est rattaché à votre compte.
          </p>
        </Card>
      </div>
    );
  }

  const etabId = ctx.etabId;
  let data:
    | {
        classes: { id: string; nom: string }[];
        inscriptions: {
          id: string;
          eleve: { prenoms: string | null; nom: string | null; email: string };
          classe: { nom: string; niveau: { nom: string } };
        }[];
      }
    | "erreur" = "erreur";
  try {
    const [classes, inscriptions] = await Promise.all([
      prisma.classe.findMany({
        where: { etablissementId: etabId },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      prisma.inscription.findMany({
        where: { classe: { etablissementId: etabId } },
        orderBy: { creeLe: "desc" },
        include: {
          eleve: { select: { prenoms: true, nom: true, email: true } },
          classe: { select: { nom: true, niveau: { select: { nom: true } } } },
        },
      }),
    ]);
    data = { classes, inscriptions };
  } catch (e) {
    console.error("[inscriptions] DB indisponible :", e);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        titre="Inscriptions des élèves"
        description="Inscrivez les élèves (ayant déjà un compte) dans leurs classes pour l'année en cours."
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
          {/* Téléphone : formulaire replié, la liste des inscrits passe au premier écran. */}
          <FormulaireReplieMobile libelle="Inscrire un élève">
            <Card>
              <h2 className="mb-4 font-display text-lg font-bold text-forest-900">
                Inscrire un élève
              </h2>
              <InscriptionForm etablissementId={etabId} classes={data.classes} />
            </Card>
          </FormulaireReplieMobile>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
              <GraduationCap size={18} /> Élèves inscrits ({data.inscriptions.length})
            </h2>
            {data.inscriptions.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune inscription pour le moment.</p>
            ) : (
              <ul className="divide-y divide-cream-100">
                {data.inscriptions.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-3 mobile:flex-wrap mobile:gap-3">
                    <div className="mobile:min-w-0 mobile:flex-1">
                      <p className="text-sm font-medium text-forest-900 mobile:wrap-break-word">
                        {nomComplet(i.eleve)}
                      </p>
                      {/* Téléphone : l'e-mail (insécable) passe sur sa propre ligne et peut se couper. */}
                      <p className="text-xs text-ink-700/60 mobile:text-ink-700/70">
                        {i.classe.nom} · {i.classe.niveau.nom}<span className="mobile:hidden"> · </span>
                        <span className="mobile:block mobile:break-all">{i.eleve.email}</span>
                      </p>
                    </div>
                    <form action={desinscrire} className="mobile:hidden">
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        type="submit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Désinscrire"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                    {/* Téléphone : corbeille de 44 px, désinscription confirmée par un second appui
                        (la confirmation passe sur sa propre ligne). */}
                    <div className="lg:hidden print:hidden has-[form]:basis-full">
                      <SupprimerConfirmeMobile action={desinscrire} id={i.id} libelle="Désinscrire" />
                    </div>
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
