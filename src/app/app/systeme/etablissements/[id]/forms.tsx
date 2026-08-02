"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { creerSalle, creerClasse, modifierSalle, supprimerSalle, type EtatForm } from "../actions";
import { Input, Label, Select, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

const TYPES_SALLE = [
  { v: "ordinaire", l: "Salle ordinaire" },
  { v: "laboratoire", l: "Laboratoire" },
  { v: "salle_informatique", l: "Salle informatique" },
  { v: "atelier", l: "Atelier" },
  { v: "salle_eps", l: "Salle / espace EPS" },
  { v: "autre", l: "Autre" },
];

export function SalleForm({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(creerSalle, initial);
  const err = etat.erreurs ?? {};
  return (
    <form action={action} className="space-y-3">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="salle-nom">Nom</Label>
          <Input id="salle-nom" name="nom" required placeholder="Salle 12" />
          <FieldError messages={err.nom} />
        </div>
        <div>
          <Label htmlFor="salle-capacite">Capacité</Label>
          <Input id="salle-capacite" name="capacite" type="number" min={0} defaultValue={40} />
        </div>
        <div>
          <Label htmlFor="salle-type">Type</Label>
          <Select id="salle-type" name="type" defaultValue="ordinaire">
            {TYPES_SALLE.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <SubmitButton className="w-auto px-6">Ajouter la salle</SubmitButton>
    </form>
  );
}

/**
 * Pastille d'une salle : modification EN LIGNE du nom et de la capacité (crayon) et suppression
 * en deux temps (clic sur ×, puis confirmation) — jamais de dialogue natif (règle projet).
 * Les emplois du temps déjà générés conservent l'ancien nom (dénormalisé) ; la prochaine
 * génération utilise la liste à jour.
 */
export function SalleChip({
  id,
  nom,
  capacite,
  typeLibelle,
}: {
  id: string;
  nom: string;
  capacite: number;
  typeLibelle: string;
}) {
  const [edition, setEdition] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [nouveauNom, setNouveauNom] = useState(nom);
  const [nouvelleCapacite, setNouvelleCapacite] = useState(String(capacite));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Rend le focus au crayon en sortie d'édition (parcours clavier ininterrompu).
  const crayonRef = useRef<HTMLButtonElement | null>(null);

  function annulerEdition() {
    setEdition(false);
    setNouveauNom(nom);
    setNouvelleCapacite(String(capacite));
    setMessage(null);
    requestAnimationFrame(() => crayonRef.current?.focus());
  }

  function enregistrer() {
    const propre = nouveauNom.trim();
    if (!propre) {
      setMessage("Nom requis.");
      return;
    }
    if (propre.length > 80) {
      setMessage("Nom trop long (80 caractères maximum).");
      return;
    }
    if (nouvelleCapacite.trim() === "") {
      setMessage("Capacité requise.");
      return;
    }
    const cap = Number(nouvelleCapacite);
    if (!Number.isInteger(cap) || cap < 0 || cap > 2000) {
      setMessage("Capacité entre 0 et 2000.");
      return;
    }
    if (propre === nom && cap === capacite) {
      annulerEdition();
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("salleId", id);
      fd.set("nom", propre);
      fd.set("capacite", String(cap));
      const res = await modifierSalle({ ok: false }, fd);
      if (res.ok) {
        // Aligne l'état local sur ce qui a été réellement enregistré (valeurs trimées).
        setNouveauNom(propre);
        setNouvelleCapacite(String(cap));
        setEdition(false);
        setMessage(null);
        requestAnimationFrame(() => crayonRef.current?.focus());
      } else {
        // Restitue l'erreur de CHAMP précise du serveur (zod) quand elle existe.
        const details = res.erreurs ? Object.values(res.erreurs).flat().filter(Boolean) : [];
        setMessage(details[0] ?? res.message ?? "Erreur technique.");
      }
    });
  }

  function supprimer() {
    start(async () => {
      const fd = new FormData();
      fd.set("salleId", id);
      const res = await supprimerSalle({ ok: false }, fd);
      setConfirme(false);
      setMessage(res.ok ? null : res.message ?? "Erreur technique.");
    });
  }

  if (edition) {
    return (
      <span className="inline-flex flex-col">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-forest-300 bg-white py-1.5 pl-2 pr-1.5 text-sm">
          <input
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") enregistrer();
              if (e.key === "Escape") annulerEdition();
            }}
            autoFocus
            maxLength={80}
            aria-label={`Nouveau nom pour ${nom}`}
            className="h-7 w-28 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-300"
          />
          <input
            value={nouvelleCapacite}
            // Champ texte à filtre numérique (pas type=number) : évite les valeurs fantômes
            // « e » / « - » que le navigateur affiche mais rapporte comme vides (badInput).
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) setNouvelleCapacite(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") enregistrer();
              if (e.key === "Escape") annulerEdition();
            }}
            inputMode="numeric"
            maxLength={4}
            aria-label={`Nouvelle capacité pour ${nom}`}
            className="h-7 w-16 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-300"
          />
          <span className="text-xs text-ink-700/50">pl.</span>
          {pending ? (
            <Loader2 size={14} className="animate-spin text-forest-600" />
          ) : (
            <>
              <button
                type="button"
                onClick={enregistrer}
                aria-label="Valider les modifications"
                title="Valider"
                className="rounded-full p-1 text-forest-700 hover:bg-forest-100"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={annulerEdition}
                aria-label="Annuler la modification"
                title="Annuler"
                className="rounded-full p-1 text-ink-700/45 hover:bg-cream-100"
              >
                <X size={14} />
              </button>
            </>
          )}
        </span>
        {message && <span role="alert" className="mt-1 max-w-56 text-[0.65rem] leading-tight text-red-600">{message}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-2 rounded-xl border border-cream-200 bg-cream-50 py-1.5 pl-3 pr-1.5 text-sm">
        <span className="font-medium text-forest-900">{nom}</span>
        <span className="text-xs text-ink-700/60">
          {typeLibelle} · {capacite} pl.
        </span>
        {!pending && !confirme && (
          <button
            type="button"
            ref={crayonRef}
            onClick={() => {
              // Resynchronise avec les valeurs COURANTES (elles ont pu changer depuis le
              // montage — autre onglet, autre gestionnaire) avant d'ouvrir l'édition : sans
              // cela, un état local périmé pourrait réécrire silencieusement l'ancien nom.
              setNouveauNom(nom);
              setNouvelleCapacite(String(capacite));
              setMessage(null);
              setEdition(true);
            }}
            aria-label={`Modifier ${nom}`}
            title={`Modifier ${nom} (nom, capacité)`}
            className="rounded-full p-1 text-ink-700/45 hover:bg-forest-50 hover:text-forest-700"
          >
            <Pencil size={13} />
          </button>
        )}
        {pending ? (
          <Loader2 size={14} className="animate-spin text-forest-600" />
        ) : confirme ? (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={supprimer}
              autoFocus
              className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-semibold text-white hover:bg-red-500"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirme(false)}
              className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-700/60 hover:bg-cream-100"
            >
              Annuler
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirme(true);
              setMessage(null);
            }}
            aria-label={`Supprimer ${nom}`}
            title={`Supprimer ${nom}`}
            className="rounded-full p-1 text-ink-700/45 hover:bg-red-50 hover:text-red-600"
          >
            <X size={14} />
          </button>
        )}
      </span>
      {message && <span className="mt-1 max-w-56 text-[0.65rem] leading-tight text-red-600">{message}</span>}
    </span>
  );
}

export function ClasseForm({
  etablissementId,
  niveaux,
}: {
  etablissementId: string;
  niveaux: { id: string; nom: string }[];
}) {
  const [etat, action] = useActionState(creerClasse, initial);
  const err = etat.erreurs ?? {};
  return (
    <form action={action} className="space-y-3">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="classe-nom">Nom</Label>
          <Input id="classe-nom" name="nom" required placeholder="6ème A" />
          <FieldError messages={err.nom} />
        </div>
        <div>
          <Label htmlFor="classe-niveau">Niveau</Label>
          <Select id="classe-niveau" name="niveauId" defaultValue="" required>
            <option value="" disabled>
              Choisir…
            </option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}
              </option>
            ))}
          </Select>
          <FieldError messages={err.niveauId} />
        </div>
        <div>
          <Label htmlFor="classe-effectif">Effectif</Label>
          <Input id="classe-effectif" name="effectif" type="number" min={0} defaultValue={50} />
        </div>
        <div>
          <Label htmlFor="classe-vacation">Vacation</Label>
          <Select id="classe-vacation" name="regimeVacation" defaultValue="simple">
            <option value="simple">Simple</option>
            <option value="double">Double</option>
          </Select>
        </div>
      </div>
      <SubmitButton className="w-auto px-6">Ajouter la classe</SubmitButton>
    </form>
  );
}
