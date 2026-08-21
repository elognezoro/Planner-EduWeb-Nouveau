import type { Metadata } from "next";
import Link from "next/link";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";
import { RenvoyerConfirmationForm } from "./form";

export const metadata: Metadata = { title: "Renvoyer l'e-mail de confirmation" };

export default async function RenvoyerConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  // Page à retrouver après confirmation puis connexion (ex. invitation à une formation) —
  // validée (anti open-redirect), propagée dans le nouveau lien de vérification.
  const retour = cheminRetourSur((await searchParams).retour);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">
        Renvoyer la confirmation
      </h1>
      <p className="mt-2 text-sm text-ink-700/75">
        Votre compte n&apos;est pas encore activé ou le lien a expiré&nbsp;? Indiquez votre
        adresse e-mail : nous vous renverrons un lien de confirmation (valable 24&nbsp;heures).
      </p>

      <div className="mt-6">
        <RenvoyerConfirmationForm retour={retour} />
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
