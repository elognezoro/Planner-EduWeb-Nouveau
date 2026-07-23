"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ListChecks,
  ThumbsUp,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "@/components/app/ui";
import { SelectRecherche } from "@/components/app/select-recherche";
import { FormAlert } from "@/components/ui/form";
import { validerRapportInspection } from "./actions";
import type { EtatForm } from "../visites/actions";

const initial: EtatForm = { ok: false };

/**
 * Id du formulaire du rapport — le bouton « Valider » de l'en-tête (rendu côté serveur dans
 * `page.tsx`) le soumet via son attribut `form` : le LITTÉRAL doit rester identique des deux
 * côtés (une constante exportée d'un module client n'est pas importable par la page serveur).
 */
const FORM_RAPPORT_ID = "form-rapport-inspection";

/** Les 4 sections ancrées du rapport (bandeau « Aller à » + navigateur flottant). */
const SECTIONS: { id: string; libelle: string }[] = [
  { id: "points-forts", libelle: "Points forts" },
  { id: "axes-amelioration", libelle: "Axes d'amélioration" },
  { id: "recommandations", libelle: "Recommandations" },
  { id: "score-global", libelle: "Score global" },
];

/** Défilement doux vers une section ancrée du rapport. */
function defilerVers(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── 1. Bandeau « ALLER À » : puces-ancres vers les 4 sections ──

export function BandeauAllerA() {
  return (
    <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-700/55">
        Aller à
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => defilerVers(s.id)}
            className="rounded-full border border-cream-300 bg-cream-50/60 px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:border-forest-300 hover:bg-forest-50"
          >
            {s.libelle}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── 2. Bandeau « FILTRES » : choix de la visite à rapporter (navigation ?visite=<id>) ──

export function BandeauFiltres({
  options,
  defaut,
}: {
  /** Visites du périmètre proposées au filtre : « Prénom NOM — Discipline · Établissement · date ». */
  options: { id: string; nom: string }[];
  /** Visite actuellement rapportée (pré-sélectionnée dans la liste). */
  defaut: { id: string; nom: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-700/55">
        Filtres
      </span>
      <SelectRecherche
        key={defaut?.id ?? "aucune"}
        name="visite"
        options={options}
        defaut={defaut}
        placeholder="Choisir la visite à rapporter…"
        effacable
        grand
        onSelect={(o) => {
          // SEULE une sélection effective navigue (le composant serveur relit ?visite=, fail-closed).
          // Effacer ou re-taper dans le champ (onSelect(null)) ne recharge pas la page : le rapport
          // affiché reste celui de la visite courante tant qu'une autre n'est pas choisie.
          if (o) router.push(`${pathname}?visite=${encodeURIComponent(o.id)}`);
        }}
        className="min-w-64 flex-1"
      />
    </Card>
  );
}

// ── 3. Formulaire du rapport : les 3 sections éditables reliées à la grille de supervision ──

/** Textes initiaux du rapport (rubriques de synthèse de la grille de supervision). */
export interface RapportInitial {
  pointsForts: string;
  pointsAmeliorer: string;
  propositions: string;
}

const textareaCls =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70";

export function RapportForm({
  visiteId,
  lectureSeule,
  initiale,
}: {
  visiteId: string;
  /** Vrai si l'utilisateur ne peut pas modifier la visite (DRENA, mode aperçu…) : tout est figé. */
  lectureSeule: boolean;
  initiale: RapportInitial;
}) {
  const [etat, action] = useActionState(validerRapportInspection.bind(null, visiteId), initial);

  return (
    <form id={FORM_RAPPORT_ID} action={action} className="space-y-6">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <Card id="points-forts" className="scroll-mt-24">
        <h2 className="font-display text-base font-bold text-forest-900">Points forts</h2>
        <p className="mt-0.5 mb-3 flex items-center gap-1.5 text-xs font-semibold text-forest-700">
          <ThumbsUp size={14} /> Atouts observés
        </p>
        <textarea
          name="pointsForts"
          rows={6}
          maxLength={4000}
          defaultValue={initiale.pointsForts}
          disabled={lectureSeule}
          placeholder="Constats positifs relevés au cours de la séance observée…"
          className={textareaCls}
        />
      </Card>

      <Card id="axes-amelioration" className="scroll-mt-24">
        <h2 className="font-display text-base font-bold text-forest-900">Axes d&apos;amélioration</h2>
        <p className="mt-0.5 mb-3 flex items-center gap-1.5 text-xs font-semibold text-gold-700">
          <AlertTriangle size={14} /> Points de vigilance
        </p>
        <textarea
          name="pointsAmeliorer"
          rows={6}
          maxLength={4000}
          defaultValue={initiale.pointsAmeliorer}
          disabled={lectureSeule}
          placeholder="Insuffisances et difficultés relevées au cours de la séance…"
          className={textareaCls}
        />
      </Card>

      <Card id="recommandations" className="scroll-mt-24">
        <h2 className="font-display text-base font-bold text-forest-900">Recommandations</h2>
        <p className="mt-0.5 mb-3 flex items-center gap-1.5 text-xs font-semibold text-forest-700">
          <ListChecks size={14} /> Actions à mettre en œuvre
        </p>
        <textarea
          name="propositions"
          rows={6}
          maxLength={4000}
          defaultValue={initiale.propositions}
          disabled={lectureSeule}
          placeholder="Conseils et pistes de remédiation formulés à l'issue de la supervision…"
          className={textareaCls}
        />
      </Card>
    </form>
  );
}

// ── Radar « Profil d'évaluation » : score /20 par DOMAINE de la grille (6 axes, maquette) ──

export function RadarProfil({
  donnees,
}: {
  donnees: { domaine: string; valeur: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={donnees} outerRadius="72%">
        <PolarGrid stroke="#e9dcbe" />
        <PolarAngleAxis dataKey="domaine" tick={{ fontSize: 11, fill: "#2b3a33" }} />
        <PolarRadiusAxis domain={[0, 20]} tickCount={5} tick={{ fontSize: 10, fill: "#8a917f" }} axisLine={false} />
        <Radar
          name="Score /20"
          dataKey="valeur"
          stroke="#246a48"
          fill="#57a47b"
          fillOpacity={0.35}
        />
        <Tooltip
          formatter={(v) => [`${v}/20`, "Score"]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e9dcbe",
            fontSize: 13,
            boxShadow: "0 8px 24px rgba(15,53,39,0.08)",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── 5. Navigateur flottant bas-droite : retour en haut + menu compact des sections ──

export function NavigateurFlottant() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 print:hidden">
      {ouvert && (
        <div className="w-52 overflow-hidden rounded-2xl border border-cream-200 bg-white py-1 shadow-lg">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                defilerVers(s.id);
                setOuvert(false);
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-ink-800 hover:bg-forest-50"
            >
              {s.libelle}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 rounded-full border border-cream-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
        <button
          type="button"
          aria-label="Retour en haut de page"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setOuvert(false);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-800 text-cream-50 transition-colors hover:bg-forest-700"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          aria-expanded={ouvert}
          onClick={() => setOuvert((o) => !o)}
          className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-forest-800 transition-colors hover:bg-forest-50"
        >
          Sections
          <ChevronDown size={15} className={`transition-transform ${ouvert ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>
  );
}
