export interface FraisVue { id: string; libelle: string; montant: number; niveauId: string | null; niveauNom: string | null; obligatoire: boolean; actif: boolean; tranches: { libelle: string; montant: number; dateLimite?: string }[] }
export interface EleveVue { id: string; nom: string; classe: string | null; matricule: string | null }
export interface PaiementVue { id: string; numeroRecu: number; eleveId: string; eleveNom: string; classe: string | null; libelle: string; montant: number; mode: string; reference: string | null; date: string; annule: boolean; motifAnnulation: string | null }
export interface RemiseVue { id: string; eleveId: string; eleveNom: string; type: string; libelle: string; montant: number | null; pourcentage: number | null }
export interface ImpayeVue { eleveId: string; eleveNom: string; classe: string | null; du: number; remise: number; paye: number; reste: number }
export interface OperationVue { id: string; sens: string; categorie: string; libelle: string; montant: number; mode: string; reference: string | null; date: string; annule: boolean }
export interface ArticleVue { id: string; nom: string; categorie: string | null; prixVente: number; prixAchat: number | null; stock: number; seuilAlerte: number; actif: boolean }
export interface MouvementVue { id: string; articleNom: string; type: string; quantite: number; montant: number | null; mode: string | null; acheteur: string | null; date: string }
export const LIBELLE_MODE: Record<string, string> = { especes: "Espèces", mobile_money: "Mobile Money", cheque: "Chèque", virement: "Virement" };
export const fcfa = (n: number) => n.toLocaleString("fr-FR") + " F";
