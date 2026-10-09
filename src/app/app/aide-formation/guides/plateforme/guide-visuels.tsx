import {
  Home, Search, Calendar, Globe, Eye, Bell, GraduationCap, Award,
  BookOpen, FileCheck2, HelpCircle, ArrowRight, ClipboardCheck, Route, LayoutDashboard, CheckCircle2, MoreHorizontal,
} from "lucide-react";

/**
 * Maquettes SCHÉMATIQUES (illustrations, pas des captures réelles) reproduisant
 * les écrans clés d'EduWeb Planner aux couleurs de l'application. Composants serveur.
 */

const pastille = "inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1.5 text-xs text-ink-800 whitespace-nowrap";
const num = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-600 text-[11px] font-bold text-white";

export function Legende({ items }: { items: { n: number; t: string }[] }) {
  return (
    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i.n} className="flex items-start gap-2 text-xs text-ink-800">
          <span className={num}>{i.n}</span>
          <span className="pt-0.5">{i.t}</span>
        </li>
      ))}
    </ul>
  );
}

function Repere({ n }: { n: number }) {
  return <span className={`${num} ml-1`}>{n}</span>;
}

/** La barre supérieure, présente sur toutes les pages. */
export function MaquetteBarre() {
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-cream-50/60 p-3">
        <div className="flex min-w-[640px] items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-forest-700"><Home size={15} /></span>
          <span className="text-xs font-medium text-ink-700/70">Tableau de bord ›<Repere n={1} /></span>
          <span className="ml-auto flex items-center gap-2">
            <span className={pastille}>🇨🇮 Côte d&apos;Ivoire<Repere n={2} /></span>
            <span className={pastille}><Search size={12} /> Rechercher<Repere n={3} /></span>
            <span className={pastille}><Calendar size={12} /> 2025—2026<Repere n={4} /></span>
            <span className={pastille}><Globe size={12} /> FR<Repere n={5} /></span>
            <span className={pastille}><Eye size={12} /> Aperçu de rôle<Repere n={6} /></span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-forest-700"><Bell size={15} /><Repere n={7} /></span>
            <span className={`${pastille} bg-forest-600 text-white`}>A · Admin<Repere n={8} /></span>
          </span>
        </div>
      </div>
      <Legende items={[
        { n: 1, t: "Fil d'Ariane : votre page actuelle." },
        { n: 2, t: "Pays actif (multi-pays)." },
        { n: 3, t: "Recherche globale." },
        { n: 4, t: "Année scolaire." },
        { n: 5, t: "Langue de l'interface." },
        { n: 6, t: "Aperçu de rôle (admins) — voir l'interface d'un autre rôle, en lecture seule." },
        { n: 7, t: "Notifications (décisions de rôle, vie scolaire, alertes)." },
        { n: 8, t: "Votre compte et sa déconnexion." },
      ]} />
    </div>
  );
}

/** Le menu latéral, filtré selon le rôle. */
export function MaquetteMenu() {
  const sections = [
    { i: LayoutDashboard, t: "Pilotage", sub: ["Tableau de bord"] },
    { i: BookOpen, t: "Aide et Formation", sub: ["Guides d'utilisateurs", "Formations", "Parcours", "Corrections"] },
    { i: GraduationCap, t: "Vie scolaire", sub: ["Emplois du temps", "Registre d'appel", "Notes & bulletins…"] },
  ];
  return (
    <div>
      <div className="max-w-xs rounded-2xl border border-cream-200 bg-forest-950 p-3 text-cream-50">
        {sections.map((s) => (
          <div key={s.t} className="mb-2">
            <p className="flex items-center gap-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-cream-50/60">
              <s.i size={13} /> {s.t}
            </p>
            {s.sub.map((x) => (
              <p key={x} className="rounded-lg px-3 py-1.5 text-xs text-cream-50/90 hover:bg-forest-900">{x}</p>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-700/60">Le menu s&apos;adapte à votre rôle : vous ne voyez que les espaces auxquels vous avez droit.</p>
    </div>
  );
}

/**
 * L'application sur TÉLÉPHONE : en-tête compact et barre d'onglets. Affichée seulement sur un
 * écran de téléphone ou de tablette, à la place des maquettes de la barre supérieure et du menu
 * latéral de l'ordinateur (qui n'existent pas sur ces écrans). Jamais imprimée.
 */
export function MaquetteMobile() {
  const onglets = [
    { i: Home, t: "Accueil" },
    { i: Calendar, t: "Horaires" },
    { i: Bell, t: "Messages" },
    { i: ClipboardCheck, t: "Appel" },
  ];
  return (
    <div>
      <div className="mx-auto max-w-xs overflow-hidden rounded-[1.75rem] border-4 border-forest-950 bg-cream-50">
        {/* En-tête */}
        <div className="relative flex items-center gap-1 border-b border-cream-200 bg-cream-50 px-2 py-2">
          <span className="absolute -bottom-2.5 left-2"><Repere n={1} /></span>
          <span className="absolute -bottom-2.5 right-2"><Repere n={2} /></span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-forest-800"><ArrowRight size={16} className="rotate-180" /></span>
          <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-forest-900">Ma page</span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-forest-800"><MoreHorizontal size={15} /></span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-forest-800"><Bell size={15} /></span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-gold-300">A</span>
        </div>
        {/* Contenu */}
        <div className="space-y-2 px-3 py-4">
          <div className="h-3 w-2/3 rounded-full bg-cream-200" />
          <div className="h-16 rounded-2xl bg-white" />
          <div className="grid grid-cols-2 gap-2"><div className="h-12 rounded-xl bg-white" /><div className="h-12 rounded-xl bg-white" /></div>
        </div>
        {/* Barre d'onglets */}
        <div className="relative flex items-stretch justify-around border-t border-cream-200 bg-white px-1 py-1.5">
          <span className="absolute -top-2.5 left-1"><Repere n={3} /></span>
          <span className="absolute -top-2.5 right-1"><Repere n={4} /></span>
          {onglets.map((o, k) => (
            <span key={o.t} className={`flex flex-col items-center gap-0.5 text-xs ${k === 0 ? "font-semibold text-forest-800" : "text-ink-700/60"}`}>
              <o.i size={16} /> {o.t}
            </span>
          ))}
          <span className="flex flex-col items-center gap-0.5 text-xs text-ink-700/60"><LayoutDashboard size={16} /> Plus</span>
        </div>
      </div>
      <Legende items={[
        { n: 1, t: "En-tête : bouton retour et titre de la page ouverte." },
        { n: 2, t: "Réglages (recherche, pays, année scolaire…), notifications et votre compte (profil, déconnexion)." },
        { n: 3, t: "Barre d'onglets : vos 4 espaces les plus utiles, adaptés à votre rôle." },
        { n: 4, t: "« Plus » ouvre le menu complet, filtré selon votre rôle." },
      ]} />
    </div>
  );
}

// Téléphone : la frise horizontale (720 px, deux étapes visibles) devient verticale — étapes
// pleine largeur en rangées compactes (icône à gauche), flèches tournées vers le bas.
function Etape({ icone: Icone, titre, sous }: { icone: typeof BookOpen; titre: string; sous: string }) {
  return (
    <div className="flex w-40 shrink-0 flex-col items-center rounded-2xl border border-cream-200 bg-white p-3 text-center shadow-soft mobile:w-full mobile:flex-row mobile:gap-3 mobile:px-3 mobile:py-2.5 mobile:text-left">
      <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-forest-50 text-forest-700 mobile:mb-0 mobile:shrink-0"><Icone size={18} /></span>
      <div className="contents mobile:block mobile:min-w-0">
        <p className="text-xs font-bold text-forest-900">{titre}</p>
        <p className="text-[11px] text-ink-700/60 mobile:text-xs">{sous}</p>
      </div>
    </div>
  );
}

function Fleche() {
  return <ArrowRight size={18} className="shrink-0 self-center text-forest-400 mobile:rotate-90" />;
}

/** Le parcours d'un apprenant dans le LMS, du catalogue à l'attestation / au badge. */
export function FluxLMS() {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] items-stretch gap-2 mobile:min-w-0 mobile:flex-col">
        <Etape icone={BookOpen} titre="Guides" sous="Choisir un cours" />
        <Fleche />
        <Etape icone={HelpCircle} titre="Suivre" sous="Texte · vidéo · quiz · devoir" />
        <Fleche />
        <Etape icone={CheckCircle2} titre="Valider" sous="Seuil + quiz sommatifs" />
        <Fleche />
        <Etape icone={GraduationCap} titre="Attestation" sous="Par cours terminé" />
      </div>
      <div className="mt-2 flex min-w-[720px] items-center gap-2 mobile:mt-4 mobile:min-w-0 mobile:flex-col">
        <Etape icone={Route} titre="Parcours" sous="Plusieurs cours" />
        <Fleche />
        <Etape icone={ClipboardCheck} titre="Tout terminer" sous="Chaque cours validé" />
        <Fleche />
        <Etape icone={Award} titre="Badge" sous="Décerné automatiquement" />
      </div>
    </div>
  );
}

/** Aperçu schématique de l'attestation de réussite. */
export function MaquetteAttestation() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border-2 border-gold-300 bg-white p-5 text-center shadow-soft">
      <span className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 text-white"><GraduationCap size={20} /></span>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest-700">EduWeb Planner · Académie</p>
      <div className="my-2 flex items-center justify-center gap-2 text-gold-500"><span className="h-px w-8 bg-gold-300" /><Award size={16} /><span className="h-px w-8 bg-gold-300" /></div>
      <p className="font-display text-lg font-black text-forest-900">Attestation de réussite</p>
      <p className="text-[11px] text-ink-700/60">atteste que</p>
      <p className="font-display text-base font-bold text-forest-800">Prénom NOM</p>
      <p className="text-[11px] text-ink-700/70">a validé « Titre du cours »</p>
      <p className="mx-auto mt-2 inline-block rounded-full bg-forest-50 px-3 py-1 text-[11px] text-forest-800">Score moyen : 92 % · Mention : Excellent</p>
      <div className="mt-3 flex items-end justify-between text-[10px] text-ink-700/60">
        <span>Réf : EWB-XXXXXX</span>
        <span className="text-right"><span className="mb-0.5 block h-6 w-24 border-b border-ink-700/25" />Le signataire</span>
      </div>
    </div>
  );
}
