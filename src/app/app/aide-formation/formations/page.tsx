import type { Metadata } from "next";
import Link from "next/link";
import {
  GraduationCap, Users, BookOpen, Clock, Settings, ShieldCheck, FileText, FileDown,
  Award, ArrowRight, ArrowUpRight, ClipboardList, Presentation, Download, BookMarked, Sparkles,
} from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Formations — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

/** Libellé de rôle lisible (pour la carte « Recommandé pour vous »). */
const LIBELLE_ROLE: Record<string, string> = {
  admin: "Administrateur Système", enseignant: "Enseignant", educateur: "Éducateur",
  chef_etablissement: "Chef d'établissement", parent: "Parent", eleve: "Élève",
  inspecteur: "Inspecteur", drena: "DRENA", conseiller_pedagogique: "Conseiller pédagogique",
  chef_antenne: "Chef d'antenne", etablissements_admin: "Admin établissements",
  cafop_admin: "Admin CAFOP", apfc_admin: "Admin APFC",
};

/** Formations « projet » (à installer) — reprend fidèlement les intitulés de la maquette. */
const PROJETS = [
  { chapeau: "SÉMINAIRE", titre: "Communication pastorale", desc: "Séminaire SENEC des communicateurs de l'Éducation Catholique de Côte d'Ivoire." },
  { chapeau: "SÉMINAIRE", titre: "IA & communication", desc: "Formation SENEC : utiliser l'IA pour produire, adapter, vérifier et sécuriser ses messages, avec discernement." },
  { chapeau: "MANUEL ACADÉMIQUE", titre: "Manuel académique", desc: "Support complet de formation des utilisateurs aux normes académiques." },
];

type BoutonSem = { label: string; primaire?: boolean; href?: string };
type Seminaire = { ton: "violet" | "vert"; chapeau: string; titre: string; desc: string; dispo?: boolean; boutons: BoutonSem[] };
/** Séminaires détaillés — Magnifica est disponible (livre numérique) ; les autres sont des projets à venir. */
const SEMINAIRES: Seminaire[] = [
  {
    ton: "violet", chapeau: "SÉMINAIRE DES ÉCOLES CATHOLIQUES", dispo: true,
    titre: "Magnifica Humanitas — Rester humains à l'ère de l'intelligence artificielle",
    desc: "Atelier interactif de 12 h sur l'encyclique du Saint-Père Léon XIV (15 mai 2026) : 9 modules, 3 quiz auto-corrigés, charte d'usage responsable, grille d'évaluation, glossaire et livret académique exportable. Conçu pour les responsables éducatifs, enseignants, cadres pastoraux, formateurs et parents.",
    boutons: [{ label: "Ouvrir le séminaire", primaire: true, href: "/seminaires/magnifica-humanitas.html" }, { label: "Livret imprimable (PDF)" }, { label: "Livret Word (.docx)" }],
  },
  {
    ton: "vert", chapeau: "SÉMINAIRE DES COMMUNICATEURS · SENEC", dispo: true,
    titre: "Le numérique au service de la communication éducative et pastorale",
    desc: "Présentation contextuelle de 14 diapositives à feuilleter comme un livre numérique, 7 ateliers interactifs (diagnostic, QCM, matrice des publics, check-list RAPIDE, scénario de crise, plan d'action, engagement personnel), livret académique imprimable, support PowerPoint téléchargeable. Construire une présence cohérente, moderne et engageante.",
    boutons: [{ label: "Ouvrir le séminaire", primaire: true, href: "/seminaires/communication-numerique-pastorale.html" }, { label: "Livret imprimable (PDF)" }, { label: "Livret Word (.docx)" }, { label: "Support PowerPoint" }],
  },
  {
    ton: "violet" as const, chapeau: "SÉMINAIRE DES COMMUNICATEURS · SENEC",
    titre: "L'intelligence artificielle au service de la communication éducative et pastorale",
    desc: "Formation de 2 h 30, suite du séminaire sur le numérique : diagnostic de maturité IA, 3 modules (usages, méthode de prompt P.A.S.T.O.R.A.L., éthique & règle des 5 V), ateliers de correction de contenus générés par IA, auto-évaluation finale et protocole d'usage responsable. Produire avec discernement.",
    boutons: [{ label: "Ouvrir la formation", primaire: true }, { label: "Livret imprimable (PDF)" }, { label: "Livret Word (.docx)" }, { label: "Support PowerPoint" }],
  },
];

export default async function FormationsPage() {
  const u = await requireUtilisateur();
  const estAdmin = u.roleActif === "admin";

  const [guides, formations, inscriptions, roleGuide] = await Promise.all([
    prisma.cours.findMany({
      where: { statut: "publie", estGuide: true },
      select: { id: true, dureeMinutes: true, categorie: { select: { nom: true } }, _count: { select: { modules: true } } },
    }),
    prisma.cours.findMany({
      where: {
        statut: "publie", estGuide: false,
        ...(estAdmin ? {} : { NOT: { slug: { startsWith: "demo-" } } }),
        OR: [{ publicCible: { isEmpty: true } }, { publicCible: { has: u.roleActif } }],
      },
      orderBy: [{ categorie: { ordre: "asc" } }, { ordre: "asc" }, { titre: "asc" }],
      select: { id: true, titre: true, slug: true, description: true, dureeMinutes: true, _count: { select: { modules: true } } },
    }),
    prisma.inscriptionCours.findMany({ where: { utilisateurId: u.id }, select: { coursId: true, progressionPct: true } }),
    prisma.cours.findFirst({
      where: { statut: "publie", estGuide: true, slug: `guide-${u.roleActif}` },
      select: { titre: true, slug: true, description: true, dureeMinutes: true },
    }),
  ]);
  const progression = new Map(inscriptions.map((i) => [i.coursId, i.progressionPct]));

  // Statistiques (guides d'utilisation).
  const nbGuides = guides.length;
  const familles = new Set(guides.map((g) => g.categorie?.nom).filter(Boolean)).size;
  const chapitres = guides.reduce((s, g) => s + g._count.modules, 0);
  const dureeTot = guides.reduce((s, g) => s + (g.dureeMinutes ?? 0), 0);

  const nbFormationsActives = formations.length + PROJETS.length;
  const libelleRole = LIBELLE_ROLE[u.roleActif] ?? "votre rôle";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Formations"
        description="Centre de formation EduWeb Planner — séminaires, manuel académique, guides par rôle et certificats."
        action={
          estAdmin ? (
            <Link href={`${BASE}/gestion`} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">
              <Settings size={16} /> Gérer
            </Link>
          ) : undefined
        }
      />

      {/* Tuiles de statistiques */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile libelle="Guides disponibles" valeur={nbGuides} icone={<BookMarked size={22} />} couleur="bg-forest-50 text-forest-700" />
        <Tuile libelle="Familles de rôles" valeur={familles} icone={<Users size={22} />} couleur="bg-blue-50 text-blue-600" />
        <Tuile libelle="Chapitres au total" valeur={chapitres} icone={<BookOpen size={22} />} couleur="bg-gold-100 text-gold-700" />
        <Tuile libelle="Durée totale" valeur={`${dureeTot} min`} icone={<Clock size={22} />} couleur="bg-purple-50 text-purple-600" />
      </div>

      {/* MES FORMATIONS */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-600 text-white"><GraduationCap size={22} /></span>
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-forest-600">Mes formations</p>
            <h2 className="font-display text-lg font-bold text-forest-900">{nbFormationsActives} formations actives</h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Formations réellement disponibles (câblées) */}
          {formations.map((f) => {
            const pct = progression.get(f.id);
            return (
              <Link key={f.id} href={`${BASE}/cours/${f.slug}`} className="group flex flex-col rounded-2xl border border-cream-200 p-4 transition hover:border-forest-300 hover:shadow-soft">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-forest-600">Formation · {f._count.modules} modules</p>
                  <ArrowUpRight size={16} className="shrink-0 text-forest-500 transition group-hover:translate-x-0.5" />
                </div>
                <h3 className="font-display text-base font-bold text-forest-900">{f.titre}</h3>
                {f.description && <p className="mt-1 line-clamp-2 text-sm text-ink-700/70">{f.description}</p>}
                {pct !== undefined && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500" style={{ width: `${pct}%` }} /></div>
                )}
              </Link>
            );
          })}

          {/* Carte réelle : Guides utilisateurs */}
          <Link href={`${BASE}/guides`} className="group flex flex-col rounded-2xl border border-cream-200 p-4 transition hover:border-forest-300 hover:shadow-soft">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-forest-600">Guides utilisateurs</p>
              <ArrowUpRight size={16} className="shrink-0 text-forest-500 transition group-hover:translate-x-0.5" />
            </div>
            <h3 className="font-display text-base font-bold text-forest-900">Guides utilisateurs</h3>
            <p className="mt-1 line-clamp-2 text-sm text-ink-700/70">Des guides détaillés, un par rôle, pour démarrer rapidement avec EduWeb Planner.</p>
          </Link>

          {/* Formations « projet » (à venir) */}
          {PROJETS.map((p) => (
            <div key={p.titre} className="flex flex-col rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-ink-700/45">{p.chapeau}</p>
                <Badge ton="attente">À venir</Badge>
              </div>
              <h3 className="font-display text-base font-bold text-forest-900/80">{p.titre}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-ink-700/60">{p.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* GESTION DES INSCRIPTIONS (admin) */}
      {estAdmin && (
        <Card className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-700"><Users size={22} /></span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-forest-600">Gestion des inscriptions</p>
              <h2 className="font-display text-lg font-bold text-forest-900">Inscrits &amp; listes</h2>
              <p className="mt-1 text-sm text-ink-700/70">Inscrivez ou désinscrivez un utilisateur à chacune des formations, et téléchargez la liste des inscrits (CSV, Word ou PDF) — une page par formation, avec en-tête institutionnel et effectif.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-forest-700"><Users size={15} /> Gérer les inscriptions</Link>
            <BoutonProjet icone={<Download size={15} />}>Télécharger la liste des inscrits</BoutonProjet>
            <Link href={`${BASE}/corrections`} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100"><ClipboardList size={15} /> Travaux des participants</Link>
          </div>
        </Card>
      )}

      {/* RECOMMANDÉ POUR VOUS */}
      {roleGuide && (
        <div className="relative overflow-hidden rounded-3xl border border-cream-50/10 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 p-6 text-cream-50 shadow-soft">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/10 blur-[90px]" aria-hidden />
          <p className="inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-200/90"><Sparkles size={13} /> Recommandé pour vous</p>
          <h2 className="mt-2 font-display text-xl font-bold sm:text-2xl">{libelleRole}{roleGuide.dureeMinutes ? ` — ${roleGuide.dureeMinutes} min de formation` : ""}</h2>
          {roleGuide.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-200/85">{roleGuide.description}</p>}
          <Link href={`${BASE}/cours/${roleGuide.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-5 py-2.5 text-sm font-bold text-forest-950 shadow-[var(--shadow-gold)] hover:-translate-y-0.5">Commencer la formation <ArrowRight size={16} /></Link>
        </div>
      )}

      {/* MANUEL ACADÉMIQUE COMPLET (projet) */}
      <div className="rounded-3xl border border-gold-200 bg-gradient-to-br from-gold-50 to-forest-50/40 p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-100 text-gold-700"><FileText size={22} /></span>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-gold-700">Manuel académique complet</p>
            <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-forest-900">Support de formation officiel <Badge ton="attente">À venir</Badge></h2>
            <p className="mt-1 text-sm text-ink-700/70">Syllabus, modules de formation (un par rôle), volume horaire, auto-évaluations, exercices pratiques, grille de progression et glossaire général — mise en page A4 conforme aux standards académiques.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <BoutonProjet icone={<BookOpen size={15} />} primaire>Consulter &amp; imprimer (PDF)</BoutonProjet>
          <BoutonProjet icone={<FileDown size={15} />}>Télécharger en Word (.docx)</BoutonProjet>
        </div>
        <p className="mt-3 text-xs italic text-ink-700/55">Le fichier Word inclura le logo, l'entête et une table des matières automatique ; un filigrane d'institution et une page de signatures seront intégrés au support imprimable, en plus du certificat.</p>
      </div>

      {/* CERTIFICAT (projet) */}
      {estAdmin && (
        <Card className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-600 text-white"><Award size={22} /></span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-forest-600">Document officiel</p>
              <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-forest-900">Certificat de fin de formation <Badge ton="attente">À venir</Badge></h2>
              <p className="mt-1 text-sm text-ink-700/70">Modèle officiel personnalisé par votre établissement : numérotation automatique par séquence, reprise de la signature scannée et du cachet configurés, et journal de traçabilité des certificats délivrés. Téléchargeable en Word ou imprimable en PDF.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <BoutonProjet icone={<Award size={15} />} primaire>Délivrer un certificat</BoutonProjet>
            <BoutonProjet icone={<ClipboardList size={15} />}>Journal des délivrés</BoutonProjet>
            <BoutonProjet icone={<FileDown size={15} />}>Modèle vierge (.docx)</BoutonProjet>
          </div>
        </Card>
      )}

      {/* SÉMINAIRES (projet — cartes colorées de la maquette) */}
      <div className="space-y-4">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><Presentation size={18} className="text-forest-600" /> Séminaires</h2>
        {SEMINAIRES.map((s) => {
          const violet = s.ton === "violet";
          return (
            <div key={s.titre} className={cn("relative overflow-hidden rounded-3xl border p-6 shadow-soft", violet ? "border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/40" : "border-forest-200 bg-gradient-to-br from-forest-50 to-forest-100/40")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white", violet ? "bg-purple-500" : "bg-forest-600")}><BookOpen size={22} /></span>
                <div className="min-w-0">
                  <p className={cn("text-[0.7rem] font-semibold uppercase tracking-[0.16em]", violet ? "text-purple-700" : "text-forest-700")}>{s.chapeau}</p>
                  <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-forest-900 sm:text-lg">{s.titre} {s.dispo ? <Badge ton="succes">Disponible</Badge> : <Badge ton="attente">À venir</Badge>}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700/75">{s.desc}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.boutons.map((b) => b.href ? (
                  <a key={b.label} href={b.href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors", violet ? "bg-purple-500 text-white hover:bg-purple-600" : "bg-forest-800 text-cream-50 hover:bg-forest-700")}>{b.label} <ArrowUpRight size={15} /></a>
                ) : (
                  <BoutonProjet key={b.label} primaire={b.primaire} tonViolet={violet}>{b.label}</BoutonProjet>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tuile de statistique colorée (infographie de la maquette). */
function Tuile({ libelle, valeur, icone, couleur }: { libelle: string; valeur: React.ReactNode; icone: React.ReactNode; couleur: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", couleur)}>{icone}</span>
      <div>
        <p className="font-display text-2xl font-bold text-forest-900">{valeur}</p>
        <p className="text-xs text-ink-700/65">{libelle}</p>
      </div>
    </Card>
  );
}

/** Bouton d'une fonctionnalité « projet » (pas encore installée) : visuel fidèle, inactif. */
function BoutonProjet({ children, icone, primaire, tonViolet }: { children: React.ReactNode; icone?: React.ReactNode; primaire?: boolean; tonViolet?: boolean }) {
  return (
    <span
      title="Bientôt disponible — contenu à installer"
      aria-disabled
      className={cn(
        "inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold opacity-60",
        primaire ? (tonViolet ? "bg-purple-500 text-white" : "bg-forest-800 text-cream-50") : "border border-cream-300 bg-white text-forest-800",
      )}
    >
      {icone}
      {children}
    </span>
  );
}
