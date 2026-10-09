import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, NotebookPen, ArrowUpRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import {
  classeActuelleEleve,
  resumeAbsencesEleve,
  dernieresNotesEleve,
  type ClasseEleve,
  type ResumeAbsences,
  type NoteEleve,
} from "@/lib/vie-scolaire/eleve";
import { StatsAbsences, ListeNotes } from "@/components/app/vie-scolaire/eleve-blocs";

export const metadata: Metadata = { title: "Mes enfants" };
export const dynamic = "force-dynamic";

interface EnfantVue {
  id: string;
  nom: string;
  lien: string | null;
  classe: ClasseEleve | null;
  absences: ResumeAbsences;
  notes: NoteEleve[];
}

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function MesEnfantsPage() {
  const u = await requireRole(["parent"]);

  let enfants: EnfantVue[] = [];
  let erreur = false;

  try {
    const liens = await prisma.lienParentEleve.findMany({
      where: { parentId: u.id },
      include: { eleve: { select: { id: true, prenoms: true, nom: true, email: true } } },
    });

    enfants = await Promise.all(
      liens.map(async (l) => {
        const [classe, absences, notes] = await Promise.all([
          classeActuelleEleve(l.eleve.id),
          resumeAbsencesEleve(l.eleve.id, 0),
          dernieresNotesEleve(l.eleve.id, 4),
        ]);
        return {
          id: l.eleve.id,
          nom: nomComplet(l.eleve),
          lien: l.lien,
          classe,
          absences,
          notes,
        };
      }),
    );
    enfants.sort((a, b) => a.nom.localeCompare(b.nom));
  } catch (e) {
    console.error("[mes-enfants] chargement :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Mes enfants"
        description="Le suivi de vos enfants : classe, notes récentes et assiduité."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger le suivi. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : enfants.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {"Aucun enfant n'est rattaché à votre compte. Un éducateur ou un administrateur peut créer le lien (Vie scolaire → Liens parent-élève)."}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {enfants.map((e) => (
            <Card key={e.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-gold-300">
                    {e.nom.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-forest-900">{e.nom}</h2>
                    <p className="text-xs text-ink-700/60">
                      {e.classe
                        ? `${e.classe.nom} · ${e.classe.niveauNom} · ${e.classe.etablissementNom}`
                        : "Non inscrit dans une classe"}
                      {e.lien && ` · ${e.lien}`}
                    </p>
                  </div>
                </div>
                {e.classe && (
                  <Link
                    href={`/app/vie-scolaire/cahier-texte?classe=${e.classe.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50 mobile:min-h-11 mobile:px-4 mobile:text-sm"
                  >
                    <NotebookPen size={13} /> Cahier de texte
                  </Link>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="sm:w-48">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700/50">
                    <GraduationCap size={13} /> Assiduité
                  </p>
                  <StatsAbsences resume={e.absences} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">
                      Dernières notes
                    </p>
                    <Link
                      href="/app/vie-scolaire/notes-bulletins"
                      className="inline-flex items-center gap-0.5 text-xs font-semibold text-forest-700 hover:text-forest-900 mobile:hidden"
                    >
                      Voir <ArrowUpRight size={12} />
                    </Link>
                    {/* Téléphone : « Voir » ouvre le livret de l'enfant (Notes & bulletins est
                        refusé au rôle parent : l'ancien lien menait à une impasse). */}
                    <Link
                      href={`/app/vie-scolaire/livret-scolaire?eleve=${e.id}`}
                      className="-mr-2 hidden min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-forest-700 active:bg-cream-100 mobile:inline-flex"
                    >
                      Livret <ArrowUpRight size={14} aria-hidden />
                    </Link>
                  </div>
                  <ListeNotes notes={e.notes} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
