/**
 * Validateur des fichiers prisma/guides/<roleId>.json ({ guide, formation }).
 * Usage : node prisma/valider-guides.mjs [roleId]   (sans argument : tous les fichiers)
 * Sort en code 1 avec la liste des erreurs si un fichier est invalide.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DOSSIER = "prisma/guides";
const TYPES_QUESTION = ["choix_unique", "choix_multiple", "vrai_faux", "association", "texte_a_trous", "remise_en_ordre"];
const NIVEAUX = ["debutant", "intermediaire", "avance"];

function validerLeconsTexte(lecons, erreurs, prefixe) {
  if (!Array.isArray(lecons) || lecons.length === 0) {
    erreurs.push(`${prefixe} : aucune leçon.`);
    return;
  }
  lecons.forEach((l, i) => {
    if (!l?.titre) erreurs.push(`${prefixe} leçon ${i + 1} : titre manquant.`);
    const type = l?.type ?? "texte";
    if (type === "texte") {
      if (!l?.contenu || l.contenu.trim().length < 200) {
        erreurs.push(`${prefixe} leçon ${i + 1} « ${l?.titre ?? "?"} » : contenu texte trop court (< 200 caractères).`);
      }
    } else if (type === "quiz") {
      validerQuiz(l.quiz, erreurs, `${prefixe} leçon ${i + 1} « ${l?.titre ?? "?"} » (quiz)`);
    } else {
      erreurs.push(`${prefixe} leçon ${i + 1} : type inconnu « ${type} » (attendu texte | quiz).`);
    }
  });
}

function validerQuiz(quiz, erreurs, prefixe) {
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    erreurs.push(`${prefixe} : quiz sans question.`);
    return;
  }
  if (quiz.seuilReussite != null && (quiz.seuilReussite < 0 || quiz.seuilReussite > 100)) {
    erreurs.push(`${prefixe} : seuilReussite hors bornes (0–100).`);
  }
  quiz.questions.forEach((q, i) => {
    const ref = `${prefixe} Q${i + 1}`;
    if (!q?.enonce) erreurs.push(`${ref} : énoncé manquant.`);
    if (!TYPES_QUESTION.includes(q?.type)) {
      erreurs.push(`${ref} : type « ${q?.type} » inconnu (${TYPES_QUESTION.join(", ")}).`);
      return;
    }
    const choix = Array.isArray(q.choix) ? q.choix : [];
    if (q.type === "association") {
      const paires = choix.filter((c) => c?.texte && c?.apparie);
      if (paires.length < 2) erreurs.push(`${ref} (association) : au moins 2 paires texte+apparie requises.`);
      if (paires.length !== choix.length) erreurs.push(`${ref} (association) : chaque choix doit avoir texte ET apparie.`);
    } else if (q.type === "texte_a_trous") {
      if (choix.length < 1) erreurs.push(`${ref} (trous) : au moins 1 réponse de trou requise.`);
      if (choix.some((c) => !c?.texte)) erreurs.push(`${ref} (trous) : chaque trou doit avoir sa réponse (texte).`);
      const nbMarqueurs = (String(q.enonce ?? "").match(/___/g) ?? []).length;
      if (nbMarqueurs !== choix.length) {
        erreurs.push(`${ref} (trous) : ${nbMarqueurs} marqueur(s) « ___ » dans l'énoncé pour ${choix.length} trou(s) — ils doivent correspondre.`);
      }
    } else if (q.type === "remise_en_ordre") {
      if (choix.length < 2) erreurs.push(`${ref} (ordre) : au moins 2 éléments à ordonner.`);
      if (choix.some((c) => !c?.texte)) erreurs.push(`${ref} (ordre) : chaque élément doit avoir un texte.`);
    } else {
      // choix_unique | choix_multiple | vrai_faux
      if (choix.length < 2) erreurs.push(`${ref} : au moins 2 propositions.`);
      const corrects = choix.filter((c) => c?.correct === true).length;
      if (corrects === 0) erreurs.push(`${ref} : aucune bonne réponse cochée.`);
      if (q.type !== "choix_multiple" && corrects > 1) erreurs.push(`${ref} : une seule bonne réponse attendue pour ${q.type}.`);
      if (q.type === "vrai_faux" && choix.length !== 2) erreurs.push(`${ref} (vrai_faux) : exactement 2 propositions attendues.`);
    }
    if (!q.explication || String(q.explication).trim().length < 20) {
      erreurs.push(`${ref} : explication pédagogique manquante ou trop courte (< 20 caractères).`);
    }
  });
}

function validerFichier(chemin) {
  const erreurs = [];
  let data;
  try {
    data = JSON.parse(readFileSync(chemin, "utf8"));
  } catch (e) {
    return [`${chemin} : JSON invalide — ${e.message}`];
  }
  const { guide, formation } = data ?? {};
  if (!guide?.roleId) erreurs.push(`${chemin} : guide.roleId manquant.`);
  if (!guide?.titre) erreurs.push(`${chemin} : guide.titre manquant.`);
  if (guide?.niveau && !NIVEAUX.includes(guide.niveau)) erreurs.push(`${chemin} : guide.niveau invalide.`);
  validerLeconsTexte(guide?.lecons, erreurs, `${chemin} guide`);
  // Le guide lui-même reste 100 % texte (les quiz vivent dans la formation).
  (guide?.lecons ?? []).forEach((l, i) => {
    if ((l?.type ?? "texte") !== "texte") erreurs.push(`${chemin} guide leçon ${i + 1} : le guide ne contient que des leçons texte.`);
  });

  if (formation != null) {
    if (!formation.titre) erreurs.push(`${chemin} : formation.titre manquant.`);
    if (formation.niveau && !NIVEAUX.includes(formation.niveau)) erreurs.push(`${chemin} : formation.niveau invalide.`);
    validerLeconsTexte(formation.lecons, erreurs, `${chemin} formation`);
    const quizzes = (formation.lecons ?? []).filter((l) => l?.type === "quiz");
    if (quizzes.length < 3) erreurs.push(`${chemin} formation : au moins 3 leçons quiz attendues (formation interactive).`);
    const nbQuestions = quizzes.reduce((n, l) => n + (l.quiz?.questions?.length ?? 0), 0);
    if (nbQuestions < 12) erreurs.push(`${chemin} formation : au moins 12 questions au total attendues (${nbQuestions} trouvées).`);
    const typesUtilises = new Set(quizzes.flatMap((l) => (l.quiz?.questions ?? []).map((q) => q.type)));
    if (typesUtilises.size < 3) erreurs.push(`${chemin} formation : variez les types de questions (au moins 3 types différents).`);
  }
  return erreurs;
}

const cible = process.argv[2];
const fichiers = cible ? [join(DOSSIER, `${cible}.json`)] : readdirSync(DOSSIER).filter((f) => f.endsWith(".json")).map((f) => join(DOSSIER, f));

let total = 0;
for (const f of fichiers) {
  const erreurs = validerFichier(f);
  if (erreurs.length > 0) {
    total += erreurs.length;
    for (const e of erreurs) console.error("✗", e);
  } else {
    console.log("✓", f, "valide");
  }
}
if (total > 0) {
  console.error(`\n${total} erreur(s).`);
  process.exit(1);
}
console.log(`\nTout est valide (${fichiers.length} fichier(s)).`);
