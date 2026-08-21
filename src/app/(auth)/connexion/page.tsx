import type { Metadata } from "next";
import Link from "next/link";
import { ConnexionForm } from "./connexion-form";
import { FormAlert } from "@/components/ui/form";
import { cheminRetourSur } from "@/lib/auth/retour";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ verifie?: string; reinitialise?: string; retour?: string }>;
}) {
  const params = await searchParams;
  // Page à réafficher après connexion (déconnexion pour inactivité) — validée : chemin
  // interne « /app… » uniquement (anti open-redirect), sinon ignorée.
  const retour = cheminRetourSur(params.retour);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-forest-900">Bon retour</h1>
      <p className="mt-2 text-sm text-ink-700/75">
        Connectez-vous pour accéder à votre espace EduWeb Planner.
      </p>

      <div className="mt-6 space-y-4">
        {params.verifie === "1" && (
          <FormAlert ton="succes">
            Votre adresse e-mail est confirmée. Vous pouvez vous connecter.
          </FormAlert>
        )}
        {params.reinitialise === "1" && (
          <FormAlert ton="succes">
            Votre mot de passe a été réinitialisé. Connectez-vous avec le nouveau.
          </FormAlert>
        )}
        {retour && (
          <FormAlert ton="info">
            Vous avez été déconnecté(e). Reconnectez-vous : vous retrouverez directement la
            page où vous étiez.
          </FormAlert>
        )}
        <ConnexionForm retour={retour} />
      </div>

      <Link
        href="/mot-de-passe-oublie"
        className="mt-4 flex w-full items-center justify-center rounded-full border border-gold-300 bg-gold-50 px-5 py-2.5 text-sm font-semibold text-gold-800 transition-colors hover:bg-gold-100"
      >
        Mot de passe oublié ? Réinitialiser
      </Link>

      <p className="mt-6 text-center text-sm text-ink-700/75">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-forest-700 hover:underline">
          Créer un compte
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-700/75">
        Compte non confirmé ?{" "}
        <Link
          href="/renvoyer-confirmation"
          className="font-semibold text-forest-700 hover:underline"
        >
          Renvoyer l&apos;e-mail de confirmation
        </Link>
      </p>
    </div>
  );
}
