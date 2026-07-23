"use client";

import { useActionState, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookmarkPlus, Eye, Plus, Save, Undo2, Wand2, X } from "lucide-react";
import { SelectRecherche } from "@/components/app/select-recherche";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import {
  BoutonRetrait2Clics,
  BoutonTexte2Clics,
  ChartPrevuRealise,
  NoteDiagramme,
  SectionAccordeon,
  SectionLibreCard,
  TableauEditable,
  ZonesSupplementairesBloc,
  inputCls,
  textareaCls,
} from "@/lib/inspection/composants-rapport";
import {
  MAX_CELLULE_RAPPORT,
  MAX_LIGNES_TABLEAU,
  MAX_SECTIONS_LIBRES,
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  MAX_TITRE_ZONE,
  MAX_ZONES_PAR_SECTION,
  completerEntete,
  ligneVide,
  nombreDeCellule,
  nouvelId,
  type EnteteRapport,
  type SectionLibre,
  type ZoneSupplementaire,
} from "@/lib/inspection/rapport-commun";
import {
  ACTIVITES_ANTENNE_DEFAUT,
  CLES_TABLEAUX_ANTENNE,
  COLONNES_ACTIVITES_ANTENNE,
  COLONNES_AUTRES_ACTIVITES_ANTENNE,
  COLONNES_PROGRAMMES_CYCLE,
  MAX_DISCIPLINES_MATRICE,
  SOUS_COLONNES_CAFOP,
  SOUS_COLONNES_SECONDAIRE,
  TABLEAUX_ACTIVITES_ANTENNE,
  TABLEAUX_RAPPORT_ANTENNE,
  TRIMESTRES,
  anneesScolairesProposees,
  indicesTableauActivites,
  periodeDepuis,
  titreSectionAntenne,
  trimestreCourant,
  type CleActivitesAntenne,
  type CleTableauAntenne,
  type CodeTrimestre,
  type ContenuRapportAntenne,
  type IdSectionAntenne,
  type MatriceProgrammes,
  type PeriodeAntenne,
  type StructureModeleAntenne,
  type TypeRapportAntenne,
} from "@/lib/inspection/rapport-antenne";
import { enregistrerModeleRapportAntenne, enregistrerRapportAntenne } from "./actions";
import type { EtatForm } from "../visites/actions";

const initial: EtatForm = { ok: false };

// ── Bandeau de sélection : onglets Trimestriel/Annuel + antenne + période (?type=&apfc=&periode=) ──

export function FiltresRapportsAntenne({
  type,
  periode,
  montrerApfc,
  apfcOptions,
  apfcDefaut,
  termeAntenne,
}: {
  type: TypeRapportAntenne;
  periode: PeriodeAntenne;
  /** Faux pour les rôles d'antenne (leur APFC est sélectionnée automatiquement). */
  montrerApfc: boolean;
  apfcOptions: { id: string; nom: string }[];
  apfcDefaut: { id: string; nom: string } | null;
  /** Libellé local des antennes (ex. « APFC », « ADEN »). */
  termeAntenne: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const annees = useMemo(() => anneesScolairesProposees().map((a) => ({ id: a, nom: a })), []);

  /** Navigation par searchParams — le composant serveur REVALIDE tout (fail-closed). */
  function naviguer(cible: TypeRapportAntenne, apfcId: string | null, annee: string, trimestre: CodeTrimestre) {
    const params = new URLSearchParams();
    params.set("type", cible);
    if (apfcId) params.set("apfc", apfcId);
    params.set("periode", periodeDepuis(cible, annee, trimestre));
    router.push(`${pathname}?${params.toString()}#rapports-antenne`);
  }
  const trimestre = periode.trimestre ?? trimestreCourant();

  return (
    <div className="space-y-4">
      {/* Onglets des deux rapports officiels. */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "trimestriel", libelle: "Rapport trimestriel" },
            { v: "annuel", libelle: "Rapport annuel" },
          ] as const
        ).map((onglet) => (
          <button
            key={onglet.v}
            type="button"
            onClick={() => naviguer(onglet.v, apfcDefaut?.id ?? null, periode.annee, trimestre)}
            aria-pressed={type === onglet.v}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              type === onglet.v
                ? "bg-forest-700 text-white"
                : "border border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
            }`}
          >
            {onglet.libelle}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {montrerApfc && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Antenne ({termeAntenne})</label>
            <SelectRecherche
              key={apfcDefaut?.id ?? "aucune"}
              name="filtre-apfc-antenne"
              options={apfcOptions}
              defaut={apfcDefaut}
              placeholder="Choisir l'antenne…"
              effacable
              grand
              onSelect={(o) => {
                if (o) naviguer(type, o.id, periode.annee, trimestre);
              }}
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Année scolaire</label>
          <SelectRecherche
            key={`annee-${periode.annee}`}
            name="filtre-annee"
            options={annees}
            defaut={{ id: periode.annee, nom: periode.annee }}
            placeholder="Ex. 2025-2026"
            grand
            onSelect={(o) => {
              if (o) naviguer(type, apfcDefaut?.id ?? null, o.id, trimestre);
            }}
          />
        </div>
        {type === "trimestriel" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Trimestre</label>
            <SelectRecherche
              key={`trimestre-${trimestre}`}
              name="filtre-trimestre"
              options={TRIMESTRES.map((t) => ({ id: t.code, nom: t.libelle }))}
              defaut={{ id: trimestre, nom: TRIMESTRES.find((t) => t.code === trimestre)?.libelle ?? trimestre }}
              placeholder="Choisir le trimestre…"
              grand
              onSelect={(o) => {
                if (o && (o.id === "T1" || o.id === "T2" || o.id === "T3")) {
                  naviguer(type, apfcDefaut?.id ?? null, periode.annee, o.id);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Matrice éditable (disciplines en COLONNES ajoutables/supprimables × niveaux en lignes) ──

function MatriceEditable({
  titre,
  sousColonnes,
  matrice,
  lectureSeule,
  onChange,
}: {
  titre: string;
  sousColonnes: readonly string[];
  matrice: MatriceProgrammes;
  lectureSeule: boolean;
  onChange: (maj: (m: MatriceProgrammes) => MatriceProgrammes) => void;
}) {
  const nbSous = sousColonnes.length;
  const cellVide = () => Array.from({ length: nbSous }, () => "");

  return (
    <div>
      <p className="mb-2 text-sm font-bold text-forest-900">{titre}</p>
      <div className="overflow-x-auto rounded-xl border border-cream-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/70 text-[11px] text-ink-700/70">
              <th rowSpan={2} className="min-w-28 px-2 py-2 text-left align-bottom font-semibold">
                Niveaux
              </th>
              {matrice.disciplines.map((d, di) => (
                <th key={di} colSpan={nbSous} className="border-l border-cream-200 px-2 py-1.5 text-center">
                  <span className="flex items-center justify-center gap-1">
                    <input
                      type="text"
                      value={d}
                      maxLength={MAX_CELLULE_RAPPORT}
                      disabled={lectureSeule}
                      aria-label={`Discipline — colonne ${di + 1}`}
                      placeholder="Discipline"
                      onChange={(e) =>
                        onChange((m) => ({
                          ...m,
                          disciplines: m.disciplines.map((x, i) => (i === di ? e.target.value : x)),
                        }))
                      }
                      className="w-24 rounded-md border border-cream-200 bg-white px-1.5 py-1 text-center text-[11px] font-bold uppercase outline-none focus:border-forest-400 disabled:border-transparent disabled:bg-transparent"
                    />
                    {!lectureSeule && (
                      <BoutonRetrait2Clics
                        libelle={`Supprimer la colonne ${d || di + 1}`}
                        confirmation="Supprimer la colonne ?"
                        onConfirmer={() =>
                          onChange((m) => ({
                            disciplines: m.disciplines.filter((_, i) => i !== di),
                            lignes: m.lignes.map((l) => ({ ...l, valeurs: l.valeurs.filter((_, i) => i !== di) })),
                          }))
                        }
                      />
                    )}
                  </span>
                </th>
              ))}
              {!lectureSeule && (
                <th rowSpan={2} className="w-8 px-1 py-2">
                  <span className="sr-only">Retirer la ligne</span>
                </th>
              )}
            </tr>
            <tr className="border-b border-cream-200 bg-cream-50/70 text-left text-[10px] text-ink-700/60">
              {matrice.disciplines.map((_, di) =>
                sousColonnes.map((sc, si) => (
                  <th key={`${di}-${si}`} className={`px-2 py-1.5 font-semibold ${si === 0 ? "border-l border-cream-200" : ""}`}>
                    {sc}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {matrice.lignes.map((ligne, li) => (
              <tr key={li} className="border-b border-cream-100 align-top last:border-0">
                <td className="p-1">
                  <input
                    type="text"
                    value={ligne.niveau}
                    maxLength={MAX_CELLULE_RAPPORT}
                    disabled={lectureSeule}
                    aria-label={`Niveau — ligne ${li + 1}`}
                    placeholder="Niveau"
                    onChange={(e) =>
                      onChange((m) => ({
                        ...m,
                        lignes: m.lignes.map((l, i) => (i === li ? { ...l, niveau: e.target.value } : l)),
                      }))
                    }
                    className="min-w-24 w-full rounded-md border border-cream-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-forest-400 disabled:border-transparent disabled:bg-transparent"
                  />
                </td>
                {ligne.valeurs.map((sous, di) =>
                  sous.map((cellule, si) => (
                    <td key={`${di}-${si}`} className={`p-1 ${si === 0 ? "border-l border-cream-100" : ""}`}>
                      <input
                        type="text"
                        value={cellule}
                        maxLength={MAX_CELLULE_RAPPORT}
                        disabled={lectureSeule}
                        aria-label={`${matrice.disciplines[di] || `Discipline ${di + 1}`} — ${sousColonnes[si]} — ligne ${li + 1}`}
                        onChange={(e) =>
                          onChange((m) => ({
                            ...m,
                            lignes: m.lignes.map((l, i) =>
                              i === li
                                ? {
                                    ...l,
                                    valeurs: l.valeurs.map((v, d) =>
                                      d === di ? v.map((c, s) => (s === si ? e.target.value : c)) : v,
                                    ),
                                  }
                                : l,
                            ),
                          }))
                        }
                        className="min-w-16 w-full rounded-md border border-cream-200 bg-white px-1.5 py-1.5 text-xs outline-none focus:border-forest-400 disabled:border-transparent disabled:bg-transparent"
                      />
                    </td>
                  )),
                )}
                {!lectureSeule && (
                  <td className="p-1 pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => onChange((m) => ({ ...m, lignes: m.lignes.filter((_, i) => i !== li) }))}
                      aria-label={`Retirer la ligne ${li + 1}`}
                      className="rounded-full p-1 text-ink-700/40 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!lectureSeule && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onChange((m) =>
                m.lignes.length >= MAX_LIGNES_TABLEAU
                  ? m
                  : { ...m, lignes: [...m.lignes, { niveau: "", valeurs: m.disciplines.map(() => cellVide()) }] },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
          >
            <Plus size={13} /> Ajouter une ligne
          </button>
          <button
            type="button"
            onClick={() =>
              onChange((m) =>
                m.disciplines.length >= MAX_DISCIPLINES_MATRICE
                  ? m
                  : {
                      disciplines: [...m.disciplines, ""],
                      lignes: m.lignes.map((l) => ({ ...l, valeurs: [...l.valeurs, cellVide()] })),
                    },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
          >
            <Plus size={13} /> Ajouter une discipline (colonne)
          </button>
        </div>
      )}
    </div>
  );
}

// ── Formulaire complet d'un rapport d'antenne (trimestriel / annuel) ──

/** Valeurs initiales (rapport enregistré, sinon contenu pré-rempli + agrégé côté serveur). */
export interface RapportAntenneInitial {
  titre: string;
  contenu: ContenuRapportAntenne;
}

/** Libellés du panneau « En-tête du document » (la coordination n'apparaît pas ici). */
const CHAMPS_ENTETE: { cle: keyof EnteteRapport; libelle: string }[] = [
  { cle: "ministere", libelle: "Ministère" },
  { cle: "republique", libelle: "État (forme officielle)" },
  { cle: "directionRegionale", libelle: "Direction régionale" },
  { cle: "devise", libelle: "Devise nationale" },
  { cle: "antenne", libelle: "Antenne" },
];

export function RapportAntenneForm({
  apfcId,
  type,
  periode,
  initiale,
  enteteInitiale,
  enteteDefaut,
  modele,
  lectureSeule,
  faitA,
  dateDuJour,
}: {
  apfcId: string;
  type: TypeRapportAntenne;
  /** Période persistée (« 2025-2026-T1 » / « 2025-2026 »), déjà revalidée côté serveur. */
  periode: string;
  initiale: RapportAntenneInitial;
  enteteInitiale: EnteteRapport;
  enteteDefaut: EnteteRapport;
  modele: StructureModeleAntenne | null;
  lectureSeule: boolean;
  faitA: string;
  dateDuJour: string;
}) {
  const [etat, action] = useActionState(enregistrerRapportAntenne, initial);
  const [etatModele, actionModele] = useActionState(enregistrerModeleRapportAntenne, initial);
  // Accordéons EXCLUSIFS ; contenus repliés/retirés MONTÉS (masqués CSS) → tout est soumis.
  const [ouverte, setOuverte] = useState<string | null>("introduction");
  const basculer = (id: string) => setOuverte((o) => (o === id ? null : id));

  const [tables, setTables] = useState<Record<CleTableauAntenne, string[][]>>(() => ({
    actReunions: initiale.contenu.actReunions,
    actSuivi: initiale.contenu.actSuivi,
    actFormation: initiale.contenu.actFormation,
    actDocumentation: initiale.contenu.actDocumentation,
    actEvaluation: initiale.contenu.actEvaluation,
    actAutres: initiale.contenu.actAutres,
    programmesPrescolaire: initiale.contenu.programmesPrescolaire,
    programmesPrimaire: initiale.contenu.programmesPrimaire,
  }));
  const [matriceCafop, setMatriceCafop] = useState<MatriceProgrammes>(initiale.contenu.programmesCafop);
  const [matriceSecondaire, setMatriceSecondaire] = useState<MatriceProgrammes>(initiale.contenu.programmesSecondaire);

  const [titre, setTitre] = useState(initiale.titre);
  const [entete, setEntete] = useState<EnteteRapport>(enteteInitiale);
  const [masquees, setMasquees] = useState<IdSectionAntenne[]>(initiale.contenu.sectionsMasquees);
  const [zonesSupp, setZonesSupp] = useState<Partial<Record<IdSectionAntenne, ZoneSupplementaire[]>>>(
    initiale.contenu.zonesSupplementaires,
  );
  const [sectionsLibres, setSectionsLibres] = useState<SectionLibre[]>(initiale.contenu.sectionsLibres);

  function modifierCellule(cle: CleTableauAntenne, ligne: number, colonne: number, valeur: string) {
    setTables((prev) => ({
      ...prev,
      [cle]: prev[cle].map((l, li) => (li === ligne ? l.map((c, ci) => (ci === colonne ? valeur : c)) : l)),
    }));
  }
  const propsTableau = (cle: CleTableauAntenne, colonnes: readonly string[]) => ({
    colonnes,
    lignes: tables[cle],
    lectureSeule,
    onCellule: (l: number, c: number, v: string) => modifierCellule(cle, l, c, v),
    onAjouter: () =>
      setTables((prev) =>
        prev[cle].length >= MAX_LIGNES_TABLEAU ? prev : { ...prev, [cle]: [...prev[cle], ligneVide(colonnes.length)] },
      ),
    onRetirer: (l: number) => setTables((prev) => ({ ...prev, [cle]: prev[cle].filter((_, li) => li !== l) })),
  });

  // ── Configuration libre (zones / retrait / sections libres) — mêmes mécaniques que le CRD ──
  function ajouterZone(section: IdSectionAntenne) {
    setZonesSupp((prev) => {
      const zones = prev[section] ?? [];
      if (zones.length >= MAX_ZONES_PAR_SECTION) return prev;
      return { ...prev, [section]: [...zones, { id: nouvelId(), titre: "", texte: "" }] };
    });
  }
  function modifierZone(section: IdSectionAntenne, id: string, champ: "titre" | "texte", valeur: string) {
    setZonesSupp((prev) => ({
      ...prev,
      [section]: (prev[section] ?? []).map((z) => (z.id === id ? { ...z, [champ]: valeur } : z)),
    }));
  }
  function retirerZone(section: IdSectionAntenne, id: string) {
    setZonesSupp((prev) => ({ ...prev, [section]: (prev[section] ?? []).filter((z) => z.id !== id) }));
  }
  function retirerSection(section: IdSectionAntenne) {
    setMasquees((prev) => (prev.includes(section) ? prev : [...prev, section]));
    setOuverte((o) => (o === section ? null : o));
  }
  function retablirSection(section: IdSectionAntenne) {
    setMasquees((prev) => prev.filter((s) => s !== section));
  }
  function ajouterSectionLibre() {
    if (sectionsLibres.length >= MAX_SECTIONS_LIBRES) return;
    const id = nouvelId();
    setSectionsLibres((prev) => [...prev, { id, titre: "", zones: [{ id: nouvelId(), titre: "", texte: "" }] }]);
    setOuverte(`libre-${id}`);
  }
  function modifierSectionLibre(id: string, maj: (s: SectionLibre) => SectionLibre) {
    setSectionsLibres((prev) => prev.map((s) => (s.id === id ? maj(s) : s)));
  }
  function supprimerSectionLibre(id: string) {
    setSectionsLibres((prev) => prev.filter((s) => s.id !== id));
    setOuverte((o) => (o === `libre-${id}` ? null : o));
  }

  /** Application CLIENT du modèle personnel (rien en base sans Enregistrer). */
  function appliquerModele() {
    if (!modele) return;
    setMasquees(modele.sectionsMasquees);
    setZonesSupp(modele.zonesSupplementaires);
    setSectionsLibres(modele.sectionsLibres);
    setEntete((prev) => completerEntete(modele.entete, prev));
    if (modele.titre.trim()) setTitre(modele.titre);
  }

  const actionsSection = (id: IdSectionAntenne) =>
    lectureSeule ? undefined : (
      <BoutonRetrait2Clics
        libelle="Retirer la section"
        confirmation="Retirer la section ?"
        onConfirmer={() => retirerSection(id)}
      />
    );
  const zonesSection = (id: IdSectionAntenne) => (
    <ZonesSupplementairesBloc
      zones={zonesSupp[id] ?? []}
      lectureSeule={lectureSeule}
      onAjouter={() => ajouterZone(id)}
      onModifier={(zoneId, champ, valeur) => modifierZone(id, zoneId, champ, valeur)}
      onRetirer={(zoneId) => retirerZone(id, zoneId)}
    />
  );

  // Diagramme : « Prévue vs Réalisée » par nature d'activité (les 6 sous-tableaux du point I).
  const dataPrevuRealise = useMemo(
    () =>
      (Object.keys(ACTIVITES_ANTENNE_DEFAUT[type]) as CleActivitesAntenne[]).flatMap((cle) => {
        const idx = indicesTableauActivites(cle);
        return tables[cle].flatMap((l) => {
          const nom = (l[0] ?? "").trim();
          const prevues = idx.prevue == null ? null : nombreDeCellule(l[idx.prevue] ?? "");
          const realisees = nombreDeCellule(l[idx.realisee] ?? "");
          if (!nom || (prevues == null && realisees == null)) return [];
          return [{ nom, prevues: prevues ?? 0, realisees: realisees ?? 0 }];
        });
      }),
    [tables, type],
  );

  const estMasquee = (id: IdSectionAntenne) => masquees.includes(id);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="apfcId" value={apfcId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="periode" value={periode} />
      {/* Tableaux et matrices soumis en JSON (validés STRICTEMENT côté serveur). */}
      {CLES_TABLEAUX_ANTENNE.map((cle) => (
        <input key={cle} type="hidden" name={cle} value={JSON.stringify(tables[cle])} />
      ))}
      <input type="hidden" name="programmesCafop" value={JSON.stringify(matriceCafop)} />
      <input type="hidden" name="programmesSecondaire" value={JSON.stringify(matriceSecondaire)} />
      <input type="hidden" name="sectionsMasquees" value={JSON.stringify(masquees)} />
      <input type="hidden" name="zonesSupplementaires" value={JSON.stringify(zonesSupp)} />
      <input type="hidden" name="sectionsLibres" value={JSON.stringify(sectionsLibres)} />

      {lectureSeule && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          <Eye size={17} className="mt-0.5 shrink-0" />
          <span>
            Lecture seule — vous consultez ce rapport sans pouvoir le modifier (seuls
            l&apos;administrateur, le superviseur international, l&apos;Admin APFC ou le Chef
            d&apos;antenne de cette antenne peuvent l&apos;enregistrer).
          </span>
        </div>
      )}

      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      {etatModele.message && <FormAlert ton={etatModele.ok ? "succes" : "erreur"}>{etatModele.message}</FormAlert>}

      {/* Barre du MODÈLE personnel (un modèle par type de rapport). */}
      {!lectureSeule && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5">
          <p className="text-xs text-ink-700/60">Votre modèle s&apos;applique automatiquement aux nouveaux rapports.</p>
          <div className="flex flex-wrap items-center gap-2">
            {modele && (
              <BoutonTexte2Clics
                libelle="Appliquer mon modèle"
                confirmation="Appliquer le modèle ?"
                onConfirmer={appliquerModele}
                icone={<Wand2 size={13} />}
              />
            )}
            <button
              type="submit"
              formAction={actionModele}
              className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
            >
              <BookmarkPlus size={13} /> Enregistrer comme mon modèle
            </button>
          </div>
        </div>
      )}

      {/* Bloc TITRE violet (titre type pré-rempli selon le type et la période). */}
      <div className="rounded-lg border-[3px] border-[#3f3358] bg-[#7c6a9c] px-4 py-4">
        <label htmlFor={`titre-rapport-antenne-${type}`} className="sr-only">
          Titre du rapport
        </label>
        <input
          id={`titre-rapport-antenne-${type}`}
          type="text"
          name="titre"
          maxLength={MAX_TITRE_RAPPORT}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          disabled={lectureSeule}
          placeholder={
            type === "annuel" ? "RAPPORT D'ACTIVITES ANNUEL ANTENNE 2025-2026" : "RAPPORT DES ACTIVITES DU PREMIER TRIMESTRE 2025 - 2026"
          }
          className="w-full bg-transparent text-center font-display text-lg font-bold uppercase tracking-wide text-black outline-none placeholder:normal-case placeholder:text-black/45"
        />
      </div>

      {/* Bandeau des sections officielles retirées (données conservées) + Rétablir. */}
      {masquees.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5 text-xs text-ink-700/70">
          <span className="font-semibold text-forest-900">Sections retirées :</span>
          {masquees.map((id) => (
            <span key={id} className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-white px-2.5 py-1">
              <span className="max-w-56 truncate">{titreSectionAntenne(id, type)}</span>
              {!lectureSeule && (
                <button
                  type="button"
                  onClick={() => retablirSection(id)}
                  className="inline-flex items-center gap-1 font-semibold text-forest-700 hover:underline"
                >
                  <Undo2 size={12} /> Rétablir
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* 0. En-tête du document (5 mentions — pas de ligne de coordination disciplinaire ici). */}
      <SectionAccordeon titre="En-tête du document" ouverte={ouverte === "entete"} onToggle={() => basculer("entete")}>
        <p className="text-xs text-ink-700/60">
          Mentions officielles de l&apos;en-tête (reproduites en ligne et dans le Word). Une mention
          vidée retombe sur la valeur par défaut du pays et de l&apos;antenne — les armoiries restent
          celles du pays.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS_ENTETE.map((champ) => (
            <div key={champ.cle}>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">{champ.libelle}</label>
              <input
                type="text"
                name={`entete-${champ.cle}`}
                value={entete[champ.cle]}
                maxLength={MAX_TITRE_ZONE}
                disabled={lectureSeule}
                placeholder={enteteDefaut[champ.cle] || "—"}
                onChange={(e) => setEntete((prev) => ({ ...prev, [champ.cle]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>
        {!lectureSeule && (
          <BoutonTexte2Clics
            libelle="Réinitialiser l'en-tête"
            confirmation="Confirmer la réinitialisation"
            onConfirmer={() => setEntete(enteteDefaut)}
          />
        )}
      </SectionAccordeon>

      {/* 1. Introduction */}
      <div className={estMasquee("introduction") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionAntenne("introduction", type)}
          ouverte={ouverte === "introduction"}
          onToggle={() => basculer("introduction")}
          actions={actionsSection("introduction")}
        >
          <textarea
            name="introduction"
            rows={6}
            maxLength={MAX_TEXTE_RAPPORT}
            defaultValue={initiale.contenu.introduction}
            disabled={lectureSeule}
            placeholder="Présentation de l'antenne, de ses encadreurs, de ses CRD et du plan du rapport…"
            className={textareaCls}
          />
          {zonesSection("introduction")}
        </SectionAccordeon>
      </div>

      {/* 2. I – Activités (6 sous-tableaux officiels + diagramme) */}
      <div className={estMasquee("activites") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionAntenne("activites", type)}
          ouverte={ouverte === "activites"}
          onToggle={() => basculer("activites")}
          actions={actionsSection("activites")}
        >
          {TABLEAUX_ACTIVITES_ANTENNE.map((t) => (
            <TableauEditable
              key={t.cle}
              titre={t.titre}
              {...propsTableau(t.cle, t.cle === "actAutres" ? COLONNES_AUTRES_ACTIVITES_ANTENNE : COLONNES_ACTIVITES_ANTENNE)}
            />
          ))}
          <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-3.5">
            <p className="mb-2 text-[13px] font-semibold text-forest-900">Diagramme — Prévue vs Réalisée par nature d&apos;activité</p>
            {dataPrevuRealise.length > 0 ? (
              <ChartPrevuRealise data={dataPrevuRealise} nomRealisees="Réalisée" />
            ) : (
              <NoteDiagramme texte="Renseignez des valeurs numériques dans les colonnes « Prévue » et « Réalisée » pour afficher le diagramme." />
            )}
          </div>
          {zonesSection("activites")}
        </SectionAccordeon>
      </div>

      {/* 3. II – État d'exécution des programmes */}
      <div className={estMasquee("programmes") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionAntenne("programmes", type)}
          ouverte={ouverte === "programmes"}
          onToggle={() => basculer("programmes")}
          actions={actionsSection("programmes")}
        >
          <TableauEditable titre="II-1. PRÉSCOLAIRE" {...propsTableau("programmesPrescolaire", COLONNES_PROGRAMMES_CYCLE)} />
          <TableauEditable titre="II-1. PRIMAIRE" {...propsTableau("programmesPrimaire", COLONNES_PROGRAMMES_CYCLE)} />
          <MatriceEditable
            titre="II-2. CAFOP"
            sousColonnes={SOUS_COLONNES_CAFOP}
            matrice={matriceCafop}
            lectureSeule={lectureSeule}
            onChange={(maj) => setMatriceCafop(maj)}
          />
          <MatriceEditable
            titre="II-3. SECONDAIRE GÉNÉRAL"
            sousColonnes={SOUS_COLONNES_SECONDAIRE}
            matrice={matriceSecondaire}
            lectureSeule={lectureSeule}
            onChange={(maj) => setMatriceSecondaire(maj)}
          />
          {zonesSection("programmes")}
        </SectionAccordeon>
      </div>

      {/* 4. III – Analyse des résultats des activités */}
      <div className={estMasquee("analyse") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionAntenne("analyse", type)}
          ouverte={ouverte === "analyse"}
          onToggle={() => basculer("analyse")}
          actions={actionsSection("analyse")}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                { nom: "analyse-satisfactions", libelle: "POINTS DE SATISFACTION", valeur: initiale.contenu.analyse.satisfactions },
                { nom: "analyse-insuffisances", libelle: "INSUFFISANCES RELEVÉES", valeur: initiale.contenu.analyse.insuffisances },
                { nom: "analyse-solutions", libelle: "SOLUTIONS PROPOSÉES", valeur: initiale.contenu.analyse.solutions },
              ] as const
            ).map((colonne) => (
              <div key={colonne.nom}>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-forest-900">
                  {colonne.libelle}
                </label>
                <textarea
                  name={colonne.nom}
                  rows={10}
                  maxLength={MAX_TEXTE_RAPPORT}
                  defaultValue={colonne.valeur}
                  disabled={lectureSeule}
                  className={textareaCls}
                />
              </div>
            ))}
          </div>
          {zonesSection("analyse")}
        </SectionAccordeon>
      </div>

      {/* 5. Conclusion + bloc signature « Le Chef de l'Antenne » */}
      <div className={estMasquee("conclusion") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionAntenne("conclusion", type)}
          ouverte={ouverte === "conclusion"}
          onToggle={() => basculer("conclusion")}
          actions={actionsSection("conclusion")}
        >
          <textarea
            name="conclusion"
            rows={5}
            maxLength={MAX_TEXTE_RAPPORT}
            defaultValue={initiale.contenu.conclusion}
            disabled={lectureSeule}
            placeholder="Bilan général de la période et perspectives…"
            className={textareaCls}
          />
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-center text-sm">
              <p className="text-ink-800">
                Fait à <span className="font-semibold">{faitA || "…"}</span>, le{" "}
                <span className="font-semibold">{dateDuJour}</span>
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-forest-900">Le Chef de l&apos;Antenne</p>
              <label htmlFor={`signataire-antenne-${type}`} className="sr-only">
                Nom du chef de l&apos;antenne
              </label>
              <input
                id={`signataire-antenne-${type}`}
                type="text"
                name="signataire"
                maxLength={MAX_TITRE_RAPPORT}
                defaultValue={initiale.contenu.signataire}
                disabled={lectureSeule}
                placeholder="Nom du chef de l'antenne"
                className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-center text-sm font-semibold outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
              />
            </div>
          </div>
          {zonesSection("conclusion")}
        </SectionAccordeon>
      </div>

      {/* Sections LIBRES, après les officielles. */}
      {sectionsLibres.map((s) => (
        <SectionLibreCard
          key={s.id}
          section={s}
          ouverte={ouverte === `libre-${s.id}`}
          onToggle={() => basculer(`libre-${s.id}`)}
          lectureSeule={lectureSeule}
          onTitre={(valeur) => modifierSectionLibre(s.id, (sec) => ({ ...sec, titre: valeur }))}
          onSupprimer={() => supprimerSectionLibre(s.id)}
          onAjouterZone={() =>
            modifierSectionLibre(s.id, (sec) =>
              sec.zones.length >= MAX_ZONES_PAR_SECTION
                ? sec
                : { ...sec, zones: [...sec.zones, { id: nouvelId(), titre: "", texte: "" }] },
            )
          }
          onModifierZone={(zoneId, champ, valeur) =>
            modifierSectionLibre(s.id, (sec) => ({
              ...sec,
              zones: sec.zones.map((z) => (z.id === zoneId ? { ...z, [champ]: valeur } : z)),
            }))
          }
          onRetirerZone={(zoneId) =>
            modifierSectionLibre(s.id, (sec) => ({ ...sec, zones: sec.zones.filter((z) => z.id !== zoneId) }))
          }
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!lectureSeule ? (
          <button
            type="button"
            onClick={ajouterSectionLibre}
            disabled={sectionsLibres.length >= MAX_SECTIONS_LIBRES}
            className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-4 py-1.5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50"
          >
            <Plus size={15} /> Ajouter un titre (section)
          </button>
        ) : (
          <span />
        )}
        {!lectureSeule && (
          <SubmitButton className="w-auto px-8">
            <Save size={15} /> Enregistrer le rapport
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
