"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search, UserPlus, UserMinus, Download, Printer, FileText, FileSpreadsheet,
  Loader2, GraduationCap, BookOpen, Check,
} from "lucide-react";
import { inscrireUtilisateurCours, desinscrireUtilisateurCours } from "./actions";
import { BoutonMessage } from "@/components/app/bouton-message";

const BASE = "/app/aide-formation";

type Cours = { id: string; titre: string; slug: string; estGuide: boolean; statut: string; nbInscrits: number };
type Inscrit = { inscriptionId: string; userId: string; nom: string; email: string; role: string; source: string; date: string; progression: number; statut: string };
type Candidat = { id: string; nom: string; email: string; role: string };

const SOURCES: Record<string, string> = { nominative: "Inscription nominative", auto: "Progression autonome", session: "Session de formation" };

function initiales(nom: string) {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase() ?? "").join("") || "?";
}

export function InscriptionsClient({ coursListe, actif, inscrits, candidats, q, tronque }: {
  coursListe: Cours[];
  actif: { id: string; titre: string; slug: string };
  inscrits: Inscrit[];
  candidats: Candidat[];
  q: string;
  tronque: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Sélection de cours pour l'export (le cours actif est coché par défaut).
  const [selection, setSelection] = useState<Set<string>>(() => new Set([actif.slug]));

  function changerCours(slug: string) {
    router.push(`${BASE}/inscriptions?cours=${encodeURIComponent(slug)}`);
  }

  function agir(fn: () => Promise<{ ok: boolean; message?: string }>, id: string) {
    setBusyId(id);
    setErreur(null);
    start(async () => {
      const r = await fn();
      setBusyId(null);
      if (!r.ok) setErreur(r.message ?? "Action impossible.");
      else router.refresh();
    });
  }

  const slugsSel = [...selection];
  const totalSel = coursListe.filter((c) => selection.has(c.slug)).reduce((s, c) => s + c.nbInscrits, 0);
  const urlCours = slugsSel.map(encodeURIComponent).join(",");

  function toggleSel(slug: string) {
    setSelection((prev) => { const n = new Set(prev); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  }

  return (
    <div className="space-y-6">
      {erreur && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{erreur}</div>}

      {/* Sélecteur de cours */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest-600">Cours sélectionné</label>
        <div className="relative">
          <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-500" />
          <select
            value={actif.slug}
            onChange={(e) => changerCours(e.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-cream-300 bg-white pl-9 pr-9 text-sm font-medium outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          >
            {coursListe.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.titre}{c.estGuide ? " (guide)" : ""}{c.statut !== "publie" ? " — brouillon" : ""} · {c.nbInscrits} inscrit{c.nbInscrits > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rechercher un utilisateur — recherche EN BASE (exhaustive, quel que soit le nombre de comptes) */}
      <form method="get" className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
        <input type="hidden" name="cours" value={actif.slug} />
        <label htmlFor="rech-user" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest-600">Rechercher un utilisateur</label>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/40" />
            <input id="rech-user" name="q" defaultValue={q} placeholder="Nom, e-mail…" className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
          </div>
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-5 text-sm font-semibold text-white hover:bg-forest-800"><Search className="h-4 w-4" /> Rechercher</button>
          {q && <a href={`${BASE}/inscriptions?cours=${encodeURIComponent(actif.slug)}`} className="inline-flex items-center rounded-xl border border-cream-300 px-4 text-sm font-semibold text-forest-800 hover:bg-cream-100">Effacer</a>}
        </div>
      </form>

      {/* Inscrire un utilisateur */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Inscrire un utilisateur{q ? <span className="ml-1 text-sm font-normal text-ink-700/50">— résultats pour «&nbsp;{q}&nbsp;»</span> : null}</h2>
        {candidats.length === 0 ? (
          <p className="text-sm text-ink-700/60">{q ? "Aucun utilisateur ne correspond à cette recherche." : "Tous les utilisateurs sont déjà inscrits à ce cours."}</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {candidats.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-50 text-xs font-bold text-forest-700">{initiales(c.nom)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-forest-900">{c.nom} <span className="ml-1 rounded-full bg-cream-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-700/70">{c.role}</span></p>
                  <p className="truncate text-xs text-ink-700/55">{c.email}</p>
                </div>
                <button
                  type="button"
                  disabled={pending && busyId === c.id}
                  onClick={() => agir(() => inscrireUtilisateurCours(actif.id, c.id), c.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
                >
                  {pending && busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Inscrire
                </button>
              </li>
            ))}
          </ul>
        )}
        {tronque && (
          <p className="mt-2 text-xs text-ink-700/45">Seuls les {candidats.length} premiers résultats sont affichés — précisez votre recherche (nom ou e-mail) pour retrouver un utilisateur précis.</p>
        )}
      </div>

      {/* Inscrits au cours */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Inscrits au cours <span className="text-ink-700/50">({inscrits.length})</span></h2>
        {inscrits.length === 0 ? (
          <p className="text-sm text-ink-700/60">Personne n&apos;est encore inscrit à ce cours.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-[0.7rem] uppercase tracking-wide text-ink-700/55">
                  <th className="py-2 pr-3 font-semibold">Nom</th>
                  <th className="py-2 pr-3 font-semibold">Rôle</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 pr-3 font-semibold">Inscrit le</th>
                  <th className="py-2 pr-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {inscrits.map((i) => (
                  <tr key={i.inscriptionId} className="border-b border-cream-100 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-forest-900">{i.nom}</span>
                      <span className="block text-xs text-ink-700/50">{i.email}</span>
                    </td>
                    <td className="py-2.5 pr-3"><span className="rounded-full bg-forest-50 px-2 py-0.5 text-xs font-medium text-forest-700">{i.role}</span></td>
                    <td className="py-2.5 pr-3 text-xs text-ink-700/70">{SOURCES[i.source] ?? i.source}</td>
                    <td className="py-2.5 pr-3 text-xs text-ink-700/70">{i.date}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <BoutonMessage destinataireId={i.userId} nom={i.nom} variante="icone" />
                        <button
                          type="button"
                          disabled={pending && busyId === i.userId}
                          onClick={() => agir(() => desinscrireUtilisateurCours(actif.id, i.userId), i.userId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          {pending && busyId === i.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />} Désinscrire
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Imprimer / télécharger la liste des inscrits */}
      <div id="telecharger" className="scroll-mt-20 rounded-2xl border border-forest-200 bg-forest-50/40 p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-600 text-white"><Download className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-forest-900">Imprimer / télécharger la liste des inscrits</h2>
            <p className="mt-0.5 text-sm text-ink-700/70">Sélectionnez un ou plusieurs cours, puis téléchargez la liste (CSV pour Excel, Word ou PDF) — ou imprimez-la. Le CSV inclut le rôle et la date d&apos;inscription. Chaque page porte un en-tête institutionnel et l&apos;effectif.</p>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {coursListe.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm hover:border-forest-300">
              <input type="checkbox" checked={selection.has(c.slug)} onChange={() => toggleSel(c.slug)} className="accent-forest-600" />
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-forest-500" />
              <span className="min-w-0 flex-1 truncate text-forest-900">{c.titre}</span>
              <span className="shrink-0 rounded-full bg-cream-100 px-2 py-0.5 text-xs font-semibold text-forest-700">{c.nbInscrits}</span>
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            aria-disabled={slugsSel.length === 0}
            href={slugsSel.length ? `${BASE}/inscriptions/telecharger?format=csv&cours=${urlCours}` : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100 ${slugsSel.length ? "" : "pointer-events-none opacity-50"}`}
          ><FileSpreadsheet className="h-4 w-4" /> CSV</a>
          <a
            aria-disabled={slugsSel.length === 0}
            href={slugsSel.length ? `${BASE}/inscriptions/telecharger?format=word&cours=${urlCours}` : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100 ${slugsSel.length ? "" : "pointer-events-none opacity-50"}`}
          ><FileText className="h-4 w-4" /> Word</a>
          <a
            aria-disabled={slugsSel.length === 0}
            href={slugsSel.length ? `${BASE}/inscriptions/imprimer?cours=${urlCours}` : undefined}
            target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100 ${slugsSel.length ? "" : "pointer-events-none opacity-50"}`}
          ><FileText className="h-4 w-4" /> PDF</a>
          <a
            aria-disabled={slugsSel.length === 0}
            href={slugsSel.length ? `${BASE}/inscriptions/imprimer?cours=${urlCours}&print=1` : undefined}
            target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 ${slugsSel.length ? "" : "pointer-events-none opacity-50"}`}
          ><Printer className="h-4 w-4" /> Imprimer</a>
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink-700/70"><Check className="h-4 w-4 text-forest-600" /> {totalSel} inscrit{totalSel > 1 ? "s" : ""} au total sur la sélection</span>
        </div>
      </div>
    </div>
  );
}
