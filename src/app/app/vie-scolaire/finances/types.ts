// `version` (RM-019) : verrouillage optimiste — transmise en champ caché par les formulaires de modification/annulation.
export interface FraisVue {
  id: string; libelle: string; montant: number; niveauId: string | null; niveauNom: string | null;
  obligatoire: boolean; actif: boolean; tranches: { libelle: string; montant: number; dateLimite?: string }[]; version: number;
  // Paramétrage enrichi (06-Scolarite)
  code: string | null; description: string | null; categorieId: string | null; serie: string | null;
  cycle: string | null; statutEleve: string | null; dateDebut: string | null; dateFin: string | null; modeCalcul: string;
}
export interface EleveVue { id: string; nom: string; classe: string | null; matricule: string | null }
export interface PaiementVue { id: string; numeroRecu: number; eleveId: string; eleveNom: string; classe: string | null; libelle: string; montant: number; mode: string; reference: string | null; date: string; annule: boolean; motifAnnulation: string | null; pointeLe: string | null; version: number }
export interface RemiseVue { id: string; eleveId: string; eleveNom: string; type: string; libelle: string; montant: number | null; pourcentage: number | null }
export interface ImpayeVue { eleveId: string; eleveNom: string; classe: string | null; du: number; remise: number; paye: number; reste: number }
export interface OperationVue { id: string; sens: string; categorie: string; libelle: string; montant: number; mode: string; reference: string | null; date: string; annule: boolean; pointeLe: string | null; version: number }
export interface ArticleVue { id: string; nom: string; categorie: string | null; prixVente: number; prixAchat: number | null; stock: number; seuilAlerte: number; actif: boolean; version: number }
export interface MouvementVue { id: string; articleNom: string; type: string; quantite: number; montant: number | null; mode: string | null; acheteur: string | null; date: string }
export interface ReleveVue { mois: string; solde: number }
export interface BudgetVue { categorie: string; sens: string; montantPrevu: number }
export interface RealiseVue { categorie: string; sens: string; total: number }
export interface ClotureVue { id: string; exercice: string; finPeriode: string; resultat: number; soldes: { compte: string; libelle: string; solde: number }[]; notes: string | null }
export const LIBELLE_MODE: Record<string, string> = { especes: "Espèces", mobile_money: "Mobile Money", cheque: "Chèque", virement: "Virement", carte: "Carte bancaire" };
export const LIBELLE_FOURNISSEUR_MOBILE: Record<string, string> = { orange: "Orange Money", mtn: "MTN Mobile Money", moov: "Moov Money", wave: "Wave", autre: "Autre fournisseur" };
export const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";
