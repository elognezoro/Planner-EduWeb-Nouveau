"use client";

import { useFormStatus } from "react-dom";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
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

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "appearance-none", className)} {...props}>
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
  ton: "erreur" | "succes";
  children: React.ReactNode;
}) {
  const Icone = ton === "erreur" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={ton === "erreur" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm",
        ton === "erreur"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-forest-200 bg-forest-50 text-forest-800",
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:bg-forest-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
    >
      {pending && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
