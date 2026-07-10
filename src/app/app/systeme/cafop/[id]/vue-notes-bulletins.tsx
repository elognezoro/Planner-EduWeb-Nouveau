"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Plus, Trash2, Upload, FileText, Eye, Download, ChevronDown, Search } from "lucide-react";
import { ajouterNoteCafop, supprimerNoteCafop, importerNotesCafopCSV, type EtatForm } from "@/lib/formation/actions";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { Modale } from "../entete-cafop";
import { construireHtmlBulletinCafop, appreciationCafop, type LigneBulletin } from "@/lib/convertisseur/pdf-bulletin-cafop";
import { imprimerDocument } from "@/lib/impression";

export interface CafopVue {
  id: string;
  nom: string;
  drena: string | null;
  pays: string;
}
export interface ModuleNoteVue {
  id: string;
  nom: string;
  coefficient: number;
  annee: number;
}
export interface PromotionNoteVue {
  id: string;
  libelle: string;
}
export interface EleveVue {
  id: string;
  nom: string;
  prenoms: string | null;
  matricule: string | null;
  groupe: string | null;
  annee: number | null;
  promotionId: string;
}

const libelleAnnee = (n: number) => (n === 1 ? "1re Année" : `${n}e Année`);
/** Modules rattachés à l'année de formation de l'élève (repli : tous, si année inconnue). */
function modulesAnnee(modules: ModuleNoteVue[], annee: number | null): ModuleNoteVue[] {
  if (annee == null) return modules;
  const filtres = modules.filter((m) => m.annee === annee);
  return filtres.length ? filtres : modules;
}
/** Regroupe les modules par année de formation (croissante). */
function grouperParAnnee(modules: ModuleNoteVue[]): [number, ModuleNoteVue[]][] {
  const g = new Map<number, ModuleNoteVue[]>();
  for (const m of modules) g.set(m.annee, [...(g.get(m.annee) ?? []), m]);
  return [...g.entries()].sort((a, b) => a[0] - b[0]);
}
export interface NoteVue {
  id: string;
  apprenantId: string;
  moduleId: string;
  type: string;
  valeur: number;
  bareme: number;
  coefficient: number;
  semestre: number;
}

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));
const nomEleve = (e: { nom: string; prenoms: string | null }) => [e.nom, e.prenoms].filter(Boolean).join(" ");

/** Moyennes d'un élève : par module (pondérée par le coef de note), et générale (pondérée par le coef de module). */
function moyennes(notes: NoteVue[], modules: ModuleNoteVue[]) {
  const acc = new Map<string, { s: number; c: number }>();
  for (const n of notes) {
    const a = acc.get(n.moduleId) ?? { s: 0, c: 0 };
    a.s += (n.valeur / (n.bareme || 20)) * 20 * n.coefficient;
    a.c += n.coefficient;
    acc.set(n.moduleId, a);
  }
  const parModule = new Map<string, number>();
  for (const [mid, a] of acc) if (a.c > 0) parModule.set(mid, a.s / a.c);
  let sp = 0;
  let sc = 0;
  for (const m of modules) {
    const moy = parModule.get(m.id);
    if (moy !== undefined) {
      sp += moy * m.coefficient;
      sc += m.coefficient;
    }
  }
  return { parModule, generale: sc > 0 ? sp / sc : null };
}

export function NotesBulletinsCafop({
  cafop,
  annee,
  modules,
  promotions,
  eleves,
  notes,
  terme = "CAFOP",
  lectureSeule = false,
}: {
  cafop: CafopVue;
  annee: string;
  modules: ModuleNoteVue[];
  promotions: PromotionNoteVue[];
  eleves: EleveVue[];
  notes: NoteVue[];
  terme?: string;
  /** Rôle en lecture seule (adc/delc) : masque l'ajout et la suppression de notes. */
  lectureSeule?: boolean;
}) {
  const router = useRouter();
  const [semestre, setSemestre] = useState(2);
  const [promotionId, setPromotionId] = useState(promotions[0]?.id ?? "");
  const promoEleves = useMemo(() => eleves.filter((e) => e.promotionId === promotionId), [eleves, promotionId]);
  const groupes = useMemo(() => [...new Set(promoEleves.map((e) => e.groupe).filter(Boolean))] as string[], [promoEleves]);
  // null = « auto » (premier groupe) ; "" = « Tous les groupes ».
  const [groupe, setGroupe] = useState<string | null>(null);
  const groupeEffectif = groupe === null ? groupes[0] ?? "" : groupe;
  // Année de formation (niveau) : "" = toutes ; 1 | 2 | 3 = 1re / 2e / 3e Année.
  const annees = useMemo(
    () => [...new Set(promoEleves.map((e) => e.annee).filter((a): a is number => a != null))].sort((a, b) => a - b),
    [promoEleves],
  );
  const [anneeSel, setAnneeSel] = useState<number | "">("");
  const [eleveSel, setEleveSel] = useState("");
  const [detail, setDetail] = useState<EleveVue | null>(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [msgNote, setMsgNote] = useState<string | null>(null);

  function supprimerNote(id: string) {
    setMsgNote(null);
    supprimerNoteCafop(id).then((r) => {
      if (r.ok) router.refresh();
      else setMsgNote(r.message ?? "Suppression impossible.");
    });
  }

  const elevesGroupe = useMemo(
    () => promoEleves.filter((e) => (groupeEffectif ? e.groupe === groupeEffectif : true) && (anneeSel === "" || e.annee === anneeSel)),
    [promoEleves, groupeEffectif, anneeSel],
  );
  const notesGroupe = useMemo(() => {
    const ids = new Set(elevesGroupe.map((e) => e.id));
    return notes.filter((n) => ids.has(n.apprenantId) && n.semestre === semestre);
  }, [notes, elevesGroupe, semestre]);

  const eleveNom = new Map(eleves.map((e) => [e.id, nomEleve(e)]));
  const moduleNom = new Map(modules.map((m) => [m.id, m.nom]));

  // Bulletins : moyenne générale + rang par élève du groupe.
  const bulletins = useMemo(() => {
    const rows = elevesGroupe.map((e) => {
      const notesE = notesGroupe.filter((n) => n.apprenantId === e.id);
      const { parModule, generale } = moyennes(notesE, modulesAnnee(modules, e.annee));
      return { eleve: e, nbNotes: notesE.length, parModule, generale };
    });
    rows.sort((a, b) => (b.generale ?? -1) - (a.generale ?? -1));
    return rows.map((r, i) => ({ ...r, rang: i + 1 }));
  }, [elevesGroupe, notesGroupe, modules]);

  const promoLibelle = promotions.find((p) => p.id === promotionId)?.libelle ?? "";

  function telechargerBulletin(eleve: EleveVue) {
    const b = bulletins.find((x) => x.eleve.id === eleve.id);
    const lignes: LigneBulletin[] = modulesAnnee(modules, eleve.annee).map((m) => ({ module: m.nom, coef: m.coefficient, moyenne: b?.parModule.get(m.id) ?? null }));
    const html = construireHtmlBulletinCafop(
      {
        cafop: cafop.nom,
        drena: cafop.drena,
        pays: cafop.pays,
        eleve: nomEleve(eleve),
        matricule: eleve.matricule,
        promotion: promoLibelle,
        groupe: eleve.groupe,
        semestre,
        annee,
        lignes,
        moyenneGenerale: b?.generale ?? null,
        rang: b?.rang ?? 0,
        effectif: bulletins.length,
        date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
        terme,
      },
      { autoImpression: true },
    );
    imprimerDocument(html);
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold text-forest-900">Notes et bulletins</h2>
        <p className="mb-4 text-sm text-ink-700/60">
          Les élèves-maîtres s&apos;affichent par cohortes (promotions) et groupe-classe. Bulletin auto-renseigné :
          moyennes pondérées par les coefficients des modules.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Champ label="Semestre">
            <select value={semestre} onChange={(e) => setSemestre(Number(e.target.value))} className={champCls}>
              <option value={1}>Premier semestre</option>
              <option value={2}>Deuxième semestre</option>
            </select>
          </Champ>
          <Champ label={`Durée de formation — ${cafop.pays}`}>
            <select defaultValue="3" className={champCls}>
              <option value="3">3 ans</option>
              <option value="2">2 ans</option>
            </select>
          </Champ>
          <Champ label="Cohorte (promotion)">
            <select value={promotionId} onChange={(e) => { setPromotionId(e.target.value); setGroupe(null); setAnneeSel(""); }} className={champCls}>
              {promotions.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
          </Champ>
          <Champ label="Année (niveau)">
            <select value={anneeSel === "" ? "" : String(anneeSel)} onChange={(e) => setAnneeSel(e.target.value === "" ? "" : Number(e.target.value))} className={champCls}>
              <option value="">Toutes les années</option>
              {annees.map((a) => <option key={a} value={a}>{libelleAnnee(a)}</option>)}
            </select>
          </Champ>
          <Champ label="Groupe-classe">
            <select value={groupeEffectif} onChange={(e) => setGroupe(e.target.value)} className={champCls}>
              <option value="">Tous les groupes</option>
              {groupes.map((g) => <option key={g} value={g}>{`Groupe ${g}`}</option>)}
            </select>
          </Champ>
          <Champ label={`Élève-maître — ${promoLibelle}${groupeEffectif ? ` · Groupe ${groupeEffectif}` : ""} (${elevesGroupe.length})`}>
            <select value={eleveSel} onChange={(e) => setEleveSel(e.target.value)} className={champCls}>
              <option value="">Sélectionner un élève…</option>
              {elevesGroupe.map((e) => <option key={e.id} value={e.id}>{nomEleve(e)}</option>)}
            </select>
          </Champ>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!eleveSel}
              onClick={() => { const e = elevesGroupe.find((x) => x.id === eleveSel); if (e) telechargerBulletin(e); }}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-50"
            >
              <FileText size={16} /> Voir le bulletin
            </button>
          </div>
        </div>

        {/* Modules évalués — regroupés par année de formation */}
        <div className="mt-4 space-y-3 rounded-xl border border-cream-200 bg-cream-50/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">Modules évalués (référentiel de formation)</p>
          {grouperParAnnee(modules).map(([an, mods]) => (
            <div key={an}>
              <p className="mb-1.5 text-xs font-semibold text-forest-700">{libelleAnnee(an)}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {mods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm">
                    <span className="text-forest-900">{m.nom}</span>
                    <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">coef {m.coefficient}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ajouter une note */}
      {!lectureSeule && (
        <AjouterNote
          eleves={elevesGroupe}
          modules={modules}
          semestre={semestre}
          onImport={() => setImportOuvert(true)}
          onAjoute={() => router.refresh()}
        />
      )}

      {/* Notes de la classe */}
      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest-900">
            Notes de la classe {groupeEffectif ? `(Groupe ${groupeEffectif} — Semestre ${semestre})` : `(Semestre ${semestre})`}
          </h3>
          {msgNote && <div className="mt-2"><FormAlert ton="erreur">{msgNote}</FormAlert></div>}
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-cream-200 bg-cream-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-5 py-2.5">Élève</th>
                <th className="px-3 py-2.5">Module</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5 text-right">Note</th>
                <th className="px-3 py-2.5 text-right">Barème</th>
                <th className="px-3 py-2.5 text-right">Coef</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {notesGroupe.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-700/55">Aucune note pour ce groupe et ce semestre.</td></tr>
              ) : (
                notesGroupe.map((n) => (
                  <tr key={n.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                    <td className="whitespace-nowrap px-5 py-2 font-medium text-forest-900">{eleveNom.get(n.apprenantId)}</td>
                    <td className="px-3 py-2 text-ink-700/80">{moduleNom.get(n.moduleId)}</td>
                    <td className="whitespace-nowrap px-3 py-2"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{n.type}</span></td>
                    <td className="px-3 py-2 text-right font-semibold text-forest-900">{fmt(n.valeur)}</td>
                    <td className="px-3 py-2 text-right text-ink-700/60">/{n.bareme}</td>
                    <td className="px-3 py-2 text-right text-ink-700/80">{n.coefficient}</td>
                    <td className="px-3 py-2 text-right">
                      {!lectureSeule && (
                        <button type="button" onClick={() => supprimerNote(n.id)} title="Supprimer" className="text-ink-700/40 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bulletins */}
      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest-900">
            Bulletins {groupeEffectif ? `(Groupe ${groupeEffectif} — Semestre ${semestre})` : `(Semestre ${semestre})`}
          </h3>
        </div>
        <div className="divide-y divide-cream-100">
          {bulletins.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-700/55">Aucun élève-maître dans ce groupe.</p>
          ) : (
            bulletins.map((b) => (
              <div key={b.eleve.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-cream-50/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">{b.rang}</span>
                  <div>
                    <p className="font-semibold text-forest-900">{nomEleve(b.eleve)}</p>
                    <p className="text-xs text-ink-700/55">Semestre {semestre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-ink-700/55">
                    <span className="mr-3">NOTES <b className="text-forest-900">{b.nbNotes}</b></span>
                    <span>MOYENNE <b className="text-base text-forest-800">{fmt(b.generale)}</b>/20</span>
                  </div>
                  <button type="button" onClick={() => setDetail(b.eleve)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-sm font-semibold text-ink-700/70 hover:bg-cream-100">
                    <Eye size={15} /> Voir détails
                  </button>
                  <button type="button" onClick={() => telechargerBulletin(b.eleve)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-700">
                    <Download size={15} /> Télécharger PDF
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Détail d'un bulletin */}
      <AnimatePresence>
        {detail && (
          <Modale titre={`Bulletin — ${nomEleve(detail)}`} onFerme={() => setDetail(null)} large>
            <BulletinDetail
              eleve={detail}
              modules={modulesAnnee(modules, detail.annee)}
              row={bulletins.find((b) => b.eleve.id === detail.id)}
              semestre={semestre}
              onPdf={() => telechargerBulletin(detail)}
            />
          </Modale>
        )}
      </AnimatePresence>

      {/* Import de notes */}
      <AnimatePresence>
        {importOuvert && (
          <ImporterNotesModal
            cohorteId={promotionId}
            groupe={groupeEffectif}
            semestre={semestre}
            onFerme={() => setImportOuvert(false)}
            onImporte={() => { setImportOuvert(false); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-700/50">{label}</span>
      {children}
    </label>
  );
}

const TYPES_EVALUATION = [
  "Devoir surveillé",
  "Interrogation écrite",
  "Composition",
  "Exposé",
  "DIAS blanc",
  "Examen",
  "Éliminatoire Étoiles EduWeb",
];

/** Liste déroulante avec zone de recherche rapide (combobox). La valeur est soumise via un input caché. */
function SelectRecherche({
  name,
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  disabled,
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const labelSel = options.find((o) => o.value === value && o.value !== "")?.label ?? "";
  const filtres = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);

  // Fermeture au clic extérieur (setState dans un callback d'événement → conforme au lint).
  useEffect(() => {
    if (!ouvert) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button type="button" disabled={disabled} onClick={() => { setOuvert((v) => !v); setQ(""); }} className={`${champCls} flex items-center justify-between gap-2 text-left disabled:opacity-50`}>
        <span className={`truncate ${labelSel ? "text-ink-900" : "text-ink-700/40"}`}>{labelSel || placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-ink-700/50" />
      </button>
      {ouvert && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-cream-200 bg-white shadow-lg">
          <div className="border-b border-cream-100 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-cream-300 px-2.5">
              <Search size={14} className="shrink-0 text-ink-700/40" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche rapide…" className="h-8 w-full bg-transparent text-sm outline-none" />
            </div>
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {filtres.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-700/50">Aucun résultat.</li>
            ) : (
              filtres.map((o) => (
                <li key={o.value || "vide"}>
                  <button
                    type="button"
                    onClick={() => { onChange(o.value); setOuvert(false); setQ(""); }}
                    className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-forest-50 ${o.value === value ? "bg-forest-50 font-semibold text-forest-800" : "text-ink-700/80"}`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function AjouterNote({
  eleves,
  modules,
  semestre,
  onImport,
  onAjoute,
}: {
  eleves: EleveVue[];
  modules: ModuleNoteVue[];
  semestre: number;
  onImport: () => void;
  onAjoute: () => void;
}) {
  const [etat, action] = useActionState(ajouterNoteCafop, initial);
  const [eleveId, setEleveId] = useState("");
  const [niveau, setNiveau] = useState<number | "">("");
  const [moduleId, setModuleId] = useState("");
  const [type, setType] = useState(TYPES_EVALUATION[0]);
  const annees = useMemo(() => [...new Set(modules.map((m) => m.annee))].sort((a, b) => a - b), [modules]);
  const modulesNiveau = useMemo(() => (niveau === "" ? modules : modules.filter((m) => m.annee === niveau)), [modules, niveau]);
  const notifie = useRef(0);
  useEffect(() => {
    if (etat.ok && notifie.current !== 1) {
      notifie.current = 1;
      onAjoute();
    }
    if (!etat.ok) notifie.current = 0;
  }, [etat.ok, onAjoute]);

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-forest-900">Ajouter une note</h3>
        <button type="button" onClick={onImport} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-sm font-semibold text-ink-700/70 hover:bg-cream-100">
          <Upload size={15} /> Importer un CSV
        </button>
      </div>
      {etat.message && <div className="mb-3"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
      <form action={action} className="space-y-3">
        <input type="hidden" name="semestre" value={semestre} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Champ label="Élève">
            <SelectRecherche name="apprenantId" value={eleveId} onChange={setEleveId} placeholder="Sélectionner…" options={eleves.map((e) => ({ value: e.id, label: nomEleve(e) }))} />
          </Champ>
          <Champ label="Niveau (année)">
            <SelectRecherche
              value={niveau === "" ? "" : String(niveau)}
              onChange={(v) => { setNiveau(v === "" ? "" : Number(v)); setModuleId(""); }}
              placeholder="Tous les niveaux"
              options={[{ value: "", label: "Tous les niveaux" }, ...annees.map((a) => ({ value: String(a), label: libelleAnnee(a) }))]}
            />
          </Champ>
          <Champ label="Module (matière)">
            <SelectRecherche
              name="moduleId"
              value={moduleId}
              onChange={setModuleId}
              placeholder="Sélectionner un module…"
              options={modulesNiveau.map((m) => ({ value: m.id, label: niveau === "" ? `${libelleAnnee(m.annee)} · ${m.nom}` : m.nom }))}
            />
          </Champ>
          <Champ label="Type d'évaluation">
            <SelectRecherche name="type" value={type} onChange={setType} placeholder="Type…" options={TYPES_EVALUATION.map((t) => ({ value: t, label: t }))} />
          </Champ>
          <Champ label="Note"><input name="valeur" required placeholder="Ex : 14" className={champCls} /></Champ>
          <Champ label="Barème (total points)"><input name="bareme" defaultValue="20" className={champCls} /></Champ>
          <Champ label="Coefficient"><input name="coefficient" type="number" min={1} defaultValue="1" className={champCls} /></Champ>
        </div>
        <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50/50 px-3 py-2 font-mono text-xs text-ink-700/55">
          <div>FORMAT CSV ATTENDU</div>
          <div>Nom;Prénoms;Module;Type;Note;Barème;Coefficient</div>
          <div>Exemple: KONÉ;Moussa Ibrahim;Droits de l&apos;Homme;Devoir surveillé;14;20;1</div>
        </div>
        <div className="flex justify-end">
          <SubmitButton className="w-auto px-6"><Plus size={15} /> Enregistrer la note</SubmitButton>
        </div>
      </form>
    </section>
  );
}

function BulletinDetail({
  eleve,
  modules,
  row,
  semestre,
  onPdf,
}: {
  eleve: EleveVue;
  modules: ModuleNoteVue[];
  row: { parModule: Map<string, number>; generale: number | null; rang: number; nbNotes: number } | undefined;
  semestre: number;
  onPdf: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700/70">
        Semestre {semestre} · {eleve.groupe ? `Groupe ${eleve.groupe}` : ""} — {row?.nbNotes ?? 0} note(s)
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-cream-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
            <th className="py-2">Module</th>
            <th className="py-2 text-center">Coef</th>
            <th className="py-2 text-right">Moyenne /20</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m.id} className="border-b border-cream-100 last:border-0">
              <td className="py-2 text-forest-900">{m.nom}</td>
              <td className="py-2 text-center text-ink-700/70">{m.coefficient}</td>
              <td className="py-2 text-right font-semibold text-forest-900">{fmt(row?.parModule.get(m.id) ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-forest-50 px-4 py-3">
        <div className="text-sm">
          <span className="mr-4">Moyenne générale <b className="text-lg text-forest-800">{fmt(row?.generale ?? null)}</b>/20</span>
          <span>Rang <b className="text-forest-800">{row?.rang ?? "—"}</b></span>
        </div>
        <button type="button" onClick={onPdf} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white hover:bg-forest-700">
          <Download size={15} /> Télécharger PDF
        </button>
      </div>
      <p className="text-xs text-ink-700/55">Appréciation : {appreciationCafop(row?.generale ?? null)}.</p>
    </div>
  );
}

function ImporterNotesModal({
  cohorteId,
  groupe,
  semestre,
  onFerme,
  onImporte,
}: {
  cohorteId: string;
  groupe: string;
  semestre: number;
  onFerme: () => void;
  onImporte: () => void;
}) {
  const [etat, action, pending] = useActionState(importerNotesCafopCSV, initial);
  const notifie = useRef(false);
  useEffect(() => {
    if (etat.ok && !notifie.current) {
      notifie.current = true;
      onImporte();
    }
  }, [etat.ok, onImporte]);

  return (
    <Modale titre="Importer des notes (CSV)" onFerme={() => !pending && onFerme()} large>
      <form action={action} className="space-y-3">
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        <input type="hidden" name="cohorteId" value={cohorteId} />
        <input type="hidden" name="groupe" value={groupe} />
        <input type="hidden" name="semestre" value={semestre} />
        <p className="text-sm text-ink-700/70">
          En-tête attendu : <code className="text-xs">Nom;Prénoms;Module;Type;Note;Barème;Coefficient</code>. L&apos;élève est
          rapproché par nom + prénoms dans le groupe sélectionné, le module par son nom. Semestre {semestre}.
        </p>
        <textarea
          name="texte"
          rows={5}
          placeholder={"Nom;Prénoms;Module;Type;Note;Barème;Coefficient\nKONÉ;Moussa Ibrahim;Droits de l'Homme;Devoir surveillé;14;20;1"}
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input type="file" name="fichier" accept=".csv,text/csv,.txt" className="text-xs" />
          <div className="flex gap-2">
            <button type="button" onClick={onFerme} disabled={pending} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 disabled:opacity-60">Annuler</button>
            <SubmitButton className="w-auto px-6"><Download size={15} /> Importer</SubmitButton>
          </div>
        </div>
      </form>
    </Modale>
  );
}
