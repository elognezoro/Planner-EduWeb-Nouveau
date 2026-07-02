import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifierEmail } from "@/lib/auth/verification";

export const metadata: Metadata = { title: "Vérification de l'e-mail" };

export default async function VerificationEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; envoye?: string; email?: string }>;
}) {
  const { token, envoye, email } = await searchParams;

  // Cas 1 : retour de l'inscription — invitation à consulter sa boîte mail.
  if (envoye === "1" && !token) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-800 text-gold-300">
          <MailCheck size={30} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-forest-900">
          Vérifiez votre e-mail
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-700/80">
          Un lien de confirmation vient d'être envoyé{email ? ` à ${email}` : ""}. Cliquez
          dessus pour activer votre compte, puis connectez-vous.
        </p>
        <p className="mt-2 text-xs text-ink-700/55">
          (En développement sans clé Resend, le lien est affiché dans la console du serveur.)
        </p>
        <div className="mt-7">
          <Button href="/connexion" variant="primary">
            Aller à la connexion
          </Button>
        </div>
        <p className="mt-4 text-xs text-ink-700/60">
          Vous n&apos;avez rien reçu ?{" "}
          <Link
            href="/renvoyer-confirmation"
            className="font-semibold text-forest-700 hover:underline"
          >
            Renvoyer l&apos;e-mail
          </Link>
        </p>
      </div>
    );
  }

  // Cas 2 : clic sur le lien — confirmation effective.
  if (token) {
    const resultat = await verifierEmail(token);

    if (resultat === "succes") {
      return (
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-50 text-forest-600">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-forest-900">
            Compte confirmé
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-700/80">
            Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter. Votre
            demande de rôle reste en cours de validation par un administrateur.
          </p>
          <div className="mt-7">
            <Button href="/connexion?verifie=1" variant="primary">
              Se connecter
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <XCircle size={32} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-forest-900">
          Lien invalide ou expiré
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-700/80">
          {resultat === "erreur"
            ? "Une erreur technique est survenue. Réessayez plus tard."
            : "Ce lien de confirmation n'est plus valable. Demandez-en un nouveau ci-dessous."}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          {resultat === "invalide" && (
            <Button href="/renvoyer-confirmation" variant="primary">
              Renvoyer l&apos;e-mail de confirmation
            </Button>
          )}
          <Link
            href="/connexion"
            className="text-sm font-semibold text-forest-700 hover:underline"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  // Accès direct sans paramètre.
  return (
    <div className="text-center">
      <h1 className="font-display text-3xl font-bold text-forest-900">Vérification</h1>
      <p className="mt-3 text-sm text-ink-700/80">
        Aucune action de vérification en cours.
      </p>
      <p className="mt-6">
        <Link href="/connexion" className="font-semibold text-forest-700 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
