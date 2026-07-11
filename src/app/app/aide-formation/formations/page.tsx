import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Users, Clock, MapPin, Video, Settings, UserCheck, BookOpen, BarChart3, ArrowUpRight } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { FORMATS_SESSION } from "@/lib/lms";
import { BoutonSession } from "../boutons-lms";

export const metadata: Metadata = { title: "Formations — Aide et Formation" };
export const dynamic = "force-dynamic";

const libelleFormat = (v: string) => FORMATS_SESSION.find((f) => f.v === v)?.libelle ?? v;
function dateHeure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(d);
}
function heure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(d);
}
/** Créneau début → fin : heure seule si même jour, sinon date & heure complètes. */
function creneau(debut: Date, fin: Date | null) {
  if (!fin) return dateHeure(debut);
  const memeJour = debut.toDateString() === fin.toDateString();
  return `${dateHeure(debut)} → ${memeJour ? heure(fin) : dateHeure(fin)}`;
}

export default async function FormationsPage() {
  const u = await requireUtilisateur();
  const estAdmin = u.roleActif === "admin";
  const pays = u.portee.pays;

  const sessions = await prisma.sessionFormation.findMany({
    where: {
      statut: "planifiee",
      // Sessions de démonstration réservées à l'Admin système (invisibles aux autres rôles).
      ...(estAdmin ? {} : { NOT: { titre: { startsWith: "Démo" } } }),
      OR: [{ publicCible: { isEmpty: true } }, { publicCible: { has: u.roleActif } }],
      AND: [{ OR: [{ pays: null }, ...(pays ? [{ pays }] : [])] }],
    },
    orderBy: { dateDebut: "asc" },
    select: {
      id: true, titre: true, description: true, format: true, animateur: true, dateDebut: true, dateFin: true,
      dureeMinutes: true, lienVisio: true, lieu: true, placesMax: true, coursIds: true,
      _count: { select: { inscriptions: true } },
    },
  });
  const mesInscriptions = new Set(
    (await prisma.inscriptionSession.findMany({ where: { utilisateurId: u.id }, select: { sessionId: true } })).map((i) => i.sessionId),
  );
  // Résout les cours liés (publiés) pour les afficher sous chaque session.
  const idsCours = [...new Set(sessions.flatMap((s) => s.coursIds))];
  const coursParId = new Map(
    (idsCours.length
      ? await prisma.cours.findMany({ where: { id: { in: idsCours }, statut: "publie" }, select: { id: true, titre: true, slug: true } })
      : []
    ).map((c) => [c.id, c]),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Formations"
        description="Sessions de formation à l'utilisation d'EduWeb Planner — inscrivez-vous en ligne."
        action={
          estAdmin ? (
            <Link href="/app/aide-formation/gestion" className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">
              <Settings size={16} /> Gérer
            </Link>
          ) : undefined
        }
      />

      <a
        href="/dhfc/module-maitre.html"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-2xl border border-forest-700 bg-gradient-to-r from-forest-600 to-forest-800 p-5 text-white shadow-soft transition hover:from-forest-700 hover:to-forest-900"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BarChart3 size={24} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold">Module maître interactif — Analyse des besoins DHFC-EBiS</h2>
          <p className="text-sm text-cream-50/85">Rapport navigable : contexte, 5 critères objectifs, besoins par population, graphiques interactifs et quiz de maîtrise.</p>
        </div>
        <ArrowUpRight size={20} className="shrink-0 transition group-hover:translate-x-0.5" />
      </a>

      {sessions.length === 0 ? (
        <Card className="py-12 text-center">
          <CalendarClock size={30} className="mx-auto mb-3 text-forest-300" />
          <p className="text-sm text-ink-700/70">Aucune session programmée pour le moment.</p>
          {estAdmin && (
            <Link href="/app/aide-formation/gestion" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">
              Programmer une session →
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => {
            const inscrit = mesInscriptions.has(s.id);
            const complet = s.placesMax != null && s.placesMax > 0 && s._count.inscriptions >= s.placesMax;
            return (
              <Card key={s.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-bold text-forest-900">{s.titre}</h2>
                      <Badge ton="neutre">{libelleFormat(s.format)}</Badge>
                      {inscrit && <Badge ton="succes">Inscrit</Badge>}
                    </div>
                    {s.description && <p className="mb-2 text-sm text-ink-700/70">{s.description}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700/65">
                      <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} className="text-forest-600" /> {creneau(s.dateDebut, s.dateFin)}</span>
                      {s.dureeMinutes ? <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-forest-600" /> {s.dureeMinutes} min</span> : null}
                      {s.animateur && <span className="inline-flex items-center gap-1.5"><UserCheck size={13} className="text-forest-600" /> {s.animateur}</span>}
                      {s.lieu && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-forest-600" /> {s.lieu}</span>}
                      {s.lienVisio && inscrit && (
                        <a href={s.lienVisio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-forest-700 hover:underline"><Video size={13} /> Lien de connexion</a>
                      )}
                      <span className="inline-flex items-center gap-1.5"><Users size={13} className="text-forest-600" /> {s._count.inscriptions}{s.placesMax != null && s.placesMax > 0 ? ` / ${s.placesMax}` : ""} inscrit(s)</span>
                    </div>
                    {(() => {
                      const lies = s.coursIds.map((id) => coursParId.get(id)).filter((c): c is { id: string; titre: string; slug: string } => Boolean(c));
                      if (lies.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-ink-700/55">Cours liés :</span>
                          {lies.map((c) => (
                            <Link key={c.id} href={`/app/aide-formation/cours/${c.slug}`} className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-forest-50 px-2.5 py-0.5 font-medium text-forest-700 hover:bg-forest-100">
                              <BookOpen size={12} /> {c.titre}
                            </Link>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="shrink-0"><BoutonSession sessionId={s.id} inscrit={inscrit} complet={complet} /></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
