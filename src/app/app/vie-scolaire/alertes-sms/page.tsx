import type { Metadata } from "next";
import { Megaphone, Send, MessageSquareWarning } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { AlerteForm } from "./form";

export const metadata: Metadata = { title: "Alertes & SMS" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/alertes-sms";
const LIBELLE_TYPE: Record<string, string> = {
  absence: "Absence",
  note: "Note",
  convocation: "Convocation",
  info: "Information",
};

function masquerTel(t: string): string {
  if (t.length <= 4) return t;
  return `${t.slice(0, 4)}…${t.slice(-2)}`;
}
function dateHeure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function AlertesSmsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  // NB : l'historique SMS de cette page n'est pas cloisonné par pays (modèle AlerteSMS sans FK pays).
  // Tant que ce n'est pas corrigé, on n'ouvre PAS ce module au Super Admin national (fuite inter-pays).
  const u = await requireRole(["admin", "chef_etablissement", "educateur"]);
  const sp = await searchParams;

  let classes: { id: string; nom: string }[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let adminSansEtab = false;
  let erreur = false;

  try {
    if (u.roleReel === "chef_etablissement" || u.roleReel === "educateur") {
      etabId = u.portee.etablissementId;
      if (etabId)
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
    } else {
      const ctx = await resoudreEtablissement(u, sp.etab);
      etablissements = ctx.etablissements;
      etabId = ctx.etabId;
      if (!etabId) adminSansEtab = true;
      else
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
    }
  } catch (e) {
    console.error("[alertes-sms] résolution :", e);
    erreur = true;
  }

  if (adminSansEtab) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader titre="Alertes & SMS" description="Choisissez un établissement." />
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
      </div>
    );
  }

  let historique: { id: string; telephone: string; contenu: string; type: string; statut: string; date: Date }[] = [];
  let kpis = { total: 0, simules: 0, envoyes: 0 };
  if (!erreur) {
    try {
      const [liste, total, simules, envoyes] = await Promise.all([
        prisma.alerteSMS.findMany({ orderBy: { creeLe: "desc" }, take: 30 }),
        prisma.alerteSMS.count(),
        prisma.alerteSMS.count({ where: { statut: "simule" } }),
        prisma.alerteSMS.count({ where: { statut: "envoye" } }),
      ]);
      historique = liste.map((a) => ({
        id: a.id,
        telephone: a.telephone,
        contenu: a.contenu,
        type: a.type,
        statut: a.statut,
        date: a.creeLe,
      }));
      kpis = { total, simules, envoyes };
    } catch (e) {
      console.error("[alertes-sms] historique :", e);
      erreur = true;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Alertes & SMS"
        description="Informer les parents par SMS : absences, notes, convocations."
      />

      {u.roleReel === "admin" && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les alertes SMS.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Alertes envoyées" valeur={kpis.total} icone={<Megaphone size={22} />} />
            <StatCard libelle="Réellement envoyées" valeur={kpis.envoyes} icone={<Send size={22} />} />
            <StatCard libelle="Simulées (démo)" valeur={kpis.simules} icone={<MessageSquareWarning size={22} />} ton="gold" />
          </div>

          <Card className="border-gold-200 bg-gold-50/40">
            <p className="text-xs text-ink-700/70">
              <strong>Mode simulé</strong> tant qu&apos;aucun fournisseur SMS n&apos;est branché (variable
              <code className="mx-1 rounded bg-white px-1">SMS_API_KEY</code>). Les envois sont
              journalisés mais non transmis. L&apos;offre est facturée dans l&apos;Académie Premium.
            </p>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Nouvelle alerte</h2>
            <AlerteForm classes={classes} />
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Historique récent</h2>
            {historique.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune alerte envoyée pour le moment.</p>
            ) : (
              <ul className="divide-y divide-cream-100">
                {historique.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm">
                        <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-800">
                          {LIBELLE_TYPE[a.type] ?? a.type}
                        </span>
                        <span className="font-mono text-xs text-ink-700/60">{masquerTel(a.telephone)}</span>
                      </p>
                      <p className="mt-1 truncate text-sm text-ink-900">{a.contenu}</p>
                      <p className="mt-0.5 text-[0.65rem] text-ink-700/45">{dateHeure(a.date)}</p>
                    </div>
                    <Badge ton={a.statut === "envoye" ? "succes" : a.statut === "echec" ? "refus" : "attente"}>
                      {a.statut === "envoye" ? "Envoyé" : a.statut === "echec" ? "Échec" : "Simulé"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
