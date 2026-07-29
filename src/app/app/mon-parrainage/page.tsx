import type { Metadata } from "next";
import { Gift, Users, Wallet, HandCoins } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";
import { assurerCodeParrainage, lienParrainage, TAUX_PARRAINAGE } from "@/lib/parrainage/parrainage";
import { CopierLien } from "./copier-lien";
import { AdminVersements } from "./admin-versements";

export const metadata: Metadata = { title: "Mon Parrainage" };
export const dynamic = "force-dynamic";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const nom = (p: { prenoms: string | null; nom: string | null; email: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
const dateFr = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);

const LIBELLE_STATUT: Record<string, string> = {
  acquise: "Acquise",
  versee: "Versée",
  creditee: "Créditée",
  annulee: "Annulée",
};

export default async function MonParrainagePage() {
  const u = await requireUtilisateur();
  const code = await assurerCodeParrainage(u.id);
  const lien = code ? lienParrainage(code) : null;

  let filleuls: { id: string; label: string; creeLe: Date }[] = [];
  let commissions: { id: string; montant: number; statut: string; filleul: string; creeLe: Date }[] = [];
  const solde = { acquise: 0, versee: 0, creditee: 0 };
  let erreur = false;
  try {
    const [f, c] = await Promise.all([
      prisma.utilisateur.findMany({
        where: { parrainId: u.id },
        orderBy: { creeLe: "desc" },
        select: { id: true, prenoms: true, nom: true, email: true, creeLe: true },
      }),
      prisma.commissionParrainage.findMany({
        where: { parrainId: u.id },
        orderBy: { creeLe: "desc" },
        select: { id: true, montant: true, statut: true, creeLe: true, filleul: { select: { prenoms: true, nom: true, email: true } } },
      }),
    ]);
    filleuls = f.map((x) => ({ id: x.id, label: nom(x), creeLe: x.creeLe }));
    commissions = c.map((x) => ({ id: x.id, montant: x.montant, statut: x.statut, filleul: nom(x.filleul), creeLe: x.creeLe }));
    for (const x of c) {
      if (x.statut === "acquise") solde.acquise += x.montant;
      else if (x.statut === "versee") solde.versee += x.montant;
      else if (x.statut === "creditee") solde.creditee += x.montant;
    }
  } catch (e) {
    console.error("[mon-parrainage] :", e);
    erreur = true;
  }

  // Section admin : toutes les commissions en attente de versement, tous parrains confondus.
  let aRegler: { id: string; parrain: string; filleul: string; montant: number; creeLe: string }[] = [];
  if (u.roleReel === "admin" && !u.apercuActif) {
    try {
      const rows = await prisma.commissionParrainage.findMany({
        where: { statut: "acquise" },
        orderBy: { creeLe: "asc" },
        take: 200,
        select: {
          id: true, montant: true, creeLe: true,
          parrain: { select: { prenoms: true, nom: true, email: true } },
          filleul: { select: { prenoms: true, nom: true, email: true } },
        },
      });
      aRegler = rows.map((r) => ({ id: r.id, parrain: nom(r.parrain), filleul: nom(r.filleul), montant: r.montant, creeLe: dateFr(r.creeLe) }));
    } catch (e) {
      console.error("[mon-parrainage/admin] :", e);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Mon Parrainage"
        description={`Invitez vos contacts : vous gagnez ${TAUX_PARRAINAGE} % de chaque abonnement payé par une personne inscrite grâce à votre lien.`}
      />

      {erreur ? (
        <Card><p className="text-sm text-ink-700/70">Impossible de charger vos données de parrainage.</p></Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <Gift size={18} className="text-gold-600" /> Votre lien d&apos;invitation
            </h2>
            <p className="mb-3 text-sm text-ink-700/70">
              Partagez ce lien. Toute personne qui crée son compte en le suivant devient votre filleul(e).
            </p>
            {lien ? <CopierLien lien={lien} /> : (
              <p className="text-sm text-red-600">Lien indisponible pour le moment — réessayez plus tard.</p>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Filleul(e)s" valeur={filleuls.length} icone={<Users size={22} />} />
            <StatCard libelle="Gains à percevoir" valeur={fcfa(solde.acquise)} icone={<Wallet size={22} />} ton="gold" />
            <StatCard libelle="Déjà versé / crédité" valeur={fcfa(solde.versee + solde.creditee)} icone={<HandCoins size={22} />} ton="forest" />
          </div>

          <Card className="border-gold-200 bg-gold-50/40">
            <p className="text-xs text-ink-700/70">
              Vos gains s&apos;accumulent à chaque abonnement de vos filleul(e)s. Leur <strong>versement</strong>{" "}
              (par Mobile Money ou espèces) ou leur conversion en <strong>réduction</strong> sur votre propre
              abonnement seront ouverts prochainement — le suivi ci-dessous est déjà tenu à jour.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Vos filleul(e)s</h2>
            {filleuls.length === 0 ? (
              <p className="text-sm text-ink-700/60">Personne pour l&apos;instant. Partagez votre lien pour commencer.</p>
            ) : (
              <ul className="divide-y divide-cream-100">
                {filleuls.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-ink-900">{f.label}</span>
                    <span className="text-xs text-ink-700/50">inscrit(e) le {dateFr(f.creeLe)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {commissions.length > 0 && (
            <Card>
              <h2 className="mb-3 font-display text-base font-bold text-forest-900">Historique des commissions</h2>
              <ul className="divide-y divide-cream-100">
                {commissions.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-forest-900">{fcfa(c.montant)}</p>
                      <p className="text-xs text-ink-700/55">Filleul {c.filleul} · {dateFr(c.creeLe)}</p>
                    </div>
                    <Badge ton={c.statut === "acquise" ? "attente" : c.statut === "annulee" ? "refus" : "succes"}>
                      {LIBELLE_STATUT[c.statut] ?? c.statut}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {u.roleReel === "admin" && !u.apercuActif && (
            <Card className="border-forest-200">
              <h2 className="mb-1 font-display text-base font-bold text-forest-900">
                Administration — commissions à verser
              </h2>
              <p className="mb-3 text-xs text-ink-700/60">
                Réglez chaque commission hors plateforme, puis marquez-la « versée » avec sa référence de transaction.
              </p>
              <AdminVersements commissions={aRegler} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
