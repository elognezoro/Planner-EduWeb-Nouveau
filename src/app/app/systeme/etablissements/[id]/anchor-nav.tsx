import { List, Sparkles } from "lucide-react";

const SECTIONS = [
  { id: "categorie", label: "Catégorie pédagogique", essentiel: true },
  { id: "pays", label: "Pays & en-tête" },
  { id: "infos", label: "Informations générales" },
  { id: "chef", label: "Chef & documents officiels" },
  { id: "rapport", label: "Rapport d'établissement" },
  { id: "champs", label: "Champs enseignants", essentiel: true },
  { id: "effectifs", label: "Effectifs par niveau", essentiel: true },
  { id: "enseignants-effectifs", label: "Effectifs enseignants", essentiel: true },
  { id: "volumes", label: "Volumes horaires", essentiel: true },
  { id: "utilisateurs", label: "Utilisateurs" },
  { id: "competences", label: "Compétences enseignants", essentiel: true },
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
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              s.essentiel
                ? "border-gold-300 bg-gold-50 text-gold-800 hover:bg-gold-100"
                : "border-cream-300 bg-white text-forest-800 hover:border-gold-300 hover:bg-gold-50"
            }`}
          >
            {s.essentiel && <Sparkles size={11} className="text-gold-600" />}
            {s.label}
          </a>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-ink-700/55">
        <Sparkles size={11} className="text-gold-600" /> Blocs dorés : paramètres essentiels à la génération des emplois du temps — à ne pas omettre.
      </p>
    </div>
  );
}
