"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { creerCoursDepuisFichier } from "../../import-cours-actions";

const OK_EXT = [".docx", ".txt", ".md", ".markdown"];

export function UploaderCours() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const [etape, setEtape] = useState<"idle" | "extract" | "generate">("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const occupe = etape !== "idle" || pending;

  const traiter = async (file: File) => {
    setErreur(null);
    const nom = file.name.toLowerCase();
    if (!OK_EXT.some((e) => nom.endsWith(e))) { setErreur("Format non supporté. Déposez un fichier .docx, .txt ou .md."); return; }
    if (file.size > 10 * 1024 * 1024) { setErreur("Fichier trop volumineux (max 10 Mo)."); return; }

    let texte = "";
    try {
      setEtape("extract");
      if (nom.endsWith(".docx")) {
        const mod = await import("mammoth/mammoth.browser");
        const extractRawText = mod.extractRawText ?? mod.default.extractRawText;
        const { value } = await extractRawText({ arrayBuffer: await file.arrayBuffer() });
        texte = value;
      } else {
        texte = await file.text();
      }
    } catch {
      setErreur("Impossible de lire le fichier."); setEtape("idle"); return;
    }
    if (texte.trim().length < 40) { setErreur("Le fichier semble vide ou trop court à structurer."); setEtape("idle"); return; }

    setEtape("generate");
    start(async () => {
      const r = await creerCoursDepuisFichier(texte, file.name);
      if (r.ok && r.coursId) {
        router.push(`/app/aide-formation/gestion/cours/${r.coursId}`);
      } else {
        setErreur(r.message); setEtape("idle");
      }
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setSurvol(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void traiter(f);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (!occupe) inputRef.current?.click(); }}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !occupe) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); if (!occupe) setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { if (!occupe) onDrop(e); }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
          survol ? "border-forest-400 bg-forest-50" : "border-cream-300 bg-cream-50 hover:border-forest-300",
          occupe && "cursor-wait opacity-70",
        )}
      >
        {occupe ? (
          <>
            <Loader2 size={28} className="animate-spin text-forest-600" />
            <p className="text-sm font-semibold text-forest-900">{etape === "extract" ? "Lecture du fichier…" : "Structuration du cours…"}</p>
            <p className="text-xs text-ink-700/55">Cela peut prendre quelques instants.</p>
          </>
        ) : (
          <>
            <FileUp size={30} className="text-forest-600" />
            <p className="text-sm font-semibold text-forest-900">Glissez-déposez un fichier de cours, ou cliquez pour parcourir</p>
            <p className="text-xs text-ink-700/55">.docx, .txt ou .md — max 10 Mo</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.txt,.md,.markdown"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void traiter(f); e.target.value = ""; }}
      />
      {erreur && <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"><AlertCircle size={15} /> {erreur}</p>}
    </div>
  );
}
