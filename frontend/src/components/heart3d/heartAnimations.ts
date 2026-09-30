/**
 * Visualization-only pulse timing.
 * Driven by ECG-derived HR or R-peak events — never invents medical values.
 */

export function pulseIntervalFromHr(heartRateBpm: number | null): number | null {
  if (heartRateBpm == null || !Number.isFinite(heartRateBpm) || heartRateBpm <= 0) {
    return null;
  }
  return 60 / heartRateBpm;
}

/** Soft physiological-style envelope; amplitude is visual emphasis only. */
export function pulseScale(
  timeSeconds: number,
  intervalSeconds: number | null,
  amplitude: number,
  paused: boolean,
  rPeakBoost = 0,
): number {
  if (paused || amplitude <= 0) return 1 + rPeakBoost * 0.04;
  if (intervalSeconds == null) {
    // Slow neutral idle when no HR — not claimed as myocardial contraction.
    const idle = Math.sin(timeSeconds * 0.6) * 0.008;
    return 1 + idle + rPeakBoost * 0.04;
  }
  const phase = (timeSeconds % intervalSeconds) / intervalSeconds;
  // Asymmetric beat: quick systole-like rise, slower diastole-like fall.
  const envelope = phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) : Math.exp(-(phase - 0.12) * 8) * 0.35;
  return 1 + amplitude * envelope + rPeakBoost * 0.05;
}

/** Decay of an R-peak triggered visual boost (0–1). */
export function rPeakBoostDecay(nowMs: number, lastPeakMs: number | null, durationMs = 180): number {
  if (lastPeakMs == null) return 0;
  const t = (nowMs - lastPeakMs) / durationMs;
  if (t < 0 || t > 1) return 0;
  return Math.sin((1 - t) * Math.PI);
}
