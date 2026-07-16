import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Clock4, CheckCircle2, XCircle, Ticket, Inbox, TicketPercent } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { KpiCard } from "@/components/app/kpi-card";
import { paysConsulte } from "@/lib/pays-consulte";
import { RowPromo } from "./row-promo";

export const metadata: Metadata = { title: "Approbations promo" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/approbations-promo";
type Filtre = "tous" | "en_attente" | "approuvee" | "refusee";

const LIBELLE_STATUT: Record<string, string> = {
  en_attente: "En attente",
  approuvee: "Approuvée",
  refusee: "Refusée",
};
const TON_STATUT: Record<string, "succes" | "refus" | "attente"> = {
  en_attente: "attente",
  approuvee: "succes",
  refusee: "refus",
};

function dateFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

export default async function ApprobationsPromoPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const filtre: Filtre = (["tous", "en_attente", "approuvee", "refusee"] as const).includes(sp.filtre as Filtre)
    ? (sp.filtre as Filtre)
    : "en_attente";

  // Contexte affiché dans le badge d'en-tête (pays consulté · année scolaire).
  const [pays, store] = await Promise.all([paysConsulte(), cookies()]);
  let annee = store.get("eduweb_annee")?.value ?? "";
  if (!annee) {
    try {
      annee = (await prisma.anneeScolaire.findFirst({ where: { active: true } }))?.libelle ?? "";
    } catch {
      /* contexte facultatif */
    }
  }

  let erreur = false;
  let compte = { en_attente: 0, approuvee: 0, refusee: 0, total: 0 };
  let demandes: {
    id: string;
    demandeur: string;
    email: string;
    etablissementNom: string | null;
    motif: string;
    tauxDemande: number | null;
    tauxAccorde: number | null;
    statut: string;
    codeAttribue: string | null;
    creeLe: Date;
  }[] = [];
  let codes: { code: string; libelle: string; pourcentage: number }[] = [];

  try {
    const [enAttente, approuvees, refusees, brutes, codesBruts] = await Promise.all([
      prisma.demandeCodePromo.count({ where: { statut: "en_attente" } }),
      prisma.demandeCodePromo.count({ where: { statut: "approuvee" } }),
      prisma.demandeCodePromo.count({ where: { statut: "refusee" } }),
      prisma.demandeCodePromo.findMany({
        where: filtre === "tous" ? {} : { statut: filtre },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: { demandeur: { select: { prenoms: true, nom: true, email: true } } },
      }),
      prisma.codePromo.findMany({
        where: { actif: true },
        orderBy: { pourcentage: "desc" },
        select: { code: true, libelle: true, pourcentage: true },
      }),
    ]);
    compte = { en_attente: enAttente, approuvee: approuvees, refusee: refusees, total: enAttente + approuvees + refusees };
    demandes = brutes.map((d) => ({
      id: d.id,
      demandeur: [d.demandeur.prenoms, d.demandeur.nom].filter(Boolean).join(" ") || d.demandeur.email,
      email: d.demandeur.email,
      etablissementNom: d.etablissementNom,
      motif: d.motif,
      tauxDemande: d.tauxDemande,
      tauxAccorde: d.tauxAccorde,
      statut: d.statut,
      codeAttribue: d.codeAttribue,
      creeLe: d.creeLe,
    }));
    codes = codesBruts;
  } catch (e) {
    console.error("[approbations-promo] :", e);
    erreur = true;
  }

  const onglets: { v: Filtre; l: string; n: number }[] = [
    { v: "tous", l: "Tous", n: compte.total },
    { v: "en_attente", l: "En attente", n: compte.en_attente },
    { v: "approuvee", l: "Approuvés", n: compte.approuvee },
    { v: "refusee", l: "Refusés", n: compte.refusee },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Approbations de codes promo"
        description="Validez ou refusez les demandes de codes promo de réduction (allocations IZEN, E-School, groupes d'établissements…)."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-800">
            <TicketPercent size={13} /> {pays}
            {annee ? ` · ${annee.replace("-", " — ")}` : ""}
          </span>
        }
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les demandes. Vérifiez la connexion à la base de données.</p>
        </Card>
      ) : (
        <>
          {/* Compteurs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard index={0} libelle="En attente" valeur={compte.en_attente} ton={compte.en_attente > 0 ? "gold" : "cream"} icone={<Clock4 size={22} />} href={`${BASE}?filtre=en_attente`} />
            <KpiCard index={1} libelle="Approuvées" valeur={compte.approuvee} ton="forest" icone={<CheckCircle2 size={22} />} href={`${BASE}?filtre=approuvee`} />
            <KpiCard index={2} libelle="Refusées" valeur={compte.refusee} ton={compte.refusee > 0 ? "red" : "cream"} icone={<XCircle size={22} />} href={`${BASE}?filtre=refusee`} />
            <KpiCard index={3} libelle="Total demandes" valeur={compte.total} icone={<Ticket size={22} />} href={`${BASE}?filtre=tous`} />
          </div>

          {/* Onglets */}
          <div className="flex flex-wrap gap-2">
            {onglets.map((o) => (
              <Link
                key={o.v}
                href={`${BASE}?filtre=${o.v}`}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  filtre === o.v
                    ? "border-forest-700 bg-white font-semibold text-forest-900 shadow-sm"
                    : "border-cream-300 bg-cream-50/60 text-ink-700/65 hover:bg-white"
                }`}
              >
                {o.l} ({o.n})
              </Link>
            ))}
          </div>

          {/* Liste des demandes */}
          {demandes.length === 0 ? (
            <Card className="flex flex-col items-center py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
                <Inbox size={26} />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold text-forest-900">Aucune demande trouvée</h2>
              <p className="mt-1 text-sm text-ink-700/65">Aucune demande de code promo dans cette catégorie.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {demandes.map((d) => (
                <Card key={d.id} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-forest-900">{d.demandeur}</p>
                      <Badge ton={TON_STATUT[d.statut] ?? "attente"}>{LIBELLE_STATUT[d.statut] ?? d.statut}</Badge>
                      {d.tauxDemande != null && <Badge ton="attente">Taux souhaité : {d.tauxDemande} %</Badge>}
                      {d.codeAttribue && (
                        <Badge ton="succes">
                          Code : {d.codeAttribue}
                          {d.tauxAccorde != null ? ` (−${d.tauxAccorde} %)` : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-700/65">{d.email}</p>
                    {d.etablissementNom && (
                      <p className="mt-1 text-sm text-ink-700/65">
                        Établissement : <span className="font-medium">{d.etablissementNom}</span>
                      </p>
                    )}
                    <p className="mt-1.5 text-sm text-ink-700/80">« {d.motif} »</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-700/50">
                      <Clock4 size={13} /> Demande du {dateFr(d.creeLe)}
                    </p>
                  </div>
                  {d.statut === "en_attente" && <RowPromo demandeId={d.id} codes={codes} tauxDemande={d.tauxDemande} />}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
