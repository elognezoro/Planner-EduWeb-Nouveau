"use client";

// Petits éléments de formulaire partagés par les deux blocs de la page « Convertisseur CSV ».

export const champStyle =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-base outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700/70">{label}</span>
      {children}
    </label>
  );
}

export function SelectCol({
  value,
  onChange,
  nb,
  label,
  optionnel,
}: {
  value: number;
  onChange: (v: number) => void;
  nb: number;
  label: (i: number) => string;
  optionnel?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={champStyle}>
      {optionnel && <option value={-1}>— (aucune) —</option>}
      {Array.from({ length: nb }, (_, i) => (
        <option key={i} value={i}>
          {label(i)}
        </option>
      ))}
    </select>
  );
}
