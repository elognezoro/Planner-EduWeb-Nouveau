"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronDown, Eye, Languages, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionNav } from "@/lib/rbac";
import { changerAnnee, changerLangue, changerPays } from "@/app/app/barre-actions";
import { activerApercu, quitterApercu } from "@/app/app/systeme/apercu/actions";

export interface OutilsBarre {
  pays: { nom: string; drapeau: string | null }[];
  paysActuel: string;
  drapeauActuel: string | null;
  annees: { libelle: string; active: boolean }[];
  anneeActuelle: string;
  anneeEnCours: boolean;
  langue: string;
  /** Rôles consultables en aperçu (vide si l'utilisateur n'y a pas droit). */
  rolesApercu: { id: string; libelle: string }[];
  apercuActif: boolean;
  libelleRoleActif: string;
}

const LANGUES: { code: string; court: string; libelle: string }[] = [
  { code: "fr", court: "FR", libelle: "Français" },
  { code: "en", court: "EN", libelle: "English" },
];

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Menu déroulant générique de la barre (déclencheur pilule + panneau). */
function MenuBarre({
  declencheur,
  ouvert,
  onToggle,
  onClose,
  children,
  largeur = "w-56",
  className,
}: {
  declencheur: React.ReactNode;
  ouvert: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  largeur?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-10 items-center gap-2 rounded-full border border-cream-200 bg-white px-3 text-sm font-medium text-forest-900 shadow-sm transition-colors hover:border-forest-300"
      >
        {declencheur}
        <ChevronDown size={14} className="shrink-0 text-ink-700/50" />
      </button>
      <AnimatePresence>
        {ouvert && (
          <>
            <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute right-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft",
                largeur,
              )}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemMenu({
  actif,
  onClick,
  children,
}: {
  actif?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        actif ? "bg-forest-50 font-semibold text-forest-900" : "text-forest-800 hover:bg-cream-100",
      )}
    >
      {children}
    </button>
  );
}

export function BarreOutils({
  sections,
  outils,
}: {
  sections: SectionNav[];
  outils: OutilsBarre;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [menu, setMenu] = useState<null | "pays" | "annee" | "langue" | "apercu">(null);
  const [q, setQ] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const fermer = () => setMenu(null);
  const bascule = (m: NonNullable<typeof menu>) => setMenu((v) => (v === m ? null : m));

  // Recherche globale : pages de la navigation effective de l'utilisateur.
  const pages = useMemo(
    () =>
      sections.flatMap((s) =>
        s.items
          .filter((i) => i.statut !== "a_venir")
          .map((i) => ({
            libelle: i.libelle,
            section: s.libelle,
            href: i.segment ? `/app/${i.segment}` : "/app",
          })),
      ),
    [sections],
  );
  const resultats = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return pages.filter((p) => norm(`${p.libelle} ${p.section}`).includes(n)).slice(0, 8);
  }, [q, pages]);

  function ouvrir(href: string) {
    setQ("");
    setRechercheOuverte(false);
    router.push(href);
  }

  const action = (fn: (fd: FormData) => Promise<void>, cles: Record<string, string>) => {
    fermer();
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(cles)) fd.set(k, v);
      await fn(fd);
    });
  };

  const langueActuelle = LANGUES.find((l) => l.code === outils.langue) ?? LANGUES[0];

  return (
    <div className="flex flex-1 items-center justify-end gap-2">
      {/* Recherche globale */}
      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setRechercheOuverte(true);
          }}
          onFocus={() => setRechercheOuverte(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultats[0]) ouvrir(resultats[0].href);
            if (e.key === "Escape") setRechercheOuverte(false);
          }}
          placeholder="Rechercher..."
          className="h-10 w-full rounded-full border border-cream-200 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-ink-700/40 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
        <AnimatePresence>
          {rechercheOuverte && resultats.length > 0 && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setRechercheOuverte(false)} aria-hidden />
              <motion.ul
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft"
              >
                {resultats.map((r) => (
                  <li key={r.href}>
                    <button
                      type="button"
                      onClick={() => ouvrir(r.href)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-forest-800 hover:bg-cream-100"
                    >
                      <span className="font-medium">{r.libelle}</span>
                      <span className="text-[0.65rem] uppercase tracking-wide text-ink-700/45">{r.section}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Pays consulté */}
      <MenuBarre
        className="hidden xl:block"
        ouvert={menu === "pays"}
        onToggle={() => bascule("pays")}
        onClose={fermer}
        declencheur={
          <>
            {outils.drapeauActuel && (
              <Image src={outils.drapeauActuel} alt="" width={20} height={14} className="h-3.5 w-5 rounded-[3px] object-cover" unoptimized />
            )}
            <span className="max-w-[8rem] truncate">{outils.paysActuel}</span>
          </>
        }
      >
        {outils.pays.map((p) => (
          <ItemMenu key={p.nom} actif={p.nom === outils.paysActuel} onClick={() => action(changerPays, { pays: p.nom })}>
            {p.drapeau && (
              <Image src={p.drapeau} alt="" width={20} height={14} className="h-3.5 w-5 rounded-[3px] object-cover" unoptimized />
            )}
            {p.nom}
          </ItemMenu>
        ))}
      </MenuBarre>

      {/* Année scolaire */}
      <MenuBarre
        className="hidden xl:block"
        ouvert={menu === "annee"}
        onToggle={() => bascule("annee")}
        onClose={fermer}
        declencheur={
          <>
            <CalendarDays size={15} className="shrink-0 text-forest-700" />
            <span className="whitespace-nowrap">
              {outils.anneeActuelle.replace("-", " — ")}
              {outils.anneeEnCours && <span className="text-ink-700/55"> · en cours</span>}
            </span>
          </>
        }
      >
        {outils.annees.map((a) => (
          <ItemMenu key={a.libelle} actif={a.libelle === outils.anneeActuelle} onClick={() => action(changerAnnee, { annee: a.libelle })}>
            <CalendarDays size={14} className="shrink-0 text-forest-700" />
            {a.libelle.replace("-", " — ")}
            {a.active && <span className="ml-auto rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-800">en cours</span>}
          </ItemMenu>
        ))}
      </MenuBarre>

      {/* Langue */}
      <MenuBarre
        className="hidden lg:block"
        largeur="w-44"
        ouvert={menu === "langue"}
        onToggle={() => bascule("langue")}
        onClose={fermer}
        declencheur={
          <>
            <Languages size={15} className="shrink-0 text-forest-700" />
            <span className="whitespace-nowrap">
              <span className="text-[0.7rem] font-bold text-ink-700/55">{langueActuelle.court}</span> {langueActuelle.libelle}
            </span>
          </>
        }
      >
        {LANGUES.map((l) => (
          <ItemMenu key={l.code} actif={l.code === langueActuelle.code} onClick={() => action(changerLangue, { langue: l.code })}>
            <span className="w-6 text-[0.7rem] font-bold text-ink-700/55">{l.court}</span>
            {l.libelle}
          </ItemMenu>
        ))}
      </MenuBarre>

      {/* Aperçu de rôle */}
      {(outils.rolesApercu.length > 0 || outils.apercuActif) && (
        <MenuBarre
          className="hidden lg:block"
          largeur="w-64"
          ouvert={menu === "apercu"}
          onToggle={() => bascule("apercu")}
          onClose={fermer}
          declencheur={
            <>
              <Eye size={15} className={cn("shrink-0", outils.apercuActif ? "text-gold-600" : "text-forest-700")} />
              <span className="max-w-[9rem] truncate whitespace-nowrap">
                {outils.apercuActif ? outils.libelleRoleActif : "Aperçu de rôle"}
              </span>
            </>
          }
        >
          {outils.apercuActif && (
            <button
              type="button"
              onClick={() => {
                fermer();
                start(async () => {
                  await quitterApercu();
                });
              }}
              className="mb-1 flex w-full items-center gap-2.5 rounded-xl bg-gold-50 px-3 py-2 text-left text-sm font-semibold text-gold-800 hover:bg-gold-100"
            >
              <LogOut size={14} /> Quitter l&apos;aperçu
            </button>
          )}
          <p className="px-3 pb-1 pt-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/45">
            Visualiser l&apos;interface en tant que…
          </p>
          {outils.rolesApercu.map((r) => (
            <ItemMenu key={r.id} onClick={() => action(activerApercu, { role: r.id })}>
              <Eye size={14} className="shrink-0 text-ink-700/40" />
              {r.libelle}
            </ItemMenu>
          ))}
        </MenuBarre>
      )}
    </div>
  );
}
