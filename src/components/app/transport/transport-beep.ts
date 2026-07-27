/* ============================================================================
   Alerte sonore « bip-bip-bip » du module Transport (Web Audio API).

   Les navigateurs bloquent l'audio tant qu'il n'y a pas eu d'interaction
   utilisateur : appelez `unlockAudio()` dans un gestionnaire de clic (bouton
   « Activer »), puis `playTripleBeep()` librement (y compris sur minuterie).
   ========================================================================== */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** À appeler dans un gestionnaire de clic pour débloquer l'audio. */
export function unlockAudio(): void {
  getCtx();
}

function beepOnce(c: AudioContext, at: number, freq = 880, dur = 0.14): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** « bip-bip-bip » : trois bips rapprochés. */
export function playTripleBeep(): void {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  beepOnce(c, t);
  beepOnce(c, t + 0.2);
  beepOnce(c, t + 0.4);
}
