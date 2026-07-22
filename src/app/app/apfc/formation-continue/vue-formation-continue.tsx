"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, ChevronDown, GraduationCap, MapPin, Network, Plus, Users } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { creerCohorte, type EtatForm } from "@/lib/formation/actions";
import { CohorteCard, type CohorteVue } from "@/components/app/formation/components";
import { SelectRecherche } from "@/components/app/select-recherche";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

const initial: EtatForm = { ok: false };
const inputCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface AntenneVue {
  id: string;
  nom: string;
  region: string | null;
  cohortes: CohorteVue[];
}

/**
 * Vue cliente de la page « Formation continue » : création d'une session (action `creerCohorte`,
 * type `apfc_session`) puis liste des sessions groupées par antenne (CohorteCard : participants,
 * import CSV Moodle, suppression en 2 clics). En lecture seule (`peutEcrire` faux — dont le
 * conseiller pédagogique), aucun contrôle d'édition n'est affiché.
 */
export function VueFormationContinue({
  antennes,
  peutEcrire,
  cloisonne,
  terme,
}: {
  antennes: AntenneVue[];
  peutEcrire: boolean;
  /** Rôle d'antenne (apfc_admin / chef_antenne / conseiller_pedagogique) : une seule antenne, pas de sélecteur. */
  cloisonne: boolean;
  terme: string;
}) {
  const T = (s: string) => appliquerTermeApfc(s, terme);
  const [antenneFiltre, setAntenneFiltre] = useState<string | null>(null);
  // ACCORDÉON EXCLUSIF : une seule antenne dépliée à la fois (en ouvrir une ferme les autres).
  // Rôle cloisonné à une antenne : la sienne est dépliée d'office.
  const [ouverte, setOuverte] = useState<string | null>(cloisonne ? antennes[0]?.id ?? null : null);
  const [etat, action] = useActionState(creerCohorte, initial);

  const options = useMemo(
    () => antennes.map((a) => ({ id: a.id, nom: a.region ? `${a.nom} — ${a.region}` : a.nom })),
    [antennes],
  );
  const visibles = antenneFiltre ? antennes.filter((a) => a.id === antenneFiltre) : antennes;
  const totalSessions = antennes.reduce((s, a) => s + a.cohortes.length, 0);
  const totalParticipants = antennes.reduce((s, a) => s + a.cohortes.reduce((x, c) => x + c.apprenants.length, 0), 0);

  return (
    <div className="space-y-6">
      {/* Création d'une session — visible uniquement pour ceux que la garde serveur autorise. */}
      {peutEcrire && (
        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <CalendarPlus size={16} className="text-forest-700" /> Planifier une session
          </h2>
          <form action={action} className="space-y-3">
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
            <input type="hidden" name="type" value="apfc_session" />
            {cloisonne ? (
              // Antenne UNIQUE du rôle cloisonné : préchoisie et cachée.
              <input type="hidden" name="apfcId" value={antennes[0]?.id ?? ""} />
            ) : (
              <div className="max-w-md">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">
                  Antenne <span className="text-red-600">*</span>
                </label>
                <SelectRecherche name="apfcId" options={options} requis placeholder={T("Rechercher une antenne APFC…")} />
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Intitulé de la session</label>
                <input name="libelle" required className={inputCls} placeholder="Formation continue — Maths" />
              </div>
              <div className="w-24">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Année déb.</label>
                <input name="anneeDebut" type="number" className={inputCls} placeholder="2026" />
              </div>
              <div className="w-24">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Année fin</label>
                <input name="anneeFin" type="number" className={inputCls} placeholder="2027" />
              </div>
              <div className="min-w-[12rem]">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Lieu</label>
                <input name="lieu" className={inputCls} placeholder="Salle de formation…" />
              </div>
              <SubmitButton className="w-auto px-6">
                <Plus size={15} /> Ajouter la session
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {/* Filtre d'antenne (rôles non cloisonnés : toutes les antennes du pays consulté). */}
      {!cloisonne && antennes.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-forest-900">Antenne :</span>
          <SelectRecherche
            name="antenneFiltre"
            options={options}
            placeholder={T("Toutes les antennes APFC")}
            effacable
            onSelect={(o) => {
              setAntenneFiltre(o?.id ?? null);
              setOuverte(o?.id ?? null); // filtrer sur une antenne la déplie directement
            }}
            className="w-72"
          />
          <span className="text-xs text-ink-700/60">
            {totalSessions} session(s) · {totalParticipants} participant(s)
          </span>
        </div>
      )}

      {antennes.length === 0 ? (
        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm text-ink-700/60">
            <Network size={16} /> {T("Aucune antenne APFC pour le pays consulté.")}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibles.map((a) => {
            const deplie = ouverte === a.id;
            return (
              <section key={a.id} className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
                {/* En-tête cliquable : ouvre cette antenne et referme les autres (accordéon exclusif). */}
                <button
                  type="button"
                  onClick={() => setOuverte(deplie ? null : a.id)}
                  aria-expanded={deplie}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-left transition-colors ${
                    deplie ? "bg-forest-50/60" : "hover:bg-cream-50"
                  }`}
                >
                  <span className="flex items-center gap-2 font-display text-base font-bold text-forest-900">
                    <GraduationCap size={16} className="text-forest-700" /> {a.nom}
                    {a.region && (
                      <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-700/60">
                        <MapPin size={12} /> {a.region}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-semibold text-forest-800">
                      <Users size={11} /> {a.cohortes.length} session(s) ·{" "}
                      {a.cohortes.reduce((s, c) => s + c.apprenants.length, 0)} participant(s)
                    </span>
                    <ChevronDown
                      size={17}
                      className={`shrink-0 text-ink-700/50 transition-transform ${deplie ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
                {deplie && (
                  <div className="space-y-3 border-t border-cream-200 bg-cream-50/40 p-4">
                    {a.cohortes.length === 0 ? (
                      <p className="text-sm text-ink-700/55">Aucune session enregistrée pour cette antenne.</p>
                    ) : (
                      a.cohortes.map((c) => <CohorteCard key={c.id} cohorte={c} lectureSeule={!peutEcrire} />)
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
