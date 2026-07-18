"use client";

/**
 * Caisse & banque (journal recettes/dépenses OHADA simplifié) + Économat (articles, stock, ventes).
 * Deux onglets autonomes, chacun lit ses données depuis les props (page serveur) et écrit via
 * les server actions de "@/lib/finances/actions". Lecture seule si `peutEcrire` est faux.
 */

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle, ArrowUpCircle, Ban, Check, ClipboardList, Download, FileText, Filter,
  History, Landmark, Loader2, Package, PackagePlus, Pencil, Plus, ShoppingCart, Smartphone,
  Wallet, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { ComboboxRecherche } from "@/components/app/combobox-recherche";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
import {
  annulerOperation, enregistrerArticle, enregistrerOperation, mouvementStock,
  type EtatForm,
} from "@/lib/finances/actions";
import {
  LIBELLE_MODE, fcfa,
  type ArticleVue, type EleveVue, type MouvementVue, type OperationVue,
} from "./types";

const initial: EtatForm = { ok: false };
const MODES = Object.keys(LIBELLE_MODE);
const ICONE_MODE: Record<string, typeof Wallet> = {
  especes: Wallet, mobile_money: Smartphone, cheque: FileText, virement: Landmark,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}
function libelleCategorie(code: string): string {
  return CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? "";
}

/* ────────────────────────────  ONGLET TRÉSORERIE  ──────────────────────────── */

function CarteSolde({ mode, recettes, depenses }: { mode: string; recettes: number; depenses: number }) {
  const net = recettes - depenses;
  const Icone = ICONE_MODE[mode] ?? Wallet;
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-forest-900">
        <Icone size={16} className="text-forest-600" /> {LIBELLE_MODE[mode] ?? mode}
      </div>
      <dl className="space-y-1 text-xs text-ink-700/70">
        <div className="flex justify-between"><dt>Recettes</dt><dd className="font-medium text-forest-700">{fcfa(recettes)}</dd></div>
        <div className="flex justify-between"><dt>Dépenses</dt><dd className="font-medium text-red-600">{fcfa(depenses)}</dd></div>
      </dl>
      <p className={`mt-2 border-t border-cream-100 pt-2 text-right font-display text-lg font-bold ${net >= 0 ? "text-forest-800" : "text-red-700"}`}>
        {fcfa(net)}
      </p>
    </div>
  );
}

function BlocSoldes({ soldes }: { soldes: { mode: string; recettes: number; depenses: number }[] }) {
  const parMode = useMemo(
    () => new Map<string, { mode: string; recettes: number; depenses: number }>(soldes.map((s) => [s.mode, s])),
    [soldes],
  );
  return (
    <div>
      <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Wallet size={18} className="text-forest-600" /> Soldes de trésorerie
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MODES.map((m) => {
          const s = parMode.get(m);
          return <CarteSolde key={m} mode={m} recettes={s?.recettes ?? 0} depenses={s?.depenses ?? 0} />;
        })}
      </div>
    </div>
  );
}

function FormulaireOperation({ etablissementId }: { etablissementId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerOperation, initial);
  const [sens, setSens] = useState<"recette" | "depense">("recette");
  const vu = useRef<EtatForm>(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const categories = useMemo(() => CATEGORIES_OHADA.filter((c) => c.sens === sens), [sens]);
  const aujourdHui = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (etat.ok && vu.current !== etat) {
      vu.current = etat;
      formRef.current?.reset();
      setSens("recette");
      router.refresh();
    }
  }, [etat, router]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="sens" value={sens} />
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Plus size={18} className="text-forest-600" /> Nouvelle opération
      </h2>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="flex gap-2">
        <button
          type="button" onClick={() => setSens("recette")}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${sens === "recette" ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-forest-800 hover:bg-forest-50"}`}
        >
          <ArrowUpCircle size={16} /> Recette
        </button>
        <button
          type="button" onClick={() => setSens("depense")}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${sens === "depense" ? "border-red-600 bg-red-600 text-white" : "border-cream-300 bg-white text-red-700 hover:bg-red-50"}`}
        >
          <ArrowDownCircle size={16} /> Dépense
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="op-categorie">Catégorie comptable</Label>
          <Select id="op-categorie" name="categorie" required defaultValue="" key={sens}>
            <option value="" disabled>Sélectionner…</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="op-montant">Montant (F CFA)</Label>
          <Input id="op-montant" name="montant" type="number" min={1} step={1} required />
        </div>
      </div>

      <div>
        <Label htmlFor="op-libelle">Libellé</Label>
        <Input id="op-libelle" name="libelle" required maxLength={200} placeholder="Ex. : Achat de craie, règlement facture SODECI…" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="op-mode">Mode</Label>
          <Select id="op-mode" name="mode" defaultValue="especes">
            {MODES.map((m) => <option key={m} value={m}>{LIBELLE_MODE[m]}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="op-reference">Référence <span className="font-normal text-ink-700/50">(facultatif)</span></Label>
          <Input id="op-reference" name="reference" maxLength={80} placeholder="N° pièce, chèque…" />
        </div>
        <div>
          <Label htmlFor="op-date">Date</Label>
          <Input id="op-date" name="date" type="date" defaultValue={aujourdHui} required />
        </div>
      </div>

      <SubmitButton className="w-auto px-6">
        <Plus size={16} /> Enregistrer l&apos;opération
      </SubmitButton>
    </form>
  );
}

function BoutonAnnulerOperation({ id }: { id: string }) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [motif, setMotif] = useState("");
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function annuler() {
    if (!motif.trim() || pending) return;
    setErreur(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("motif", motif.trim());
      const r = await annulerOperation(initial, fd);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
      else { setConfirmer(false); setMotif(""); router.refresh(); }
    });
  }

  if (!confirmer) {
    return (
      <button type="button" onClick={() => setConfirmer(true)} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
        <Ban size={12} /> Annuler
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif d'annulation…" maxLength={300}
        className="w-48 rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={annuler} disabled={pending || !motif.trim()}
          className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirmer
        </button>
        <button type="button" onClick={() => { setConfirmer(false); setMotif(""); }} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-xs font-medium text-ink-700/70 hover:bg-cream-100">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function JournalOperations({ operations, peutEcrire }: { operations: OperationVue[]; peutEcrire: boolean }) {
  const [filtreSens, setFiltreSens] = useState("tous");
  const [filtreMode, setFiltreMode] = useState("tous");
  const [texte, setTexte] = useState("");

  const filtrees = useMemo(() => {
    const t = texte.trim().toLowerCase();
    return operations.filter((o) => {
      if (filtreSens !== "tous" && o.sens !== filtreSens) return false;
      if (filtreMode !== "tous" && o.mode !== filtreMode) return false;
      if (t) {
        const cible = `${o.libelle} ${o.categorie} ${libelleCategorie(o.categorie)}`.toLowerCase();
        if (!cible.includes(t)) return false;
      }
      return true;
    });
  }, [operations, filtreSens, filtreMode, texte]);

  const totaux = useMemo(() => {
    let recettes = 0, depenses = 0;
    for (const o of filtrees) {
      if (o.annule) continue;
      if (o.sens === "recette") recettes += o.montant; else depenses += o.montant;
    }
    return { recettes, depenses, net: recettes - depenses };
  }, [filtrees]);

  function exporterCsv() {
    const entetes = ["Date", "Sens", "Catégorie", "Libellé", "Montant", "Mode", "Référence", "Statut"];
    const lignes = filtrees.map((o) => [
      formatDate(o.date),
      o.sens === "recette" ? "Recette" : "Dépense",
      `${o.categorie} — ${libelleCategorie(o.categorie)}`,
      o.libelle,
      String(o.montant),
      LIBELLE_MODE[o.mode] ?? o.mode,
      o.reference ?? "",
      o.annule ? "Annulée" : "Active",
    ]);
    const csv = [entetes, ...lignes]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `journal-tresorerie-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <History size={18} className="text-forest-600" /> Journal des opérations
        </h2>
        <button type="button" onClick={exporterCsv} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-forest-50">
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-ink-700/40" />
        <select
          value={filtreSens} onChange={(e) => setFiltreSens(e.target.value)}
          className="h-9 rounded-xl border border-cream-300 bg-white px-2.5 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          <option value="tous">Tous les sens</option>
          <option value="recette">Recettes</option>
          <option value="depense">Dépenses</option>
        </select>
        <select
          value={filtreMode} onChange={(e) => setFiltreMode(e.target.value)}
          className="h-9 rounded-xl border border-cream-300 bg-white px-2.5 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          <option value="tous">Tous les modes</option>
          {MODES.map((m) => <option key={m} value={m}>{LIBELLE_MODE[m]}</option>)}
        </select>
        <input
          value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Rechercher…"
          className="h-9 min-w-[140px] flex-1 rounded-xl border border-cream-300 bg-white px-3 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-700/70">
        <span>Recettes : <strong className="text-forest-700">{fcfa(totaux.recettes)}</strong></span>
        <span>Dépenses : <strong className="text-red-700">{fcfa(totaux.depenses)}</strong></span>
        <span>Solde net : <strong className={totaux.net >= 0 ? "text-forest-800" : "text-red-800"}>{fcfa(totaux.net)}</strong></span>
      </div>

      {filtrees.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucune opération ne correspond à ces filtres.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Date</th>
                <th className="py-1.5 pr-2">Sens</th>
                <th className="py-1.5 pr-2">Catégorie</th>
                <th className="py-1.5 pr-2">Libellé</th>
                <th className="py-1.5 pr-2 text-right">Montant</th>
                <th className="py-1.5 pr-2">Mode</th>
                {peutEcrire && <th className="py-1.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filtrees.map((o) => (
                <tr key={o.id} className={o.annule ? "opacity-60" : ""}>
                  <td className="whitespace-nowrap py-2 pr-2">{formatDate(o.date)}</td>
                  <td className="py-2 pr-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${o.sens === "recette" ? "bg-forest-100 text-forest-800" : "bg-red-100 text-red-700"}`}>
                      {o.sens === "recette" ? "Recette" : "Dépense"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-xs text-ink-700/70">{o.categorie} — {libelleCategorie(o.categorie)}</td>
                  <td className="py-2 pr-2">
                    {o.libelle}
                    {o.annule && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        <Ban size={10} /> Annulée
                      </span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap py-2 pr-2 text-right font-medium ${o.sens === "recette" ? "text-forest-700" : "text-red-700"}`}>
                    {o.sens === "recette" ? "+" : "−"}{fcfa(o.montant)}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-xs text-ink-700/70">{LIBELLE_MODE[o.mode] ?? o.mode}</td>
                  {peutEcrire && (
                    <td className="py-2 text-right">
                      {!o.annule && <BoutonAnnulerOperation id={o.id} />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function OngletTresorerie({
  etablissementId, operations, soldes, peutEcrire,
}: {
  etablissementId: string;
  operations: OperationVue[];
  soldes: { mode: string; recettes: number; depenses: number }[];
  peutEcrire: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card><BlocSoldes soldes={soldes} /></Card>
      {peutEcrire && (
        <Card>
          <FormulaireOperation etablissementId={etablissementId} />
        </Card>
      )}
      <Card>
        <JournalOperations operations={operations} peutEcrire={peutEcrire} />
      </Card>
    </div>
  );
}

/* ────────────────────────────  ONGLET ÉCONOMAT  ──────────────────────────── */

function FormulaireArticle({
  etablissementId, article, onDone,
}: {
  etablissementId: string; article: ArticleVue | null; onDone: () => void;
}) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerArticle, initial);
  const vu = useRef<EtatForm>(initial);
  const idPref = article?.id ?? "new";

  useEffect(() => {
    if (etat.ok && vu.current !== etat) {
      vu.current = etat;
      router.refresh();
      onDone();
    }
  }, [etat, router, onDone]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {article && <input type="hidden" name="id" value={article.id} />}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`art-nom-${idPref}`}>Nom</Label>
          <Input id={`art-nom-${idPref}`} name="nom" required maxLength={120} defaultValue={article?.nom ?? ""} placeholder="Ex. : Cahier 96 pages" />
        </div>
        <div>
          <Label htmlFor={`art-categorie-${idPref}`}>Catégorie <span className="font-normal text-ink-700/50">(facultatif)</span></Label>
          <Input id={`art-categorie-${idPref}`} name="categorie" maxLength={80} defaultValue={article?.categorie ?? ""} placeholder="Ex. : Fournitures" />
        </div>
        <div>
          <Label htmlFor={`art-prixVente-${idPref}`}>Prix de vente (F CFA)</Label>
          <Input id={`art-prixVente-${idPref}`} name="prixVente" type="number" min={1} step={1} required defaultValue={article?.prixVente ?? ""} />
        </div>
        <div>
          <Label htmlFor={`art-prixAchat-${idPref}`}>Prix d&apos;achat <span className="font-normal text-ink-700/50">(facultatif)</span></Label>
          <Input id={`art-prixAchat-${idPref}`} name="prixAchat" type="number" min={1} step={1} defaultValue={article?.prixAchat ?? ""} />
        </div>
        <div>
          <Label htmlFor={`art-seuil-${idPref}`}>Seuil d&apos;alerte de stock</Label>
          <Input id={`art-seuil-${idPref}`} name="seuilAlerte" type="number" min={0} step={1} defaultValue={article?.seuilAlerte ?? 5} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-10 rounded-full border border-cream-300 px-4 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          Annuler
        </button>
        <SubmitButton className="w-auto px-6">
          {article ? <><Pencil size={15} /> Mettre à jour</> : <><PackagePlus size={15} /> Ajouter</>}
        </SubmitButton>
      </div>
    </form>
  );
}

const TITRES_MOUVEMENT: Record<"entree" | "vente" | "ajustement", string> = {
  entree: "Entrée de stock", vente: "Vente", ajustement: "Ajustement d'inventaire",
};
const ICONES_MOUVEMENT = { entree: PackagePlus, vente: ShoppingCart, ajustement: ClipboardList };

function FormulaireMouvement({
  article, type, eleves, onDone,
}: {
  article: ArticleVue; type: "entree" | "vente" | "ajustement"; eleves: EleveVue[]; onDone: () => void;
}) {
  const router = useRouter();
  const [etat, action] = useActionState(mouvementStock, initial);
  const vu = useRef<EtatForm>(initial);
  const [quantite, setQuantite] = useState(type === "ajustement" ? article.stock : 1);
  const [montant, setMontant] = useState<number | undefined>(type === "vente" ? article.prixVente : undefined);
  const [modeAcheteur, setModeAcheteur] = useState<"libre" | "eleve">("libre");
  const Icone = ICONES_MOUVEMENT[type];

  useEffect(() => {
    if (etat.ok && vu.current !== etat) {
      vu.current = etat;
      router.refresh();
      onDone();
    }
  }, [etat, router, onDone]);

  const optionsEleves = useMemo(
    () => eleves.map((e) => ({
      value: e.id,
      label: [e.nom, e.classe, e.matricule].filter(Boolean).join(" · "),
    })),
    [eleves],
  );

  const stockInsuffisant = type === "vente" && quantite > article.stock;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="articleId" value={article.id} />
      <input type="hidden" name="type" value={type} />
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-900">
        <Icone size={15} className="text-forest-600" /> {TITRES_MOUVEMENT[type]} — {article.nom}
      </p>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`mv-qte-${article.id}-${type}`}>{type === "ajustement" ? "Nouveau stock" : "Quantité"}</Label>
          <Input
            id={`mv-qte-${article.id}-${type}`} name="quantite" type="number" min={type === "ajustement" ? 0 : 1} step={1} required
            value={quantite}
            onChange={(e) => {
              const q = Math.max(0, Math.trunc(Number(e.target.value)) || 0);
              setQuantite(q);
              if (type === "vente") setMontant(article.prixVente * q);
            }}
          />
          {stockInsuffisant && <p className="mt-1 text-xs text-red-600">Stock disponible : {article.stock}.</p>}
        </div>

        {(type === "entree" || type === "vente") && (
          <div>
            <Label htmlFor={`mv-montant-${article.id}-${type}`}>
              {type === "vente" ? "Montant (F CFA)" : "Coût d'achat (F CFA)"}
              {type === "entree" && <span className="font-normal text-ink-700/50"> (facultatif)</span>}
            </Label>
            <Input
              id={`mv-montant-${article.id}-${type}`} name="montant" type="number" min={1} step={1}
              required={type === "vente"}
              value={montant ?? ""}
              onChange={(e) => setMontant(e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        )}

        {type === "vente" && (
          <div>
            <Label htmlFor={`mv-mode-${article.id}`}>Mode</Label>
            <Select id={`mv-mode-${article.id}`} name="mode" defaultValue="especes">
              {MODES.map((m) => <option key={m} value={m}>{LIBELLE_MODE[m]}</option>)}
            </Select>
          </div>
        )}
      </div>

      {type === "vente" && (
        <div>
          <Label>Acheteur</Label>
          <div className="mb-2 flex gap-2">
            <button
              type="button" onClick={() => setModeAcheteur("libre")}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${modeAcheteur === "libre" ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-forest-800 hover:bg-forest-50"}`}
            >
              Saisie libre
            </button>
            <button
              type="button" onClick={() => setModeAcheteur("eleve")}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${modeAcheteur === "eleve" ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-forest-800 hover:bg-forest-50"}`}
            >
              Élève
            </button>
          </div>
          {modeAcheteur === "libre" ? (
            <Input name="acheteur" maxLength={120} placeholder="Nom de l'acheteur (facultatif)" />
          ) : (
            <ComboboxRecherche name="eleveId" options={optionsEleves} placeholder="Choisir un élève…" videLabel="— Aucun —" rechercheLabel="Rechercher un élève…" />
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-10 rounded-full border border-cream-300 px-4 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          Annuler
        </button>
        <SubmitButton className="w-auto px-6" disabled={stockInsuffisant}>
          <Icone size={15} /> Valider
        </SubmitButton>
      </div>
    </form>
  );
}

function LigneArticle({
  article, etablissementId, eleves, peutEcrire,
}: {
  article: ArticleVue; etablissementId: string; eleves: EleveVue[]; peutEcrire: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [action, setAction] = useState<"entree" | "vente" | "ajustement" | null>(null);
  const enAlerte = article.stock <= article.seuilAlerte;
  const colSpan = peutEcrire ? 7 : 6;

  return (
    <>
      <tr className={!article.actif ? "opacity-50" : ""}>
        <td className="py-2 pr-2 font-medium text-forest-900">{article.nom}</td>
        <td className="py-2 pr-2 text-xs text-ink-700/70">{article.categorie ?? "—"}</td>
        <td className="py-2 pr-2 text-right">{fcfa(article.prixVente)}</td>
        <td className="py-2 pr-2 text-right text-ink-700/70">{article.prixAchat != null ? fcfa(article.prixAchat) : "—"}</td>
        <td className="py-2 pr-2 text-right">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enAlerte ? "bg-red-100 text-red-700" : "bg-cream-200 text-forest-800"}`}>
            {article.stock}
          </span>
        </td>
        <td className="py-2 pr-2 text-center">
          {article.actif ? <Check size={15} className="mx-auto text-forest-600" /> : <X size={15} className="mx-auto text-ink-700/40" />}
        </td>
        {peutEcrire && (
          <td className="py-2 text-right">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button" title="Modifier"
                onClick={() => { setAction(null); setEdition((v) => !v); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-600 hover:bg-forest-50"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button" onClick={() => { setEdition(false); setAction((a) => (a === "entree" ? null : "entree")); }}
                className={`rounded-full border px-2 py-1 text-[11px] font-medium ${action === "entree" ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 text-forest-800 hover:bg-forest-50"}`}
              >
                Entrée
              </button>
              <button
                type="button" onClick={() => { setEdition(false); setAction((a) => (a === "vente" ? null : "vente")); }}
                className={`rounded-full border px-2 py-1 text-[11px] font-medium ${action === "vente" ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 text-forest-800 hover:bg-forest-50"}`}
              >
                Vendre
              </button>
              <button
                type="button" onClick={() => { setEdition(false); setAction((a) => (a === "ajustement" ? null : "ajustement")); }}
                className={`rounded-full border px-2 py-1 text-[11px] font-medium ${action === "ajustement" ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 text-forest-800 hover:bg-forest-50"}`}
              >
                Inventaire
              </button>
            </div>
          </td>
        )}
      </tr>
      {edition && (
        <tr>
          <td colSpan={colSpan} className="bg-cream-50/50 px-2 py-3">
            <FormulaireArticle etablissementId={etablissementId} article={article} onDone={() => setEdition(false)} />
          </td>
        </tr>
      )}
      {action && (
        <tr>
          <td colSpan={colSpan} className="bg-cream-50/50 px-2 py-3">
            <FormulaireMouvement article={article} type={action} eleves={eleves} onDone={() => setAction(null)} />
          </td>
        </tr>
      )}
    </>
  );
}

function BlocArticles({
  etablissementId, articles, eleves, peutEcrire,
}: {
  etablissementId: string; articles: ArticleVue[]; eleves: EleveVue[]; peutEcrire: boolean;
}) {
  const [nouveauOuvert, setNouveauOuvert] = useState(false);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Package size={18} className="text-forest-600" /> Articles de l&apos;économat
        </h2>
        {peutEcrire && (
          <button
            type="button" onClick={() => setNouveauOuvert((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
          >
            <PackagePlus size={14} /> {nouveauOuvert ? "Fermer" : "Ajouter un article"}
          </button>
        )}
      </div>

      {peutEcrire && nouveauOuvert && (
        <div className="mb-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
          <FormulaireArticle etablissementId={etablissementId} article={null} onDone={() => setNouveauOuvert(false)} />
        </div>
      )}

      {articles.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucun article enregistré.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Nom</th>
                <th className="py-1.5 pr-2">Catégorie</th>
                <th className="py-1.5 pr-2 text-right">Prix vente</th>
                <th className="py-1.5 pr-2 text-right">Prix achat</th>
                <th className="py-1.5 pr-2 text-right">Stock</th>
                <th className="py-1.5 pr-2 text-center">Actif</th>
                {peutEcrire && <th className="py-1.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {articles.map((a) => (
                <LigneArticle key={a.id} article={a} etablissementId={etablissementId} eleves={eleves} peutEcrire={peutEcrire} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const BADGE_MOUVEMENT: Record<string, { libelle: string; classe: string }> = {
  entree: { libelle: "Entrée", classe: "bg-forest-100 text-forest-800" },
  vente: { libelle: "Vente", classe: "bg-gold-100 text-gold-800" },
  ajustement: { libelle: "Inventaire", classe: "bg-cream-200 text-forest-800" },
};

function HistoriqueMouvements({ mouvements }: { mouvements: MouvementVue[] }) {
  const totalVentes = useMemo(
    () => mouvements.filter((m) => m.type === "vente").reduce((s, m) => s + (m.montant ?? 0), 0),
    [mouvements],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <History size={18} className="text-forest-600" /> Historique des mouvements
        </h2>
        <span className="text-xs text-ink-700/60">Total des ventes : <strong className="text-forest-800">{fcfa(totalVentes)}</strong></span>
      </div>
      {mouvements.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucun mouvement enregistré.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Date</th>
                <th className="py-1.5 pr-2">Article</th>
                <th className="py-1.5 pr-2">Type</th>
                <th className="py-1.5 pr-2 text-right">Quantité</th>
                <th className="py-1.5 pr-2 text-right">Montant</th>
                <th className="py-1.5">Acheteur / mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {mouvements.map((m) => {
                const b = BADGE_MOUVEMENT[m.type] ?? BADGE_MOUVEMENT.ajustement;
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap py-2 pr-2">{formatDate(m.date)}</td>
                    <td className="py-2 pr-2 font-medium text-forest-900">{m.articleNom}</td>
                    <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.classe}`}>{b.libelle}</span></td>
                    <td className="py-2 pr-2 text-right">{m.quantite}</td>
                    <td className="py-2 pr-2 text-right">{m.montant != null ? fcfa(m.montant) : "—"}</td>
                    <td className="py-2 text-xs text-ink-700/70">
                      {[m.acheteur, m.mode ? (LIBELLE_MODE[m.mode] ?? m.mode) : null].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function OngletEconomat({
  etablissementId, articles, mouvements, eleves, peutEcrire,
}: {
  etablissementId: string;
  articles: ArticleVue[];
  mouvements: MouvementVue[];
  eleves: EleveVue[];
  peutEcrire: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <BlocArticles etablissementId={etablissementId} articles={articles} eleves={eleves} peutEcrire={peutEcrire} />
      </Card>
      <Card>
        <HistoriqueMouvements mouvements={mouvements} />
      </Card>
    </div>
  );
}
