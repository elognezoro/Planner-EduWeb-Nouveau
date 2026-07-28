"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, Check, LifeBuoy } from "lucide-react";
import { changerRole, type EtatHabilitation } from "./actions";
import { voirCommeUtilisateur } from "@/app/app/systeme/apercu/actions";
import { type RoleId } from "@/lib/rbac";

const initial: EtatHabilitation = { ok: false };

function BoutonEnregistrer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
      Appliquer
    </button>
  );
}

export function RowHabilitation({
  utilisateurId,
  roleActuel,
  roles,
  peutAssister = false,
}: {
  utilisateurId: string;
  roleActuel: RoleId;
  /** Rôles attribuables par l'habilitateur courant (déjà bornés par rang côté serveur). */
  roles: { id: RoleId; libelle: string }[];
  /** Mode ASSISTANCE ouvert sur ce compte (décidé côté serveur par peutIncarnerUtilisateur). */
  peutAssister?: boolean;
}) {
  const [etat, action] = useActionState(changerRole, initial);

  return (
    <div className="flex flex-wrap items-center gap-2">
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="utilisateurId" value={utilisateurId} />
      <select
        name="role"
        defaultValue={roleActuel}
        className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm text-ink-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.libelle}
          </option>
        ))}
      </select>
      <BoutonEnregistrer />
      {etat.message && (
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            etat.ok ? "text-forest-700" : "text-red-600"
          }`}
        >
          {etat.ok && <Check size={13} />}
          {etat.message}
        </span>
      )}
    </form>
      {/* Formulaire FRÈRE (jamais imbriqué : un <form> dans un <form> est invalide en HTML). */}
      {peutAssister && (
        <form action={voirCommeUtilisateur}>
          <input type="hidden" name="utilisateurId" value={utilisateurId} />
          <button
            type="submit"
            title="Agir en lieu et place de cet utilisateur pour le dépanner. Toutes vos actions seront enregistrées à votre nom, et il en sera informé."
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-2.5 text-xs font-medium text-forest-800 transition-colors hover:border-forest-400 hover:bg-forest-50"
          >
            <LifeBuoy size={13} /> Assister
          </button>
        </form>
      )}
    </div>
  );
}
