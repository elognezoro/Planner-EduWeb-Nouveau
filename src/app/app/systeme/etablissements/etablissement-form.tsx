"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, ChevronDown, School, MapPin, BadgeCheck } from "lucide-react";
import { creerEtablissement, villesDuPays, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";
import { SelecteurPays } from "@/components/app/selecteur-pays";

const initial: EtatForm = { ok: false };

const TYPES = [
  { v: "college", l: "Collège" },
  { v: "lycee", l: "Lycée" },
  { v: "groupe_scolaire", l: "Groupe scolaire" },
  { v: "primaire", l: "Primaire" },
  { v: "prescolaire", l: "Préscolaire" },
  { v: "autre", l: "Autre" },
];
const STATUTS = [
  { v: "public", l: "Public" },
  { v: "prive", l: "Privé" },
  { v: "confessionnel", l: "Confessionnel" },
  { v: "autre", l: "Autre" },
];

export interface RegionOption {
  id: string;
  nom: string;
  pays: string;
}

/**
 * Création manuelle d'un établissement — panneau repliable « premium ».
 * Le PAYS pilote le formulaire : les régions proposées et les suggestions de villes
 * sont celles du pays sélectionné uniquement.
 */
export function EtablissementForm({ regions }: { regions: RegionOption[] }) {
  const [etat, action] = useActionState(creerEtablissement, initial);
  const [ouvert, setOuvert] = useState(false);
  const [pays, setPays] = useState("Côte d'Ivoire");
  const [villes, setVilles] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const err = etat.erreurs ?? {};

  const regionsDuPays = regions.filter((r) => r.pays === pays);

  // Suggestions de villes du pays choisi (répertoire existant).
  useEffect(() => {
    let annule = false;
    villesDuPays(pays)
      .then((v) => {
        if (!annule) setVilles(v);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [pays]);

  // Après une création réussie, on vide le formulaire (le message de succès reste affiché).
  useEffect(() => {
    if (etat.ok) formRef.current?.reset();
  }, [etat]);

  return (
    <section className="overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition-colors hover:bg-cream-50/60"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-800 text-gold-300">
            <Plus size={20} />
          </span>
          <span>
            <span className="block font-display text-lg font-bold text-forest-900">Nouvel établissement</span>
            <span className="block text-sm text-ink-700/60">
              Création manuelle — régions et villes s&apos;adaptent au pays choisi.
            </span>
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-ink-700/40 transition-transform ${ouvert ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <form ref={formRef} action={action} className="space-y-5 border-t border-cream-100 px-6 py-6">
              {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

              {/* Identité */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-700">
                  <School size={14} /> Identité
                </p>
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <Label htmlFor="nom">Nom de l&apos;établissement</Label>
                    <Input id="nom" name="nom" required placeholder="Ex : Lycée Moderne de Cocody" />
                    <FieldError messages={err.nom} />
                  </div>
                  <div>
                    <Label htmlFor="code">Code officiel (optionnel)</Label>
                    <Input id="code" name="code" placeholder="Ex : 041600" />
                    <FieldError messages={err.code} />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select id="type" name="type" defaultValue="college">
                      {TYPES.map((t) => (
                        <option key={t.v} value={t.v}>{t.l}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="statut">Statut</Label>
                    <Select id="statut" name="statut" defaultValue="public">
                      {STATUTS.map((s) => (
                        <option key={s.v} value={s.v}>{s.l}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Localisation */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-700">
                  <MapPin size={14} /> Localisation
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Pays</Label>
                    <SelecteurPays name="pays" valeur={pays} onSelect={(p) => setPays(p.nom)} />
                  </div>
                  <div>
                    <Label htmlFor="regionId">Région ({pays})</Label>
                    {/* La clé force la remise à zéro du choix quand le pays change. */}
                    <Select key={pays} id="regionId" name="regionId" defaultValue="">
                      <option value="">— Non rattaché —</option>
                      {regionsDuPays.map((r) => (
                        <option key={r.id} value={r.id}>{r.nom}</option>
                      ))}
                    </Select>
                    {regionsDuPays.length === 0 && (
                      <p className="mt-1.5 text-xs text-gold-700">
                        Aucune région enregistrée pour {pays} — ajoutez-la dans Configuration générale.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="ville">Ville / commune</Label>
                    <Input id="ville" name="ville" list="villes-pays" placeholder={villes[0] ? `Ex : ${villes[0]}` : "Ex : Abidjan"} />
                    <datalist id="villes-pays">
                      {villes.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    {villes.length > 0 && (
                      <p className="mt-1.5 text-xs text-ink-700/50">
                        {villes.length} ville(s) connue(s) pour {pays} — suggestions en tapant.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-cream-100 pt-4">
                <p className="flex items-center gap-1.5 text-xs text-ink-700/55">
                  <BadgeCheck size={13} className="text-forest-600" />
                  Doublons et cohérence région/pays vérifiés à la création.
                </p>
                <SubmitButton className="w-auto px-8">Créer l&apos;établissement</SubmitButton>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
