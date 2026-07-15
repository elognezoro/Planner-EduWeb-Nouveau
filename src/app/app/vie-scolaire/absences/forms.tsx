"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { soumettreDemande, analyserAbsence, type EtatForm, type AnalyseAbsence } from "./actions";
import { Label, Input, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const estIsoJour = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function DemandeAbsenceForm() {
  const [etat, action] = useActionState(soumettreDemande, initial);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [analyse, setAnalyse] = useState<AnalyseAbsence | null>(null);
  const [suppleantIds, setSuppleantIds] = useState<string[]>([]);
  const [rattrapage, setRattrapage] = useState<string[]>([]);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [pending, startTransition] = useTransition();

  const datesValides = estIsoJour(dateDebut) && estIsoJour(dateFin) && dateFin >= dateDebut;

  // L'analyse (classes affectées + suppléants) est recalculée côté serveur dès qu'une date change.
  function majDates(nd: string, nf: string) {
    setDateDebut(nd);
    setDateFin(nf);
    setSuppleantIds([]);
    setRattrapage([]);
    if (estIsoJour(nd) && estIsoJour(nf) && nf >= nd) {
      startTransition(async () => {
        const res = await analyserAbsence(nd, nf);
        setAnalyse(res);
      });
    } else {
      setAnalyse(null);
    }
  }

  const toggleSuppleant = (id: string) =>
    setSuppleantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const ajouterDate = () => {
    if (estIsoJour(nouvelleDate) && !rattrapage.includes(nouvelleDate)) {
      setRattrapage((prev) => [...prev, nouvelleDate].sort());
      setNouvelleDate("");
    }
  };

  const estEnseignant = analyse?.estEnseignant ?? false;
  const classes = analyse?.classes ?? [];
  const suppleants = analyse?.suppleants ?? [];
  const avecSuppleance = suppleantIds.length > 0;
  const montrerRattrapage = estEnseignant && !avecSuppleance && (analyse?.nbSeances ?? 0) > 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="suppleantIds" value={JSON.stringify(suppleantIds)} />
      <input type="hidden" name="datesRattrapage" value={JSON.stringify(montrerRattrapage ? rattrapage : [])} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="dateDebut">Du</Label>
          <Input id="dateDebut" name="dateDebut" type="date" required value={dateDebut} onChange={(e) => majDates(e.target.value, dateFin)} />
        </div>
        <div>
          <Label htmlFor="dateFin">Au</Label>
          <Input id="dateFin" name="dateFin" type="date" required value={dateFin} min={dateDebut || undefined} onChange={(e) => majDates(dateDebut, e.target.value)} />
        </div>
      </div>
      {dateDebut && dateFin && !datesValides && (
        <p className="text-xs text-red-600">La date de fin doit être postérieure ou égale à la date de début.</p>
      )}

      <div>
        <Label htmlFor="motif">Motif (facultatif)</Label>
        <textarea
          id="motif" name="motif" rows={2} maxLength={400}
          placeholder="Ex. : convocation administrative, raison de santé, événement familial…"
          className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm text-ink-900 shadow-sm outline-none transition-all placeholder:text-ink-700/40 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      {pending && (
        <p className="flex items-center gap-2 text-sm text-ink-700/60"><Loader2 size={15} className="animate-spin" /> Analyse de votre emploi du temps…</p>
      )}

      {datesValides && estEnseignant && !pending && (
        <div className="space-y-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-forest-900">
              Classes pédagogiques affectées <span className="font-normal text-ink-700/55">({analyse?.nbSeances ?? 0} séance(s))</span>
            </p>
            {classes.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune séance de votre emploi du temps ne tombe sur cette période.</p>
            ) : (
              <ul className="space-y-1.5">
                {classes.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm">
                    <span className="font-medium text-forest-900">{c.classeNom} · {c.disciplineNom}</span>
                    <span className="text-xs text-ink-700/60">{c.jours.map((j) => JOURS[j]).join(", ")} · {c.nbSeances} séance(s)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {classes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-forest-900">Suppléance (collègues de même spécialité et cycle)</p>
              {suppleants.length === 0 ? (
                <p className="text-sm text-ink-700/60">Aucun collègue compatible trouvé — prévoyez plutôt un rattrapage ci-dessous.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suppleants.map((s) => {
                    const actif = suppleantIds.includes(s.id);
                    return (
                      <button
                        type="button" key={s.id} onClick={() => toggleSuppleant(s.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${actif ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-forest-800 hover:bg-forest-50"}`}
                        title={`${s.disciplines.join(", ")}${s.cycles.length ? " · " + s.cycles.join(", ") : ""}`}
                      >
                        {s.nom}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {montrerRattrapage && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-forest-900">Dates de rattrapage prévues</p>
              <p className="mb-2 text-xs text-ink-700/60">Sans suppléance, indiquez les dates auxquelles vous rattraperez les séances affectées.</p>
              {rattrapage.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {rattrapage.map((iso) => (
                    <li key={iso} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-forest-800">
                      {iso}
                      <button type="button" onClick={() => setRattrapage((prev) => prev.filter((x) => x !== iso))} className="text-ink-700/50 hover:text-red-600">
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date" value={nouvelleDate} min={dateDebut || undefined} onChange={(e) => setNouvelleDate(e.target.value)}
                  className="rounded-2xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                />
                <button type="button" onClick={ajouterDate} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-2 text-xs font-medium text-forest-800 hover:bg-forest-50">
                  <Plus size={14} /> Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <SubmitButton className="inline-flex w-auto items-center gap-2 px-6" disabled={!datesValides}>
        <CalendarPlus size={16} /> Envoyer la demande
      </SubmitButton>
    </form>
  );
}
