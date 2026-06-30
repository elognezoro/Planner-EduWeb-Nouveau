import { Plus, X } from "lucide-react";
import { ajouterClasse, supprimerClasse } from "./config-actions";

interface NiveauClasses {
  niveauId: string;
  nom: string;
  classes: { id: string; nom: string; effectif: number }[];
}

/** Gestion manuelle des classes : ajout / suppression par niveau. */
export function ClassesManager({
  etablissementId,
  niveaux,
}: {
  etablissementId: string;
  niveaux: NiveauClasses[];
}) {
  const avecClasses = niveaux.filter((n) => n.classes.length > 0);

  return (
    <div className="space-y-4">
      {avecClasses.length === 0 && (
        <p className="text-sm text-ink-700/60">
          Aucune classe encore. Calculez-les automatiquement ci-dessus, ou ajoutez-les manuellement.
        </p>
      )}
      {niveaux.map((n) => (
        <div key={n.niveauId} className="rounded-xl border border-cream-200 bg-cream-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-forest-900">{n.nom}</p>
            <form action={ajouterClasse}>
              <input type="hidden" name="etablissementId" value={etablissementId} />
              <input type="hidden" name="niveauId" value={n.niveauId} />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-700 hover:bg-forest-50"
              >
                <Plus size={13} /> Ajouter une classe
              </button>
            </form>
          </div>
          {n.classes.length === 0 ? (
            <p className="text-xs text-ink-700/45">Aucune classe pour ce niveau.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {n.classes.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white py-1 pl-3 pr-1 text-sm text-forest-800">
                  {c.nom}
                  <span className="text-[0.65rem] text-ink-700/45">({c.effectif})</span>
                  <form action={supprimerClasse}>
                    <input type="hidden" name="etablissementId" value={etablissementId} />
                    <input type="hidden" name="classeId" value={c.id} />
                    <button
                      type="submit"
                      className="flex h-5 w-5 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Supprimer ${c.nom}`}
                    >
                      <X size={12} />
                    </button>
                  </form>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
