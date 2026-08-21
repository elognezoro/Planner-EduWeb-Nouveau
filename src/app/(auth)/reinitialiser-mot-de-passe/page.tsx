import type { Metadata } from "next";
import Link from "next/link";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";
import { ReinitialiserForm } from "./form";

export const metadata: Metadata = { title: "Réinitialiser le mot de passe" };

export default async function ReinitialiserPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; retour?: string }>;
}) {
  const { token, retour: retourBrut } = await searchParams;
  // Page à retrouver après connexion (ex. invitation à une formation) — validée, rendue à la
  // page de connexion une fois le mot de passe réinitialisé.
  const retour = cheminRetourSur(retourBrut);

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-forest-900">Lien invalide</h1>
        <p className="mt-2 text-sm text-ink-700/75">
          Ce lien de réinitialisation est incomplet ou a expiré.
        </p>
        <p className="mt-6">
          <Link
            href={avecRetour("/mot-de-passe-oublie", retour)}
            className="font-semibold text-forest-700 hover:underline"
          >
            Demander un nouveau lien
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-ink-700/75">
        Choisissez un mot de passe d&apos;au moins 8 caractères.
      </p>
      <div className="mt-6">
        <ReinitialiserForm token={token} retour={retour} />
      </div>
    </div>
  );
}
