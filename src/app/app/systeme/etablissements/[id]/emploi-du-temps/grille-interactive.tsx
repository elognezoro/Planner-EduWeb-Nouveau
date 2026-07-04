"use client";

import { Fragment, useState, useTransition } from "react";
import { Move, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { deplacerCreneau } from "./actions";

export interface CreneauPlain {
  id: string;
  classeId: string;
  classeNom: string;
  disciplineId: string;
  disciplineNom: string;
  enseignantId: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
  duree: number;
}

export function GrilleInteractive({
  classeId,
  creneaux,
  creneauxParJour,
  jours,
  couleurs,
  horaires,
  bandes,
}: {
  classeId: string;
  creneaux: CreneauPlain[];
  creneauxParJour: number;
  jours: string[];
  couleurs: Record<string, string | null>;
  horaires?: { debut: string; fin: string }[];
  /** Bandes de pause (RÉCRÉATION / PAUSE DÉJEUNER) insérées après certaines périodes. */
  bandes?: { apresPeriode: number; libelle: string }[];
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const N = Math.max(1, creneauxParJour);
  const periodes = Array.from({ length: N }, (_, i) => i);

  const dansClasse = creneaux.filter((c) => c.classeId === classeId);
  const parCle = new Map(dansClasse.map((c) => [`${c.jour}:${c.periode}`, c]));
  const couvert = new Set<string>();
  for (const c of dansClasse) for (let d = 1; d < c.duree; d++) couvert.add(`${c.jour}:${c.periode + d}`);

  function conflit(c: CreneauPlain, jour: number, periode: number): string | null {
    if (periode + c.duree > N) return "Position hors de la grille.";
    for (let d = 0; d < c.duree; d++) {
      const p = periode + d;
      for (const o of creneaux) {
        if (o.id === c.id) continue;
        if (o.jour !== jour) continue;
        if (p < o.periode || p >= o.periode + o.duree) continue;
        if (o.enseignantId === c.enseignantId) return `${c.enseignantNom} a déjà cours à ce créneau.`;
        if (o.classeId === c.classeId) return `${c.classeNom} a déjà cours à ce créneau.`;
        if (o.salleNom === c.salleNom) return `La salle ${c.salleNom} est déjà occupée.`;
      }
    }
    return null;
  }

  function deposer(jour: number, periode: number) {
    const c = creneaux.find((x) => x.id === dragId);
    setDragId(null);
    setSurvol(null);
    if (!c) return;
    if (c.jour === jour && c.periode === periode) return;
    const c2 = conflit(c, jour, periode);
    if (c2) {
      setMessage({ type: "err", text: c2 });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const r = await deplacerCreneau(c.id, jour, periode);
      setMessage(r.ok ? { type: "ok", text: "Créneau déplacé." } : { type: "err", text: r.message ?? "Déplacement refusé." });
    });
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-ink-700/60">
        <Move size={14} /> Glissez un cours vers une case libre pour l&apos;ajuster — les conflits sont
        re-vérifiés en temps réel.
      </p>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${message.type === "ok" ? "border-forest-200 bg-forest-50 text-forest-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.type === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      <div className="relative overflow-x-auto">
        {pending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40">
            <Loader2 className="animate-spin text-forest-600" />
          </div>
        )}
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-cream-200 bg-cream-50 px-2 py-2 text-xs font-semibold text-ink-700/60">Horaire</th>
              {jours.map((j) => (
                <th key={j} className="border border-cream-200 bg-cream-50 px-2 py-2 text-xs font-semibold text-forest-800">{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodes.map((per) => (
              <Fragment key={per}>
                <tr>
                <td className="whitespace-nowrap border border-cream-200 bg-cream-50 px-2 py-2 text-center text-[0.7rem] font-medium text-ink-700/60">
                  {horaires?.[per] ? (
                    <span className="leading-tight">
                      {horaires[per].debut}
                      <span className="block text-ink-700/40">{horaires[per].fin}</span>
                    </span>
                  ) : (
                    `P${per + 1}`
                  )}
                </td>
                {jours.map((_, jour) => {
                  const k = `${jour}:${per}`;
                  if (couvert.has(k)) return null;
                  const c = parCle.get(k);
                  if (c) {
                    const couleur = couleurs[c.disciplineId] ?? "#154231";
                    return (
                      <td
                        key={jour}
                        rowSpan={c.duree}
                        className="relative border border-cream-200 p-1.5 align-top"
                      >
                        {/* Fond coloré qui remplit tout le bloc (même sur 2 périodes) — évite la zone blanche trompeuse. */}
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-1.5 rounded-lg"
                          style={{ backgroundColor: `${couleur}1a`, borderLeft: `3px solid ${couleur}` }}
                        />
                        <div
                          draggable
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => setDragId(null)}
                          className={`relative cursor-grab px-2 py-1.5 transition-opacity active:cursor-grabbing ${dragId === c.id ? "opacity-40" : ""}`}
                        >
                          <p className="text-xs font-semibold text-forest-900">{c.disciplineNom}</p>
                          <p className="text-[0.65rem] text-ink-700/70">{c.salleNom}</p>
                          <p className="text-[0.65rem] text-ink-700/55">{c.enseignantNom}</p>
                        </div>
                      </td>
                    );
                  }
                  const estSurvol = survol === k && dragId;
                  return (
                    <td
                      key={jour}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (survol !== k) setSurvol(k);
                      }}
                      onDragLeave={() => setSurvol((s) => (s === k ? null : s))}
                      onDrop={() => deposer(jour, per)}
                      className={`h-12 border border-cream-100 transition-colors ${estSurvol ? "bg-gold-100" : ""}`}
                    />
                  );
                })}
                </tr>
                {/* Bandes de pause : RÉCRÉATION / PAUSE DÉJEUNER (aucun cours ne les traverse). */}
                {bandes
                  ?.filter((b) => b.apresPeriode === per)
                  .map((b) => (
                    <tr key={`pause-${per}-${b.libelle}`}>
                      <td colSpan={jours.length + 1} className="border border-cream-200 bg-gold-100/80 p-0">
                        <p className="py-1.5 text-center text-[0.7rem] font-bold uppercase tracking-[0.4em] text-gold-800">
                          {b.libelle}
                        </p>
                      </td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
