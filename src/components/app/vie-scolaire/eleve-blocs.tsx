import { NotebookPen } from "lucide-react";
import type { ResumeAbsences, NoteEleve } from "@/lib/vie-scolaire/eleve";

function dateCourte(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(d);
}

const LIBELLE_STATUT: Record<string, { texte: string; classe: string }> = {
  absent: { texte: "Absence", classe: "bg-red-100 text-red-700" },
  retard: { texte: "Retard", classe: "bg-gold-100 text-gold-800" },
  excuse: { texte: "Excusé", classe: "bg-cream-200 text-forest-800" },
};

export interface EntreeCahierBloc {
  id: string;
  date: Date;
  contenu: string;
  travailAFaire: string | null;
  disciplineNom: string;
  disciplineCouleur: string | null;
}

/** Trois compteurs d'assiduité. */
export function StatsAbsences({ resume }: { resume: ResumeAbsences }) {
  const cases = [
    { libelle: "Absences", valeur: resume.absents, classe: "text-red-600" },
    { libelle: "Retards", valeur: resume.retards, classe: "text-gold-700" },
    { libelle: "Excusés", valeur: resume.excuses, classe: "text-forest-700" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cases.map((c) => (
        <div key={c.libelle} className="rounded-xl border border-cream-200 bg-cream-50/60 px-3 py-2 text-center mobile:px-2">
          <p className={`font-display text-xl font-bold ${c.classe}`}>{c.valeur}</p>
          {/* Téléphone : libellé à 14 px (au lieu de 10). */}
          <p className="text-[0.65rem] text-ink-700/60 mobile:text-xs mobile:leading-snug mobile:text-ink-700/70">{c.libelle}</p>
        </div>
      ))}
    </div>
  );
}

/** Liste des derniers évènements d'assiduité. */
export function ListeAbsences({ recents }: { recents: ResumeAbsences["recents"] }) {
  if (recents.length === 0) {
    return <p className="text-sm text-ink-700/55">Aucune absence ni retard enregistré. 👏</p>;
  }
  return (
    <ul className="divide-y divide-cream-100">
      {recents.map((r, i) => {
        const meta = LIBELLE_STATUT[r.statut] ?? { texte: r.statut, classe: "bg-cream-200 text-forest-800" };
        return (
          <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="text-forest-900">
              {dateCourte(r.date)}
              {r.disciplineNom && <span className="text-ink-700/55"> · {r.disciplineNom}</span>}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.classe}`}>
              {meta.texte}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Liste des dernières notes. */
export function ListeNotes({ notes }: { notes: NoteEleve[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-ink-700/55">Aucune note saisie pour le moment.</p>;
  }
  return (
    <ul className="divide-y divide-cream-100">
      {notes.map((n) => (
        <li key={n.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-medium text-forest-900">{n.disciplineNom}</span>
            <span className="text-ink-700/55"> · {n.libelle}</span>
          </span>
          <span className="shrink-0 font-display font-bold text-forest-900">
            {n.valeur.toLocaleString("fr-FR")}
            <span className="text-xs font-medium text-ink-700/50">/{n.sur}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Liste des dernières séances du cahier de texte. */
export function ListeCahier({ entrees }: { entrees: EntreeCahierBloc[] }) {
  if (entrees.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-700/55">
        <NotebookPen size={15} /> Aucune séance consignée pour le moment.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {entrees.map((e) => (
        <li key={e.id} className="rounded-xl border border-cream-200 bg-cream-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-forest-900">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: e.disciplineCouleur ?? "#999" }}
              />
              {e.disciplineNom}
            </span>
            <span className="text-xs text-ink-700/50">{dateCourte(e.date)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-ink-900">{e.contenu}</p>
          {e.travailAFaire && (
            <p className="mt-1.5 text-xs text-gold-800">
              <span className="font-semibold">À faire :</span> {e.travailAFaire}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
