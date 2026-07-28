import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creerNotification } from "@/lib/notifications/creer";
import { journaliserActivite } from "@/lib/audit/journal";
import { ASSISTANCE_DUREE_MS } from "@/lib/auth/apercu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche planifiée : BILANS D'ASSISTANCE MANQUANTS.
 *
 * Le bilan (notification à l'utilisateur assisté) part normalement quand l'opérateur clique sur
 * « Quitter l'assistance ». Mais une session peut s'achever autrement : onglet fermé, navigateur
 * quitté, jeton expiré au bout de 30 min. Sans ce rattrapage, ces sessions-là ne notifieraient
 * JAMAIS l'utilisateur — alors même qu'elles ont modifié son compte.
 *
 * Principe : aucune table de sessions à maintenir. Le journal est la source de vérité —
 * `operateurId` non nul y signe une action d'assistance. On reconstitue donc les sessions par
 * couple (opérateur, cible), et l'on ne traite que celles qui sont FORCÉMENT terminées, c'est-à-dire
 * dont la dernière écriture est plus ancienne que la durée de vie d'un jeton.
 *
 * Idempotent : une session déjà soldée porte une ligne « assistance.session_terminee » postérieure
 * à sa dernière écriture — elle est alors ignorée. Un double passage ne notifie donc jamais deux fois.
 *
 * Sécurité : protégé par CRON_SECRET (Vercel envoie « Authorization: Bearer <secret> »).
 */

/** Fenêtre de rattrapage : au-delà, on considère que le silence est acquis (et le journal reste consultable). */
const FENETRE_MS = 7 * 86_400_000;
/** Nombre de sessions traitées par passage — borne le temps d'exécution. */
const SESSIONS_MAX = 200;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const autorisation = req.headers.get("authorization");
  if (secret) {
    if (autorisation !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 500 });
  }

  const maintenant = Date.now();
  const depuis = new Date(maintenant - FENETRE_MS);
  // Une session ne peut plus recevoir d'écriture passé la durée du jeton : elle est close.
  const seuilCloture = new Date(maintenant - ASSISTANCE_DUREE_MS);

  let notifies = 0;
  let ignores = 0;
  try {
    // Écritures d'assistance de la fenêtre, groupées par couple (opérateur, cible).
    const lignes = await prisma.journalActivite.findMany({
      where: {
        operateurId: { not: null },
        utilisateurId: { not: null },
        creeLe: { gte: depuis },
        // Le marqueur de fin n'est pas une écriture d'assistance : on l'exclut du regroupement.
        NOT: { action: "assistance.session_terminee" },
      },
      orderBy: { creeLe: "asc" },
      take: 5000,
      select: { operateurId: true, utilisateurId: true, operateurEmail: true, entite: true, creeLe: true },
    });

    type Session = { operateurId: string; cibleId: string; operateurEmail: string | null; entites: Set<string>; nb: number; debut: Date; fin: Date };
    const sessions = new Map<string, Session>();
    for (const l of lignes) {
      if (!l.operateurId || !l.utilisateurId) continue;
      const cle = `${l.operateurId}|${l.utilisateurId}`;
      const s = sessions.get(cle);
      if (!s) {
        sessions.set(cle, {
          operateurId: l.operateurId,
          cibleId: l.utilisateurId,
          operateurEmail: l.operateurEmail,
          entites: new Set(l.entite ? [l.entite] : []),
          nb: 1,
          debut: l.creeLe,
          fin: l.creeLe,
        });
      } else {
        s.nb += 1;
        s.fin = l.creeLe;
        if (l.entite) s.entites.add(l.entite);
        if (!s.operateurEmail) s.operateurEmail = l.operateurEmail;
      }
    }

    for (const s of [...sessions.values()].slice(0, SESSIONS_MAX)) {
      // Session encore possiblement en cours : on la laissera au passage suivant.
      if (s.fin > seuilCloture) {
        ignores += 1;
        continue;
      }
      // Bilan déjà envoyé (sortie explicite, ou passage précédent de cette tâche) ?
      const dejaSolde = await prisma.journalActivite.count({
        where: {
          action: "assistance.session_terminee",
          operateurId: s.operateurId,
          utilisateurId: s.cibleId,
          creeLe: { gte: s.fin },
        },
      });
      if (dejaSolde > 0) {
        ignores += 1;
        continue;
      }

      const quand = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(s.debut);
      const entites = [...s.entites].slice(0, 6);
      const detail = entites.length > 0 ? ` Éléments concernés : ${entites.join(", ")}.` : "";
      await creerNotification({
        destinataireId: s.cibleId,
        titre: "Assistance technique sur votre compte",
        message:
          `${s.nb} modification${s.nb > 1 ? "s ont" : " a"} été effectuée${s.nb > 1 ? "s" : ""} sur votre compte ` +
          `par ${s.operateurEmail ?? "un administrateur"} (assistance), à partir du ${quand}.${detail} ` +
          "Si cette intervention vous surprend, signalez-le à l'administration.",
        type: "info",
      });
      await journaliserActivite({
        action: "assistance.session_terminee",
        cible: `Utilisateur:${s.cibleId}`,
        details: { ecritures: s.nb, entites, rattrapage: true },
        utilisateurId: s.cibleId,
        operateurId: s.operateurId,
        operateurEmail: s.operateurEmail,
        source: "securite",
      });
      notifies += 1;
    }
  } catch (e) {
    console.error("[cron/assistance-bilans] :", e);
    return NextResponse.json({ error: "Erreur technique." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notifies, ignores });
}
