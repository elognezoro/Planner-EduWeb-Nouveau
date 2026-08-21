import type { Metadata } from "next";
import Link from "next/link";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";
import { MotDePasseOublieForm } from "./form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function MotDePasseOubliePage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  // Page à retrouver après réinitialisation puis connexion (ex. invitation à une formation) —
  // validée (anti open-redirect), propagée dans le lien de réinitialisation.
  const retour = cheminRetourSur((await searchParams).retour);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-ink-700/75">
        Indiquez votre adresse e-mail : nous vous enverrons un lien de réinitialisation.
      </p>

      <div className="mt-6">
        <MotDePasseOublieForm retour={retour} />
      </div>

      <p className="mt-6 text-center text-sm text-ink-700/75">
        <Link
          href={avecRetour("/connexion", retour)}
          className="font-semibold text-forest-700 hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
