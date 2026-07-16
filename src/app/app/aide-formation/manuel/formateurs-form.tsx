"use client";

import { useActionState } from "react";
import { UsersRound } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { enregistrerFormateurs, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

/** Gestion (admin) de la liste des formateurs désignés — accès au manuel du formateur. */
export function FormateursForm({ emails }: { emails: string }) {
  const [etat, action] = useActionState(enregistrerFormateurs, initial);
  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <p className="flex items-center gap-1.5 text-sm font-semibold text-forest-900">
        <UsersRound size={15} /> Formateurs désignés
      </p>
      <p className="text-xs text-ink-700/60">
        En plus de l&apos;admin système, ces comptes (e-mails, un par ligne ou séparés par des virgules)
        accèdent au manuel du formateur — document Word de formation générale, corrigés inclus.
      </p>
      <textarea
        name="emails"
        rows={3}
        defaultValue={emails}
        placeholder={"formateur1@eduweb.ci\nformateur2@eduweb.ci"}
        className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      <SubmitButton className="w-auto px-6">Enregistrer les formateurs</SubmitButton>
    </form>
  );
}
