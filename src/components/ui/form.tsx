"use client";

import { useFormStatus } from "react-dom";
import { Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm text-ink-900 shadow-sm outline-none transition-all placeholder:text-ink-700/40 focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60";

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-sm font-medium text-forest-900", className)}
    >
      {children}
    </label>
  );
}

/**
 * Téléphone : plancher de confort pour les champs compacts des pages denses (Finances…).
 * - police réduite par l'appelant (« text-xs » = 14 px, « text-[0.8rem] »…) : sous 16 px, iOS
 *   zoome toute la page au focus → « mobile:text-sm » (16 px) ;
 * - hauteur réduite (« h-7 » à « h-10 ») : cible tactile sous 44 px → « mobile:min-h-11 ».
 * Seulement si l'appelant ne fixe pas lui-même sa variante mobile. Ordinateur et impression :
 * inchangés (classes « mobile: » uniquement).
 */
function plancherMobile(className?: string): string | undefined {
  if (!className) return undefined;
  const police = /(^|\s)text-(xs|\[(\d|0?\.))/.test(className) && !/mobile:text-/.test(className);
  const hauteur = /(^|\s)h-(7|8|9|10)(\s|$)/.test(className) && !/mobile:(min-)?h-/.test(className);
  return cn(police && "mobile:text-sm", hauteur && "mobile:min-h-11") || undefined;
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className, plancherMobile(className))} {...props} />;
}

/**
 * Téléphone : chevron dessiné en image de fond (vert forêt), sans élément supplémentaire.
 * « appearance-none » retire la flèche native : sans repère, la liste déroulante ressemblait à
 * une zone de texte. Ordinateur et impression : inchangés (classes « mobile: »).
 */
const CHEVRON_SELECT_MOBILE =
  "mobile:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%23246a48%27%20stroke-width=%272.2%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E)] mobile:bg-no-repeat mobile:bg-[position:right_0.875rem_center] mobile:bg-[length:1.125rem] mobile:pr-10";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "appearance-none", CHEVRON_SELECT_MOBILE, className, plancherMobile(className))} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1.5 text-xs text-red-600">{messages[0]}</p>;
}

export function FormAlert({
  ton,
  children,
}: {
  ton: "erreur" | "succes" | "info";
  children: React.ReactNode;
}) {
  const Icone = ton === "erreur" ? AlertCircle : ton === "info" ? Info : CheckCircle2;
  const styles =
    ton === "erreur"
      ? "border-red-200 bg-red-50 text-red-700"
      : ton === "info"
        ? "border-gold-200 bg-gold-50 text-forest-800"
        : "border-forest-200 bg-forest-50 text-forest-800";
  return (
    <div
      role={ton === "erreur" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm",
        styles,
      )}
    >
      <Icone size={17} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SubmitButton({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:bg-forest-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-70",
        // Téléphone : un libellé long (« Enregistrer les effectifs enseignants ») passe sur deux
        // lignes SANS déborder de la pilule (hauteur libre, 44 px minimum) ; seul dans sa rangée
        // (« flex justify-end », « flex items-end »…), le bouton occupe toute la largeur, à portée
        // du pouce — même si la page passe « w-auto ». Ordinateur et impression : inchangés.
        "mobile:h-auto mobile:min-h-11 mobile:py-2.5 mobile:text-center mobile:leading-tight mobile:only:w-full",
        className,
      )}
    >
      {pending && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
