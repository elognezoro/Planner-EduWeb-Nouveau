import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Observation (appréciation) IA d'une production SUBJECTIVE — brouillon proposé au tuteur,
 * TOUJOURS éditable. Gated par ANTHROPIC_API_KEY : si la clé est présente, Claude rédige
 * l'appréciation ET propose une note ; sinon un repli local propose un canevas (sans note).
 *
 * La note est obtenue par SORTIE STRUCTURÉE FORCÉE (tool use) : le modèle DOIT appeler l'outil
 * `proposer_evaluation` en renvoyant à la fois `appreciation_html` et `note` — ce qui garantit
 * une proposition de note à chaque fois (plus de marqueur caché omis).
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export interface EntreeObservation {
  consigne: string;
  texteApprenant: string;
  note?: number | null;
  noteSur: number;
}

/** Outil de sortie structurée : appréciation HTML + note entière sur le barème. */
function outilEvaluation(bareme: number): Anthropic.Tool {
  return {
    name: "proposer_evaluation",
    description: "Renvoie l'appréciation détaillée (HTML) et la note proposée sur le barème.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        appreciation_html: {
          type: "string",
          description: "Les trois sections rédigées en HTML simple (balises autorisées : <p>, <strong>, <ul>, <li>). Aucun autre texte.",
        },
        note: {
          type: "integer",
          minimum: 0,
          maximum: bareme,
          description: `Note ENTIÈRE proposée sur ${bareme}, déduite de l'analyse de la production (obligatoire).`,
        },
      },
      required: ["appreciation_html", "note"],
    },
  };
}

/** Appelle Claude en sortie structurée forcée et renvoie { texte, note } ou null si échec. */
async function evaluerStructure(system: string, contenu: string, bareme: number): Promise<{ texte: string; note: number | null } | null> {
  const client = new Anthropic();
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 2200,
    system,
    tools: [outilEvaluation(bareme)],
    tool_choice: { type: "tool", name: "proposer_evaluation" },
    messages: [{ role: "user", content: contenu }],
  });
  const bloc = reponse.content.find((b) => b.type === "tool_use");
  if (!bloc || bloc.type !== "tool_use") return null;
  const entree = bloc.input as { appreciation_html?: unknown; note?: unknown };
  const texte = typeof entree.appreciation_html === "string" ? entree.appreciation_html.trim() : "";
  if (!texte) return null;
  const brut = typeof entree.note === "number" ? entree.note : Number(entree.note);
  const note = Number.isFinite(brut) ? Math.max(0, Math.min(bareme, Math.round(brut))) : null;
  return { texte, note };
}

/** Canevas HTML de repli (sans clé IA) : trois sections, à compléter par l'évaluateur. */
function repliLocal(e: EntreeObservation): string {
  const mention = e.note != null ? `Note indicative : ${e.note}/${e.noteSur}. ` : "";
  const aTexte = e.texteApprenant.trim().length > 0;
  return (
    "<p><strong>Éléments de réponse attendus</strong></p>" +
    "<ul>" +
    "<li>Respect de la consigne et de tous les points demandés.</li>" +
    "<li>Exactitude et bonne application des notions du module.</li>" +
    "<li>Structure claire, argumentation étayée et exemples pertinents.</li>" +
    "</ul>" +
    "<p><strong>Analyse de la copie</strong></p>" +
    (aTexte
      ? "<p>Reprenez chaque élément attendu ci-dessus et indiquez, pour la production remise, ce qui est présent et correct, ce qui est incomplet et ce qui manque ou est erroné. (L'analyse détaillée automatique nécessite l'activation de l'IA.)</p>"
      : "<p>Aucune production écrite : évaluez le fichier joint au regard des éléments attendus ci-dessus.</p>") +
    "<p><strong>Appréciation</strong></p>" +
    `<p>${mention}Travail pris en compte. Points forts à souligner, axes d'amélioration concrets à préciser, encouragement final.</p>`
  );
}

/**
 * Suggestion d'évaluation pour une épreuve SUBJECTIVE (production libre + éventuel fichier) :
 * renvoie un BROUILLON HTML structuré en TROIS sections — « Éléments de réponse attendus »,
 * « Analyse de la copie » (avis détaillé, point par point, sur la production réelle) et
 * « Appréciation » — plus une NOTE proposée, TOUJOURS ajustables par l'évaluateur.
 */
export async function suggererObservationDevoir(e: EntreeObservation): Promise<{ texte: string; note: number | null; source: "ia" | "repli" }> {
  const repli = { texte: repliLocal(e), note: null, source: "repli" as const };
  if (!process.env.ANTHROPIC_API_KEY) return repli;

  try {
    const system =
      "Tu es tuteur-formateur dans un établissement catholique du système éducatif ivoirien (SEDEC). " +
      "Tu prépares une aide à la correction d'une épreuve SUBJECTIVE (production libre + éventuel fichier). " +
      "Tu appelles l'outil proposer_evaluation avec DEUX champs :\n" +
      "• appreciation_html : TROIS sections en HTML simple (<p>, <strong>, <ul>, <li>), structurées exactement ainsi :\n" +
      "  <p><strong>Éléments de réponse attendus</strong></p><ul>…</ul> — d'après la CONSIGNE, les points/critères qu'une bonne production doit contenir (avec un barème indicatif par point).\n" +
      "  <p><strong>Analyse de la copie</strong></p><p>…</p> (ou <ul>…</ul>) — un AVIS DÉTAILLÉ sur la production RÉELLEMENT déposée : élément attendu par élément attendu, ce qui est présent et correct, incomplet, ou manquant/erroné, en citant/paraphrasant la copie. Si aucune production TEXTE n'est fournie (fichier seul), indique que l'analyse porte sur le fichier à ouvrir et fournis une grille de vérification.\n" +
      "  <p><strong>Appréciation</strong></p><p>…</p> — synthèse bienveillante et constructive (points forts, un à trois axes d'amélioration concrets, encouragement).\n" +
      "• note : la note ENTIÈRE que tu proposes sur le barème, déduite de ton analyse (OBLIGATOIRE). " +
      "Français, pas d'emoji, pas de bloc de code.";
    const contenu =
      `Consigne du devoir :\n${e.consigne || "(non précisée)"}\n\n` +
      `Production texte déposée par l'apprenant :\n${e.texteApprenant.trim() || "(aucun texte saisi — un fichier a été joint, à ouvrir pour l'évaluer)"}\n\n` +
      `${e.note != null ? `Note envisagée par le tuteur : ${e.note}/${e.noteSur}.\n` : ""}` +
      `Barème : la note doit être sur ${e.noteSur}.`;

    const res = await evaluerStructure(system, contenu, e.noteSur);
    return res ? { texte: res.texte, note: res.note, source: "ia" } : repli;
  } catch (err) {
    console.error("[ia/observation-devoir] repli (échec API) :", err);
    return repli;
  }
}

// ── Évaluation d'une page collaborative (wiki) ────────────────────────────────

export interface EntreePageWiki {
  coursTitre: string;
  pageTitre: string;
  contenu: string;
}

function repliPageWiki(e: EntreePageWiki): string {
  return (
    "<p><strong>Critères d'évaluation</strong></p>" +
    "<ul>" +
    "<li>Pertinence et exactitude du contenu au regard du cours.</li>" +
    "<li>Clarté, structure et qualité de la rédaction collaborative.</li>" +
    "<li>Richesse (exemples, sources) et esprit de synthèse.</li>" +
    "</ul>" +
    "<p><strong>Analyse de la page</strong></p>" +
    "<p>Passez en revue le contenu de la page et indiquez points forts, imprécisions et compléments souhaitables. " +
    "(L'analyse détaillée automatique nécessite l'activation de l'IA.)</p>" +
    "<p><strong>Appréciation</strong></p>" +
    "<p>Synthèse constructive à destination des contributeurs, avec axes d'amélioration et encouragement.</p>"
  );
}

/** Avis détaillé de l'IA sur une PAGE WIKI collaborative (production subjective de groupe). Barème /20. */
export async function suggererEvaluationPageWiki(e: EntreePageWiki): Promise<{ texte: string; note: number | null; source: "ia" | "repli" }> {
  const repli = { texte: repliPageWiki(e), note: null, source: "repli" as const };
  if (!process.env.ANTHROPIC_API_KEY) return repli;

  try {
    const system =
      "Tu es tuteur-formateur (SEDEC, système éducatif ivoirien). Tu évalues une PAGE COLLABORATIVE (wiki) " +
      "rédigée par des apprenants. Tu appelles l'outil proposer_evaluation avec DEUX champs :\n" +
      "• appreciation_html : TROIS sections en HTML simple (<p>, <strong>, <ul>, <li>), structurées ainsi :\n" +
      "  <p><strong>Critères d'évaluation</strong></p><ul>…</ul> — ce qu'une bonne page doit présenter (pertinence, exactitude, clarté, structure, richesse, synthèse).\n" +
      "  <p><strong>Analyse de la page</strong></p><p>…</p> — un AVIS DÉTAILLÉ sur le contenu réellement rédigé : points forts précis, imprécisions/erreurs concrètes (en citant/paraphrasant), compléments souhaitables.\n" +
      "  <p><strong>Appréciation</strong></p><p>…</p> — synthèse bienveillante et constructive pour les contributeurs.\n" +
      "• note : la note ENTIÈRE proposée sur 20, déduite de l'analyse (OBLIGATOIRE). Français, pas d'emoji, pas de bloc de code.";
    const contenu =
      `Cours : ${e.coursTitre}\nTitre de la page : ${e.pageTitre}\n\n` +
      `Contenu de la page collaborative :\n${e.contenu.trim() || "(page vide)"}\n\n` +
      "Barème : la note doit être sur 20.";

    const res = await evaluerStructure(system, contenu, 20);
    return res ? { texte: res.texte, note: res.note, source: "ia" } : repli;
  } catch (err) {
    console.error("[ia/observation-devoir] wiki — repli (échec API) :", err);
    return repli;
  }
}
