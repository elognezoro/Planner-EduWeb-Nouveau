"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as Icons from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { ROLES, segmentNavActif, type RoleId, type SectionNav } from "@/lib/rbac";
import { seDeconnecter } from "@/app/app/actions";
import { BandeauHorsLigne } from "@/components/app/bandeau-hors-ligne";
import { quitterApercu } from "@/app/app/systeme/apercu/actions";
import { BandeauEssai } from "@/components/app/bandeau-essai";
import { ClocheNotifications } from "@/components/app/notifications/cloche";
import { FilAriane } from "@/components/app/breadcrumb";
import { BarreOutils, type OutilsBarre } from "@/components/app/barre-outils";
import { EnteteMobile } from "@/components/app/mobile/entete-mobile";
import { BarreOnglets } from "@/components/app/mobile/barre-onglets";
import { useSousSeuilMobile } from "@/lib/mobile/appareil";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import { SuiviNavigation } from "@/components/app/mobile/suivi-navigation";
import { ChargementPage } from "@/components/app/mobile/chargement-page";
import type { NotificationItem } from "@/lib/notifications/actions";
import type { DemandeEnAttenteSerialisee } from "./types";

export interface UtilisateurShell {
  nomComplet: string;
  email: string;
  roleActif: RoleId;
  libelleRoleActif: string;
  photoUrl: string | null;
  accesRestreint: boolean;
  demandeEnAttente: DemandeEnAttenteSerialisee | null;
  /** Aperçu de RÔLE (lecture seule). Faux en mode assistance — cf. `enApercu` pour le bandeau. */
  apercuActif: boolean;
  /** Mode ASSISTANCE : l'opérateur écrit pour le compte de cet utilisateur. */
  assistance: { operateurEmail: string; cibleNom: string; cibleEmail: string } | null;
  /** Aperçu de rôle OU assistance : pilote le bandeau permanent. */
  enApercu: boolean;
  /** Rôle en LECTURE SEULE (adc, delc) : bandeau permanent + contrôles d'édition masqués. */
  lectureSeule: boolean;
  /** Fin de période d'essai (ISO) ou null. Déclenche le bandeau rouge de compte à rebours. */
  essaiFinLe: string | null;
}

const couleurGroupe: Record<string, string> = {
  pilotage: "bg-forest-100 text-forest-800",
  formation: "bg-gold-100 text-gold-800",
  etablissement: "bg-cream-200 text-forest-800",
  famille: "bg-cream-100 text-ink-700",
};

/**
 * Couleur d'accent (hex) par section de la barre latérale : chaque en-tête affiche un badge
 * d'icône coloré, en ligne avant le libellé. Teintes claires calibrées pour le fond forest
 * sombre du menu, distinctes entre elles et choisies pour rester représentatives de la section
 * (école = vert, finances = lime, formation = ambre, rapports = orange, statistiques = fuchsia…).
 * Style inline en hex volontaire : robuste quel que soit le registre de tokens Tailwind, et sans
 * classes construites dynamiquement (que le scanner Tailwind ne détecterait pas).
 */
const couleurSection: Record<string, string> = {
  pilotage: "#818cf8", // indigo — pilotage / tableau de bord
  "aide-formation": "#38bdf8", // ciel — aide et formation
  "mon-compte": "#c084fc", // violet — compte personnel
  systeme: "#f87171", // rouge — administration / système
  etablissements: "#34d399", // émeraude — établissements (écoles)
  cafop: "#fbbf24", // ambre — formation initiale des maîtres
  apfc: "#2dd4bf", // turquoise — réseau d'antennes (APFC)
  "vie-scolaire": "#f472b6", // rose — vie scolaire
  economat: "#a3e635", // lime — économat / finances
  rapports: "#fb923c", // orange — rapports & activités
  statistiques: "#e879f9", // fuchsia — statistiques
};

/** Repli (ton doré discret) pour toute section non mappée ci-dessus. */
const COULEUR_SECTION_DEFAUT = "#d8c39a";

function Icone({ nom, className }: { nom: string; className?: string }) {
  const Composant = (Icons as unknown as Record<string, Icons.LucideIcon>)[nom] ?? Icons.Circle;
  return <Composant className={className} />;
}

function hrefDe(segment: string): string {
  return segment ? `/app/${segment}` : "/app";
}

/** Identifiant de la section contenant la route active (pour ouvrir l'accordéon par défaut). */
function sectionActive(sections: SectionNav[], segmentActif: string | null): string | null {
  if (segmentActif !== null) {
    for (const s of sections) {
      if (s.items.some((i) => i.segment === segmentActif)) return s.id;
    }
  }
  return sections[0]?.id ?? null;
}

/** Accès restreint : seules Mon Identification / Mon Profil (cahier §6.3). */
function sectionsVisibles(u: UtilisateurShell, sections: SectionNav[]): SectionNav[] {
  if (!u.accesRestreint) return sections;
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (i) => i.segment === "mon-identification" || i.segment === "mon-profil",
      ),
    }))
    .filter((s) => s.items.length > 0);
}

export function AppShell({
  utilisateur,
  sections: sectionsEffectives,
  termeCafop = "CAFOP",
  termeApfc = "APFC",
  notificationsInitiales,
  nonLuesInitiales,
  outils,
  children,
}: {
  utilisateur: UtilisateurShell;
  /** Navigation effective (matrice des droits dynamique), calculée côté serveur. */
  sections: SectionNav[];
  /** Terme local des CAFOP (par pays) pour le fil d'Ariane. */
  termeCafop?: string;
  /** Terme local des APFC (par pays) pour le fil d'Ariane. */
  termeApfc?: string;
  notificationsInitiales: NotificationItem[];
  nonLuesInitiales: number;
  /** Données de la barre d'outils (pays, année scolaire, langue, aperçu de rôle). */
  outils: OutilsBarre;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuMobile, setMenuMobile] = useState(false);
  // Sur téléphone, la barre d'outils et la cloche de cet en-tête sont remplacées par celles
  // de l'en-tête mobile : on ne les monte pas deux fois (le rendu SERVEUR, lui, est inchangé).
  const surTelephone = useSousSeuilMobile();
  const [userMenu, setUserMenu] = useState(false);
  const [sidebarOuvert, setSidebarOuvert] = useState(true);
  const sections = sectionsVisibles(utilisateur, sectionsEffectives);
  // Accordéon : une seule section ouverte à la fois. `undefined` = pas de choix explicite
  // → par défaut, seule la section contenant la page active est ouverte. `null` = tout fermé.
  const [ouverteExplicite, setOuverteExplicite] = useState<string | null | undefined>(undefined);
  // Item actif : alias appliqués (ex. pages de cours → « Formations ») puis préfixe le plus précis.
  const segmentActif = segmentNavActif(pathname, sections.flatMap((s) => s.items));
  const idActif = sectionActive(sections, segmentActif);
  const ouverteEffective = ouverteExplicite === undefined ? idActif : ouverteExplicite;
  const estOuverte = (id: string) => ouverteEffective === id;

  // Restaure l'état « masqué/affiché » de la barre latérale (persisté côté client).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation depuis localStorage
    if (localStorage.getItem("eduweb_sidebar") === "0") setSidebarOuvert(false);
  }, []);
  useEffect(() => {
    localStorage.setItem("eduweb_sidebar", sidebarOuvert ? "1" : "0");
  }, [sidebarOuvert]);

  // Espace connecté = barre d'onglets en bas sous 1024 px. La classe permet au CSS de
  // remonter les boutons flottants montés ailleurs (assistant IA, dans la mise en page
  // racine) au-dessus de cette barre — uniquement sur mobile, voir globals.css.
  useEffect(() => {
    document.body.classList.add("avec-barre-onglets");
    return () => document.body.classList.remove("avec-barre-onglets");
  }, []);

  function toggleSection(id: string) {
    // Ouvre la section cliquée (fermant les autres) ; recliquer sur celle ouverte referme tout.
    setOuverteExplicite((cur) => {
      const actuelle = cur === undefined ? idActif : cur;
      return actuelle === id ? null : id;
    });
  }

  const rendreNav = (ton: "sombre" | "clair") => {
    const sombre = ton === "sombre";
    const cSection = sombre
      ? "text-cream-200/45 hover:bg-cream-50/5 hover:text-cream-200/70"
      : "min-h-11 text-ink-700/75 active:bg-cream-200";
    const cLien = sombre
      ? "text-cream-200/75 hover:bg-cream-50/5 hover:text-cream-50"
      : "text-ink-700/80 active:bg-cream-200";
    const cLienActif = sombre ? "bg-gold-500/15 text-gold-200" : "bg-forest-100 text-forest-900";
    const cAvenir = sombre ? "text-cream-200/35" : "text-ink-700/35";
    const cBadge = sombre ? "bg-cream-50/5 text-cream-200/40" : "bg-cream-200 text-ink-700/45";
    const cIndent = sombre ? "border-cream-50/15" : "border-cream-300";
    const cPastille = sombre ? "bg-gold-400" : "bg-forest-600";
    // Cibles tactiles plus hautes dans la feuille (le doigt, pas la souris).
    const cHauteur = sombre ? "py-2" : "min-h-11 py-2.5";
    return (
    <nav className="flex flex-col gap-1.5 px-3 py-4">
      {sections.map((section) => {
        const ouvert = estOuverte(section.id);
        const accent = couleurSection[section.id] ?? COULEUR_SECTION_DEFAUT;
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] transition-colors",
                cSection,
              )}
              aria-expanded={ouvert}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: `${accent}26`,
                    color: accent,
                    boxShadow: `inset 0 0 0 1px ${accent}33`,
                  }}
                  aria-hidden
                >
                  <Icone nom={section.icone} className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{section.libelle}</span>
              </span>
              <Icons.ChevronDown
                size={14}
                className={cn("shrink-0 transition-transform", ouvert ? "" : "-rotate-90")}
              />
            </button>
            {ouvert && (
              <ul className="mt-0.5 space-y-0.5">
                {section.items.map((item) => {
                  const href = hrefDe(item.segment);
                  const actif = item.segment === segmentActif;
                  if (item.statut === "a_venir") {
                    return (
                      <li key={item.id} className={cn(item.indente && "ml-6 border-l pl-1.5", item.indente && cIndent)}>
                        <span className={cn("flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm", cAvenir)}>
                          <Icone nom={item.icone} className="h-4.5 w-4.5 shrink-0" />
                          <span className="flex-1">{item.libelle}</span>
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium", cBadge)}>
                            Bientôt
                          </span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id} className={cn(item.indente && "ml-6 border-l pl-1.5", item.indente && cIndent)}>
                      <Link
                        href={href}
                        onClick={() => setMenuMobile(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                          cHauteur,
                          actif ? cLienActif : cLien,
                        )}
                      >
                        <Icone nom={item.icone} className="h-4.5 w-4.5 shrink-0" />
                        <span className="flex-1">{item.libelle}</span>
                        {actif && <span className={cn("h-1.5 w-1.5 rounded-full", cPastille)} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
    );
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        // minmax(0,1fr) : sans lui, la piste 1fr ne peut pas rétrécir sous la largeur
        // intrinsèque du header → ascenseur horizontal sur toute la page.
        sidebarOuvert && "lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]",
      )}
    >
      {/* Sidebar desktop (masquable) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-col overflow-y-auto bg-gradient-to-b from-forest-900 to-forest-950 print:!hidden",
          sidebarOuvert && "lg:flex",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-cream-50/10 px-5">
          <Logo tone="light" href="/app" size={36} />
          <button
            onClick={() => setSidebarOuvert(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cream-200/60 hover:bg-cream-50/5 hover:text-cream-50"
            aria-label="Masquer le menu"
            title="Masquer le menu"
          >
            <Icons.PanelLeftClose size={18} />
          </button>
        </div>
        {rendreNav("sombre")}
      </aside>

      {/* Menu complet du TÉLÉPHONE : feuille montante (le tiroir latéral, pensé pour la
          souris, balayait tout l'écran et laissait le pouce loin des entrées). */}
      <FeuilleBas ouvert={menuMobile && surTelephone} onFermer={() => setMenuMobile(false)} titre="Menu">
        <div id="tiroir-navigation">{rendreNav("clair")}</div>
      </FeuilleBas>

      {/* Colonne principale */}
      <div className="flex min-h-screen min-w-0 flex-col">
        {/* En-tête MOBILE (titre + retour) : n'existe que sous 1024 px. */}
        <EnteteMobile
          sections={sections}
          outils={outils}
          notificationsInitiales={notificationsInitiales}
          nonLuesInitiales={nonLuesInitiales}
          utilisateur={{ nomComplet: utilisateur.nomComplet, email: utilisateur.email }}
          termeCafop={termeCafop}
          termeApfc={termeApfc}
        />

        {/* Barre supérieure ORDINATEUR (inchangée ; masquée sous 1024 px) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-cream-200 bg-cream-50/85 px-4 backdrop-blur-md max-lg:hidden sm:px-6 print:hidden">
          {/* Afficher la barre latérale (desktop, quand elle est masquée) */}
          {!sidebarOuvert && (
            <button
              onClick={() => setSidebarOuvert(true)}
              className="hidden h-10 w-10 items-center justify-center rounded-full text-forest-800 hover:bg-forest-50 lg:inline-flex"
              aria-label="Afficher le menu"
              title="Afficher le menu"
            >
              <Icons.PanelLeftOpen size={20} />
            </button>
          )}

          <FilAriane termeCafop={termeCafop} termeApfc={termeApfc} />

          {!surTelephone && <BarreOutils sections={sections} outils={outils} />}

          <div className="flex shrink-0 items-center gap-3 pl-2">
            {/* Chip de rôle : uniquement sur très grands écrans — à 1536px (2xl) elle faisait déborder la barre */}
            <span
              className={cn(
                "hidden max-w-[12rem] truncate whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold min-[1860px]:inline-block",
                couleurGroupe[ROLES[utilisateur.roleActif].groupe],
              )}
            >
              {utilisateur.libelleRoleActif}
            </span>

            {!surTelephone && (
              <ClocheNotifications
                notificationsInitiales={notificationsInitiales}
                nonLuesInitiales={nonLuesInitiales}
              />
            )}

            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-cream-200 bg-white py-1 pl-1 pr-3 text-sm shadow-sm transition-colors hover:border-forest-300"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-gold-300">
                  {utilisateur.nomComplet.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[10rem] truncate font-medium text-forest-900 sm:inline">
                  {utilisateur.nomComplet}
                </span>
                <Icons.ChevronDown size={15} className="text-ink-700/50" />
              </button>

              <AnimatePresence>
                {userMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setUserMenu(false)}
                      aria-hidden
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft"
                    >
                      <div className="border-b border-cream-200 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-forest-900">
                          {utilisateur.nomComplet}
                        </p>
                        <p className="truncate text-xs text-ink-700/60">{utilisateur.email}</p>
                      </div>
                      <div className="p-1.5">
                        <Link
                          href="/app/mon-profil"
                          onClick={() => setUserMenu(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-forest-800 hover:bg-forest-50"
                        >
                          <Icons.UserCircle size={16} /> Mon profil
                        </Link>
                        <Link
                          href="/app/mon-identification"
                          onClick={() => setUserMenu(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-forest-800 hover:bg-forest-50"
                        >
                          <Icons.IdCard size={16} /> Mon identification
                        </Link>
                        <form action={seDeconnecter}>
                          <button
                            type="submit"
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            <Icons.LogOut size={16} /> Se déconnecter
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Connexion perdue : information la plus urgente, donc placée AVANT les autres bandeaux.
            Ne s'affiche que hors ligne ou s'il reste des saisies à envoyer. */}
        <BandeauHorsLigne />

        {/* Bandeau permanent : aperçu de rôle (lecture seule) OU assistance (écriture réelle).
            Branché sur `enApercu` — JAMAIS sur `apercuActif`, qui vaut false en assistance : le
            bandeau doit être le plus visible précisément quand on écrit pour autrui. */}
        {utilisateur.enApercu && (
          <div
            className={
              utilisateur.assistance
                ? "flex flex-col items-start gap-2 border-b border-red-400/60 bg-gradient-to-r from-red-100 to-red-50 px-4 py-2.5 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden"
                : "flex flex-col items-start gap-2 border-b border-gold-400/50 bg-gradient-to-r from-gold-100 to-gold-50 px-4 py-2.5 text-sm text-gold-900 sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden"
            }
          >
            {utilisateur.assistance ? (
              <p className="flex items-center gap-2">
                <Icons.ShieldAlert size={17} className="shrink-0 text-red-600" />
                <span>
                  <strong>Mode assistance</strong> — vous agissez et <strong>écrivez</strong> à la place de{" "}
                  <strong>{utilisateur.assistance.cibleNom}</strong> ({utilisateur.assistance.cibleEmail}).
                  Chaque action est enregistrée à votre nom.
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2">
                <Icons.Eye size={17} className="shrink-0 text-gold-600" />
                Vous visualisez l&apos;interface en tant que{" "}
                <strong>{utilisateur.libelleRoleActif}</strong> — lecture seule.
              </p>
            )}
            <form action={quitterApercu}>
              <button
                type="submit"
                className={
                  utilisateur.assistance
                    ? "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-red-700 px-3.5 text-xs font-semibold text-cream-50 transition-colors hover:bg-red-600"
                    : "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-forest-800 px-3.5 text-xs font-semibold text-cream-50 transition-colors hover:bg-forest-700"
                }
              >
                <Icons.LogOut size={13} />{" "}
                {utilisateur.assistance ? "Quitter l'assistance" : "Quitter l'aperçu"}
              </button>
            </form>
          </div>
        )}

        {/* Bandeau permanent de LECTURE SEULE (rôles ADC / DELC) */}
        {utilisateur.lectureSeule && !utilisateur.enApercu && (
          <div className="flex items-center gap-2 border-b border-gold-400/50 bg-gradient-to-r from-gold-100 to-gold-50 px-4 py-2.5 text-sm text-gold-900 sm:px-6 print:hidden">
            <Icons.Eye size={17} className="shrink-0 text-gold-600" />
            <p>
              Accès en <strong>lecture seule</strong> ({utilisateur.libelleRoleActif}) — vous pouvez consulter mais pas modifier.
            </p>
          </div>
        )}

        {/* Bandeau permanent de PÉRIODE D'ESSAI (compte à rebours + CTA abonnement) */}
        {!utilisateur.apercuActif && <BandeauEssai finLe={utilisateur.essaiFinLe} />}

        {/* Bandeau d'accès restreint (cahier §6.3) */}
        {utilisateur.accesRestreint && utilisateur.demandeEnAttente && (
          <div className="flex items-start gap-3 border-b border-gold-300/60 bg-gold-50 px-4 py-3 text-sm text-gold-900 sm:px-6 print:hidden">
            <Icons.Clock4 size={18} className="mt-0.5 shrink-0 text-gold-600" />
            <p>
              Votre demande de rôle{" "}
              <strong>{utilisateur.demandeEnAttente.libelleRoleDemande}</strong> est en cours de
              validation par un administrateur. En attendant, votre accès est limité à{" "}
              <strong>Mon Identification</strong> et <strong>Mon Profil</strong>.
            </p>
          </div>
        )}

        {/* Téléphone : suivi des navigations (zones grisées, absence de réseau, entrée de page). */}
        <SuiviNavigation actif={surTelephone} pathname={pathname} />
        <ChargementPage actif={surTelephone} />

        <main
          data-contenu-coquille
          className={cn(
            "flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:px-0 print:py-0",
            // Réserve la hauteur de la barre d'onglets — inutile quand elle n'est pas rendue.
            !utilisateur.accesRestreint && "reserve-barre-onglets",
          )}
        >
          {children}
        </main>

        {/* Barre d'onglets MOBILE : navigation principale sous 1024 px. Sans objet pour un
            compte en accès restreint, dont le menu se limite à deux pages. */}
        {!utilisateur.accesRestreint && (
          <BarreOnglets
            role={utilisateur.roleActif}
            sections={sections}
            segmentActif={segmentActif}
            menuOuvert={menuMobile}
            onPlus={() => setMenuMobile(true)}
            onFermerMenu={() => setMenuMobile(false)}
            termeCafop={termeCafop}
            termeApfc={termeApfc}
          />
        )}
      </div>
    </div>
  );
}
