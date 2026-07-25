import "server-only";

/** Validateurs partagés des actions financières (bornage serveur systématique, cf. 02B). */

export const MODES_PAIEMENT = new Set(["especes", "mobile_money", "cheque", "virement"]);

export function montantValide(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 ? n : null;
}

export function modeValide(v: FormDataEntryValue | null): string {
  const m = String(v ?? "").trim();
  return MODES_PAIEMENT.has(m) ? m : "especes";
}

export function dateValide(v: FormDataEntryValue | null): Date {
  const s = String(v ?? "").trim();
  const d = s ? new Date(s) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Date FACULTATIVE : null si champ vide ou illisible (jamais de date inventée). */
export function dateFacultative(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Pourcentage entier 1..100, sinon null. */
export function pourcentageValide(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
}

export function texteCourt(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}
