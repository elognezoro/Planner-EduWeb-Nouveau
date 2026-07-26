"use client";

/**
 * Onglet BANQUES (10) : tableau de bord (solde global, dépôts en attente, frais, chèques),
 * comptes bancaires (solde CALCULÉ, rapprochement par compte : pointé / relevé / écart,
 * alertes), confirmation des versements de caisse (RM-600, boucle 09 → 10), mouvements
 * (dépôts/retraits/virements/prélèvements/frais/intérêts), virements internes (paire liée),
 * registre des chèques (transitions), situation de compte imprimable (A4, patron officiel).
 * Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle, ArrowLeftRight, Ban, Banknote, Check, CheckCircle2, ClipboardList,
  FileCheck2, HandCoins, Landmark, Loader2, Pencil, Plus, Printer, Settings2, Wallet, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { ComboboxRecherche } from "@/components/app/combobox-recherche";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import type { EtatForm } from "@/lib/finances/actions";
import { enregistrerReleve } from "@/lib/finances/actions";
import {
  annulerMouvementBancaire, basculerPointageMouvementBancaire, changerStatutCheque,
  changerStatutCompte, confirmerVersementCaisse, enregistrerCheque, enregistrerCompteBancaire,
  enregistrerMouvementBancaire, supprimerCompteBancaire, virementInterneBancaire,
} from "@/lib/finances/actions-banque";
import type { PersonnelVue } from "@/lib/finances/commun/permissions";
import {
  LIBELLE_MOUVEMENT_BANCAIRE, LIBELLE_STATUT_CHEQUE, LIBELLE_STATUT_COMPTE,
  LIBELLE_TYPE_COMPTE, SEUIL_VALIDATION_BANCAIRE, TYPES_COMPTE_BANCAIRE,
  TYPES_MOUVEMENT_BANCAIRE_SAISISSABLES, sensMouvementBancaire,
  type ChequeVue, type CompteBancaireVue, type MouvementBancaireVue,
  type TableauBordBanqueVue, type VersementEnAttenteVue,
} from "@/lib/finances/banque/types";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa } from "./types";

const INITIAL: EtatForm = { ok: false };

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));

// ─────────────────────────────────────────────────────────────
//  Onglet
// ─────────────────────────────────────────────────────────────

export function OngletBanques({
  etablissementId, comptes, mouvements, cheques, versementsEnAttente, tableauBord, personnel,
  entete, peutEcrire,
}: {
  etablissementId: string;
  comptes: CompteBancaireVue[];
  mouvements: MouvementBancaireVue[];
  cheques: ChequeVue[];
  versementsEnAttente: VersementEnAttenteVue[];
  tableauBord: TableauBordBanqueVue;
  personnel: PersonnelVue[];
  entete: EnteteEtablissement;
  peutEcrire: boolean;
}) {
  const [parametrageOuvert, setParametrageOuvert] = useState(false);
  const [compteEnEdition, setCompteEnEdition] = useState<CompteBancaireVue | null>(null);
  const [situation, setSituation] = useState<CompteBancaireVue | null>(null);
  const comptesActifs = comptes.filter((c) => c.statut === "actif");

  return (
    <div className="space-y-5">
      <TableauBordBanque tableauBord={tableauBord} />

      {peutEcrire && versementsEnAttente.length > 0 && (
        <VersementsEnAttente versements={versementsEnAttente} comptes={comptesActifs} />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {comptes.map((c) => (
          <CarteCompte
            key={c.id}
            etablissementId={etablissementId}
            compte={c}
            peutEcrire={peutEcrire}
            onModifier={() => { setCompteEnEdition(c); setParametrageOuvert(true); }}
            onSituation={() => setSituation(c)}
          />
        ))}
      </div>

      {peutEcrire && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <Settings2 size={18} className="text-forest-600" /> Paramétrage des comptes bancaires
            </h2>
            <button
              type="button"
              onClick={() => { setCompteEnEdition(null); setParametrageOuvert((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={14} /> {parametrageOuvert && !compteEnEdition ? "Fermer" : "Ajouter un compte"}
            </button>
          </div>
          {(parametrageOuvert || compteEnEdition) && (
            <FormulaireCompte
              key={compteEnEdition?.id ?? "nouveau"}
              etablissementId={etablissementId}
              compte={compteEnEdition}
              personnel={personnel}
              onSucces={() => { setParametrageOuvert(false); setCompteEnEdition(null); }}
            />
          )}
        </Card>
      )}

      {peutEcrire && comptesActifs.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <HandCoins size={18} className="text-forest-600" /> Nouveau mouvement bancaire
            </h2>
            <FormMouvementBancaire comptes={comptesActifs} />
          </Card>
          <Card>
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <ArrowLeftRight size={18} className="text-forest-600" /> Virement interne (banque → banque)
            </h2>
            <FormVirementInterne comptes={comptesActifs} />
          </Card>
        </div>
      )}

      <MouvementsRecents mouvements={mouvements} peutEcrire={peutEcrire} />

      <RegistreCheques etablissementId={etablissementId} cheques={cheques} comptes={comptesActifs} peutEcrire={peutEcrire} />

      {situation && (
        <SituationCompteImprimable
          compte={situation}
          mouvements={mouvements.filter((m) => m.compteId === situation.id)}
          entete={entete}
          onFermer={() => setSituation(null)}
        />
      )}
    </div>
  );
}

function TableauBordBanque({ tableauBord: t }: { tableauBord: TableauBordBanqueVue }) {
  const cartes: { libelle: string; valeur: string; Icone: typeof Wallet; ton?: "gold" | "rouge" }[] = [
    { libelle: "Solde bancaire global", valeur: fcfa(t.soldeGlobal), Icone: Landmark, ton: t.soldeGlobal < 0 ? "rouge" : undefined },
    { libelle: "Comptes actifs", valeur: String(t.comptesActifs), Icone: CheckCircle2 },
    { libelle: "Dépôts en attente (caisses)", valeur: fcfa(t.depotsEnAttente), Icone: Banknote, ton: t.depotsEnAttente > 0 ? "gold" : undefined },
    { libelle: "Virements du jour", valeur: fcfa(t.virementsDuJour), Icone: ArrowLeftRight },
    { libelle: "Frais bancaires (année)", valeur: fcfa(t.fraisAnnee), Icone: Wallet, ton: "gold" },
    { libelle: "Chèques en circulation", valeur: String(t.chequesEnCirculation), Icone: FileCheck2 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cartes.map((c) => (
        <div key={c.libelle} className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${c.ton === "rouge" ? "bg-red-50 text-red-600" : c.ton === "gold" ? "bg-gold-100 text-gold-700" : "bg-forest-50 text-forest-700"}`}>
            <c.Icone size={15} />
          </span>
          <p className="mt-1.5 font-display text-base font-bold text-forest-900">{c.valeur}</p>
          <p className="text-xs text-ink-700/60">{c.libelle}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Versements de caisse en attente (RM-600)
// ─────────────────────────────────────────────────────────────

function VersementsEnAttente({ versements, comptes }: { versements: VersementEnAttenteVue[]; comptes: CompteBancaireVue[] }) {
  return (
    <Card>
      <h2 className="mb-1 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Banknote size={18} className="text-forest-600" /> Versements de caisse en attente de confirmation
      </h2>
      <p className="mb-3 text-xs text-ink-700/60">
        RM-600 : tout dépôt bancaire provient d&apos;une caisse (versement du 09) ou d&apos;une autre banque —
        confirmez la réception en banque avec le bordereau de versement.
      </p>
      <ul className="divide-y divide-cream-100">
        {versements.map((v) => (
          <LigneVersement key={v.mouvementCaisseId} versement={v} comptes={comptes} />
        ))}
      </ul>
    </Card>
  );
}

function LigneVersement({ versement: v, comptes }: { versement: VersementEnAttenteVue; comptes: CompteBancaireVue[] }) {
  const [compteId, setCompteId] = useState(comptes[0]?.id ?? "");
  const [piece, setPiece] = useState("");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        <strong className="text-forest-900">{fcfa(v.montant)}</strong> — caisse « {v.caisseNom} »
        ({v.caissierNom}) · {dateFr(v.date)}{v.motif ? ` · ${v.motif}` : ""}
      </span>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Select value={compteId} onChange={(e) => setCompteId(e.target.value)} className="h-8 w-auto text-xs">
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </Select>
        <Input
          value={piece} onChange={(e) => setPiece(e.target.value)} maxLength={120}
          placeholder="Bordereau (obligatoire)" className="h-8 w-44 text-xs"
        />
        <BoutonActionConfirmee
          libelle="Confirmer la réception" icone={CheckCircle2} ton="primaire"
          action={confirmerVersementCaisse}
          champs={{ mouvementCaisseId: v.mouvementCaisseId, compteId, pieceJustificative: piece }}
          desactive={!compteId || !piece.trim()}
        />
      </span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
//  Comptes : carte, paramétrage, relevé par compte
// ─────────────────────────────────────────────────────────────

function CarteCompte({
  etablissementId, compte: c, peutEcrire, onModifier, onSituation,
}: {
  etablissementId: string;
  compte: CompteBancaireVue;
  peutEcrire: boolean;
  onModifier: () => void;
  onSituation: () => void;
}) {
  const [releveOuvert, setReleveOuvert] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Landmark size={17} className="text-forest-600" /> {c.nom}
            {c.code && <span className="font-mono text-xs text-ink-700/50">({c.code})</span>}
          </h3>
          <p className="text-xs text-ink-700/60">
            {c.banque}{c.agence ? ` · ${c.agence}` : ""} · {LIBELLE_TYPE_COMPTE[c.type] ?? c.type}
            {c.numeroCompte && ` · n° ${c.numeroCompte}`}
            {c.responsableNom && ` · responsable : ${c.responsableNom}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.statut === "actif" ? "bg-forest-100 text-forest-800" : c.statut === "suspendu" ? "bg-gold-100 text-gold-800" : "bg-cream-200 text-ink-700/60"}`}>
            {LIBELLE_STATUT_COMPTE[c.statut] ?? c.statut}
          </span>
          <button type="button" onClick={onSituation} title="Situation imprimable" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50">
            <Printer size={13} />
          </button>
          {peutEcrire && (
            <button type="button" onClick={onModifier} title="Modifier" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50">
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {c.alertes.length > 0 && (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
          <AlertTriangle size={12} className="mr-1 inline" /> {c.alertes.join(" · ")}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-2.5 text-center">
          <p className="text-xs text-ink-700/60">Solde théorique</p>
          <p className={`font-display font-bold ${c.solde < 0 ? "text-red-700" : "text-forest-900"}`}>{fcfa(c.solde)}</p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-2.5 text-center">
          <p className="text-xs text-ink-700/60">Solde pointé</p>
          <p className="font-display font-bold text-forest-900">{fcfa(c.soldePointe)}</p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-2.5 text-center">
          <p className="text-xs text-ink-700/60">Dernier relevé</p>
          <p className="font-display font-bold text-forest-900">
            {c.dernierReleve ? `${fcfa(c.dernierReleve.solde)} (${c.dernierReleve.mois})` : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-2.5 text-center">
          <p className="text-xs text-ink-700/60">En attente de pointage</p>
          <p className="font-display font-bold text-forest-900">{c.nonPointes}</p>
        </div>
      </div>
      {c.ecartReleve !== null && c.ecartReleve !== 0 && (
        <p className="mt-2 text-xs font-medium text-red-700">
          Écart de rapprochement : {c.ecartReleve > 0 ? "+" : ""}{c.ecartReleve.toLocaleString("fr-FR")} F
          (relevé {c.dernierReleve?.mois} vs solde pointé) — pointez les opérations en attente.
        </p>
      )}

      {peutEcrire && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button" onClick={() => setReleveOuvert((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
          >
            <ClipboardList size={13} /> Relevé du mois
          </button>
          {c.statut === "actif" ? (
            <BoutonActionConfirmee
              libelle="Suspendre" icone={Ban}
              action={changerStatutCompte}
              champs={{ id: c.id, statut: "suspendu", version: String(c.version) }}
            />
          ) : c.statut === "suspendu" ? (
            <BoutonActionConfirmee
              libelle="Réactiver" icone={CheckCircle2}
              action={changerStatutCompte}
              champs={{ id: c.id, statut: "actif", version: String(c.version) }}
            />
          ) : null}
          {c.statut !== "ferme" && (
            <BoutonActionConfirmee
              libelle="Fermer (RM-601)" icone={Ban} ton="danger"
              action={changerStatutCompte}
              champs={{ id: c.id, statut: "ferme", version: String(c.version) }}
            />
          )}
          <BoutonActionConfirmee
            libelle="Archiver" icone={Ban} ton="danger"
            action={supprimerCompteBancaire}
            champs={{ id: c.id, version: String(c.version) }}
          />
        </div>
      )}
      {peutEcrire && releveOuvert && (
        <FormReleveCompte etablissementId={etablissementId} compteId={c.id} onFermer={() => setReleveOuvert(false)} />
      )}
    </Card>
  );
}

function FormReleveCompte({ etablissementId, compteId, onFermer }: { etablissementId: string; compteId: string; onFermer: () => void }) {
  const [etat, action] = useActionState(enregistrerReleve, INITIAL);
  useApresSucces(etat, onFermer);
  const moisCourant = new Date().toISOString().slice(0, 7);
  return (
    <form action={action} className="mt-2 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="compteId" value={compteId} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Solde du relevé bancaire de CE compte (rapprochement par compte)
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input name="mois" defaultValue={moisCourant} required placeholder="AAAA-MM" pattern="\d{4}-\d{2}" />
        <Input name="solde" required inputMode="numeric" placeholder="Solde de fin de mois (F CFA)" />
        <div className="flex items-center gap-2">
          <SubmitButton className="w-auto px-5">Enregistrer</SubmitButton>
          <button type="button" onClick={onFermer} className="h-9 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
        </div>
      </div>
    </form>
  );
}

function FormulaireCompte({
  etablissementId, compte, personnel, onSucces,
}: {
  etablissementId: string;
  compte: CompteBancaireVue | null;
  personnel: PersonnelVue[];
  onSucces: () => void;
}) {
  const [etat, action] = useActionState(enregistrerCompteBancaire, INITIAL);
  useApresSucces(etat, onSucces);
  const options = useMemo(() => personnel.map((p) => ({ value: p.id, label: `${p.nom} — ${p.role}` })), [personnel]);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {compte && <input type="hidden" name="id" value={compte.id} />}
      {compte && <input type="hidden" name="version" value={compte.version} />}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="cb-nom">Nom du compte</Label>
          <Input id="cb-nom" name="nom" required maxLength={80} defaultValue={compte?.nom ?? ""} placeholder="Ex. : Compte courant SGCI" />
        </div>
        <div>
          <Label htmlFor="cb-banque">Banque / EME</Label>
          <Input id="cb-banque" name="banque" required maxLength={80} defaultValue={compte?.banque ?? ""} placeholder="Ex. : SGCI, Wave Business" />
        </div>
        <div>
          <Label htmlFor="cb-type">Type</Label>
          <Select id="cb-type" name="type" defaultValue={compte?.type ?? "courant"}>
            {TYPES_COMPTE_BANCAIRE.map((t) => (
              <option key={t.code} value={t.code}>{t.libelle}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="cb-agence">Agence</Label>
          <Input id="cb-agence" name="agence" maxLength={80} defaultValue={compte?.agence ?? ""} />
        </div>
        <div>
          <Label htmlFor="cb-numero">Numéro de compte</Label>
          <Input id="cb-numero" name="numeroCompte" maxLength={40} defaultValue={compte?.numeroCompte ?? ""} />
        </div>
        <div>
          <Label htmlFor="cb-code">Code interne</Label>
          <Input id="cb-code" name="code" maxLength={20} defaultValue={compte?.code ?? ""} />
        </div>
        <div>
          <Label htmlFor="cb-iban">IBAN (optionnel)</Label>
          <Input id="cb-iban" name="iban" maxLength={40} defaultValue={compte?.iban ?? ""} />
        </div>
        <div>
          <Label htmlFor="cb-swift">SWIFT / BIC</Label>
          <Input id="cb-swift" name="swift" maxLength={20} defaultValue={compte?.swift ?? ""} />
        </div>
        <div>
          <Label htmlFor="cb-seuil">Seuil d&apos;alerte « solde faible »</Label>
          <Input id="cb-seuil" name="seuilAlerte" inputMode="numeric" defaultValue={compte?.seuilAlerte ?? ""} placeholder="Facultatif" />
        </div>
        {!compte && (
          <div>
            <Label htmlFor="cb-solde">Solde initial (départ du suivi)</Label>
            <Input id="cb-solde" name="soldeInitial" inputMode="numeric" defaultValue={0} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Responsable (facultatif)</Label>
          <ComboboxRecherche
            name="responsableId"
            options={options}
            defaultValue={compte?.responsableId ?? ""}
            videLabel="— Aucun responsable désigné —"
            rechercheLabel="Rechercher (nom, rôle)…"
          />
        </div>
      </div>
      <SubmitButton className="w-auto px-6">{compte ? "Enregistrer" : "Créer le compte"}</SubmitButton>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Mouvements : saisie, virement interne, liste + pointage
// ─────────────────────────────────────────────────────────────

function FormMouvementBancaire({ comptes }: { comptes: CompteBancaireVue[] }) {
  const [etat, action] = useActionState(enregistrerMouvementBancaire, INITIAL);
  const [type, setType] = useState<string>("virement_entrant");
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => setResetKey((k) => k + 1));
  return (
    <form key={resetKey} action={action} className="space-y-2">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select name="compteId" required defaultValue={comptes[0]?.id ?? ""}>
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </Select>
        <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES_MOUVEMENT_BANCAIRE_SAISISSABLES.map((t) => (
            <option key={t} value={t}>{LIBELLE_MOUVEMENT_BANCAIRE[t]}</option>
          ))}
        </Select>
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Input name="pieceJustificative" required maxLength={120} placeholder="Pièce justificative (OBLIGATOIRE)" />
        <Input name="libelle" required maxLength={200} placeholder="Libellé" className="sm:col-span-2" />
        <Input name="reference" maxLength={80} placeholder="Référence (facultatif)" />
        <Input name="beneficiaire" maxLength={120} placeholder={type === "virement_sortant" ? "Bénéficiaire (fournisseur, salarié…)" : "Bénéficiaire (facultatif)"} />
      </div>
      <p className="text-xs text-ink-700/55">
        Sorties &gt; {SEUIL_VALIDATION_BANCAIRE.toLocaleString("fr-FR")} F : validation hiérarchique requise.
        Dépôts : passez par la confirmation d&apos;un versement de caisse (RM-600) si l&apos;établissement utilise des caisses.
      </p>
      <SubmitButton className="w-auto px-6">Enregistrer le mouvement</SubmitButton>
    </form>
  );
}

function FormVirementInterne({ comptes }: { comptes: CompteBancaireVue[] }) {
  const [etat, action] = useActionState(virementInterneBancaire, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => setResetKey((k) => k + 1));
  return (
    <form key={resetKey} action={action} className="space-y-2">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select name="compteSourceId" required defaultValue="">
          <option value="" disabled>Compte source…</option>
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.nom} ({fcfa(c.solde)})</option>
          ))}
        </Select>
        <Select name="compteCibleId" required defaultValue="">
          <option value="" disabled>Compte cible…</option>
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </Select>
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Input name="pieceJustificative" required maxLength={120} placeholder="Ordre de virement (OBLIGATOIRE)" />
        <Input name="libelle" maxLength={200} placeholder="Libellé (facultatif)" className="sm:col-span-2" />
      </div>
      <SubmitButton className="w-auto px-6"><ArrowLeftRight size={15} /> Virer (paire liée)</SubmitButton>
    </form>
  );
}

function BoutonPointage({ mouvement: m }: { mouvement: MouvementBancaireVue }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  function basculer() {
    setErreur(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", m.id);
      const r = await basculerPointageMouvementBancaire(INITIAL, fd);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
    });
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button" onClick={basculer} disabled={pending}
        title={m.pointe ? "Retirer le pointage" : "Pointer sur le relevé"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${m.pointe ? "border-forest-600 bg-forest-600 text-white" : "border-cream-300 text-ink-700/50 hover:bg-forest-50"}`}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      {erreur && <span className="text-xs text-red-600">{erreur}</span>}
    </span>
  );
}

function MouvementsRecents({ mouvements, peutEcrire }: { mouvements: MouvementBancaireVue[]; peutEcrire: boolean }) {
  return (
    <Card>
      <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <ClipboardList size={18} className="text-forest-600" /> Mouvements bancaires récents
      </h2>
      {mouvements.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucun mouvement bancaire.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Date</th>
                <th className="py-1.5 pr-2">Compte</th>
                <th className="py-1.5 pr-2">Type</th>
                <th className="py-1.5 pr-2">Libellé</th>
                <th className="py-1.5 pr-2 text-right">Montant</th>
                <th className="py-1.5 pr-2">Pièce</th>
                <th className="py-1.5 pr-2 text-center">Pointé</th>
                {peutEcrire && <th className="py-1.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {mouvements.map((m) => {
                const sens = sensMouvementBancaire(m.type);
                return (
                  <tr key={m.id} className={m.annule ? "opacity-50" : ""}>
                    <td className="py-2 pr-2 whitespace-nowrap">{dateFr(m.dateOperation)}</td>
                    <td className="py-2 pr-2 font-medium text-forest-900">{m.compteNom}</td>
                    <td className="py-2 pr-2 text-xs text-ink-700/70">{LIBELLE_MOUVEMENT_BANCAIRE[m.type] ?? m.type}</td>
                    <td className="py-2 pr-2">
                      {m.libelle}
                      {m.annule && <span className="ml-1 rounded-full bg-red-50 px-1.5 text-[10px] font-semibold text-red-600">Annulé</span>}
                    </td>
                    <td className={`py-2 pr-2 text-right font-medium ${sens > 0 ? "text-forest-700" : "text-red-700"}`}>
                      {sens > 0 ? "+" : "−"}{fcfa(m.montant)}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs text-ink-700/60">{m.pieceJustificative}</td>
                    <td className="py-2 pr-2 text-center">
                      {peutEcrire && !m.annule ? <BoutonPointage mouvement={m} /> : m.pointe ? "✔" : "—"}
                    </td>
                    {peutEcrire && (
                      <td className="py-2 text-right">
                        {!m.annule && !m.pointe && (
                          <BoutonActionConfirmee
                            libelle="Annuler" icone={Ban} ton="danger"
                            action={annulerMouvementBancaire}
                            champs={{ id: m.id, version: String(m.version) }}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Registre des chèques
// ─────────────────────────────────────────────────────────────

function RegistreCheques({
  etablissementId, cheques, comptes, peutEcrire,
}: {
  etablissementId: string;
  cheques: ChequeVue[];
  comptes: CompteBancaireVue[];
  peutEcrire: boolean;
}) {
  const [formOuvert, setFormOuvert] = useState(false);
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileCheck2 size={18} className="text-forest-600" /> Registre des chèques
        </h2>
        {peutEcrire && (
          <button
            type="button" onClick={() => setFormOuvert((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
          >
            <Plus size={14} /> {formOuvert ? "Fermer" : "Enregistrer un chèque"}
          </button>
        )}
      </div>
      {peutEcrire && formOuvert && (
        <FormCheque etablissementId={etablissementId} comptes={comptes} onSucces={() => setFormOuvert(false)} />
      )}
      {cheques.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucun chèque au registre.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Sens</th>
                <th className="py-1.5 pr-2">N°</th>
                <th className="py-1.5 pr-2">Banque</th>
                <th className="py-1.5 pr-2 text-right">Montant</th>
                <th className="py-1.5 pr-2">Émetteur / bénéficiaire</th>
                <th className="py-1.5 pr-2">État</th>
                {peutEcrire && <th className="py-1.5 text-right">Transitions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {cheques.map((c) => (
                <LigneCheque key={c.id} cheque={c} comptes={comptes} peutEcrire={peutEcrire} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LigneCheque({ cheque: c, comptes, peutEcrire }: { cheque: ChequeVue; comptes: CompteBancaireVue[]; peutEcrire: boolean }) {
  const [compteId, setCompteId] = useState(comptes[0]?.id ?? "");
  const [motif, setMotif] = useState("");
  const enCirculation = c.statut === "en_circulation";
  return (
    <tr className={c.statut === "annule" ? "opacity-50" : ""}>
      <td className="py-2 pr-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.sens === "recu" ? "bg-forest-100 text-forest-800" : "bg-gold-100 text-gold-800"}`}>
          {c.sens === "recu" ? "Reçu" : "Émis"}
        </span>
      </td>
      <td className="py-2 pr-2 font-mono text-xs">{c.numero}</td>
      <td className="py-2 pr-2">{c.banque ?? "—"}</td>
      <td className="py-2 pr-2 text-right font-medium">{fcfa(c.montant)}</td>
      <td className="py-2 pr-2 text-xs text-ink-700/70">{[c.emetteur, c.beneficiaire].filter(Boolean).join(" / ") || "—"}</td>
      <td className="py-2 pr-2">
        <span
          title={c.motifStatut ?? undefined}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            c.statut === "encaisse" ? "bg-forest-100 text-forest-800"
            : c.statut === "rejete" ? "bg-red-100 text-red-700"
            : c.statut === "annule" ? "bg-cream-200 text-ink-700/50"
            : "bg-gold-100 text-gold-800"
          }`}
        >
          {LIBELLE_STATUT_CHEQUE[c.statut] ?? c.statut}
        </span>
      </td>
      {peutEcrire && (
        <td className="py-2 text-right">
          {enCirculation && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Select value={compteId} onChange={(e) => setCompteId(e.target.value)} className="h-8 w-auto text-xs">
                {comptes.map((cb) => (
                  <option key={cb.id} value={cb.id}>{cb.nom}</option>
                ))}
              </Select>
              <BoutonActionConfirmee
                libelle="Encaisser" icone={CheckCircle2} ton="primaire"
                action={changerStatutCheque}
                champs={{ id: c.id, statut: "encaisse", compteId, version: String(c.version) }}
                desactive={!compteId}
              />
              <Input
                value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300}
                placeholder="Motif rejet/annulation…" className="h-8 w-40 text-xs"
              />
              <BoutonActionConfirmee
                libelle="Rejeter" icone={Ban} ton="danger"
                action={changerStatutCheque}
                champs={{ id: c.id, statut: "rejete", motif, version: String(c.version) }}
                desactive={!motif.trim()}
              />
              <BoutonActionConfirmee
                libelle="Annuler" icone={X} ton="danger"
                action={changerStatutCheque}
                champs={{ id: c.id, statut: "annule", motif, version: String(c.version) }}
                desactive={!motif.trim()}
              />
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

function FormCheque({ etablissementId, comptes, onSucces }: { etablissementId: string; comptes: CompteBancaireVue[]; onSucces: () => void }) {
  const [etat, action] = useActionState(enregistrerCheque, INITIAL);
  useApresSucces(etat, onSucces);
  return (
    <form action={action} className="mb-4 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="sens" defaultValue="recu">
          <option value="recu">Chèque reçu</option>
          <option value="emis">Chèque émis</option>
        </Select>
        <Input name="numero" required maxLength={40} placeholder="Numéro du chèque" />
        <Input name="banque" maxLength={80} placeholder="Banque" />
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Input name="emetteur" maxLength={120} placeholder="Émetteur (chèque reçu)" />
        <Input name="beneficiaire" maxLength={120} placeholder="Bénéficiaire (chèque émis)" />
        <Select name="compteId" defaultValue="">
          <option value="">— Compte (facultatif) —</option>
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </Select>
      </div>
      <SubmitButton className="w-auto px-5">Enregistrer le chèque</SubmitButton>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Situation de compte imprimable (A4)
// ─────────────────────────────────────────────────────────────

function SituationCompteImprimable({
  compte: c, mouvements, entete, onFermer,
}: {
  compte: CompteBancaireVue;
  mouvements: MouvementBancaireVue[];
  entete: EnteteEtablissement;
  onFermer: () => void;
}) {
  const actifs = mouvements.filter((m) => !m.annule);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #situation-compte-impression, #situation-compte-impression * { visibility: visible; }
          #situation-compte-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div id="situation-compte-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Situation du compte</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
            <X size={18} />
          </button>
        </div>

        <EnTeteOfficielDoc
          etab={entete}
          titre="SITUATION DE COMPTE BANCAIRE"
          sousTitre={`${c.nom} — ${c.banque}${c.numeroCompte ? ` · n° ${c.numeroCompte}` : ""}`}
        />

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Solde initial</dt><dd className="font-semibold">{fcfa(c.soldeInitial)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Solde théorique</dt><dd className="font-semibold text-forest-900">{fcfa(c.solde)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Solde pointé</dt><dd>{fcfa(c.soldePointe)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Dernier relevé</dt><dd>{c.dernierReleve ? `${fcfa(c.dernierReleve.solde)} (${c.dernierReleve.mois})` : "—"}</dd></div>
        </dl>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-ink-700/55">
              <th className="py-1.5 pr-2">Date</th>
              <th className="py-1.5 pr-2">Opération</th>
              <th className="py-1.5 pr-2">Pièce</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {actifs.length === 0 ? (
              <tr><td colSpan={4} className="py-3 text-center text-ink-700/55">Aucun mouvement.</td></tr>
            ) : (
              actifs.map((m) => {
                const sens = sensMouvementBancaire(m.type);
                return (
                  <tr key={m.id}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{dateFr(m.dateOperation)}</td>
                    <td className="py-1.5 pr-2">{m.libelle}</td>
                    <td className="py-1.5 pr-2 font-mono text-xs">{m.pieceJustificative}</td>
                    <td className={`py-1.5 text-right font-medium ${sens > 0 ? "text-forest-700" : "text-red-700"}`}>
                      {sens > 0 ? "+" : "−"}{fcfa(m.montant)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="mt-10 flex justify-end">
          <div className="text-center text-xs text-ink-700/60">
            <p className="mb-8">Le Gestionnaire</p>
            <p className="border-t border-ink-700/30 pt-1">Signature et cachet</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700">
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
