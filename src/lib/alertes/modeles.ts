/**
 * Modèles d'alertes — partie PURE (client-safe : PAS de "server-only", importable par l'UI).
 * Le moteur serveur (src/lib/alertes/moteur.ts) réutilise ces définitions.
 */

export interface ParametrageAlertes {
  seuilAbsences: number;
  seuilRetards: number;
  seuilNote: number;
  canalSms: boolean;
  canalEmail: boolean;
  canalInApp: boolean;
  canalWhatsApp: boolean;
  modeleAbsence: string;
  modeleRetard: string;
  modeleNotes: string;
  telEtablissement: string | null;
}

/** Valeurs par défaut (miroir des @default du modèle Prisma) quand aucun paramétrage n'existe. */
export const PARAMETRAGE_DEFAUT: ParametrageAlertes = {
  seuilAbsences: 3,
  seuilRetards: 5,
  seuilNote: 0,
  canalSms: true,
  canalEmail: false,
  canalInApp: false,
  canalWhatsApp: false,
  modeleAbsence: "EduWeb Planner — {CLASSE} : votre enfant {PRENOM} totalise {NB} absence(s) non justifiée(s). Merci de régulariser auprès de l'établissement.",
  modeleRetard: "EduWeb Planner — {CLASSE} : {PRENOM} cumule {NB} retard(s) non justifié(s). Merci d'y veiller.",
  modeleNotes: "EduWeb Planner — {CLASSE} : la moyenne de {PRENOM} est de {NB}/20. Un accompagnement est conseillé.",
  telEtablissement: null,
};

/** Variables de fusion reconnues dans les modèles (affichées dans l'aide de l'UI). */
export const VARIABLES_MODELE = [
  { jeton: "{PRENOM}", desc: "Prénom de l'élève" },
  { jeton: "{NOM_PARENT}", desc: "Nom du parent destinataire" },
  { jeton: "{CLASSE}", desc: "Classe de l'élève" },
  { jeton: "{NB}", desc: "Nombre (absences, retards) ou moyenne" },
  { jeton: "{TEL_ETAB}", desc: "Téléphone de l'établissement" },
] as const;

/** Remplace les variables de fusion d'un modèle par leurs valeurs. */
export function fusionnerModele(
  modele: string,
  vars: { prenom?: string; nomParent?: string; classe?: string; nb?: string | number; telEtab?: string | null },
): string {
  return modele
    .replaceAll("{PRENOM}", vars.prenom ?? "")
    .replaceAll("{NOM_PARENT}", vars.nomParent ?? "")
    .replaceAll("{CLASSE}", vars.classe ?? "")
    .replaceAll("{NB}", String(vars.nb ?? ""))
    .replaceAll("{TEL_ETAB}", vars.telEtab ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
