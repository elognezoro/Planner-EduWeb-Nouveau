"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { FileText, Users, BookOpen, Award, GraduationCap, ChevronRight, Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { creerModuleCafop, basculerModuleCafop, supprimerModuleCafop } from "@/lib/formation/actions";
import { FormAlert } from "@/components/ui/form";
import { EnteteCafop, Modale } from "../entete-cafop";

export interface ModuleVue {
  id: string;
  nom: string;
  ordre: number;
  actif: boolean;
}
export interface CentreLite {
  id: string;
  nom: string;
  drena: string | null;
  pays: string;
}

const BASE = "/app/systeme/cafop";

export function EnseignementsCafop({
  modules,
  centres,
  regions,
  semestres,
}: {
  modules: ModuleVue[];
  centres: CentreLite[];
  regions: { id: string; nom: string }[];
  semestres: number;
}) {
  const [modulesOuvert, setModulesOuvert] = useState(false);
  const nbModulesActifs = modules.filter((m) => m.actif).length;

  const minis = [
    { valeur: centres.length, libelle: "CAFOP enregistrés", Icone: Users, ton: "bg-gold-100 text-gold-700" },
    { valeur: nbModulesActifs, libelle: "Modules actifs", Icone: BookOpen, ton: "bg-blue-100 text-blue-700" },
    { valeur: semestres, libelle: "Semestres", Icone: Award, ton: "bg-forest-100 text-forest-700" },
  ];

  return (
    <div className="space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={centres.length} regions={regions} />

      {/* ALLER À */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-sm">
        <span className="font-semibold text-ink-700/45">ALLER À</span>
        {[
          { libelle: "Présentation", href: "#presentation" },
          { libelle: "Sélection d'un CAFOP", href: "#selection" },
        ].map((a) => (
          <a key={a.href} href={a.href} className="rounded-full border border-cream-300 px-3 py-0.5 font-medium text-forest-800 hover:bg-forest-50">
            {a.libelle}
          </a>
        ))}
      </div>

      {/* Présentation + indicateurs */}
      <section id="presentation" className="space-y-4 rounded-2xl border border-gold-200 bg-gold-50/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-white">
              <FileText size={20} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-forest-900">Gestion des Notes &amp; Bulletins CAFOP</h2>
              <p className="mt-0.5 max-w-2xl text-sm text-ink-700/70">
                Sélectionnez un CAFOP pour gérer les notes des élèves-maîtres et générer les bulletins de notes
                semestriels personnalisés.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModulesOuvert(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gold-300 bg-white px-4 text-sm font-semibold text-gold-800 hover:bg-gold-50"
          >
            <SlidersHorizontal size={15} /> Gérer les modules
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1.5 text-xs font-bold text-white">
              {modules.length}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {minis.map((m) => (
            <div key={m.libelle} className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${m.ton}`}>
                <m.Icone size={18} />
              </span>
              <div>
                <p className="font-display text-2xl font-bold text-forest-900">{m.valeur.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-ink-700/60">{m.libelle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sélection d'un CAFOP */}
      <section id="selection" className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-forest-900">Sélectionner un CAFOP pour gérer les notes et bulletins</h2>
          <p className="text-sm text-ink-700/60">
            Chaque élève-maître d&apos;un CAFOP reçoit son propre bulletin individuel et nominatif, organisé par groupe-classe.
          </p>
        </div>
        <div className="divide-y divide-cream-100">
          {centres.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-700/55">Aucun CAFOP enregistré.</p>
          ) : (
            centres.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-cream-50/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
                    <GraduationCap size={17} />
                  </span>
                  <div>
                    <p className="font-semibold text-forest-900">{c.nom}</p>
                    <p className="text-xs text-ink-700/55">{c.drena ? `DRENA ${c.drena} — ${c.pays}` : c.pays}</p>
                  </div>
                </div>
                <Link
                  href={`${BASE}/${c.id}`}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-gold-300 bg-white px-4 text-sm font-semibold text-gold-800 hover:bg-gold-50"
                >
                  Configurer le CAFOP <ChevronRight size={15} />
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <AnimatePresence>{modulesOuvert && <ModulesModal modules={modules} onFerme={() => setModulesOuvert(false)} />}</AnimatePresence>
    </div>
  );
}

function ModulesModal({ modules, onFerme }: { modules: ModuleVue[]; onFerme: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nouveau, setNouveau] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const agir = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.message ?? "Erreur.");
      else router.refresh();
    });
  };

  return (
    <Modale titre="Modules de formation" onFerme={() => !pending && onFerme()} large>
      <div className="space-y-3">
        <p className="text-sm text-ink-700/70">
          Matières évaluées dans les bulletins des élèves-maîtres. Désactivez un module pour l&apos;exclure des bulletins
          sans le supprimer.
        </p>
        {msg && <FormAlert ton="erreur">{msg}</FormAlert>}

        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {modules.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-700/55">Aucun module. Ajoutez-en un ci-dessous.</p>
          ) : (
            modules.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3 py-2">
                <span className={`text-sm font-medium ${m.actif ? "text-forest-900" : "text-ink-700/40 line-through"}`}>{m.nom}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => agir(() => basculerModuleCafop(m.id, !m.actif))}
                    className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold disabled:opacity-50 ${
                      m.actif ? "bg-forest-100 text-forest-800 hover:bg-forest-200" : "bg-cream-200 text-ink-700/70 hover:bg-cream-300"
                    }`}
                  >
                    {m.actif ? "Actif" : "Inactif"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => agir(() => supprimerModuleCafop(m.id))}
                    title="Supprimer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-cream-100 pt-3">
          <input
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            placeholder="Nouveau module (ex. Psychopédagogie)"
            className="h-10 flex-1 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <button
            type="button"
            disabled={pending || !nouveau.trim()}
            onClick={() =>
              agir(async () => {
                const r = await creerModuleCafop(nouveau);
                if (r.ok) setNouveau("");
                return r;
              })
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-50"
          >
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>
    </Modale>
  );
}
