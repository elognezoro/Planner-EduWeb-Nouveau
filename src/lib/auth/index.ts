import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./config";
import { prisma } from "@/lib/prisma";
import { verifierMotDePasse } from "./password";
import { verifierCode2FA } from "./deux-facteurs";
import { journaliserSecurite } from "@/lib/audit/journal";

/**
 * Instance Auth.js complète (runtime Node) : base edge + provider Credentials.
 * Le provider vérifie l'e-mail/mot de passe en base et n'autorise que les comptes ACTIFS
 * (e-mail confirmé). L'accès restreint d'un compte en attente d'approbation de rôle est géré
 * APRÈS connexion, dans la mise en page de /app (cahier §6.2, §6.3).
 */
const schemaConnexion = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
  // Code 2FA à 6 chiffres — exigé ici (côté serveur) quand le compte a la 2FA active, ce qui
  // ferme tout contournement du flux par un appel direct à signIn sans passer par l'écran de code.
  code: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Identifiants",
      credentials: {
        email: { label: "E-mail", type: "email" },
        motDePasse: { label: "Mot de passe", type: "password" },
        code: { label: "Code de vérification", type: "text" },
      },
      authorize: async (identifiants) => {
        const parsed = schemaConnexion.safeParse(identifiants);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const utilisateur = await prisma.utilisateur.findUnique({ where: { email } });
        // Compte inconnu : on NE journalise PAS (éviter l'inondation du journal par énumération
        // d'e-mails inexistants). Les échecs sur un compte EXISTANT, eux, sont tracés (force brute).
        if (!utilisateur) return null;

        // Le compte doit être actif (e-mail confirmé) pour se connecter (cahier §6.2).
        if (utilisateur.statutCompte !== "actif") {
          await journaliserSecurite("connexion_echec", {
            utilisateurId: utilisateur.id,
            acteurEmail: utilisateur.email,
            cible: `Utilisateur:${utilisateur.id}`,
            details: { raison: "compte_inactif" },
          });
          return null;
        }

        const motDePasseValide = await verifierMotDePasse(
          parsed.data.motDePasse,
          utilisateur.motDePasseHash,
        );
        if (!motDePasseValide) {
          await journaliserSecurite("connexion_echec", {
            utilisateurId: utilisateur.id,
            acteurEmail: utilisateur.email,
            cible: `Utilisateur:${utilisateur.id}`,
            details: { raison: "mot_de_passe" },
          });
          return null;
        }

        // Double authentification : si active, un code valide est OBLIGATOIRE. Le code est
        // envoyé par l'action `seConnecter` une fois le mot de passe vérifié ; ici on ne fait
        // que le valider (et le consommer). Sans code valide, la connexion échoue.
        if (utilisateur.deuxFacteursActif) {
          const codeOk = await verifierCode2FA(
            utilisateur.id,
            "connexion_2fa",
            parsed.data.code ?? "",
          );
          if (!codeOk) {
            await journaliserSecurite("connexion_echec", {
              utilisateurId: utilisateur.id,
              acteurEmail: utilisateur.email,
              cible: `Utilisateur:${utilisateur.id}`,
              details: { raison: "code_2fa" },
            });
            return null;
          }
        }

        await journaliserSecurite("connexion", {
          utilisateurId: utilisateur.id,
          acteurEmail: utilisateur.email,
          cible: `Utilisateur:${utilisateur.id}`,
          details: utilisateur.deuxFacteursActif ? { deuxFacteurs: true } : undefined,
        });

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
