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
import { categoriserDiscipline } from "@/lib/emploi-du-temps/categorie-discipline";
import { deriveCategoriePedagogique, estPrimaireOuPrescolaire } from "@/lib/referentiels/etablissement";
import { heuresDuesOfficielles } from "@/lib/referentiels/service-enseignant";
import { cibleLV2 } from "@/lib/disciplines/lv2";
import { parentDeOption, optionCanonique, optionsDe, estParentAOptions } from "@/lib/disciplines/options-disciplines";

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
  /** Salle PHYSIQUE attitrée MANUELLEMENT à cette classe (désignation personnalisée). */
  salleAttribueeId?: string | null;
}
export interface SalleInput {
  id?: string;
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
  /** Discipline facultative (modèle national) : non générée par défaut. */
  facultatif?: boolean;
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
  const grilleNat = new Map<string, { seances: number[]; heures: number; facultatif: boolean; disc: { id: string; nom: string } }>();
  const niveauxAvecOverride = new Set<string>();
  for (const g of grilles) {
    const cle = `${g.niveauId}:${g.disciplineId}`;
    if (g.etablissementId === id) {
      grilleEtab.set(cle, { seances: g.seancesMinutes, disc: g.discipline });
      if (g.seancesMinutes.length > 0) niveauxAvecOverride.add(g.niveauId);
    } else {
      grilleNat.set(cle, { seances: g.seancesMinutes, heures: g.heuresHebdo, facultatif: g.facultatif ?? false, disc: g.discipline });
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

  // ── LV2 : le référentiel national inclut une discipline GÉNÉRIQUE « LV2 » (gabarit), mais LV2
  // se décline TOUJOURS en une OPTION concrète — LV2-Espagnol ou LV2-Allemand. Principe :
  // AUCUNE classe ne fait les deux langues à la fois. On assigne donc à CHAQUE classe une seule
  // langue concrète AVANT résolution (voir plus bas), répartie équitablement entre les options
  // disponibles pour équilibrer la charge des enseignants. `nomParDiscId` sert à reconnaître les
  // disciplines LV2 (générique vs concrète) et à compter les enseignants par langue.
  const normNomDisc = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const nomParDiscId = new Map<string, string>();
  for (const g of grilles) nomParDiscId.set(g.disciplineId, g.discipline.nom);
  for (const ef of effectifs) nomParDiscId.set(ef.disciplineId, ef.discipline.nom);
  // POOL PARTAGÉ PAR FAMILLE : une OPTION (LV2-Allemand, Arts Plastiques…) mutualise le pool
  // d'enseignants de sa discipline-PARENT (LV2, « Arts (Plastiques & Musicale) »). L'effectif est
  // déclaré une fois sur le parent ; les blocs de toute option y puisent. Résolution par NOM (pas
  // de relation en base) : si le parent n'apparaît pas dans le périmètre, on retombe sur l'id de
  // l'option (rétro-compatible avec un effectif encore déclaré par option).
  const idParNomNorm = new Map<string, string>();
  for (const [dId, nom] of nomParDiscId) if (!idParNomNorm.has(normNomDisc(nom))) idParNomNorm.set(normNomDisc(nom), dId);
  const poolDiscId = (dId: string): string => {
    const nom = nomParDiscId.get(dId);
    if (!nom) return dId;
    const parent = parentDeOption(nom);
    if (!parent) return dId;
    return idParNomNorm.get(normNomDisc(parent)) ?? dId;
  };
  const ajouterUnite = (pool: string, uid: string, nom: string) => {
    const arr = unitesParPool.get(pool) ?? [];
    if (!arr.some((u) => u.id === uid)) arr.push({ id: uid, pool, nom });
    unitesParPool.set(pool, arr);
    const cy = cyclesParUnite.get(uid) ?? new Set<string>();
    cy.add(pool.slice(0, pool.indexOf(":")));
    cyclesParUnite.set(uid, cy);
  };

  // SALLES RESSOURCES : type de salle spécialisée requis PAR DISCIPLINE. La configuration de
  // l'établissement (`typeSalleParDiscipline`, indexée par disciplineId) COMPLÈTE le socle national
  // `TYPE_SALLE_REQUIS` (indexé par nom) : une discipline y figurant est envoyée dans les salles
  // NOMMÉES de ce type (bloc « Désignation des salles »), partagées par toutes les classes concernées.
  const typeSalleEtab = new Map<string, string>();
  {
    const brut = Array.isArray(etab.typeSalleParDiscipline) ? (etab.typeSalleParDiscipline as unknown[]) : [];
    for (const e of brut) {
      const o = e as { disciplineId?: unknown; type?: unknown };
      const did = typeof o?.disciplineId === "string" ? o.disciplineId : null;
      const t = typeof o?.type === "string" ? o.type.trim() : "";
      if (did && t) typeSalleEtab.set(did, t);
    }
  }
  const typeSalleRequis = (discId: string, nom: string): string | null =>
    typeSalleEtab.get(discId) ?? TYPE_SALLE_REQUIS[nom] ?? null;

  // Disciplines à salle SPÉCIALISÉE (EPS, informatique, labo…) : leurs enseignants restent propres
  // à leur cycle. Le partage inter-cycles ne s'applique qu'aux disciplines à salle ordinaire — un
  // sous-problème comme l'EPS (plateaux + fenêtre horaire) est déjà tendu et sans intérêt à coupler.
  const disciplineSpecialisee = new Set<string>();
  for (const g of grilles) if (typeSalleRequis(g.disciplineId, g.discipline.nom)) disciplineSpecialisee.add(g.disciplineId);
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
          const pool = `${cycle}:${poolDiscId(dId)}`;
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
          const pool = `${cyc}:${poolDiscId(dId)}`;
          // Des comptes réels couvrent déjà ce pool : ils priment sur les unités anonymes.
          if (poolsReels.has(pool)) continue;
          for (let k = 1; k <= ef.nombre; k++) {
            ajouterUnite(pool, `${ef.cycle}:${ef.disciplineId}#${k}`, `${ef.discipline.nom} (${lib}) #${k}`);
          }
        }
      }
    }
  }

  // ── EDHC : discipline d'APPOINT en cas de DÉFICIT total ──────────────────────────────────────
  // L'EDHC (Éducation aux Droits de l'Homme et à la Citoyenneté, ~1 h/classe) est souvent assurée
  // par des non-spécialistes. Si son pool d'enseignants est VIDE (aucun spécialiste ni effectif
  // déclaré), tout enseignant du cycle peut l'assurer : on peuple alors le pool EDHC avec les
  // enseignants du cycle. Le solveur (unicité + plafond de service) l'attribue à ceux qui ont un
  // créneau libre — en pratique les MOINS CHARGÉS — au lieu de bloquer la génération.
  if (!estPrimaireOuPrescolaire(categorie)) {
    const idsEDHC = [...nomParDiscId].filter(([, nom]) => normNomDisc(nom).includes("edhc")).map(([id]) => id);
    if (idsEDHC.length > 0) {
      // TOUT enseignant réel — des DEUX cycles (1er et 2nd) — peut assurer l'EDHC (choix client) :
      // on peuple les DEUX pools EDHC (collège et lycée) avec l'ensemble des enseignants dès qu'un
      // pool est vide. Le solveur route ensuite vers ceux qui ont un créneau libre (les moins chargés).
      const tousReels = enseignantsReels.map((t) => ({
        id: t.id,
        nom: [t.prenoms, t.nom].filter(Boolean).join(" ") || t.email,
      }));
      for (const edhcId of idsEDHC) {
        for (const cyc of ["college", "lycee"] as const) {
          const pool = `${cyc}:${poolDiscId(edhcId)}`;
          if ((unitesParPool.get(pool)?.length ?? 0) > 0) continue; // des enseignants EDHC existent déjà : rien à faire
          for (const t of tousReels) ajouterUnite(pool, t.id, t.nom);
        }
      }
    }
  }

  const enseignants: EnseignantUnite[] = [...unitesParPool.values()].flat();

  // Plafond de service hebdomadaire par unité : ce plafond = MAXIMUM atteignable (heures
  // supplémentaires comprises), et le solveur ne charge jamais une unité au-delà. Il ne peut
  // jamais être INFÉRIEUR au dû officiel (21 h 1er cycle / 18 h 2nd cycle) : un enseignant peut
  // toujours assurer son dû — plafonner en dessous fabriquerait de faux déficits. Un enseignant
  // intervenant au 2nd cycle relève du volume 2nd cycle ; sinon du 1er cycle. 0 = non plafonné.
  const vol1 = Math.max(0, etab.volumeHoraire1erCycle ?? 0);
  const vol2 = Math.max(0, etab.volumeHoraire2ndCycle ?? 0);
  let capaciteServiceParUnite: Map<string, number> | undefined;
  if (vol1 > 0 || vol2 > 0) {
    const m = new Map<string, number>();
    for (const [uid, cy] of cyclesParUnite) {
      const auLycee = cy.has("lycee");
      const vol = auLycee ? vol2 : vol1;
      // Un cycle non plafonné (vol = 0) laisse l'unité hors table SEULEMENT si l'AUTRE cycle
      // ne la plafonne pas non plus (le max ci-dessus a déjà choisi le cycle pertinent).
      if (vol > 0) m.set(uid, Math.max(vol, heuresDuesOfficielles(auLycee ? "lycee" : "college")));
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
    ? (etab.plagesSansCours as { jour?: unknown; moment?: unknown; niveauIds?: unknown }[])
    : [];
  const periodesFermees = new Set<string>();
  // Plages CIBLANT des NIVEAUX précis : fermées PAR CLASSE (celles des autres niveaux gardent
  // ces créneaux ouverts). Une plage sans niveaux reste une fermeture d'ÉTABLISSEMENT.
  const periodesFermeesParClasse = new Map<string, Set<string>>();
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
    const niveauxVises = Array.isArray(pl?.niveauIds) ? new Set((pl.niveauIds as unknown[]).map(String)) : null;
    // Une plage qui couvre en pratique TOUTES les classes (aucun niveau ciblé, ou tous les
    // niveaux présents cochés) est promue fermeture d'ÉTABLISSEMENT : les contrôles de
    // capacité GLOBAUX (salles, service enseignant) la voient et produisent des messages de
    // blocage actionnables au lieu d'un échec générique.
    const couvreToutes =
      !niveauxVises || niveauxVises.size === 0 || classes.every((c) => niveauxVises.has(c.niveau.id));
    if (couvreToutes) {
      for (const per of cibles) periodesFermees.add(`${jour}:${per}`);
    } else {
      for (const classe of classes) {
        if (!niveauxVises.has(classe.niveau.id)) continue;
        const set = periodesFermeesParClasse.get(classe.id) ?? new Set<string>();
        for (const per of cibles) set.add(`${jour}:${per}`);
        periodesFermeesParClasse.set(classe.id, set);
      }
    }
  }

  // L'EPS tient-elle dans la JOURNÉE COMPLÈTE de `jour` (plages EPS ouvertes, hors plages sans
  // cours — y compris celles qui CIBLENT le niveau de la classe) ? Sert à choisir un jour d'EPS
  // réellement praticable (pas un pur tourniquet), pour ne pas épingler l'EPS un jour où sa
  // fenêtre serait fermée et transformer une configuration soluble en échec.
  const epsFitJourneeComplete = (jour: number, duree: number, fermeesClasse?: Set<string>): boolean => {
    for (let per = 0; per + duree - 1 <= periodesParJour - 1; per++) {
      if (per + duree - 1 > finBlocFit[per]) continue; // ne traverse pas une pause
      let ok = true;
      for (let d = 0; d < duree; d++) {
        const cle = `${jour}:${per + d}`;
        if (periodesFermees.has(cle) || fermeesClasse?.has(cle) || (epsSet && !epsSet.has(per + d))) {
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

  // ── Pré-passe : disciplines de chaque classe (grille override étab. sinon national) ──
  const disciplinesParClasse = new Map<string, Map<string, { nom: string; seances: number[] }>>();
  for (const classe of classes) {
    const dn = new Map<string, { nom: string; seances: number[] }>();
    // Si l'établissement a sa propre grille pour ce niveau, on l'utilise EXCLUSIVEMENT
    // (on n'ajoute pas les disciplines du modèle national non configurées).
    if (niveauxAvecOverride.has(classe.niveau.id)) {
      for (const [k, v] of grilleEtab) {
        if (k.startsWith(`${classe.niveau.id}:`) && v.seances.length > 0) dn.set(v.disc.id, { nom: v.disc.nom, seances: v.seances });
      }
    } else {
      for (const [k, v] of grilleNat) {
        if (!k.startsWith(`${classe.niveau.id}:`)) continue;
        // Discipline FACULTATIVE : proposée mais non générée par défaut.
        if (v.facultatif) continue;
        // Durées RÉELLES du modèle national si renseignées ; sinon repli 55 min.
        const seances = v.seances.length > 0 ? v.seances : Array.from({ length: Math.max(1, Math.round(v.heures)) }, () => 55);
        if (seances.length > 0) dn.set(v.disc.id, { nom: v.disc.nom, seances });
      }
    }
    disciplinesParClasse.set(classe.id, dn);
  }

  // ── Déclinaison des familles à OPTIONS par classe (LV2 → Allemand/Espagnol ; Arts → Plastiques/
  // Musique…) ── La grille liste la discipline-PARENT (gabarit) ; c'est ICI, à la génération, que
  // chaque classe reçoit UNE option concrète disponible (avec des enseignants), choisie pour
  // ÉQUILIBRER la charge par enseignant entre les options — sans jamais mêler deux options dans
  // une même classe. Générique : vaut pour toute famille déclarée dans options-disciplines.
  {
    // Une OPTION concrète (par NOM) → { parent, canon } ; couvre les familles connues et, par
    // sécurité, les libellés bruts LV2 (« Espagnol »/« Allemand ») via cibleLV2.
    const infoOption = (nom: string): { parent: string; canon: string } | null => {
      const p = parentDeOption(nom);
      if (p) return { parent: p, canon: optionCanonique(nom) };
      const c = cibleLV2(nom);
      if (c) return { parent: "LV2", canon: c };
      return null;
    };
    // Discipline concrète canonique par (parent::canon) — préférer le nom EXACT du canonique.
    const canonDisc = new Map<string, { id: string; nom: string; parent: string; canon: string }>();
    for (const [dId, nom] of nomParDiscId) {
      const o = infoOption(nom);
      if (!o) continue;
      const k = `${normNomDisc(o.parent)}::${normNomDisc(o.canon)}`;
      const cur = canonDisc.get(k);
      if (!cur || normNomDisc(nom) === normNomDisc(o.canon)) canonDisc.set(k, { id: dId, nom, parent: o.parent, canon: o.canon });
    }
    const nbUnites = (cycle: string, discId: string) =>
      new Set((unitesParPool.get(`${cycle}:${poolDiscId(discId)}`) ?? []).map((u) => u.id)).size;
    // Charge (séances) déjà engagée par (cycle, parent::canon) via d'éventuelles lignes concrètes EXPLICITES.
    const cle = (cycle: string, parent: string, canon: string) => `${cycle}:${normNomDisc(parent)}::${normNomDisc(canon)}`;
    const charge = new Map<string, number>();
    for (const classe of classes) {
      for (const info of disciplinesParClasse.get(classe.id)!.values()) {
        const o = infoOption(info.nom);
        if (o) charge.set(cle(classe.niveau.cycle, o.parent, o.canon), (charge.get(cle(classe.niveau.cycle, o.parent, o.canon)) ?? 0) + info.seances.length);
      }
    }
    for (const classe of classes) {
      const dn = disciplinesParClasse.get(classe.id)!;
      const cycle = classe.niveau.cycle;
      // Chaque ligne GÉNÉRIQUE de discipline-parent présente dans la classe est déclinée.
      const generiques = [...dn].filter(([, i]) => estParentAOptions(i.nom));
      for (const [genId, genInfo] of generiques) {
        const optionsFamille = new Set(optionsDe(genInfo.nom).map(normNomDisc));
        const options = [...canonDisc.values()].filter((d) => optionsFamille.has(normNomDisc(d.canon)) && nbUnites(cycle, d.id) > 0);
        if (options.length === 0) continue; // aucune option enseignable : garder le gabarit (bloquera clairement)
        let choix: { id: string; nom: string; parent: string; canon: string } | null = null;
        let meilleur = Infinity;
        for (const d of options) {
          const apres = ((charge.get(cle(cycle, d.parent, d.canon)) ?? 0) + genInfo.seances.length) / Math.max(1, nbUnites(cycle, d.id));
          if (apres < meilleur) {
            meilleur = apres;
            choix = d;
          }
        }
        if (!choix) continue;
        dn.delete(genId);
        if (!dn.has(choix.id)) dn.set(choix.id, { nom: choix.nom, seances: genInfo.seances });
        charge.set(cle(cycle, choix.parent, choix.canon), (charge.get(cle(cycle, choix.parent, choix.canon)) ?? 0) + genInfo.seances.length);
      }
    }
  }

  // Demi-journée IMPOSÉE par le partage de salle : deux classes en DOUBLE vacation affectées à
  // la MÊME salle physique doivent occuper des demi-journées OPPOSÉES (sinon la salle serait
  // sur-souscrite). L'affectation manuelle des salles fixe donc, pour ces paires, qui vient le
  // matin (la classe au plus petit numéro) et qui vient l'après-midi.
  const vacationImposeeParClasse = new Map<string, 0 | 1>();
  {
    const parSalle = new Map<string, ClasseInput[]>();
    for (const c of classes) {
      if (!c.salleAttribueeId || c.regimeVacation !== "double") continue;
      parSalle.set(c.salleAttribueeId, [...(parSalle.get(c.salleAttribueeId) ?? []), c]);
    }
    for (const membres of parSalle.values()) {
      if (membres.length !== 2) continue;
      const [a, b] = [...membres].sort((x, y) => x.nom.localeCompare(y.nom, "fr", { numeric: true }));
      vacationImposeeParClasse.set(a.id, 0); // plus petit numéro → matin le 1er jour
      vacationImposeeParClasse.set(b.id, 1); // → après-midi le 1er jour
    }
  }

  // #4 — ALTERNANCE matin/après-midi JOUR PAR JOUR pour les deux classes qui PARTAGENT une salle
  // (double vacation) : l'une commence le matin, l'autre l'après-midi, puis elles ÉCHANGENT chaque
  // jour (aucune classe n'est bloquée toujours l'après-midi). Alternance STRICTE : les deux classes
  // restent en demi-journées OPPOSÉES chaque jour (la salle n'est jamais sur-souscrite). Un
  // après-midi « sans cours » est géré NATURELLEMENT : la classe alors en après-midi n'a simplement
  // pas de séance cet après-midi-là (comme aujourd'hui pour une classe fixée l'après-midi), sans
  // forcer les deux classes le matin (ce qui doublerait la salle). Les classes SANS partage de salle
  // gardent une vacation FIXE (aucune entrée ici).
  const vacationBaseParJourParClasse = new Map<string, (0 | 1)[]>();
  for (const [classeId, depart] of vacationImposeeParClasse) {
    vacationBaseParJourParClasse.set(
      classeId,
      Array.from({ length: joursOuvres }, (_, j) => ((depart + j) % 2) as 0 | 1),
    );
  }

  // Groupes de vacation : par niveau, on alterne les classes en double vacation.
  const compteurNiveau = new Map<string, number>();
  const blocs: BlocCours[] = [];

  for (const classe of classes) {
    const cycle = classe.niveau.cycle;
    const cycleLib = CYCLE_LABEL[cycle] ?? cycle;
    const disciplinesNiveau = disciplinesParClasse.get(classe.id)!;

    let vacationGroupe: 0 | 1 | null = null;
    if (classe.regimeVacation === "double") {
      const idx = compteurNiveau.get(classe.niveau.id) ?? 0;
      compteurNiveau.set(classe.niveau.id, idx + 1);
      const impose = vacationImposeeParClasse.get(classe.id);
      // Groupe 0 = matin, 1 = après-midi. Le partage de salle prime sur l'alternance ; sinon la
      // parité choisie par le chef va au matin.
      vacationGroupe = impose !== undefined ? impose : ((pairsLeMatin ? 1 - (idx % 2) : idx % 2) as 0 | 1);
    }
    // Base de vacation PAR JOUR : alternée pour les classes en partage de salle (#4), sinon
    // uniforme (= vacationGroupe). Utilisée partout où l'on avait `vacationGroupe` scalaire par jour.
    const baseAlt = vacationBaseParJourParClasse.get(classe.id);
    const baseJour = (j: number): 0 | 1 => (baseAlt ? baseAlt[j] : (vacationGroupe as 0 | 1));

    // ── EPS ISOLÉE dans la demi-journée OPPOSÉE (réglage du chef) ──
    // En double vacation, la séance d'EPS se tient dans l'AUTRE demi-journée, ISOLÉE : les
    // cours en salle restent dans la demi-journée de vacation de la classe (jamais de
    // « journée entière » le jour d'EPS). L'EPS est épinglée à un jour (tourniquet partagé)
    // et à la moitié opposée via une vacation PROPRE au bloc. Repli sur le comportement
    // classique si aucune demi-journée opposée de la semaine ne peut accueillir la séance.
    let jourEPSIsolee: number | null = null;
    let vacationEPSIsolee: (0 | 1 | null)[] | undefined;
    // Jour attribué à CHAQUE séance d'EPS (clé « discId:indiceSeance ») : la grille nationale
    // CI compte DEUX séances d'EPS par semaine — chacune reçoit SON jour, en demi-journée
    // opposée (les épingler au même jour rendait la génération infaisable : une seule
    // position de fenêtre, ou l'option « une séance par demi-journée » violée d'office).
    const jourEPSParSeance = new Map<string, number>();
    const idsEPS = new Set(
      [...disciplinesNiveau].filter(([id, i]) => typeSalleRequis(id, i.nom) === "salle_eps").map(([id]) => id),
    );
    if (etab.epsDemiJourneeOpposee && vacationGroupe !== null && idsEPS.size > 0) {
      const fermeesClasseIso = periodesFermeesParClasse.get(classe.id);
      // UNE séance de `duree` périodes tient-elle dans la demi-journée OPPOSÉE à la vacation de la
      // classe CE JOUR-LÀ (la demi-journée opposée dépend de la base par jour — alternance #4) —
      // pauses, plages d'EPS, plages sans cours (établissement et niveau) comprises ?
      const epsFitDemiOpposee = (jour: number, duree: number): boolean => {
        const opposeeIdx = baseJour(jour) === 0 ? apmIdx : matinIdx;
        const opposeeSet = new Set(opposeeIdx);
        for (const per of opposeeIdx) {
          if (per + duree - 1 > finBlocFit[per]) continue; // ne traverse pas une pause
          let ok = true;
          for (let d = 0; d < duree; d++) {
            const pp = per + d;
            const cle = `${jour}:${pp}`;
            if (!opposeeSet.has(pp) || periodesFermees.has(cle) || fermeesClasseIso?.has(cle) || (epsSet && !epsSet.has(pp))) {
              ok = false;
              break;
            }
          }
          if (ok) return true;
        }
        return false;
      };
      // Un jour DISTINCT par séance d'EPS, pris au tourniquet partagé (étalement entre
      // classes ET entre séances). REPLI COMPLET sur le comportement classique si toutes
      // les séances ne peuvent pas recevoir leur jour (jamais d'infaisabilité fabriquée).
      const seancesEPS: { cle: string; duree: number }[] = [];
      for (const [dId, info] of disciplinesNiveau) {
        if (!idsEPS.has(dId)) continue;
        info.seances.forEach((minutes, i) =>
          seancesEPS.push({ cle: `${dId}:${i}`, duree: Math.max(1, Math.round(minutes / 60)) }),
        );
      }
      const joursPris = new Set<number>();
      let tousServis = seancesEPS.length > 0 && seancesEPS.length <= joursOuvres;
      if (tousServis) {
        for (const seance of seancesEPS) {
          let choisi = -1;
          for (let k = 0; k < joursOuvres; k++) {
            const j = (compteurJourSimple + k) % joursOuvres;
            if (joursPris.has(j)) continue;
            if (epsFitDemiOpposee(j, seance.duree)) {
              choisi = j;
              break;
            }
          }
          if (choisi < 0) {
            tousServis = false;
            break;
          }
          joursPris.add(choisi);
          jourEPSParSeance.set(seance.cle, choisi);
        }
      }
      if (tousServis) {
        jourEPSIsolee = [...joursPris][0]; // drapeau « mode isolé actif » (premier jour servi)
        compteurJourSimple = (Math.max(...joursPris) + 1) % joursOuvres; // tourniquet partagé
        // Jour d'EPS → demi-journée OPPOSÉE à la base de CE jour ; autres jours → base du jour
        // (alternance #4 prise en compte via `baseJour`).
        vacationEPSIsolee = Array.from({ length: joursOuvres }, (_, j) =>
          (joursPris.has(j) ? (1 - baseJour(j)) : baseJour(j)) as 0 | 1,
        );
      } else {
        jourEPSParSeance.clear();
      }
    }

    // Disciplines à VACATION SIMPLE pour cette classe (le jour où elles ont lieu, la classe
    // vient la journée entière et la double vacation ne s'applique plus) :
    //  • celles configurées par le chef (« X → double vacation : Non ») ;
    //  • l'EPS AUTOMATIQUEMENT, si ses plages horaires ne tiennent pas dans la demi-journée
    //    de vacation de la classe — sinon l'EPS serait insoluble (plages hors de sa vacation).
    // (EPS ISOLÉE : elle est gérée à part ci-dessus — jamais de journée entière pour elle.)
    const dvSimpleClasse = new Set<string>();
    let epsDansSimple = false;
    let dureeEPSmax = 1;
    if (vacationGroupe !== null) {
      for (const dId of disciplinesNiveau.keys()) {
        if (jourEPSIsolee !== null && idsEPS.has(dId)) continue;
        if (disciplinesVacationSimple.has(dId)) dvSimpleClasse.add(dId);
      }
      for (const [dId, info] of disciplinesNiveau) {
        if (typeSalleRequis(dId, info.nom) !== "salle_eps") continue;
        if (jourEPSIsolee !== null) continue; // EPS isolée : ni journée entière ni jour simple
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
    // l'EPS ne pourrait pas se poser (plages EPS fermées ce jour-là) ET les jours entièrement
    // FERMÉS pour cette classe (plage sans cours d'établissement ou de SON niveau) — sinon on
    // épinglerait la vacation simple un jour infaisable et on transformerait une configuration
    // soluble en échec.
    let jourSimple: number | null = null;
    let vacationParJour: (0 | 1 | null)[] | undefined;
    if (vacationGroupe !== null && dvSimpleClasse.size > 0) {
      const fermeesClasse = periodesFermeesParClasse.get(classe.id);
      const jourOuvertPourClasse = (j: number): boolean => {
        for (let per = 0; per < periodesParJour; per++) {
          const cle = `${j}:${per}`;
          if (!periodesFermees.has(cle) && !fermeesClasse?.has(cle)) return true;
        }
        return false;
      };
      let choisi = -1;
      for (let k = 0; k < joursOuvres; k++) {
        const j = (compteurJourSimple + k) % joursOuvres;
        if (!jourOuvertPourClasse(j)) continue;
        if (!epsDansSimple || epsFitJourneeComplete(j, dureeEPSmax, fermeesClasse)) {
          choisi = j;
          break;
        }
      }
      jourSimple = choisi >= 0 ? choisi : compteurJourSimple % joursOuvres;
      compteurJourSimple = jourSimple + 1; // le tourniquet reprend au jour suivant
      // Jour simple → journée entière (null) ; autres jours → base du jour (alternance #4 via baseJour).
      vacationParJour = Array.from({ length: joursOuvres }, (_, j) => (j === jourSimple ? null : baseJour(j)));
    }
    // Sans jour de vacation simple : une classe ALTERNÉE (#4, partage de salle) porte quand même sa
    // base PAR JOUR ; une classe à vacation fixe garde `vacationGroupe` uniforme (vacationParJour absent).
    if (vacationParJour === undefined && baseAlt) {
      vacationParJour = baseAlt.map((v) => v as 0 | 1 | null);
    }

    for (const [discId, info] of disciplinesNiveau) {
      info.seances.forEach((minutes, i) => {
        blocs.push({
          id: `${classe.id}:${discId}:${i}`,
          classeId: classe.id,
          classeNom: classe.nom,
          effectif: classe.effectif,
          vacationGroupe,
          // EPS ISOLÉE : vacation PROPRE au bloc — demi-journée OPPOSÉE le jour d'EPS, celle
          // de la classe les autres jours (sans objet : le bloc est épinglé à son jour). Les
          // AUTRES blocs gardent la vacation de la classe (jamais de journée entière).
          vacationParJour: jourEPSIsolee !== null && idsEPS.has(discId) ? vacationEPSIsolee : vacationParJour,
          disciplineId: discId,
          disciplineNom: info.nom,
          enseignantPool: `${cycle}:${poolDiscId(discId)}`,
          poolLabel: `${info.nom} (${cycleLib})`,
          duree: Math.max(1, Math.round(minutes / 60)),
          salleTypeRequis: typeSalleRequis(discId, info.nom),
          // Catégorie littéraire/scientifique — contraintes optionnelles d'enchaînement.
          disciplineCategorie: categoriserDiscipline(info.nom),
          // Français au COLLÈGE (6e-3e) : préférence souple d'isolement des 2 séances d'un même jour.
          francaisCollege: cycle === "college" && normNomDisc(info.nom) === "francais",
          // L'EPS est confinée aux plages horaires d'EPS configurées par l'établissement — et,
          // en double vacation, à la demi-journée OPPOSÉE (via la vacation propre du bloc en
          // mode ISOLÉ, ou la journée entière du jour d'EPS en mode classique).
          periodesAutorisees:
            typeSalleRequis(discId, info.nom) === "salle_eps"
              ? ((jourEPSIsolee !== null && idsEPS.has(discId) ? periodesEPS : periodesEPSClasse) ?? null)
              : null,
          // Les séances à vacation simple (EPS ou disciplines conditionnées) sont fixées au
          // jour de vacation simple ; chaque séance d'EPS ISOLÉE est fixée à SON jour propre.
          joursAutorises:
            jourEPSIsolee !== null && idsEPS.has(discId)
              ? [jourEPSParSeance.get(`${discId}:${i}`) ?? jourEPSIsolee]
              : jourSimple !== null && dvSimpleClasse.has(discId)
                ? [jourSimple]
                : null,
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

  // ── SALLE ATTITRÉE par classe (réglage « réduire les déplacements des élèves ») ──
  // Chaque classe reçoit UNE salle ordinaire : ses cours (hors salle spécialisée) s'y
  // tiennent tous — ce sont les enseignants qui se déplacent. En double vacation, une même
  // salle PHYSIQUE sert deux classes pédagogiques : celle du matin ET celle de l'après-midi
  // (leurs créneaux sont disjoints par construction). Appariement DÉTERMINISTE (par niveau,
  // i-ème classe du matin avec i-ème de l'après-midi) : stable d'une génération à l'autre.
  // Attribution best-fit (grandes salles aux gros effectifs) ; s'il manque des salles, les
  // classes restantes gardent une salle au choix du solveur (le contrôle global de capacité
  // signale de toute façon un parc insuffisant).
  // ── SALLES ATTITRÉES MANUELLEMENT (désignation + affectation par le chef) ──
  // Une classe dont une salle a été explicitement affectée voit tous ses cours ordinaires
  // confinés dans cette salle (nom personnalisé lisible sur l'EDT). Prioritaire sur
  // l'appariement automatique ci-dessous ; en double vacation, deux classes peuvent partager
  // la même salle physique (leurs créneaux sont disjoints par construction).
  const nomSalleParId = new Map<string, string>();
  for (const s of sallesDb) if (s.id) nomSalleParId.set(s.id, s.nom);
  const salleManuelleParClasse = new Map<string, string>();
  for (const c of classes) {
    if (!c.salleAttribueeId) continue;
    const nom = nomSalleParId.get(c.salleAttribueeId);
    if (nom) salleManuelleParClasse.set(c.id, nom);
  }
  const reserveesManuelles = new Set<string>();
  for (const b of blocs) {
    if (b.salleTypeRequis) continue; // cours spécialisés (EPS, labo…) : hors salle attitrée
    const salle = salleManuelleParClasse.get(b.classeId);
    if (salle) {
      b.salleImposee = salle;
      reserveesManuelles.add(salle);
    }
  }

  let sallesReservees: string[] = [...reserveesManuelles];
  if (etab.salleFixeParClasse) {
    const groupeParClasse = new Map<string, 0 | 1 | null>();
    for (const b of blocs) if (!groupeParClasse.has(b.classeId)) groupeParClasse.set(b.classeId, b.vacationGroupe);
    // Classes dont un jour ouvre la JOURNÉE ENTIÈRE (jour de vacation simple : condition du
    // chef, ou EPS classique dont les plages débordent) : leurs cours peuvent déborder dans
    // la demi-journée du binôme — l'hypothèse « créneaux disjoints » tombe, elles reçoivent
    // une salle EXCLUSIVE (jamais appariées). L'EPS isolée, elle, préserve la disjonction.
    const journeeEntierePartielle = new Set<string>();
    for (const b of blocs) {
      if (b.vacationParJour && b.vacationParJour.some((v) => v === null)) journeeEntierePartielle.add(b.classeId);
    }
    type Unite = { classes: { id: string; effectif: number }[]; effectif: number };
    const unites: Unite[] = [];
    const parNiveau = new Map<string, { matin: typeof classes; apresMidi: typeof classes; seules: typeof classes }>();
    for (const c of classes) {
      if (salleManuelleParClasse.has(c.id)) continue; // salle déjà affectée manuellement
      const e = parNiveau.get(c.niveau.id) ?? { matin: [], apresMidi: [], seules: [] };
      const g = journeeEntierePartielle.has(c.id) ? null : groupeParClasse.get(c.id);
      if (g === 0) e.matin.push(c);
      else if (g === 1) e.apresMidi.push(c);
      else e.seules.push(c); // journée entière (totale ou partielle) : salle exclusive
      parNiveau.set(c.niveau.id, e);
    }
    for (const e of parNiveau.values()) {
      const n = Math.max(e.matin.length, e.apresMidi.length);
      for (let i = 0; i < n; i++) {
        const paire = [e.matin[i], e.apresMidi[i]].filter(Boolean) as typeof classes;
        if (paire.length > 0) {
          unites.push({
            classes: paire.map((c) => ({ id: c.id, effectif: c.effectif })),
            effectif: Math.max(...paire.map((c) => c.effectif)),
          });
        }
      }
      for (const c of e.seules) unites.push({ classes: [{ id: c.id, effectif: c.effectif }], effectif: c.effectif });
    }
    // Priorité aux PAIRES de double vacation (deux classes servies par salle — le cœur de la
    // demande), puis aux classes seules ; grandes salles aux gros effectifs (two-pointer :
    // une salle trop petite est écartée SANS sacrifier l'unité, qui essaie la suivante).
    // Les salles déjà réservées manuellement ne sont pas re-attribuées par l'appariement auto.
    const ordinaires = [...salles.filter((s) => s.type === "ordinaire" && !reserveesManuelles.has(s.nom))].sort(
      (a, b) => b.capacite - a.capacite,
    );
    unites.sort((a, b) => b.classes.length - a.classes.length || b.effectif - a.effectif);
    const salleDeClasse = new Map<string, string>();
    const reservees: string[] = [];
    let iSalle = 0;
    for (const u of unites) {
      if (iSalle >= ordinaires.length) break; // plus aucune salle : classes restantes libres
      // Salles triées par capacité DÉCROISSANTE : la plus grande restante est ordinaires[iSalle].
      // Si elle est trop petite pour CETTE unité, aucune restante ne conviendra — l'unité est
      // laissée libre et la salle CONSERVÉE pour les unités suivantes (effectifs plus petits).
      if (ordinaires[iSalle].capacite < u.effectif) continue;
      for (const c of u.classes) salleDeClasse.set(c.id, ordinaires[iSalle].nom);
      reservees.push(ordinaires[iSalle].nom);
      iSalle++;
    }
    for (const b of blocs) {
      if (b.salleTypeRequis) continue; // cours spécialisés (EPS, labo…) : hors salle attitrée
      if (salleManuelleParClasse.has(b.classeId)) continue; // salle manuelle déjà imposée
      const salle = salleDeClasse.get(b.classeId);
      if (salle) b.salleImposee = salle;
    }
    sallesReservees = [...reserveesManuelles, ...reservees];
  }

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
    // Contraintes supplémentaires optionnelles (bloc « Contraintes supplémentaires »).
    memeDisciplineNonConsecutive: etab.interdireMemeDisciplineConsecutive,
    litterairesNonConsecutifs: etab.interdireLitterairesConsecutifs,
    scientifiquesNonConsecutifs: etab.interdireScientifiquesConsecutifs,
    eviterSeanceIsoleeEnseignant: etab.eviterSeanceIsoleeEnseignant,
    uneSeanceParDemiJournee: etab.limiterDisciplineParDemiJournee,
    eviterFinJourneeRepetee: etab.eviterMemeDisciplineFinJournee,
    // Choix du chef : autoriser des heures creuses dans l'EDT des élèves (pour souffler).
    autoriserHeuresCreusesEleves: etab.autoriserHeuresCreuses,
    // Jour(s) / demi-journée(s) sans cours dans tout l'établissement.
    periodesFermees: periodesFermees.size > 0 ? periodesFermees : undefined,
    // Plages ciblant des NIVEAUX : fermetures propres aux classes de ces niveaux.
    periodesFermeesParClasse: periodesFermeesParClasse.size > 0 ? periodesFermeesParClasse : undefined,
    // Plafond de service hebdomadaire par enseignant (volume horaire dû par cycle).
    capaciteServiceParUnite,
    // Salles attitrées (mode « réduire les déplacements des élèves ») : les cours des
    // classes restées libres les évitent tant qu'il reste une salle non réservée.
    sallesReservees: sallesReservees.length > 0 ? sallesReservees : undefined,
    // Salle attitrée SOUPLE : préférence best-effort (le surplus se déplace, jamais de blocage).
    salleImposeeSouple: etab.salleAttribueeSouple === true,
    // Réglages restrictifs actifs, rappelés dans les messages d'échec du solveur.
    reglagesActifs: (() => {
      const r: string[] = [];
      if (etab.epsDemiJourneeOpposee) r.push("« EPS dans l'autre demi-journée »");
      if (etab.salleFixeParClasse) r.push("« salle attitrée par classe »");
      if (salleManuelleParClasse.size > 0) r.push("« salles affectées manuellement »");
      return r.length > 0 ? r : undefined;
    })(),
  };

  return probleme;
}
