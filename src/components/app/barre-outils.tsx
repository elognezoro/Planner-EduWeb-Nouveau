"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronDown, Eye, Languages, LogOut, MoreHorizontal, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionNav } from "@/lib/rbac";
import { changerAnnee, changerLangue, changerPays } from "@/app/app/barre-actions";
import { activerApercu, quitterApercu } from "@/app/app/systeme/apercu/actions";

export interface OutilsBarre {
  pays: { nom: string; drapeau: string | null }[];
  paysActuel: string;
  /** Vrai si l'utilisateur peut CHANGER de pays (admin) ; sinon on affiche seulement son pays. */
  paysModifiable: boolean;
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
  const [menu, setMenu] = useState<null | "pays" | "annee" | "langue" | "apercu" | "plus">(null);
  const [q, setQ] = useState("");
  const [paysQ, setPaysQ] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  // Pays filtrés par la recherche rapide (liste de tous les pays de l'ONU côté admin).
  const paysFiltres = useMemo(() => {
    const n = norm(paysQ.trim());
    return n ? outils.pays.filter((p) => norm(p.nom).includes(n)) : outils.pays;
  }, [paysQ, outils.pays]);

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
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      {/* Recherche globale */}
      <div className="relative hidden min-w-24 max-w-xs flex-1 md:block">
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

      {/* Pays consulté — dropdown (admin : tous les pays de l'ONU) OU affichage seul (autres). */}
      {outils.paysModifiable ? (
        <MenuBarre
          className="hidden shrink-0 2xl:block"
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
          <div className="p-1.5">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                value={paysQ}
                onChange={(e) => setPaysQ(e.target.value)}
                placeholder="Rechercher un pays…"
                autoFocus
                className="h-9 w-full rounded-full border border-cream-200 bg-cream-50/60 pl-8 pr-3 text-sm outline-none placeholder:text-ink-700/40 focus:border-forest-400"
              />
            </div>
          </div>
          {paysFiltres.map((p) => (
            <ItemMenu key={p.nom} actif={p.nom === outils.paysActuel} onClick={() => action(changerPays, { pays: p.nom })}>
              {p.drapeau && (
                <Image src={p.drapeau} alt="" width={20} height={14} className="h-3.5 w-5 shrink-0 rounded-[3px] object-cover" unoptimized />
              )}
              <span className="truncate">{p.nom}</span>
            </ItemMenu>
          ))}
          {paysFiltres.length === 0 && <p className="px-3 py-2 text-sm text-ink-700/50">Aucun pays.</p>}
        </MenuBarre>
      ) : (
        <div className="hidden h-10 shrink-0 items-center gap-2 rounded-full border border-cream-200 bg-white px-3 text-sm font-medium text-forest-900 shadow-sm 2xl:flex">
          {outils.drapeauActuel && (
            <Image src={outils.drapeauActuel} alt="" width={20} height={14} className="h-3.5 w-5 rounded-[3px] object-cover" unoptimized />
          )}
          <span className="max-w-[8rem] truncate">{outils.paysActuel}</span>
        </div>
      )}

      {/* Année scolaire */}
      <MenuBarre
        className="hidden shrink-0 2xl:block"
        ouvert={menu === "annee"}
        onToggle={() => bascule("annee")}
        onClose={fermer}
        declencheur={
          <>
            <CalendarDays size={15} className="shrink-0 text-forest-700" />
            <span className="whitespace-nowrap">
              {outils.anneeActuelle.replace("-", " — ")}
              {/* Mention « en cours » réservée aux très grands écrans pour ne pas surcharger la barre */}
              {outils.anneeEnCours && <span className="hidden text-ink-700/55 min-[1860px]:inline"> · en cours</span>}
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
        className="hidden shrink-0 lg:block"
        largeur="w-44"
        ouvert={menu === "langue"}
        onToggle={() => bascule("langue")}
        onClose={fermer}
        declencheur={
          <>
            <Languages size={15} className="shrink-0 text-forest-700" />
            <span className="whitespace-nowrap">
              <span className="text-[0.7rem] font-bold text-ink-700/55">{langueActuelle.court}</span>
              {/* Nom complet de la langue réservé aux très grands écrans */}
              <span className="hidden min-[1860px]:inline"> {langueActuelle.libelle}</span>
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
          className="hidden shrink-0 lg:block"
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

      {/* Menu de repli « ⋯ » : regroupe les outils masqués aux largeurs intermédiaires
          (pays/année < 2xl ; langue/aperçu < lg ; recherche < md). */}
      <MenuBarre
        className="shrink-0 2xl:hidden"
        largeur="w-72"
        ouvert={menu === "plus"}
        onToggle={() => bascule("plus")}
        onClose={fermer}
        declencheur={<MoreHorizontal size={16} className="shrink-0 text-forest-700" />}
      >
        {/* Recherche (repli mobile) */}
        <div className="p-1.5 md:hidden">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resultats[0]) ouvrir(resultats[0].href);
              }}
              placeholder="Rechercher une page..."
              className="h-9 w-full rounded-full border border-cream-200 bg-cream-50/60 pl-8 pr-3 text-sm outline-none placeholder:text-ink-700/40 focus:border-forest-400"
            />
          </div>
          {resultats.map((r) => (
            <ItemMenu key={r.href} onClick={() => ouvrir(r.href)}>
              {r.libelle}
              <span className="ml-auto text-[0.6rem] uppercase tracking-wide text-ink-700/40">{r.section}</span>
            </ItemMenu>
          ))}
        </div>

        {/* Pays consulté */}
        <p className="px-3 pb-1 pt-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/45">Pays consulté</p>
        {outils.paysModifiable ? (
          <>
            <div className="px-1.5 pb-1">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
                <input
                  value={paysQ}
                  onChange={(e) => setPaysQ(e.target.value)}
                  placeholder="Rechercher un pays…"
                  className="h-9 w-full rounded-full border border-cream-200 bg-cream-50/60 pl-8 pr-3 text-sm outline-none placeholder:text-ink-700/40 focus:border-forest-400"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {paysFiltres.map((p) => (
                <ItemMenu key={p.nom} actif={p.nom === outils.paysActuel} onClick={() => action(changerPays, { pays: p.nom })}>
                  {p.drapeau && (
                    <Image src={p.drapeau} alt="" width={20} height={14} className="h-3.5 w-5 shrink-0 rounded-[3px] object-cover" unoptimized />
                  )}
                  <span className="truncate">{p.nom}</span>
                </ItemMenu>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-forest-900">
            {outils.drapeauActuel && (
              <Image src={outils.drapeauActuel} alt="" width={20} height={14} className="h-3.5 w-5 shrink-0 rounded-[3px] object-cover" unoptimized />
            )}
            <span className="truncate">{outils.paysActuel}</span>
          </div>
        )}

        {/* Année scolaire */}
        <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/45">Année scolaire</p>
        {outils.annees.map((a) => (
          <ItemMenu key={a.libelle} actif={a.libelle === outils.anneeActuelle} onClick={() => action(changerAnnee, { annee: a.libelle })}>
            <CalendarDays size={14} className="shrink-0 text-forest-700" />
            {a.libelle.replace("-", " — ")}
            {a.active && <span className="ml-auto rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-800">en cours</span>}
          </ItemMenu>
        ))}

        {/* Langue (repli < lg) */}
        <div className="lg:hidden">
          <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/45">Langue</p>
          {LANGUES.map((l) => (
            <ItemMenu key={l.code} actif={l.code === langueActuelle.code} onClick={() => action(changerLangue, { langue: l.code })}>
              <span className="w-6 shrink-0 text-[0.7rem] font-bold text-ink-700/55">{l.court}</span>
              {l.libelle}
            </ItemMenu>
          ))}
        </div>

        {/* Aperçu de rôle (repli < lg) */}
        {(outils.rolesApercu.length > 0 || outils.apercuActif) && (
          <div className="lg:hidden">
            <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/45">Aperçu de rôle</p>
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
            {outils.rolesApercu.map((r) => (
              <ItemMenu key={r.id} onClick={() => action(activerApercu, { role: r.id })}>
                <Eye size={14} className="shrink-0 text-ink-700/40" />
                {r.libelle}
              </ItemMenu>
            ))}
          </div>
        )}
      </MenuBarre>
    </div>
  );
}
