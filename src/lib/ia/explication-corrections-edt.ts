import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Explication PÉDAGOGIQUE des corrections automatiques de configuration appliquées par
 * l'IA pour débloquer la génération d'un emploi du temps : l'IA Claude intégrée à
 * EduWeb Planner rédige, à destination du chef d'établissement, POURQUOI chaque
 * correction était nécessaire et comment revenir en arrière s'il le souhaite.
 *
 * Les corrections elles-mêmes sont calculées et PROUVÉES par le moteur déterministe
 * (`corrections-auto.ts`) — Claude n'en décide pas : il les explique. Gated par
 * ANTHROPIC_API_KEY et borné dans le temps : en cas d'absence de clé, d'erreur ou de
 * lenteur, on renvoie null et l'interface affiche la liste brute des corrections.
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
const DELAI_MS = 9_000;

export async function expliquerCorrectionsEdt(args: {
  etablissementNom: string;
  blocagesInitiaux: string[];
  corrections: string[];
  creneauxPlaces: number;
  qualiteScore?: number;
}): Promise<string | null> {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return null;
  try {
    // maxRetries: 0 — l'appel est fait APRÈS la transaction (EDT déjà persisté) : on ne veut
    // pas que les reprises par défaut du SDK (2 essais sur timeout/429/5xx) triplent le délai
    // et risquent de dépasser maxDuration. Le délai reste borné à DELAI_MS par tentative unique.
    const client = new Anthropic({ apiKey: cle, timeout: DELAI_MS, maxRetries: 0 });
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 500,
      system:
        "Tu rédiges au nom d'EduWeb Planner (plateforme de gestion scolaire ivoirienne). La génération " +
        "d'emploi du temps d'un établissement était bloquée ; EduWeb Planner a automatiquement corrigé " +
        "la configuration (corrections minimales, prouvées puis appliquées) et la génération a abouti. " +
        "Rédige, en français, 2 à 4 phrases COURTES à destination du chef d'établissement : explique " +
        "simplement pourquoi ces corrections ont été appliquées (en t'appuyant sur les chiffres " +
        "fournis), et rappelle qu'il peut les ajuster dans la console de configuration s'il préfère " +
        "un autre arbitrage. Attribue les corrections à « EduWeb Planner », jamais à « l'IA ». " +
        "N'affirme pas qu'une correction était « indispensable » : dis qu'elle a " +
        "permis de débloquer la génération. Ton professionnel et rassurant, sans jargon technique, " +
        "sans listes à puces. Termine tes phrases (ne dépasse pas le budget de réponse).",
      messages: [
        {
          role: "user",
          content:
            `Établissement : ${args.etablissementNom}\n` +
            `Blocages initiaux :\n${args.blocagesInitiaux.map((b) => `- ${b}`).join("\n")}\n\n` +
            `Corrections appliquées automatiquement :\n${args.corrections.map((c) => `- ${c}`).join("\n")}\n\n` +
            `Résultat : ${args.creneauxPlaces} créneaux placés sans conflit` +
            (args.qualiteScore != null ? `, qualité ${args.qualiteScore}/100.` : "."),
        },
      ],
    });
    let texte = reponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    // Réponse tronquée au plafond de jetons : couper à la dernière phrase COMPLÈTE plutôt que
    // d'afficher un texte coupé en plein mot au chef (repli sur null si aucune phrase entière).
    if (reponse.stop_reason === "max_tokens") {
      const fin = Math.max(texte.lastIndexOf(". "), texte.lastIndexOf("! "), texte.lastIndexOf("? "));
      texte = fin > 0 ? texte.slice(0, fin + 1).trim() : "";
    }
    return texte.length > 0 ? texte : null;
  } catch (e) {
    console.error("[ia corrections edt] explication indisponible :", e);
    return null;
  }
}
