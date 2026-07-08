"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence } from "motion/react";
import { CalendarRange, GraduationCap, Pencil, Plus, BookOpenCheck, Layers, ChevronDown } from "lucide-react";
import { FormAlert } from "@/components/ui/form";
import { appliquerTerme } from "@/lib/cafop-terme";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import { creerPlanFormation } from "@/lib/formation/plan-formation-actions";
import { EditeurPlanFormation } from "./editeur-plan-formation";

export interface LigneVue {
  id: string;
  type: string; // donnee | banniere | total
  cellules: string[];
  texte: string | null;
  ton: string | null; // conges | jalon | note | total | null
}
export interface SectionVue {
  id: string;
  niveau: number | null;
  titre: string;
  intro: string | null;
  note: string | null;
  colonnes: string[];
  lignes: LigneVue[];
}
export interface PlanVue {
  id: string;
  pays: string;
  anneeScolaire: string;
  titre: string;
  intro: string | null;
  signataire: string | null;
  signataireFonction: string | null;
  publie: boolean;
  sections: SectionVue[];
}

const NIVEAUX = [1, 2, 3] as const;
export const libelleNiveau = (n: number) => (n === 1 ? "1re Année" : `${n}e Année`);

const tonBanniere: Record<string, string> = {
  conges: "bg-gold-50 text-gold-800 border-gold-200",
  jalon: "bg-forest-50 text-forest-800 border-forest-200",
  note: "bg-cream-100 text-ink-700/75 border-cream-300",
};

export function VuePlanFormation({
  plan,
  pays,
  terme,
  estAdmin,
  anneeDefaut,
}: {
  plan: PlanVue | null;
  pays: string;
  terme: string;
  estAdmin: boolean;
  anneeDefaut: string;
}) {
  const router = useRouter();
  const [editeur, setEditeur] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const T = (s: string) => appliquerTerme(s, terme);

  const codePays = trouverPays(pays)?.code;
  const communes = useMemo(() => (plan ? plan.sections.filter((s) => s.niveau == null) : []), [plan]);
  const niveauxPresents = useMemo(
    () => (plan ? NIVEAUX.filter((n) => plan.sections.some((s) => s.niveau === n)) : []),
    [plan],
  );
  const [onglet, setOnglet] = useState<string>("gen");

  function creer() {
    setMsg(null);
    start(async () => {
      const r = await creerPlanFormation(pays, anneeDefaut);
      if (r.ok) {
        router.refresh();
        setEditeur(true);
      } else setMsg(r.message ?? "Erreur.");
    });
  }

  // ── Aucun plan ──
  if (!plan) {
    return (
      <div className="space-y-6">
        <Entete pays={pays} codePays={codePays} titre={T("Plan de formation — Formation Initiale des Maîtres")} annee={anneeDefaut} />
        <div className="rounded-2xl border border-dashed border-cream-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
            <CalendarRange size={26} />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-forest-900">Aucun plan de formation pour {pays}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-700/65">
            {estAdmin
              ? "Créez le plan de formation initiale des maîtres, puis renseignez les volumes horaires et les plans de chaque niveau."
              : "Le plan de formation n'a pas encore été publié pour votre pays."}
          </p>
          {msg && <div className="mx-auto mt-4 max-w-md"><FormAlert ton="erreur">{msg}</FormAlert></div>}
          {estAdmin && (
            <button
              type="button"
              onClick={creer}
              disabled={pending}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-gold-500 px-6 text-sm font-bold text-white shadow-soft hover:bg-gold-600 disabled:opacity-60"
            >
              <Plus size={16} /> Créer le plan {anneeDefaut}
            </button>
          )}
        </div>
      </div>
    );
  }

  const ongletsDispo = [
    ...(communes.length || plan.intro ? [{ cle: "gen", libelle: "Généralités", Icone: Layers }] : []),
    ...niveauxPresents.map((n) => ({ cle: String(n), libelle: libelleNiveau(n), Icone: GraduationCap })),
  ];
  const ongletActif = ongletsDispo.some((o) => o.cle === onglet) ? onglet : ongletsDispo[0]?.cle ?? "gen";

  const sectionsAffichees =
    ongletActif === "gen" ? communes : plan.sections.filter((s) => s.niveau === Number(ongletActif));

  return (
    <div className="space-y-6">
      <Entete
        pays={pays}
        codePays={codePays}
        titre={T(plan.titre)}
        annee={plan.anneeScolaire}
        action={
          estAdmin ? (
            <button
              type="button"
              onClick={() => setEditeur(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Pencil size={15} /> Modifier le plan
            </button>
          ) : null
        }
      />

      {/* Onglets Généralités / niveaux */}
      <div className="flex flex-wrap gap-1.5">
        {ongletsDispo.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setOnglet(o.cle)}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
              o.cle === ongletActif ? "bg-gold-500 text-white shadow-soft" : "border border-cream-300 bg-white text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <o.Icone size={15} /> {o.libelle}
          </button>
        ))}
      </div>

      {/* Présentation (onglet Généralités) */}
      {ongletActif === "gen" && plan.intro && (
        <section className="rounded-2xl border border-gold-200 bg-gold-50/50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-white">
              <BookOpenCheck size={18} />
            </span>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700/80">{plan.intro}</p>
          </div>
        </section>
      )}

      {sectionsAffichees.length === 0 ? (
        <p className="rounded-2xl border border-cream-200 bg-white px-5 py-10 text-center text-sm text-ink-700/55">
          Aucune donnée pour cette rubrique.
        </p>
      ) : (
        sectionsAffichees.map((s) => <TableauSection key={s.id} section={s} />)
      )}

      {/* Signature */}
      {(plan.signataire || plan.signataireFonction) && (
        <div className="flex justify-end">
          <div className="rounded-2xl border border-cream-200 bg-white px-6 py-4 text-center text-sm">
            {plan.signataireFonction && <p className="text-ink-700/70">{plan.signataireFonction}</p>}
            {plan.signataire && <p className="mt-1 font-display font-bold text-forest-900">{plan.signataire}</p>}
          </div>
        </div>
      )}

      <AnimatePresence>
        {editeur && estAdmin && <EditeurPlanFormation plan={plan} onFerme={() => setEditeur(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Entete({
  pays,
  codePays,
  titre,
  annee,
  action,
}: {
  pays: string;
  codePays?: string;
  titre: string;
  annee: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-4">
        {codePays ? (
          <Image src={armoiriesUrl(codePays)} alt={`Armoiries ${pays}`} width={52} height={52} unoptimized className="h-13 w-13 object-contain" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-100 text-forest-700">
            <CalendarRange size={24} />
          </span>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">{pays}</p>
          <h1 className="font-display text-xl font-bold text-forest-900">{titre}</h1>
          <p className="mt-0.5 text-sm text-ink-700/60">Année scolaire {annee}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** Rend une cellule : contenu multi-ligne (les retours à la ligne et puces « - » sont préservés). */
function Cellule({ valeur, className = "" }: { valeur: string; className?: string }) {
  return <div className={`whitespace-pre-line ${className}`}>{valeur}</div>;
}

/** Une section « groupée » : ses lignes de données sont regroupées sous une 1re colonne
 * qui « fusionne » (les lignes de continuation ont une 1re cellule vide) → rendu en accordéon. */
function estSectionGroupee(section: SectionVue): boolean {
  return (
    section.niveau == null &&
    section.colonnes.length >= 2 &&
    section.lignes.some((l) => l.type === "donnee" && (l.cellules[0] ?? "").trim() === "")
  );
}

interface Groupe {
  entete: string; // 1re cellule de la 1re ligne du groupe (nom + total éventuel)
  lignes: LigneVue[];
}
function grouperLignes(lignes: LigneVue[]): Groupe[] {
  const groupes: Groupe[] = [];
  for (const l of lignes) {
    if (l.type === "banniere") continue; // ignorées dans une section groupée
    const c0 = (l.cellules[0] ?? "").trim();
    if (c0 !== "" || groupes.length === 0) groupes.push({ entete: l.cellules[0] ?? "", lignes: [l] });
    else groupes[groupes.length - 1].lignes.push(l);
  }
  return groupes;
}

export function TableauSection({ section }: { section: SectionVue }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
      <div className="border-b border-cream-100 bg-cream-50/40 px-5 py-3.5">
        <h2 className="font-display text-base font-bold text-forest-900">{section.titre}</h2>
        {section.intro && <p className="mt-1 whitespace-pre-line text-sm text-ink-700/70">{section.intro}</p>}
      </div>
      {section.note && (
        <p className="border-b border-cream-100 bg-blue-50/50 px-5 py-2.5 text-sm italic text-ink-700/75">{section.note}</p>
      )}
      {estSectionGroupee(section) ? <CorpsAccordeon section={section} /> : <CorpsTable section={section} />}
    </section>
  );
}

function CorpsTable({ section }: { section: SectionVue }) {
  const nbCol = section.colonnes.length || 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-forest-200 bg-forest-50/60 text-left text-xs font-bold uppercase tracking-wide text-forest-800">
            {section.colonnes.map((c, i) => (
              <th key={i} className="px-3 py-2.5">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.lignes.length === 0 ? (
            <tr>
              <td colSpan={nbCol} className="px-3 py-6 text-center text-sm text-ink-700/50">
                Section vide.
              </td>
            </tr>
          ) : (
            section.lignes.map((l) => {
              if (l.type === "banniere") {
                const cls = tonBanniere[l.ton ?? "note"] ?? tonBanniere.note;
                return (
                  <tr key={l.id}>
                    <td colSpan={nbCol} className={`border-y px-4 py-2.5 text-center text-sm font-semibold ${cls}`}>
                      <Cellule valeur={l.texte ?? ""} className="italic" />
                    </td>
                  </tr>
                );
              }
              const emphase = l.type === "total";
              // Seule une colonne « N° » (plans chronologiques) est centrée ; les intitulés
              // (Modules, Disciplines, Activités…) restent alignés à gauche.
              const colNumero = (section.colonnes[0] ?? "").trim() === "N°";
              return (
                <tr
                  key={l.id}
                  className={`border-b border-cream-100 align-top last:border-0 ${emphase ? "bg-forest-50/40 font-bold text-forest-900" : "hover:bg-cream-50/40"}`}
                >
                  {section.colonnes.map((_, i) => {
                    const val = l.cellules[i] ?? "";
                    const premiere = i === 0;
                    const derniere = i === nbCol - 1;
                    const cls = premiere && colNumero
                      ? "text-center font-semibold text-forest-800"
                      : emphase
                        ? ""
                        : premiere || derniere
                          ? "font-semibold text-forest-900"
                          : "text-ink-700/85";
                    return (
                      <td key={i} className={`px-3 py-2.5 ${cls}`}>
                        <Cellule valeur={val} />
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Rendu en accordéon (un seul module ouvert à la fois). */
function CorpsAccordeon({ section }: { section: SectionVue }) {
  const groupes = useMemo(() => grouperLignes(section.lignes), [section.lignes]);
  const [ouvert, setOuvert] = useState(0); // premier module ouvert par défaut
  const colonnesDetail = section.colonnes.slice(1);

  return (
    <div className="divide-y divide-cream-100">
      {groupes.map((g, i) => {
        const lignesEntete = g.entete.split("\n");
        const nom = lignesEntete[0];
        const badge = lignesEntete.slice(1).join(" ").replace(/[()]/g, "").trim();
        const actif = ouvert === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOuvert(actif ? -1 : i)}
              aria-expanded={actif}
              className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors ${actif ? "bg-gold-50/70" : "hover:bg-cream-50/50"}`}
            >
              <span className="flex items-center gap-3">
                <ChevronDown size={17} className={`shrink-0 text-gold-700 transition-transform ${actif ? "" : "-rotate-90"}`} />
                <span className="font-display text-sm font-bold text-forest-900">{nom}</span>
              </span>
              {badge && (
                <span className="shrink-0 rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-gold-800">{badge}</span>
              )}
            </button>
            {actif && (
              <div className="overflow-x-auto border-t border-cream-100 bg-cream-50/20 px-2 pb-3 pt-1">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-forest-700/70">
                      {colonnesDetail.map((c, j) => (
                        <th key={j} className={`px-3 py-2 ${j === colonnesDetail.length - 1 ? "text-right" : ""}`}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.lignes.map((l) => (
                      <tr key={l.id} className="border-t border-cream-100/70">
                        {colonnesDetail.map((_, j) => {
                          const val = l.cellules[j + 1] ?? "";
                          const derniere = j === colonnesDetail.length - 1;
                          return (
                            <td key={j} className={`px-3 py-2 ${derniere ? "text-right font-semibold text-forest-900" : "text-ink-700/85"}`}>
                              <Cellule valeur={val} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
