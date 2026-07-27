import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Caviardage partagé pour la traçabilité : ne jamais faire fuiter de secret dans le journal.
 *
 * Utilisé par les appels EXPLICITES (journaliserActivite) qui peuvent transporter des valeurs.
 * La capture AUTOMATIQUE (extension), elle, ne stocke QUE les NOMS des champs modifiés (aucune
 * valeur) — donc ni secret ni donnée personnelle : voir src/lib/audit/extension.ts.
 */

/** Clés dont la VALEUR ne doit jamais être journalisée (secrets / codes à usage unique). */
export const CLES_SENSIBLES =
  /(mot.?de.?passe|password|hash|secret|token|jeton|otp|\bpin\b|\bcode\b|cvv|numerocarte|carte)/i;

/** Sérialise en JSON en caviardant les clés sensibles ; borne la taille (payloads géants). */
export function versJsonCaviarde(valeur: unknown): Prisma.InputJsonValue | undefined {
  if (valeur === undefined || valeur === null) return undefined;
  try {
    const json = JSON.stringify(valeur, (cle, val) =>
      typeof cle === "string" && CLES_SENSIBLES.test(cle) ? "[caviardé]" : val,
    );
    if (!json) return undefined;
    if (json.length > 20_000) return { tronque: true, taille: json.length };
    return JSON.parse(json) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/**
 * Noms des champs présents dans une charge d'écriture (jusqu'à 60), sans les valeurs.
 * C'est ce que la capture auto conserve : « quels champs ont été touchés », sans PII ni secret.
 */
export function nomsChamps(...charges: unknown[]): string[] {
  const noms = new Set<string>();
  for (const charge of charges) {
    if (charge && typeof charge === "object" && !Array.isArray(charge)) {
      for (const k of Object.keys(charge)) noms.add(k);
    }
  }
  return [...noms].slice(0, 60);
}
