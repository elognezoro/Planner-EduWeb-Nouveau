/**
 * Pays de rattachement des GRILLES HORAIRES nationales d'un établissement.
 *
 * Normalisation UNIQUE, partagée entre le calcul d'avancement de configuration et la
 * génération d'emploi du temps : un pays vide ou fait d'espaces retombe sur le pays par
 * défaut, et les espaces parasites sont rognés — sinon le verdict « volumes couverts par
 * le modèle national » de la page d'avancement ne serait pas reproductible à la génération.
 */
export function paysGrille(pays: string | null | undefined): string {
  return pays?.trim() || "Côte d'Ivoire";
}
