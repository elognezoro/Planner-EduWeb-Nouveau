import { Card } from "./ui";

/**
 * Sélecteur d'établissement (formulaire GET) — affiché à l'admin pour choisir le contexte
 * de travail sur les écrans de vie scolaire. Navigue vers la même page avec ?etab=…
 */
export function SelecteurEtablissement({
  basePath,
  etablissements,
  etabId,
}: {
  basePath: string;
  etablissements: { id: string; nom: string }[];
  etabId: string | null;
}) {
  return (
    <Card>
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3">
        {/* min-w-0 : sans lui, la plus longue <option> fixe un plancher de largeur au <select> */}
        <div className="min-w-0 flex-1 basis-60">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            Établissement
          </label>
          <select
            name="etab"
            defaultValue={etabId ?? ""}
            className="h-11 w-full rounded-xl border border-cream-300 bg-white px-4 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          >
            <option value="" disabled>
              Sélectionner un établissement…
            </option>
            {etablissements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
        >
          Afficher
        </button>
      </form>
      {etablissements.length === 0 && (
        <p className="mt-3 text-sm text-ink-700/60">
          Aucun établissement enregistré. Créez-en un dans Système → Établissements.
        </p>
      )}
    </Card>
  );
}
