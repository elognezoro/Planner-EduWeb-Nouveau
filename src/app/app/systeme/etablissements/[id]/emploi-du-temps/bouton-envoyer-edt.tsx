"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { envoyerEdtParEmail, type EtatGeneration } from "./actions";

/**
 * Envoi de l'emploi du temps de la classe par e-mail aux concernés (élèves, parents,
 * enseignants). Confirmation en deux temps — l'envoi est un acte externe.
 */
export function BoutonEnvoyerEdt({
  etablissementId,
  classeId,
  classeNom,
}: {
  etablissementId: string;
  classeId: string;
  classeNom: string;
}) {
  const [confirmation, setConfirmation] = useState(false);
  const [retour, setRetour] = useState<EtatGeneration | null>(null);
  const [enCours, demarrer] = useTransition();

  function envoyer() {
    if (!confirmation) {
      // On garde le dernier compte rendu visible pendant la ré-confirmation : après un
      // envoi réussi, l'utilisateur voit toujours « … envoyé à N destinataires » — il ne
      // relance pas un envoi par inadvertance.
      setConfirmation(true);
      return;
    }
    setConfirmation(false);
    setRetour(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("classeId", classeId);
      setRetour(await envoyerEdtParEmail({ ok: false }, fd));
    });
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={envoyer}
          disabled={enCours}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-70 ${
            confirmation
              ? "bg-gold-600 text-white hover:bg-gold-700"
              : "border border-forest-200 bg-white text-forest-800 hover:bg-forest-50"
          }`}
        >
          {enCours ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          {confirmation
            ? `Confirmer l'envoi aux concernés de ${classeNom}`
            : "Envoyer par e-mail aux concernés"}
        </button>
        {confirmation && (
          <button
            type="button"
            onClick={() => setConfirmation(false)}
            className="text-sm font-medium text-ink-700/60 hover:text-ink-900"
          >
            Annuler
          </button>
        )}
      </div>
      {retour?.message && (
        <p className={`mt-2 text-sm font-medium ${retour.ok ? "text-forest-700" : "text-red-600"}`}>
          {retour.message}
        </p>
      )}
    </div>
  );
}
