"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Building2,
  Layers3,
  Users,
  GraduationCap,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  X,
  FileSpreadsheet,
  Upload,
  BarChart3,
  FileText,
  BookOpen,
} from "lucide-react";
import { drapeauEmoji, trouverPays } from "@/lib/referentiels/pays";
import { creerStructure, supprimerStructure } from "@/lib/formation/actions";
import { FormAlert } from "@/components/ui/form";

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
}: {
  annee: string;
  kpi: KpiCafop;
  centres: CentreVue[];
  promotions: PromotionVue[];
  regions: { id: string; nom: string }[];
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [aSupprimer, setASupprimer] = useState<CentreVue | null>(null);
  const [msgSuppr, setMsgSuppr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const centresFiltres = useMemo(() => {
    const q = recherche.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (!q) return centres;
    return centres.filter((c) =>
      [c.nom, c.code, c.drena, c.localite, c.directeur]
        .filter(Boolean)
        .some((v) => v!.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q)),
    );
  }, [centres, recherche]);

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

  const kpis = [
    { libelle: "Centres", valeur: kpi.centres, Icone: Building2, ton: "bg-gold-100 text-gold-700" },
    { libelle: "Promotions", valeur: kpi.promotions, Icone: Layers3, ton: "bg-blue-100 text-blue-700" },
    { libelle: "Cohortes", valeur: kpi.cohortes, Icone: Layers3, ton: "bg-forest-100 text-forest-700" },
    { libelle: "Élèves-maîtres", valeur: kpi.elevesMaitres, Icone: Users, ton: "bg-purple-100 text-purple-700" },
  ];

  const onglets = [
    { libelle: "Gestion", href: BASE, actif: true, dispo: true },
    { libelle: "Enseignements & Évaluation", href: BASE, actif: false, dispo: false, Icone: BookOpen },
    { libelle: "Statistiques", href: "/app/systeme/statistiques-cafop", actif: false, dispo: true, Icone: BarChart3 },
    { libelle: "Rapports", href: "/app/systeme/rapports-cafop", actif: false, dispo: true, Icone: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête + onglets */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-white">
            <GraduationCap size={22} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900">Gestion des CAFOP</h1>
            <p className="mt-0.5 text-sm text-ink-700/70">
              {nombre(kpi.centres)} CAFOP enregistrés — Centres d&apos;Animation et de Formation Pédagogique
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {onglets.map((o) =>
            o.dispo ? (
              <Link
                key={o.libelle}
                href={o.href}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  o.actif
                    ? "bg-gold-100 text-gold-800"
                    : "border border-cream-300 text-ink-700/70 hover:bg-cream-100"
                }`}
              >
                {o.Icone && <o.Icone size={15} />} {o.libelle}
              </Link>
            ) : (
              <span
                key={o.libelle}
                title="Bientôt disponible"
                className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-cream-200 px-3.5 text-sm font-medium text-ink-700/35"
              >
                {o.Icone && <o.Icone size={15} />} {o.libelle}
              </span>
            ),
          )}
        </nav>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-ink-700/80 hover:bg-cream-100"
        >
          <RefreshCw size={15} /> Actualiser
        </button>
        <span
          title="Bientôt disponible"
          className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-cream-200 px-4 text-sm font-medium text-ink-700/35"
        >
          <FileSpreadsheet size={15} /> Modèle CSV
        </span>
        <span
          title="Bientôt disponible"
          className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-cream-200 px-4 text-sm font-medium text-ink-700/35"
        >
          <Upload size={15} /> Importer CSV
        </span>
        <button
          type="button"
          onClick={() => setFormOuvert(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600"
        >
          <Plus size={16} /> Nouveau CAFOP
        </button>
      </div>

      {/* ALLER À */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-sm">
        <span className="font-semibold text-ink-700/45">ALLER À</span>
        {[
          { libelle: "Indicateurs", href: "#indicateurs" },
          { libelle: "Centres CAFOP", href: "#centres" },
          { libelle: "Promotions", href: "#promotions" },
        ].map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="rounded-full border border-cream-300 px-3 py-0.5 font-medium text-forest-800 hover:bg-forest-50"
          >
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
            <h2 className="font-display text-lg font-bold text-forest-900">Centres CAFOP</h2>
            <p className="text-sm text-ink-700/60">Recherche, consultation et suppression des centres enregistrés.</p>
          </div>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un CAFOP…"
              className="h-9 w-64 max-w-full rounded-full border border-cream-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-5 py-2.5">CAFOP</th>
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
                    Aucun CAFOP {recherche ? "ne correspond à la recherche" : "enregistré"}.
                  </td>
                </tr>
              ) : (
                centresFiltres.map((c) => (
                  <tr key={c.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                    <td className="px-5 py-3">
                      <Link href={`${BASE}/${c.id}`} className="font-semibold text-forest-900 hover:text-gold-700">
                        {c.nom}
                      </Link>
                      <p className="text-xs text-ink-700/50">
                        {(c.code ?? "—") + " · " + annee}
                      </p>
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
                        title="Supprimer ce CAFOP"
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
        <div className="border-b border-cream-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-forest-900">Promotions</h2>
          <p className="text-sm text-ink-700/60">Avancement des promotions par centre.</p>
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
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-700/55">
                    Aucune promotion enregistrée.
                  </td>
                </tr>
              ) : (
                promotions.map((p) => (
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

      {/* Modale : Nouveau CAFOP */}
      <AnimatePresence>
        {formOuvert && (
          <NouveauCafopModal regions={regions} onFerme={() => setFormOuvert(false)} onCree={() => { setFormOuvert(false); router.refresh(); }} />
        )}
      </AnimatePresence>

      {/* Modale : confirmation de suppression */}
      <AnimatePresence>
        {aSupprimer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={fermerSuppression}
              className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
            >
              <div className="border-b border-cream-100 px-5 py-3.5">
                <h2 className="font-display text-base font-bold text-forest-900">Supprimer ce CAFOP ?</h2>
              </div>
              <div className="p-5">
                {msgSuppr && (
                  <div className="mb-3">
                    <FormAlert ton="erreur">{msgSuppr}</FormAlert>
                  </div>
                )}
                <p className="text-sm leading-relaxed text-ink-700/80">
                  Le centre <strong>{aSupprimer.nom}</strong> et <strong>toutes ses promotions</strong> seront
                  définitivement supprimés ; les comptes qui y sont rattachés seront détachés. Action irréversible.
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const champCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

function NouveauCafopModal({
  regions,
  onFerme,
  onCree,
}: {
  regions: { id: string; nom: string }[];
  onFerme: () => void;
  onCree: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ nom: "", drena: "", localite: "", directeur: "", directeurTel: "", effectif: "", regionId: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function creer() {
    if (!f.nom.trim()) {
      setMsg("Le nom du CAFOP est obligatoire.");
      return;
    }
    start(async () => {
      const r = await creerStructure("cafop", f.nom, {
        regionId: f.regionId || null,
        drena: f.drena,
        localite: f.localite,
        directeur: f.directeur,
        directeurTel: f.directeurTel,
        effectif: f.effectif ? Number(f.effectif) : 0,
      });
      if (r.ok) onCree();
      else setMsg(r.message ?? "Erreur.");
    });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !pending && onFerme()}
        className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
      >
        <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3.5">
          <h2 className="font-display text-base font-bold text-forest-900">Nouveau CAFOP</h2>
          <button onClick={onFerme} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          {msg && <FormAlert ton="erreur">{msg}</FormAlert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Nom du CAFOP *</span>
              <input value={f.nom} onChange={set("nom")} placeholder="Ex : CAFOP d'Abidjan" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">DRENA</span>
              <input value={f.drena} onChange={set("drena")} placeholder="Ex : Abidjan" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Localité</span>
              <input value={f.localite} onChange={set("localite")} placeholder="Ex : Abidjan" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Directeur</span>
              <input value={f.directeur} onChange={set("directeur")} placeholder="Ex : M. KOUASSI Jean" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Téléphone</span>
              <input value={f.directeurTel} onChange={set("directeurTel")} placeholder="+225 07 00 00 00 00" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Effectif (élèves-maîtres)</span>
              <input value={f.effectif} onChange={set("effectif")} type="number" min={0} placeholder="0" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Région (facultatif)</span>
              <select value={f.regionId} onChange={set("regionId")} className={champCls}>
                <option value="">—</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.nom}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-700/50">Le code du centre (ex. « CAF-ABJ-002 ») est généré automatiquement.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onFerme} disabled={pending} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 disabled:opacity-60">
              Annuler
            </button>
            <button type="button" onClick={creer} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-gold-500 px-6 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-70">
              <Plus size={16} /> Créer le CAFOP
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
