"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { Building2, Layers3, Users, Trash2, Search, Tag, Save } from "lucide-react";
import { drapeauEmoji, trouverPays } from "@/lib/referentiels/pays";
import { supprimerStructure, enregistrerTermeCafop } from "@/lib/formation/actions";
import { FormAlert } from "@/components/ui/form";
import { appliquerTerme } from "@/lib/cafop-terme";
import { EnteteCafop, Modale } from "./entete-cafop";

export interface CentreVue {
  id: string;
  nom: string;
  code: string | null;
  pays: string;
  drena: string | null;
  localite: string | null;
  directeur: string | null;
  directeurTel: string | null;
  effectif: number;
}
export interface PromotionVue {
  id: string;
  libelle: string;
  centre: string;
  nbCohortes: number;
  effectif: number;
  progression: number;
  statut: string;
}
export interface KpiCafop {
  centres: number;
  promotions: number;
  cohortes: number;
  elevesMaitres: number;
}

const BASE = "/app/systeme/cafop";
const nombre = (n: number) => n.toLocaleString("fr-FR");
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Drapeau({ pays }: { pays: string }) {
  const code = trouverPays(pays)?.code;
  return <span className="mr-1">{code ? drapeauEmoji(code) : "🏳️"}</span>;
}

export function GestionCafop({
  annee,
  kpi,
  centres,
  promotions,
  regions,
  terme,
  pays,
}: {
  annee: string;
  kpi: KpiCafop;
  centres: CentreVue[];
  promotions: PromotionVue[];
  regions: { id: string; nom: string }[];
  terme: string;
  pays: string;
}) {
  const router = useRouter();
  const T = (s: string) => appliquerTerme(s, terme);
  const [recherche, setRecherche] = useState("");
  const [aSupprimer, setASupprimer] = useState<CentreVue | null>(null);
  const [msgSuppr, setMsgSuppr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Édition du terme local (menu, titres, boutons…).
  const [termeSaisi, setTermeSaisi] = useState(terme);
  const [msgTerme, setMsgTerme] = useState<string | null>(null);

  const centresFiltres = useMemo(() => {
    const q = sansAccent(recherche).trim();
    if (!q) return centres;
    return centres.filter((c) =>
      [c.nom, c.code, c.drena, c.localite, c.directeur].filter(Boolean).some((v) => sansAccent(v!).includes(q)),
    );
  }, [centres, recherche]);

  // Filtres du tableau des promotions : par CAFOP (centre) et par promotion (libellé).
  const [filtreCentre, setFiltreCentre] = useState("");
  const [filtrePromotion, setFiltrePromotion] = useState("");
  const centresPromo = useMemo(() => [...new Set(promotions.map((p) => p.centre))].sort((a, b) => a.localeCompare(b)), [promotions]);
  const libellesPromo = useMemo(() => [...new Set(promotions.map((p) => p.libelle))].sort((a, b) => b.localeCompare(a)), [promotions]);
  const promotionsFiltrees = useMemo(
    () => promotions.filter((p) => (!filtreCentre || p.centre === filtreCentre) && (!filtrePromotion || p.libelle === filtrePromotion)),
    [promotions, filtreCentre, filtrePromotion],
  );

  function fermerSuppression() {
    if (pending) return;
    setASupprimer(null);
    setMsgSuppr(null);
  }

  function supprimer() {
    if (!aSupprimer) return;
    setMsgSuppr(null);
    start(async () => {
      const r = await supprimerStructure("cafop", aSupprimer.id);
      if (r.ok) {
        setASupprimer(null);
        router.refresh();
      } else {
        setMsgSuppr(r.message ?? "Suppression impossible.");
      }
    });
  }

  function enregistrerTerme() {
    setMsgTerme(null);
    start(async () => {
      const r = await enregistrerTermeCafop(pays, termeSaisi);
      setMsgTerme(r.message ?? null);
      if (r.ok) router.refresh();
    });
  }

  const kpis = [
    { libelle: "Centres", valeur: kpi.centres, Icone: Building2, ton: "bg-gold-100 text-gold-700" },
    { libelle: "Promotions", valeur: kpi.promotions, Icone: Layers3, ton: "bg-blue-100 text-blue-700" },
    { libelle: "Cohortes", valeur: kpi.cohortes, Icone: Layers3, ton: "bg-forest-100 text-forest-700" },
    { libelle: T("Élèves-maîtres"), valeur: kpi.elevesMaitres, Icone: Users, ton: "bg-purple-100 text-purple-700" },
  ];

  return (
    <div className="space-y-6">
      <EnteteCafop ongletActif="gestion" nbCentres={kpi.centres} regions={regions} terme={terme} />

      {/* Nom local des centres (par pays) — appliqué au menu, aux titres et aux boutons. */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-soft">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700"><Tag size={17} /></span>
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-700/50">Nom local des centres — {pays}</span>
          <input value={termeSaisi} onChange={(e) => setTermeSaisi(e.target.value)} placeholder="CAFOP" className="h-9 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
        </label>
        <button type="button" disabled={pending || !termeSaisi.trim()} onClick={enregistrerTerme} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-4 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50">
          <Save size={15} /> Enregistrer
        </button>
        {msgTerme && <span className="text-xs text-ink-700/60">{msgTerme}</span>}
      </div>

      {/* ALLER À */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-sm">
        <span className="font-semibold text-ink-700/45">ALLER À</span>
        {[
          { libelle: "Indicateurs", href: "#indicateurs" },
          { libelle: T("Centres CAFOP"), href: "#centres" },
          { libelle: "Promotions", href: "#promotions" },
        ].map((a) => (
          <a key={a.href} href={a.href} className="rounded-full border border-cream-300 px-3 py-0.5 font-medium text-forest-800 hover:bg-forest-50">
            {a.libelle}
          </a>
        ))}
      </div>

      {/* KPI */}
      <div id="indicateurs" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.libelle} className="flex items-center justify-between rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
            <div>
              <p className="text-sm font-medium text-ink-700/60">{k.libelle}</p>
              <p className="mt-1 font-display text-3xl font-bold text-forest-900">{nombre(k.valeur)}</p>
            </div>
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${k.ton}`}>
              <k.Icone size={20} />
            </span>
          </div>
        ))}
      </div>

      {/* Centres CAFOP */}
      <section id="centres" className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-forest-900">{T("Centres CAFOP")}</h2>
            <p className="text-sm text-ink-700/60">Recherche, consultation et suppression des centres enregistrés.</p>
          </div>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={T("Rechercher un CAFOP…")}
              className="h-9 w-64 max-w-full rounded-full border border-cream-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-5 py-2.5">{T("CAFOP")}</th>
                <th className="px-3 py-2.5">Pays</th>
                <th className="px-3 py-2.5">Région / DRENA</th>
                <th className="px-3 py-2.5">Localité</th>
                <th className="px-3 py-2.5">Directeur</th>
                <th className="px-3 py-2.5 text-right">Élèves</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {centresFiltres.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-700/55">
                    {T("Aucun CAFOP")} {recherche ? "ne correspond à la recherche" : "enregistré"}.
                  </td>
                </tr>
              ) : (
                centresFiltres.map((c) => (
                  <tr key={c.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                    <td className="px-5 py-3">
                      <Link href={`${BASE}/${c.id}`} className="font-semibold text-forest-900 hover:text-gold-700">
                        {c.nom}
                      </Link>
                      <p className="text-xs text-ink-700/50">{(c.code ?? "—") + " · " + annee}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-700/80">
                      <Drapeau pays={c.pays} /> {c.pays}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-700/80">{c.drena ? `DRENA ${c.drena}` : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-700/80">{c.localite ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="text-ink-700/90">{c.directeur ?? "—"}</span>
                      {c.directeurTel && <p className="text-xs text-ink-700/50">{c.directeurTel}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-forest-900">{nombre(c.effectif)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setASupprimer(c)}
                        title={T("Supprimer ce CAFOP")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Promotions */}
      <section id="promotions" className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-cream-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-forest-900">Promotions</h2>
            <p className="text-sm text-ink-700/60">Avancement des promotions par centre.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtreCentre}
              onChange={(e) => setFiltreCentre(e.target.value)}
              className="h-9 max-w-[14rem] rounded-full border border-cream-300 bg-white px-3 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            >
              <option value="">{T("Tous les CAFOP")}</option>
              {centresPromo.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filtrePromotion}
              onChange={(e) => setFiltrePromotion(e.target.value)}
              className="h-9 max-w-[14rem] rounded-full border border-cream-300 bg-white px-3 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            >
              <option value="">Toutes les promotions</option>
              {libellesPromo.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {(filtreCentre || filtrePromotion) && (
              <button
                type="button"
                onClick={() => { setFiltreCentre(""); setFiltrePromotion(""); }}
                className="inline-flex h-9 items-center rounded-full border border-cream-300 px-3 text-sm font-medium text-ink-700/70 hover:bg-cream-100"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-5 py-2.5">Promotion</th>
                <th className="px-3 py-2.5">Centre</th>
                <th className="px-3 py-2.5 text-right">Cohortes</th>
                <th className="px-3 py-2.5 text-right">Effectif</th>
                <th className="px-3 py-2.5">Progression</th>
              </tr>
            </thead>
            <tbody>
              {promotionsFiltrees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-700/55">
                    {promotions.length === 0 ? "Aucune promotion enregistrée." : "Aucune promotion ne correspond aux filtres."}
                  </td>
                </tr>
              ) : (
                promotionsFiltrees.map((p) => (
                  <tr key={p.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-forest-900">{p.libelle}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-700/80">{p.centre}</td>
                    <td className="px-3 py-3 text-right text-ink-700/80">{p.nbCohortes}</td>
                    <td className="px-3 py-3 text-right text-ink-700/80">{nombre(p.effectif)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-cream-200">
                          <div className="h-full rounded-full bg-forest-500" style={{ width: `${Math.min(100, Math.max(0, p.progression))}%` }} />
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs font-semibold text-ink-700/70">{p.progression}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Confirmation de suppression */}
      <AnimatePresence>
        {aSupprimer && (
          <Modale titre={T("Supprimer ce CAFOP ?")} onFerme={fermerSuppression}>
            {msgSuppr && (
              <div className="mb-3">
                <FormAlert ton="erreur">{msgSuppr}</FormAlert>
              </div>
            )}
            <p className="text-sm leading-relaxed text-ink-700/80">
              Le centre <strong>{aSupprimer.nom}</strong> et <strong>toutes ses promotions</strong> seront définitivement
              supprimés ; les comptes qui y sont rattachés seront détachés. Action irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={fermerSuppression}
                disabled={pending}
                className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={supprimer}
                disabled={pending}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
              >
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          </Modale>
        )}
      </AnimatePresence>
    </div>
  );
}
