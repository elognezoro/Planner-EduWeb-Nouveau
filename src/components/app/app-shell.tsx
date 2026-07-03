"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as Icons from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { ROLES, type RoleId, type SectionNav } from "@/lib/rbac";
import { seDeconnecter } from "@/app/app/actions";
import { quitterApercu } from "@/app/app/systeme/apercu/actions";
import { ClocheNotifications } from "@/components/app/notifications/cloche";
import { FilAriane } from "@/components/app/breadcrumb";
import { BarreOutils, type OutilsBarre } from "@/components/app/barre-outils";
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
  apercuActif: boolean;
}

const couleurGroupe: Record<string, string> = {
  pilotage: "bg-forest-100 text-forest-800",
  formation: "bg-gold-100 text-gold-800",
  etablissement: "bg-cream-200 text-forest-800",
  famille: "bg-cream-100 text-ink-700",
};

function Icone({ nom, className }: { nom: string; className?: string }) {
  const Composant = (Icons as unknown as Record<string, Icons.LucideIcon>)[nom] ?? Icons.Circle;
  return <Composant className={className} />;
}

function hrefDe(segment: string): string {
  return segment ? `/app/${segment}` : "/app";
}

/** Identifiant de la section contenant la route active (pour ouvrir l'accordéon par défaut). */
function sectionActive(sections: SectionNav[], pathname: string): string | null {
  for (const s of sections) {
    for (const i of s.items) {
      const actif = i.segment === "" ? pathname === "/app" : pathname === hrefDe(i.segment);
      if (actif) return s.id;
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
  notificationsInitiales,
  nonLuesInitiales,
  outils,
  children,
}: {
  utilisateur: UtilisateurShell;
  /** Navigation effective (matrice des droits dynamique), calculée côté serveur. */
  sections: SectionNav[];
  notificationsInitiales: NotificationItem[];
  nonLuesInitiales: number;
  /** Données de la barre d'outils (pays, année scolaire, langue, aperçu de rôle). */
  outils: OutilsBarre;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuMobile, setMenuMobile] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [sidebarOuvert, setSidebarOuvert] = useState(true);
  const sections = sectionsVisibles(utilisateur, sectionsEffectives);
  // `ouvertes` ne stocke que les choix EXPLICITES de l'utilisateur ; par défaut, seule
  // la section contenant la page active est ouverte (dérivé, sans effet de bord).
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>({});
  const idActif = sectionActive(sections, pathname);
  const estOuverte = (id: string) => ouvertes[id] ?? id === idActif;

  // Restaure l'état « masqué/affiché » de la barre latérale (persisté côté client).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation depuis localStorage
    if (localStorage.getItem("eduweb_sidebar") === "0") setSidebarOuvert(false);
  }, []);
  useEffect(() => {
    localStorage.setItem("eduweb_sidebar", sidebarOuvert ? "1" : "0");
  }, [sidebarOuvert]);

  function toggleSection(id: string) {
    setOuvertes((s) => ({ ...s, [id]: !(s[id] ?? id === idActif) }));
  }

  const navContenu = (
    <nav className="flex flex-col gap-1.5 px-3 py-4">
      {sections.map((section) => {
        const ouvert = estOuverte(section.id);
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cream-200/45 transition-colors hover:bg-cream-50/5 hover:text-cream-200/70"
              aria-expanded={ouvert}
            >
              <span>{section.libelle}</span>
              <Icons.ChevronDown
                size={14}
                className={cn("shrink-0 transition-transform", ouvert ? "" : "-rotate-90")}
              />
            </button>
            {ouvert && (
              <ul className="mt-0.5 space-y-0.5">
                {section.items.map((item) => {
                  const href = hrefDe(item.segment);
                  const actif = item.segment === "" ? pathname === "/app" : pathname === href;
                  if (item.statut === "a_venir") {
                    return (
                      <li key={item.id}>
                        <span className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm text-cream-200/35">
                          <Icone nom={item.icone} className="h-4.5 w-4.5 shrink-0" />
                          <span className="flex-1">{item.libelle}</span>
                          <span className="rounded-full bg-cream-50/5 px-1.5 py-0.5 text-[0.6rem] font-medium text-cream-200/40">
                            Bientôt
                          </span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id}>
                      <Link
                        href={href}
                        onClick={() => setMenuMobile(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                          actif
                            ? "bg-gold-500/15 text-gold-200"
                            : "text-cream-200/75 hover:bg-cream-50/5 hover:text-cream-50",
                        )}
                      >
                        <Icone nom={item.icone} className="h-4.5 w-4.5 shrink-0" />
                        <span className="flex-1">{item.libelle}</span>
                        {actif && <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />}
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

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        sidebarOuvert && "lg:grid lg:grid-cols-[17rem_1fr]",
      )}
    >
      {/* Sidebar desktop (masquable) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-col overflow-y-auto bg-gradient-to-b from-forest-900 to-forest-950",
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
        {navContenu}
      </aside>

      {/* Drawer mobile */}
      <AnimatePresence>
        {menuMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuMobile(false)}
              className="fixed inset-0 z-40 bg-forest-950/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-gradient-to-b from-forest-900 to-forest-950 lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-cream-50/10 px-5">
                <Logo tone="light" href="/app" size={34} />
                <button
                  onClick={() => setMenuMobile(false)}
                  className="text-cream-200/70 hover:text-cream-50"
                  aria-label="Fermer le menu"
                >
                  <Icons.X size={20} />
                </button>
              </div>
              {navContenu}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Colonne principale */}
      <div className="flex min-h-screen flex-col">
        {/* Barre supérieure */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cream-200 bg-cream-50/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMenuMobile(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-800 hover:bg-forest-50 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Icons.Menu size={20} />
          </button>
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

          <FilAriane />

          <BarreOutils sections={sections} outils={outils} />

          <div className="flex items-center gap-3 pl-2">
            <span
              className={cn(
                "hidden rounded-full px-3 py-1 text-xs font-semibold 2xl:inline-flex",
                couleurGroupe[ROLES[utilisateur.roleActif].groupe],
              )}
            >
              {utilisateur.libelleRoleActif}
            </span>

            <ClocheNotifications
              notificationsInitiales={notificationsInitiales}
              nonLuesInitiales={nonLuesInitiales}
            />

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

        {/* Bandeau permanent du mode Aperçu (cahier §4.5) */}
        {utilisateur.apercuActif && (
          <div className="flex flex-col items-start gap-2 border-b border-gold-400/50 bg-gradient-to-r from-gold-100 to-gold-50 px-4 py-2.5 text-sm text-gold-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-center gap-2">
              <Icons.Eye size={17} className="shrink-0 text-gold-600" />
              Vous visualisez l&apos;interface en tant que{" "}
              <strong>{utilisateur.libelleRoleActif}</strong> — lecture seule.
            </p>
            <form action={quitterApercu}>
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-forest-800 px-3.5 text-xs font-semibold text-cream-50 transition-colors hover:bg-forest-700"
              >
                <Icons.LogOut size={13} /> Quitter l&apos;aperçu
              </button>
            </form>
          </div>
        )}

        {/* Bandeau d'accès restreint (cahier §6.3) */}
        {utilisateur.accesRestreint && utilisateur.demandeEnAttente && (
          <div className="flex items-start gap-3 border-b border-gold-300/60 bg-gold-50 px-4 py-3 text-sm text-gold-900 sm:px-6">
            <Icons.Clock4 size={18} className="mt-0.5 shrink-0 text-gold-600" />
            <p>
              Votre demande de rôle{" "}
              <strong>{utilisateur.demandeEnAttente.libelleRoleDemande}</strong> est en cours de
              validation par un administrateur. En attendant, votre accès est limité à{" "}
              <strong>Mon Identification</strong> et <strong>Mon Profil</strong>.
            </p>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
