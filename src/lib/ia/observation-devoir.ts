import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Observation (appréciation) IA d'un devoir déposé — brouillon proposé au tuteur, TOUJOURS éditable.
 * Gated par ANTHROPIC_API_KEY (même modèle que le registre) : si la clé est présente, Claude rédige
 * l'appréciation à partir de la consigne et de la production ; sinon un repli local propose un canevas.
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export interface EntreeObservation {
  consigne: string;
  texteApprenant: string;
  note?: number | null;
  noteSur: number;
}

/**
 * Extrait la note proposée par l'IA (marqueur caché `<!--NOTE:X-->` en fin de réponse) et
 * retire TOUT commentaire HTML du texte affiché. Note bornée à [0, barème], entière.
 */
function extraireNoteSuggeree(texte: string, bareme: number): { texte: string; note: number | null } {
  const m = /<!--\s*NOTE\s*:\s*(\d+)/i.exec(texte);
  const propre = texte.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!m) return { texte: propre, note: null };
  const n = parseInt(m[1], 10);
  return { texte: propre, note: Number.isFinite(n) ? Math.max(0, Math.min(bareme, n)) : null };
}

const CONSIGNE_NOTE =
  " Termine ta réponse par une dernière ligne contenant EXACTEMENT le commentaire HTML " +
  "<!--NOTE:X--> où X est la note ENTIÈRE que tu proposes sur le barème indiqué (déduite de ton " +
  "analyse de la copie). Ce commentaire ne sera pas affiché à l'apprenant.";

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
 * « Appréciation » — TOUJOURS ajustable par l'évaluateur.
 */
export async function suggererObservationDevoir(e: EntreeObservation): Promise<{ texte: string; note: number | null; source: "ia" | "repli" }> {
  const repli = { texte: repliLocal(e), note: null, source: "repli" as const };
  if (!process.env.ANTHROPIC_API_KEY) return repli;

  try {
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 1800,
      system:
        "Tu es tuteur-formateur dans un établissement catholique du système éducatif ivoirien (SEDEC). " +
        "Tu prépares une aide à la correction d'une épreuve SUBJECTIVE (production libre + éventuel fichier). " +
        "Tu produis TROIS sections en français :\n" +
        "1. « Éléments de réponse attendus » : d'après la CONSIGNE, les points/critères qu'une bonne production " +
        "doit contenir (indications de bonnes réponses, barème indicatif).\n" +
        "2. « Analyse de la copie » : un AVIS DÉTAILLÉ sur la production RÉELLEMENT déposée. Passe en revue, " +
        "élément attendu par élément attendu, ce qui est présent et correct, ce qui est incomplet, et ce qui " +
        "manque ou est erroné ; relève les points forts précis et les erreurs concrètes en citant/paraphrasant " +
        "la copie. Si aucune production TEXTE n'est fournie (fichier seul), indique que l'analyse porte sur le " +
        "fichier à ouvrir et fournis une grille de vérification des éléments attendus.\n" +
        "3. « Appréciation » : synthèse bienveillante et constructive à destination de l'apprenant (points forts, " +
        "un à trois axes d'amélioration concrets, encouragement) et, si utile, une note indicative sur le barème.\n" +
        "Réponds UNIQUEMENT en HTML simple, balises autorisées : <p>, <strong>, <ul>, <li>. Structure exactement : " +
        "<p><strong>Éléments de réponse attendus</strong></p><ul>…</ul>" +
        "<p><strong>Analyse de la copie</strong></p><p>…</p> (ou <ul>…</ul>)" +
        "<p><strong>Appréciation</strong></p><p>…</p>. Aucun autre texte, pas de bloc de code, pas d'emoji." +
        CONSIGNE_NOTE,
      messages: [
        {
          role: "user",
          content:
            `Consigne du devoir :\n${e.consigne || "(non précisée)"}\n\n` +
            `Production texte déposée par l'apprenant :\n${e.texteApprenant.trim() || "(aucun texte saisi — un fichier a été joint, à ouvrir pour l'évaluer)"}\n\n` +
            `${e.note != null ? `Note envisagée par le tuteur : ${e.note}/${e.noteSur}.\n` : `Barème : /${e.noteSur}.\n`}` +
            `Rédige les trois sections (éléments attendus + analyse détaillée de la copie + appréciation), puis le marqueur de note sur /${e.noteSur}.`,
        },
      ],
    });
    const brut = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const { texte, note } = extraireNoteSuggeree(brut, e.noteSur);
    return texte ? { texte, note, source: "ia" } : repli;
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
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 1800,
      system:
        "Tu es tuteur-formateur (SEDEC, système éducatif ivoirien). Tu évalues une PAGE COLLABORATIVE (wiki) " +
        "rédigée par des apprenants dans le cadre d'un cours. Produis TROIS sections en français :\n" +
        "1. « Critères d'évaluation » : ce qu'une bonne page doit présenter (pertinence, exactitude, clarté, " +
        "structure, richesse, synthèse).\n" +
        "2. « Analyse de la page » : un AVIS DÉTAILLÉ sur le contenu réellement rédigé — points forts précis, " +
        "imprécisions/erreurs concrètes (en citant/paraphrasant), compléments souhaitables.\n" +
        "3. « Appréciation » : synthèse bienveillante et constructive pour les contributeurs (points forts, " +
        "axes d'amélioration, encouragement).\n" +
        "Réponds UNIQUEMENT en HTML simple : <p>, <strong>, <ul>, <li>. Structure : " +
        "<p><strong>Critères d'évaluation</strong></p><ul>…</ul>" +
        "<p><strong>Analyse de la page</strong></p><p>…</p>" +
        "<p><strong>Appréciation</strong></p><p>…</p>. Aucun autre texte, pas de bloc de code, pas d'emoji." +
        CONSIGNE_NOTE,
      messages: [
        {
          role: "user",
          content:
            `Cours : ${e.coursTitre}\nTitre de la page : ${e.pageTitre}\n\n` +
            `Contenu de la page collaborative :\n${e.contenu.trim() || "(page vide)"}\n\n` +
            "Rédige les trois sections (critères + analyse détaillée de la page + appréciation), puis le marqueur de note sur /20.",
        },
      ],
    });
    const brut = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const { texte, note } = extraireNoteSuggeree(brut, 20);
    return texte ? { texte, note, source: "ia" } : repli;
  } catch (err) {
    console.error("[ia/observation-devoir] wiki — repli (échec API) :", err);
    return repli;
  }
}
