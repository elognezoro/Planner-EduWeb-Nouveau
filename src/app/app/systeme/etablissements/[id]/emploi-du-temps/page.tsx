import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { GenerationButton } from "./generation-button";
import { GrilleInteractive } from "./grille-interactive";
import { creneauxHoraires } from "@/lib/emploi-du-temps/horaires";

export const metadata: Metadata = { title: "Emploi du temps" };
export const dynamic = "force-dynamic";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const BASE = (id: string) => `/app/systeme/etablissements/${id}/emploi-du-temps`;

export default async function EmploiDuTempsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vue?: string; cible?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireRole(["admin", "etablissements_admin", "chef_etablissement", "adjoint_chef_etablissement"]);
  if (u.roleReel !== "admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const etab = await prisma.etablissement.findUnique({ where: { id } });
  if (!etab) redirect("/app/systeme/etablissements");

  const [creneaux, classes, disciplines, nbSalles, effSum] = await Promise.all([
    prisma.creneau.findMany({ where: { etablissementId: id }, orderBy: [{ jour: "asc" }, { periode: "asc" }] }),
    prisma.classe.findMany({ where: { etablissementId: id }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.discipline.findMany({ select: { id: true, couleur: true } }),
    prisma.salle.count({ where: { etablissementId: id } }),
    prisma.effectifEnseignant.aggregate({ where: { etablissementId: id }, _sum: { nombre: true } }),
  ]);
  const nbProfs = effSum._sum.nombre ?? 0;

  const couleurDisc = new Map(disciplines.map((d) => [d.id, d.couleur]));
  const couleursRecord: Record<string, string | null> = Object.fromEntries(disciplines.map((d) => [d.id, d.couleur]));
  const creneauxPlain = creneaux.map((c) => ({
    id: c.id, classeId: c.classeId, classeNom: c.classeNom, disciplineId: c.disciplineId,
    disciplineNom: c.disciplineNom, enseignantId: c.enseignantId, enseignantNom: c.enseignantNom,
    salleNom: c.salleNom, jour: c.jour, periode: c.periode, duree: c.duree,
  }));

  // Options de vue
  const vue = sp.vue === "enseignant" || sp.vue === "salle" ? sp.vue : "classe";
  const enseignants = [...new Map(creneaux.map((c) => [c.enseignantId, c.enseignantNom])).entries()].map(([v, l]) => ({ v, l })).sort((a, b) => a.l.localeCompare(b.l));
  const salles = [...new Set(creneaux.map((c) => c.salleNom))].sort().map((v) => ({ v, l: v }));
  const optionsCible = vue === "classe" ? classes.map((c) => ({ v: c.id, l: c.nom })) : vue === "enseignant" ? enseignants : salles;
  const cible = sp.cible && optionsCible.some((o) => o.v === sp.cible) ? sp.cible : optionsCible[0]?.v ?? "";

  // Créneaux filtrés selon la vue
  const filtres = creneaux.filter((c) =>
    vue === "classe" ? c.classeId === cible : vue === "enseignant" ? c.enseignantId === cible : c.salleNom === cible,
  );
  const parCle = new Map(filtres.map((c) => [`${c.jour}:${c.periode}`, c]));
  const couvert = new Set<string>();
  for (const c of filtres) for (let d = 1; d < c.duree; d++) couvert.add(`${c.jour}:${c.periode + d}`);

  const periodes = Array.from({ length: Math.max(1, etab.creneauxParJour) }, (_, i) => i);
  const horaires = creneauxHoraires(etab);

  function contenu(c: (typeof creneaux)[number]) {
    if (vue === "classe") return { t1: c.disciplineNom, t2: c.salleNom, t3: c.enseignantNom, did: c.disciplineId };
    if (vue === "enseignant") return { t1: c.classeNom, t2: c.disciplineNom, t3: c.salleNom, did: c.disciplineId };
    return { t1: c.classeNom, t2: c.disciplineNom, t3: c.enseignantNom, did: c.disciplineId };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href={`/app/systeme/etablissements/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={16} /> Configuration de l&apos;établissement
      </Link>

      <PageHeader
        titre="Emploi du temps"
        description={`${etab.nom} — génération par solveur de contraintes. Journée : ${etab.horaireDebutMatin ?? "?"}–${etab.horaireFinJournee ?? "?"}, ${etab.creneauxParJour} créneaux/jour.`}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-ink-700/70">
          <span>{classes.length} classe(s)</span>
          <span>·</span>
          <span>{Math.max(nbSalles, etab.nbSallesDisponibles)} salle(s) disponible(s)</span>
          <span>·</span>
          <span>{nbProfs} enseignant(s) déclaré(s)</span>
          <span>·</span>
          <span>{creneaux.length} créneau(x) généré(s)</span>
        </div>
        <GenerationButton etablissementId={id} />
        <p className="mt-3 text-xs text-ink-700/55">
          La génération utilise les <strong>effectifs d&apos;enseignants</strong> déclarés par cycle et
          discipline (bloc « Effectifs des enseignants » de la configuration) — aucun compte
          nominatif requis.
        </p>
      </Card>

      {creneaux.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <CalendarDays size={26} />
          </span>
          <p className="mt-4 text-sm text-ink-700/65">
            Aucun emploi du temps généré pour le moment. Lancez la génération ci-dessus.
          </p>
        </Card>
      ) : (
        <Card>
          {/* Sélecteur de vue */}
          <form method="get" action={BASE(id)} className="mb-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">Vue</label>
              <select name="vue" defaultValue={vue} className="h-10 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                <option value="classe">Par classe</option>
                <option value="enseignant">Par enseignant</option>
                <option value="salle">Par salle</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">
                {vue === "classe" ? "Classe" : vue === "enseignant" ? "Enseignant" : "Salle"}
              </label>
              <select name="cible" defaultValue={cible} className="h-10 min-w-[12rem] rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                {optionsCible.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="h-10 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700">Afficher</button>
          </form>

          {vue === "classe" ? (
            <GrilleInteractive
              classeId={cible}
              creneaux={creneauxPlain}
              creneauxParJour={etab.creneauxParJour}
              jours={JOURS}
              couleurs={couleursRecord}
              horaires={horaires ?? undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-cream-200 bg-cream-50 px-2 py-2 text-xs font-semibold text-ink-700/60">Horaire</th>
                    {JOURS.map((j) => (
                      <th key={j} className="border border-cream-200 bg-cream-50 px-2 py-2 text-xs font-semibold text-forest-800">{j}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodes.map((per) => (
                    <tr key={per}>
                      <td className="whitespace-nowrap border border-cream-200 bg-cream-50 px-2 py-2 text-center text-[0.7rem] font-medium text-ink-700/60">
                        {horaires?.[per] ? (
                          <span className="leading-tight">
                            {horaires[per].debut}
                            <span className="block text-ink-700/40">{horaires[per].fin}</span>
                          </span>
                        ) : (
                          `P${per + 1}`
                        )}
                      </td>
                      {JOURS.map((_, jour) => {
                        const k = `${jour}:${per}`;
                        if (couvert.has(k)) return null;
                        const c = parCle.get(k);
                        if (!c) return <td key={jour} className="border border-cream-100" />;
                        const ct = contenu(c);
                        const couleur = couleurDisc.get(ct.did) ?? "#154231";
                        return (
                          <td key={jour} rowSpan={c.duree} className="relative border border-cream-200 p-1.5 align-top">
                            <div aria-hidden className="pointer-events-none absolute inset-1.5 rounded-lg" style={{ backgroundColor: `${couleur}1a`, borderLeft: `3px solid ${couleur}` }} />
                            <div className="relative px-2 py-1.5">
                              <p className="text-xs font-semibold text-forest-900">{ct.t1}</p>
                              <p className="text-[0.65rem] text-ink-700/70">{ct.t2}</p>
                              <p className="text-[0.65rem] text-ink-700/55">{ct.t3}</p>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
