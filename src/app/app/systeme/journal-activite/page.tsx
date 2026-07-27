import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { ScrollText, Activity, ShieldAlert, Download } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";

export const metadata: Metadata = { title: "Journal d'activité" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/journal-activite";

/** Libellés lisibles des actions les plus fréquentes (les actions auto « modele.operation » restent brutes). */
const LIBELLE_ACTION: Record<string, string> = {
  "demande_role.approuvee": "Demande de rôle approuvée",
  "demande_role.refusee": "Demande de rôle refusée",
  "securite.connexion": "Connexion",
  "securite.connexion_echec": "Échec de connexion",
  "securite.deconnexion": "Déconnexion",
  "securite.mot_de_passe_change": "Mot de passe modifié",
  "securite.mot_de_passe_reinitialise": "Mot de passe réinitialisé",
  "securite.2fa_activee": "Double authentification activée",
  "securite.2fa_desactivee": "Double authentification désactivée",
  "securite.2fa_code_envoye": "Code de vérification envoyé",
};

const LIBELLE_SOURCE: Record<string, string> = {
  securite: "Sécurité",
  metier: "Métier",
  auto: "Automatique",
};

function libelleAction(a: string) {
  return LIBELLE_ACTION[a] ?? a;
}
function dateHeure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function classesSource(s: string | null) {
  if (s === "securite") return "bg-red-100 text-red-700";
  if (s === "metier") return "bg-forest-100 text-forest-800";
  return "bg-cream-200 text-ink-700"; // auto / inconnu
}

const PERIODES: { valeur: string; libelle: string }[] = [
  { valeur: "1", libelle: "24 heures" },
  { valeur: "7", libelle: "7 jours" },
  { valeur: "30", libelle: "30 jours" },
  { valeur: "90", libelle: "90 jours" },
  { valeur: "", libelle: "Tout l'historique" },
];

export default async function JournalActivitePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; entite?: string; acteur?: string; jours?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const filtreSource = ["securite", "metier", "auto"].includes(sp.source ?? "") ? sp.source! : "";
  const filtreEntite = sp.entite?.trim() || "";
  const filtreActeur = sp.acteur?.trim() || "";
  const jours = sp.jours === undefined ? "7" : sp.jours; // défaut : 7 jours (volume auto élevé)
  const nbJours = /^\d+$/.test(jours) ? Number(jours) : null;
  const depuis = nbJours ? new Date(Date.now() - nbJours * 86_400_000) : null;

  const where: Prisma.JournalActiviteWhereInput = {
    ...(filtreSource ? { source: filtreSource } : {}),
    ...(filtreEntite ? { entite: filtreEntite } : {}),
    ...(filtreActeur ? { acteurEmail: { contains: filtreActeur, mode: "insensitive" } } : {}),
    ...(depuis ? { creeLe: { gte: depuis } } : {}),
  };

  let erreur = false;
  let total = 0;
  let aujourdhui = 0;
  let securite = 0;
  let entites: string[] = [];
  let entrees: {
    id: string;
    creeLe: Date;
    acteurEmail: string | null;
    acteurRole: string | null;
    action: string;
    cible: string | null;
    source: string;
    ip: string | null;
  }[] = [];

  try {
    const debutJour = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const [t, j, s, ents, liste] = await Promise.all([
      prisma.journalActivite.count({ where }),
      prisma.journalActivite.count({ where: { ...where, creeLe: { gte: debutJour } } }),
      prisma.journalActivite.count({ where: { ...where, source: "securite" } }),
      prisma.journalActivite.findMany({
        distinct: ["entite"],
        where: { entite: { not: null } },
        select: { entite: true },
        orderBy: { entite: "asc" },
        take: 200,
      }),
      prisma.journalActivite.findMany({
        where,
        orderBy: { creeLe: "desc" },
        take: 200,
        select: {
          id: true, creeLe: true, acteurEmail: true, acteurRole: true,
          action: true, cible: true, source: true, ip: true,
        },
      }),
    ]);
    total = t;
    aujourdhui = j;
    securite = s;
    entites = ents.map((e) => e.entite).filter((e): e is string => !!e);
    entrees = liste;
  } catch (e) {
    console.error("[journal-activite] :", e);
    erreur = true;
  }

  // Conserve les filtres courants dans le lien d'export CSV.
  const qs = new URLSearchParams();
  if (filtreSource) qs.set("source", filtreSource);
  if (filtreEntite) qs.set("entite", filtreEntite);
  if (filtreActeur) qs.set("acteur", filtreActeur);
  if (jours !== "7") qs.set("jours", jours);
  const lienExport = `${BASE}/export${qs.toString() ? `?${qs.toString()}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Journal d'activité"
        description="Traçabilité de toutes les activités des utilisateurs : modifications de données (capture automatique) et évènements de sécurité."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">{"Impossible de charger le journal d'activité."}</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Évènements (filtre courant)" valeur={total} icone={<ScrollText size={22} />} />
            <StatCard libelle="Aujourd'hui" valeur={aujourdhui} icone={<Activity size={22} />} ton="gold" />
            <StatCard libelle="Évènements de sécurité" valeur={securite} icone={<ShieldAlert size={22} />} />
          </div>

          <Card>
            <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[10rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Nature</label>
                <select name="source" defaultValue={filtreSource} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="">Toutes les natures</option>
                  <option value="securite">Sécurité</option>
                  <option value="metier">Métier</option>
                  <option value="auto">Automatique (données)</option>
                </select>
              </div>
              <div className="min-w-[10rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Entité</label>
                <select name="entite" defaultValue={filtreEntite} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="">Toutes les entités</option>
                  {entites.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[10rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Acteur (e-mail)</label>
                <input name="acteur" defaultValue={filtreActeur} placeholder="rechercher…" className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
              </div>
              <div className="min-w-[9rem]">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Période</label>
                <select name="jours" defaultValue={jours} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  {PERIODES.map((p) => (
                    <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">
                Filtrer
              </button>
              <Link href={lienExport} className="inline-flex h-11 items-center gap-2 rounded-full border border-cream-300 px-5 text-sm font-semibold text-forest-800 hover:bg-cream-100">
                <Download size={16} /> Exporter (CSV)
              </Link>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">
              Évènements récents{" "}
              <span className="text-sm font-normal text-ink-700/55">(200 plus récents du filtre)</span>
            </h2>
            {entrees.length === 0 ? (
              <p className="py-4 text-sm text-ink-700/55">Aucun évènement pour ce filtre.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left">
                      <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Date</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Acteur</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Rôle</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Action</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Cible</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Nature</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entrees.map((e) => (
                      <tr key={e.id} className="border-b border-cream-100 last:border-0">
                        <td className="whitespace-nowrap py-2.5 pr-4 text-ink-700/70">{dateHeure(e.creeLe)}</td>
                        <td className="px-2 py-2.5 text-forest-900">{e.acteurEmail ?? "—"}</td>
                        <td className="px-2 py-2.5 text-ink-700/70">{e.acteurRole ?? "—"}</td>
                        <td className="px-2 py-2.5 font-medium text-forest-900">{libelleAction(e.action)}</td>
                        <td className="px-2 py-2.5 font-mono text-xs text-ink-700/55">{e.cible ?? "—"}</td>
                        <td className="px-2 py-2.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${classesSource(e.source)}`}>
                            {LIBELLE_SOURCE[e.source] ?? e.source}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 font-mono text-xs text-ink-700/55">{e.ip ?? "—"}</td>
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
