"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label, FieldError, inputBase } from "@/components/ui/form";
import { CRITERES_MOT_DE_PASSE, evaluerForce, type NiveauForce } from "@/lib/validation/mot-de-passe";

/** Couleur de la barre de force par niveau (du rouge au vert forêt). */
const COULEUR_BARRE: Record<Exclude<NiveauForce, "vide">, string> = {
  "tres-faible": "bg-red-500",
  faible: "bg-orange-500",
  moyen: "bg-amber-500",
  fort: "bg-lime-500",
  "tres-fort": "bg-forest-600",
};

/**
 * Champ de saisie de mot de passe : révélation (œil), et — lorsque `avecCriteres` — barre de
 * force + liste des critères de sécurité qui se valident au fur et à mesure de la saisie
 * (affichée dès le premier caractère). Les critères viennent de @/lib/validation/mot-de-passe,
 * la même source que le contrôle serveur : ce qui est coché EST ce qui est réellement exigé.
 */
export function ChampMotDePasse({
  id,
  name,
  label,
  required,
  autoComplete = "new-password",
  placeholder,
  messages,
  avecCriteres = true,
}: {
  id?: string;
  name: string;
  label: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  messages?: string[];
  avecCriteres?: boolean;
}) {
  const reactId = useId();
  const champId = id ?? reactId;
  const critereListId = `${champId}-criteres`;
  const [valeur, setValeur] = useState("");
  const [visible, setVisible] = useState(false);
  const force = evaluerForce(valeur);
  const largeur = force.total ? (force.respectes / force.total) * 100 : 0;

  return (
    <div>
      <Label htmlFor={champId}>{label}</Label>
      <div className="relative">
        <input
          id={champId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          aria-describedby={avecCriteres && valeur ? critereListId : undefined}
          className={cn(inputBase, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-700/50 transition-colors hover:bg-cream-100 hover:text-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-200"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      <FieldError messages={messages} />

      {avecCriteres && valeur.length > 0 && (
        <div id={critereListId} className="mt-2.5 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-200">
              <div
                className={cn("h-full rounded-full transition-all duration-300", COULEUR_BARRE[force.niveau as Exclude<NiveauForce, "vide">] ?? "bg-cream-300")}
                style={{ width: `${largeur}%` }}
              />
            </div>
            <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-700/55">
              {force.libelle}
            </span>
          </div>

          <div className="rounded-xl border border-cream-200 bg-cream-50/70 p-3">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-700/45">
              Le mot de passe doit contenir :
            </p>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {CRITERES_MOT_DE_PASSE.map((critere) => {
                const ok = critere.teste(valeur);
                return (
                  <li
                    key={critere.id}
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors",
                      ok ? "font-medium text-forest-700" : "text-ink-700/40",
                    )}
                  >
                    {ok ? (
                      <Check size={14} className="shrink-0 text-forest-600" aria-hidden />
                    ) : (
                      <Circle size={14} className="shrink-0 text-ink-700/25" aria-hidden />
                    )}
                    <span>{critere.libelle}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
