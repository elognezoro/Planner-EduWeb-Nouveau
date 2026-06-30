/**
 * Solveur d'emplois du temps — backtracking avec heuristiques (cahier §5.3.0).
 *
 * TypeScript pur, sans dépendance externe. Respecte STRICTEMENT les contraintes dures ;
 * en cas de sur-contrainte, n'invente pas de planning partiel : il renvoie les points de
 * blocage explicites. Les contraintes souples sont traitées au mieux (ordre des candidats).
 */

export interface SalleSolveur {
  nom: string;
  capacite: number;
  type: string; // ordinaire | laboratoire | salle_informatique | ...
}

export interface BlocCours {
  id: string;
  classeId: string;
  classeNom: string;
  effectif: number;
  /** Groupe de vacation : null = simple ; 0/1 = double vacation (matin/après-midi). */
  vacationGroupe: 0 | 1 | null;
  disciplineId: string;
  disciplineNom: string;
  enseignantId: string;
  enseignantNom: string;
  /** Durée en nombre de créneaux (1 = 60 min, 2 = 120 min). */
  duree: number;
  /** Type de salle requis (ex : salle_informatique), ou null si indifférent. */
  salleTypeRequis: string | null;
}

export interface Probleme {
  joursOuvres: number;
  periodesParJour: number;
  salles: SalleSolveur[];
  blocs: BlocCours[];
  /** Si false, on ignore la compatibilité de type de salle (cas « nombre de salles » sans détail). */
  appliquerTypeSalle: boolean;
}

export interface Placement {
  blocId: string;
  classeId: string;
  classeNom: string;
  disciplineId: string;
  disciplineNom: string;
  enseignantId: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
  duree: number;
}

export interface Resultat {
  ok: boolean;
  placements: Placement[];
  blocages: string[];
  stats: { blocs: number; places: number; etapes: number };
}

const LIMITE_ETAPES = 300_000;

function typeCompatible(p: Probleme, bloc: BlocCours, salle: SalleSolveur): boolean {
  if (salle.capacite < bloc.effectif) return false;
  if (!p.appliquerTypeSalle) return true;
  if (!bloc.salleTypeRequis) return true;
  return salle.type === bloc.salleTypeRequis;
}

/** Bornes de périodes autorisées selon la vacation (double = demi-journée). */
function bornesPeriodes(p: Probleme, groupe: 0 | 1 | null): [number, number] {
  if (groupe === null) return [0, p.periodesParJour - 1];
  const moitie = Math.floor(p.periodesParJour / 2);
  return groupe === 0 ? [0, moitie - 1] : [moitie, p.periodesParJour - 1];
}

export function resoudre(p: Probleme): Resultat {
  const blocages: string[] = [];

  // ── Pré-vérifications (messages de blocage actionnables) ──
  const sallesCompatibles = new Map<string, SalleSolveur[]>();
  for (const bloc of p.blocs) {
    const compat = p.salles.filter((s) => typeCompatible(p, bloc, s));
    sallesCompatibles.set(bloc.id, compat);
    if (compat.length === 0) {
      const msg = bloc.salleTypeRequis
        ? `Aucune salle compatible (type « ${bloc.salleTypeRequis} », capacité ≥ ${bloc.effectif}) pour ${bloc.disciplineNom} – ${bloc.classeNom}.`
        : `Aucune salle de capacité ≥ ${bloc.effectif} pour ${bloc.disciplineNom} – ${bloc.classeNom}.`;
      if (!blocages.includes(msg)) blocages.push(msg);
    }
  }

  // Capacité globale : demande (créneaux) vs offre (jours × périodes × salles).
  const demande = p.blocs.reduce((a, b) => a + b.duree, 0);
  const offre = p.joursOuvres * p.periodesParJour * p.salles.length;
  if (offre > 0 && demande > offre) {
    blocages.push(
      `Volume total trop élevé : ${demande} créneaux-séances demandés pour seulement ${offre} créneaux-salles disponibles. Ajoutez des salles ou réduisez les volumes.`,
    );
  }

  // Par classe : somme des durées ≤ créneaux de la semaine (selon vacation).
  const parClasse = new Map<string, { duree: number; nom: string; groupe: 0 | 1 | null }>();
  for (const b of p.blocs) {
    const e = parClasse.get(b.classeId) ?? { duree: 0, nom: b.classeNom, groupe: b.vacationGroupe };
    e.duree += b.duree;
    parClasse.set(b.classeId, e);
  }
  for (const [, info] of parClasse) {
    const [deb, fin] = bornesPeriodes(p, info.groupe);
    const dispo = p.joursOuvres * (fin - deb + 1);
    if (info.duree > dispo) {
      blocages.push(
        `${info.nom} : ${info.duree} créneaux à placer pour seulement ${dispo} créneaux disponibles dans la semaine. Réduisez le volume horaire de cette classe.`,
      );
    }
  }

  if (blocages.length > 0) {
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: 0, etapes: 0 } };
  }

  // ── Heuristique : traiter d'abord les blocs les plus contraints ──
  const ordre = [...p.blocs].sort((a, b) => {
    const ra = sallesCompatibles.get(a.id)!.length;
    const rb = sallesCompatibles.get(b.id)!.length;
    if (ra !== rb) return ra - rb; // moins de salles compatibles = plus contraint
    if (b.duree !== a.duree) return b.duree - a.duree; // séances longues d'abord
    const va = a.vacationGroupe !== null ? 0 : 1;
    const vb = b.vacationGroupe !== null ? 0 : 1;
    return va - vb; // double vacation d'abord
  });

  const occT = new Set<string>();
  const occC = new Set<string>();
  const occR = new Set<string>();
  const placements: Placement[] = [];
  let etapes = 0;

  function libre(bloc: BlocCours, jour: number, periode: number, salleNom: string): boolean {
    for (let d = 0; d < bloc.duree; d++) {
      const pp = periode + d;
      if (occT.has(`${bloc.enseignantId}:${jour}:${pp}`)) return false;
      if (occC.has(`${bloc.classeId}:${jour}:${pp}`)) return false;
      if (occR.has(`${salleNom}:${jour}:${pp}`)) return false;
    }
    return true;
  }
  function poser(bloc: BlocCours, jour: number, periode: number, salleNom: string, set: boolean) {
    for (let d = 0; d < bloc.duree; d++) {
      const pp = periode + d;
      const op = set ? "add" : "delete";
      occT[op](`${bloc.enseignantId}:${jour}:${pp}`);
      occC[op](`${bloc.classeId}:${jour}:${pp}`);
      occR[op](`${salleNom}:${jour}:${pp}`);
    }
  }

  function placer(i: number): boolean {
    if (i >= ordre.length) return true;
    if (++etapes > LIMITE_ETAPES) return false;
    const bloc = ordre[i];
    const [deb, fin] = bornesPeriodes(p, bloc.vacationGroupe);
    const compat = sallesCompatibles.get(bloc.id)!;

    // Compte des séances déjà posées par jour pour cette classe → favorise l'étalement (souple).
    const sessionsJour = new Array(p.joursOuvres).fill(0);
    for (const pl of placements) {
      if (pl.classeId === bloc.classeId) sessionsJour[pl.jour]++;
    }
    const jours = [...Array(p.joursOuvres).keys()].sort((x, y) => sessionsJour[x] - sessionsJour[y]);

    for (const jour of jours) {
      for (let periode = deb; periode + bloc.duree - 1 <= fin; periode++) {
        for (const salle of compat) {
          if (!libre(bloc, jour, periode, salle.nom)) continue;
          poser(bloc, jour, periode, salle.nom, true);
          placements.push({
            blocId: bloc.id,
            classeId: bloc.classeId,
            classeNom: bloc.classeNom,
            disciplineId: bloc.disciplineId,
            disciplineNom: bloc.disciplineNom,
            enseignantId: bloc.enseignantId,
            enseignantNom: bloc.enseignantNom,
            salleNom: salle.nom,
            jour,
            periode,
            duree: bloc.duree,
          });
          if (placer(i + 1)) return true;
          placements.pop();
          poser(bloc, jour, periode, salle.nom, false);
        }
      }
    }
    return false;
  }

  const succes = placer(0);

  if (!succes) {
    const restant = ordre[placements.length];
    if (etapes > LIMITE_ETAPES) {
      blocages.push(
        "La génération est trop complexe pour aboutir automatiquement dans le temps imparti. Réduisez les contraintes (volumes, double vacation) ou ajoutez des ressources.",
      );
    } else if (restant) {
      blocages.push(
        `Impossible de placer ${restant.disciplineNom} – ${restant.classeNom} sans violer une contrainte dure (enseignant, classe ou salle déjà occupés sur tous les créneaux possibles).`,
      );
    } else {
      blocages.push("Aucune solution complète n'a pu être trouvée avec les contraintes actuelles.");
    }
    return {
      ok: false,
      placements: [],
      blocages,
      stats: { blocs: p.blocs.length, places: placements.length, etapes },
    };
  }

  return {
    ok: true,
    placements: [...placements],
    blocages: [],
    stats: { blocs: p.blocs.length, places: placements.length, etapes },
  };
}
