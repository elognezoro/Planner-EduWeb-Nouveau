import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Wallet, BadgeCheck, ArrowUpRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";
import { formaterFcfa } from "@/lib/premium/formules";

export const metadata: Metadata = { title: "Facturation" };
export const dynamic = "force-dynamic";

const LIBELLE_FORMULE: Record<string, string> = { petit: "Petit établissement", grand: "Grand établissement" };
const LIBELLE_PAIEMENT: Record<string, string> = { carte: "Carte", wave: "Wave", orange: "Orange Money", mtn: "MTN Money", moov: "Moov Money" };

function dateFr(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
}

export default async function FacturationPage() {
  const u = await requireRole(["admin", "etablissements_admin", "chef_etablissement"]);

  const where =
    u.roleReel === "admin"
      ? {}
      : { etablissementId: u.portee.etablissementId ?? "__aucune__" };

  let erreur = false;
  let abonnements: {
    id: string;
    etablissement: string;
    formule: string;
    montantFinal: number;
    pourcentage: number;
    statut: string;
    paiement: string;
    code: string | null;
    debut: Date;
    fin: Date;
  }[] = [];
  let kpis = { actifs: 0, revenu: 0, total: 0 };

  try {
    const liste = await prisma.abonnementPremium.findMany({
      where,
      orderBy: { creeLe: "desc" },
      take: 50,
      include: { etablissement: { select: { nom: true } }, codePromo: { select: { code: true } } },
    });
    abonnements = liste.map((a) => ({
      id: a.id,
      etablissement: a.etablissement?.nom ?? "—",
      formule: a.formule,
      montantFinal: a.montantFinal,
      pourcentage: a.pourcentageReduction,
      statut: a.statut,
      paiement: a.modePaiement,
      code: a.codePromo?.code ?? null,
      debut: a.dateDebut,
      fin: a.dateFin,
    }));
    const actifs = abonnements.filter((a) => a.statut === "actif");
    kpis = {
      actifs: actifs.length,
      revenu: actifs.reduce((s, a) => s + a.montantFinal, 0),
      total: abonnements.length,
    };
  } catch (e) {
    console.error("[facturation] :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Facturation"
        description="Abonnements Académie Premium et revenus (mode démo)."
        action={
          <Link
            href="/app/vie-scolaire/academie-premium"
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-forest-700"
          >
            Académie Premium <ArrowUpRight size={15} />
          </Link>
        }
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger la facturation.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Abonnements actifs" valeur={kpis.actifs} icone={<BadgeCheck size={22} />} />
            <StatCard libelle="Revenu (actifs)" valeur={formaterFcfa(kpis.revenu)} icone={<Wallet size={22} />} ton="gold" />
            <StatCard libelle="Total souscriptions" valeur={kpis.total} icone={<CreditCard size={22} />} />
          </div>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Souscriptions</h2>
            {abonnements.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun abonnement pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                      <th className="py-2.5 pr-3 font-semibold">Établissement</th>
                      <th className="px-2 py-2.5 font-semibold">Formule</th>
                      <th className="px-2 py-2.5 font-semibold">Paiement</th>
                      <th className="px-2 py-2.5 font-semibold">Code</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Montant</th>
                      <th className="px-2 py-2.5 font-semibold">Période</th>
                      <th className="px-2 py-2.5 text-center font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonnements.map((a) => (
                      <tr key={a.id} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-forest-900">{a.etablissement}</td>
                        <td className="px-2 py-2.5 text-ink-700/80">{LIBELLE_FORMULE[a.formule] ?? a.formule}</td>
                        <td className="px-2 py-2.5 text-ink-700/70">{LIBELLE_PAIEMENT[a.paiement] ?? a.paiement}</td>
                        <td className="px-2 py-2.5 font-mono text-xs text-ink-700/60">
                          {a.code ? `${a.code} (−${a.pourcentage}%)` : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{formaterFcfa(a.montantFinal)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-ink-700/60">
                          {dateFr(a.debut)} → {dateFr(a.fin)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Badge ton={a.statut === "actif" ? "succes" : a.statut === "expire" ? "refus" : "attente"}>
                            {a.statut === "actif" ? "Actif" : a.statut === "expire" ? "Expiré" : "En attente"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
