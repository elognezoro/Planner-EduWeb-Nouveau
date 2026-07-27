"use client";

import * as React from "react";
import { SlidersHorizontal, MessageSquareText, Zap, Users, Info, CheckCircle2 } from "lucide-react";
import { VARIABLES_MODELE, type ParametrageAlertes } from "@/lib/alertes/modeles";
import { enregistrerReglagesAlertes, enregistrerModelesAlertes, lancerPasseAlertes } from "./actions";
import { Card } from "@/components/app/ui";

const inputCls =
  "w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

function Message({ m }: { m: { ok: boolean; texte: string } | null }) {
  if (!m) return null;
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${m.ok ? "border-forest-200 bg-forest-50 text-forest-800" : "border-red-200 bg-red-50 text-red-700"}`}>
      {m.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
      <span>{m.texte}</span>
    </div>
  );
}

export function ParametrageAlertesSection({
  etablissementId,
  parametrage,
  couverture,
}: {
  etablissementId: string;
  parametrage: ParametrageAlertes;
  couverture: { eleves: number; joignables: number };
}) {
  const [pending, startTransition] = React.useTransition();

  // Réglages & seuils
  const [seuilAbsences, setSeuilAbsences] = React.useState(String(parametrage.seuilAbsences));
  const [seuilRetards, setSeuilRetards] = React.useState(String(parametrage.seuilRetards));
  const [seuilNote, setSeuilNote] = React.useState(String(parametrage.seuilNote));
  const [canalSms, setCanalSms] = React.useState(parametrage.canalSms);
  const [canalEmail, setCanalEmail] = React.useState(parametrage.canalEmail);
  const [canalInApp, setCanalInApp] = React.useState(parametrage.canalInApp);
  const [canalWhatsApp, setCanalWhatsApp] = React.useState(parametrage.canalWhatsApp);
  const [telEtab, setTelEtab] = React.useState(parametrage.telEtablissement ?? "");
  const [msgReglages, setMsgReglages] = React.useState<{ ok: boolean; texte: string } | null>(null);

  // Modèles
  const [modeleAbsence, setModeleAbsence] = React.useState(parametrage.modeleAbsence);
  const [modeleRetard, setModeleRetard] = React.useState(parametrage.modeleRetard);
  const [modeleNotes, setModeleNotes] = React.useState(parametrage.modeleNotes);
  const [msgModeles, setMsgModeles] = React.useState<{ ok: boolean; texte: string } | null>(null);

  // Moteur
  const [msgPasse, setMsgPasse] = React.useState<{ ok: boolean; texte: string } | null>(null);

  const couverturePct = couverture.eleves > 0 ? Math.round((couverture.joignables / couverture.eleves) * 100) : 0;

  function enregistrerReglages() {
    setMsgReglages(null);
    startTransition(async () => {
      const r = await enregistrerReglagesAlertes(etablissementId, {
        seuilAbsences: Number(seuilAbsences), seuilRetards: Number(seuilRetards), seuilNote: Number(seuilNote),
        canalSms, canalEmail, canalInApp, canalWhatsApp, telEtablissement: telEtab.trim() || null,
      });
      setMsgReglages({ ok: r.ok, texte: r.message ?? (r.ok ? "Enregistré." : "Échec.") });
    });
  }
  function enregistrerModeles() {
    setMsgModeles(null);
    startTransition(async () => {
      const r = await enregistrerModelesAlertes(etablissementId, { modeleAbsence, modeleRetard, modeleNotes });
      setMsgModeles({ ok: r.ok, texte: r.message ?? (r.ok ? "Enregistré." : "Échec.") });
    });
  }
  function lancer() {
    setMsgPasse(null);
    startTransition(async () => {
      const r = await lancerPasseAlertes(etablissementId);
      setMsgPasse({ ok: r.ok, texte: r.message ?? (r.ok ? "Terminé." : "Échec.") });
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Réglages & seuils ── */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-forest-700" />
          <h2 className="font-display text-base font-bold text-forest-900">Seuils & canaux d'alerte</h2>
        </div>
        <Message m={msgReglages} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Champ label="Seuil d'absences non justifiées" value={seuilAbsences} setValue={setSeuilAbsences} aide="0 = désactivé" />
          <Champ label="Seuil de retards non justifiés" value={seuilRetards} setValue={setSeuilRetards} aide="0 = désactivé" />
          <Champ label="Alerte si moyenne < (/20)" value={seuilNote} setValue={setSeuilNote} aide="0 = désactivé" />
        </div>
        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Canaux</span>
          <div className="flex flex-wrap gap-3">
            <Canal libelle="SMS" actif={canalSms} set={setCanalSms} />
            <Canal libelle="E-mail" actif={canalEmail} set={setCanalEmail} bientot />
            <Canal libelle="Notification" actif={canalInApp} set={setCanalInApp} bientot />
            <Canal libelle="WhatsApp" actif={canalWhatsApp} set={setCanalWhatsApp} bientot />
          </div>
          <p className="mt-1.5 text-xs text-ink-700/60">Seul le canal SMS est transmis aujourd'hui ; les autres sont prêts à brancher.</p>
        </div>
        <div className="mt-4 max-w-sm">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Téléphone de l'établissement <span className="text-ink-700/50">(variable {"{TEL_ETAB}"})</span></label>
          <input value={telEtab} onChange={(e) => setTelEtab(e.target.value)} placeholder="+225 ..." className={inputCls} />
        </div>
        <div className="mt-4">
          <BoutonPrincipal onClick={enregistrerReglages} pending={pending}>Enregistrer les réglages</BoutonPrincipal>
        </div>
      </Card>

      {/* ── Modèles de message ── */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareText size={18} className="text-forest-700" />
          <h2 className="font-display text-base font-bold text-forest-900">Modèles de SMS</h2>
        </div>
        <Message m={msgModeles} />
        <div className="mb-4 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-xs text-ink-700/70">
          Variables disponibles :{" "}
          {VARIABLES_MODELE.map((v) => (
            <code key={v.jeton} className="mx-0.5 rounded bg-white px-1.5 py-0.5 font-mono text-forest-800" title={v.desc}>{v.jeton}</code>
          ))}
        </div>
        <div className="space-y-3">
          <Modele label="Modèle — Absences" value={modeleAbsence} setValue={setModeleAbsence} />
          <Modele label="Modèle — Retards" value={modeleRetard} setValue={setModeleRetard} />
          <Modele label="Modèle — Notes en baisse" value={modeleNotes} setValue={setModeleNotes} />
        </div>
        <div className="mt-4">
          <BoutonPrincipal onClick={enregistrerModeles} pending={pending}>Enregistrer les modèles</BoutonPrincipal>
        </div>
      </Card>

      {/* ── Moteur + Carnet ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Zap size={18} className="text-forest-700" />
            <h2 className="font-display text-base font-bold text-forest-900">Moteur d'alertes</h2>
          </div>
          <p className="mb-4 text-sm text-ink-700/70">
            Lance une passe : la plateforme calcule, pour chaque élève, ses absences et retards non justifiés
            et sa moyenne, puis envoie un SMS aux parents des élèves qui franchissent un seuil (une alerte par
            élève, sans doublon dans la journée). Une passe automatique quotidienne est aussi exécutée.
          </p>
          <Message m={msgPasse} />
          <BoutonPrincipal onClick={lancer} pending={pending}>Lancer une passe d'alertes maintenant</BoutonPrincipal>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Users size={18} className="text-forest-700" />
            <h2 className="font-display text-base font-bold text-forest-900">Carnet de contacts</h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-forest-900">{couverturePct}%</span>
            <span className="text-sm text-ink-700/70">des élèves ont un parent joignable par SMS</span>
          </div>
          <p className="mt-2 text-sm text-ink-700/70">
            <strong>{couverture.joignables}</strong> élève(s) joignable(s) sur <strong>{couverture.eleves}</strong>.
          </p>
          <p className="mt-3 text-xs text-ink-700/55">
            Les contacts proviennent des liens parent-élève réels (numéros des comptes parents). Pour améliorer la
            couverture, complétez les numéros dans « Liens parent-élève ».
          </p>
        </Card>
      </div>
    </div>
  );
}

function Champ({ label, value, setValue, aide }: { label: string; value: string; setValue: (v: string) => void; aide?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-forest-900">{label}</label>
      <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} />
      {aide && <p className="mt-1 text-xs text-ink-700/55">{aide}</p>}
    </div>
  );
}

function Canal({ libelle, actif, set, bientot }: { libelle: string; actif: boolean; set: (v: boolean) => void; bientot?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-2xl border border-cream-300 px-3 py-2 text-sm">
      <input type="checkbox" checked={actif} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-forest-700" />
      <span className="text-forest-900">{libelle}</span>
      {bientot && <span className="rounded-full bg-cream-200 px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink-700/60">à venir</span>}
    </label>
  );
}

function Modele({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-forest-900">{label}</label>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={2} className={`${inputCls} resize-y`} maxLength={320} />
      <p className="mt-1 text-right text-xs text-ink-700/50">{value.length}/320</p>
    </div>
  );
}

function BoutonPrincipal({ onClick, pending, children }: { onClick: () => void; pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition hover:bg-forest-700 disabled:opacity-60"
    >
      {pending ? "…" : children}
    </button>
  );
}
