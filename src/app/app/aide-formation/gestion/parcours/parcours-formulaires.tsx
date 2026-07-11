"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Check, ChevronUp, ChevronDown } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { COULEURS_BADGE, NIVEAUX } from "@/lib/lms";
import {
  enregistrerBadge, supprimerBadge,
  enregistrerParcours, basculerPublicationParcours, supprimerParcours,
  ajouterEtape, retirerEtape, deplacerEtape,
} from "@/app/app/aide-formation/parcours-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

// Se déclenche à CHAQUE succès distinct (chaque appel d'action renvoie un nouvel objet `etat`).
function useFerme(etat: { ok: boolean }, cb: () => void) {
  const traite = useRef<{ ok: boolean } | null>(null);
  useEffect(() => { if (etat.ok && traite.current !== etat) { traite.current = etat; cb(); } }, [etat, cb]);
}

export type OptionRole = { id: string; libelle: string };
export type OptionBadge = { id: string; nom: string };
export type OptionCours = { id: string; titre: string };

// ── Badge ───────────────────────────────────────────────────

export function FormBadge({ badge }: { badge?: { id: string; nom: string; description: string | null; icone: string | null; couleur: string } }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerBadge, initial);
  const [ouvert, setOuvert] = useState(false);
  useFerme(etat,() => { setOuvert(false); router.refresh(); });

  if (!ouvert) {
    return badge ? (
      <button type="button" onClick={() => setOuvert(true)} className="rounded-lg p-1.5 text-ink-700/50 hover:bg-cream-100 hover:text-forest-700" title="Modifier"><Pencil size={14} /></button>
    ) : (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-9 items-center gap-2 rounded-full border border-forest-300 bg-white px-3 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Plus size={14} /> Nouveau badge</button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-soft">
      {badge && <input type="hidden" name="id" value={badge.id} />}
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-bold text-forest-900">{badge ? "Modifier le badge" : "Nouveau badge"}</h4>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Nom</label><input name="nom" required defaultValue={badge?.nom} className={champ} /></div>
      <div><label className={label}>Description (facultatif)</label><textarea name="description" rows={2} defaultValue={badge?.description ?? ""} className={`${champ} h-auto py-2`} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Icône lucide (facultatif)</label><input name="icone" defaultValue={badge?.icone ?? ""} placeholder="Award, Star, Trophy…" className={champ} /></div>
        <div><label className={label}>Couleur</label>
          <select name="couleur" defaultValue={badge?.couleur ?? "gold"} className={champ}>{COULEURS_BADGE.map((c) => <option key={c.v} value={c.v}>{c.libelle}</option>)}</select>
        </div>
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5"><Check size={15} /> Enregistrer</SubmitButton></div>
    </form>
  );
}

export const SupprimerBadgeBtn = ({ id }: { id: string }) => <BoutonSupprimer action={supprimerBadge} id={id} confirmation="Supprimer ce badge ? Les parcours qui l'utilisent le perdront." />;

// ── Parcours (fiche) ────────────────────────────────────────

export function FormParcours({ opts, parcours }: {
  opts: { roles: OptionRole[]; badges: OptionBadge[] };
  parcours?: { id: string; titre: string; description: string | null; niveau: string | null; publicCible: string[]; badgeId: string | null };
}) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerParcours, initial);
  const [ouvert, setOuvert] = useState(false);
  useFerme(etat,() => { setOuvert(false); router.refresh(); });

  if (!ouvert) {
    return parcours ? (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-cream-100"><Pencil size={13} /> Fiche</button>
    ) : (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white shadow-soft hover:bg-forest-700"><Plus size={15} /> Nouveau parcours</button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-soft">
      {parcours && <input type="hidden" name="id" value={parcours.id} />}
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-bold text-forest-900">{parcours ? "Modifier le parcours" : "Nouveau parcours"}</h4>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Titre</label><input name="titre" required defaultValue={parcours?.titre} className={champ} /></div>
      <div><label className={label}>Description (facultatif)</label><textarea name="description" rows={2} defaultValue={parcours?.description ?? ""} className={`${champ} h-auto py-2`} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Niveau</label>
          <select name="niveau" defaultValue={parcours?.niveau ?? ""} className={champ}>
            <option value="">— Non précisé —</option>
            {NIVEAUX.map((n) => <option key={n.v} value={n.v}>{n.libelle}</option>)}
          </select>
        </div>
        <div><label className={label}>Badge à la complétion</label>
          <select name="badgeId" defaultValue={parcours?.badgeId ?? ""} className={champ}>
            <option value="">— Aucun —</option>
            {opts.badges.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        </div>
      </div>
      <ChampRoles roles={opts.roles} defaut={parcours?.publicCible ?? []} />
      <div className="flex justify-end"><SubmitButton className="w-auto px-5"><Check size={15} /> Enregistrer</SubmitButton></div>
    </form>
  );
}

function ChampRoles({ roles, defaut }: { roles: OptionRole[]; defaut: string[] }) {
  return (
    <div>
      <label className={label}>Public visé <span className="font-normal text-ink-700/50">(aucun coché = tous les rôles)</span></label>
      <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-cream-200 p-2 sm:grid-cols-3">
        {roles.map((r) => (
          <label key={r.id} className="flex items-center gap-1.5 text-xs text-ink-800">
            <input type="checkbox" name="publicCible" value={r.id} defaultChecked={defaut.includes(r.id)} className="accent-forest-600" />
            {r.libelle}
          </label>
        ))}
      </div>
    </div>
  );
}

export function BoutonPublierParcours({ id, publie }: { id: string; publie: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await basculerPublicationParcours(id, !publie); router.refresh(); })}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${publie ? "bg-forest-100 text-forest-800 hover:bg-forest-200" : "bg-gold-500 text-forest-950 hover:bg-gold-400"}`}>
      {publie ? "Dépublier" : "Publier"}
    </button>
  );
}

export const SupprimerParcoursBtn = ({ id }: { id: string }) => <BoutonSupprimer action={supprimerParcours} id={id} confirmation="Supprimer ce parcours ?" />;

// ── Étapes ──────────────────────────────────────────────────

export function FormEtape({ parcoursId, coursDispo }: { parcoursId: string; coursDispo: OptionCours[] }) {
  const router = useRouter();
  const [etat, action] = useActionState(ajouterEtape, initial);
  useFerme(etat,() => router.refresh());
  if (coursDispo.length === 0) return <p className="text-sm text-ink-700/55">Tous les cours du catalogue sont déjà dans ce parcours.</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="parcoursId" value={parcoursId} />
      <div className="min-w-[220px] flex-1">
        <label className={label}>Ajouter un cours</label>
        <select name="coursId" required defaultValue="" className={champ}>
          <option value="" disabled>— Choisir un cours —</option>
          {coursDispo.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
        </select>
      </div>
      <SubmitButton className="w-auto px-5"><Plus size={15} /> Ajouter</SubmitButton>
      {etat.message && !etat.ok && <p className="w-full text-sm font-medium text-red-600">{etat.message}</p>}
    </form>
  );
}

export function BoutonsOrdreEtape({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (sens: "haut" | "bas") => start(async () => { await deplacerEtape(id, sens); router.refresh(); });
  return (
    <div className="flex flex-col">
      <button type="button" disabled={pending} onClick={() => go("haut")} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700 disabled:opacity-40"><ChevronUp size={15} /></button>
      <button type="button" disabled={pending} onClick={() => go("bas")} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700 disabled:opacity-40"><ChevronDown size={15} /></button>
    </div>
  );
}

export const SupprimerEtapeBtn = ({ id }: { id: string }) => <BoutonSupprimer action={retirerEtape} id={id} confirmation="Retirer ce cours du parcours ?" />;

// ── Bouton supprimer générique ──────────────────────────────

function BoutonSupprimer({ action, id, confirmation }: { action: (id: string) => Promise<{ ok: boolean }>; id: string; confirmation: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button type="button" disabled={pending} title="Supprimer"
      onClick={async () => { if (window.confirm(confirmation)) { setPending(true); await action(id); router.refresh(); } }}
      className="rounded-lg p-1.5 text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 size={14} /></button>
  );
}
