import Link from "next/link";
import * as Icons from "lucide-react";
import { requireAccesComplet } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { KpiCard } from "@/components/app/kpi-card";
import { Reveal } from "@/components/ui/reveal";
import { DonutRoles, BarEtablissements } from "./dashboard-charts";
import { WidgetAbsences } from "@/components/app/absences/widget-tableau-bord";
import { ROLES } from "@/lib/rbac";
import { navigationEffective } from "@/lib/rbac/permissions-dynamiques";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";

export const dynamic = "force-dynamic";

const libellePortee: Record<string, string> = {
  global: "Périmètre national (global)",
  etablissement: "Périmètre établissement",
  cafop: "Périmètre CAFOP",
  apfc: "Périmètre APFC",
  antenne: "Périmètre antenne pédagogique",
  region: "Périmètre régional",
  personnel: "Périmètre personnel",
};

const LIBELLE_ACTION: Record<string, string> = {
  "demande_role.approuvee": "Demande de rôle approuvée",
  "demande_role.refusee": "Demande de rôle refusée",
};

function Icone({ nom, ...props }: { nom: string } & Icons.LucideProps) {
  const C = (Icons as unknown as Record<string, Icons.LucideIcon>)[nom] ?? Icons.Circle;
  return <C {...props} />;
}

async function donneesAdmin() {
  const debutJour = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [
    utilisateurs,
    demandesEnAttente,
    etablissements,
    classes,
    eleves,
    enseignants,
    creneaux,
    roles,
    classesEtab,
    inscGroupes,
    etabList,
    journal,
    actionsJour,
  ] = await Promise.all([
    prisma.utilisateur.count(),
    prisma.demandeRole.count({ where: { statut: "en_attente" } }),
    prisma.etablissement.count(),
    prisma.classe.count(),
    prisma.inscription.count(),
    prisma.utilisateur.count({ where: { roleActif: { nomTechnique: "enseignant" } } }),
    prisma.creneau.count(),
    prisma.role.findMany({ select: { libelle: true, _count: { select: { utilisateurs: true } } } }),
    prisma.classe.findMany({ select: { id: true, etablissementId: true } }),
    prisma.inscription.groupBy({ by: ["classeId"], _count: { _all: true } }),
    prisma.etablissement.findMany({ where: { classes: { some: {} } }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.journalActivite.findMany({ orderBy: { creeLe: "desc" }, take: 6, select: { id: true, acteurEmail: true, action: true, creeLe: true } }),
    prisma.journalActivite.count({ where: { creeLe: { gte: debutJour } } }),
  ]);

  const roleDist = roles
    .map((r) => ({ role: r.libelle, total: r._count.utilisateurs }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const classeToEtab = new Map(classesEtab.map((c) => [c.id, c.etablissementId]));
  const elevesParEtab = new Map<string, number>();
  for (const g of inscGroupes) {
    const e = classeToEtab.get(g.classeId);
    if (e) elevesParEtab.set(e, (elevesParEtab.get(e) ?? 0) + g._count._all);
  }
  const barEtab = etabList
    .map((e) => ({ label: e.nom.length > 18 ? e.nom.slice(0, 17) + "…" : e.nom, valeur: elevesParEtab.get(e.id) ?? 0 }))
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, 8);

  return {
    kpi: { utilisateurs, demandesEnAttente, etablissements, classes, eleves, enseignants, creneaux },
    roleDist,
    barEtab,
    journal,
    actionsJour,
  };
}

export default async function TableauDeBordPage() {
  const u = await requireAccesComplet();
  const def = ROLES[u.roleActif];
  const estAdmin = u.roleActif === "admin";

  const raccourcis = (await navigationEffective(u.roleActif))
    .flatMap((s) => s.items)
    .filter((i) => i.statut === "disponible" && i.segment !== "")
    .slice(0, estAdmin ? 8 : 6);

  const data = estAdmin ? await donneesAdmin().catch(() => null) : null;

  const terme = await libelleCafop(await paysConsulte());

  return (
    <div className="space-y-8">
      <PageHeader
        titre={`Bonjour, ${u.prenoms ?? u.nomComplet}`}
        description={appliquerTerme(`${u.libelleRoleActif} · ${libellePortee[def.portee]}`, terme)}
      />

      {estAdmin && data ? (
        <>
          {/* Bandeau de pilotage */}
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-forest-800/40 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 p-6 text-cream-50 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300/80">
                    <Icons.Command size={14} /> Pilotage national
                  </p>
                  <h2 className="mt-1.5 font-display text-2xl font-bold">Console d&apos;administration</h2>
                  <p className="mt-1 max-w-xl text-sm text-cream-200/80">
                    Vue d&apos;ensemble de la plateforme : comptes, structures et activité. Tout est
                    opérationnel — pilotez depuis les indicateurs ci-dessous.
                  </p>
                </div>
                {data.kpi.demandesEnAttente > 0 ? (
                  <Link
                    href="/app/systeme/approbations"
                    className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-5 py-2.5 text-sm font-semibold text-forest-950 transition-transform hover:-translate-y-0.5"
                  >
                    <Icons.ClipboardCheck size={16} /> {data.kpi.demandesEnAttente} demande(s) à traiter
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-cream-50/10 px-4 py-2 text-sm font-medium text-cream-200/90">
                    <Icons.CheckCircle2 size={16} className="text-gold-300" /> Aucune demande en attente
                  </span>
                )}
              </div>
            </div>
          </Reveal>

          {/* KPI cliquables */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard index={0} libelle="Comptes" valeur={data.kpi.utilisateurs} icone={<Icons.Users size={22} />} href="/app/systeme/comptes" />
            <KpiCard index={1} libelle="Établissements" valeur={data.kpi.etablissements} ton="gold" icone={<Icons.School size={22} />} href="/app/systeme/etablissements" />
            <KpiCard index={2} libelle="Classes" valeur={data.kpi.classes} icone={<Icons.GraduationCap size={22} />} href="/app/statistiques/etablissement" />
            <KpiCard index={3} libelle="Élèves" valeur={data.kpi.eleves} ton="gold" icone={<Icons.Backpack size={22} />} href="/app/statistiques/analytics" />
            <KpiCard index={4} libelle="Enseignants" valeur={data.kpi.enseignants} icone={<Icons.Presentation size={22} />} href="/app/statistiques/performance-enseignants" />
            <KpiCard
              index={5}
              libelle="Demandes"
              valeur={data.kpi.demandesEnAttente}
              ton={data.kpi.demandesEnAttente > 0 ? "red" : "forest"}
              icone={<Icons.ClipboardCheck size={22} />}
              href="/app/systeme/approbations"
              sousTitre="en attente"
            />
          </div>

          {/* Graphiques */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal delayIndex={0}>
              <Card>
                <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-forest-900">
                  <Icons.PieChart size={18} /> Répartition des comptes par rôle
                </h3>
                <DonutRoles data={data.roleDist} />
              </Card>
            </Reveal>
            <Reveal delayIndex={1}>
              <Card>
                <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-forest-900">
                  <Icons.BarChart3 size={18} /> Élèves par établissement
                </h3>
                <BarEtablissements data={data.barEtab} />
              </Card>
            </Reveal>
          </div>

          {/* Activité récente + accès rapides */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Reveal delayIndex={0}>
              <Card className="h-full">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold text-forest-900">
                    <Icons.Activity size={18} /> Activité récente
                  </h3>
                  <Link href="/app/systeme/journal-activite" className="text-xs font-semibold text-forest-700 hover:text-forest-900">
                    Journal
                  </Link>
                </div>
                {data.journal.length === 0 ? (
                  <p className="text-sm text-ink-700/55">Aucune action enregistrée.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {data.journal.map((j) => (
                      <li key={j.id} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                        <span className="min-w-0">
                          <span className="block text-forest-900">{LIBELLE_ACTION[j.action] ?? j.action}</span>
                          <span className="block text-xs text-ink-700/50">
                            {j.acteurEmail ?? "—"} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(j.creeLe)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 border-t border-cream-100 pt-3 text-xs text-ink-700/50">
                  {data.actionsJour} action(s) enregistrée(s) aujourd&apos;hui.
                </p>
              </Card>
            </Reveal>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-ink-700/60">Accès rapides</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {raccourcis.map((item, i) => (
                  <Reveal key={item.id} delayIndex={i}>
                    <Link
                      href={`/app/${item.segment}`}
                      className="group flex items-start gap-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-soft transition-all hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-800 text-gold-300">
                        <Icone nom={item.icone} size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-forest-900">{item.libelle}</p>
                        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-700/60">{item.description}</p>}
                      </div>
                      <Icons.ArrowUpRight size={15} className="ml-auto shrink-0 text-ink-700/25 transition-colors group-hover:text-gold-600" />
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <Card className="border-forest-200 bg-gradient-to-br from-forest-800 to-forest-950 text-cream-50">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                <Icons.Sparkles size={22} />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">Bienvenue sur EduWeb Planner</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-cream-200/80">
                  Votre interface s&apos;adapte à votre rôle. Retrouvez ci-dessous vos accès directs.
                </p>
              </div>
            </div>
          </Card>

          <WidgetAbsences userId={u.id} roleActif={u.roleActif} etablissementId={u.portee.etablissementId} />

          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-ink-700/60">Accès rapides</h2>
            {raccourcis.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {raccourcis.map((item, i) => (
                  <Reveal key={item.id} delayIndex={i}>
                    <Link
                      href={`/app/${item.segment}`}
                      className="group flex h-full items-start gap-4 rounded-2xl border border-cream-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-800 text-gold-300">
                        <Icone nom={item.icone} size={20} />
                      </span>
                      <div>
                        <p className="font-semibold text-forest-900">{item.libelle}</p>
                        {item.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-700/65">{item.description}</p>}
                      </div>
                      <Icons.ArrowUpRight size={16} className="ml-auto text-ink-700/30 transition-colors group-hover:text-gold-600" />
                    </Link>
                  </Reveal>
                ))}
              </div>
            ) : (
              <Card>
                <p className="text-sm text-ink-700/70">Aucun module n&apos;est encore disponible pour votre rôle.</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
