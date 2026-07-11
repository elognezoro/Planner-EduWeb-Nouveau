"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { slugifier } from "@/lib/lms";
import { analyserImportCsv } from "@/lib/lms-import";
import type { EtatLms } from "./actions";

const BASE = "/app/aide-formation";

async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}

/**
 * Importe en masse des cours + leçons depuis un CSV.
 * Réanalyse le texte côté serveur (jamais confiance au client), puis crée le tout
 * en une transaction : catégories manquantes (par nom), cours + leçons imbriquées,
 * quiz vide pour les leçons de type « quiz ». Contenus importés en brouillon par défaut.
 */
export async function importerCoursCsv(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;

  const texte = String(fd.get("texte") ?? "");
  const publier = String(fd.get("publier") ?? "") === "on";
  if (!texte.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const analyse = analyserImportCsv(texte);
  if (!analyse.ok) return { ok: false, message: analyse.messageFatal ?? "Format CSV invalide." };
  if (analyse.cours.length === 0) return { ok: false, message: "Aucun cours valide détecté dans le fichier." };

  try {
    const [slugsExistants, catsExistantes] = await Promise.all([
      prisma.cours.findMany({ select: { slug: true } }),
      prisma.categorieFormation.findMany({ orderBy: { creeLe: "asc" }, select: { id: true, nom: true } }),
    ]);
    const slugsUtilises = new Set(slugsExistants.map((s) => s.slug));
    // nom (minuscule) → id ; CategorieFormation.nom n'est pas @unique → résolution stable en mémoire :
    // en cas d'homonymes à la casse près, la catégorie la plus ancienne (creeLe asc) l'emporte.
    const catParNom = new Map<string, string>();
    for (const c of catsExistantes) {
      const cle = c.nom.toLowerCase();
      if (!catParNom.has(cle)) catParNom.set(cle, c.id);
    }

    const slugUnique = (titre: string): string => {
      const base = slugifier(titre) || "cours";
      let s = base;
      let n = 2;
      while (slugsUtilises.has(s)) s = `${base}-${n++}`;
      slugsUtilises.add(s);
      return s;
    };

    let nbCours = 0;
    let nbLecons = 0;
    let nbCategories = 0;

    await prisma.$transaction(async (tx) => {
      // 1) Catégories manquantes (par nom).
      for (const c of analyse.cours) {
        if (!c.categorie) continue;
        const cle = c.categorie.toLowerCase();
        if (!catParNom.has(cle)) {
          const creee = await tx.categorieFormation.create({ data: { nom: c.categorie }, select: { id: true } });
          catParNom.set(cle, creee.id);
          nbCategories++;
        }
      }
      // 2) Cours + leçons imbriquées.
      for (const c of analyse.cours) {
        const categorieId = c.categorie ? catParNom.get(c.categorie.toLowerCase()) ?? null : null;
        await tx.cours.create({
          data: {
            titre: c.titre,
            slug: slugUnique(c.titre),
            description: c.description,
            niveau: c.niveau,
            statut: publier ? "publie" : "brouillon",
            publicCible: [],
            categorieId,
            modules: {
              create: c.lecons.map((l, i) => ({
                titre: l.titre,
                type: l.type,
                contenu: l.contenu,
                dureeMinutes: l.dureeMinutes,
                ordre: i,
                ...(l.type === "quiz" ? { quiz: { create: {} } } : {}),
              })),
            },
          },
        });
        nbCours++;
        nbLecons += c.lecons.length;
      }
    }, { timeout: 30000 });

    revalidatePath(`${BASE}/gestion`);
    revalidatePath(`${BASE}/guides`);
    const etat = publier ? "publié(s)" : "importé(s) en brouillon";
    const suffixeCat = nbCategories ? `, ${nbCategories} nouvelle(s) catégorie(s)` : "";
    return { ok: true, message: `${nbCours} cours (${nbLecons} leçon(s)${suffixeCat}) ${etat}.` };
  } catch (e) {
    console.error("[lms] import CSV :", e);
    return { ok: false, message: "Erreur technique pendant l'import." };
  }
}
