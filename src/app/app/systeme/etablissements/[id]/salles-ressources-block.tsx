"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2, Save, FlaskConical, TriangleAlert } from "lucide-react";
import { enregistrerTypesSalleDiscipline, type EtatForm } from "./config-actions";
import { Select, FormAlert, SubmitButton } from "@/components/ui/form";

/** Types de salle SPÉCIALISÉE assignables à une discipline (ressource partagée). */
const TYPES_SALLE = [
  { v: "laboratoire", l: "Laboratoire" },
  { v: "salle_informatique", l: "Salle informatique" },
  { v: "atelier", l: "Atelier" },
  { v: "salle_eps", l: "Salle / espace EPS" },
];
const LIBELLE = new Map(TYPES_SALLE.map((t) => [t.v, t.l]));

interface Regle {
  disciplineId: string;
  type: string;
}

/**
 * SALLES RESSOURCES : déclare quelles disciplines nécessitent une salle SPÉCIALISÉE (laboratoire,
 * salle info, atelier, plateau EPS). Le générateur route ces cours vers les salles NOMMÉES de ce
 * type (bloc « Désignation des salles »), partagées par TOUTES les classes concernées, sans jamais
 * deux classes au même créneau. Complète les exigences par défaut (EPS, Informatique).
 */
export function SallesRessourcesBlock({
  etablissementId,
  disciplines,
  reglesInitiales,
  typesSallesDisponibles,
}: {
  etablissementId: string;
  disciplines: { id: string; nom: string }[];
  reglesInitiales: Regle[];
  /** Types présents parmi les salles NOMMÉES (pour alerter si aucune salle du type requis n'existe). */
  typesSallesDisponibles: string[];
}) {
  const [regles, setRegles] = useState<Regle[]>(() =>
    reglesInitiales.filter((r) => LIBELLE.has(r.type) && disciplines.some((d) => d.id === r.disciplineId)),
  );
  const [nouvelleDisc, setNouvelleDisc] = useState("");
  const [nouveauType, setNouveauType] = useState("laboratoire");
  const [etat, action] = useActionState(enregistrerTypesSalleDiscipline, { ok: false } as EtatForm);

  const nomDisc = useMemo(() => new Map(disciplines.map((d) => [d.id, d.nom])), [disciplines]);
  const dejaReglees = useMemo(() => new Set(regles.map((r) => r.disciplineId)), [regles]);
  const dispoAjout = disciplines.filter((d) => !dejaReglees.has(d.id));
  const typesDispo = useMemo(() => new Set(typesSallesDisponibles), [typesSallesDisponibles]);

  const ajouter = () => {
    if (!nouvelleDisc || dejaReglees.has(nouvelleDisc)) return;
    setRegles((p) => [...p, { disciplineId: nouvelleDisc, type: nouveauType }]);
    setNouvelleDisc("");
  };
  const majType = (disciplineId: string, type: string) =>
    setRegles((p) => p.map((r) => (r.disciplineId === disciplineId ? { ...r, type } : r)));
  const retirer = (disciplineId: string) => setRegles((p) => p.filter((r) => r.disciplineId !== disciplineId));

  const mapping = JSON.stringify(regles);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-700/60">
        Indiquez quelles disciplines se déroulent dans une <strong>salle spécialisée partagée</strong>
        {" "}(laboratoire, salle info, atelier, plateau EPS). Le générateur enverra ces cours dans vos
        salles <strong>nommées</strong> de ce type (bloc « Désignation des salles »), partagées par toutes
        les classes concernées — jamais deux classes en même temps. L&apos;EPS et l&apos;Informatique sont
        déjà gérées par défaut ; ajoutez ici les autres (ex. SVT, Physique-Chimie → laboratoire).
      </p>

      <div className="space-y-2">
        {regles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 px-4 py-5 text-center text-sm text-ink-700/55">
            Aucune discipline à salle spécialisée. Ajoutez-en ci-dessous.
          </p>
        )}
        {regles.map((r) => {
          const manqueSalle = !typesDispo.has(r.type);
          return (
            <div key={r.disciplineId} className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-cream-50/50 px-3 py-2">
              <FlaskConical size={15} className="shrink-0 text-forest-700/70" />
              <span className="min-w-[8rem] flex-1 font-medium text-forest-900">{nomDisc.get(r.disciplineId) ?? "?"}</span>
              <span className="text-xs text-ink-700/50">→</span>
              <div className="w-52">
                <Select value={r.type} onChange={(e) => majType(r.disciplineId, e.target.value)}>
                  {TYPES_SALLE.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </Select>
              </div>
              {manqueSalle && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[0.65rem] font-medium text-gold-800"
                  title={`Aucune salle de type « ${LIBELLE.get(r.type)} » n'est encore nommée dans « Désignation des salles ». Le générateur en synthétisera une par défaut.`}
                >
                  <TriangleAlert size={12} /> aucune salle nommée de ce type
                </span>
              )}
              <button
                type="button"
                onClick={() => retirer(r.disciplineId)}
                aria-label="Retirer cette exigence"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cream-300 text-ink-700/60 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Ajout d'une exigence */}
      <div className="flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-forest-900">Discipline</span>
          <div className="w-56">
            <Select value={nouvelleDisc} onChange={(e) => setNouvelleDisc(e.target.value)} disabled={dispoAjout.length === 0}>
              <option value="">— choisir —</option>
              {dispoAjout.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </Select>
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-forest-900">Type de salle requis</span>
          <div className="w-52">
            <Select value={nouveauType} onChange={(e) => setNouveauType(e.target.value)}>
              {TYPES_SALLE.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </Select>
          </div>
        </label>
        <button
          type="button"
          onClick={ajouter}
          disabled={!nouvelleDisc}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
        >
          <Plus size={15} /> Ajouter
        </button>
      </div>

      <form action={action} className="flex flex-wrap items-center gap-3 border-t border-cream-200 pt-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        <input type="hidden" name="mapping" value={mapping} />
        <SubmitButton className="w-auto px-6">
          <Save size={16} /> Enregistrer les salles ressources
        </SubmitButton>
        <span className="text-xs text-ink-700/55">{regles.length} discipline(s) à salle spécialisée</span>
      </form>

      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
    </div>
  );
}
