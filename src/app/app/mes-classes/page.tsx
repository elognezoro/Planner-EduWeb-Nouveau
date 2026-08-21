import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, NotebookPen, BookOpen, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Mes classes" };
export const dynamic = "force-dynamic";

export default async function MesClassesPage() {
  const u = await requireRole(["enseignant"]);

  let classes: {
    id: string;
    nom: string;
    niveauNom: string;
    effectif: number;
    disciplines: string[];
  }[] = [];
  let erreur = false;

  try {
    // CLOISONNEMENT : seules les classes des établissements de l'enseignant (les affectations
    // résiduelles d'un ancien établissement n'apparaissent plus).
    const affectations = await prisma.affectationEnseignant.findMany({
      where: { enseignantId: u.id, classe: { etablissementId: { in: u.portee.etablissementIds } } },
      include: {
        classe: {
          select: {
            id: true,
            nom: true,
            niveau: { select: { nom: true } },
            _count: { select: { inscriptions: true } },
          },
        },
        discipline: { select: { nom: true } },
      },
    });

    const parClasse = new Map<
      string,
      { nom: string; niveauNom: string; effectif: number; disciplines: Set<string> }
    >();
    for (const a of affectations) {
      const c =
        parClasse.get(a.classe.id) ??
        {
          nom: a.classe.nom,
          niveauNom: a.classe.niveau.nom,
          effectif: a.classe._count.inscriptions,
          disciplines: new Set<string>(),
        };
      c.disciplines.add(a.discipline.nom);
      parClasse.set(a.classe.id, c);
    }
    classes = [...parClasse.entries()]
      .map(([id, c]) => ({
        id,
        nom: c.nom,
        niveauNom: c.niveauNom,
        effectif: c.effectif,
        disciplines: [...c.disciplines].sort(),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  } catch (e) {
    console.error("[mes-classes] chargement :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Mes classes"
        description="Les classes qui vous sont affectées et un accès direct à leurs outils."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger vos classes. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {"Vous n'êtes affecté à aucune classe pour le moment. Un chef d'établissement ou un administrateur doit vous affecter (Vie scolaire → Affectations)."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id} className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-forest-900">{c.nom}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-semibold text-forest-800">
                    <Users size={12} /> {c.effectif}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-700/60">{c.niveauNom}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {c.disciplines.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-cream-300 bg-cream-50 px-2.5 py-0.5 text-xs font-medium text-forest-800"
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-cream-100 pt-3">
                <Link
                  href={`/app/vie-scolaire/registre-appel?classe=${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                >
                  <ClipboardList size={13} /> Appel
                </Link>
                <Link
                  href={`/app/vie-scolaire/cahier-texte?classe=${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                >
                  <NotebookPen size={13} /> Cahier de texte
                </Link>
                <Link
                  href={`/app/vie-scolaire/notes-bulletins?classe=${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                >
                  <BookOpen size={13} /> Notes
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
