import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { BookOpen, ClipboardList, NotebookPen, MessageSquare, Megaphone, Stamp, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";

export const metadata: Metadata = { title: "Rapports d'activité" };
export const dynamic = "force-dynamic";

const LIBELLE_ACTION: Record<string, string> = {
  "demande_role.approuvee": "Demande de rôle approuvée",
  "demande_role.refusee": "Demande de rôle refusée",
};

export default async function RapportsActivitePage() {
  const u = await requireRole(["admin", "drena", "inspecteur", "chef_etablissement", "cafop_admin", "apfc_admin"]);
  const estAdmin = u.roleReel === "admin";
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - 30);

  // Cloisonnement par périmètre (CLAUDE.md §3-4) : hors admin, chaque compteur est borné au
  // périmètre du consultant — jamais de volumétrie nationale. Fail-closed comme dans
  // inspection/rapports-antennes : périmètre non renseigné → filtre insatisfiable
  // (« __aucune__ »), pas de repli national.
  const role = u.roleReel;
  const etabIds = u.portee.etablissementIds.length > 0 ? u.portee.etablissementIds : ["__aucun__"];
  const filtreEtab: Prisma.EtablissementWhereInput | null = estAdmin
    ? null
    : role === "chef_etablissement"
      ? { id: { in: etabIds } }
      : role === "drena" || role === "inspecteur"
        ? { regionId: u.portee.regionId ?? "__aucune__" }
        : role === "apfc_admin"
          ? { couvertureApfc: { apfcId: u.portee.apfcId ?? "__aucune__" } }
          : { id: "__aucun__" }; // cafop_admin : aucun établissement dans son périmètre

  // Notes, appels, cahiers et inscriptions sont rattachés à un établissement via la classe.
  const parClasse: Prisma.ClasseWhereInput | undefined = filtreEtab ? { etablissement: filtreEtab } : undefined;

  // Messages : un message appartient au périmètre si l'un de ses deux interlocuteurs en fait
  // partie (personnel rattaché à la structure ou à un établissement du périmètre).
  const filtreParticipant: Prisma.UtilisateurWhereInput | null = estAdmin
    ? null
    : role === "chef_etablissement"
      ? { etablissementId: { in: etabIds } }
      : role === "drena" || role === "inspecteur"
        ? { OR: [{ regionId: u.portee.regionId ?? "__aucune__" }, { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } }] }
        : role === "apfc_admin"
          ? { OR: [{ apfcId: u.portee.apfcId ?? "__aucune__" }, { etablissement: { couvertureApfc: { apfcId: u.portee.apfcId ?? "__aucune__" } } }] }
          : { cafopId: u.portee.cafopId ?? "__aucun__" };
  const whereMessages: Prisma.MessageWhereInput = filtreParticipant
    ? { creeLe: { gte: depuis }, OR: [{ expediteur: filtreParticipant }, { destinataire: filtreParticipant }] }
    : { creeLe: { gte: depuis } };

  // Alertes SMS : bornées par la FK établissement quand elle existe ; celles d'un CAFOP n'ont
  // pas de FK (seul `etablissementNom` porte le nom du centre), on borne donc par ce nom.
  let whereSms: Prisma.AlerteSMSWhereInput = { creeLe: { gte: depuis } };
  if (role === "cafop_admin") {
    const cafop = u.portee.cafopId
      ? await prisma.cafop.findUnique({ where: { id: u.portee.cafopId }, select: { nom: true } })
      : null;
    whereSms = { creeLe: { gte: depuis }, etablissementId: null, etablissementNom: cafop?.nom ?? "__aucun__" };
  } else if (filtreEtab) {
    whereSms = { creeLe: { gte: depuis }, etablissement: filtreEtab };
  }

  const [notes, appels, cahiers, messages, sms, visites, inscriptions] = await Promise.all([
    prisma.note.count({ where: { creeLe: { gte: depuis }, classe: parClasse } }),
    prisma.appel.count({ where: { creeLe: { gte: depuis }, classe: parClasse } }),
    prisma.cahierTexte.count({ where: { creeLe: { gte: depuis }, classe: parClasse } }),
    prisma.message.count({ where: whereMessages }),
    prisma.alerteSMS.count({ where: whereSms }),
    prisma.visite.count({ where: { creeLe: { gte: depuis }, etablissement: filtreEtab ?? undefined } }),
    prisma.inscription.count({ where: { creeLe: { gte: depuis }, classe: parClasse } }),
  ]);

  const journal = estAdmin
    ? await prisma.journalActivite.findMany({ orderBy: { creeLe: "desc" }, take: 15, select: { id: true, acteurEmail: true, action: true, creeLe: true } })
    : [];

  const cartes = [
    { libelle: "Notes saisies", valeur: notes, icone: <BookOpen size={22} /> },
    { libelle: "Appels", valeur: appels, icone: <ClipboardList size={22} /> },
    { libelle: "Cahier de texte", valeur: cahiers, icone: <NotebookPen size={22} /> },
    { libelle: "Messages", valeur: messages, icone: <MessageSquare size={22} /> },
    { libelle: "Alertes SMS", valeur: sms, icone: <Megaphone size={22} /> },
    { libelle: "Visites d'inspection", valeur: visites, icone: <Stamp size={22} /> },
    { libelle: "Inscriptions", valeur: inscriptions, icone: <GraduationCap size={22} /> },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titre="Rapports d'activité" description="Volumétrie des actions sur les 30 derniers jours." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map((c, i) => (
          <StatCard key={c.libelle} libelle={c.libelle} valeur={c.valeur} icone={c.icone} ton={i % 2 ? "gold" : "forest"} />
        ))}
      </div>

      {estAdmin && (
        <Card>
          <h2 className="mb-3 font-display text-base font-bold text-forest-900">Activité récente (audit)</h2>
          {journal.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucune action enregistrée.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {journal.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-forest-900">{LIBELLE_ACTION[j.action] ?? j.action}</span>
                  <span className="text-xs text-ink-700/55">
                    {j.acteurEmail ?? "—"} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(j.creeLe)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
