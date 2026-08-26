"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
import { hacherMotDePasse } from "@/lib/auth/password";
import { estReseauValide, estCategoriePedagogiqueValide } from "@/lib/referentiels/etablissement";
import { TAILLE_MAX_DOCUMENT, TAILLE_MAX_DOCUMENT_LIBELLE } from "./limites";
import { lireFichierTexte } from "@/lib/csv/lire-fichier-texte";
import {
  donneesImportEtablissement,
  validerConditionsVacation,
  validerPlagesSansCours,
} from "@/lib/etablissements/config-transfert";
import { filtreNiveauxVisibles, niveauxVisibles, niveauVisiblePour } from "@/lib/etablissements/niveaux-visibles";
import { normaliserSpecialiteLV2 } from "@/lib/disciplines/lv2";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

async function peutGerer(etablissementId: string, opts?: { ignorerVerrou?: boolean }) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  let autorise: typeof u | null = null;
  if (u.roleReel === "admin" || u.roleReel === "superviseur_international") autorise = u;
  // Le gestionnaire de l'établissement (admin d'établissements, chef ou ACE) configure LE SIEN.
  else if (
    (u.roleReel === "etablissements_admin" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === etablissementId
  ) {
    autorise = u;
  }
  // Super Admin Établissements : configure tout établissement de SON pays (cloisonnement strict).
  else if (u.roleReel === "super_admin_etablissements") {
    const e = await prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { pays: true } });
    if (ecritureNationaleAutorisee(u, "super_admin_etablissements", e?.pays)) autorise = u;
  }
  if (!autorise) return null;
  // VERROU : une configuration verrouillée refuse TOUTE écriture (le verrou/déverrou lui-même passe
  // `ignorerVerrou`, et n'est ouvert qu'à l'admin système — cf. `basculerVerrouConfig`).
  if (!opts?.ignorerVerrou) {
    const e = await prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { configVerrouillee: true } });
    if (e?.configVerrouillee) return null;
  }
  return autorise;
}

/**
 * VERROUILLAGE de la configuration : réservé à l'administrateur SYSTÈME (rôle « admin »). Quand la
 * config est verrouillée, `peutGerer` refuse toute écriture de configuration jusqu'au déverrouillage.
 */
export async function basculerVerrouConfig(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const verrouiller = String(formData.get("verrouiller") ?? "") === "1";
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || u.roleReel !== "admin") {
    return { ok: false, message: "Seul l'administrateur système peut verrouiller ou déverrouiller la configuration." };
  }
  try {
    await prisma.etablissement.update({
      where: { id },
      data: {
        configVerrouillee: verrouiller,
        configVerrouilleeLe: verrouiller ? new Date() : null,
        configVerrouilleeParId: verrouiller ? u.id : null,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return { ok: true, message: verrouiller ? "Configuration verrouillée." : "Configuration déverrouillée." };
  } catch (e) {
    console.error("[verrou-config] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

function s(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}
function n(formData: FormData, key: string, def: number): number {
  const v = Number(formData.get(key));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
}
/** Effectif souhaité PAR CLASSE d'un niveau (colonne « Effectif / classe ») : vide/invalide = null
 *  → la valeur GLOBALE « Effectif souhaité / classe » (prioritaire) s'applique à ce niveau. */
function effectifClasseSaisi(formData: FormData, niveauId: string): number | null {
  const brut = String(formData.get(`effectifClasse_${niveauId}`) ?? "").trim();
  const v = Number(brut);
  return brut !== "" && Number.isFinite(v) && v >= 1 ? Math.min(2000, Math.floor(v)) : null;
}
// Casse titre « prénoms » : première lettre de chaque composante (séparée par une espace) en
// majuscule. Volontairement sans capitale après apostrophe/trait d'union (« N'venonfon »).
function titrePrenoms(v: string): string {
  return v.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

// ── Étapes 1 & 2 : sauvegarde des champs scalaires ──
export async function sauvegarderConfiguration(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  // Sauvegarde PARTIELLE : chaque bloc n'envoie que ses champs ; on ne met à jour que
  // les clés réellement présentes dans le formulaire (sinon on écraserait les autres par null).
  const champsTexte = [
    "code", "ville", "regionId", "pays", "sloganBulletin", "ministere", "anneeScolaire",
    "fonctionChef", "nomChef", "prenomsChef", "planRapport", "presentationRapport",
    "horaireDebutMatin", "horairePauseMatinDebut", "horairePauseMatinFin",
    "horairePauseMidiDebut", "horaireRepriseApresMidi", "horaireFinJournee",
    "epsMatinDebut", "epsMatinFin", "epsApresMidiDebut", "epsApresMidiFin",
  ] as const;
  const champsNombre: Record<string, number> = {
    effectifSouhaiteParClasse: 40,
    nbSallesDisponibles: 0,
    creneauxParJour: 8,
    dureeSeanceMatin: 55,
    dureeSeanceApresMidi: 55,
  };

  const data: Record<string, unknown> = {};
  if (formData.has("nom")) {
    const nom = s(formData, "nom");
    if (!nom) return { ok: false, message: "Le nom de l'établissement est requis." };
    data.nom = nom;
  }
  if (formData.has("type")) data.type = String(formData.get("type"));
  // Catégorie pédagogique (sélecteur en tête de la configuration) : adapte toute la console
  // (effectifs enseignants par spécialité, ajout de disciplines, source des compétences).
  if (formData.has("categoriePedagogique")) {
    const cat = String(formData.get("categoriePedagogique"));
    if (!estCategoriePedagogiqueValide(cat)) {
      return { ok: false, message: "Catégorie pédagogique invalide." };
    }
    data.categoriePedagogique = cat;
  }
  if (formData.has("statut")) {
    const st = String(formData.get("statut"));
    data.statut = st;
    // Un établissement non confessionnel ne conserve pas de réseau confessionnel.
    if (st !== "confessionnel") data.reseauConfessionnel = null;
  }
  // Réseau confessionnel : posté (et conservé) uniquement quand le statut est « confessionnel »,
  // et validé contre le référentiel (parité avec la création) pour refuser toute valeur forgée.
  if (formData.has("reseauConfessionnel") && String(formData.get("statut") ?? "") === "confessionnel") {
    const r = s(formData, "reseauConfessionnel");
    data.reseauConfessionnel = r && estReseauValide(r) ? r : null;
  }
  // Diocèse : conservé UNIQUEMENT pour un établissement catholique (confessionnel + réseau SEDEC) ;
  // effacé sinon. Périmètre du rôle SEDEC. (Ne touché que lorsque le bloc « Infos » est enregistré.)
  if (formData.has("statut")) {
    const estCatho =
      String(formData.get("statut")) === "confessionnel" && String(formData.get("reseauConfessionnel") ?? "") === "SEDEC";
    data.diocese = estCatho ? s(formData, "diocese") || null : null;
  }
  for (const k of champsTexte) if (formData.has(k)) data[k] = s(formData, k);
  // Casse normalisée du chef (défense côté serveur, indépendante du formatage client) :
  // NOM en MAJUSCULES, Prénoms en casse titre.
  if (typeof data.nomChef === "string") data.nomChef = data.nomChef.toUpperCase();
  if (typeof data.prenomsChef === "string") data.prenomsChef = titrePrenoms(data.prenomsChef);
  for (const k of Object.keys(champsNombre)) {
    if (formData.has(k)) data[k] = n(formData, k, champsNombre[k]);
  }
  // Plages horaires d'EPS : refuser explicitement une plage incohérente plutôt que de
  // l'ignorer en silence (fin ≤ début, ou borne isolée) — sinon l'EPS se placerait
  // librement toute la journée sans que l'administrateur comprenne pourquoi.
  for (const [libelle, cleDebut, cleFin] of [
    ["du matin", "epsMatinDebut", "epsMatinFin"],
    ["de l'après-midi", "epsApresMidiDebut", "epsApresMidiFin"],
  ] as const) {
    if (!formData.has(cleDebut) && !formData.has(cleFin)) continue;
    const debut = s(formData, cleDebut);
    const fin = s(formData, cleFin);
    if (!debut && !fin) continue; // plage volontairement vide : aucune restriction
    if (!debut || !fin) {
      return { ok: false, message: `Plage d'EPS ${libelle} incomplète : renseignez le début ET la fin (ou laissez les deux vides).` };
    }
    if (fin <= debut) {
      return { ok: false, message: `Plage d'EPS ${libelle} invalide : la fin doit être après le début.` };
    }
  }

  // Contraintes enseignants (cases à cocher : le marqueur signale la présence du bloc,
  // car une case décochée n'est pas postée du tout).
  if (formData.has("contraintesEnseignantsPresentes")) {
    data.reposEnseignant = formData.get("reposEnseignant") === "on";
    data.regrouperHeuresCreuses = formData.get("regrouperHeuresCreuses") === "on";
  }
  // Contrainte élèves : heures creuses autorisées dans l'EDT (choix du chef).
  if (formData.has("contraintesElevesPresentes")) {
    data.autoriserHeuresCreuses = formData.get("autoriserHeuresCreuses") === "on";
    // EPS isolée dans la demi-journée opposée (double vacation) — case du même bloc.
    data.epsDemiJourneeOpposee = formData.get("epsDemiJourneeOpposee") === "on";
    // Salle attitrée par classe (réduire les déplacements des élèves) — case du même bloc.
    data.salleFixeParClasse = formData.get("salleFixeParClasse") === "on";
  }
  // Contraintes supplémentaires d'enchaînement + séance isolée (bloc « Contraintes
  // supplémentaires » — marqueur dédié : seuls les NOUVEAUX formulaires les postent).
  if (formData.has("contraintesSupplementairesPresentes")) {
    data.interdireMemeDisciplineConsecutive = formData.get("interdireMemeDisciplineConsecutive") === "on";
    data.interdireLitterairesConsecutifs = formData.get("interdireLitterairesConsecutifs") === "on";
    data.interdireScientifiquesConsecutifs = formData.get("interdireScientifiquesConsecutifs") === "on";
    data.eviterSeanceIsoleeEnseignant = formData.get("eviterSeanceIsoleeEnseignant") === "on";
    data.limiterDisciplineParDemiJournee = formData.get("limiterDisciplineParDemiJournee") === "on";
    data.eviterMemeDisciplineFinJournee = formData.get("eviterMemeDisciplineFinJournee") === "on";
  }
  // Parité des indices de classes ayant cours le matin en double vacation.
  if (formData.has("doubleVacationMatin")) {
    const v = String(formData.get("doubleVacationMatin"));
    data.doubleVacationMatin = v === "pairs" ? "pairs" : "impairs";
  }
  // Plages sans cours de l'établissement (jour / demi-journée) : liste JSON validée
  // (validateur partagé avec l'import de configuration).
  if (formData.has("plagesSansCours")) {
    try {
      const plages = validerPlagesSansCours(JSON.parse(String(formData.get("plagesSansCours") ?? "[]")));
      if (!plages) return { ok: false, message: "Plages sans cours invalides." };
      // Niveaux ciblés bornés au PÉRIMÈTRE de l'établissement (national + niveaux propres),
      // masqués COMPRIS : un niveau retiré de l'affichage garde ses classes, la plage doit
      // donc survivre (le générateur la respecte). Un id inconnu ou étranger est retiré ;
      // une entrée dont TOUS les niveaux seraient invalides est supprimée (jamais
      // requalifiée « tout l'établissement » par accident). Re-dédupliqué APRÈS bornage :
      // deux entrées qui convergent sur les mêmes niveaux n'en font plus qu'une.
      const idsNiveauxPerimetre = new Set(
        (
          await prisma.niveau.findMany({
            where: { OR: [{ etablissementId: null }, { etablissementId: id }] },
            select: { id: true },
          })
        ).map((n) => n.id),
      );
      const vusApresBornage = new Set<string>();
      const nettoyees: typeof plages = [];
      for (const p of plages) {
        let entree = p;
        if (p.niveauIds && p.niveauIds.length > 0) {
          const retenus = p.niveauIds.filter((n) => idsNiveauxPerimetre.has(n));
          if (retenus.length === 0) continue;
          entree = { ...p, niveauIds: retenus };
        }
        const cle = `${entree.jour}:${entree.moment}:${[...(entree.niveauIds ?? [])].sort().join("|")}`;
        if (vusApresBornage.has(cle)) continue;
        vusApresBornage.add(cle);
        nettoyees.push(entree);
      }
      data.plagesSansCours = nettoyees;
    } catch {
      return { ok: false, message: "Plages sans cours illisibles." };
    }
  }
  // Paramètres conditionnels de double vacation (élèves) : liste JSON flexible
  // (validateur partagé avec l'import de configuration).
  if (formData.has("conditionsVacation")) {
    try {
      const conditions = validerConditionsVacation(JSON.parse(String(formData.get("conditionsVacation") ?? "[]")));
      if (!conditions) return { ok: false, message: "Paramètres de vacation invalides." };
      data.conditionsVacation = conditions;
    } catch {
      return { ok: false, message: "Paramètres de vacation illisibles." };
    }
  }
  // Régime de notation de l'établissement : trimestriel, semestriel ou séquentiel (6 ou 8).
  if (formData.has("regimeNotation")) {
    const regime = String(formData.get("regimeNotation"));
    if (!["trimestre", "semestre", "sequence"].includes(regime)) {
      return { ok: false, message: "Régime de notation invalide." };
    }
    data.regimeNotation = regime;
    data.nbSequences = regime === "sequence" ? (Number(formData.get("nbSequences")) === 8 ? 8 : 6) : null;
  }

  // Sécurité (cloisonnement pays) : seul l'admin système peut changer le PAYS d'un établissement,
  // et la région choisie par un gestionnaire doit rester dans le pays de l'établissement — sinon un
  // Super Admin / chef pourrait « déplacer » l'établissement (pays) ou le faire apparaître dans le
  // périmètre d'un DRENA d'un autre pays (via une région étrangère).
  if (u.roleReel !== "admin") {
    delete data.pays;
    if (typeof data.regionId === "string" && data.regionId) {
      const [region, etab] = await Promise.all([
        prisma.region.findUnique({ where: { id: data.regionId }, select: { pays: true } }),
        prisma.etablissement.findUnique({ where: { id }, select: { pays: true } }),
      ]);
      if (!region || !etab || region.pays !== etab.pays) {
        return { ok: false, message: "La direction régionale choisie n'appartient pas au pays de l'établissement." };
      }
    }
  }

  if (Object.keys(data).length === 0) return { ok: true };

  // Champs qui servent d'INTRANT au solveur : si l'un d'eux CHANGE réellement de valeur,
  // l'emploi du temps généré devient obsolète (il a été calculé sous l'ancienne config). On
  // le purge alors — ce qui protège aussi les corrections automatiques de l'IA d'être
  // silencieusement annulées par un formulaire resté ouvert qui re-poste d'anciennes valeurs.
  const CLES_GENERATION = new Set([
    "plagesSansCours", "conditionsVacation", "epsMatinDebut", "epsMatinFin", "epsApresMidiDebut",
    "epsApresMidiFin", "epsDemiJourneeOpposee", "salleFixeParClasse", "doubleVacationMatin",
    "reposEnseignant", "regrouperHeuresCreuses", "autoriserHeuresCreuses", "creneauxParJour",
    "nbSallesDisponibles", "horaireDebutMatin", "horairePauseMatinDebut", "horairePauseMatinFin",
    "horairePauseMidiDebut", "horaireRepriseApresMidi", "horaireFinJournee",
    "interdireMemeDisciplineConsecutive", "interdireLitterairesConsecutifs",
    "interdireScientifiquesConsecutifs", "eviterSeanceIsoleeEnseignant",
    "limiterDisciplineParDemiJournee", "eviterMemeDisciplineFinJournee",
  ]);

  try {
    let edtObsolete = false;
    const clesGen = Object.keys(data).filter((k) => CLES_GENERATION.has(k));
    if (clesGen.length > 0) {
      const avant = (await prisma.etablissement.findUnique({ where: { id } })) as Record<string, unknown> | null;
      if (avant) {
        const norm = (v: unknown) => (v && typeof v === "object" ? JSON.stringify(v) : v);
        edtObsolete = clesGen.some((k) => norm(avant[k]) !== norm(data[k]));
      }
    }
    await prisma.$transaction([
      prisma.etablissement.update({
        where: { id },
        // Un EDT obsolète purgé emporte son rapport de qualité (et les corrections IA jointes).
        data: { ...data, ...(edtObsolete ? { qualiteEdt: Prisma.DbNull } : {}) } as never,
      }),
      ...(edtObsolete ? [prisma.creneau.deleteMany({ where: { etablissementId: id } })] : []),
    ]);
    revalidatePath(`/app/systeme/etablissements/${id}`);
    if (edtObsolete) revalidatePath(`/app/systeme/etablissements/${id}/emploi-du-temps`);
    return {
      ok: true,
      message: edtObsolete
        ? "Enregistré. L'emploi du temps généré a été réinitialisé (la configuration a changé — à régénérer)."
        : "Enregistré.",
    };
  } catch (e) {
    console.error("[config] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ── Calcul des classes pédagogiques (effectif / effectif souhaité) ──
function lettreClasse(i: number): string {
  let s = "";
  let x = i + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/**
 * Enregistre les effectifs et vacations saisis par niveau — SANS recalculer les classes
 * (permet de sauvegarder au fur et à mesure ; « Calculer les classes pédagogiques »
 * synchronise ensuite les classes quand tout est renseigné).
 */
export async function enregistrerEffectifsNiveaux(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    // Indexation des classes (« @ » lettres / « # » chiffres) : persistée dès l'enregistrement.
    const indexation = String(formData.get("indexationClasses") ?? "");
    if (indexation === "@" || indexation === "#") {
      await prisma.etablissement.update({ where: { id }, data: { indexationClasses: indexation } });
    }
    // Cloisonnement : seuls les niveaux VISIBLES par cet établissement sont configurables
    // (un id de niveau étranger posté dans le formulaire est ignoré).
    const niveaux = await prisma.niveau.findMany({ where: await filtreNiveauxVisibles(id), select: { id: true } });
    let enregistres = 0;
    for (const niveau of niveaux) {
      if (!formData.has(`effectif_${niveau.id}`)) continue; // niveau absent du formulaire
      const effectif = n(formData, `effectif_${niveau.id}`, 0);
      const vacation = String(formData.get(`vacation_${niveau.id}`) ?? "simple");
      if (effectif <= 0) {
        await prisma.niveauEtablissement.deleteMany({ where: { etablissementId: id, niveauId: niveau.id } });
        continue;
      }
      // Effectif indicatif PAR CLASSE de ce niveau : mis à jour seulement si le champ est présent
      // dans le formulaire (un onglet ouvert avant cette évolution ne doit pas l'effacer).
      const aEffectifClasse = formData.has(`effectifClasse_${niveau.id}`);
      const effectifSouhaiteClasse = effectifClasseSaisi(formData, niveau.id);
      await prisma.niveauEtablissement.upsert({
        where: { etablissementId_niveauId: { etablissementId: id, niveauId: niveau.id } },
        // nbClasses inchangé : les classes ne sont synchronisées qu'au calcul.
        update: { effectif, vacation: vacation as never, ...(aEffectifClasse ? { effectifSouhaiteClasse } : {}) },
        create: { etablissementId: id, niveauId: niveau.id, effectif, vacation: vacation as never, effectifSouhaiteClasse },
      });
      enregistres++;
    }
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return {
      ok: true,
      message: `Effectifs enregistrés (${enregistres} niveau(x) renseigné(s)) — les classes seront synchronisées au calcul.`,
    };
  } catch (e) {
    console.error("[effectifs niveaux] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

export async function calculerClasses(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    if (!etab) return { ok: false, message: "Établissement introuvable." };
    const effectifSouhaite = Math.max(1, etab.effectifSouhaiteParClasse);

    // Indexation des classes : « @ » = lettres (6ème A…), « # » = chiffres (6ème 1…).
    const indexationBrute = String(formData.get("indexationClasses") ?? "");
    const indexation =
      indexationBrute === "@" || indexationBrute === "#"
        ? indexationBrute
        : etab.indexationClasses === "#"
          ? "#"
          : "@";
    if ((indexationBrute === "@" || indexationBrute === "#") && indexationBrute !== etab.indexationClasses) {
      await prisma.etablissement.update({ where: { id }, data: { indexationClasses: indexation } });
    }
    const indice = (k: number) => (indexation === "#" ? String(k + 1) : lettreClasse(k));
    const niveaux = await niveauxVisibles(id); // cloisonnement : national non masqué + propres
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });

    let totalClasses = 0;
    let modifie = false; // le jeu de classes a-t-il changé ? (invalide l'emploi du temps)
    for (const niveau of niveaux) {
      const effectif = n(formData, `effectif_${niveau.id}`, 0);
      const vacation = String(formData.get(`vacation_${niveau.id}`) ?? "simple");

      // Classes existantes de ce niveau (avec le nb d'inscrits, pour supprimer en priorité les vides).
      const existantes = await prisma.classe.findMany({
        where: { etablissementId: id, niveauId: niveau.id },
        select: { id: true, creeLe: true, regimeVacation: true, _count: { select: { inscriptions: true } } },
      });
      // Un changement de RÉGIME DE VACATION (même à nombre de classes constant) rend l'EDT
      // obsolète — y compris quand un formulaire resté ouvert re-poste l'ancienne valeur alors
      // que l'IA avait basculé ce niveau en vacation simple pour générer l'emploi du temps.
      if (effectif > 0 && existantes.some((c) => c.regimeVacation !== vacation)) modifie = true;

      if (effectif <= 0) {
        // Niveau vidé : on supprime sa config ET ses classes.
        if (existantes.length > 0) {
          await prisma.classe.deleteMany({ where: { etablissementId: id, niveauId: niveau.id } });
          modifie = true;
        }
        await prisma.niveauEtablissement.deleteMany({ where: { etablissementId: id, niveauId: niveau.id } });
        continue;
      }

      // Effectif souhaité par classe : la valeur GLOBALE de l'établissement (« Effectif
      // souhaité / classe », bloc Dimensionnement) est PRIORITAIRE par défaut ; la valeur
      // PROPRE au niveau (colonne « Effectif / classe », indicative, de second rang)
      // s'applique au calcul quand elle est renseignée pour CE niveau.
      const aEffectifClasse = formData.has(`effectifClasse_${niveau.id}`);
      const effectifSouhaiteClasse = effectifClasseSaisi(formData, niveau.id);
      const cibleParClasse = effectifSouhaiteClasse ?? effectifSouhaite;

      const nbClasses = Math.ceil(effectif / cibleParClasse);
      totalClasses += nbClasses;
      const effectifParClasse = Math.round(effectif / nbClasses);

      await prisma.niveauEtablissement.upsert({
        where: { etablissementId_niveauId: { etablissementId: id, niveauId: niveau.id } },
        update: { effectif, vacation: vacation as never, nbClasses, ...(aEffectifClasse ? { effectifSouhaiteClasse } : {}) },
        create: { etablissementId: id, niveauId: niveau.id, effectif, vacation: vacation as never, nbClasses, effectifSouhaiteClasse },
      });

      // Synchronise le nombre de classes EXACTEMENT à nbClasses (création OU suppression du surplus).
      if (nbClasses > existantes.length) {
        for (let k = existantes.length; k < nbClasses; k++) {
          await prisma.classe.create({
            data: {
              nom: `${niveau.nom} ${indice(k)}`,
              etablissementId: id,
              niveauId: niveau.id,
              effectif: effectifParClasse,
              regimeVacation: vacation as never,
              anneeScolaireId: annee?.id ?? null,
            },
          });
        }
        modifie = true;
      } else if (nbClasses < existantes.length) {
        // Supprime le surplus, en priorisant les classes sans élèves, puis les plus récentes.
        const aSupprimer = [...existantes]
          .sort((a, b) => a._count.inscriptions - b._count.inscriptions || b.creeLe.getTime() - a.creeLe.getTime())
          .slice(0, existantes.length - nbClasses)
          .map((c) => c.id);
        await prisma.classe.deleteMany({ where: { id: { in: aSupprimer } } });
        modifie = true;
      }

      // Aligne l'effectif des classes restantes sur le nouveau dimensionnement.
      await prisma.classe.updateMany({
        where: { etablissementId: id, niveauId: niveau.id },
        data: { effectif: effectifParClasse, regimeVacation: vacation as never },
      });

      // Renomme les classes du niveau selon l'indexation choisie (ordre de création stable).
      const classesNiveau = await prisma.classe.findMany({
        where: { etablissementId: id, niveauId: niveau.id },
        orderBy: { creeLe: "asc" },
        select: { id: true, nom: true },
      });
      for (let k = 0; k < classesNiveau.length; k++) {
        const nomVoulu = `${niveau.nom} ${indice(k)}`;
        if (classesNiveau[k].nom !== nomVoulu) {
          await prisma.classe.update({ where: { id: classesNiveau[k].id }, data: { nom: nomVoulu } });
        }
      }
    }

    // Un changement du jeu de classes rend l'emploi du temps généré obsolète : on le purge.
    if (modifie) {
      await prisma.creneau.deleteMany({ where: { etablissementId: id } });
    }

    revalidatePath(`/app/systeme/etablissements/${id}`);
    revalidatePath(`/app/systeme/etablissements/${id}/emploi-du-temps`);
    const suffixe = modifie ? " L'emploi du temps a été réinitialisé (à régénérer)." : "";
    return { ok: true, message: `Classes calculées : ${totalClasses} division(s) au total.${suffixe}` };
  } catch (e) {
    console.error("[calcul-classes] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ── Désignation des salles et affectation aux classes pédagogiques ──

const TYPES_SALLE_VALIDES = ["ordinaire", "laboratoire", "salle_informatique", "atelier", "salle_eps", "autre"];

/**
 * Enregistre la LISTE des salles (désignation personnalisée : nom, capacité, type) et leur
 * AFFECTATION aux classes pédagogiques. En double vacation, une même salle physique peut être
 * affectée à DEUX classes (matin + après-midi). Le générateur d'emploi du temps confine alors les
 * cours de ces classes dans la salle et affiche son nom sur l'EDT. Toute modification rend l'EDT
 * généré obsolète : il est réinitialisé.
 */
export async function enregistrerSalles(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  let payload: { id?: string; nom: string; capacite: number; type: string; classeIds: string[] }[];
  try {
    const raw = JSON.parse(String(formData.get("salles") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error();
    payload = raw.map((r) => ({
      id: typeof r?.id === "string" && r.id ? r.id : undefined,
      nom: String(r?.nom ?? "").trim(),
      capacite: Math.max(0, Math.min(2000, Math.round(Number(r?.capacite) || 0))),
      type: TYPES_SALLE_VALIDES.includes(String(r?.type)) ? String(r.type) : "ordinaire",
      classeIds: Array.isArray(r?.classeIds) ? [...new Set((r.classeIds as unknown[]).map(String))] : [],
    }));
  } catch {
    return { ok: false, message: "Données des salles illisibles." };
  }

  // Validation : noms non vides et uniques, ≤ 2 classes par salle.
  const nomsVus = new Set<string>();
  for (const sa of payload) {
    if (!sa.nom) return { ok: false, message: "Chaque salle doit avoir un nom." };
    const k = sa.nom.toLowerCase();
    if (nomsVus.has(k)) return { ok: false, message: `Nom de salle en double : « ${sa.nom} ».` };
    nomsVus.add(k);
    if (sa.classeIds.length > 2) {
      return { ok: false, message: `La salle « ${sa.nom} » ne peut servir qu'à deux classes au maximum (double vacation).` };
    }
  }

  try {
    // Cloisonnement : classes de CET établissement uniquement ; une classe → au plus une salle.
    const classesEtab = await prisma.classe.findMany({ where: { etablissementId: id }, select: { id: true } });
    const idsClasses = new Set(classesEtab.map((c) => c.id));
    const classeVue = new Set<string>();
    for (const sa of payload) {
      for (const cid of sa.classeIds) {
        if (!idsClasses.has(cid)) return { ok: false, message: "Classe inconnue dans l'affectation d'une salle." };
        if (classeVue.has(cid)) return { ok: false, message: "Une classe ne peut être affectée qu'à une seule salle." };
        classeVue.add(cid);
      }
    }
    const existantes = await prisma.salle.findMany({ where: { etablissementId: id }, select: { id: true } });
    const idsExistants = new Set(existantes.map((sa) => sa.id));
    const idsPayload = new Set(payload.filter((sa) => sa.id).map((sa) => sa.id!));
    const aSupprimer = [...idsExistants].filter((sid) => !idsPayload.has(sid));

    let edtReinitialise = false;
    await prisma.$transaction(
      async (tx) => {
        // Réinitialise toutes les affectations, puis supprime les salles retirées (SET NULL par FK).
        await tx.classe.updateMany({ where: { etablissementId: id }, data: { salleAttribueeId: null } });
        if (aSupprimer.length > 0) await tx.salle.deleteMany({ where: { id: { in: aSupprimer }, etablissementId: id } });
        // Crée / met à jour chaque salle, en mémorisant son id (pour l'affectation).
        const salleId: string[] = [];
        for (const sa of payload) {
          if (sa.id && idsExistants.has(sa.id)) {
            await tx.salle.update({ where: { id: sa.id }, data: { nom: sa.nom, capacite: sa.capacite, type: sa.type as never } });
            salleId.push(sa.id);
          } else {
            const cree = await tx.salle.create({ data: { nom: sa.nom, capacite: sa.capacite, type: sa.type as never, etablissementId: id } });
            salleId.push(cree.id);
          }
        }
        // Affecte les classes à leur salle.
        for (let i = 0; i < payload.length; i++) {
          if (payload[i].classeIds.length > 0) {
            await tx.classe.updateMany({ where: { id: { in: payload[i].classeIds }, etablissementId: id }, data: { salleAttribueeId: salleId[i] } });
          }
        }
        // Règle d'application des salles attitrées : DURE (false) ou SOUPLE (true).
        await tx.etablissement.update({
          where: { id },
          data: { salleAttribueeSouple: String(formData.get("salleAttribueeSouple") ?? "") === "1" },
        });
        // Un changement de salles/affectations rend l'EDT généré obsolète : on le purge.
        const { count } = await tx.creneau.deleteMany({ where: { etablissementId: id } });
        if (count > 0) {
          await tx.etablissement.update({ where: { id }, data: { qualiteEdt: Prisma.DbNull } });
          edtReinitialise = true;
        }
      },
      { timeout: 20000 },
    );

    revalidatePath(`/app/systeme/etablissements/${id}`);
    revalidatePath(`/app/systeme/etablissements/${id}/emploi-du-temps`);
    revalidatePath(`/app/systeme/etablissements/${id}/structure`);
    const affectees = classeVue.size;
    return {
      ok: true,
      message: `${payload.length} salle(s) enregistrée(s), ${affectees} classe(s) affectée(s).${edtReinitialise ? " L'emploi du temps a été réinitialisé (à régénérer)." : ""}`,
    };
  } catch (e) {
    console.error("[salles] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ── Génération des comptes élèves depuis les effectifs par niveau ──

/** Retire les accents et ne garde que lettres et chiffres (matricules, emails). */
function slugAlphanum(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * SALLES RESSOURCES : enregistre la correspondance « discipline → type de salle spécialisée requis »
 * (laboratoire, salle info, atelier, plateau EPS). Ces cours seront routés par le générateur vers les
 * salles NOMMÉES de ce type, partagées par toutes les classes concernées (jamais deux au même créneau).
 * Cloisonnement : seules les disciplines VISIBLES par cet établissement sont acceptées.
 */
const TYPES_SALLE_SPECIALISEE = new Set(["laboratoire", "salle_informatique", "atelier", "salle_eps"]);
export async function enregistrerTypesSalleDiscipline(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  let brut: unknown;
  try {
    brut = JSON.parse(String(formData.get("mapping") ?? "[]"));
  } catch {
    return { ok: false, message: "Données illisibles." };
  }
  const entrees = Array.isArray(brut)
    ? brut.map((r) => {
        const o = r as { disciplineId?: unknown; type?: unknown };
        return { disciplineId: String(o?.disciplineId ?? ""), type: String(o?.type ?? "") };
      })
    : [];

  try {
    const [refVisibles, etabRow] = await Promise.all([
      prisma.discipline.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId: id }] },
        select: { id: true },
      }),
      prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } }),
    ]);
    const masquees = new Set(etabRow?.disciplinesMasquees ?? []);
    const visibles = new Set(refVisibles.map((d) => d.id).filter((x) => !masquees.has(x)));

    // On ne conserve que les exigences valides (discipline visible + type spécialisé connu), dédoublonnées.
    const parDiscipline = new Map<string, string>();
    for (const e of entrees) {
      if (!visibles.has(e.disciplineId)) continue;
      if (!TYPES_SALLE_SPECIALISEE.has(e.type)) continue; // « ordinaire »/vide = aucune exigence → ignoré
      parDiscipline.set(e.disciplineId, e.type);
    }
    const mapping = [...parDiscipline.entries()].map(([disciplineId, type]) => ({ disciplineId, type }));

    await prisma.etablissement.update({ where: { id }, data: { typeSalleParDiscipline: mapping } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return {
      ok: true,
      message: `${mapping.length} discipline(s) à salle spécialisée enregistrée(s). Pensez à nommer des salles de ce type et à régénérer l'emploi du temps.`,
    };
  } catch (e) {
    console.error("[types-salle-discipline] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

/**
 * Crée les comptes élèves manquants d'après l'effectif saisi par niveau et les répartit
 * équitablement entre les classes pédagogiques du niveau concerné (ordre de création
 * stable ; le reste de la division va aux premières classes). Idempotent : seuls les
 * comptes manquants sont créés, les inscriptions existantes sont conservées.
 *
 * Les comptes sont créés actifs (rôle élève, e-mail placeholder du domaine de
 * l'établissement) avec un mot de passe aléatoire inconnu : l'administrateur définit
 * ensuite le mot de passe de chaque compte remis à un élève.
 */
export async function genererComptesEleves(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const etab = await prisma.etablissement.findUnique({
      where: { id },
      select: { nom: true, anneeScolaire: true },
    });
    if (!etab) return { ok: false, message: "Établissement introuvable." };

    const roleEleve = await prisma.role.findUnique({ where: { nomTechnique: "eleve" } });
    if (!roleEleve) return { ok: false, message: "Rôle « élève » introuvable." };

    const configs = await prisma.niveauEtablissement.findMany({
      where: { etablissementId: id, effectif: { gt: 0 } },
      select: { niveauId: true, effectif: true },
    });
    if (configs.length === 0) {
      return { ok: false, message: "Aucun effectif renseigné : saisir d'abord les effectifs par niveau." };
    }

    const classes = await prisma.classe.findMany({
      where: { etablissementId: id },
      orderBy: { creeLe: "asc" },
      select: { id: true, nom: true, niveauId: true, _count: { select: { inscriptions: true } } },
    });
    const classesParNiveau = new Map<string, typeof classes>();
    for (const c of classes) {
      const liste = classesParNiveau.get(c.niveauId) ?? [];
      liste.push(c);
      classesParNiveau.set(c.niveauId, liste);
    }

    // Préfixe d'année du matricule : dernière année de « 2025-2026 » → « 26 ».
    const annees = (etab.anneeScolaire ?? "").match(/\d{4}/g);
    const anneeCourte = (annees && annees.length > 0 ? annees[annees.length - 1] : String(new Date().getFullYear())).slice(-2);
    // Le domaine intègre un fragment de l'id : deux établissements homonymes ne peuvent
    // pas produire les mêmes e-mails (base partagée, cloisonnement par périmètre).
    const domaine = `${slugAlphanum(etab.nom).toLowerCase() || "etablissement"}-${id.slice(-6).toLowerCase()}.eduweb.ci`;

    // Répartition exacte de l'effectif du niveau : les premières classes reçoivent le reste.
    interface AGenerer { email: string; matricule: string; prenoms: string; classeId: string }
    const aGenerer: AGenerer[] = [];
    let niveauxSansClasses = 0;
    let existants = 0;
    const classesTouchees = new Set<string>();
    for (const cfg of configs) {
      const classesNiveau = classesParNiveau.get(cfg.niveauId) ?? [];
      if (classesNiveau.length === 0) {
        niveauxSansClasses++;
        continue;
      }
      const k = classesNiveau.length;
      const base = Math.floor(cfg.effectif / k);
      const reste = cfg.effectif % k;
      for (let i = 0; i < k; i++) {
        const classe = classesNiveau[i];
        const cible = base + (i < reste ? 1 : 0);
        existants += Math.min(classe._count.inscriptions, cible);
        const slugClasse = slugAlphanum(classe.nom).toUpperCase();
        for (let ordinal = classe._count.inscriptions + 1; ordinal <= cible; ordinal++) {
          const numero = String(ordinal).padStart(3, "0");
          const matricule = `${anneeCourte}-${slugClasse}-${numero}`;
          aGenerer.push({
            email: `eleve.${matricule.toLowerCase()}@${domaine}`,
            matricule,
            prenoms: `${classe.nom} ${numero}`,
            classeId: classe.id,
          });
          classesTouchees.add(classe.id);
        }
      }
    }

    if (aGenerer.length === 0) {
      const complement = niveauxSansClasses > 0
        ? ` ${niveauxSansClasses} niveau(x) sans classes : calculer d'abord les classes pédagogiques.`
        : "";
      return { ok: true, message: `Les effectifs sont déjà couverts — aucun compte à générer.${complement}` };
    }

    // Un seul mot de passe aléatoire (inconnu) partagé : l'admin définira ensuite le mot
    // de passe de chaque compte remis à un élève.
    const hash = await hacherMotDePasse(randomBytes(18).toString("base64url"));
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });

    // Comptes déjà présents pour ces e-mails (génération antérieure) : réutilisés au lieu
    // d'être recréés — on ne crée alors que l'inscription manquante.
    const emails = aGenerer.map((g) => g.email);
    const dejaLa = await prisma.utilisateur.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const dejaParEmail = new Set(dejaLa.map((d) => d.email));
    const nouveaux = aGenerer.filter((g) => !dejaParEmail.has(g.email));

    const TAILLE_LOT = 500;
    for (let i = 0; i < nouveaux.length; i += TAILLE_LOT) {
      await prisma.utilisateur.createMany({
        data: nouveaux.slice(i, i + TAILLE_LOT).map((g) => ({
          email: g.email,
          motDePasseHash: hash,
          nom: "ÉLÈVE",
          prenoms: g.prenoms,
          matricule: g.matricule,
          statutCompte: "actif",
          emailVerifieLe: new Date(),
          roleActifId: roleEleve.id,
          etablissementId: id,
        })),
        skipDuplicates: true,
      });
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const idParEmail = new Map(utilisateurs.map((x) => [x.email, x.id]));

    // Ne crée pas de doublon d'inscription pour un compte réutilisé déjà inscrit
    // CETTE année scolaire (une inscription d'une année passée ne bloque pas) ; un
    // compte inscrit ailleurs n'est pas déplacé automatiquement, mais c'est signalé.
    const idsEleves = utilisateurs.map((x) => x.id);
    const inscriptionsExistantes = await prisma.inscription.findMany({
      where: { eleveId: { in: idsEleves }, ...(annee ? { anneeScolaireId: annee.id } : {}) },
      select: { eleveId: true },
    });
    const dejaInscrits = new Set(inscriptionsExistantes.map((i) => i.eleveId));

    const cibles = aGenerer
      .map((g) => ({ eleveId: idParEmail.get(g.email), classeId: g.classeId }))
      .filter((i): i is { eleveId: string; classeId: string } => Boolean(i.eleveId));
    const inscriptions = cibles.filter((i) => !dejaInscrits.has(i.eleveId));
    const nonDeplaces = cibles.length - inscriptions.length;
    for (let i = 0; i < inscriptions.length; i += TAILLE_LOT) {
      await prisma.inscription.createMany({
        data: inscriptions.slice(i, i + TAILLE_LOT).map((x) => ({
          eleveId: x.eleveId,
          classeId: x.classeId,
          anneeScolaireId: annee?.id ?? null,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath(`/app/systeme/etablissements/${id}`);
    const complements = [
      existants > 0 ? `${existants} compte(s) existant(s) conservé(s).` : "",
      nonDeplaces > 0 ? `${nonDeplaces} compte(s) réutilisé(s) déjà inscrits — non déplacés.` : "",
      niveauxSansClasses > 0
        ? `${niveauxSansClasses} niveau(x) sans classes ignoré(s) : calculer d'abord les classes pédagogiques.`
        : "",
    ].filter(Boolean).join(" ");
    return {
      ok: true,
      message: `${nouveaux.length} compte(s) élève créé(s) et ${inscriptions.length} inscription(s) réparties dans ${classesTouchees.size} classe(s).${complements ? ` ${complements}` : ""}`,
    };
  } catch (e) {
    console.error("[generation-comptes-eleves] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

/**
 * Ajoute une discipline — ou un COUPLE de disciplines (« Lettres-Anglais ») — à la liste
 * de l'établissement, depuis le bloc « Effectifs des enseignants ». Si elle existe déjà
 * dans le référentiel mais avait été retirée pour cet établissement, elle est réactivée ;
 * sinon elle est créée dans le référentiel (et rejoint la liste des compétences).
 */
/**
 * Comparaison de libellés de disciplines : casse ET accents neutralisés — la MÊME équivalence
 * que la résolution de l'import CSV (norm), sinon une expression « Francais » passerait le
 * contrôle de doublon tout en entrant en collision avec « Français » à l'import.
 */
const cleLibelle = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Expressions locales des disciplines de l'établissement ({ disciplineId: libellé }),
 * HORS disciplines masquées localement — invisibles, elles ne bloquent aucun contrôle.
 */
async function expressionsLocalesDisciplines(etablissementId: string): Promise<Record<string, string>> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { disciplinesRenommees: true, disciplinesMasquees: true },
  });
  const masquees = new Set(etab?.disciplinesMasquees ?? []);
  return Object.fromEntries(
    Object.entries((etab?.disciplinesRenommees as Record<string, unknown> | null) ?? {}).filter(
      ([k, v]) => typeof v === "string" && !masquees.has(k),
    ),
  ) as Record<string, string>;
}

export async function ajouterDisciplineReferentiel(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  // Règle LV2 (source unique lib/disciplines/lv2) : « Espagnol »/« Allemand » ajoutés ici
  // deviennent « LV2-Espagnol »/« LV2-Allemand » — jamais de variante nue recréée.
  const nom = normaliserSpecialiteLV2(String(formData.get("nom") ?? ""));
  if (nom.length < 2 || nom.length > 80) {
    return { ok: false, message: "Nom de discipline requis (2 à 80 caractères)." };
  }
  try {
    // Doublon cherché dans le PÉRIMÈTRE VISIBLE de cet établissement : le référentiel national
    // + ses propres disciplines. Une discipline homonyme appartenant à une AUTRE école ne doit ni
    // bloquer la création, ni être réutilisée ici.
    const existe = await prisma.discipline.findFirst({
      where: {
        nom: { equals: nom, mode: "insensitive" },
        OR: [{ etablissementId: null }, { etablissementId: id }],
      },
    });
    if (existe) {
      const etab = await prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } });
      if (etab?.disciplinesMasquees.includes(existe.id)) {
        await prisma.etablissement.update({
          where: { id },
          data: { disciplinesMasquees: etab.disciplinesMasquees.filter((d) => d !== existe.id) },
        });
        revalidatePath(`/app/systeme/etablissements/${id}`);
        return { ok: true, message: `« ${existe.nom} » réactivée pour cet établissement.` };
      }
      return { ok: false, message: `« ${existe.nom} » figure déjà dans la liste.` };
    }
    // Une expression LOCALE homonyme bloque aussi (deux lignes afficheraient le même libellé).
    const expressions = await expressionsLocalesDisciplines(id);
    const exprHomonyme = Object.values(expressions).find((l) => cleLibelle(l) === cleLibelle(nom));
    if (exprHomonyme) {
      return { ok: false, message: `« ${exprHomonyme} » est déjà l'expression locale d'une discipline de la liste.` };
    }
    // Créée PAR et POUR cet établissement : elle n'apparaîtra dans aucune autre école (règle
    // client de cloisonnement). Le référentiel NATIONAL (etablissementId nul) n'est alimenté que
    // par la configuration nationale, jamais depuis la page d'un établissement.
    await prisma.discipline.create({ data: { nom, couleur: "#2f7d5e", etablissementId: id } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[discipline etab] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `« ${nom} » ajoutée à la liste des compétences.` };
}

/**
 * Renomme une discipline PROPRE à cet établissement (correction d'orthographe, intitulé d'un
 * couple…). CLOISONNEMENT : une discipline du référentiel NATIONAL est partagée par toutes les
 * écoles — son renommage est réservé à la configuration nationale (administrateur) ; une
 * discipline d'une autre école est traitée comme introuvable. Le nom local suit partout dans
 * cet établissement (grilles, affectations, notes…), l'identifiant ne changeant pas.
 */
export async function renommerDisciplineDepuisEtab(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const nom = String(formData.get("nom") ?? "").trim();
  if (!disciplineId) return { ok: false, message: "Discipline manquante." };
  if (nom.length < 2 || nom.length > 80) {
    return { ok: false, message: "Nom de discipline requis (2 à 80 caractères)." };
  }
  try {
    const discipline = await prisma.discipline.findUnique({
      where: { id: disciplineId },
      select: { nom: true, etablissementId: true },
    });
    if (!discipline || (discipline.etablissementId !== null && discipline.etablissementId !== id)) {
      return { ok: false, message: "Discipline introuvable." };
    }
    if (discipline.etablissementId === null) {
      // Référentiel NATIONAL partagé : la ligne n'est JAMAIS modifiée depuis un établissement.
      // Le crayon pose une EXPRESSION LOCALE ({ disciplineId: libellé } sur l'établissement) :
      // seul l'affichage de CET établissement change ; revenir au nom national retire l'entrée.
      // Une expression locale ne change JAMAIS la structure : « / » créerait un pseudo-couple
      // de spécialités (regroupements et bilans découpent les couples sur ce caractère).
      if (nom.includes("/")) {
        return { ok: false, message: "L'expression locale ne peut pas contenir « / » (réservé aux couples de spécialités)." };
      }
      const etab = await prisma.etablissement.findUnique({
        where: { id },
        select: { disciplinesRenommees: true, disciplinesMasquees: true },
      });
      if (!etab) return { ok: false, message: "Établissement introuvable." };
      const renommages = Object.fromEntries(
        Object.entries((etab.disciplinesRenommees as Record<string, unknown> | null) ?? {}).filter(
          ([, v]) => typeof v === "string",
        ),
      ) as Record<string, string>;

      // Revenir au nom canonique retire l'entrée — TOUJOURS possible (jamais bloqué par un
      // homonyme apparu entre-temps : l'expression locale ne doit pas devenir irréversible).
      if (cleLibelle(nom) === cleLibelle(discipline.nom)) {
        delete renommages[disciplineId];
        await prisma.etablissement.update({ where: { id }, data: { disciplinesRenommees: renommages } });
        revalidatePath(`/app/systeme/etablissements/${id}`);
        return { ok: true, message: `« ${discipline.nom} » : expression nationale rétablie.` };
      }

      // Doublon cherché parmi les EXPRESSIONS VISIBLES ici (nom local sinon nom canonique),
      // hors disciplines masquées localement (invisibles, elles ne bloquent pas).
      const visibles = await prisma.discipline.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId: id }] },
        select: { id: true, nom: true },
      });
      const doublonLocal = visibles.find(
        (d) =>
          d.id !== disciplineId &&
          !etab.disciplinesMasquees.includes(d.id) &&
          cleLibelle(renommages[d.id] ?? d.nom) === cleLibelle(nom),
      );
      if (doublonLocal) {
        return { ok: false, message: `La discipline « ${renommages[doublonLocal.id] ?? doublonLocal.nom} » existe déjà.` };
      }

      renommages[disciplineId] = nom;
      await prisma.etablissement.update({ where: { id }, data: { disciplinesRenommees: renommages } });
      revalidatePath(`/app/systeme/etablissements/${id}`);
      return {
        ok: true,
        message: `« ${discipline.nom} » s'affichera « ${nom} » dans cet établissement (le référentiel national reste inchangé).`,
      };
    }
    // Règle LV2 : renommer une discipline PROPRE en « Espagnol »/« Allemand » vaut « LV2-x »
    // (symétrie avec l'ajout — jamais de variante nue recréée) ; la nationale homonyme fera
    // alors refuser le renommage par le contrôle de doublon ci-dessous.
    const nomPropre = normaliserSpecialiteLV2(nom);
    // Doublon cherché dans le PÉRIMÈTRE VISIBLE (national + propres) — jamais dans les autres
    // écoles (leurs noms de disciplines ne doivent ni bloquer, ni être révélés).
    const doublon = await prisma.discipline.findFirst({
      where: {
        nom: { equals: nomPropre, mode: "insensitive" },
        id: { not: disciplineId },
        OR: [{ etablissementId: null }, { etablissementId: id }],
      },
    });
    if (doublon) return { ok: false, message: `La discipline « ${doublon.nom} » existe déjà.` };
    // Une expression LOCALE homonyme d'une autre discipline bloque aussi le renommage.
    const expressions = await expressionsLocalesDisciplines(id);
    const exprDoublon = Object.entries(expressions).find(
      ([dId, libelle]) => dId !== disciplineId && cleLibelle(libelle) === cleLibelle(nomPropre),
    );
    if (exprDoublon) {
      return { ok: false, message: `« ${exprDoublon[1]} » est déjà l'expression locale d'une discipline de la liste.` };
    }
    await prisma.discipline.update({ where: { id: disciplineId }, data: { nom: nomPropre } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return { ok: true, message: `Discipline renommée en « ${nomPropre} » pour cet établissement.` };
  } catch (e) {
    console.error("[discipline etab] renommage :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Retire une discipline de la liste de CET établissement (particularité locale) :
 * la ligne disparaît du tableau des effectifs et ses effectifs déclarés sont effacés.
 * Le référentiel national et les autres établissements ne sont pas touchés — la
 * discipline peut être réactivée à tout moment en la ré-ajoutant par son nom.
 */
export async function retirerDisciplineEtablissement(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  if (!disciplineId) return { ok: false, message: "Discipline manquante." };

  try {
    const [discipline, etab] = await Promise.all([
      prisma.discipline.findUnique({ where: { id: disciplineId }, select: { nom: true } }),
      prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } }),
    ]);
    if (!discipline || !etab) return { ok: false, message: "Discipline ou établissement introuvable." };

    await prisma.$transaction([
      prisma.etablissement.update({
        where: { id },
        data: {
          disciplinesMasquees: etab.disciplinesMasquees.includes(disciplineId)
            ? etab.disciplinesMasquees
            : [...etab.disciplinesMasquees, disciplineId],
        },
      }),
      prisma.effectifEnseignant.deleteMany({ where: { etablissementId: id, disciplineId } }),
    ]);
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return {
      ok: true,
      message: `« ${discipline.nom} » retirée de la liste de cet établissement (ré-ajoutez-la par son nom pour la réactiver).`,
    };
  } catch (e) {
    console.error("[discipline etab] retrait :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Effectifs des enseignants par cycle et discipline (intrant du solveur) ──
export async function enregistrerEffectifsEnseignants(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    // CLOISONNEMENT : seules les disciplines VISIBLES ici (référentiel national + celles de
    // CET établissement, HORS masquées localement) sont acceptées — un id forgé (autre école,
    // inexistant, ou retiré de la liste par un collègue pendant la saisie) est ignoré, et
    // aucune violation FK ne peut plus interrompre l'enregistrement à mi-course.
    const [refVisibles, etabMasques] = await Promise.all([
      prisma.discipline.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId: id }] },
        select: { id: true },
      }),
      prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } }),
    ]);
    const masquees = new Set(etabMasques?.disciplinesMasquees ?? []);
    const visibles = new Set(refVisibles.map((d) => d.id).filter((x) => !masquees.has(x)));

    // UNE seule écriture par (discipline, cycle) : les saisies des sous-lignes LV2 (effvar_)
    // priment sur un éventuel doublon eff_ visant la même discipline — jamais deux upserts
    // concurrents sur la même clé unique (issue non déterministe).
    const aEnregistrer = new Map<string, { disciplineId: string; cycle: "college" | "lycee"; nombre: number }>();
    for (const [cle, val] of formData.entries()) {
      if (!cle.startsWith("eff_")) continue;
      const rest = cle.slice(4); // "<cycle>_<disciplineId>"
      const sep = rest.indexOf("_");
      if (sep < 0) continue;
      const cycle = rest.slice(0, sep);
      const disciplineId = rest.slice(sep + 1);
      if (cycle !== "college" && cycle !== "lycee") continue;
      if (!visibles.has(disciplineId)) continue;
      const nombre = Math.max(0, Math.round(Number(val) || 0));
      aEnregistrer.set(`${disciplineId}:${cycle}`, { disciplineId, cycle, nombre });
    }

    // Sous-lignes LV2 VIRTUELLES (« effvar_<cycle>_<espagnol|allemand> ») : la variante n'existe
    // pas encore pour cet établissement — elle est créée (ou réactivée si masquée) dès qu'un
    // effectif non nul est déclaré, puis ses effectifs sont enregistrés comme les autres lignes.
    const VARIANTES_LV2 = new Map<string, string>([
      ["espagnol", "LV2-Espagnol"],
      ["allemand", "LV2-Allemand"],
    ]);
    const declarations = new Map<string, { college: number; lycee: number }>();
    for (const [cle, val] of formData.entries()) {
      if (!cle.startsWith("effvar_")) continue;
      const rest = cle.slice(7);
      const sep = rest.indexOf("_");
      if (sep < 0) continue;
      const cycle = rest.slice(0, sep);
      const variante = rest.slice(sep + 1);
      if ((cycle !== "college" && cycle !== "lycee") || !VARIANTES_LV2.has(variante)) continue;
      const cur = declarations.get(variante) ?? { college: 0, lycee: 0 };
      cur[cycle] = Math.max(0, Math.round(Number(val) || 0));
      declarations.set(variante, cur);
    }
    const nonCreees: string[] = [];
    for (const [variante, nombres] of declarations) {
      if (nombres.college <= 0 && nombres.lycee <= 0) continue; // rien déclaré → rien créé
      const nomCible = VARIANTES_LV2.get(variante)!;
      let cible = await prisma.discipline.findFirst({
        where: { nom: { equals: nomCible, mode: "insensitive" }, OR: [{ etablissementId: null }, { etablissementId: id }] },
        select: { id: true },
      });
      if (!cible) {
        try {
          cible = await prisma.discipline.create({
            data: { nom: nomCible, couleur: "#2f7d5e", etablissementId: id },
            select: { id: true },
          });
        } catch {
          // Course avec une autre écriture : l'unicité (etablissementId, nom) a tranché — relire.
          cible = await prisma.discipline.findFirst({
            where: { nom: { equals: nomCible, mode: "insensitive" }, OR: [{ etablissementId: null }, { etablissementId: id }] },
            select: { id: true },
          });
        }
      }
      if (!cible) {
        // Échec RÉEL de création (incident technique) : signalé — jamais avalé en faux succès.
        nonCreees.push(nomCible);
        continue;
      }
      const cibleId = cible.id;
      // Réactive la variante si elle avait été retirée localement (sinon la ligne resterait cachée).
      const etabRow = await prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } });
      if (etabRow?.disciplinesMasquees.includes(cibleId)) {
        await prisma.etablissement.update({
          where: { id },
          data: { disciplinesMasquees: etabRow.disciplinesMasquees.filter((x) => x !== cibleId) },
        });
      }
      for (const cycle of ["college", "lycee"] as const) {
        aEnregistrer.set(`${cibleId}:${cycle}`, { disciplineId: cibleId, cycle, nombre: nombres[cycle] });
      }
    }

    const ops: Promise<unknown>[] = [...aEnregistrer.values()].map((x) =>
      prisma.effectifEnseignant.upsert({
        where: { etablissementId_disciplineId_cycle: { etablissementId: id, disciplineId: x.disciplineId, cycle: x.cycle } },
        update: { nombre: x.nombre },
        create: { etablissementId: id, disciplineId: x.disciplineId, cycle: x.cycle, nombre: x.nombre },
      }),
    );
    // Volumes horaires hebdomadaires dus par enseignant (plafond de service pour le solveur).
    const vol1 = Math.max(0, Math.round(Number(formData.get("volume_1er_cycle")) || 0));
    const vol2 = Math.max(0, Math.round(Number(formData.get("volume_2nd_cycle")) || 0));
    ops.push(
      prisma.etablissement.update({
        where: { id },
        data: { volumeHoraire1erCycle: vol1, volumeHoraire2ndCycle: vol2 },
      }),
    );
    await Promise.all(ops);
    revalidatePath(`/app/systeme/etablissements/${id}`);
    const alerte =
      nonCreees.length > 0
        ? ` Attention : ${nonCreees.join(" et ")} n'a/n'ont pas pu être créée(s) (incident technique) — resaisissez ces effectifs.`
        : "";
    return { ok: true, message: `Effectifs des enseignants enregistrés.${alerte}` };
  } catch (e) {
    console.error("[effectifs-enseignants] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ── Gestion manuelle des classes ──
export async function ajouterClasse(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const niveauId = String(formData.get("niveauId") ?? "");
  if (!id || !niveauId) return;
  const u = await peutGerer(id);
  if (!u) return;
  try {
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });
    const niveau = await prisma.niveau.findUnique({ where: { id: niveauId } });
    // Cloisonnement : le niveau doit être visible par CET établissement (national ou propre).
    if (!niveau || (niveau.etablissementId !== null && niveau.etablissementId !== id)) return;
    const nb = await prisma.classe.count({ where: { etablissementId: id, niveauId } });
    const nomSaisi = s(formData, "nom");
    await prisma.classe.create({
      data: {
        nom: nomSaisi || `${niveau.nom} ${lettreClasse(nb)}`,
        etablissementId: id,
        niveauId,
        effectif: etab?.effectifSouhaiteParClasse ?? 40,
        anneeScolaireId: annee?.id ?? null,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[ajouter-classe] erreur :", e);
  }
}

export async function supprimerClasse(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const classeId = String(formData.get("classeId") ?? "");
  if (!id || !classeId) return;
  const u = await peutGerer(id);
  if (!u) return;
  try {
    const c = await prisma.classe.findUnique({ where: { id: classeId } });
    if (!c || c.etablissementId !== id) return;
    await prisma.classe.delete({ where: { id: classeId } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[supprimer-classe] erreur :", e);
  }
}

// ── Gestion des niveaux (lignes du tableau « Effectif par niveau ») ──
/**
 * Déplace un NIVEAU dans l'ordre d'affichage, pour CET établissement seulement
 * (« faire remonter 6ème en tête »).
 *
 * L'ordre est stocké sur `NiveauEtablissement.ordre` et non sur `Niveau.ordre` : la table des
 * niveaux est PARTAGÉE par toutes les écoles, y toucher réordonnerait les onglets de chacune.
 *
 * `ordreActuel` est la liste des identifiants DANS L'ORDRE VU par l'utilisateur : on la réordonne
 * puis on écrit un rang pour chaque niveau. Écrire toute la séquence (et pas seulement les deux
 * lignes permutées) évite les rangs en double quand des niveaux n'avaient encore aucun ordre local.
 */
export async function deplacerNiveau(
  etablissementId: string,
  niveauId: string,
  direction: "gauche" | "droite",
  ordreActuel: string[],
): Promise<{ ok: boolean; message?: string }> {
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  // Cloisonnement : un niveau étranger (id forgé) ne doit pas créer de ligne locale pendante.
  if (!(await niveauVisiblePour(niveauId, etablissementId))) return { ok: false, message: "Niveau introuvable." };
  const i = ordreActuel.indexOf(niveauId);
  const j = direction === "gauche" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordreActuel.length) return { ok: true }; // déjà en bout de file
  const nouveau = [...ordreActuel];
  [nouveau[i], nouveau[j]] = [nouveau[j], nouveau[i]];
  try {
    await prisma.$transaction(
      nouveau.map((id, rang) =>
        prisma.niveauEtablissement.upsert({
          where: { etablissementId_niveauId: { etablissementId, niveauId: id } },
          update: { ordre: rang },
          // La ligne peut ne pas exister encore (niveau jamais configuré ici) : on la crée avec
          // ses valeurs par défaut, sans toucher aux effectifs.
          create: { etablissementId, niveauId: id, ordre: rang },
        }),
      ),
    );
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true };
  } catch (e) {
    console.error("[deplacer-niveau] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Renomme un NIVEAU pour CET établissement seulement (« 6ème » → « 6e »).
 *
 * Écrit sur `NiveauEtablissement.nomAffiche`, jamais sur `Niveau.nom` : ce dernier est le nom
 * canonique national, partagé par toutes les écoles. Un nom vide efface le libellé local et
 * rétablit le nom canonique. Aucune unicité imposée : deux niveaux peuvent porter des libellés
 * distincts, et deux établissements le même — c'est un simple affichage.
 */
export async function renommerNiveau(
  etablissementId: string,
  niveauId: string,
  nom: string,
): Promise<{ ok: boolean; message?: string }> {
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  // Cloisonnement : refuser un id de niveau étranger (pas de nomAffiche local pendant).
  if (!(await niveauVisiblePour(niveauId, etablissementId))) return { ok: false, message: "Niveau introuvable." };
  const nomAffiche = nom.trim().slice(0, 60) || null;
  try {
    await prisma.niveauEtablissement.upsert({
      where: { etablissementId_niveauId: { etablissementId, niveauId } },
      update: { nomAffiche },
      // La ligne peut ne pas exister encore (niveau jamais configuré ici) : créée sans toucher
      // aux effectifs ni à l'ordre.
      create: { etablissementId, niveauId, nomAffiche },
    });
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true };
  } catch (e) {
    console.error("[renommer-niveau] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Ajoute un niveau à la liste de CET établissement. CLOISONNEMENT (même règle que les
 * disciplines) : le niveau est créé PAR et POUR cet établissement — le référentiel NATIONAL
 * (etablissementId nul) n'est jamais alimenté depuis la console d'une école. Un niveau
 * national homonyme masqué localement est simplement réactivé.
 */
export async function ajouterNiveau(
  etablissementId: string,
  nom: string,
  cycleBrut: string,
): Promise<{ ok: boolean; message?: string }> {
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  const nomT = nom.trim();
  if (!nomT) return { ok: false, message: "Nom du niveau requis." };
  const cycle =
    cycleBrut === "college" || cycleBrut === "primaire" || cycleBrut === "prescolaire" ? cycleBrut : "lycee";
  try {
    // Doublon cherché dans le PÉRIMÈTRE VISIBLE : national + niveaux propres. Un niveau
    // homonyme créé par une AUTRE école ne bloque pas (il est invisible ici).
    const existe = await prisma.niveau.findFirst({
      where: {
        nom: { equals: nomT, mode: "insensitive" },
        OR: [{ etablissementId: null }, { etablissementId }],
      },
    });
    if (existe) {
      if (existe.etablissementId === null) {
        const etab = await prisma.etablissement.findUnique({
          where: { id: etablissementId },
          select: { niveauxMasques: true },
        });
        if (etab?.niveauxMasques.includes(existe.id)) {
          // Niveau national retiré localement : le ré-ajouter = le réactiver.
          await prisma.etablissement.update({
            where: { id: etablissementId },
            data: { niveauxMasques: etab.niveauxMasques.filter((n) => n !== existe.id) },
          });
          revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
          return { ok: true, message: `« ${existe.nom} » réactivé pour cet établissement.` };
        }
      }
      return { ok: false, message: "Ce niveau existe déjà." };
    }
    const max = await prisma.niveau.aggregate({ _max: { ordre: true } });
    await prisma.niveau.create({
      data: { nom: nomT, cycle: cycle as never, ordre: (max._max.ordre ?? 0) + 1, etablissementId },
    });
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true };
  } catch (e) {
    console.error("[ajouter-niveau] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * « Supprime » un niveau de la configuration de CET établissement. CLOISONNEMENT :
 * - niveau PROPRE à l'établissement : suppression réelle (invisible ailleurs, la cascade ne
 *   peut toucher que des lignes de cette école) — classes de CET établissement retirées d'abord
 *   (contrainte RESTRICT) ;
 * - niveau NATIONAL : le référentiel partagé n'est JAMAIS modifié — retrait LOCAL (masquage
 *   niveauxMasques) + purge de la configuration locale (classes, effectifs, surcharges de
 *   grille, niveaux d'intervention des enseignants de cette école) ;
 * - niveau d'une AUTRE école (id forgé) : refus.
 */
export async function supprimerNiveau(
  niveauId: string,
  etablissementId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!niveauId || !etablissementId) return { ok: false };
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  try {
    const niveau = await prisma.niveau.findUnique({
      where: { id: niveauId },
      select: { etablissementId: true, nom: true },
    });
    if (!niveau || (niveau.etablissementId !== null && niveau.etablissementId !== etablissementId)) {
      return { ok: false, message: "Niveau introuvable." };
    }
    if (niveau.etablissementId === etablissementId) {
      // Niveau propre : suppression réelle — strictement locale par construction.
      await prisma.$transaction([
        prisma.classe.deleteMany({ where: { niveauId, etablissementId } }),
        prisma.niveau.delete({ where: { id: niveauId } }),
      ]);
    } else {
      // Niveau national : retrait local uniquement.
      const etab = await prisma.etablissement.findUnique({
        where: { id: etablissementId },
        select: { niveauxMasques: true },
      });
      await prisma.$transaction([
        prisma.classe.deleteMany({ where: { niveauId, etablissementId } }),
        prisma.niveauEtablissement.deleteMany({ where: { niveauId, etablissementId } }),
        // Surcharges de grille LOCALES seulement — la grille nationale n'est pas touchée.
        prisma.grilleHoraire.deleteMany({ where: { niveauId, etablissementId } }),
        prisma.niveauEnseignant.deleteMany({ where: { niveauId, etablissementId } }),
        prisma.etablissement.update({
          where: { id: etablissementId },
          data: { niveauxMasques: [...new Set([...(etab?.niveauxMasques ?? []), niveauId])] },
        }),
      ]);
    }
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return {
      ok: true,
      message:
        niveau.etablissementId === null
          ? `« ${niveau.nom} » retiré de votre établissement (le référentiel national n'est pas modifié).`
          : undefined,
    };
  } catch (e) {
    console.error("[supprimer-niveau] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Champs personnalisés enseignants ──
export async function ajouterChamp(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  const etiquette = s(formData, "etiquette");
  if (!etiquette) return { ok: false, message: "Étiquette requise." };
  try {
    const count = await prisma.champEnseignant.count({ where: { etablissementId: id } });
    await prisma.champEnseignant.create({
      data: {
        etablissementId: id,
        etiquette,
        type: String(formData.get("type") ?? "text"),
        placeholder: s(formData, "placeholder"),
        requis: formData.get("requis") === "on",
        ordre: count,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[champ] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Champ ajouté." };
}

export async function supprimerChamp(formData: FormData) {
  const champId = String(formData.get("champId") ?? "");
  if (!champId) return;
  const champ = await prisma.champEnseignant.findUnique({ where: { id: champId } });
  if (!champ) return;
  const u = await peutGerer(champ.etablissementId);
  if (!u) return;
  await prisma.champEnseignant.delete({ where: { id: champId } });
  revalidatePath(`/app/systeme/etablissements/${champ.etablissementId}`);
}

// ── Documents officiels (Vercel Blob) ──
const CHAMPS_DOC: Record<string, "emblemeUrl" | "logoUrl" | "cachetUrl" | "signatureUrl"> = {
  embleme: "emblemeUrl",
  logo: "logoUrl",
  cachet: "cachetUrl",
  signature: "signatureUrl",
};


export async function televerserDocument(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const type = String(formData.get("type") ?? "");
  const champ = CHAMPS_DOC[type];
  if (!id || !champ) return { ok: false, message: "Paramètre invalide." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }
  if (!fichier.type.startsWith("image/")) {
    return { ok: false, message: "Le fichier doit être une image." };
  }
  if (fichier.size > TAILLE_MAX_DOCUMENT) {
    return {
      ok: false,
      message: `L'image dépasse ${TAILLE_MAX_DOCUMENT_LIBELLE} (${(fichier.size / 1024 / 1024).toFixed(1)} Mo) : réduisez-la avant de la téléverser.`,
    };
  }

  try {
    const ext = fichier.name.split(".").pop() ?? "png";
    const blob = await put(`etablissements/${id}/${type}-${Date.now()}.${ext}`, fichier, {
      access: "public",
      addRandomSuffix: true,
    });
    await prisma.etablissement.update({ where: { id }, data: { [champ]: blob.url } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[blob] erreur :", e);
    return {
      ok: false,
      message:
        "Échec du téléversement. Le stockage Blob est-il bien configuré (BLOB_READ_WRITE_TOKEN) ?",
    };
  }
  return { ok: true, message: "Image téléversée." };
}

export async function supprimerDocument(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const type = String(formData.get("type") ?? "");
  const champ = CHAMPS_DOC[type];
  if (!id || !champ) return;
  const u = await peutGerer(id);
  if (!u) return;
  await prisma.etablissement.update({ where: { id }, data: { [champ]: null } });
  revalidatePath(`/app/systeme/etablissements/${id}`);
}

// ── Import de configuration (JSON) ──
// Listes blanches et validation champ par champ : donneesImportEtablissement (module
// partagé config-transfert), miroir exact de la sérialisation d'export.

export async function importerConfiguration(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(await lireFichierTexte(fichier));
  } catch {
    return { ok: false, message: "Fichier JSON invalide." };
  }

  try {
    const e = (cfg.etablissement as Record<string, unknown>) ?? {};
    const resultat = donneesImportEtablissement(e);
    if (resultat.erreur) return { ok: false, message: resultat.erreur };
    const data = resultat.data;
    // Sécurité : seul l'admin système change le PAYS (évite le déplacement inter-pays via import de config).
    if (u.roleReel !== "admin") delete data.pays;
    if (Object.keys(data).length > 0) {
      await prisma.etablissement.update({ where: { id }, data: data as never });
    }

    if (Array.isArray(cfg.champs)) {
      await prisma.champEnseignant.deleteMany({ where: { etablissementId: id } });
      const champs = cfg.champs as Array<Record<string, unknown>>;
      if (champs.length > 0) {
        await prisma.champEnseignant.createMany({
          data: champs.map((c, i) => ({
            etablissementId: id,
            etiquette: String(c.etiquette ?? ""),
            type: String(c.type ?? "text"),
            placeholder: (c.placeholder as string) ?? null,
            requis: Boolean(c.requis),
            ordre: Number(c.ordre ?? i),
          })),
        });
      }
    }

    if (Array.isArray(cfg.niveauxConfig)) {
      for (const nc of cfg.niveauxConfig as Array<Record<string, unknown>>) {
        const niveauId = String(nc.niveauId ?? "");
        if (!niveauId) continue;
        try {
          await prisma.niveauEtablissement.upsert({
            where: { etablissementId_niveauId: { etablissementId: id, niveauId } },
            update: { effectif: Number(nc.effectif ?? 0), vacation: (nc.vacation as never) ?? "simple", nbClasses: Number(nc.nbClasses ?? 0) },
            create: { etablissementId: id, niveauId, effectif: Number(nc.effectif ?? 0), vacation: (nc.vacation as never) ?? "simple", nbClasses: Number(nc.nbClasses ?? 0) },
          });
        } catch {
          /* niveau inconnu sur cette plateforme — ignoré */
        }
      }
    }

    if (Array.isArray(cfg.grilles)) {
      for (const g of cfg.grilles as Array<Record<string, unknown>>) {
        const niveauId = String(g.niveauId ?? "");
        const disciplineId = String(g.disciplineId ?? "");
        if (!niveauId || !disciplineId) continue;
        const seances = Array.isArray(g.seancesMinutes) ? (g.seancesMinutes as number[]) : [];
        try {
          await prisma.grilleHoraire.upsert({
            where: { niveauId_disciplineId_etablissementId: { niveauId, disciplineId, etablissementId: id } },
            update: { seancesMinutes: seances, coefficient: Number(g.coefficient ?? 1), heuresHebdo: Number(g.heuresHebdo ?? 0) },
            create: { niveauId, disciplineId, etablissementId: id, seancesMinutes: seances, coefficient: Number(g.coefficient ?? 1), heuresHebdo: Number(g.heuresHebdo ?? 0) },
          });
        } catch {
          /* discipline/niveau inconnu — ignoré */
        }
      }
    }

    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[import config] erreur :", e);
    return { ok: false, message: "Échec de l'import (format ou référentiels incompatibles)." };
  }
  return { ok: true, message: "Configuration importée." };
}
