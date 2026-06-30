/**
 * Solveur d'emplois du temps — backtracking avec heuristiques (cahier §5.3.0).
 *
 * Approche par COMPTEURS d'enseignants : les enseignants sont des unités anonymes regroupées
 * en « pools » par cycle + discipline (ex. 4 profs de Maths au collège). Le solveur choisit,
 * pour chaque séance, un créneau + une salle + une unité-enseignant du bon pool, sans jamais
 * violer les contraintes dures. En sur-contrainte, il renvoie des points de blocage explicites.
 */

export interface SalleSolveur {
  nom: string;
  capacite: number;
  type: string;
}

export interface EnseignantUnite {
  id: string;
  pool: string; // ex : "college:<disciplineId>"
  nom: string; // libellé affiché (ex : "Prof Mathématiques (collège) #2")
}

export interface BlocCours {
  id: string;
  classeId: string;
  classeNom: string;
  effectif: number;
  vacationGroupe: 0 | 1 | null;
  disciplineId: string;
  disciplineNom: string;
  /** Pool d'enseignants requis (cycle:disciplineId). */
  enseignantPool: string;
  /** Libellé lisible du pool, pour les messages de blocage (ex : "Mathématiques (collège)"). */
  poolLabel: string;
  duree: number;
  salleTypeRequis: string | null;
}

export interface Probleme {
  joursOuvres: number;
  periodesParJour: number;
  salles: SalleSolveur[];
  enseignants: EnseignantUnite[];
  blocs: BlocCours[];
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

const LIMITE_ETAPES = 400_000;

function typeCompatible(p: Probleme, bloc: BlocCours, salle: SalleSolveur): boolean {
  if (salle.capacite < bloc.effectif) return false;
  if (!p.appliquerTypeSalle) return true;
  if (!bloc.salleTypeRequis) return true;
  return salle.type === bloc.salleTypeRequis;
}

function bornesPeriodes(p: Probleme, groupe: 0 | 1 | null): [number, number] {
  if (groupe === null) return [0, p.periodesParJour - 1];
  const moitie = Math.floor(p.periodesParJour / 2);
  return groupe === 0 ? [0, moitie - 1] : [moitie, p.periodesParJour - 1];
}

export function resoudre(p: Probleme): Resultat {
  const blocages: string[] = [];

  const unitesParPool = new Map<string, EnseignantUnite[]>();
  for (const u of p.enseignants) {
    const arr = unitesParPool.get(u.pool) ?? [];
    arr.push(u);
    unitesParPool.set(u.pool, arr);
  }

  // ── Pré-vérifications ──
  const sallesCompatibles = new Map<string, SalleSolveur[]>();
  const poolsVus = new Set<string>();
  for (const bloc of p.blocs) {
    const compat = p.salles.filter((s) => typeCompatible(p, bloc, s));
    sallesCompatibles.set(bloc.id, compat);
    if (compat.length === 0) {
      const msg = bloc.salleTypeRequis
        ? `Aucune salle compatible (type « ${bloc.salleTypeRequis} », capacité ≥ ${bloc.effectif}) pour ${bloc.disciplineNom} – ${bloc.classeNom}.`
        : `Aucune salle de capacité ≥ ${bloc.effectif} pour ${bloc.disciplineNom} – ${bloc.classeNom}.`;
      if (!blocages.includes(msg)) blocages.push(msg);
    }
    if (!poolsVus.has(bloc.enseignantPool)) {
      poolsVus.add(bloc.enseignantPool);
      if ((unitesParPool.get(bloc.enseignantPool)?.length ?? 0) === 0) {
        blocages.push(`Aucun enseignant déclaré pour ${bloc.poolLabel}. Renseignez les effectifs enseignants.`);
      }
    }
  }

  // Capacité globale salles.
  const demande = p.blocs.reduce((a, b) => a + b.duree, 0);
  const offreSalles = p.joursOuvres * p.periodesParJour * p.salles.length;
  if (offreSalles > 0 && demande > offreSalles) {
    blocages.push(`Volume total trop élevé : ${demande} créneaux-séances pour ${offreSalles} créneaux-salles. Ajoutez des salles ou réduisez les volumes.`);
  }

  // Capacité par pool d'enseignants.
  const demandeParPool = new Map<string, { duree: number; label: string }>();
  for (const b of p.blocs) {
    const e = demandeParPool.get(b.enseignantPool) ?? { duree: 0, label: b.poolLabel };
    e.duree += b.duree;
    demandeParPool.set(b.enseignantPool, e);
  }
  for (const [pool, info] of demandeParPool) {
    const n = unitesParPool.get(pool)?.length ?? 0;
    const offre = n * p.joursOuvres * p.periodesParJour;
    if (n > 0 && info.duree > offre) {
      const manque = Math.ceil(info.duree / (p.joursOuvres * p.periodesParJour)) - n;
      blocages.push(`Pas assez d'enseignants pour ${info.label} : ${info.duree} créneaux à couvrir, ${n} enseignant(s) déclaré(s) (ajoutez ~${manque}).`);
    }
  }

  // Capacité par classe.
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
      blocages.push(`${info.nom} : ${info.duree} créneaux à placer pour ${dispo} disponibles dans la semaine. Réduisez le volume horaire.`);
    }
  }

  if (blocages.length > 0) {
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: 0, etapes: 0 } };
  }

  // ── Heuristique : blocs les plus contraints d'abord ──
  const ordre = [...p.blocs].sort((a, b) => {
    const ra = sallesCompatibles.get(a.id)!.length;
    const rb = sallesCompatibles.get(b.id)!.length;
    if (ra !== rb) return ra - rb;
    const na = unitesParPool.get(a.enseignantPool)!.length;
    const nb = unitesParPool.get(b.enseignantPool)!.length;
    if (na !== nb) return na - nb;
    if (b.duree !== a.duree) return b.duree - a.duree;
    return (a.vacationGroupe !== null ? 0 : 1) - (b.vacationGroupe !== null ? 0 : 1);
  });

  const occT = new Set<string>(); // unitéEnseignant occupée
  const occC = new Set<string>(); // classe occupée
  const occR = new Set<string>(); // salle occupée
  const placements: Placement[] = [];
  let etapes = 0;

  function creneauLibre(jour: number, periode: number, duree: number, classeId: string, salleNom: string, uniteId: string): boolean {
    for (let d = 0; d < duree; d++) {
      const pp = periode + d;
      if (occC.has(`${classeId}:${jour}:${pp}`)) return false;
      if (occR.has(`${salleNom}:${jour}:${pp}`)) return false;
      if (occT.has(`${uniteId}:${jour}:${pp}`)) return false;
    }
    return true;
  }
  function basculer(jour: number, periode: number, duree: number, classeId: string, salleNom: string, uniteId: string, set: boolean) {
    const op = set ? "add" : "delete";
    for (let d = 0; d < duree; d++) {
      const pp = periode + d;
      occC[op](`${classeId}:${jour}:${pp}`);
      occR[op](`${salleNom}:${jour}:${pp}`);
      occT[op](`${uniteId}:${jour}:${pp}`);
    }
  }

  function placer(i: number): boolean {
    if (i >= ordre.length) return true;
    if (++etapes > LIMITE_ETAPES) return false;
    const bloc = ordre[i];
    const [deb, fin] = bornesPeriodes(p, bloc.vacationGroupe);
    const compat = sallesCompatibles.get(bloc.id)!;
    const unites = unitesParPool.get(bloc.enseignantPool)!;

    // Étalement (souple) : jours où la classe a le moins de séances d'abord.
    const sessionsJour = new Array(p.joursOuvres).fill(0);
    for (const pl of placements) if (pl.classeId === bloc.classeId) sessionsJour[pl.jour]++;
    const jours = [...Array(p.joursOuvres).keys()].sort((x, y) => sessionsJour[x] - sessionsJour[y]);

    for (const jour of jours) {
      for (let periode = deb; periode + bloc.duree - 1 <= fin; periode++) {
        for (const salle of compat) {
          for (const unite of unites) {
            if (!creneauLibre(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id)) continue;
            basculer(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id, true);
            placements.push({
              blocId: bloc.id,
              classeId: bloc.classeId,
              classeNom: bloc.classeNom,
              disciplineId: bloc.disciplineId,
              disciplineNom: bloc.disciplineNom,
              enseignantId: unite.id,
              enseignantNom: unite.nom,
              salleNom: salle.nom,
              jour,
              periode,
              duree: bloc.duree,
            });
            if (placer(i + 1)) return true;
            placements.pop();
            basculer(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id, false);
          }
        }
      }
    }
    return false;
  }

  const succes = placer(0);

  if (!succes) {
    const restant = ordre[placements.length];
    if (etapes > LIMITE_ETAPES) {
      blocages.push("Génération trop complexe pour aboutir dans le temps imparti. Réduisez les contraintes (volumes, double vacation) ou ajoutez des ressources (salles, enseignants).");
    } else if (restant) {
      blocages.push(`Impossible de placer ${restant.disciplineNom} – ${restant.classeNom} sans conflit (enseignant, classe ou salle occupés sur tous les créneaux possibles).`);
    } else {
      blocages.push("Aucune solution complète n'a pu être trouvée avec les contraintes actuelles.");
    }
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: placements.length, etapes } };
  }

  return { ok: true, placements: [...placements], blocages: [], stats: { blocs: p.blocs.length, places: placements.length, etapes } };
}
