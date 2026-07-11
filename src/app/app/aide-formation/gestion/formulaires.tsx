"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Loader2, Pencil, X } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { TYPES_MODULE, NIVEAUX, FORMATS_SESSION } from "@/lib/lms";
import {
  enregistrerCours, basculerPublicationCours, supprimerCours,
  enregistrerModule, supprimerModule, deplacerModule,
  enregistrerSession, supprimerSession, enregistrerCategorie, supprimerCategorie,
  type EtatLms,
} from "../actions";

const initial: EtatLms = { ok: false };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

export interface OptionsCommunes {
  categories: { id: string; nom: string }[];
  roles: { id: string; libelle: string }[];
  coursListe?: { id: string; titre: string }[];
}

function useFerme(ok: boolean, onOk: () => void) {
  const vu = useRef(false);
  useEffect(() => {
    if (ok && !vu.current) { vu.current = true; onOk(); }
  }, [ok, onOk]);
}

/** Cases à cocher des rôles cibles. */
function ChampRoles({ roles, selection = [] }: { roles: OptionsCommunes["roles"]; selection?: string[] }) {
  return (
    <div>
      <span className={label}>Public cible <span className="font-normal text-ink-700/50">(aucun = tous)</span></span>
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => (
          <label key={r.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1 text-xs hover:bg-cream-50">
            <input type="checkbox" name="publicCible" value={r.id} defaultChecked={selection.includes(r.id)} className="accent-forest-600" />
            {r.libelle}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Cours ───────────────────────────────────────────────────

export function FormCours({ opts, cours }: { opts: OptionsCommunes; cours?: { id: string; titre: string; description: string | null; categorieId: string | null; niveau: string | null; publicCible: string[]; dureeMinutes: number | null; seuilCompletion: number; attestationSignataire: string | null; attestationFonction: string | null; attestationMention: string | null } }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerCours, initial);
  const [ouvert, setOuvert] = useState(false);
  useFerme(etat.ok, () => { setOuvert(false); router.refresh(); });

  if (!ouvert && !cours) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white hover:bg-forest-700">
        <Plus size={16} /> Nouveau cours
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-cream-50/40 p-4">
      {cours && <input type="hidden" name="id" value={cours.id} />}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label} htmlFor="c-titre">Titre</label><input id="c-titre" name="titre" required defaultValue={cours?.titre} placeholder="Ex : Prise en main d'EduWeb Planner" className={champ} /></div>
      <div><label className={label} htmlFor="c-desc">Description</label><textarea id="c-desc" name="description" rows={2} defaultValue={cours?.description ?? ""} className={`${champ} h-auto py-2`} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={label}>Catégorie</label>
          <select name="categorieId" defaultValue={cours?.categorieId ?? ""} className={champ}>
            <option value="">— Aucune —</option>
            {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div><label className={label}>Niveau</label>
          <select name="niveau" defaultValue={cours?.niveau ?? ""} className={champ}>
            <option value="">—</option>
            {NIVEAUX.map((n) => <option key={n.v} value={n.v}>{n.libelle}</option>)}
          </select>
        </div>
        <div><label className={label}>Durée (min)</label><input name="dureeMinutes" type="number" min={0} defaultValue={cours?.dureeMinutes ?? ""} className={champ} /></div>
      </div>
      <ChampRoles roles={opts.roles} selection={cours?.publicCible} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="c-seuil">Seuil de validation (%)</label>
          <input id="c-seuil" name="seuilCompletion" type="number" min={1} max={100} defaultValue={cours?.seuilCompletion ?? 100} className={champ} />
          <p className="mt-1 text-xs text-ink-700/50">% de leçons à terminer pour valider le cours (défaut 100). Les quiz « sommatifs » restent obligatoires.</p>
        </div>
      </div>
      <fieldset className="space-y-3 rounded-xl border border-cream-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Attestation (facultatif)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={label}>Signataire</label><input name="attestationSignataire" defaultValue={cours?.attestationSignataire ?? ""} placeholder="Ex : Le Directeur de l'Académie" className={champ} /></div>
          <div><label className={label}>Fonction</label><input name="attestationFonction" defaultValue={cours?.attestationFonction ?? ""} placeholder="Ex : SEDEC · Coordination pédagogique" className={champ} /></div>
        </div>
        <div><label className={label}>Mention portée sur l'attestation</label><input name="attestationMention" defaultValue={cours?.attestationMention ?? ""} placeholder="Ex : Formation certifiante SEDEC 2026" className={champ} /></div>
      </fieldset>
      <div className="flex justify-end gap-2">
        {!cours && <button type="button" onClick={() => setOuvert(false)} className="h-10 rounded-full border border-cream-300 px-4 text-sm text-ink-700/70 hover:bg-cream-100">Annuler</button>}
        <SubmitButton className="w-auto px-5">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

export function BoutonPublier({ id, publie }: { id: string; publie: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await basculerPublicationCours(id, !publie); router.refresh(); })}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${publie ? "bg-forest-50 text-forest-700 hover:bg-forest-100" : "bg-gold-100 text-gold-800 hover:bg-gold-200"}`}>
      {pending ? <Loader2 size={13} className="animate-spin" /> : publie ? <Eye size={13} /> : <EyeOff size={13} />}
      {publie ? "Publié" : "Brouillon"}
    </button>
  );
}

/** Bouton de suppression générique avec confirmation. */
export function BoutonSupprimer({ action, id, libelle, confirmation }: { action: (id: string) => Promise<EtatLms>; id: string; libelle?: string; confirmation: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} title={libelle ?? "Supprimer"}
      onClick={() => { if (window.confirm(confirmation)) start(async () => { await action(id); router.refresh(); }); }}
      className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{libelle && <span className="text-xs">{libelle}</span>}
    </button>
  );
}
export const SupprimerCoursBtn = (p: { id: string }) => <BoutonSupprimer action={supprimerCours} id={p.id} confirmation="Supprimer ce cours et toutes ses leçons ?" />;
export const SupprimerCategorieBtn = (p: { id: string }) => <BoutonSupprimer action={supprimerCategorie} id={p.id} confirmation="Supprimer cette catégorie ?" />;
export const SupprimerSessionBtn = (p: { id: string }) => <BoutonSupprimer action={supprimerSession} id={p.id} confirmation="Supprimer cette session ?" />;

// ── Leçon (module) ──────────────────────────────────────────

export function FormModule({ coursId, module }: { coursId: string; module?: { id: string; titre: string; type: string; contenu: string | null; dureeMinutes: number | null; fichierNom: string | null } }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerModule, initial);
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState(module?.type ?? "texte");
  useFerme(etat.ok, () => { setOuvert(false); router.refresh(); });

  if (!ouvert && !module) {
    return <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Plus size={15} /> Ajouter une leçon</button>;
  }
  if (!ouvert && module) {
    return <button type="button" onClick={() => setOuvert(true)} className="rounded-lg p-1.5 text-ink-700/50 hover:bg-cream-100 hover:text-forest-700" title="Modifier"><Pencil size={14} /></button>;
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-soft">
      {module && <input type="hidden" name="id" value={module.id} />}
      <input type="hidden" name="coursId" value={coursId} />
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-bold text-forest-900">{module ? "Modifier la leçon" : "Nouvelle leçon"}</h4>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Titre</label><input name="titre" required defaultValue={module?.titre} className={champ} /></div>
        <div><label className={label}>Type</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={champ}>
            {TYPES_MODULE.map((t) => <option key={t.v} value={t.v}>{t.libelle}</option>)}
          </select>
        </div>
      </div>
      {type === "texte" && (
        <div><label className={label}>Contenu <span className="font-normal text-ink-700/50">(Markdown : ## titre, **gras**, - liste, [lien](url))</span></label>
          <textarea name="contenu" rows={6} defaultValue={module?.contenu ?? ""} className={`${champ} h-auto py-2 font-mono text-xs`} /></div>
      )}
      {(type === "video" || type === "lien") && (
        <div><label className={label}>{type === "video" ? "Lien de la vidéo (YouTube / Vimeo)" : "URL de la ressource"}</label>
          <input name="contenu" type="url" defaultValue={module?.contenu ?? ""} placeholder="https://…" className={champ} /></div>
      )}
      {type === "fichier" && (
        <div><label className={label}>Document (PDF, max 8 Mo)</label>
          <input name="fichier" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,image/*" className="text-xs" />
          {module?.fichierNom && <p className="mt-1 text-xs text-ink-700/60">Actuel : {module.fichierNom} (laisser vide pour conserver)</p>}
        </div>
      )}
      {type === "quiz" && (
        <p className="rounded-xl bg-cream-100 px-4 py-2.5 text-xs text-ink-700/70">Enregistrez la leçon, puis utilisez le bouton « Questions » pour composer le quiz et régler le seuil de réussite.</p>
      )}
      {type === "devoir" && (
        <p className="rounded-xl bg-cream-100 px-4 py-2.5 text-xs text-ink-700/70">Enregistrez la leçon, puis utilisez le bouton « Consigne » pour définir le devoir (consigne, mode de dépôt, barème). Les tuteurs désignés du cours corrigent les dépôts.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Durée (min)</label><input name="dureeMinutes" type="number" min={0} defaultValue={module?.dureeMinutes ?? ""} className={champ} /></div>
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5">Enregistrer la leçon</SubmitButton></div>
    </form>
  );
}

export function BoutonsOrdreModule({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (sens: "haut" | "bas") => start(async () => { await deplacerModule(id, sens); router.refresh(); });
  return (
    <div className="flex flex-col">
      <button type="button" disabled={pending} onClick={() => go("haut")} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700 disabled:opacity-40"><ChevronUp size={15} /></button>
      <button type="button" disabled={pending} onClick={() => go("bas")} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700 disabled:opacity-40"><ChevronDown size={15} /></button>
    </div>
  );
}
export const SupprimerModuleBtn = (p: { id: string }) => <BoutonSupprimer action={supprimerModule} id={p.id} confirmation="Supprimer cette leçon ?" />;

// ── Catégorie ───────────────────────────────────────────────

export function FormCategorie() {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerCategorie, initial);
  const [ouvert, setOuvert] = useState(false);
  useFerme(etat.ok, () => { setOuvert(false); router.refresh(); });
  if (!ouvert) return <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Plus size={14} /> Catégorie</button>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-xl border border-cream-200 bg-cream-50/40 p-3">
      {etat.message && !etat.ok && <div className="w-full"><FormAlert ton="erreur">{etat.message}</FormAlert></div>}
      <div className="min-w-[10rem] flex-1"><label className={label}>Nom de la catégorie</label><input name="nom" required className={champ} /></div>
      <div className="w-20"><label className={label}>Ordre</label><input name="ordre" type="number" min={0} defaultValue={0} className={champ} /></div>
      <SubmitButton className="w-auto px-4">Ajouter</SubmitButton>
      <button type="button" onClick={() => setOuvert(false)} className="h-10 rounded-full px-3 text-sm text-ink-700/60 hover:bg-cream-100">Annuler</button>
    </form>
  );
}

// ── Session ─────────────────────────────────────────────────

export function FormSession({ opts, session }: { opts: OptionsCommunes; session?: { id: string; titre: string; description: string | null; coursId: string | null; format: string; animateur: string | null; dateDebut: string; dateFin: string | null; dureeMinutes: number | null; lienVisio: string | null; lieu: string | null; placesMax: number | null; publicCible: string[]; pays: string | null } }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerSession, initial);
  const [ouvert, setOuvert] = useState(false);
  useFerme(etat.ok, () => { setOuvert(false); router.refresh(); });

  if (!ouvert && !session) return <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white hover:bg-forest-700"><Plus size={16} /> Nouvelle session</button>;
  if (!ouvert && session) return <button type="button" onClick={() => setOuvert(true)} className="rounded-lg p-1.5 text-ink-700/50 hover:bg-cream-100 hover:text-forest-700" title="Modifier"><Pencil size={14} /></button>;
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-cream-50/40 p-4">
      {session && <input type="hidden" name="id" value={session.id} />}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Titre</label><input name="titre" required defaultValue={session?.titre} className={champ} /></div>
      <div><label className={label}>Description</label><textarea name="description" rows={2} defaultValue={session?.description ?? ""} className={`${champ} h-auto py-2`} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Format</label><select name="format" defaultValue={session?.format ?? "webinaire"} className={champ}>{FORMATS_SESSION.map((f) => <option key={f.v} value={f.v}>{f.libelle}</option>)}</select></div>
        <div><label className={label}>Durée (min)</label><input name="dureeMinutes" type="number" min={0} defaultValue={session?.dureeMinutes ?? ""} className={champ} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Date &amp; heure de début</label><input name="dateDebut" type="datetime-local" required defaultValue={session?.dateDebut ?? ""} className={champ} /></div>
        <div><label className={label}>Date &amp; heure de fin <span className="font-normal text-ink-700/50">(facultatif)</span></label><input name="dateFin" type="datetime-local" defaultValue={session?.dateFin ?? ""} className={champ} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={label}>Animateur</label><input name="animateur" defaultValue={session?.animateur ?? ""} className={champ} /></div>
        <div><label className={label}>Places max</label><input name="placesMax" type="number" min={1} defaultValue={session?.placesMax ?? ""} className={champ} /></div>
        <div><label className={label}>Cours associé</label>
          <select name="coursId" defaultValue={session?.coursId ?? ""} className={champ}><option value="">—</option>{(opts.coursListe ?? []).map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}</select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Lien visio</label><input name="lienVisio" type="url" defaultValue={session?.lienVisio ?? ""} placeholder="https://…" className={champ} /></div>
        <div><label className={label}>Lieu (présentiel)</label><input name="lieu" defaultValue={session?.lieu ?? ""} className={champ} /></div>
      </div>
      <ChampRoles roles={opts.roles} selection={session?.publicCible} />
      <div className="flex justify-end gap-2">
        {!session && <button type="button" onClick={() => setOuvert(false)} className="h-10 rounded-full border border-cream-300 px-4 text-sm text-ink-700/70 hover:bg-cream-100">Annuler</button>}
        <SubmitButton className="w-auto px-5">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
