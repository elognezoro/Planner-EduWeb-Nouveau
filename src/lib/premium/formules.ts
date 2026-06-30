// Référentiel des formules d'abonnement Académie Premium (cahier partie 7).
// Tarifs annuels en FCFA selon l'effectif de l'établissement.

export type FormuleId = "petit" | "grand";

export interface Formule {
  id: FormuleId;
  libelle: string;
  detail: string;
  fcfa: number;
  populaire: boolean;
}

export const FORMULES: Record<FormuleId, Formule> = {
  petit: { id: "petit", libelle: "Petit établissement", detail: "Moins de 800 élèves", fcfa: 300000, populaire: false },
  grand: { id: "grand", libelle: "Grand établissement", detail: "800 élèves et plus", fcfa: 500000, populaire: true },
};

/** Alertes SMS : tarif par élève et par année scolaire. */
export const SMS_FCFA_PAR_ELEVE = 2000;

/** Taux de conversion indicatif FCFA → EUR (parité fixe XOF). */
const TAUX_EUR = 655.957;

export function fcfaVersEur(fcfa: number): number {
  return Math.round((fcfa / TAUX_EUR) * 100) / 100;
}

export function formaterFcfa(n: number): string {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

export function formaterEur(fcfa: number): string {
  return `${fcfaVersEur(fcfa).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

/** Moyens de paiement proposés (carte + Mobile Money ivoiriens). */
export const MOYENS_PAIEMENT = [
  { id: "carte", libelle: "Carte bancaire", detail: "Visa, Mastercard" },
  { id: "wave", libelle: "Wave", detail: "Mobile Money" },
  { id: "orange", libelle: "Orange Money", detail: "Mobile Money" },
  { id: "mtn", libelle: "MTN Money", detail: "Mobile Money" },
  { id: "moov", libelle: "Moov Money", detail: "Mobile Money" },
] as const;

export type ModePaiementId = (typeof MOYENS_PAIEMENT)[number]["id"];
