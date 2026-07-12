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

/** Canevas HTML de repli (sans clé IA) : deux sections, à compléter par l'évaluateur. */
function repliLocal(e: EntreeObservation): string {
  const mention = e.note != null ? `Note : ${e.note}/${e.noteSur}. ` : "";
  return (
    "<p><strong>Éléments de réponse attendus</strong></p>" +
    "<ul>" +
    "<li>Respect de la consigne et de tous les points demandés.</li>" +
    "<li>Exactitude et bonne application des notions du module.</li>" +
    "<li>Structure claire, argumentation étayée et exemples pertinents.</li>" +
    "</ul>" +
    "<p><strong>Commentaire</strong></p>" +
    `<p>${mention}Travail rendu et pris en compte. Points à consolider et axes d'amélioration concrets ` +
    "à préciser (structure, exactitude, application des notions). Poursuivez vos efforts.</p>"
  );
}

/**
 * Suggestion d'évaluation pour une épreuve subjective (production libre / dépôt) : renvoie un
 * BROUILLON HTML structuré — « Éléments de réponse attendus » (indications de bonnes réponses
 * déduites de la consigne) + « Commentaire » détaillé — TOUJOURS ajustable par l'évaluateur.
 */
export async function suggererObservationDevoir(e: EntreeObservation): Promise<{ texte: string; source: "ia" | "repli" }> {
  const repli = { texte: repliLocal(e), source: "repli" as const };
  if (!process.env.ANTHROPIC_API_KEY) return repli;

  try {
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 1200,
      system:
        "Tu es tuteur-formateur dans un établissement catholique du système éducatif ivoirien (SEDEC). " +
        "Tu prépares une aide à la correction d'une épreuve SUBJECTIVE (production libre + éventuel fichier). " +
        "Tu produis DEUX sections en français :\n" +
        "1. « Éléments de réponse attendus » : d'après la CONSIGNE, la liste des points/critères qu'une bonne " +
        "production doit contenir (indications de bonnes réponses, barème indicatif) — même si la production de " +
        "l'apprenant est absente ou hors-sujet.\n" +
        "2. « Commentaire » : appréciation bienveillante et constructive de la production déposée (points forts, " +
        "un ou deux axes d'amélioration concrets, encouragement). Si aucune production texte n'est fournie, " +
        "indique-le et invite à évaluer le fichier joint.\n" +
        "Réponds UNIQUEMENT en HTML simple, avec ces balises autorisées : <p>, <strong>, <ul>, <li>. " +
        "Structure exactement : <p><strong>Éléments de réponse attendus</strong></p><ul>…</ul>" +
        "<p><strong>Commentaire</strong></p><p>…</p>. Aucun autre texte, pas de bloc de code, pas d'emoji.",
      messages: [
        {
          role: "user",
          content:
            `Consigne du devoir :\n${e.consigne || "(non précisée)"}\n\n` +
            `Production texte déposée par l'apprenant :\n${e.texteApprenant.trim() || "(aucun texte saisi — voir le fichier joint)"}\n\n` +
            `${e.note != null ? `Note attribuée par le tuteur : ${e.note}/${e.noteSur}.\n` : ""}` +
            "Rédige les deux sections (éléments de réponse attendus + commentaire).",
        },
      ],
    });
    const texte = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return texte ? { texte, source: "ia" } : repli;
  } catch (err) {
    console.error("[ia/observation-devoir] repli (échec API) :", err);
    return repli;
  }
}
