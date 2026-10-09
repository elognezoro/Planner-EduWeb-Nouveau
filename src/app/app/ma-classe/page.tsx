import type { Metadata } from "next";
import Link from "next/link";
import { School, CalendarCheck, BookOpen, NotebookPen, ArrowUpRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import {
  classeActuelleEleve,
  resumeAbsencesEleve,
  dernieresNotesEleve,
  cahierRecentClasse,
  type ClasseEleve,
  type ResumeAbsences,
  type NoteEleve,
} from "@/lib/vie-scolaire/eleve";
import {
  StatsAbsences,
  ListeAbsences,
  ListeNotes,
  ListeCahier,
  type EntreeCahierBloc,
} from "@/components/app/vie-scolaire/eleve-blocs";

export const metadata: Metadata = { title: "Ma classe" };
export const dynamic = "force-dynamic";

function SectionTitre({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
      {icone} {children}
    </h2>
  );
}

export default async function MaClassePage() {
  const u = await requireRole(["eleve"]);

  let classe: ClasseEleve | null = null;
  let absences: ResumeAbsences | null = null;
  let notes: NoteEleve[] | null = null;
  let cahier: EntreeCahierBloc[] | null = null;
  let erreur = false;

  try {
    classe = await classeActuelleEleve(u.id);
    if (classe) {
      [absences, notes, cahier] = await Promise.all([
        resumeAbsencesEleve(u.id),
        dernieresNotesEleve(u.id),
        cahierRecentClasse(classe.id),
      ]);
    }
  } catch (e) {
    console.error("[ma-classe] chargement :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Ma classe"
        description="Votre scolarité en un coup d'œil : séances, notes et assiduité."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger votre scolarité. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : !classe ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {"Vous n'êtes inscrit dans aucune classe pour le moment. Contactez votre établissement."}
          </p>
        </Card>
      ) : (
        <>
          <Card className="border-forest-200 bg-gradient-to-br from-forest-800 to-forest-950 text-cream-50">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                <School size={22} />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{classe.nom}</h2>
                <p className="mt-0.5 text-sm text-cream-200/80">
                  {classe.niveauNom} · {classe.etablissementNom}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitre icone={<NotebookPen size={18} />}>Cahier de texte</SectionTitre>
                <Link
                  href="/app/vie-scolaire/cahier-texte"
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-forest-700 hover:text-forest-900 mobile:-mr-2 mobile:min-h-11 mobile:px-2 mobile:text-sm"
                >
                  Tout voir <ArrowUpRight size={13} />
                </Link>
              </div>
              <ListeCahier entrees={cahier ?? []} />
            </Card>

            <Card>
              <SectionTitre icone={<BookOpen size={18} />}>Mes dernières notes</SectionTitre>
              <ListeNotes notes={notes ?? []} />
            </Card>
          </div>

          <Card>
            <SectionTitre icone={<CalendarCheck size={18} />}>Mon assiduité</SectionTitre>
            {absences && (
              <div className="space-y-4">
                <StatsAbsences resume={absences} />
                <ListeAbsences recents={absences.recents} />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
