import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";

/**
 * ALERTE DE CO-INTERVENTION — « quelqu'un configure déjà cet établissement ».
 *
 * But : quand un utilisateur de droit supérieur ouvre la configuration d'un établissement, il doit
 * voir tout de suite qu'un collègue y a déjà travaillé, et QUI — afin de ne pas défaire son travail
 * sans le savoir. C'est un avertissement de COORDINATION, pas une interdiction : rien n'est bloqué.
 *
 * Source : le journal d'activité, qui enregistre l'auteur de chaque écriture (et, en mode
 * assistance, l'opérateur réel). Aucune table supplémentaire à tenir, donc aucun risque de
 * divergence avec la réalité des modifications.
 */

/** Fenêtre considérée comme « configuration en cours ». Au-delà, l'information devient anecdotique. */
const FENETRE_JOURS = 30;

export async function AlerteConfiguration({
  etablissementId,
  utilisateurCourantId,
}: {
  etablissementId: string;
  /** Exclu du relevé : on n'alerte jamais quelqu'un au sujet de ses propres modifications. */
  utilisateurCourantId: string;
}) {
  let intervenants: { nom: string; role: string | null; quand: Date }[] = [];
  try {
    const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
    const lignes = await prisma.journalActivite.findMany({
      where: {
        etablissementId,
        creeLe: { gte: depuis },
        utilisateurId: { not: utilisateurCourantId },
        // Écritures uniquement (le journal ne trace pas les consultations) et hors évènements
        // de sécurité, qui ne disent rien de l'avancement de la configuration.
        source: { in: ["auto", "metier"] },
      },
      orderBy: { creeLe: "desc" },
      take: 200,
      select: { acteurEmail: true, acteurRole: true, operateurEmail: true, creeLe: true },
    });
    // Un intervenant par personne, avec sa dernière intervention. En mode assistance, on nomme
    // l'OPÉRATEUR réel : c'est lui qu'il faut contacter, pas le compte incarné.
    const parPersonne = new Map<string, { nom: string; role: string | null; quand: Date }>();
    for (const l of lignes) {
      const nom = l.operateurEmail ?? l.acteurEmail;
      if (!nom) continue;
      if (!parPersonne.has(nom)) parPersonne.set(nom, { nom, role: l.acteurRole, quand: l.creeLe });
    }
    intervenants = [...parPersonne.values()].slice(0, 4);
  } catch (e) {
    // Une alerte informative ne doit jamais empêcher l'affichage de la page de configuration.
    console.error("[alerte-configuration] :", e);
    return null;
  }

  if (intervenants.length === 0) return null;

  const dateFr = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(d);
  const premier = intervenants[0];

  return (
    <div className="mb-5 rounded-2xl border border-gold-300 bg-gradient-to-r from-gold-50 to-cream-50 px-4 py-3.5 sm:px-5">
      <p className="flex items-start gap-2.5 text-sm text-gold-900">
        <Users size={18} className="mt-0.5 shrink-0 text-gold-600" />
        <span>
          <strong>Cet établissement est déjà en cours de configuration.</strong>{" "}
          {intervenants.length === 1 ? (
            <>
              Dernière intervention de <strong>{premier.nom}</strong>
              {premier.role ? ` (${premier.role})` : ""}, le {dateFr(premier.quand)}.
            </>
          ) : (
            <>
              {intervenants.length} personnes y sont intervenues récemment, la dernière étant{" "}
              <strong>{premier.nom}</strong>, le {dateFr(premier.quand)}.
            </>
          )}{" "}
          <span className="text-gold-800/80">
            Concertez-vous avant de modifier : vos saisies remplaceraient les siennes sans avertissement.
          </span>
        </span>
      </p>
      {intervenants.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-7 text-xs text-gold-800/75">
          {intervenants.slice(1).map((i) => (
            <li key={i.nom}>
              {i.nom}
              {i.role ? ` (${i.role})` : ""} — {dateFr(i.quand)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
