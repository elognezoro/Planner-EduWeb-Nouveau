import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { creerExtensionAudit } from "@/lib/audit/extension";

/**
 * Client Prisma en singleton, branché sur le driver adapter node-postgres (Prisma 7).
 *
 * - L'URL de connexion vient de DATABASE_URL (endpoint "pooled" Neon en production).
 * - En développement, Next.js recharge les modules à chaud : sans ce cache global,
 *   on ouvrirait une nouvelle connexion à chaque rechargement (et on épuiserait le pool).
 *
 * Deux clients partagent la même connexion :
 *  - `prismaBase` : client NON étendu — utilisé UNIQUEMENT pour écrire le journal d'audit
 *    (évite toute récursion de l'extension de traçabilité) ;
 *  - `prisma` : client étendu avec l'extension de TRAÇABILITÉ, importé par tout le code métier.
 *    Chaque écriture passant par `prisma` est automatiquement journalisée.
 */
const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
  prisma: PrismaClient | undefined;
};

function creerClientBase(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function creerClientEtendu(base: PrismaClient): PrismaClient {
  // L'extension `query` intercepte les écritures au RUNTIME, indépendamment du type statique.
  // On re-caste en PrismaClient pour que `prisma.$transaction((tx) => …)` continue de fournir un
  // `Prisma.TransactionClient` standard : aucune signature d'action existante n'est à modifier, et
  // l'interception reste active — y compris pour les écritures effectuées DANS une transaction.
  return base.$extends(creerExtensionAudit(base)) as unknown as PrismaClient;
}

const prismaBase = globalForPrisma.prismaBase ?? creerClientBase();
export const prisma: PrismaClient = globalForPrisma.prisma ?? creerClientEtendu(prismaBase);

/** Client NON étendu, réservé à l'écriture du journal (helpers d'audit). Ne pas utiliser ailleurs. */
export { prismaBase };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.prisma = prisma;
}
