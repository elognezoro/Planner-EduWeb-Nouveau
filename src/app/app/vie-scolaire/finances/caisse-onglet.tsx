"use client";

/**
 * Onglet CAISSES (09) : tableau de bord, caisses (paramétrage, alertes), sessions
 * (ouverture avec fonds proposé depuis la veille → mouvements internes → comptage →
 * clôture), écarts validés par un second acteur, transferts entre caisses, journal de
 * caisse imprimable (A4, patron officiel). Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeftRight, Banknote, Ban, CheckCircle2, ClipboardList, HandCoins,
  Landmark, Lock, LockOpen, Pencil, PiggyBank, Plus, Printer, Settings2, ShieldCheck,
  Wallet, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { ComboboxRecherche } from "@/components/app/combobox-recherche";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import type { EtatForm } from "@/lib/finances/actions";
import {
  annulerMouvementCaisse, basculerSuspensionCaisse, cloturerSession, enregistrerCaisse,
  enregistrerMouvementCaisse, ouvrirSession, supprimerCaisse, transfertEntreCaisses,
  validerEcartSession,
} from "@/lib/finances/actions-caisse";
import type { PersonnelVue } from "@/lib/finances/commun/permissions";
import {
  LIBELLE_MOUVEMENT_CAISSE, LIBELLE_TYPE_CAISSE, SEUILS_DECAISSEMENT, TYPES_CAISSE,
  TYPES_MOUVEMENT_SAISISSABLES,
  type CaisseVue, type SessionCaisseVue, type TableauBordCaisseVue,
} from "@/lib/finances/caisse/types";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa } from "./types";

const INITIAL: EtatForm = { ok: false };

const dateHeureFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

// ─────────────────────────────────────────────────────────────
//  Onglet
// ─────────────────────────────────────────────────────────────

export function OngletCaisses({
  etablissementId, caisses, sessionsRecentes, tableauBord, personnel, entete, peutEcrire,
}: {
  etablissementId: string;
  caisses: CaisseVue[];
  sessionsRecentes: SessionCaisseVue[];
  tableauBord: TableauBordCaisseVue;
  personnel: PersonnelVue[];
  entete: EnteteEtablissement;
  peutEcrire: boolean;
}) {
  const [parametrageOuvert, setParametrageOuvert] = useState(false);
  const [caisseEnEdition, setCaisseEnEdition] = useState<CaisseVue | null>(null);
  const [journalOuvert, setJournalOuvert] = useState<SessionCaisseVue | null>(null);

  return (
    <div className="space-y-5">
      <TableauBordCaisses tableauBord={tableauBord} />

      {caisses.length === 0 && (
        <Card>
          <p className="text-sm text-ink-700/70">
            Aucune caisse définie : les encaissements en espèces restent libres (compatibilité).
            Dès qu&apos;une caisse PHYSIQUE active existe, tout encaissement en espèces exigera une
            session de caisse ouverte (RM-500).
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {caisses.map((c) => (
          <CarteCaisse
            key={c.id}
            etablissementId={etablissementId}
            caisse={c}
            caisses={caisses}
            peutEcrire={peutEcrire}
            onModifier={() => { setCaisseEnEdition(c); setParametrageOuvert(true); }}
            onJournal={(s) => setJournalOuvert(s)}
          />
        ))}
      </div>

      {peutEcrire && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <Settings2 size={18} className="text-forest-600" /> Paramétrage des caisses
            </h2>
            <button
              type="button"
              onClick={() => { setCaisseEnEdition(null); setParametrageOuvert((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={14} /> {parametrageOuvert && !caisseEnEdition ? "Fermer" : "Ajouter une caisse"}
            </button>
          </div>
          {(parametrageOuvert || caisseEnEdition) && (
            <FormulaireCaisse
              key={caisseEnEdition?.id ?? "nouvelle"}
              etablissementId={etablissementId}
              caisse={caisseEnEdition}
              personnel={personnel}
              onSucces={() => { setParametrageOuvert(false); setCaisseEnEdition(null); }}
            />
          )}
        </Card>
      )}

      <SessionsRecentes sessions={sessionsRecentes} peutEcrire={peutEcrire} onJournal={(s) => setJournalOuvert(s)} />

      {journalOuvert && (
        <JournalCaisseImprimable session={journalOuvert} entete={entete} onFermer={() => setJournalOuvert(null)} />
      )}
    </div>
  );
}

function TableauBordCaisses({ tableauBord: t }: { tableauBord: TableauBordCaisseVue }) {
  const cartes: { libelle: string; valeur: string; Icone: typeof Wallet; ton?: "gold" | "rouge" }[] = [
    { libelle: "Caisses ouvertes", valeur: `${t.caissesOuvertes} / ${t.caissesTotal}`, Icone: LockOpen },
    { libelle: "Montant en caisse (théorique)", valeur: fcfa(t.montantEnCaisse), Icone: Banknote },
    { libelle: "Versements bancaires du jour", valeur: fcfa(t.versementsDuJour), Icone: Landmark },
    { libelle: "Écarts en attente de validation", valeur: String(t.ecartsEnAttente), Icone: AlertTriangle, ton: t.ecartsEnAttente > 0 ? "rouge" : undefined },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
//  Carte d'une caisse : session ouverte, actions
// ─────────────────────────────────────────────────────────────

function CarteCaisse({
  etablissementId, caisse: c, caisses, peutEcrire, onModifier, onJournal,
}: {
  etablissementId: string;
  caisse: CaisseVue;
  caisses: CaisseVue[];
  peutEcrire: boolean;
  onModifier: () => void;
  onJournal: (s: SessionCaisseVue) => void;
}) {
  const [formOuvert, setFormOuvert] = useState<"ouvrir" | "mouvement" | "transfert" | "cloturer" | null>(null);
  const s = c.sessionOuverte;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <PiggyBank size={17} className="text-forest-600" /> {c.nom}
            {c.code && <span className="font-mono text-xs text-ink-700/50">({c.code})</span>}
          </h3>
          <p className="text-xs text-ink-700/60">
            {LIBELLE_TYPE_CAISSE[c.type] ?? c.type}
            {c.responsableNom && ` · responsable : ${c.responsableNom}`}
            {c.plafond !== null && ` · plafond ${fcfa(c.plafond)}`}
            {c.decouvertAutorise && " · découvert autorisé"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {c.statut === "suspendue" && (
            <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-ink-700/60">Suspendue</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.ouverte ? "bg-forest-100 text-forest-800" : "bg-cream-200 text-ink-700/60"}`}>
            {c.ouverte ? "Ouverte" : "Fermée"}
          </span>
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

      {s ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
          <p className="text-sm">
            Session de <strong>{s.caissierNom}</strong> ouverte le {dateHeureFr(s.ouverteLe)} —
            fonds initial {fcfa(s.fondsInitial)}
          </p>
          <p className="text-sm">
            Encaissements : <strong className="text-forest-700">{fcfa(s.totalEncaissements)}</strong> ·
            Décaissements : <strong className="text-red-700">{fcfa(s.totalDecaissements)}</strong> ·
            Solde théorique : <strong className="text-forest-900">{fcfa(s.soldeTheorique)}</strong>
          </p>
          {peutEcrire && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setFormOuvert(formOuvert === "mouvement" ? null : "mouvement")} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                <HandCoins size={13} /> Mouvement
              </button>
              <button type="button" onClick={() => setFormOuvert(formOuvert === "transfert" ? null : "transfert")} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                <ArrowLeftRight size={13} /> Transfert
              </button>
              <button type="button" onClick={() => onJournal(s)} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                <Printer size={13} /> Journal
              </button>
              <button type="button" onClick={() => setFormOuvert(formOuvert === "cloturer" ? null : "cloturer")} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Lock size={13} /> Clôturer
              </button>
            </div>
          )}
          {formOuvert === "mouvement" && <FormMouvement session={s} onFermer={() => setFormOuvert(null)} />}
          {formOuvert === "transfert" && <FormTransfert session={s} caisses={caisses} onFermer={() => setFormOuvert(null)} />}
          {formOuvert === "cloturer" && <FormCloture session={s} onFermer={() => setFormOuvert(null)} />}
        </div>
      ) : (
        peutEcrire && c.statut === "active" && (
          <div className="mt-3">
            {formOuvert !== "ouvrir" ? (
              <button type="button" onClick={() => setFormOuvert("ouvrir")} className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-forest-700">
                <LockOpen size={14} /> Ouvrir une session
              </button>
            ) : (
              <FormOuverture etablissementId={etablissementId} caisse={c} onFermer={() => setFormOuvert(null)} />
            )}
          </div>
        )
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Formulaires : caisse, ouverture, mouvement, transfert, clôture
// ─────────────────────────────────────────────────────────────

function FormulaireCaisse({
  etablissementId, caisse, personnel, onSucces,
}: {
  etablissementId: string;
  caisse: CaisseVue | null;
  personnel: PersonnelVue[];
  onSucces: () => void;
}) {
  const [etat, action] = useActionState(enregistrerCaisse, INITIAL);
  useApresSucces(etat, onSucces);
  const options = useMemo(() => personnel.map((p) => ({ value: p.id, label: `${p.nom} — ${p.role}` })), [personnel]);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {caisse && <input type="hidden" name="id" value={caisse.id} />}
      {caisse && <input type="hidden" name="version" value={caisse.version} />}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="caisse-nom">Nom</Label>
          <Input id="caisse-nom" name="nom" required maxLength={80} defaultValue={caisse?.nom ?? ""} placeholder="Ex. : Caisse principale" />
        </div>
        <div>
          <Label htmlFor="caisse-code">Code</Label>
          <Input id="caisse-code" name="code" maxLength={20} defaultValue={caisse?.code ?? ""} placeholder="Ex. : CP" />
        </div>
        <div>
          <Label htmlFor="caisse-type">Type</Label>
          <Select id="caisse-type" name="type" defaultValue={caisse?.type ?? "physique"}>
            {TYPES_CAISSE.map((t) => (
              <option key={t.code} value={t.code}>{t.libelle}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="caisse-plafond">Plafond (facultatif)</Label>
          <Input id="caisse-plafond" name="plafond" inputMode="numeric" defaultValue={caisse?.plafond ?? ""} placeholder="Montant maximal autorisé" />
        </div>
        <div>
          <Label htmlFor="caisse-decouvert">Découvert autorisé</Label>
          <Select id="caisse-decouvert" name="decouvertAutorise" defaultValue={caisse?.decouvertAutorise ? "oui" : "non"}>
            <option value="non">Non</option>
            <option value="oui">Oui</option>
          </Select>
        </div>
        <div>
          <Label>Responsable (facultatif)</Label>
          <ComboboxRecherche
            name="responsableId"
            options={options}
            defaultValue={caisse?.responsableId ?? ""}
            videLabel="— Aucun responsable désigné —"
            rechercheLabel="Rechercher (nom, rôle)…"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton className="w-auto px-6">{caisse ? "Enregistrer" : "Créer la caisse"}</SubmitButton>
        {caisse && (
          <>
            <BoutonActionConfirmee
              libelle={caisse.statut === "active" ? "Suspendre" : "Réactiver"}
              icone={caisse.statut === "active" ? Ban : CheckCircle2}
              action={basculerSuspensionCaisse}
              champs={{ id: caisse.id, version: String(caisse.version) }}
              onSucces={onSucces}
            />
            <BoutonActionConfirmee
              libelle="Archiver la caisse" icone={Ban} ton="danger"
              action={supprimerCaisse}
              champs={{ id: caisse.id, version: String(caisse.version) }}
              onSucces={onSucces}
            />
          </>
        )}
      </div>
    </form>
  );
}

function FormOuverture({ etablissementId, caisse, onFermer }: { etablissementId: string; caisse: CaisseVue; onFermer: () => void }) {
  const [etat, action] = useActionState(ouvrirSession, INITIAL);
  useApresSucces(etat, onFermer);
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <input type="hidden" name="caisseId" value={caisse.id} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Ouverture de session — {etablissementId ? caisse.nom : caisse.nom}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`fonds-${caisse.id}`}>Fonds initial (F CFA)</Label>
          <Input
            id={`fonds-${caisse.id}`} name="fondsInitial" required inputMode="numeric"
            defaultValue={caisse.dernierSoldeReel ?? 0}
            placeholder="0 accepté"
          />
          {caisse.dernierSoldeReel !== null && (
            <p className="mt-1 text-xs text-ink-700/55">Proposé : solde réel de la dernière clôture ({fcfa(caisse.dernierSoldeReel)}).</p>
          )}
        </div>
        <div>
          <Label htmlFor={`obs-${caisse.id}`}>Observations</Label>
          <Input id={`obs-${caisse.id}`} name="observations" maxLength={300} placeholder="Facultatif" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton className="w-auto px-5"><LockOpen size={14} /> Ouvrir la session</SubmitButton>
        <button type="button" onClick={onFermer} className="h-9 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
      </div>
    </form>
  );
}

function FormMouvement({ session, onFermer }: { session: SessionCaisseVue; onFermer: () => void }) {
  const [etat, action] = useActionState(enregistrerMouvementCaisse, INITIAL);
  const [type, setType] = useState<string>("approvisionnement");
  useApresSucces(etat, onFermer);
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-cream-200 bg-white p-3">
      <input type="hidden" name="sessionId" value={session.id} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Mouvement interne — seuils décaissement : ≤ {SEUILS_DECAISSEMENT.validation.toLocaleString("fr-FR")} F automatique,
        au-delà validation Gestionnaire, &gt; {SEUILS_DECAISSEMENT.direction.toLocaleString("fr-FR")} F Direction.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES_MOUVEMENT_SAISISSABLES.map((t) => (
            <option key={t} value={t}>{LIBELLE_MOUVEMENT_CAISSE[t]}</option>
          ))}
        </Select>
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Input name="pieceJustificative" maxLength={120} placeholder="Réf. pièce justificative" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {type === "decaissement" && <Input name="beneficiaire" required maxLength={120} placeholder="Bénéficiaire (obligatoire)" />}
        <Input name="motif" maxLength={300} placeholder={type === "approvisionnement" || type === "retrait_banque" || type === "versement_banque" ? "Motif (facultatif)" : "Motif (obligatoire)"} />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton className="w-auto px-5">Enregistrer le mouvement</SubmitButton>
        <button type="button" onClick={onFermer} className="h-9 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
      </div>
    </form>
  );
}

function FormTransfert({ session, caisses, onFermer }: { session: SessionCaisseVue; caisses: CaisseVue[]; onFermer: () => void }) {
  const [etat, action] = useActionState(transfertEntreCaisses, INITIAL);
  useApresSucces(etat, onFermer);
  const cibles = caisses.filter((c) => c.id !== session.caisseId && c.statut === "active");
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-cream-200 bg-white p-3">
      <input type="hidden" name="sessionSourceId" value={session.id} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Transfert vers une autre caisse (sa session doit être OUVERTE — RM-500)
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="caisseCibleId" required defaultValue="">
          <option value="" disabled>Caisse cible…</option>
          {cibles.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}{c.ouverte ? "" : " (fermée)"}</option>
          ))}
        </Select>
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Input name="motif" maxLength={300} placeholder="Motif (facultatif)" />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton className="w-auto px-5"><ArrowLeftRight size={14} /> Transférer</SubmitButton>
        <button type="button" onClick={onFermer} className="h-9 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
      </div>
    </form>
  );
}

function FormCloture({ session, onFermer }: { session: SessionCaisseVue; onFermer: () => void }) {
  const [etat, action] = useActionState(cloturerSession, INITIAL);
  const [soldeReel, setSoldeReel] = useState("");
  useApresSucces(etat, onFermer);
  const ecartEstime = soldeReel === "" ? null : Number(soldeReel) - session.soldeTheorique;
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-red-200 bg-white p-3">
      <input type="hidden" name="id" value={session.id} />
      <input type="hidden" name="version" value={session.version} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Clôture — comptage PHYSIQUE (solde théorique : {fcfa(session.soldeTheorique)})
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          name="soldeReel" required inputMode="numeric" placeholder="Solde réel compté (0 accepté)"
          value={soldeReel} onChange={(e) => setSoldeReel(e.target.value.replace(/[^\d]/g, ""))}
        />
        <Input name="motifEcart" maxLength={300} placeholder="Justification (obligatoire si écart)" />
      </div>
      {ecartEstime !== null && ecartEstime !== 0 && (
        <p className="text-xs font-medium text-red-700">
          Écart estimé : {ecartEstime > 0 ? "+" : ""}{ecartEstime.toLocaleString("fr-FR")} F ({ecartEstime > 0 ? "excédent" : "déficit"}) —
          il devra être VALIDÉ par un second acteur.
        </p>
      )}
      <div className="flex items-center gap-2">
        <SubmitButton className="w-auto px-5"><Lock size={14} /> Clôturer la session</SubmitButton>
        <button type="button" onClick={onFermer} className="h-9 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Sessions récentes (clôturées) + validation des écarts
// ─────────────────────────────────────────────────────────────

function SessionsRecentes({
  sessions, peutEcrire, onJournal,
}: {
  sessions: SessionCaisseVue[];
  peutEcrire: boolean;
  onJournal: (s: SessionCaisseVue) => void;
}) {
  return (
    <Card>
      <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <ClipboardList size={18} className="text-forest-600" /> Sessions clôturées récentes
      </h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucune session clôturée pour l&apos;instant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Caisse</th>
                <th className="py-1.5 pr-2">Caissier</th>
                <th className="py-1.5 pr-2">Clôturée le</th>
                <th className="py-1.5 pr-2 text-right">Théorique</th>
                <th className="py-1.5 pr-2 text-right">Réel</th>
                <th className="py-1.5 pr-2">Écart</th>
                <th className="py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-2 font-medium text-forest-900">{s.caisseNom}</td>
                  <td className="py-2 pr-2">{s.caissierNom}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{s.clotureeLe ? dateHeureFr(s.clotureeLe) : "—"}</td>
                  <td className="py-2 pr-2 text-right">{fcfa(s.soldeTheorique)}</td>
                  <td className="py-2 pr-2 text-right">{s.soldeReel !== null ? fcfa(s.soldeReel) : "—"}</td>
                  <td className="py-2 pr-2">
                    {s.ecart === null || s.ecart === 0 ? (
                      <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-800">Aucun</span>
                    ) : (
                      <span
                        title={s.motifEcart ?? undefined}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.ecartValide ? "bg-gold-100 text-gold-800" : "bg-red-100 text-red-700"}`}
                      >
                        {s.ecart > 0 ? "+" : ""}{s.ecart.toLocaleString("fr-FR")} F {s.ecartValide ? "(validé)" : "(à valider)"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => onJournal(s)} title="Journal de caisse" className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50">
                      <Printer size={13} />
                    </button>
                    {peutEcrire && s.ecart !== null && s.ecart !== 0 && !s.ecartValide && (
                      <BoutonActionConfirmee
                        libelle="Valider l'écart" icone={ShieldCheck} ton="primaire"
                        action={validerEcartSession}
                        champs={{ id: s.id, version: String(s.version) }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Journal de caisse imprimable (A4 — patron officiel)
// ─────────────────────────────────────────────────────────────

function JournalCaisseImprimable({
  session: s, entete, onFermer,
}: {
  session: SessionCaisseVue;
  entete: EnteteEtablissement;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #journal-caisse-impression, #journal-caisse-impression * { visibility: visible; }
          #journal-caisse-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div id="journal-caisse-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Journal de caisse</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
            <X size={18} />
          </button>
        </div>

        <EnTeteOfficielDoc
          etab={entete}
          titre="JOURNAL DE CAISSE"
          sousTitre={`${s.caisseNom} · Caissier : ${s.caissierNom}`}
        />

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Ouverture</dt><dd>{dateHeureFr(s.ouverteLe)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Clôture</dt><dd>{s.clotureeLe ? dateHeureFr(s.clotureeLe) : "Session en cours"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Fonds initial</dt><dd className="font-semibold">{fcfa(s.fondsInitial)}</dd></div>
          {s.observations && <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Observations</dt><dd className="text-right">{s.observations}</dd></div>}
        </dl>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-ink-700/55">
              <th className="py-1.5 pr-2">Heure</th>
              <th className="py-1.5 pr-2">Opération</th>
              <th className="py-1.5 pr-2">Catégorie</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {s.journal.length === 0 ? (
              <tr><td colSpan={4} className="py-3 text-center text-ink-700/55">Aucun mouvement.</td></tr>
            ) : (
              s.journal.map((l) => (
                <tr key={l.id} className={l.annule ? "text-ink-700/40 line-through" : ""}>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(new Date(l.heure))}</td>
                  <td className="py-1.5 pr-2">{l.libelle}</td>
                  <td className="py-1.5 pr-2 text-xs text-ink-700/70">{LIBELLE_MOUVEMENT_CAISSE[l.categorie] ?? l.categorie}</td>
                  <td className={`py-1.5 text-right font-medium ${l.sens > 0 ? "text-forest-700" : "text-red-700"}`}>
                    {l.sens > 0 ? "+" : "−"}{fcfa(l.montant)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-cream-300 font-bold text-forest-900">
              <td className="py-2 pr-2" colSpan={3}>Encaissements · Décaissements</td>
              <td className="py-2 text-right">{fcfa(s.totalEncaissements)} · {fcfa(s.totalDecaissements)}</td>
            </tr>
            <tr className="font-bold text-forest-900">
              <td className="py-1.5 pr-2" colSpan={3}>Solde théorique</td>
              <td className="py-1.5 text-right">{fcfa(s.soldeTheorique)}</td>
            </tr>
            {s.soldeReel !== null && (
              <tr>
                <td className="py-1 pr-2" colSpan={3}>Solde réel compté · Écart</td>
                <td className="py-1 text-right">
                  {fcfa(s.soldeReel)} · {s.ecart === 0 || s.ecart === null ? "aucun" : `${s.ecart > 0 ? "+" : ""}${s.ecart.toLocaleString("fr-FR")} F`}
                </td>
              </tr>
            )}
            {s.motifEcart && (
              <tr><td colSpan={4} className="py-1 text-xs italic text-ink-700/70">Justification de l&apos;écart : {s.motifEcart}{s.ecartValide ? " (écart validé)" : " (en attente de validation)"}</td></tr>
            )}
          </tfoot>
        </table>

        <div className="mt-10 flex justify-between">
          <div className="text-center text-xs text-ink-700/60">
            <p className="mb-8">Le Caissier</p>
            <p className="border-t border-ink-700/30 pt-1">Signature</p>
          </div>
          <div className="text-center text-xs text-ink-700/60">
            <p className="mb-8">Le Superviseur</p>
            <p className="border-t border-ink-700/30 pt-1">Signature</p>
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

/** Annulation d'un mouvement interne (session OUVERTE uniquement — RM-505). */
export function BoutonAnnulerMouvementCaisse({ id, version }: { id: string; version: number }) {
  return (
    <BoutonActionConfirmee
      libelle="Annuler" icone={Ban} ton="danger"
      action={annulerMouvementCaisse}
      champs={{ id, version: String(version) }}
    />
  );
}
