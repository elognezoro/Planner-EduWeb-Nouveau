import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Note indicative (IA) pour le compte-rendu d'une visite d'inspection : à partir du texte
 * des observations, propose une note /20 ET une justification d'UNE phrase. La note reste
 * la DÉCISION de l'encadreur — simple pré-remplissage d'un champ toujours modifiable.
 *
 * Gated par ANTHROPIC_API_KEY (même garde-fou que src/lib/ia/suggestions.ts et
 * src/lib/ia/observation-devoir.ts) : si la clé est absente — ou si l'appel échoue pour
 * quelque raison que ce soit —, un repli HEURISTIQUE local (tonalité du texte, mots
 * positifs/négatifs pondérés, bornes 8-17) est utilisé. Ne lève JAMAIS d'exception.
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export interface NoteIndicative {
  /** Note sur 20, arrondie au 0,5 le plus proche. */
  note: number;
  /** Justification en UNE phrase. */
  justification: string;
  source: "ia" | "estimation";
}

function arrondirDemi(n: number): number {
  return Math.round(n * 2) / 2;
}

// ── Repli heuristique local (sans appel réseau) ──────────────────────────────

/** Mots-clés positifs/négatifs (français courant du compte-rendu pédagogique) et leur poids. */
const MOTS_POSITIFS: Record<string, number> = {
  excellent: 3, excellente: 3, remarquable: 3, exemplaire: 3,
  "très bonne": 2.5, "très bon": 2.5, "bonne maîtrise": 2.5, maîtrisé: 2, maîtrisée: 2,
  "bonne gestion": 2, "bien structurée": 2, "bien structuré": 2, réussi: 2, réussie: 2,
  efficace: 1.5, positif: 1.5, positive: 1.5, progrès: 1.5, dynamique: 1,
  satisfaisant: 1, satisfaisante: 1, correct: 1, correcte: 1, encourageant: 1, encourageante: 1,
  bon: 1, bonne: 1, clair: 0.5, claire: 0.5, motivé: 0.5, motivée: 0.5, rigoureux: 1, rigoureuse: 1,
};
const MOTS_NEGATIFS: Record<string, number> = {
  insuffisant: 2.5, insuffisante: 2.5, faible: 2, grave: 2.5,
  inquiétant: 2, inquiétante: 2, manque: 1.5, difficulté: 1.5, difficultés: 1.5,
  désorganisé: 2, désorganisée: 2, confus: 1.5, confuse: 1.5, "à revoir": 1.5,
  problème: 1.5, problèmes: 1.5, absent: 1, absente: 1, retard: 1,
  négligé: 1.5, négligée: 1.5, médiocre: 2.5, décevant: 2, décevante: 2, échec: 2,
};

/** Estimation locale bornée [8, 17] (une note « moyenne » raisonnable sans jugement extrême). */
function noteHeuristique(texte: string): NoteIndicative {
  const bas = texte.toLowerCase();
  let score = 0;
  for (const [mot, poids] of Object.entries(MOTS_POSITIFS)) if (bas.includes(mot)) score += poids;
  for (const [mot, poids] of Object.entries(MOTS_NEGATIFS)) if (bas.includes(mot)) score -= poids;

  const note = arrondirDemi(Math.max(8, Math.min(17, 12.5 + score)));
  const tonalite =
    score > 1 ? "une tonalité globalement positive" : score < -1 ? "une tonalité relevant des difficultés" : "une tonalité mesurée";
  return {
    note,
    justification: `Estimation locale d'après ${tonalite} du compte-rendu (aucune clé IA configurée) — à ajuster.`,
    source: "estimation",
  };
}

// ── Sortie structurée forcée (Claude, tool use) ──────────────────────────────

const OUTIL: Anthropic.Tool = {
  name: "proposer_note_indicative",
  description: "Renvoie une note indicative sur 20 et une justification d'une phrase pour le compte-rendu de visite.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      note: {
        type: "number",
        minimum: 0,
        maximum: 20,
        description: "Note indicative sur 20 (peut comporter une décimale .5), déduite du compte-rendu.",
      },
      justification: {
        type: "string",
        description: "Justification en UNE seule phrase, sobre et factuelle.",
      },
    },
    required: ["note", "justification"],
  },
};

/**
 * Suggestion de note indicative à partir du texte du compte-rendu d'une visite d'inspection.
 * Ne lève jamais : tout échec (clé absente, erreur API, réponse invalide) retombe sur
 * l'estimation heuristique locale.
 */
export async function suggererNoteIndicativeVisite(observations: string): Promise<NoteIndicative> {
  if (!process.env.ANTHROPIC_API_KEY) return noteHeuristique(observations);

  try {
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 300,
      system:
        "Tu assistes un inspecteur, un conseiller pédagogique ou un ACE du système éducatif ivoirien qui rédige " +
        "le compte-rendu d'une visite (classe, établissement ou suivi). À partir du texte des observations fourni, " +
        "tu appelles OBLIGATOIREMENT l'outil proposer_note_indicative avec une note indicative sur 20 (reflétant " +
        "les points forts et les axes d'amélioration décrits dans le texte) et une justification d'UNE seule " +
        "phrase, sobre et factuelle. Cette note reste une simple INDICATION : la décision finale appartient " +
        "toujours à l'encadreur. Français, pas d'emoji.",
      tools: [OUTIL],
      tool_choice: { type: "tool", name: "proposer_note_indicative" },
      messages: [{ role: "user", content: `Compte-rendu de la visite :\n${observations}` }],
    });
    const bloc = reponse.content.find((b) => b.type === "tool_use");
    if (!bloc || bloc.type !== "tool_use") return noteHeuristique(observations);
    const entree = bloc.input as { note?: unknown; justification?: unknown };
    const brute = typeof entree.note === "number" ? entree.note : Number(entree.note);
    const justification = typeof entree.justification === "string" ? entree.justification.trim() : "";
    if (!Number.isFinite(brute) || !justification) return noteHeuristique(observations);
    return { note: arrondirDemi(Math.max(0, Math.min(20, brute))), justification, source: "ia" };
  } catch (e) {
    console.error("[ia/note-indicative-visite] repli heuristique (échec API) :", e);
    return noteHeuristique(observations);
  }
}
