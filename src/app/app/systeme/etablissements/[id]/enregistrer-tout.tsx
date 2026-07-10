"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";

/**
 * Sauvegarde globale : soumet en une fois tous les blocs de paramétrage marqués
 * `data-config-save` (Pays & en-tête, Informations générales, Chef, Rapport,
 * Effectifs par niveau, Effectifs enseignants). Chaque bloc met à jour SES propres
 * colonnes (mises à jour partielles disjointes) puis affiche sa propre confirmation.
 *
 * Les onglets à sauvegarde propre (Volumes horaires, Compétences enseignants) ne sont
 * pas concernés : ils s'enregistrent onglet par onglet / à la volée.
 */
export function EnregistrerTouteLaConfig() {
  const [enCours, setEnCours] = useState(false);

  const enregistrer = () => {
    const formulaires = Array.from(document.querySelectorAll<HTMLFormElement>("form[data-config-save]"));
    if (formulaires.length === 0) return;
    setEnCours(true);
    // Les Server Actions partent en parallèle ; le résultat s'affiche ensuite bloc par bloc.
    formulaires.forEach((f) => f.requestSubmit());
    window.setTimeout(() => setEnCours(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={enregistrer}
      disabled={enCours}
      className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-forest-800 px-7 text-sm font-semibold text-cream-50 shadow-soft transition-transform hover:-translate-y-0.5 hover:bg-forest-700 disabled:opacity-60"
    >
      {enCours ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
      {enCours ? "Enregistrement…" : "Enregistrer toute la configuration"}
    </button>
  );
}
