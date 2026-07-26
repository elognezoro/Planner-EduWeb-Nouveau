import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Séquences de NUMÉROTATION configurables (RM-014, équivalent « numbering_sequences ») :
 * numéros uniques par établissement, exercice (facultatif) et type de document, formatés
 * « PREFIXE-AAAA-000123 » (largeur configurable).
 *
 * ⚠️ Les reçus existants (PaiementScolarite.numeroRecu) restent sur leur numérotation
 * historique : le branchement des documents sur ces séquences viendra avec les specs 07/08.
 */

export interface NumeroAttribue {
  /** Compteur brut attribué (1, 2, 3…). */
  numero: number;
  /** Référence formatée, ex : « REC-2026-000123 ». */
  reference: string;
}

export function formaterNumero(prefixe: string, annee: number, numero: number, largeur: number): string {
  return `${prefixe}-${annee}-${String(numero).padStart(Math.max(1, largeur), "0")}`;
}

/**
 * Attribue le prochain numéro de la séquence (etablissementId, exerciceId, type) — création de
 * la séquence au premier appel, avec `prefixeDefaut`. L'incrément est ATOMIQUE et doit être
 * appelé DANS la transaction de l'opération (le verrou de ligne posé par l'update est tenu
 * jusqu'au commit : pas de doublon possible entre deux transactions concurrentes).
 */
export async function prochainNumero(
  tx: Prisma.TransactionClient,
  etablissementId: string,
  exerciceId: string | null,
  type: string,
  prefixeDefaut: string,
): Promise<NumeroAttribue> {
  const cle = { etablissementId, exerciceId, type };
  const annee = new Date().getFullYear();

  const maj = await tx.sequenceNumerotation.updateMany({
    where: cle,
    data: { prochainNumero: { increment: 1 } },
  });

  if (maj.count === 0) {
    // Première utilisation : la séquence est créée (numéro 1 attribué, prochain = 2). Une
    // création concurrente échouerait sur l'index unique — l'opération appelante échoue alors
    // proprement avec sa transaction (jamais de numéro dupliqué).
    const creee = await tx.sequenceNumerotation.create({
      data: { ...cle, prefixe: prefixeDefaut, prochainNumero: 2 },
      select: { prefixe: true, largeur: true },
    });
    return { numero: 1, reference: formaterNumero(creee.prefixe, annee, 1, creee.largeur) };
  }

  // La ligne vient d'être verrouillée par NOTRE update (verrou tenu jusqu'au commit) :
  // la relecture reflète exactement notre incrément.
  const seq = await tx.sequenceNumerotation.findFirst({
    where: cle,
    select: { prochainNumero: true, prefixe: true, largeur: true },
  });
  const numero = (seq?.prochainNumero ?? 2) - 1;
  return {
    numero,
    reference: formaterNumero(seq?.prefixe ?? prefixeDefaut, annee, numero, seq?.largeur ?? 6),
  };
}

/**
 * Réserve une PLAGE de `nombre` numéros consécutifs en UN incrément atomique (génération en
 * lot d'écritures comptables — 11) : mêmes garanties de verrou que `prochainNumero`.
 * Retourne le premier numéro réservé et un formateur de référence.
 */
export async function reserverPlageNumeros(
  tx: Prisma.TransactionClient,
  etablissementId: string,
  exerciceId: string | null,
  type: string,
  prefixeDefaut: string,
  nombre: number,
): Promise<{ premier: number; referencePour: (numero: number) => string }> {
  const cle = { etablissementId, exerciceId, type };
  const annee = new Date().getFullYear();
  const n = Math.max(1, Math.trunc(nombre));

  const maj = await tx.sequenceNumerotation.updateMany({
    where: cle,
    data: { prochainNumero: { increment: n } },
  });
  if (maj.count === 0) {
    const creee = await tx.sequenceNumerotation.create({
      data: { ...cle, prefixe: prefixeDefaut, prochainNumero: n + 1 },
      select: { prefixe: true, largeur: true },
    });
    return {
      premier: 1,
      referencePour: (numero) => formaterNumero(creee.prefixe, annee, numero, creee.largeur),
    };
  }
  const seq = await tx.sequenceNumerotation.findFirst({
    where: cle,
    select: { prochainNumero: true, prefixe: true, largeur: true },
  });
  const premier = (seq?.prochainNumero ?? n + 1) - n;
  return {
    premier,
    referencePour: (numero) => formaterNumero(seq?.prefixe ?? prefixeDefaut, annee, numero, seq?.largeur ?? 6),
  };
}
