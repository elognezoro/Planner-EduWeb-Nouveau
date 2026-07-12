import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "EduWeb Planner <no-reply@exemple.ci>";

const resend = apiKey ? new Resend(apiKey) : null;

export interface EmailAEnvoyer {
  to: string;
  subject: string;
  html: string;
  /** Copie(s) carbone (ex : administration en copie d'un échange). */
  cc?: string | string[];
  /** Adresse de réponse (les réponses des destinataires y arrivent). */
  replyTo?: string;
  /** Lien principal, journalisé en clair quand l'envoi est simulé (dev sans clé Resend). */
  lienDebug?: string;
}

/**
 * Envoie un e-mail via Resend. Si RESEND_API_KEY est absent (développement), l'envoi est
 * simulé : le message et le lien sont journalisés dans la console serveur au lieu d'échouer.
 */
export async function envoyerEmail({ to, subject, html, cc, replyTo, lienDebug }: EmailAEnvoyer) {
  if (!resend) {
    console.warn(
      `\n[email simulé] RESEND_API_KEY absent.\n  À      : ${to}` +
        (cc ? `\n  Copie  : ${Array.isArray(cc) ? cc.join(", ") : cc}` : "") +
        `\n  Sujet  : ${subject}` +
        (lienDebug ? `\n  Lien   : ${lienDebug}` : "") +
        "\n",
    );
    return { simule: true as const };
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(cc ? { cc } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) {
    throw new Error(`Échec de l'envoi e-mail (Resend) : ${error.message}`);
  }
  return { simule: false as const };
}
