"use client";

import { useState } from "react";
import { GrilleNiveauEditor, type DisciplineLigne } from "./grille/grille-editor";

export function VolumesBlock({
  etablissementId,
  niveaux,
}: {
  etablissementId: string;
  niveaux: { id: string; nom: string; lignes: DisciplineLigne[] }[];
}) {
  const [actif, setActif] = useState(niveaux[0]?.id ?? "");
  const niveauActif = niveaux.find((n) => n.id === actif) ?? niveaux[0];

  if (!niveauActif) {
    return <p className="text-sm text-ink-700/60">Référentiels non initialisés.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {niveaux.map((n) => {
          const estActif = n.id === niveauActif.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setActif(n.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                estActif
                  ? "bg-forest-800 text-cream-50"
                  : "border border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
              }`}
            >
              {n.nom}
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <GrilleNiveauEditor
          key={niveauActif.id}
          etablissementId={etablissementId}
          niveauId={niveauActif.id}
          niveauNom={niveauActif.nom}
          disciplines={niveauActif.lignes}
        />
      </div>
    </div>
  );
}
