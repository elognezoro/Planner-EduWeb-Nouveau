"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Info, CheckCircle2, AlertTriangle, KeyRound, CheckCheck } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import {
  chargerNotifications,
  marquerLue,
  marquerToutesLues,
  type NotificationItem,
} from "@/lib/notifications/actions";

const ICONES = {
  info: { Icone: Info, classe: "text-forest-600" },
  succes: { Icone: CheckCircle2, classe: "text-forest-600" },
  alerte: { Icone: AlertTriangle, classe: "text-gold-600" },
  role: { Icone: KeyRound, classe: "text-gold-600" },
} as const;

function tempsRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(iso));
}

export function ClocheNotifications({
  notificationsInitiales,
  nonLuesInitiales,
  variante = "menu",
}: {
  notificationsInitiales: NotificationItem[];
  nonLuesInitiales: number;
  /** « menu » = panneau ancré (ordinateur, comportement historique) ; « feuille » = feuille
   *  montante du téléphone. Le contenu est le même : seule l'enveloppe change. */
  variante?: "menu" | "feuille";
}) {
  const [ouvert, setOuvert] = useState(false);
  const [notifs, setNotifs] = useState(notificationsInitiales);
  const [nonLues, setNonLues] = useState(nonLuesInitiales);
  const [, start] = useTransition();
  const router = useRouter();

  async function rafraichir() {
    const data = await chargerNotifications();
    setNotifs(data.notifications);
    setNonLues(data.nombreNonLues);
  }

  function ouvrir() {
    const prochain = !ouvert;
    setOuvert(prochain);
    if (prochain) void rafraichir();
  }

  function ouvrirNotif(n: NotificationItem) {
    setOuvert(false);
    if (!n.lu) {
      setNotifs((s) => s.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
      setNonLues((c) => Math.max(0, c - 1));
      start(async () => {
        await marquerLue(n.id);
        router.refresh();
      });
    }
    if (n.lien) router.push(n.lien);
  }

  function toutMarquer() {
    setNotifs((s) => s.map((x) => ({ ...x, lu: true })));
    setNonLues(0);
    start(async () => {
      await marquerToutesLues();
      router.refresh();
    });
  }

  const contenu = (
    <>
      <div className={`flex items-center justify-between border-b border-cream-200 px-4 py-3 ${variante === "feuille" ? "justify-end" : ""}`}>
        {variante === "menu" && <p className="text-sm font-semibold text-forest-900">Notifications</p>}
        {nonLues > 0 && (
          <button
            onClick={toutMarquer}
            className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:text-forest-900"
          >
            <CheckCheck size={13} /> Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="max-h-[24rem] overflow-y-auto max-lg:max-h-none max-lg:overflow-visible">
        {notifs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-700/55">
            Aucune notification pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {notifs.map((n) => {
              const { Icone, classe } = ICONES[n.type];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => ouvrirNotif(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50 ${
                      n.lu ? "" : "bg-forest-50/40"
                    }`}
                  >
                    <Icone size={17} className={`mt-0.5 shrink-0 ${classe}`} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-forest-900">
                        <span className="truncate">{n.titre}</span>
                        {!n.lu && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-700/70">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[0.65rem] text-ink-700/45">
                        {tempsRelatif(n.creeLe)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link
        href="/app/vie-scolaire/notifications"
        onClick={() => setOuvert(false)}
        className="block border-t border-cream-200 px-4 py-2.5 text-center text-xs font-semibold text-forest-700 hover:bg-forest-50"
      >
        Voir toutes les notifications
      </Link>
    </>
  );

  if (variante === "feuille") {
    return (
      <>
        <button
          onClick={ouvrir}
          aria-haspopup="dialog"
          aria-expanded={ouvert}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-forest-800"
          aria-label={`Notifications${nonLues > 0 ? ` (${nonLues} non lues)` : ""}`}
        >
          <Bell size={20} />
          {nonLues > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
              {nonLues > 9 ? "9+" : nonLues}
            </span>
          )}
        </button>
        <FeuilleBas ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Notifications">
          <div className="overflow-hidden rounded-2xl bg-white">{contenu}</div>
        </FeuilleBas>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={ouvrir}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-800 transition-colors hover:bg-forest-50"
        aria-label={`Notifications${nonLues > 0 ? ` (${nonLues} non lues)` : ""}`}
      >
        <Bell size={19} />
        {nonLues > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      <AnimatePresence>
        {ouvert && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOuvert(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft"
            >
              <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
                <p className="text-sm font-semibold text-forest-900">Notifications</p>
                {nonLues > 0 && (
                  <button
                    onClick={toutMarquer}
                    className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:text-forest-900"
                  >
                    <CheckCheck size={13} /> Tout marquer comme lu
                  </button>
                )}
              </div>

              <div className="max-h-[24rem] overflow-y-auto max-lg:max-h-none max-lg:overflow-visible">
                {notifs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-ink-700/55">
                    Aucune notification pour le moment.
                  </p>
                ) : (
                  <ul className="divide-y divide-cream-100">
                    {notifs.map((n) => {
                      const { Icone, classe } = ICONES[n.type];
                      return (
                        <li key={n.id}>
                          <button
                            onClick={() => ouvrirNotif(n)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50 ${
                              n.lu ? "" : "bg-forest-50/40"
                            }`}
                          >
                            <Icone size={17} className={`mt-0.5 shrink-0 ${classe}`} />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 text-sm font-semibold text-forest-900">
                                <span className="truncate">{n.titre}</span>
                                {!n.lu && (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                                )}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-ink-700/70">
                                {n.message}
                              </p>
                              <p className="mt-1 text-[0.65rem] text-ink-700/45">
                                {tempsRelatif(n.creeLe)}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Link
                href="/app/vie-scolaire/notifications"
                onClick={() => setOuvert(false)}
                className="block border-t border-cream-200 px-4 py-2.5 text-center text-xs font-semibold text-forest-700 hover:bg-forest-50"
              >
                Voir toutes les notifications
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
