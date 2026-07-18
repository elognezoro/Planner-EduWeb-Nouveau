/**
 * Construction du problème d'emploi du temps (entités établissement → `Probleme` du solveur).
 *
 * Fonction PURE extraite de l'action serveur `genererEmploiDuTemps` : mêmes entrées (données déjà
 * chargées) → même `Probleme`. Cela permet de la réutiliser (diagnostic, tests) sans dupliquer la
 * logique métier (pools d'enseignants, décomposition des couples, plages EPS, groupes de vacation,
 * levée de vacation le jour d'EPS, plages sans cours, synthèse des salles).
 */

import type { Etablissement } from "@prisma/client";
import type { BlocCours, SalleSolveur, Probleme, EnseignantUnite } from "@/lib/solveur";
import { periodesParBloc, periodesDansPlages, periodesMatinApresMidi } from "@/lib/emploi-du-temps/horaires";
import { deriveCategoriePedagogique, estPrimaireOuPrescolaire } from "@/lib/referentiels/etablissement";

export const CYCLE_LABEL: Record<string, string> = {
  college: "collège",
  lycee: "lycée",
  primaire: "primaire",
  prescolaire: "préscolaire",
};

// Disciplines nécessitant un type de salle spécifique (cahier §5.3.0-c).
// La clé est le nom de la discipline ; la valeur, le `type` de salle requis (enum TypeSalle).
export const TYPE_SALLE_REQUIS: Record<string, string> = {
  Informatique: "salle_informatique",
  EPS: "salle_eps", // Éducation physique : sur un plateau sportif, jamais en salle de classe.
};

// Libellé générique d'une salle synthétisée selon son type.
export const NOM_SALLE_TYPE: Record<string, string> = {
  salle_informatique: "Salle informatique",
  salle_eps: "Plateau sportif",
  laboratoire: "Laboratoire",
  atelier: "Atelier",
  ordinaire: "Salle",
};

export interface ClasseInput {
  id: string;
  nom: string;
  effectif: number;
  regimeVacation: string;
  niveau: { id: string; nom: string; cycle: string };
}
export interface SalleInput {
  nom: string;
  capacite: number;
  type: string;
}
export interface GrilleInput {
  niveauId: string;
  disciplineId: string;
  etablissementId: string | null;
  seancesMinutes: number[];
  heuresHebdo: number;
  discipline: { id: string; nom: string };
}
export interface EffectifInput {
  cycle: string;
  disciplineId: string;
  nombre: number;
  discipline: { nom: string };
}
export interface EnseignantReelInput {
  id: string;
  prenoms: string | null;
  nom: string | null;
  email: string;
  competences: { disciplineId: string }[];
  niveauxIntervention: { niveau: { cycle: string } }[];
}

export interface ConstruireProblemeInput {
  etab: Etablissement;
  etablissementId: string;
  classes: ClasseInput[];
  sallesDb: SalleInput[];
  grilles: GrilleInput[];
  effectifs: EffectifInput[];
  enseignantsReels: EnseignantReelInput[];
  /** Table de décomposition des couples de spécialités (discipline → ids couverts). */
  couvre: Map<string, string[]>;
}

export function construireProbleme(input: ConstruireProblemeInput): Probleme {
  const { etab, etablissementId: id, classes, sallesDb, grilles, effectifs, enseignantsReels, couvre } = input;

  // Grille effective par (niveau, discipline) : surcharge établissement prioritaire.
  const grilleEtab = new Map<string, { seances: number[]; disc: { id: string; nom: string } }>();
  const grilleNat = new Map<string, { heures: number; disc: { id: string; nom: string } }>();
  const niveauxAvecOverride = new Set<string>();
  for (const g of grilles) {
    const cle = `${g.niveauId}:${g.disciplineId}`;
    if (g.etablissementId === id) {
      grilleEtab.set(cle, { seances: g.seancesMinutes, disc: g.discipline });
      if (g.seancesMinutes.length > 0) niveauxAvecOverride.add(g.niveauId);
    } else {
      grilleNat.set(cle, { heures: g.heuresHebdo, disc: g.discipline });
    }
  }

  // Unités-enseignants par pool (cycle:disciplineId).
  // On privilégie les VRAIS comptes enseignants (compétence = discipline, niveaux → cycle) afin
  // que l'emploi du temps affiche leurs noms. À défaut, on retombe sur des unités anonymes issues
  // des effectifs déclarés (compatibilité : pas besoin de comptes nominatifs pour générer).
  // Les couples de spécialités sont décomposés : un bivalent « X / Y » alimente les pools de X
  // ET de Y avec la MÊME unité (id partagé) — le solveur garantit par l'id qu'il n'enseigne
  // qu'à un endroit à la fois.
  const unitesParPool = new Map<string, EnseignantUnite[]>();
  // Cycles couverts par chaque unité (id → {college?, lycee?}), pour le plafond de service.
  const cyclesParUnite = new Map<string, Set<string>>();
  const ajouterUnite = (pool: string, uid: string, nom: string) => {
    const arr = unitesParPool.get(pool) ?? [];
    if (!arr.some((u) => u.id === uid)) arr.push({ id: uid, pool, nom });
    unitesParPool.set(pool, arr);
    const cy = cyclesParUnite.get(uid) ?? new Set<string>();
    cy.add(pool.slice(0, pool.indexOf(":")));
    cyclesParUnite.set(uid, cy);
  };

  // Disciplines à salle SPÉCIALISÉE (EPS, informatique, labo…) : leurs enseignants restent propres
  // à leur cycle. Le partage inter-cycles ne s'applique qu'aux disciplines à salle ordinaire — un
  // sous-problème comme l'EPS (plateaux + fenêtre horaire) est déjà tendu et sans intérêt à coupler.
  const disciplineSpecialisee = new Set<string>();
  for (const g of grilles) if (TYPE_SALLE_REQUIS[g.discipline.nom]) disciplineSpecialisee.add(g.disciplineId);
  // Un enseignant du 2nd cycle est compétent sur les DEUX cycles pour une discipline donnée
  // (sauf spécialisée) : il alimente aussi le pool collège de cette discipline.
  const bicycle = (dId: string, secondCycle: boolean) => secondCycle && !disciplineSpecialisee.has(dId);

  const poolsReels = new Set<string>();
  for (const t of enseignantsReels) {
    const cyclesBase = new Set(t.niveauxIntervention.map((n) => n.niveau.cycle));
    const secondCycle = cyclesBase.has("lycee");
    const nom = [t.prenoms, t.nom].filter(Boolean).join(" ") || t.email;
    for (const comp of t.competences) {
      for (const dId of couvre.get(comp.disciplineId) ?? [comp.disciplineId]) {
        const cycles = new Set(cyclesBase);
        if (bicycle(dId, secondCycle)) cycles.add("college"); // 2nd cycle → aussi collège
        for (const cycle of cycles) {
          const pool = `${cycle}:${dId}`;
          ajouterUnite(pool, t.id, nom);
          poolsReels.add(pool);
        }
      }
    }
  }

  // Préscolaire/primaire : pas de distinction 1er/2nd cycle (maîtres polyvalents) — l'intrant
  // « Effectifs des enseignants par cycle et spécialité » (plafonds anonymes par discipline)
  // est SANS OBJET et ignoré par le solveur pour ces catégories (le bloc reste désactivé côté
  // configuration ; ce garde-fou couvre aussi les données historiques laissées par un
  // changement de catégorie). Les VRAIS comptes enseignants (boucle ci-dessus) ne sont pas
  // concernés : un maître polyvalent reste affecté via ses compétences + niveaux d'intervention.
  const categorie = etab.categoriePedagogique ?? deriveCategoriePedagogique(etab.type);
  if (!estPrimaireOuPrescolaire(categorie)) {
    for (const ef of effectifs) {
      if (ef.nombre <= 0) continue;
      const lib = CYCLE_LABEL[ef.cycle] ?? ef.cycle;
      const secondCycle = ef.cycle === "lycee";
      for (const dId of couvre.get(ef.disciplineId) ?? [ef.disciplineId]) {
        // Un effectif « 2nd cycle » alimente AUSSI le collège (même unité, id partagé → charge totale
        // cumulée sur les deux cycles, plafonnée au volume 2nd cycle). Un effectif « 1er cycle » reste
        // confiné au collège. Les disciplines spécialisées ne se partagent pas entre cycles.
        const cyclesEff = bicycle(dId, secondCycle) ? ["lycee", "college"] : [ef.cycle];
        for (const cyc of cyclesEff) {
          const pool = `${cyc}:${dId}`;
          // Des comptes réels couvrent déjà ce pool : ils priment sur les unités anonymes.
          if (poolsReels.has(pool)) continue;
          for (let k = 1; k <= ef.nombre; k++) {
            ajouterUnite(pool, `${ef.cycle}:${ef.disciplineId}#${k}`, `${ef.discipline.nom} (${lib}) #${k}`);
          }
        }
      }
    }
  }

  const enseignants: EnseignantUnite[] = [...unitesParPool.values()].flat();

  // Plafond de service hebdomadaire par unité (volume horaire dû) : un enseignant qui intervient
  // au 2nd cycle (compétence sur les deux cycles) relève du volume 2nd cycle ; celui qui n'intervient
  // qu'au 1er cycle relève du volume 1er cycle. 0 = non plafonné (l'unité n'entre pas dans la table).
  const vol1 = Math.max(0, etab.volumeHoraire1erCycle ?? 0);
  const vol2 = Math.max(0, etab.volumeHoraire2ndCycle ?? 0);
  let capaciteServiceParUnite: Map<string, number> | undefined;
  if (vol1 > 0 || vol2 > 0) {
    const m = new Map<string, number>();
    for (const [uid, cy] of cyclesParUnite) {
      const vol = cy.has("lycee") ? vol2 : vol1;
      if (vol > 0) m.set(uid, vol);
    }
    if (m.size > 0) capaciteServiceParUnite = m;
  }

  // Plages horaires d'EPS de l'établissement → indices de périodes autorisées pour l'EPS.
  // Null si aucune plage configurée : l'EPS reste libre sur toute la journée.
  const periodesEPS = periodesDansPlages(etab, [
    { debut: etab.epsMatinDebut, fin: etab.epsMatinFin },
    { debut: etab.epsApresMidiDebut, fin: etab.epsApresMidiFin },
  ]);

  // Conditions de vacation « X → double vacation : Non » (paramétrées par le chef) :
  // pour une classe en DOUBLE vacation, le jour où X (ex : EPS) est programmée devient
  // VACATION SIMPLE — la classe vient la journée entière ce jour-là, et les séances de X
  // y sont fixées. Le jour est réparti en tourniquet entre les classes concernées.
  const joursOuvres = 5;
  const normCond = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const conditionsBrutes = Array.isArray(etab.conditionsVacation)
    ? (etab.conditionsVacation as { libelle?: unknown; doubleVacation?: unknown }[])
    : [];
  const conditionsSimples = conditionsBrutes
    .filter((c) => c && c.doubleVacation === false && typeof c.libelle === "string")
    .map((c) => normCond(String(c.libelle)));
  const disciplinesVacationSimple = new Set<string>();
  if (conditionsSimples.length > 0) {
    for (const g of grilles) {
      const nomN = normCond(g.discipline.nom);
      if (nomN.length < 3) continue;
      // Correspondance par MOTS ENTIERS (« Cours d'EPS » ↔ « EPS ») — pas de sous-chaîne
      // libre (« Tice » ne matcherait pas « artice »). Les noms multi-mots (couples,
      // « Histoire-Géographie ») se comparent en sous-chaîne, peu ambigus.
      const multiMots = /[^a-z0-9]/.test(nomN);
      const correspond = conditionsSimples.some((cond) => {
        if (cond === nomN) return true;
        if (multiMots) return cond.includes(nomN);
        return cond.split(/[^a-z0-9]+/).includes(nomN);
      });
      if (correspond) disciplinesVacationSimple.add(g.disciplineId);
    }
  }
  let compteurJourSimple = 0;

  // ── EPS & double vacation ──
  // Règle métier : « quand il y a cours d'EPS, la double vacation n'est plus une contrainte
  // ce jour-là pour la classe concernée. » Outils pour décider, par classe, si l'EPS peut
  // tenir dans sa demi-journée de vacation ; si NON (plages d'EPS hors de sa demi-journée),
  // on lèvera automatiquement la vacation le jour d'EPS (la classe vient la journée entière).
  const periodesParJour = Math.max(1, etab.creneauxParJour);
  const blocsDecoupe = periodesParBloc(etab);
  const finBlocFit = new Array<number>(periodesParJour);
  {
    const dec =
      blocsDecoupe && blocsDecoupe.reduce((a, b) => a + b, 0) === periodesParJour
        ? blocsDecoupe
        : [periodesParJour];
    let deb = 0;
    for (const taille of dec) {
      const fin = deb + taille - 1;
      for (let i = deb; i <= fin && i < periodesParJour; i++) finBlocFit[i] = fin;
      deb += taille;
    }
    for (let i = 0; i < periodesParJour; i++) if (finBlocFit[i] == null) finBlocFit[i] = periodesParJour - 1;
  }
  const epsSet = periodesEPS ? new Set(periodesEPS) : null;
  // L'EPS tient-elle dans la demi-journée `groupe` (0 = matin, 1 = après-midi) ? Même
  // découpe que le solveur (Math.floor(N/2)) et mêmes frontières de pauses.
  const epsTientDansDemiJournee = (groupe: 0 | 1, duree: number): boolean => {
    const moitieH = Math.floor(periodesParJour / 2);
    const [deb, fin] = groupe === 0 ? [0, moitieH - 1] : [moitieH, periodesParJour - 1];
    for (let per = deb; per + duree - 1 <= fin; per++) {
      if (per + duree - 1 > finBlocFit[per]) continue; // ne traverse pas une pause
      if (epsSet) {
        let ok = true;
        for (let d = 0; d < duree; d++)
          if (!epsSet.has(per + d)) {
            ok = false;
            break;
          }
        if (!ok) continue;
      }
      return true;
    }
    return false;
  };

  // Plages SANS COURS de l'établissement (jour ou demi-journée) → créneaux fermés (jour:periode).
  // Calculées ICI, avant la boucle, car le choix du jour d'EPS doit les éviter.
  // Repli sur une moitié franche si les horaires ne séparent pas matin/après-midi (piège silencieux).
  const decoupeMA = periodesMatinApresMidi(etab);
  const moitie = Math.ceil(periodesParJour / 2);
  const matinIdx = decoupeMA?.matin ?? Array.from({ length: moitie }, (_, i) => i);
  const apmIdx = decoupeMA?.apresMidi ?? Array.from({ length: periodesParJour - moitie }, (_, i) => moitie + i);
  const plagesSC = Array.isArray(etab.plagesSansCours)
    ? (etab.plagesSansCours as { jour?: unknown; moment?: unknown }[])
    : [];
  const periodesFermees = new Set<string>();
  for (const pl of plagesSC) {
    const jour = Number(pl?.jour);
    if (!Number.isInteger(jour) || jour < 0 || jour >= joursOuvres) continue;
    const moment = String(pl?.moment ?? "");
    const cibles =
      moment === "journee"
        ? Array.from({ length: periodesParJour }, (_, i) => i)
        : moment === "matin"
          ? matinIdx
          : moment === "apresmidi"
            ? apmIdx
            : [];
    for (const per of cibles) periodesFermees.add(`${jour}:${per}`);
  }

  // L'EPS tient-elle dans la JOURNÉE COMPLÈTE de `jour` (plages EPS ouvertes, hors plages sans
  // cours) ? Sert à choisir un jour d'EPS réellement praticable (pas un pur tourniquet), pour
  // ne pas épingler l'EPS un jour où sa fenêtre serait fermée et transformer une configuration
  // soluble en échec.
  const epsFitJourneeComplete = (jour: number, duree: number): boolean => {
    for (let per = 0; per + duree - 1 <= periodesParJour - 1; per++) {
      if (per + duree - 1 > finBlocFit[per]) continue; // ne traverse pas une pause
      let ok = true;
      for (let d = 0; d < duree; d++) {
        if (periodesFermees.has(`${jour}:${per + d}`) || (epsSet && !epsSet.has(per + d))) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  };

  // Parité des indices de classes ayant cours le MATIN en double vacation (choix du chef) :
  // « impairs » (défaut) = classes 1, 3, 5… le matin ; « pairs » = classes 2, 4, 6… le matin.
  // (idx = position 0-based ⇒ indice pédagogique idx+1 ; idx pair ⇔ indice impair.)
  const pairsLeMatin = etab.doubleVacationMatin === "pairs";

  // Groupes de vacation : par niveau, on alterne les classes en double vacation.
  const compteurNiveau = new Map<string, number>();
  const blocs: BlocCours[] = [];

  for (const classe of classes) {
    const cycle = classe.niveau.cycle;
    const cycleLib = CYCLE_LABEL[cycle] ?? cycle;
    const disciplinesNiveau = new Map<string, { nom: string; seances: number[] }>();
    // Si l'établissement a sa propre grille pour ce niveau, on l'utilise EXCLUSIVEMENT
    // (on n'ajoute pas les disciplines du modèle national non configurées).
    if (niveauxAvecOverride.has(classe.niveau.id)) {
      for (const [k, v] of grilleEtab) {
        if (k.startsWith(`${classe.niveau.id}:`) && v.seances.length > 0) {
          disciplinesNiveau.set(v.disc.id, { nom: v.disc.nom, seances: v.seances });
        }
      }
    } else {
      for (const [k, v] of grilleNat) {
        if (k.startsWith(`${classe.niveau.id}:`) && v.heures > 0) {
          const nb = Math.max(1, Math.round(v.heures));
          // Séances unitaires de 55 minutes (modèle national ivoirien).
          disciplinesNiveau.set(v.disc.id, { nom: v.disc.nom, seances: Array.from({ length: nb }, () => 55) });
        }
      }
    }

    let vacationGroupe: 0 | 1 | null = null;
    if (classe.regimeVacation === "double") {
      const idx = compteurNiveau.get(classe.niveau.id) ?? 0;
      // Groupe 0 = matin, 1 = après-midi. La parité choisie par le chef va au matin.
      vacationGroupe = (pairsLeMatin ? 1 - (idx % 2) : idx % 2) as 0 | 1;
      compteurNiveau.set(classe.niveau.id, idx + 1);
    }

    // Disciplines à VACATION SIMPLE pour cette classe (le jour où elles ont lieu, la classe
    // vient la journée entière et la double vacation ne s'applique plus) :
    //  • celles configurées par le chef (« X → double vacation : Non ») ;
    //  • l'EPS AUTOMATIQUEMENT, si ses plages horaires ne tiennent pas dans la demi-journée
    //    de vacation de la classe — sinon l'EPS serait insoluble (plages hors de sa vacation).
    const dvSimpleClasse = new Set<string>();
    let epsDansSimple = false;
    let dureeEPSmax = 1;
    if (vacationGroupe !== null) {
      for (const dId of disciplinesNiveau.keys()) {
        if (disciplinesVacationSimple.has(dId)) dvSimpleClasse.add(dId);
      }
      for (const [dId, info] of disciplinesNiveau) {
        if (TYPE_SALLE_REQUIS[info.nom] !== "salle_eps") continue;
        const dureeEPS = Math.max(1, ...info.seances.map((m) => Math.max(1, Math.round(m / 60))));
        // EPS à vacation simple si le chef l'a explicitement demandé OU si ses plages ne
        // tiennent pas dans la demi-journée de vacation de la classe (sinon insoluble).
        if (disciplinesVacationSimple.has(dId) || !epsTientDansDemiJournee(vacationGroupe, dureeEPS)) {
          dvSimpleClasse.add(dId);
          epsDansSimple = true;
          dureeEPSmax = Math.max(dureeEPSmax, dureeEPS);
        }
      }
    }

    // Le jour d'EPS, la classe vient la JOURNÉE ENTIÈRE. Pour que la levée de double vacation soit
    // RÉELLE (et pas seulement « l'après-midi devient disponible mais reste vide »), l'EPS est
    // placée dans la demi-journée OPPOSÉE à la vacation de la classe : une classe du MATIN fait donc
    // l'EPS l'APRÈS-MIDI (et inversement) — elle couvre ainsi réellement les deux demi-journées ce
    // jour-là. Repli sur toute la fenêtre EPS si la demi-journée opposée ne peut pas accueillir la
    // séance (fenêtre EPS trop étroite ce jour-là pour la durée requise — ex. après-midi qui ne
    // tient qu'une période) : dans ce cas l'EPS reste dans sa demi-journée et la journée n'est pas
    // complète (il faut alors élargir la fenêtre EPS ou allonger la journée).
    let periodesEPSClasse = periodesEPS;
    if (vacationGroupe !== null && epsDansSimple && periodesEPS) {
      const demiOpposee = new Set(vacationGroupe === 0 ? apmIdx : matinIdx);
      const epsOpposee = periodesEPS.filter((p) => demiOpposee.has(p));
      const setOpp = new Set(epsOpposee);
      const tientDansOpposee = epsOpposee.some((s) => {
        for (let d = 0; d < dureeEPSmax; d++) if (!setOpp.has(s + d) || s + dureeEPSmax - 1 > finBlocFit[s]) return false;
        return true;
      });
      if (tientDansOpposee) periodesEPSClasse = epsOpposee;
    }

    // Jour de vacation simple de la classe : réparti en tourniquet, MAIS en sautant les jours où
    // l'EPS ne pourrait pas se poser (plages EPS fermées ce jour-là) — sinon on épinglerait
    // l'EPS un jour infaisable et on transformerait une configuration soluble en échec.
    let jourSimple: number | null = null;
    let vacationParJour: (0 | 1 | null)[] | undefined;
    if (vacationGroupe !== null && dvSimpleClasse.size > 0) {
      let choisi = -1;
      for (let k = 0; k < joursOuvres; k++) {
        const j = (compteurJourSimple + k) % joursOuvres;
        if (!epsDansSimple || epsFitJourneeComplete(j, dureeEPSmax)) {
          choisi = j;
          break;
        }
      }
      jourSimple = choisi >= 0 ? choisi : compteurJourSimple % joursOuvres;
      compteurJourSimple = jourSimple + 1; // le tourniquet reprend au jour suivant
      vacationParJour = Array.from({ length: joursOuvres }, (_, j) => (j === jourSimple ? null : vacationGroupe));
    }

    for (const [discId, info] of disciplinesNiveau) {
      info.seances.forEach((minutes, i) => {
        blocs.push({
          id: `${classe.id}:${discId}:${i}`,
          classeId: classe.id,
          classeNom: classe.nom,
          effectif: classe.effectif,
          vacationGroupe,
          vacationParJour,
          disciplineId: discId,
          disciplineNom: info.nom,
          enseignantPool: `${cycle}:${discId}`,
          poolLabel: `${info.nom} (${cycleLib})`,
          duree: Math.max(1, Math.round(minutes / 60)),
          salleTypeRequis: TYPE_SALLE_REQUIS[info.nom] ?? null,
          // L'EPS est confinée aux plages horaires d'EPS configurées par l'établissement — et,
          // en double vacation, à la demi-journée OPPOSÉE (journée entière le jour d'EPS).
          periodesAutorisees: TYPE_SALLE_REQUIS[info.nom] === "salle_eps" && periodesEPSClasse ? periodesEPSClasse : null,
          // Les séances à vacation simple (EPS ou disciplines conditionnées) sont fixées au
          // jour de vacation simple — c'est ce jour-là que la classe vient la journée entière.
          joursAutorises: jourSimple !== null && dvSimpleClasse.has(discId) ? [jourSimple] : null,
        });
      });
    }
  }

  // ── Salles ──
  // Salles ordinaires : détaillées + synthétisées jusqu'au NOMBRE DÉCLARÉ.
  // Salles spécialisées (EPS, informatique, labo…) : celles configurées, sinon on synthétise
  // le nombre nécessaire pour couvrir la demande — afin que ces cours ne tombent JAMAIS en
  // salle de classe (ex : l'EPS se fait sur un plateau sportif).
  const cap = Math.max(etab.effectifSouhaiteParClasse, ...classes.map((c) => c.effectif), 40);
  const detaillees: SalleSolveur[] = sallesDb.map((s) => ({ nom: s.nom, capacite: s.capacite, type: s.type }));

  const salles: SalleSolveur[] = [];
  // Ordinaires
  const ordinairesDetaillees = detaillees.filter((s) => s.type === "ordinaire");
  salles.push(...ordinairesDetaillees);
  const cibleOrdinaires = Math.max(etab.nbSallesDisponibles, ordinairesDetaillees.length, 1);
  for (let i = ordinairesDetaillees.length; i < cibleOrdinaires; i++) {
    salles.push({ nom: `Salle ${i + 1}`, capacite: cap, type: "ordinaire" });
  }

  // Types spécialisés requis par les cours.
  const demandeParType = new Map<string, number>();
  for (const b of blocs) {
    if (b.salleTypeRequis) demandeParType.set(b.salleTypeRequis, (demandeParType.get(b.salleTypeRequis) ?? 0) + b.duree);
  }
  for (const [type, demande] of demandeParType) {
    const existantes = detaillees.filter((s) => s.type === type);
    salles.push(...existantes);
    // Capacité RÉELLE d'une salle spécialisée par semaine, en tenant compte de la DURÉE des
    // séances : une séance de 2 périodes (ex : EPS 110 min) occupe 2 créneaux CONSÉCUTIFS sans
    // traverser une pause, et une fenêtre horaire (plages EPS) peut « gâcher » ses bords. Compter
    // les seules périodes disponibles surestime donc la capacité et sous-provisionne les salles —
    // le solveur se retrouve alors face à un bin-packing proche de 100 % qu'il ne peut pas résoudre.
    const fenetre = type === "salle_eps" && periodesEPS ? new Set(periodesEPS) : null;
    let dmax = 1;
    for (const b of blocs) if (b.salleTypeRequis === type) dmax = Math.max(dmax, b.duree);
    // Nombre de séances NON CHEVAUCHANTES de durée dmax casables par jour (fenêtre + pauses).
    let parJour = 0;
    for (let per = 0; per + dmax - 1 < periodesParJour; ) {
      let ok = per + dmax - 1 <= finBlocFit[per];
      for (let d = 0; ok && d < dmax; d++) if (fenetre && !fenetre.has(per + d)) ok = false;
      if (ok) {
        parJour++;
        per += dmax;
      } else {
        per++;
      }
    }
    const capaciteParSalle = Math.max(1, joursOuvres * Math.max(1, parJour) * dmax);
    // Marge de packing (~1,5×) car le remplissage proche de la saturation est hors de portée du
    // backtracking ; on conserve au minimum l'ancienne marge additive (+1 salle).
    const requis = Math.max(
      Math.ceil((demande / capaciteParSalle) * 1.5),
      Math.ceil(demande / capaciteParSalle) + 1,
    );
    const libelle = NOM_SALLE_TYPE[type] ?? "Salle spécialisée";
    for (let i = existantes.length; i < requis; i++) {
      salles.push({ nom: `${libelle} ${i + 1}`, capacite: cap, type });
    }
  }

  // Autres salles détaillées non ordinaires et non requises (ex : atelier configuré) : conservées.
  for (const s of detaillees) {
    if (s.type !== "ordinaire" && !demandeParType.has(s.type)) salles.push(s);
  }

  const appliquerTypeSalle = demandeParType.size > 0 || detaillees.some((s) => s.type !== "ordinaire");

  const probleme: Probleme = {
    joursOuvres,
    periodesParJour,
    salles,
    enseignants,
    blocs,
    appliquerTypeSalle,
    blocsPeriodes: periodesParBloc(etab) ?? undefined,
    // Frontière matin/après-midi RÉELLE (pause déjeuner) — pour que la demi-journée de vacation
    // du solveur coïncide avec la grille (une classe du matin garde toutes ses périodes d'avant-midi).
    frontiereMatinAprem: matinIdx.length,
    // Contraintes enseignants paramétrées par l'établissement.
    reposEnseignant: etab.reposEnseignant,
    optimiserEnseignants: etab.regrouperHeuresCreuses,
    // Choix du chef : autoriser des heures creuses dans l'EDT des élèves (pour souffler).
    autoriserHeuresCreusesEleves: etab.autoriserHeuresCreuses,
    // Jour(s) / demi-journée(s) sans cours dans tout l'établissement.
    periodesFermees: periodesFermees.size > 0 ? periodesFermees : undefined,
    // Plafond de service hebdomadaire par enseignant (volume horaire dû par cycle).
    capaciteServiceParUnite,
  };

  return probleme;
}
