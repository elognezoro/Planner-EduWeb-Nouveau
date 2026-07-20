"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, Upload, Users, Eraser, Settings } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import {
  creerStructure,
  creerCohorte,
  supprimerCohorte,
  ajouterApprenant,
  supprimerApprenant,
  importerApprenantsCSV,
  viderApprenants,
  type EtatForm,
} from "@/lib/formation/actions";
import { appliquerTerme } from "@/lib/cafop-terme";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

const initial: EtatForm = { ok: false };
const inputCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface ApprenantVue {
  id: string;
  nom: string;
  prenoms: string | null;
  email: string | null;
  matricule: string | null;
}
export interface CohorteVue {
  id: string;
  libelle: string;
  anneeDebut: number | null;
  anneeFin: number | null;
  lieu: string | null;
  statut: string;
  apprenants: ApprenantVue[];
}

/** Création d'un centre CAFOP / APFC (admin). */
export function StructureForm({
  type,
  regions,
  terme,
}: {
  type: "cafop" | "apfc";
  regions: { id: string; nom: string }[];
  /** Terme local (CAFOP ou APFC selon `type`) — défaut au nom générique si non fourni. */
  terme?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<EtatForm | null>(null);
  const [nom, setNom] = useState("");
  const [regionId, setRegionId] = useState("");
  const T = (s: string) => (type === "cafop" ? appliquerTerme(s, terme) : appliquerTermeApfc(s, terme));
  // La région est OBLIGATOIRE pour une APFC : c'est elle qui détermine le pays de l'antenne
  // (l'APFC n'a pas de champ « pays » propre). Facultative pour un CAFOP (qui a son propre champ).
  const regionObligatoire = type === "apfc";

  return (
    <div className="space-y-3">
      {msg?.message && <FormAlert ton={msg.ok ? "succes" : "erreur"}>{msg.message}</FormAlert>}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            Nom {type === "cafop" ? T("du CAFOP") : T("de l'APFC")}
          </label>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={inputCls}
            placeholder={type === "cafop" ? T("Ex : CAFOP d'Abidjan") : T("Ex : APFC d'Abidjan")}
          />
        </div>
        <div className="min-w-[12rem]">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            Région {regionObligatoire && <span className="text-red-600">*</span>}
          </label>
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            required={regionObligatoire}
            className={inputCls}
          >
            <option value="">—</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={pending || !nom.trim() || (regionObligatoire && !regionId)}
          onClick={() =>
            start(async () => {
              const r = await creerStructure(type, nom, { regionId: regionId || null });
              setMsg(r);
              if (r.ok) {
                setNom("");
                setRegionId("");
              }
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          <Plus size={15} /> Créer
        </button>
      </div>
      {regionObligatoire && (
        <p className="text-xs text-ink-700/55">{T("La région détermine le pays de l'antenne.")}</p>
      )}
    </div>
  );
}

/** Création d'une cohorte (promotion CAFOP ou session APFC). */
export function CohorteForm({
  type,
  cafopId,
  apfcId,
}: {
  type: "cafop_promotion" | "apfc_session";
  cafopId?: string;
  apfcId?: string;
}) {
  const [etat, action] = useActionState(creerCohorte, initial);
  const estCafop = type === "cafop_promotion";
  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <input type="hidden" name="type" value={type} />
      {cafopId && <input type="hidden" name="cafopId" value={cafopId} />}
      {apfcId && <input type="hidden" name="apfcId" value={apfcId} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            {estCafop ? "Libellé de la promotion" : "Intitulé de la session"}
          </label>
          <input name="libelle" required className={inputCls} placeholder={estCafop ? "Promotion 2025-2027" : "Formation continue — Maths"} />
        </div>
        <div className="w-24">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Année déb.</label>
          <input name="anneeDebut" type="number" className={inputCls} placeholder="2025" />
        </div>
        <div className="w-24">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Année fin</label>
          <input name="anneeFin" type="number" className={inputCls} placeholder="2027" />
        </div>
        <SubmitButton className="w-auto px-6">
          <Plus size={15} /> {estCafop ? "Ajouter la promotion" : "Ajouter la session"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Carte d'une cohorte : roster + ajout + import CSV + suppression (masqués en lecture seule). */
export function CohorteCard({ cohorte, lectureSeule = false }: { cohorte: CohorteVue; lectureSeule?: boolean }) {
  const [pending, start] = useTransition();
  const [etatAjout, actionAjout] = useActionState(ajouterApprenant, initial);
  const [etatImport, actionImport] = useActionState(importerApprenantsCSV, initial);
  const [ouvert, setOuvert] = useState(false);
  // Suppression en DEUX clics (règle projet : jamais de window.confirm) : le 1er clic arme,
  // le 2e confirme ; « Annuler » désarme.
  const [confirmationSuppr, setConfirmationSuppr] = useState(false);

  const annees = [cohorte.anneeDebut, cohorte.anneeFin].filter((a) => a != null).join("–");

  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-forest-900">{cohorte.libelle}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-700/60">
            {annees && <span>{annees}</span>}
            {cohorte.lieu && <span>{cohorte.lieu}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 font-semibold text-forest-800">
              <Users size={11} /> {cohorte.apprenants.length}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${cohorte.statut === "active" ? "bg-forest-100 text-forest-800" : "bg-cream-200 text-ink-700"}`}>
              {cohorte.statut === "active" ? "Active" : "Clôturée"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"
          >
            {ouvert ? "Masquer" : lectureSeule ? "Voir la liste" : "Gérer la liste"}
          </button>
          {!lectureSeule &&
            (confirmationSuppr ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await supprimerCohorte(cohorte.id);
                      setConfirmationSuppr(false);
                    })
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 size={13} /> Confirmer
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmationSuppr(false)}
                  className="inline-flex h-8 items-center rounded-full border border-cream-300 px-3 text-xs font-semibold text-ink-700/70 hover:bg-cream-100 disabled:opacity-50"
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmationSuppr(true)}
                title="Supprimer la cohorte"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            ))}
        </div>
      </div>

      {ouvert && (
        <div className="mt-4 space-y-4 border-t border-cream-100 pt-4">
          {/* Liste */}
          {cohorte.apprenants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs text-ink-700/60">
                    <th className="py-2 pr-3 font-semibold">Nom</th>
                    <th className="px-2 py-2 font-semibold">Prénoms</th>
                    <th className="px-2 py-2 font-semibold">E-mail</th>
                    <th className="px-2 py-2 font-semibold">Matricule</th>
                    {!lectureSeule && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {cohorte.apprenants.map((a) => (
                    <tr key={a.id} className="border-b border-cream-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-forest-900">{a.nom}</td>
                      <td className="px-2 py-2 text-ink-700/80">{a.prenoms ?? "—"}</td>
                      <td className="px-2 py-2 text-ink-700/70">{a.email ?? "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-ink-700/60">{a.matricule ?? "—"}</td>
                      {!lectureSeule && (
                        <td className="py-2 text-center">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => start(async () => void (await supprimerApprenant(a.id)))}
                            className="text-ink-700/40 hover:text-red-600 disabled:opacity-50"
                            aria-label="Retirer l'apprenant"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-700/55">
              {lectureSeule ? "Aucun participant enregistré." : "Aucun apprenant. Ajoutez-en ou importez un CSV."}
            </p>
          )}

          {/* Ajout manuel */}
          {!lectureSeule && (
          <form action={actionAjout} className="flex flex-wrap items-end gap-2">
            {etatAjout.message && !etatAjout.ok && (
              <div className="w-full">
                <FormAlert ton="erreur">{etatAjout.message}</FormAlert>
              </div>
            )}
            <input type="hidden" name="cohorteId" value={cohorte.id} />
            <input name="nom" required placeholder="Nom" className="h-9 w-32 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
            <input name="prenoms" placeholder="Prénoms" className="h-9 w-32 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
            <input name="email" placeholder="E-mail" className="h-9 w-44 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
            <input name="matricule" placeholder="Matricule" className="h-9 w-28 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
            <button type="submit" className="inline-flex h-9 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50">
              <Plus size={13} /> Ajouter
            </button>
          </form>
          )}

          {/* Import CSV Moodle */}
          {!lectureSeule && (
          <form action={actionImport} className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 p-3">
            {etatImport.message && (
              <div className="mb-2">
                <FormAlert ton={etatImport.ok ? "succes" : "erreur"}>{etatImport.message}</FormAlert>
              </div>
            )}
            <input type="hidden" name="cohorteId" value={cohorte.id} />
            <p className="mb-2 text-xs font-semibold text-forest-800">
              <Upload size={13} className="mr-1 inline" /> Import CSV (compatible Moodle)
            </p>
            <p className="mb-2 text-[0.7rem] text-ink-700/60">
              Colonnes reconnues : <code>lastname/nom</code>, <code>firstname/prenoms</code>,{" "}
              <code>email</code>, <code>idnumber/matricule</code>, <code>institution</code>.
            </p>
            <textarea
              name="texte"
              rows={3}
              placeholder={"Ou collez le CSV ici…\nnom,prenoms,email,matricule\nKouassi,Awa,awa@ex.ci,M001"}
              className="mb-2 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input type="file" name="fichier" accept=".csv,text/csv" className="text-xs" />
              <SubmitButton className="w-auto px-5">Importer</SubmitButton>
              <button
                type="button"
                disabled={pending || cohorte.apprenants.length === 0}
                onClick={() => start(async () => void (await viderApprenants(cohorte.id)))}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-semibold text-ink-700/70 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Eraser size={13} /> Vider
              </button>
            </div>
          </form>
          )}
        </div>
      )}
    </div>
  );
}

/** Carte d'un centre dans la liste (admin). */
export function StructureLien({
  base,
  id,
  nom,
  region,
  cohortes,
}: {
  base: string;
  id: string;
  nom: string;
  region: string | null;
  cohortes: number;
}) {
  return (
    <Link
      href={`${base}/${id}`}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-gold-300"
    >
      <div className="min-w-0">
        <p className="font-display text-lg font-bold text-forest-900">{nom}</p>
        <p className="text-xs text-ink-700/60">
          {region ?? "Région non renseignée"} · {cohortes} cohorte(s)
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cream-300 px-3.5 py-1.5 text-xs font-semibold text-forest-800 transition-colors group-hover:border-forest-400 group-hover:bg-forest-50">
        <Settings size={13} /> Configuration
      </span>
    </Link>
  );
}
