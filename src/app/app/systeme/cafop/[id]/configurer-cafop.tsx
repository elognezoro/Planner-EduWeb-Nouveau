"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2, Users } from "lucide-react";
import { modifierCafop, ajouterApprenant, supprimerApprenant, creerCohorte, type EtatForm } from "@/lib/formation/actions";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { DocumentsCafop } from "./documents-cafop";

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface CafopConfig {
  id: string;
  nom: string;
  code: string | null;
  pays: string;
  drena: string | null;
  localite: string | null;
  directeur: string | null;
  directeurTel: string | null;
  effectif: number;
  emblemeUrl: string | null;
  logoUrl: string | null;
  cachetUrl: string | null;
  signatureUrl: string | null;
}
export interface PromotionConfig { id: string; libelle: string; nbEleves: number }
export interface EleveConfig { id: string; nom: string; prenoms: string | null; matricule: string | null; groupe: string | null; annee: number | null; promotionId: string }

const libelleAnnee = (n: number) => (n === 1 ? "1re Année" : `${n}e Année`);
// Casse « live » sans rognage (autorise la saisie d'espaces).
const majLive = (s: string) => s.toUpperCase();
const titreLive = (s: string) => s.toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

export function ConfigurerCafop({ cafop, promotions, eleves, paysArmoiries }: { cafop: CafopConfig; promotions: PromotionConfig[]; eleves: EleveConfig[]; paysArmoiries: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [etatEdit, actionEdit] = useActionState(modifierCafop, initial);
  const [etatEleve, actionEleve] = useActionState(ajouterApprenant, initial);
  const [etatPromo, actionPromo] = useActionState(creerCohorte, initial);
  const rafraichi = useRef({ edit: false, eleve: false, promo: false });
  const formEleveRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    for (const [k, ok] of [["edit", etatEdit.ok], ["eleve", etatEleve.ok], ["promo", etatPromo.ok]] as const) {
      if (ok && !rafraichi.current[k]) {
        rafraichi.current[k] = true;
        router.refresh();
        if (k === "eleve") formEleveRef.current?.reset(); // vide le formulaire (DOM) seulement après succès
      }
      if (!ok) rafraichi.current[k] = false;
    }
  }, [etatEdit.ok, etatEleve.ok, etatPromo.ok, router]);

  // ── Cascade Promotion → Année → Classe ──
  const [promoSel, setPromoSel] = useState(promotions[0]?.id ?? "");
  const promoEleves = useMemo(() => eleves.filter((e) => e.promotionId === promoSel), [eleves, promoSel]);
  const annees = useMemo(() => [...new Set(promoEleves.map((e) => e.annee).filter((a): a is number => a != null))].sort((a, b) => a - b), [promoEleves]);
  // null = auto (1re année présente) ; "" = « Toutes les années » ; number = année choisie.
  const [anneeSel, setAnneeSel] = useState<number | "" | null>(null);
  const anneeEff = anneeSel === null ? annees[0] ?? null : anneeSel === "" ? null : anneeSel;
  const classes = useMemo(() => [...new Set(promoEleves.filter((e) => anneeEff == null || e.annee === anneeEff).map((e) => e.groupe).filter(Boolean))] as string[], [promoEleves, anneeEff]);
  const [classe, setClasse] = useState("");
  const elevesFiltres = promoEleves.filter((e) => (anneeEff == null || e.annee === anneeEff) && (classe ? e.groupe === classe : true));

  return (
    <div className="space-y-6">
      {/* Fiche du centre */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-4 font-display text-base font-bold text-forest-900">Fiche du centre {cafop.code ? <span className="text-sm font-normal text-ink-700/50">· {cafop.code}</span> : null}</h3>
        {etatEdit.message && <div className="mb-3"><FormAlert ton={etatEdit.ok ? "succes" : "erreur"}>{etatEdit.message}</FormAlert></div>}
        <form action={actionEdit} className="space-y-3">
          <input type="hidden" name="id" value={cafop.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Nom du CAFOP *"><input name="nom" defaultValue={cafop.nom} required className={champCls} /></Champ>
            <Champ label="DRENA"><input name="drena" defaultValue={cafop.drena ?? ""} className={champCls} /></Champ>
            <Champ label="Localité"><input name="localite" defaultValue={cafop.localite ?? ""} className={champCls} /></Champ>
            <Champ label="Directeur"><input name="directeur" defaultValue={cafop.directeur ?? ""} className={champCls} /></Champ>
            <Champ label="Téléphone"><input name="directeurTel" defaultValue={cafop.directeurTel ?? ""} className={champCls} /></Champ>
            <Champ label="Effectif (élèves-maîtres)"><input name="effectif" type="number" min={0} defaultValue={cafop.effectif} className={champCls} /></Champ>
          </div>
          <div className="flex justify-end"><SubmitButton className="w-auto px-6"><Save size={15} /> Enregistrer</SubmitButton></div>
        </form>
      </section>

      {/* Documents officiels */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-display text-base font-bold text-forest-900">Documents officiels</h3>
        <p className="mb-4 text-sm text-ink-700/60">Glissez-déposez ou cliquez pour téléverser. Les armoiries reprennent par défaut celles du pays sélectionné dans la barre du haut ({paysArmoiries}).</p>
        <DocumentsCafop cafopId={cafop.id} pays={paysArmoiries} docs={{ embleme: cafop.emblemeUrl, logo: cafop.logoUrl, cachet: cafop.cachetUrl, signature: cafop.signatureUrl }} />
      </section>

      {/* Promotions */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-display text-base font-bold text-forest-900">Promotions</h3>
        <p className="mb-3 text-sm text-ink-700/60">Cohortes d&apos;élèves-maîtres du centre.</p>
        {etatPromo.message && <div className="mb-3"><FormAlert ton={etatPromo.ok ? "succes" : "erreur"}>{etatPromo.message}</FormAlert></div>}
        <div className="mb-4 space-y-1.5">
          {promotions.length === 0 ? <p className="text-sm text-ink-700/55">Aucune promotion.</p> : promotions.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-cream-200 px-3 py-2 text-sm">
              <span className="font-medium text-forest-900">{p.libelle}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800"><Users size={11} /> {p.nbEleves}</span>
            </div>
          ))}
        </div>
        <form action={actionPromo} className="flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3">
          <input type="hidden" name="type" value="cafop_promotion" />
          <input type="hidden" name="cafopId" value={cafop.id} />
          <div className="min-w-[12rem] flex-1"><Champ label="Nouvelle promotion"><input name="libelle" required placeholder="Promotion 2026-2028" className={champCls} /></Champ></div>
          <div className="w-24"><Champ label="Début"><input name="anneeDebut" type="number" placeholder="2026" className={champCls} /></Champ></div>
          <div className="w-24"><Champ label="Fin"><input name="anneeFin" type="number" placeholder="2028" className={champCls} /></Champ></div>
          <SubmitButton className="w-auto px-5"><Plus size={15} /> Ajouter</SubmitButton>
        </form>
      </section>

      {/* Élèves-maîtres — cascade Promotion → Année → Classe */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-forest-900">Élèves-maîtres</h3>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Champ label="Promotion">
            <select value={promoSel} onChange={(e) => { setPromoSel(e.target.value); setAnneeSel(null); setClasse(""); }} className={champCls}>
              {promotions.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
          </Champ>
          <Champ label="Année de formation">
            <select value={anneeSel === "" ? "" : String(anneeEff ?? "")} onChange={(e) => { setAnneeSel(e.target.value === "" ? "" : Number(e.target.value)); setClasse(""); }} className={champCls}>
              <option value="">Toutes les années</option>
              {annees.map((a) => <option key={a} value={a}>{libelleAnnee(a)}</option>)}
            </select>
          </Champ>
          <Champ label="Classe pédagogique">
            <select value={classe} onChange={(e) => setClasse(e.target.value)} className={champCls}>
              <option value="">Toutes les classes</option>
              {classes.map((c) => <option key={c} value={c}>{`Classe ${c}`}</option>)}
            </select>
          </Champ>
        </div>

        {etatEleve.message && <div className="mb-3"><FormAlert ton={etatEleve.ok ? "succes" : "erreur"}>{etatEleve.message}</FormAlert></div>}
        <div className="mb-4 max-h-72 overflow-auto rounded-xl border border-cream-100">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-cream-50">
              <tr className="border-b border-cream-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-3 py-2">Nom</th><th className="px-3 py-2">Prénoms</th><th className="px-3 py-2">Année</th><th className="px-3 py-2">Classe</th><th className="px-3 py-2">Matricule</th><th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {elevesFiltres.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-ink-700/55">Aucun élève-maître.</td></tr> : elevesFiltres.map((e) => (
                <tr key={e.id} className="border-b border-cream-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-forest-900">{e.nom}</td>
                  <td className="px-3 py-2 text-ink-700/80">{e.prenoms ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-700/70">{e.annee ? libelleAnnee(e.annee) : "—"}</td>
                  <td className="px-3 py-2 text-ink-700/70">{e.groupe ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-700/55">{e.matricule ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" disabled={pending} onClick={() => start(async () => { const r = await supprimerApprenant(e.id); if (r.ok) router.refresh(); })} className="text-ink-700/40 hover:text-red-600 disabled:opacity-50" title="Retirer">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form ref={formEleveRef} action={actionEleve} className="flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3">
          <input type="hidden" name="cohorteId" value={promoSel} />
          <div className="w-32"><Champ label="Nom"><input name="nom" required onChange={(e) => { e.currentTarget.value = majLive(e.currentTarget.value); }} placeholder="KONÉ" className={champCls} /></Champ></div>
          <div className="w-40"><Champ label="Prénoms"><input name="prenoms" onChange={(e) => { e.currentTarget.value = titreLive(e.currentTarget.value); }} placeholder="Moussa Ibrahim" className={champCls} /></Champ></div>
          <div className="w-28"><Champ label="Année">
            <select key={`an-${anneeEff ?? "auto"}`} name="annee" defaultValue={anneeEff ?? 1} className={champCls}>
              {[1, 2, 3].map((a) => <option key={a} value={a}>{libelleAnnee(a)}</option>)}
            </select>
          </Champ></div>
          <div className="w-20"><Champ label="Classe"><input key={`cl-${classe || "vide"}`} name="groupe" defaultValue={classe} placeholder="F2" className={champCls} /></Champ></div>
          <div className="w-36"><Champ label="Matricule"><input name="matricule" placeholder="(auto ou manuel)" className={champCls} /></Champ></div>
          <SubmitButton className="w-auto px-5"><Plus size={15} /> Ajouter</SubmitButton>
        </form>
      </section>
    </div>
  );
}
