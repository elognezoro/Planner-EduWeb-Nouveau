import { prisma } from "@/lib/prisma";
import { ROLES, type RoleId } from "@/lib/rbac/roles";

/** Question d'un quiz, avec ses choix (corrigé du formateur). */
export type QuestionManuel = {
  enonce: string;
  type: string; // choix_unique | choix_multiple | vrai_faux | association | texte_a_trous | remise_en_ordre
  points: number;
  explication: string | null;
  choix: { texte: string; correct: boolean; apparie: string | null; ordre: number }[];
};

export type QuizManuel = { consigne: string | null; seuilReussite: number; questions: QuestionManuel[] };

/** Une leçon d'un module du manuel (texte, ou quiz avec corrigé complet). */
export type LeconManuel = {
  titre: string;
  type: string;
  contenu: string | null;
  dureeMinutes: number | null;
  quiz?: QuizManuel | null;
};

/** Volet « formation interactive » d'un module (cours formation-<roleId>). */
export type FormationManuel = {
  titre: string;
  description: string | null;
  dureeMinutes: number;
  lecons: LeconManuel[];
};

/** Un module du manuel = un rôle réel : son guide + sa formation interactive (si publiée). */
export type ModuleManuel = {
  code: string; // « M01 », « M02 »…
  roleId: string | null;
  titre: string; // libellé du rôle (ou titre du guide)
  description: string;
  portee: string | null;
  slug: string;
  dureeMinutes: number;
  lecons: LeconManuel[];
  formation: FormationManuel | null;
};

export type ManuelData = {
  reference: string;
  version: string;
  nbModules: number;
  totalLecons: number;
  totalQuestions: number;
  dureeTotale: number;
  modules: ModuleManuel[];
};

const REFERENCE = "EDUWEB-FORM-2026-01";

type CoursBrut = {
  titre: string;
  slug: string;
  description: string | null;
  dureeMinutes: number | null;
  modules: {
    titre: string;
    type: string;
    contenu: string | null;
    dureeMinutes: number | null;
    quiz: {
      consigne: string | null;
      seuilReussite: number;
      questions: {
        enonce: string;
        type: string;
        points: number;
        explication: string | null;
        ordre: number;
        choix: { texte: string; correct: boolean; apparie: string | null; ordre: number }[];
      }[];
    } | null;
  }[];
};

function versLecons(c: CoursBrut): LeconManuel[] {
  return c.modules.map((m) => ({
    titre: m.titre,
    type: m.type,
    contenu: m.contenu,
    dureeMinutes: m.dureeMinutes,
    quiz: m.quiz
      ? {
          consigne: m.quiz.consigne,
          seuilReussite: m.quiz.seuilReussite,
          questions: [...m.quiz.questions]
            .sort((a, b) => a.ordre - b.ordre)
            .map((q) => ({
              enonce: q.enonce,
              type: q.type,
              points: q.points,
              explication: q.explication,
              choix: [...q.choix].sort((a, b) => a.ordre - b.ordre),
            })),
        }
      : null,
  }));
}

/**
 * Assemble le MANUEL DU FORMATEUR à partir des rôles RÉELS de la plateforme : un module
 * par rôle, regroupant son GUIDE (`guide-<roleId>`) et sa FORMATION INTERACTIVE
 * (`formation-<roleId>`, quiz avec corrigés), dans l'ordre hiérarchique (rang décroissant).
 * Le contenu se met à jour automatiquement à mesure que guides et formations évoluent.
 */
export async function chargerManuel(): Promise<ManuelData> {
  const cours: CoursBrut[] = await prisma.cours.findMany({
    where: { estGuide: true, statut: "publie" },
    select: {
      titre: true, slug: true, description: true, dureeMinutes: true,
      modules: {
        orderBy: { ordre: "asc" },
        select: {
          titre: true, type: true, contenu: true, dureeMinutes: true,
          quiz: {
            select: {
              consigne: true, seuilReussite: true,
              questions: {
                orderBy: { ordre: "asc" },
                select: {
                  enonce: true, type: true, points: true, explication: true, ordre: true,
                  choix: { orderBy: { ordre: "asc" }, select: { texte: true, correct: true, apparie: true, ordre: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const guides = cours.filter((c) => c.slug.startsWith("guide-"));
  const formationsPar = new Map(cours.filter((c) => c.slug.startsWith("formation-")).map((c) => [c.slug.slice("formation-".length), c]));
  const autres = cours.filter((c) => !c.slug.startsWith("guide-") && !c.slug.startsWith("formation-"));

  const rang = (slug: string): number => {
    const rid = slug.startsWith("guide-") ? slug.slice(6) : "";
    return rid in ROLES ? ROLES[rid as RoleId].rang : -1;
  };
  const tries = [...guides].sort((a, b) => rang(b.slug) - rang(a.slug) || a.titre.localeCompare(b.titre, "fr"));

  const modules: ModuleManuel[] = [...tries, ...autres].map((g, i) => {
    const rid = g.slug.startsWith("guide-") ? g.slug.slice(6) : null;
    const def = rid && rid in ROLES ? ROLES[rid as RoleId] : null;
    const dureeLecons = g.modules.reduce((s, m) => s + (m.dureeMinutes ?? 0), 0);
    const f = rid ? formationsPar.get(rid) : undefined;
    return {
      code: `M${String(i + 1).padStart(2, "0")}`,
      roleId: rid,
      titre: def?.libelle ?? g.titre,
      description: def?.description ?? g.description ?? "",
      portee: def?.portee ?? null,
      slug: g.slug,
      dureeMinutes: (g.dureeMinutes ?? dureeLecons) + (f?.dureeMinutes ?? 0),
      lecons: versLecons(g),
      formation: f
        ? { titre: f.titre, description: f.description, dureeMinutes: f.dureeMinutes ?? 0, lecons: versLecons(f) }
        : null,
    };
  });

  const totalLecons = modules.reduce((s, m) => s + m.lecons.length + (m.formation?.lecons.length ?? 0), 0);
  const totalQuestions = modules.reduce(
    (s, m) =>
      s +
      [...m.lecons, ...(m.formation?.lecons ?? [])].reduce((n, l) => n + (l.quiz?.questions.length ?? 0), 0),
    0,
  );
  const dureeTotale = modules.reduce((s, m) => s + m.dureeMinutes, 0);

  return { reference: REFERENCE, version: "2.0", nbModules: modules.length, totalLecons, totalQuestions, dureeTotale, modules };
}
