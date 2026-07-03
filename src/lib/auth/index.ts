import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./config";
import { prisma } from "@/lib/prisma";
import { verifierMotDePasse } from "./password";

/**
 * Instance Auth.js complète (runtime Node) : base edge + provider Credentials.
 * Le provider vérifie l'e-mail/mot de passe en base et n'autorise que les comptes ACTIFS
 * (e-mail confirmé). L'accès restreint d'un compte en attente d'approbation de rôle est géré
 * APRÈS connexion, dans la mise en page de /app (cahier §6.2, §6.3).
 */
const schemaConnexion = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Identifiants",
      credentials: {
        email: { label: "E-mail", type: "email" },
        motDePasse: { label: "Mot de passe", type: "password" },
      },
      authorize: async (identifiants) => {
        const parsed = schemaConnexion.safeParse(identifiants);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const utilisateur = await prisma.utilisateur.findUnique({ where: { email } });
        if (!utilisateur) return null;

        // Le compte doit être actif (e-mail confirmé) pour se connecter (cahier §6.2).
        if (utilisateur.statutCompte !== "actif") return null;

        const motDePasseValide = await verifierMotDePasse(
          parsed.data.motDePasse,
          utilisateur.motDePasseHash,
        );
        if (!motDePasseValide) return null;

        const nomComplet =
          [utilisateur.prenoms, utilisateur.nom].filter(Boolean).join(" ") ||
          utilisateur.email;

        // Journal de trafic anonyme (widget « temps réel » de l'accueil) — jamais bloquant.
        try {
          await prisma.visiteSite.create({ data: { type: "connexion" } });
        } catch {
          /* le comptage ne doit jamais empêcher une connexion */
        }

        return {
          id: utilisateur.id,
          email: utilisateur.email,
          name: nomComplet,
          image: utilisateur.photoUrl ?? null,
        };
      },
    }),
  ],
});
