import { List } from "lucide-react";

const SECTIONS = [
  { id: "pays", label: "Pays & en-tête" },
  { id: "infos", label: "Informations générales" },
  { id: "chef", label: "Chef & documents officiels" },
  { id: "rapport", label: "Rapport d'établissement" },
  { id: "champs", label: "Champs enseignants" },
  { id: "effectifs", label: "Effectifs par niveau" },
  { id: "enseignants-effectifs", label: "Effectifs enseignants" },
  { id: "volumes", label: "Volumes horaires" },
  { id: "utilisateurs", label: "Utilisateurs" },
  { id: "competences", label: "Compétences enseignants" },
];

/** Barre « ALLER À » : ancres de saut vers chaque bloc de la configuration. */
export function AnchorNav() {
  return (
    <div className="sticky top-16 z-20 rounded-2xl border border-cream-200 bg-cream-50/95 p-3 shadow-soft backdrop-blur">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-700/50">
          <List size={13} /> Aller à
        </span>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-medium text-forest-800 transition-colors hover:border-gold-300 hover:bg-gold-50"
          >
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}
