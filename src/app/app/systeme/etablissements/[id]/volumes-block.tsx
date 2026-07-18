"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { GrilleNiveauEditor, type DisciplineLigne } from "./grille/grille-editor";
import { ajouterNiveau, supprimerNiveau } from "./config-actions";

// Cycle d'un niveau (pilote le solveur : 1er / 2nd cycle, primaire, préscolaire).
const CYCLES = [
  { v: "prescolaire", l: "Préscolaire" },
  { v: "primaire", l: "Primaire" },
  { v: "college", l: "1er cycle (collège)" },
  { v: "lycee", l: "2nd cycle (lycée)" },
];

export function VolumesBlock({
  etablissementId,
  niveaux,
  toutesDisciplines,
  ajoutDepuisListeDesactive = false,
}: {
  etablissementId: string;
  niveaux: { id: string; nom: string; lignes: DisciplineLigne[] }[];
  toutesDisciplines: { id: string; nom: string; couleur: string | null }[];
  /** Préscolaire/primaire : pas de liste de spécialités partagées — création par saisie uniquement. */
  ajoutDepuisListeDesactive?: boolean;
}) {
  const [actif, setActif] = useState(niveaux[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [nom, setNom] = useState("");
  const [cycle, setCycle] = useState("college");
  const [message, setMessage] = useState<string | null>(null);

  const niveauActif = niveaux.find((n) => n.id === actif) ?? niveaux[0];

  function ajouter() {
    if (!nom.trim()) return;
    setMessage(null);
    start(async () => {
      const r = await ajouterNiveau(etablissementId, nom, cycle);
      if (r.ok) setNom("");
      else if (r.message) setMessage(r.message);
    });
  }
  function supprimer(niveauId: string, niveauNom: string) {
    if (!window.confirm(`Supprimer le niveau « ${niveauNom} » ? Ses classes et sa grille horaire seront supprimées (niveau partagé : effet sur tous les établissements).`)) return;
    setMessage(null);
    start(async () => {
      const r = await supprimerNiveau(niveauId, etablissementId);
      if (!r.ok && r.message) setMessage(r.message);
    });
  }

  return (
    <div>
      {message && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

      {/* Onglets des niveaux (avec suppression par niveau) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {niveaux.map((n) => {
          const estActif = !!niveauActif && n.id === niveauActif.id;
          return (
            <span
              key={n.id}
              className={`inline-flex items-center rounded-full transition-colors ${
                estActif ? "bg-forest-800 text-cream-50" : "border border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
              }`}
            >
              <button type="button" onClick={() => setActif(n.id)} className="py-1.5 pl-3.5 pr-1 text-sm font-medium">
                {n.nom}
              </button>
              <button
                type="button"
                onClick={() => supprimer(n.id, n.nom)}
                disabled={pending}
                title={`Supprimer le niveau ${n.nom}`}
                aria-label={`Supprimer le niveau ${n.nom}`}
                className={`mr-1.5 flex h-5 w-5 items-center justify-center rounded-full disabled:opacity-50 ${
                  estActif ? "text-cream-50/70 hover:bg-white/20 hover:text-white" : "text-ink-700/40 hover:bg-red-50 hover:text-red-600"
                }`}
              >
                <Trash2 size={12} />
              </button>
            </span>
          );
        })}
      </div>

      {/* Ajouter un niveau — par saisie du nom + cycle */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-cream-100 pb-4">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Nouveau niveau (ex : 6ème, CP1, BT1…)"
          className="h-9 w-56 rounded-lg border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
        <select
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
          className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          {CYCLES.map((c) => (
            <option key={c.v} value={c.v}>{c.l}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={ajouter}
          disabled={pending || !nom.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter le niveau
        </button>
      </div>

      {!niveauActif ? (
        <p className="text-sm text-ink-700/60">Aucun niveau. Ajoutez-en un ci-dessus pour définir sa grille horaire.</p>
      ) : (
        <div className="overflow-x-auto">
          <GrilleNiveauEditor
            key={niveauActif.id}
            etablissementId={etablissementId}
            niveauId={niveauActif.id}
            niveauNom={niveauActif.nom}
            disciplines={niveauActif.lignes}
            toutesDisciplines={toutesDisciplines}
            ajoutDepuisListeDesactive={ajoutDepuisListeDesactive}
          />
        </div>
      )}
    </div>
  );
}
