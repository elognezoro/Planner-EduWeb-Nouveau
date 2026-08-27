import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap, UserSquare2, Users, Search } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_IDS, libelleRole, estRoleValide, type RoleId } from "@/lib/rbac/roles";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { GestionLiensInscription } from "../../invitation-cours-boutons";
import { BoutonEnroler, BoutonDesinscrire } from "./client";

export const metadata: Metadata = { title: "Inscriptions par rôle — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const PAGE = `${BASE}/gestion/inscriptions-role`;
const nomDe = (u: { nom: string | null; prenoms: string | null; email: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const libelleSource = (s: string) => (s === "invitation" ? "via lien" : s === "nominative" ? "inscrit par l'admin" : s === "session" ? "via session" : "auto");
// Libellé d'un rôle depuis un identifiant string (déjà validé en amont via estRoleValide/publicCible).
const libRole = (r: string) => libelleRole(r as RoleId);

function Onglet({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        actif ? "border-transparent bg-forest-700 text-cream-50" : "border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function InscriptionsRolePage({
  searchParams,
}: {
  searchParams: Promise<{ cours?: string; role?: string; q?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const coursId = sp.cours ?? "";
  const role = sp.role && estRoleValide(sp.role) ? sp.role : "";
  const q = (sp.q ?? "").trim();

  // Formations = cours PUBLIÉS (formations + séminaires), hors guides.
  const coursListe = await prisma.cours.findMany({
    where: { statut: "publie", estGuide: false },
    orderBy: [{ estSeminaire: "asc" }, { titre: "asc" }],
    select: { id: true, titre: true, estSeminaire: true, publicCible: true },
  });
  const formation = coursId ? coursListe.find((c) => c.id === coursId) : null;

  // Rôles proposés = rôles VISÉS de la formation (publicCible), sinon TOUS les rôles.
  const cibles = formation ? formation.publicCible.filter(estRoleValide) : [];
  const rolesFormation: string[] = formation ? (cibles.length > 0 ? cibles : [...ROLE_IDS]) : [];

  let inscritsRole: {
    id: string;
    source: string;
    roleCible: string | null;
    utilisateur: { id: string; prenoms: string | null; nom: string | null; email: string; roleActif: { nomTechnique: string } | null };
  }[] = [];
  let invitations: { id: string; token: string; actif: boolean; expiration: string | null; placesMax: number | null; roleCible: string | null }[] = [];
  let candidats: { id: string; prenoms: string | null; nom: string | null; email: string }[] = [];
  let nbInscritsViaLien = 0;

  if (formation && role) {
    const [insc, invs] = await Promise.all([
      prisma.inscriptionCours.findMany({
        where: { coursId: formation.id },
        orderBy: { dateInscription: "desc" },
        select: {
          id: true, source: true, roleCible: true,
          utilisateur: { select: { id: true, prenoms: true, nom: true, email: true, roleActif: { select: { nomTechnique: true } } } },
        },
      }),
      prisma.invitationCours.findMany({
        where: { coursId: formation.id, roleCible: role },
        orderBy: { creeLe: "desc" },
        select: { id: true, token: true, actif: true, expiration: true, placesMax: true, roleCible: true },
      }),
    ]);
    // « Inscrits de ce rôle » : rôle enregistré sur l'inscription, OU (aucun rôle ET rôle actif = celui-ci).
    inscritsRole = insc.filter((i) => i.roleCible === role || (!i.roleCible && i.utilisateur.roleActif?.nomTechnique === role));
    invitations = invs.map((inv) => ({ ...inv, expiration: inv.expiration ? inv.expiration.toISOString() : null }));
    nbInscritsViaLien = insc.filter((i) => i.source === "invitation").length;
    const dejaIds = new Set(insc.map((i) => i.utilisateur.id));
    if (q) {
      const trouves = await prisma.utilisateur.findMany({
        where: {
          roleActif: { nomTechnique: role },
          OR: [
            { nom: { contains: q, mode: "insensitive" } },
            { prenoms: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { nom: "asc" },
        take: 40,
        select: { id: true, prenoms: true, nom: true, email: true },
      });
      candidats = trouves.filter((u) => !dejaIds.has(u.id));
    }
  }

  const lien = (params: Record<string, string>) => `${PAGE}?${new URLSearchParams(params).toString()}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour à la gestion</Link>
      <PageHeader
        titre="Inscriptions par rôle"
        description="Sélectionnez une formation, puis un rôle, puis inscrivez les participants — ou générez un lien d'inscription scoppé à ce rôle (le rôle est enregistré sur chaque inscription qui en découle)."
      />

      {/* Étape 1 — Formation */}
      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><GraduationCap size={18} className="text-forest-600" /> 1. Formation</h2>
        {coursListe.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucun cours publié. Publiez un cours depuis « Gestion du contenu ».</p></Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {coursListe.map((c) => (
              <Onglet key={c.id} href={lien({ cours: c.id })} actif={c.id === coursId}>
                {c.titre}
                {c.estSeminaire && <Badge ton="succes">Séminaire</Badge>}
              </Onglet>
            ))}
          </div>
        )}
      </section>

      {/* Étape 2 — Rôle */}
      {formation && (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><UserSquare2 size={18} className="text-forest-600" /> 2. Rôle dans « {formation.titre} »</h2>
          {cibles.length === 0 && <p className="text-xs text-ink-700/55">Cette formation ne cible aucun rôle en particulier — tous les rôles sont proposés.</p>}
          <div className="flex flex-wrap gap-2">
            {rolesFormation.map((r) => (
              <Onglet key={r} href={lien({ cours: formation.id, role: r })} actif={r === role}>{libRole(r)}</Onglet>
            ))}
          </div>
        </section>
      )}

      {/* Étape 3 — Inscriptions du couple (formation, rôle) */}
      {formation && role && (
        <>
          <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900">
              <Users size={18} className="text-forest-600" /> 3. Inscrits — {libRole(role)}
              <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{inscritsRole.length}</span>
            </h2>
            {inscritsRole.length === 0 ? (
              <Card><p className="text-sm text-ink-700/60">Aucun inscrit sous ce rôle pour l&apos;instant.</p></Card>
            ) : (
              <Card className="divide-y divide-cream-100 p-0">
                {inscritsRole.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-forest-900">{nomDe(i.utilisateur)}</p>
                      <p className="text-xs text-ink-700/60">{i.utilisateur.email} · {libelleSource(i.source)}{i.roleCible ? ` · rôle : ${libRole(i.roleCible)}` : i.utilisateur.roleActif ? ` · rôle actif : ${libRole(i.utilisateur.roleActif.nomTechnique)}` : ""}</p>
                    </div>
                    <BoutonDesinscrire coursId={formation.id} utilisateurId={i.utilisateur.id} />
                  </div>
                ))}
              </Card>
            )}
          </section>

          {/* Inscription nominative (candidats filtrés sur le rôle) */}
          <section className="space-y-3">
            <h3 className="font-display text-base font-bold text-forest-900">Inscrire un(e) {libRole(role)}</h3>
            <form method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="cours" value={formation.id} />
              <input type="hidden" name="role" value={role} />
              <input name="q" defaultValue={q} placeholder={`Rechercher un(e) ${libRole(role)} par nom, prénom ou e-mail…`} className={`${champ} flex-1 min-w-[240px]`} />
              <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-700"><Search size={15} /> Rechercher</button>
            </form>
            {q && (
              candidats.length === 0 ? (
                <p className="text-sm text-ink-700/60">Aucun(e) {libRole(role)} trouvé(e) pour « {q} » (déjà inscrits exclus).</p>
              ) : (
                <Card className="divide-y divide-cream-100 p-0">
                  {candidats.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-forest-900">{nomDe(c)}</p>
                        <p className="text-xs text-ink-700/60">{c.email}</p>
                      </div>
                      <BoutonEnroler coursId={formation.id} utilisateurId={c.id} role={role} />
                    </div>
                  ))}
                </Card>
              )
            )}
          </section>

          {/* Lien d'inscription scoppé au rôle */}
          <section className="space-y-3">
            <h3 className="font-display text-base font-bold text-forest-900">Lien d&apos;inscription directe — {libRole(role)}</h3>
            <GestionLiensInscription coursId={formation.id} invitations={invitations} nbInscritsViaLien={nbInscritsViaLien} roleCible={role} />
          </section>
        </>
      )}
    </div>
  );
}
