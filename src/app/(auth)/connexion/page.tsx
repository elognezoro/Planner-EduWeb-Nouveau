import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { ConnexionForm } from "./connexion-form";
import { VeilleReconnexion } from "./veille-reconnexion";
import { FormAlert } from "@/components/ui/form";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ verifie?: string; reinitialise?: string; retour?: string }>;
}) {
  const params = await searchParams;
  // Page à réafficher après connexion (déconnexion pour inactivité, ou invitation à une
  // formation) — validée : chemin interne « /app… » ou « /invitation/<jeton> » uniquement
  // (anti open-redirect), sinon ignorée.
  const retour = cheminRetourSur(params.retour);
  const retourInvitation = retour !== null && retour.startsWith("/invitation/");

  // DÉJÀ CONNECTÉ (ex. connexion réalisée dans un AUTRE onglet du même navigateur, puis
  // actualisation de celui-ci) : la page de connexion n'a rien à demander — retour direct
  // sur la page visée, sinon l'accueil de l'espace.
  // ⚠ Fondé sur l'utilisateur RÉEL en base (getUtilisateurCourant), JAMAIS sur le seul jeton
  // JWT : un compte SUPPRIMÉ au cookie encore valide entrerait sinon en boucle de redirections
  // /app ↔ /connexion (navigateur verrouillé hors du site jusqu'à purge des cookies).
  // Les arrivées « e-mail confirmé » / « mot de passe réinitialisé » gardent leur message :
  // l'intention explicite y est de se (re)connecter, même si une autre session est ouverte.
  if (params.verifie !== "1" && params.reinitialise !== "1") {
    const utilisateur = await getUtilisateurCourant();
    if (utilisateur) redirect(retour ?? "/app");
  }

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
            {retourInvitation
              ? "Connectez-vous : vous reviendrez directement sur la page d'invitation à la formation."
              : "Vous avez été déconnecté(e). Reconnectez-vous : vous retrouverez directement la page où vous étiez."}
          </FormAlert>
        )}
        <ConnexionForm retour={retour} />
        {/* Reconnexion automatique : si la connexion se fait dans un AUTRE onglet, celui-ci
            se recharge tout seul et la redirection ci-dessus l'emmène dans l'espace. */}
        <VeilleReconnexion />
      </div>

      <Link
        href={avecRetour("/mot-de-passe-oublie", retour)}
        className="mt-4 flex w-full items-center justify-center rounded-full border border-gold-300 bg-gold-50 px-5 py-2.5 text-sm font-semibold text-gold-800 transition-colors hover:bg-gold-100"
      >
        Mot de passe oublié ? Réinitialiser
      </Link>

      <p className="mt-6 text-center text-sm text-ink-700/75">
        Pas encore de compte ?{" "}
        {/* Seul un retour d'INVITATION a un sens pour un compte à créer (un chemin /app…
            issu de la déconnexion d'inactivité ne concerne que le compte existant). */}
        <Link
          href={retourInvitation ? avecRetour("/inscription", retour) : "/inscription"}
          className="font-semibold text-forest-700 hover:underline"
        >
          Créer un compte
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-700/75">
        Compte non confirmé ?{" "}
        <Link
          href={avecRetour("/renvoyer-confirmation", retour)}
          className="font-semibold text-forest-700 hover:underline"
        >
          Renvoyer l&apos;e-mail de confirmation
        </Link>
      </p>
    </div>
  );
}
