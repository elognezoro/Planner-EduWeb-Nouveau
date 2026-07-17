import type { Metadata } from "next";
import Link from "next/link";
import { ReinitialiserForm } from "./form";

export const metadata: Metadata = { title: "Réinitialiser le mot de passe" };

export default async function ReinitialiserPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-forest-900">Lien invalide</h1>
        <p className="mt-2 text-sm text-ink-700/75">
          Ce lien de réinitialisation est incomplet ou a expiré.
        </p>
        <p className="mt-6">
          <Link
            href="/mot-de-passe-oublie"
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
        <ReinitialiserForm token={token} />
      </div>
    </div>
  );
}
