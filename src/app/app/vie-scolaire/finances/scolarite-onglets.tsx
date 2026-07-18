"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  BadgePercent,
  Check,
  Download,
  ListChecks,
  Loader2,
  Pencil,
  PlusCircle,
  Power,
  Printer,
  Receipt,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";
import {
  enregistrerFrais,
  basculerFrais,
  accorderRemise,
  supprimerRemise,
  encaisserPaiement,
  annulerPaiement,
  type EtatForm,
} from "@/lib/finances/actions";
import { LIBELLE_MODE, fcfa, type FraisVue, type EleveVue, type PaiementVue, type RemiseVue, type ImpayeVue } from "./types";

const INITIAL: EtatForm = { ok: false };

/**
 * En-tête officiel simplifié pour le reçu imprimable — sous-ensemble compatible avec
 * `EnteteEtablissement` (cf. finances-vue.tsx / EtablissementEnTete) : la page appelante peut
 * transmettre directement son objet d'en-tête complet, seuls ces 4 champs sont utilisés ici.
 */
export interface EnteteFinances {
  nom: string;
  pays: string | null;
  ministere: string | null;
  anneeScolaire: string | null;
}

// ────────────────────────────────────────────────────────────────────────
//  Nombre en toutes lettres (français, entiers < 1 000 000 000)
// ────────────────────────────────────────────────────────────────────────

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES: Record<number, string> = {
  2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante", 8: "quatre-vingt",
};

function deuxChiffresEnLettres(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) {
    const base = d === 7 ? "soixante" : "quatre-vingt";
    const reste = UNITES[10 + u];
    return u === 1 && d === 7 ? `${base} et ${reste}` : `${base}-${reste}`;
  }
  const mot = DIZAINES[d];
  if (u === 0) return d === 8 ? `${mot}s` : mot;
  if (u === 1 && d !== 8) return `${mot} et un`;
  return `${mot}-${UNITES[u]}`;
}

function troisChiffresEnLettres(n: number): string {
  const centaines = Math.floor(n / 100);
  const reste = n % 100;
  let mot = "";
  if (centaines > 0) {
    mot = centaines === 1 ? "cent" : `${UNITES[centaines]} cent`;
    if (reste === 0 && centaines > 1) mot += "s";
    if (reste > 0) mot += ` ${deuxChiffresEnLettres(reste)}`;
  } else if (reste > 0) {
    mot = deuxChiffresEnLettres(reste);
  }
  return mot;
}

/** Convertit un entier positif (< 1 milliard) en toutes lettres françaises, pour les reçus imprimables. */
export function nombreEnLettres(valeur: number): string {
  const n = Math.trunc(Math.abs(valeur));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "zéro";
  if (n >= 1_000_000_000) return String(n);

  const millions = Math.floor(n / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const unites = n % 1000;

  const parties: string[] = [];
  if (millions > 0) parties.push(millions === 1 ? "un million" : `${troisChiffresEnLettres(millions)} millions`);
  if (milliers > 0) parties.push(milliers === 1 ? "mille" : `${troisChiffresEnLettres(milliers)} mille`);
  if (unites > 0 || parties.length === 0) parties.push(troisChiffresEnLettres(unites));
  return parties.join(" ").trim();
}

const capitaliser = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Déclenche `effet` une seule fois lorsque `etat` (résultat d'un useActionState) devient `ok`,
 * sans passer par useEffect — l'ajustement d'état a lieu pendant le rendu (motif React officiel
 * pour « adjusting state when a prop/value changes »), ce qui évite les rendus en cascade.
 */
function useApresSucces(etat: EtatForm, effet: () => void) {
  const [etatVu, setEtatVu] = useState(etat);
  if (etat !== etatVu) {
    setEtatVu(etat);
    if (etat.ok) effet();
  }
}

// ────────────────────────────────────────────────────────────────────────
//  Sélecteur d'élève recherchable (nom / classe / matricule)
// ────────────────────────────────────────────────────────────────────────

function libelleEleve(e: EleveVue) {
  return `${e.nom}${e.classe ? " — " + e.classe : ""}`;
}

function SelecteurEleve({
  eleves,
  valeur,
  onChange,
  name,
}: {
  eleves: EleveVue[];
  valeur: string;
  onChange: (id: string) => void;
  name: string;
}) {
  const eleveActuel = useMemo(() => eleves.find((e) => e.id === valeur) ?? null, [eleves, valeur]);
  const [recherche, setRecherche] = useState(eleveActuel ? libelleEleve(eleveActuel) : "");
  const [ouvert, setOuvert] = useState(false);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = !q
      ? eleves
      : eleves.filter(
          (e) =>
            e.nom.toLowerCase().includes(q) ||
            (e.matricule ?? "").toLowerCase().includes(q) ||
            (e.classe ?? "").toLowerCase().includes(q),
        );
    return base.slice(0, 30);
  }, [eleves, recherche]);

  function choisir(e: EleveVue) {
    onChange(e.id);
    setRecherche(libelleEleve(e));
    setOuvert(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={valeur} />
      <Input
        value={recherche}
        placeholder="Rechercher un élève (nom, classe, matricule)…"
        autoComplete="off"
        onFocus={() => setOuvert(true)}
        onChange={(e) => {
          setRecherche(e.target.value);
          if (valeur) onChange("");
          setOuvert(true);
        }}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
      />
      {ouvert && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-cream-200 bg-white p-1 shadow-soft">
          {filtres.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-700/55">Aucun élève trouvé.</p>
          ) : (
            filtres.map((e) => (
              <button
                key={e.id}
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => choisir(e)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-forest-50"
              >
                <span className="font-medium text-forest-900">{e.nom}</span>
                <span className="text-xs text-ink-700/55">{[e.classe, e.matricule].filter(Boolean).join(" · ")}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Onglet Scolarité : barème des frais, remises & bourses, impayés
// ────────────────────────────────────────────────────────────────────────

type SousOngletScolarite = "bareme" | "remises" | "impayes";

export function OngletScolarite({
  etablissementId,
  frais,
  remises,
  impayes,
  eleves,
  niveaux,
  peutEcrire,
}: {
  etablissementId: string;
  frais: FraisVue[];
  remises: RemiseVue[];
  impayes: ImpayeVue[];
  eleves: EleveVue[];
  niveaux: { id: string; nom: string }[];
  peutEcrire: boolean;
}) {
  const [sousOnglet, setSousOnglet] = useState<SousOngletScolarite>("bareme");
  const onglets: { cle: SousOngletScolarite; libelle: string; Icone: typeof ListChecks; badge?: number }[] = [
    { cle: "bareme", libelle: "Barème des frais", Icone: ListChecks },
    { cle: "remises", libelle: "Remises & bourses", Icone: BadgePercent },
    { cle: "impayes", libelle: "Impayés", Icone: AlertTriangle, badge: impayes.length || undefined },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft">
        {onglets.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setSousOnglet(o.cle)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors ${
              sousOnglet === o.cle ? "bg-forest-800 text-cream-50" : "text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <o.Icone size={15} /> {o.libelle}
            {!!o.badge && <span className="ml-1 rounded-full bg-gold-500 px-1.5 text-xs font-bold text-white">{o.badge}</span>}
          </button>
        ))}
      </div>

      {sousOnglet === "bareme" && (
        <Card>
          <BlocBareme etablissementId={etablissementId} frais={frais} niveaux={niveaux} peutEcrire={peutEcrire} />
        </Card>
      )}
      {sousOnglet === "remises" && (
        <Card>
          <BlocRemises etablissementId={etablissementId} remises={remises} frais={frais} eleves={eleves} peutEcrire={peutEcrire} />
        </Card>
      )}
      {sousOnglet === "impayes" && (
        <Card>
          <BlocImpayes impayes={impayes} />
        </Card>
      )}
    </div>
  );
}

// ── (a) Barème des frais ──

type TrancheEdit = { libelle: string; montant: string; dateLimite: string };

function BlocBareme({
  etablissementId,
  frais,
  niveaux,
  peutEcrire,
}: {
  etablissementId: string;
  frais: FraisVue[];
  niveaux: { id: string; nom: string }[];
  peutEcrire: boolean;
}) {
  const [edition, setEdition] = useState<FraisVue | null>(null);
  const [afficherForm, setAfficherForm] = useState(false);

  return (
    <div className="space-y-5">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <ListChecks size={18} className="text-forest-600" /> Barème des frais
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
              <th className="py-1.5 pr-2">Libellé</th>
              <th className="py-1.5 pr-2">Niveau</th>
              <th className="py-1.5 pr-2 text-right">Montant</th>
              <th className="py-1.5 pr-2">Échéancier</th>
              <th className="py-1.5 pr-2">Caractère</th>
              <th className="py-1.5 pr-2">État</th>
              {peutEcrire && <th className="py-1.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {frais.length === 0 ? (
              <tr>
                <td colSpan={peutEcrire ? 7 : 6} className="py-4 text-center text-ink-700/55">
                  Aucun frais défini.
                </td>
              </tr>
            ) : (
              frais.map((f) => (
                <LigneFrais key={f.id} frais={f} peutEcrire={peutEcrire} onModifier={() => { setEdition(f); setAfficherForm(true); }} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {peutEcrire && (
        <div>
          {!afficherForm ? (
            <button
              type="button"
              onClick={() => { setEdition(null); setAfficherForm(true); }}
              className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"
            >
              <PlusCircle size={16} /> Ajouter un frais
            </button>
          ) : (
            <div className="rounded-2xl border border-cream-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-forest-900">
                  {edition ? `Modifier « ${edition.libelle} »` : "Nouveau frais"}
                </h3>
                <button type="button" onClick={() => setAfficherForm(false)} className="text-xs font-medium text-ink-700/60 hover:underline">
                  Fermer
                </button>
              </div>
              <FormulaireFrais
                key={edition?.id ?? "nouveau"}
                etablissementId={etablissementId}
                niveaux={niveaux}
                fraisEnEdition={edition}
                onSuccess={() => { setAfficherForm(false); setEdition(null); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LigneFrais({ frais, peutEcrire, onModifier }: { frais: FraisVue; peutEcrire: boolean; onModifier: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function basculer() {
    setErreur(null);
    startTransition(async () => {
      const r = await basculerFrais(frais.id, !frais.actif);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
      setConfirmer(false);
    });
  }

  return (
    <tr>
      <td className="py-2 pr-2 align-top font-medium text-forest-900">{frais.libelle}</td>
      <td className="py-2 pr-2 align-top">{frais.niveauNom ?? "Tous"}</td>
      <td className="py-2 pr-2 align-top text-right">{fcfa(frais.montant)}</td>
      <td className="py-2 pr-2 align-top">
        {frais.tranches.length === 0 ? (
          <span className="text-ink-700/50">Versement unique</span>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-ink-700/70">
            {frais.tranches.map((t, i) => (
              <li key={i}>
                {t.libelle} — {fcfa(t.montant)}
                {t.dateLimite ? ` (avant le ${t.dateLimite})` : ""}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-2 pr-2 align-top">{frais.obligatoire ? "Obligatoire" : "Facultatif"}</td>
      <td className="py-2 pr-2 align-top">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${frais.actif ? "bg-forest-100 text-forest-800" : "bg-cream-200 text-ink-700/60"}`}>
          {frais.actif ? "Actif" : "Désactivé"}
        </span>
      </td>
      {peutEcrire && (
        <td className="py-2 align-top text-right whitespace-nowrap">
          {erreur && <span className="mr-1.5 text-xs text-red-600">{erreur}</span>}
          <button type="button" onClick={onModifier} title="Modifier" className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50">
            <Pencil size={13} />
          </button>
          {confirmer ? (
            <span className="inline-flex items-center gap-1">
              <button type="button" onClick={basculer} disabled={pending} title="Confirmer" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50">
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button type="button" onClick={() => setConfirmer(false)} title="Annuler" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
                <X size={13} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmer(true)}
              title={frais.actif ? "Désactiver" : "Réactiver"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/60 hover:bg-cream-100"
            >
              <Power size={13} className={frais.actif ? "" : "opacity-40"} />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function EditeurTranches({ tranches, onChange }: { tranches: TrancheEdit[]; onChange: (t: TrancheEdit[]) => void }) {
  function maj(i: number, champ: keyof TrancheEdit, val: string) {
    onChange(tranches.map((t, idx) => (idx === i ? { ...t, [champ]: val } : t)));
  }
  function ajouter() {
    if (tranches.length >= 12) return;
    onChange([...tranches, { libelle: "", montant: "", dateLimite: "" }]);
  }
  function retirer(i: number) {
    onChange(tranches.filter((_, idx) => idx !== i));
  }
  const somme = tranches.reduce((s, t) => s + (Number(t.montant) || 0), 0);

  return (
    <div className="space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Échéancier (facultatif)</p>
        <button type="button" onClick={ajouter} className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:underline">
          <PlusCircle size={14} /> Ajouter une tranche
        </button>
      </div>
      {tranches.length === 0 ? (
        <p className="text-xs text-ink-700/55">Aucune tranche : le frais sera exigible en un seul versement.</p>
      ) : (
        <>
          {tranches.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_8rem_auto] items-center gap-2">
              <input
                value={t.libelle}
                onChange={(e) => maj(i, "libelle", e.target.value)}
                placeholder={`Tranche ${i + 1}`}
                className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
              <input
                value={t.montant}
                onChange={(e) => maj(i, "montant", e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Montant"
                inputMode="numeric"
                className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
              <input
                type="date"
                value={t.dateLimite}
                onChange={(e) => maj(i, "dateLimite", e.target.value)}
                className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
              <button type="button" onClick={() => retirer(i)} title="Retirer la tranche" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <p className="text-xs text-ink-700/55">
            Somme des tranches : <strong>{fcfa(somme)}</strong> — la somme des tranches doit égaler le montant total du frais.
          </p>
        </>
      )}
    </div>
  );
}

function FormulaireFrais({
  etablissementId,
  niveaux,
  fraisEnEdition,
  onSuccess,
}: {
  etablissementId: string;
  niveaux: { id: string; nom: string }[];
  fraisEnEdition: FraisVue | null;
  onSuccess: () => void;
}) {
  const [etat, action] = useActionState(enregistrerFrais, INITIAL);
  const [tranches, setTranches] = useState<TrancheEdit[]>(
    (fraisEnEdition?.tranches ?? []).map((t) => ({ libelle: t.libelle, montant: String(t.montant), dateLimite: t.dateLimite ?? "" })),
  );

  useApresSucces(etat, onSuccess);

  const trancheJson = JSON.stringify(
    tranches
      .filter((t) => t.libelle.trim() && Number(t.montant) > 0)
      .map((t) => ({ libelle: t.libelle.trim(), montant: Number(t.montant), ...(t.dateLimite ? { dateLimite: t.dateLimite } : {}) })),
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="id" value={fraisEnEdition?.id ?? ""} />
      <input type="hidden" name="tranches" value={trancheJson} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="libelle-frais">Libellé</Label>
          <Input id="libelle-frais" name="libelle" defaultValue={fraisEnEdition?.libelle ?? ""} required maxLength={120} placeholder="Ex. : Scolarité, Cantine, Inscription…" />
        </div>
        <div>
          <Label htmlFor="montant-frais">Montant total (FCFA)</Label>
          <Input id="montant-frais" name="montant" defaultValue={fraisEnEdition?.montant ?? ""} required inputMode="numeric" placeholder="Ex. : 150000" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="niveauId">Niveau concerné</Label>
          <Select id="niveauId" name="niveauId" defaultValue={fraisEnEdition?.niveauId ?? ""}>
            <option value="">Tous les niveaux</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.nom}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="obligatoire">Caractère</Label>
          <Select id="obligatoire" name="obligatoire" defaultValue={fraisEnEdition?.obligatoire === false ? "non" : "oui"}>
            <option value="oui">Obligatoire</option>
            <option value="non">Facultatif</option>
          </Select>
        </div>
      </div>

      <EditeurTranches tranches={tranches} onChange={setTranches} />

      <SubmitButton className="w-auto px-6">{fraisEnEdition ? "Enregistrer les modifications" : "Ajouter au barème"}</SubmitButton>
    </form>
  );
}

// ── (b) Remises & bourses ──

function BlocRemises({
  etablissementId,
  remises,
  frais,
  eleves,
  peutEcrire,
}: {
  etablissementId: string;
  remises: RemiseVue[];
  frais: FraisVue[];
  eleves: EleveVue[];
  peutEcrire: boolean;
}) {
  return (
    <div className="space-y-5">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <BadgePercent size={18} className="text-forest-600" /> Remises & bourses
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
              <th className="py-1.5 pr-2">Élève</th>
              <th className="py-1.5 pr-2">Type</th>
              <th className="py-1.5 pr-2">Libellé</th>
              <th className="py-1.5 pr-2 text-right">Valeur</th>
              {peutEcrire && <th className="py-1.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {remises.length === 0 ? (
              <tr>
                <td colSpan={peutEcrire ? 5 : 4} className="py-4 text-center text-ink-700/55">
                  Aucune remise ni bourse accordée.
                </td>
              </tr>
            ) : (
              remises.map((r) => <LigneRemise key={r.id} remise={r} peutEcrire={peutEcrire} />)
            )}
          </tbody>
        </table>
      </div>
      {peutEcrire && <FormulaireRemise etablissementId={etablissementId} frais={frais} eleves={eleves} />}
    </div>
  );
}

function LigneRemise({ remise, peutEcrire }: { remise: RemiseVue; peutEcrire: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function retirer() {
    setErreur(null);
    startTransition(async () => {
      const r = await supprimerRemise(remise.id);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
      setConfirmer(false);
    });
  }

  return (
    <tr>
      <td className="py-2 pr-2 font-medium text-forest-900">{remise.eleveNom}</td>
      <td className="py-2 pr-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${remise.type === "bourse" ? "bg-gold-100 text-gold-800" : "bg-forest-100 text-forest-800"}`}>
          {remise.type === "bourse" ? "Bourse" : "Remise"}
        </span>
      </td>
      <td className="py-2 pr-2">{remise.libelle}</td>
      <td className="py-2 pr-2 text-right">{remise.pourcentage != null ? `${remise.pourcentage} %` : fcfa(remise.montant ?? 0)}</td>
      {peutEcrire && (
        <td className="py-2 text-right whitespace-nowrap">
          {erreur && <span className="mr-1.5 text-xs text-red-600">{erreur}</span>}
          {confirmer ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs font-medium text-red-700">Retirer ?</span>
              <button type="button" onClick={retirer} disabled={pending} title="Confirmer" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50">
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button type="button" onClick={() => setConfirmer(false)} title="Annuler" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
                <X size={13} />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmer(true)} title="Retirer" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/60 hover:bg-red-50">
              <Trash2 size={13} />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function FormulaireRemise({ etablissementId, frais, eleves }: { etablissementId: string; frais: FraisVue[]; eleves: EleveVue[] }) {
  const [etat, action] = useActionState(accorderRemise, INITIAL);
  const [eleveId, setEleveId] = useState("");
  const [modeValeur, setModeValeur] = useState<"montant" | "pourcentage">("montant");
  const [resetKey, setResetKey] = useState(0);

  useApresSucces(etat, () => {
    setEleveId("");
    setModeValeur("montant");
    setResetKey((k) => k + 1);
  });

  return (
    <div className="rounded-2xl border border-cream-200 p-4">
      <h3 className="mb-3 font-display text-sm font-bold text-forest-900">Accorder une remise ou une bourse</h3>
      <form key={resetKey} action={action} className="space-y-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

        <div>
          <Label>Élève</Label>
          <SelecteurEleve eleves={eleves} valeur={eleveId} onChange={setEleveId} name="eleveId" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="type-remise">Type</Label>
            <Select id="type-remise" name="type" defaultValue="remise">
              <option value="remise">Remise</option>
              <option value="bourse">Bourse</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="fraisId-remise">Frais lié (facultatif)</Label>
            <Select id="fraisId-remise" name="fraisId" defaultValue="">
              <option value="">— Remise globale —</option>
              {frais.map((f) => (
                <option key={f.id} value={f.id}>{f.libelle}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="libelle-remise">Libellé</Label>
          <Input id="libelle-remise" name="libelle" maxLength={120} placeholder="Ex. : Remise fratrie, Bourse d'excellence…" />
        </div>

        <div>
          <Label>Valeur</Label>
          <div className="mb-2 flex w-fit gap-1.5 rounded-full border border-cream-200 bg-cream-50 p-1">
            <button
              type="button"
              onClick={() => setModeValeur("montant")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${modeValeur === "montant" ? "bg-forest-800 text-cream-50" : "text-ink-700/70"}`}
            >
              Montant fixe
            </button>
            <button
              type="button"
              onClick={() => setModeValeur("pourcentage")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${modeValeur === "pourcentage" ? "bg-forest-800 text-cream-50" : "text-ink-700/70"}`}
            >
              Pourcentage
            </button>
          </div>
          {modeValeur === "montant" ? (
            <Input name="montant" inputMode="numeric" placeholder="Ex. : 10000" />
          ) : (
            <Input name="pourcentage" inputMode="numeric" placeholder="Ex. : 50" />
          )}
        </div>

        <SubmitButton className="w-auto px-6">
          <BadgePercent size={16} /> Accorder
        </SubmitButton>
      </form>
    </div>
  );
}

// ── (c) Impayés ──

function BlocImpayes({ impayes }: { impayes: ImpayeVue[] }) {
  const [filtreClasse, setFiltreClasse] = useState("");
  const classes = useMemo(
    () => Array.from(new Set(impayes.map((i) => i.classe).filter((c): c is string => !!c))).sort(),
    [impayes],
  );
  const filtres = filtreClasse ? impayes.filter((i) => i.classe === filtreClasse) : impayes;
  const totaux = filtres.reduce(
    (acc, i) => ({ du: acc.du + i.du, remise: acc.remise + i.remise, paye: acc.paye + i.paye, reste: acc.reste + i.reste }),
    { du: 0, remise: 0, paye: 0, reste: 0 },
  );

  function exporterCsv() {
    const entetes = ["Élève", "Classe", "Dû", "Remise", "Payé", "Reste"];
    const lignes = filtres.map((i) => [i.eleveNom, i.classe ?? "", i.du, i.remise, i.paye, i.reste]);
    const contenu = [entetes, ...lignes].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impayes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <AlertTriangle size={18} className="text-forest-600" /> Impayés
        </h2>
        <div className="flex items-center gap-2">
          <Select value={filtreClasse} onChange={(e) => setFiltreClasse(e.target.value)} className="w-auto">
            <option value="">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <button
            type="button"
            onClick={exporterCsv}
            disabled={filtres.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-40"
          >
            <Download size={14} /> Exporter en CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
              <th className="py-1.5 pr-2">Élève</th>
              <th className="py-1.5 pr-2">Classe</th>
              <th className="py-1.5 pr-2 text-right">Dû</th>
              <th className="py-1.5 pr-2 text-right">Remises</th>
              <th className="py-1.5 pr-2 text-right">Payé</th>
              <th className="py-1.5 text-right">Reste</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {filtres.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-ink-700/55">Aucun impayé.</td>
              </tr>
            ) : (
              filtres.map((i) => (
                <tr key={i.eleveId}>
                  <td className="py-2 pr-2 font-medium text-forest-900">{i.eleveNom}</td>
                  <td className="py-2 pr-2">{i.classe ?? "—"}</td>
                  <td className="py-2 pr-2 text-right">{fcfa(i.du)}</td>
                  <td className="py-2 pr-2 text-right">{fcfa(i.remise)}</td>
                  <td className="py-2 pr-2 text-right">{fcfa(i.paye)}</td>
                  <td className="py-2 text-right font-bold text-red-600">{fcfa(i.reste)}</td>
                </tr>
              ))
            )}
          </tbody>
          {filtres.length > 0 && (
            <tfoot>
              <tr className="border-t border-cream-200 font-bold text-forest-900">
                <td className="py-2 pr-2" colSpan={2}>Total général</td>
                <td className="py-2 pr-2 text-right">{fcfa(totaux.du)}</td>
                <td className="py-2 pr-2 text-right">{fcfa(totaux.remise)}</td>
                <td className="py-2 pr-2 text-right">{fcfa(totaux.paye)}</td>
                <td className="py-2 text-right text-red-600">{fcfa(totaux.reste)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Onglet Paiements : encaissement, journal, reçu imprimable, annulation
// ────────────────────────────────────────────────────────────────────────

export function OngletPaiements({
  etablissementId,
  paiements,
  frais,
  eleves,
  entete,
  peutEcrire,
}: {
  etablissementId: string;
  paiements: PaiementVue[];
  frais: FraisVue[];
  eleves: EleveVue[];
  entete: EnteteFinances;
  peutEcrire: boolean;
}) {
  return (
    <div className="space-y-6">
      {peutEcrire && (
        <Card>
          <h2 className="mb-4 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Receipt size={18} className="text-forest-600" /> Encaisser un paiement
          </h2>
          <FormulaireEncaisser etablissementId={etablissementId} frais={frais} eleves={eleves} />
        </Card>
      )}
      <Card>
        <h2 className="mb-4 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ReceiptText size={18} className="text-forest-600" /> Journal des paiements
          <span className="text-xs font-normal text-ink-700/55">({paiements.length})</span>
        </h2>
        {paiements.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun encaissement enregistré.</p>
        ) : (
          <JournalPaiements paiements={paiements} entete={entete} peutEcrire={peutEcrire} />
        )}
      </Card>
    </div>
  );
}

type OptionFrais = { valeur: string; libelle: string; fraisId: string; montant: number; libelleFrais: string };

function optionsFrais(frais: FraisVue[]): OptionFrais[] {
  const opts: OptionFrais[] = [];
  for (const f of frais) {
    if (!f.actif) continue;
    if (f.tranches.length === 0) {
      opts.push({
        valeur: `${f.id}::-1`,
        libelle: `${f.libelle}${f.niveauNom ? " — " + f.niveauNom : ""} (${fcfa(f.montant)})`,
        fraisId: f.id,
        montant: f.montant,
        libelleFrais: f.libelle,
      });
    } else {
      f.tranches.forEach((t, idx) => {
        opts.push({
          valeur: `${f.id}::${idx}`,
          libelle: `${f.libelle} — ${t.libelle} (${fcfa(t.montant)})`,
          fraisId: f.id,
          montant: t.montant,
          libelleFrais: `${f.libelle} — ${t.libelle}`,
        });
      });
    }
  }
  return opts;
}

function FormulaireEncaisser({ etablissementId, frais, eleves }: { etablissementId: string; frais: FraisVue[]; eleves: EleveVue[] }) {
  const [etat, action] = useActionState(encaisserPaiement, INITIAL);
  const [eleveId, setEleveId] = useState("");
  const [fraisId, setFraisId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const opts = useMemo(() => optionsFrais(frais), [frais]);

  useApresSucces(etat, () => {
    setEleveId("");
    setFraisId("");
    setLibelle("");
    setMontant("");
    setResetKey((k) => k + 1);
  });

  function choisirOption(valeur: string) {
    const opt = opts.find((o) => o.valeur === valeur);
    if (opt) {
      setFraisId(opt.fraisId);
      setLibelle(opt.libelleFrais);
      setMontant(String(opt.montant));
    } else {
      setFraisId("");
    }
  }

  return (
    <form key={resetKey} action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="fraisId" value={fraisId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div>
        <Label>Élève</Label>
        <SelecteurEleve eleves={eleves} valeur={eleveId} onChange={setEleveId} name="eleveId" />
      </div>

      <div>
        <Label htmlFor="fraisSelect">Frais / tranche</Label>
        <Select id="fraisSelect" defaultValue="" onChange={(e) => choisirOption(e.target.value)}>
          <option value="">— Saisie libre —</option>
          {opts.map((o) => (
            <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="libelle-paiement">Libellé</Label>
          <Input id="libelle-paiement" name="libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} required maxLength={160} placeholder="Ex. : Scolarité — 1ère tranche" />
        </div>
        <div>
          <Label htmlFor="montant-paiement">Montant (FCFA)</Label>
          <Input id="montant-paiement" name="montant" value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ""))} required inputMode="numeric" placeholder="Ex. : 25000" />
        </div>
      </div>

      <ChampsModeEtDate />

      <SubmitButton className="w-auto px-6">
        <Receipt size={16} /> Encaisser
      </SubmitButton>
    </form>
  );
}

function ChampsModeEtDate() {
  const [mode, setMode] = useState("especes");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <Label htmlFor="mode-paiement">Mode de paiement</Label>
        <Select id="mode-paiement" name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          {Object.entries(LIBELLE_MODE).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>
      {mode !== "especes" && (
        <div>
          <Label htmlFor="reference-paiement">Référence</Label>
          <Input id="reference-paiement" name="reference" maxLength={80} placeholder="N° transaction / chèque" />
        </div>
      )}
      <div>
        <Label htmlFor="date-paiement">Date</Label>
        <Input id="date-paiement" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
    </div>
  );
}

function JournalPaiements({ paiements, entete, peutEcrire }: { paiements: PaiementVue[]; entete: EnteteFinances; peutEcrire: boolean }) {
  const [recherche, setRecherche] = useState("");
  const [recuOuvert, setRecuOuvert] = useState<PaiementVue | null>(null);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return paiements;
    return paiements.filter(
      (p) =>
        p.eleveNom.toLowerCase().includes(q) ||
        p.libelle.toLowerCase().includes(q) ||
        (p.reference ?? "").toLowerCase().includes(q) ||
        (p.classe ?? "").toLowerCase().includes(q) ||
        String(p.numeroRecu).padStart(6, "0").includes(q),
    );
  }, [paiements, recherche]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (élève, libellé, référence, n° reçu)…"
          className="w-full rounded-2xl border border-cream-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
              <th className="py-1.5 pr-2">N° reçu</th>
              <th className="py-1.5 pr-2">Date</th>
              <th className="py-1.5 pr-2">Élève</th>
              <th className="py-1.5 pr-2">Classe</th>
              <th className="py-1.5 pr-2">Libellé</th>
              <th className="py-1.5 pr-2 text-right">Montant</th>
              <th className="py-1.5 pr-2">Mode</th>
              <th className="py-1.5 pr-2">État</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {filtres.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-center text-ink-700/55">Aucun paiement ne correspond à la recherche.</td>
              </tr>
            ) : (
              filtres.map((p) => (
                <LignePaiement key={p.id} paiement={p} peutEcrire={peutEcrire} onRecu={() => setRecuOuvert(p)} />
              ))
            )}
          </tbody>
        </table>
      </div>
      {recuOuvert && <ApercuRecu paiement={recuOuvert} entete={entete} onFermer={() => setRecuOuvert(null)} />}
    </div>
  );
}

function BoutonAnnulerConfirmer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Oui, annuler
    </button>
  );
}

function LignePaiement({ paiement, peutEcrire, onRecu }: { paiement: PaiementVue; peutEcrire: boolean; onRecu: () => void }) {
  const [etat, action] = useActionState(annulerPaiement, INITIAL);
  const [ouvertAnnulation, setOuvertAnnulation] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [motif, setMotif] = useState("");

  useApresSucces(etat, () => {
    setOuvertAnnulation(false);
    setConfirmer(false);
    setMotif("");
  });

  return (
    <>
      <tr>
        <td className="py-2 pr-2 font-mono text-xs text-ink-700/70">{String(paiement.numeroRecu).padStart(6, "0")}</td>
        <td className="py-2 pr-2">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(paiement.date))}</td>
        <td className="py-2 pr-2 font-medium text-forest-900">{paiement.eleveNom}</td>
        <td className="py-2 pr-2">{paiement.classe ?? "—"}</td>
        <td className="py-2 pr-2">{paiement.libelle}</td>
        <td className="py-2 pr-2 text-right">{fcfa(paiement.montant)}</td>
        <td className="py-2 pr-2">{LIBELLE_MODE[paiement.mode] ?? paiement.mode}</td>
        <td className="py-2 pr-2">
          {paiement.annule ? (
            <span title={paiement.motifAnnulation ?? undefined} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Annulé</span>
          ) : (
            <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-800">Valide</span>
          )}
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          <button type="button" onClick={onRecu} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">
            <ReceiptText size={12} /> Reçu
          </button>
          {peutEcrire && !paiement.annule && (
            <button
              type="button"
              onClick={() => setOuvertAnnulation((v) => !v)}
              className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <X size={12} /> Annuler
            </button>
          )}
        </td>
      </tr>
      {ouvertAnnulation && (
        <tr>
          <td colSpan={9} className="bg-red-50/50 px-3 py-3">
            <form action={action} className="space-y-2">
              <input type="hidden" name="id" value={paiement.id} />
              {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
              <Label htmlFor={`motif-${paiement.id}`}>Motif d&apos;annulation (obligatoire)</Label>
              <textarea
                id={`motif-${paiement.id}`}
                name="motif"
                required
                rows={2}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                maxLength={300}
                placeholder="Ex. : erreur de saisie, double encaissement…"
                className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
              {!confirmer ? (
                <button
                  type="button"
                  onClick={() => motif.trim() && setConfirmer(true)}
                  disabled={!motif.trim()}
                  className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-40"
                >
                  Annuler ce paiement
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs font-medium text-red-700">Confirmer l&apos;annulation ?</span>
                  <BoutonAnnulerConfirmer />
                  <button type="button" onClick={() => setConfirmer(false)} className="rounded-full border border-cream-300 px-3 py-1.5 text-xs font-medium text-ink-700/70 hover:bg-cream-100">
                    Non
                  </button>
                </span>
              )}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Aperçu de reçu imprimable ──

function ApercuRecu({ paiement, entete, onFermer }: { paiement: PaiementVue; entete: EnteteFinances; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #apercu-recu-impression, #apercu-recu-impression * { visibility: visible; }
          #apercu-recu-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
        }
      `}</style>
      <div id="apercu-recu-impression" className="mx-auto my-8 w-full max-w-lg rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Aperçu du reçu</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
            <X size={18} />
          </button>
        </div>

        <div className="text-center text-xs uppercase tracking-wide text-ink-700/70">
          {entete.pays && <p>{entete.pays}</p>}
          {entete.ministere && <p>{entete.ministere}</p>}
          {entete.anneeScolaire && <p className="text-ink-700/50">Année scolaire {entete.anneeScolaire}</p>}
        </div>
        <p className="mt-2 text-center font-display text-lg font-bold text-forest-900">{entete.nom}</p>

        <div className="my-5 border-t border-dashed border-cream-300" />

        <p className="text-center font-display text-xl font-bold tracking-wide text-forest-900">
          REÇU N° {String(paiement.numeroRecu).padStart(6, "0")}
        </p>

        <dl className="mt-5 space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-700/60">Reçu de</dt>
            <dd className="text-right font-semibold text-forest-900">{paiement.eleveNom}</dd>
          </div>
          {paiement.classe && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-700/60">Classe</dt>
              <dd className="text-right">{paiement.classe}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-700/60">Motif</dt>
            <dd className="text-right">{paiement.libelle}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-700/60">Montant</dt>
            <dd className="text-right font-bold text-forest-900">{fcfa(paiement.montant)}</dd>
          </div>
          <div className="rounded-xl bg-cream-50 px-3 py-2 text-xs italic text-ink-700/70">
            Arrêtée la présente somme à : {capitaliser(nombreEnLettres(paiement.montant))} francs CFA.
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-700/60">Mode de règlement</dt>
            <dd className="text-right">{LIBELLE_MODE[paiement.mode] ?? paiement.mode}</dd>
          </div>
          {paiement.reference && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-700/60">Référence</dt>
              <dd className="text-right">{paiement.reference}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-700/60">Date</dt>
            <dd className="text-right">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(paiement.date))}</dd>
          </div>
        </dl>

        {paiement.annule && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700">
            REÇU ANNULÉ{paiement.motifAnnulation ? ` — ${paiement.motifAnnulation}` : ""}
          </p>
        )}

        <div className="mt-10 flex justify-end">
          <div className="text-center text-xs text-ink-700/60">
            <p className="mb-8">L&apos;Économe</p>
            <p className="border-t border-ink-700/30 pt-1">Signature</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"
          >
            <Printer size={16} /> Imprimer
          </button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
