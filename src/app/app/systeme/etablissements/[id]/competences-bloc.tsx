"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Save, Search, Users } from "lucide-react";
import { enregistrerCompetencesLot } from "./enseignants/actions";

export interface EnseignantCompetences {
  id: string;
  nom: string; // nom affiché complet
  disciplines: string[]; // disciplineIds attribués
  nbNiveaux: number;
}

export interface DisciplineOption {
  id: string;
  nom: string;
  couleur: string | null;
}

/** Retire les accents et met en minuscules (recherche). */
function plat(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Bloc « Compétences des enseignants » : liste des enseignants de l'établissement avec
 * recherche rapide par nom ; un clic sur une discipline l'attribue ou la retire
 * (plusieurs disciplines possibles par enseignant). Les modifications sont appliquées
 * d'un coup avec le bouton « Enregistrer les compétences ».
 */
export function CompetencesBloc({
  etablissementId,
  enseignants,
  disciplines,
}: {
  etablissementId: string;
  enseignants: EnseignantCompetences[];
  disciplines: DisciplineOption[];
}) {
  const [q, setQ] = useState("");
  // Attributions locales, initialisées depuis le serveur — appliquées à l'enregistrement.
  const [attributions, setAttributions] = useState<Map<string, Set<string>>>(
    () => new Map(enseignants.map((e) => [e.id, new Set(e.disciplines)])),
  );
  // Enseignants dont les disciplines diffèrent de l'état enregistré.
  const [modifies, setModifies] = useState<Set<string>>(new Set());
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enregistrement, demarrer] = useTransition();

  const visibles = useMemo(() => {
    const termes = plat(q).split(/\s+/).filter(Boolean);
    if (termes.length === 0) return enseignants;
    return enseignants.filter((e) => termes.every((t) => plat(e.nom).includes(t)));
  }, [enseignants, q]);

  function basculer(enseignantId: string, disciplineId: string) {
    const actuel = new Set(attributions.get(enseignantId) ?? []);
    if (actuel.has(disciplineId)) actuel.delete(disciplineId);
    else actuel.add(disciplineId);
    setAttributions((prev) => new Map(prev).set(enseignantId, actuel));
    setModifies((prev) => new Set(prev).add(enseignantId));
    setRetour(null);
  }

  function enregistrer() {
    if (modifies.size === 0) return;
    demarrer(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set(
        "modifications",
        JSON.stringify(
          [...modifies].map((enseignantId) => ({
            enseignantId,
            disciplineIds: [...(attributions.get(enseignantId) ?? [])],
          })),
        ),
      );
      const res = await enregistrerCompetencesLot({ ok: false }, fd);
      setRetour({ ok: res.ok, texte: res.message ?? "Erreur technique." });
      if (res.ok) setModifies(new Set());
    });
  }

  const nbAvecDisciplines = enseignants.filter((e) => (attributions.get(e.id)?.size ?? 0) > 0).length;

  return (
    <div>
      {/* Bilan + recherche rapide + lien vers la gestion détaillée (niveaux d'intervention) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm text-ink-700/75">
          <span>
            <strong className="text-forest-900">{enseignants.length}</strong> enseignant(s)
          </span>
          <span>
            <strong className="text-forest-900">{nbAvecDisciplines}</strong> avec disciplines
          </span>
        </div>
        <Link
          href={`/app/systeme/etablissements/${etablissementId}/enseignants`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Users size={15} /> Gérer aussi les niveaux d&apos;intervention
        </Link>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un enseignant par nom…"
          className="h-11 w-full rounded-full border border-cream-300 bg-white pl-10 pr-4 text-sm outline-none placeholder:text-ink-700/45 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      {retour && (
        <p className={`mb-3 text-sm font-medium ${retour.ok ? "text-forest-700" : "text-red-600"}`}>
          {retour.texte}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-700/55">
          Aucun enseignant ne correspond à « {q} ».
        </p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-cream-100 overflow-y-auto pr-1">
          {visibles.map((e) => {
            const actives = attributions.get(e.id) ?? new Set<string>();
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="flex w-56 min-w-0 shrink-0 items-center gap-2">
                  <span className="truncate font-medium text-forest-900">{e.nom}</span>
                  {modifies.has(e.id) && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-gold-500"
                      title="Modifications non enregistrées"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {disciplines.map((d) => {
                    const active = actives.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => basculer(e.id, d.id)}
                        aria-pressed={active}
                        title={active ? `Retirer ${d.nom}` : `Attribuer ${d.nom}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "border-transparent text-white"
                            : "border-cream-300 bg-white text-ink-700/65 hover:border-forest-300 hover:text-forest-800"
                        }`}
                        style={active ? { backgroundColor: d.couleur ?? "#2f7d5e" } : undefined}
                      >
                        {active && <Check size={11} />}
                        {d.nom}
                      </button>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Enregistrement explicite du bloc : applique toutes les bascules d'un coup. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-cream-100 pt-4">
        <button
          type="button"
          onClick={enregistrer}
          disabled={enregistrement || modifies.size === 0}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          {enregistrement ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Enregistrer les compétences
        </button>
        {modifies.size > 0 && !enregistrement && (
          <span className="text-xs font-medium text-gold-700">
            {modifies.size} enseignant(s) modifié(s) — non enregistré(s)
          </span>
        )}
      </div>
    </div>
  );
}
