import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { navigationPourRole } from "@/lib/rbac/navigation";
import { ROLES, type RoleId } from "@/lib/rbac/roles";
import { filtreEtablissements, filtreUtilisateurs, type PorteeUtilisateur } from "@/lib/rbac/scope";

/**
 * Assistant conversationnel d'EduWeb Planner (chatbot d'aide). Répond aux questions
 * d'utilisation ET peut consulter les données DANS LE PÉRIMÈTRE RBAC de l'utilisateur,
 * via des outils en LECTURE SEULE.
 *
 * ⚠️ Sécurité (CLAUDE.md §3) : chaque outil re-dérive le périmètre depuis le CONTEXTE SERVEUR
 * (`ctx`, issu de la session), JAMAIS depuis une entrée fournie par le modèle. Les outils
 * réutilisent les filtres de périmètre centralisés (`@/lib/rbac/scope`) — refus par défaut.
 *
 * Gated par ANTHROPIC_API_KEY : sans clé, renvoie un message de repli (aucune IA).
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export type MessageChat = { role: "user" | "assistant"; contenu: string };

/** Contexte serveur de l'utilisateur courant (source de vérité du périmètre). */
export interface ContexteAssistant {
  id: string;
  nomComplet: string;
  roleActif: RoleId;
  libelleRoleActif: string;
  portee: PorteeUtilisateur;
  accesRestreint: boolean;
  apercuActif: boolean;
}

// ── Outils de données (lecture seule, cloisonnés au périmètre) ────────────────

const OUTILS: Anthropic.Tool[] = [
  {
    name: "mes_notifications",
    description: "Liste les notifications récentes de l'utilisateur (ses propres notifications uniquement).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "mes_formations",
    description: "Liste les cours du centre de formation (LMS) auxquels l'utilisateur est inscrit, avec sa progression.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "etablissements_de_mon_perimetre",
    description: "Liste les établissements scolaires situés dans le périmètre de l'utilisateur (selon son rôle). Vide si son rôle n'a pas de périmètre d'établissement.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "comptes_de_mon_perimetre",
    description: "Effectifs des comptes utilisateurs dans le périmètre, agrégés par rôle (nombres uniquement, sans données personnelles). Vide pour les rôles personnels.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

/** Exécute un outil en re-dérivant TOUJOURS le périmètre depuis le contexte serveur. */
async function executerOutil(nom: string, ctx: ContexteAssistant): Promise<string> {
  try {
    switch (nom) {
      case "mes_notifications": {
        const n = await prisma.notification.findMany({
          where: { destinataireId: ctx.id },
          orderBy: { creeLe: "desc" },
          take: 10,
          select: { titre: true, message: true, lu: true, creeLe: true },
        });
        return JSON.stringify(n.map((x) => ({ titre: x.titre, message: x.message, lu: x.lu, date: x.creeLe.toISOString().slice(0, 10) })));
      }
      case "mes_formations": {
        const f = await prisma.inscriptionCours.findMany({
          where: { utilisateurId: ctx.id },
          orderBy: { derniereActivite: "desc" },
          take: 25,
          select: { statut: true, progressionPct: true, cours: { select: { titre: true } } },
        });
        return JSON.stringify(f.map((x) => ({ cours: x.cours.titre, statut: x.statut, progression: `${x.progressionPct}%` })));
      }
      case "etablissements_de_mon_perimetre": {
        const e = await prisma.etablissement.findMany({
          where: filtreEtablissements(ctx.portee),
          orderBy: { nom: "asc" },
          take: 60,
          select: { nom: true, ville: true, pays: true },
        });
        return JSON.stringify({ total: e.length, etablissements: e.map((x) => ({ nom: x.nom, ville: x.ville, pays: x.pays })) });
      }
      case "comptes_de_mon_perimetre": {
        const groupes = await prisma.utilisateur.groupBy({
          by: ["roleActifId"],
          where: filtreUtilisateurs(ctx.portee),
          _count: { _all: true },
        });
        if (groupes.length === 0) return JSON.stringify({ total: 0, parRole: [] });
        const roles = await prisma.role.findMany({
          where: { id: { in: groupes.map((g) => g.roleActifId) } },
          select: { id: true, libelle: true },
        });
        const libParId = new Map(roles.map((r) => [r.id, r.libelle]));
        const parRole = groupes
          .map((g) => ({ role: libParId.get(g.roleActifId) ?? "—", nombre: g._count._all }))
          .sort((a, b) => b.nombre - a.nombre);
        return JSON.stringify({ total: parRole.reduce((s, r) => s + r.nombre, 0), parRole });
      }
      default:
        return JSON.stringify({ erreur: "Outil inconnu." });
    }
  } catch (err) {
    console.error("[assistant] outil", nom, "en échec :", err);
    return JSON.stringify({ erreur: "Donnée momentanément indisponible." });
  }
}

// ── Prompt système ────────────────────────────────────────────────────────────

function systeme(ctx: ContexteAssistant): string {
  const modules = navigationPourRole(ctx.roleActif).flatMap((s) => s.items.map((i) => i.libelle));
  const perimetre = [
    ctx.portee.etablissementId && "un établissement",
    ctx.portee.cafopId && "un CAFOP",
    ctx.portee.apfcId && "une APFC",
    ctx.portee.regionId && "une région",
    ctx.portee.pays && `le pays « ${ctx.portee.pays} »`,
  ].filter(Boolean).join(", ") || ROLES[ctx.roleActif]?.portee || "—";

  return (
    "Tu es l'assistant d'aide d'EduWeb Planner, une plateforme de gestion et de planification scolaire " +
    "du système éducatif ivoirien (et au-delà). Tu aides l'utilisateur à prendre en main la plateforme et à " +
    "consulter SES données.\n\n" +
    `UTILISATEUR : ${ctx.nomComplet}. Rôle : « ${ctx.libelleRoleActif} ». Périmètre : ${perimetre}.` +
    (ctx.accesRestreint ? " ⚠️ Son accès est actuellement RESTREINT (demande de rôle en attente) : il ne peut ouvrir que « Mon Identification » et « Mon Profil »." : "") +
    (ctx.apercuActif ? " (Mode aperçu de rôle actif : lecture seule.)" : "") +
    "\n\nMODULES accessibles à ce rôle (n'oriente JAMAIS vers un menu absent de cette liste) :\n" +
    modules.map((m) => `- ${m}`).join("\n") +
    "\n\nRÈGLES :\n" +
    "- Réponds en FRANÇAIS, de façon claire, concise et bienveillante (vouvoiement).\n" +
    "- Pour les questions d'UTILISATION (« comment faire… »), explique le chemin dans le menu (ex. « Vie scolaire › Registre d'appel ») et les étapes.\n" +
    "- Pour les questions sur SES données (ses notifications, ses formations, les établissements/comptes de son périmètre), UTILISE les outils fournis. N'invente JAMAIS de données ; rapporte uniquement ce que les outils renvoient.\n" +
    "- Confidentialité : tu ne disposes QUE des données du périmètre de l'utilisateur (les outils s'en assurent). Ne prétends jamais accéder à des données d'un autre périmètre.\n" +
    "- Si tu ne sais pas ou si l'information n'est pas disponible, dis-le simplement. Ne donne pas de conseils médicaux, juridiques ou financiers personnalisés.\n" +
    "- Pour effectuer une action (créer, modifier, envoyer…), tu ne fais RIEN toi-même : tu indiques précisément où et comment l'utilisateur peut la réaliser.\n" +
    "- Reste bref : quelques phrases ou une courte liste. Propose d'approfondir si besoin."
  );
}

// ── Boucle conversationnelle ────────────────────────────────────────────────

/** Prompt système pour un VISITEUR non connecté (aide générale, aucune donnée). */
function systemePublic(): string {
  return (
    "Tu es l'assistant d'accueil d'EduWeb Planner, une plateforme de gestion et de planification scolaire " +
    "du système éducatif ivoirien (et au-delà). Tu t'adresses à un VISITEUR NON CONNECTÉ.\n\n" +
    "Tu peux présenter la plateforme et ses grandes fonctions : gestion des établissements, vie scolaire " +
    "(registre d'appel, cahier de texte, notes & bulletins), génération automatique des emplois du temps, " +
    "formation des maîtres (CAFOP/APFC), inspection, rapports et statistiques, et un centre de formation en " +
    "ligne. Tu peux expliquer comment CRÉER UN COMPTE : s'inscrire avec un e-mail, un mot de passe et le rôle " +
    "souhaité ; confirmer l'e-mail (le compte devient actif) ; la demande de rôle est ensuite validée par un " +
    "administrateur pour débloquer l'accès complet.\n\n" +
    "RÈGLES :\n" +
    "- Réponds en FRANÇAIS, clair, concis, accueillant (vouvoiement).\n" +
    "- Tu n'as accès à AUCUNE donnée personnelle (l'utilisateur n'est pas connecté). Pour consulter ses données " +
    "(emploi du temps, notes, notifications…), invite-le à se connecter ou à créer un compte.\n" +
    "- N'invente rien ; si tu ne sais pas, dis-le. Reste bref (quelques phrases)."
  );
}

const REPLI =
  "L'assistant IA n'est pas encore activé (clé ANTHROPIC_API_KEY absente). En attendant, consultez les " +
  "« Guides d'utilisateurs » (Aide et Formation) : un guide détaillé y est disponible pour votre rôle.";

/**
 * Répond à une question. `ctx` = utilisateur connecté (accès aux outils de données, cloisonnés
 * au périmètre) ; `null` = visiteur anonyme (aide générale, AUCUN outil, aucune donnée). Les
 * comptes en accès restreint reçoivent aussi l'aide sans outils de données.
 */
export async function repondreAssistant(
  ctx: ContexteAssistant | null,
  historique: MessageChat[],
  question: string,
): Promise<{ texte: string; source: "ia" | "repli" }> {
  if (!process.env.ANTHROPIC_API_KEY) return { texte: REPLI, source: "repli" };

  const avecOutils = ctx != null && !ctx.accesRestreint;
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    ...historique.slice(-10).map((m) => ({ role: m.role, content: m.contenu })),
    { role: "user" as const, content: question },
  ];

  try {
    for (let tour = 0; tour < 4; tour++) {
      const rep = await client.messages.create({
        model: MODELE,
        max_tokens: avecOutils ? 1024 : 700,
        system: ctx ? systeme(ctx) : systemePublic(),
        ...(avecOutils ? { tools: OUTILS } : {}),
        messages,
      });

      if (avecOutils && rep.stop_reason === "tool_use") {
        const resultats: Anthropic.ToolResultBlockParam[] = [];
        for (const bloc of rep.content) {
          if (bloc.type === "tool_use") {
            const sortie = await executerOutil(bloc.name, ctx);
            resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: sortie });
          }
        }
        messages.push({ role: "assistant", content: rep.content });
        messages.push({ role: "user", content: resultats });
        continue;
      }

      const texte = rep.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return { texte: texte || "Je n'ai pas de réponse à proposer pour le moment.", source: "ia" };
    }
    return { texte: "La demande est trop complexe à traiter d'un coup. Reformulez-la plus simplement, svp.", source: "ia" };
  } catch (err) {
    console.error("[assistant] échec API :", err);
    return { texte: "L'assistant est momentanément indisponible. Réessayez dans un instant.", source: "repli" };
  }
}
