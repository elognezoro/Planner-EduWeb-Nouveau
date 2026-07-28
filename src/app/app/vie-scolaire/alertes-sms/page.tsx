import type { Metadata } from "next";
import { Megaphone, Send, MessageSquareWarning } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { etatFournisseurSMS } from "@/lib/sms/fournisseur";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { chargerParametrage } from "@/lib/alertes/moteur";
import { PARAMETRAGE_DEFAUT } from "@/lib/alertes/modeles";
import { AlerteForm } from "./form";
import { ParametrageAlertesSection } from "./parametrage-alertes";

export const metadata: Metadata = { title: "Alertes & SMS" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/alertes-sms";
const LIBELLE_TYPE: Record<string, string> = {
  absence: "Absence",
  retard: "Retard",
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
  // L'historique et les compteurs sont cloisonnés à l'établissement de travail (AlerteSMS.etablissementId).
  // Le Super Admin Établissements est donc admis : resoudreEtablissement le confine à un établissement de SON pays.
  const u = await requireRole(["admin", "chef_etablissement", "etablissements_admin", "educateur", "super_admin_etablissements"]);
  const sp = await searchParams;
  const fournisseur = etatFournisseurSMS();

  let classes: { id: string; nom: string }[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let adminSansEtab = false;
  let erreur = false;

  try {
    if (
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "etablissements_admin" ||
      u.roleReel === "educateur"
    ) {
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
  // Cloisonnement : on ne lit QUE les alertes de l'établissement de travail (jamais celles d'un autre
  // établissement/pays). Sans établissement résolu, aucun historique n'est chargé.
  if (!erreur && etabId) {
    try {
      const [liste, total, simules, envoyes] = await Promise.all([
        prisma.alerteSMS.findMany({ where: { etablissementId: etabId }, orderBy: { creeLe: "desc" }, take: 30 }),
        prisma.alerteSMS.count({ where: { etablissementId: etabId } }),
        prisma.alerteSMS.count({ where: { etablissementId: etabId, statut: "simule" } }),
        prisma.alerteSMS.count({ where: { etablissementId: etabId, statut: "envoye" } }),
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

  // Paramétrage des alertes (seuils/canaux/modèles) + couverture des contacts parents.
  let parametrage = PARAMETRAGE_DEFAUT;
  let couverture = { eleves: 0, joignables: 0 };
  if (!erreur && etabId) {
    try {
      parametrage = await chargerParametrage(etabId);
      const classeIds = classes.map((c) => c.id);
      if (classeIds.length > 0) {
        const insc = await prisma.inscription.findMany({ where: { classeId: { in: classeIds } }, select: { eleveId: true } });
        const eleveIds = [...new Set(insc.map((i) => i.eleveId))];
        const liens = eleveIds.length
          ? await prisma.lienParentEleve.findMany({ where: { eleveId: { in: eleveIds } }, select: { eleveId: true, parent: { select: { telephone: true } } } })
          : [];
        const joignables = new Set(liens.filter((l) => l.parent.telephone?.trim()).map((l) => l.eleveId));
        couverture = { eleves: eleveIds.length, joignables: joignables.size };
      }
    } catch (e) {
      console.error("[alertes-sms] paramétrage :", e);
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

          {fournisseur.reel ? (
            <Card className="border-forest-200 bg-forest-50/50">
              <p className="text-xs text-ink-700/70">
                <strong>Envoi réel activé</strong> via le fournisseur{" "}
                <code className="mx-1 rounded bg-white px-1">{fournisseur.effectif}</code>. Chaque SMS
                transmis est facturé (offre de l&apos;Académie Premium).
              </p>
            </Card>
          ) : (
            <Card className="border-gold-200 bg-gold-50/40">
              <p className="text-xs text-ink-700/70">
                <strong>Mode simulé</strong> : aucun fournisseur SMS n&apos;est configuré. Les envois sont
                journalisés mais <strong>non transmis</strong>. Pour activer l&apos;envoi réel, définissez la
                variable d&apos;environnement{" "}
                <code className="mx-1 rounded bg-white px-1">SMS_PROVIDER</code> (twilio, orange, mtn ou
                moov) et les secrets du fournisseur. L&apos;offre est facturée dans l&apos;Académie Premium.
              </p>
            </Card>
          )}

          {etabId && (
            <ParametrageAlertesSection etablissementId={etabId} parametrage={parametrage} couverture={couverture} />
          )}

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Envoi manuel d&apos;une alerte</h2>
            <AlerteForm classes={classes} etabId={etabId} />
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
