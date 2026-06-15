// Shared "weekly" stats computation.
//
// The Weekly Recap modal and the shareable stats card both describe
// themselves as a weekly summary, so they must always agree on the
// numbers. This module is the single source of truth.
//
// Two shapes of `daily` are supported:
//  - Rolling 7-day window from GET /api/sessions/me (`daily`): entries
//    have no `label`, oldest-first ending today. Used as a fallback.
//  - Calendar week (Mon-Sun) from GET /api/sessions/last-week (`daily`):
//    entries already have `label` (Mon..Sun). Preferred for the Monday
//    recap.

/**
 * Returns short day label (e.g. "Mon", "Pzt") for a given Date
 * using the browser's locale — no hardcoded strings needed.
 */
function getDayLabel(date, locale) {
  return new Intl.DateTimeFormat(locale || undefined, { weekday: 'short' }).format(date);
}

/**
 * Format minutes into a human-readable focus time string.
 * @param {number} minutes
 * @param {(key: string) => string} [t] - optional translation function
 * < 60 min  → "45 min" / "45 dk"
 * >= 60 min → "1.5 hr" / "1.5 sa"
 */
export function formatFocusTime(minutes, t) {
  const min = t ? t('unit_min') : 'min';
  const hr  = t ? t('unit_hr')  : 'hr';
  if (minutes < 60) return `${minutes} ${min}`;
  return `${(minutes / 60).toFixed(1)} ${hr}`;
}

/**
 * @param {Array<{sessions?: number, total_seconds?: number, label?: string}>} daily
 * @param {number} tasksCompleted
 *   Number of tasks completed during this period (DB-backed).
 * @param {number} currentStreak
 * @param {{ isPastWeek?: boolean }} [opts]
 * @returns {{
 *   totalMinutes: number,
 *   totalSessions: number,
 *   activeDays: number,
 *   bestDayMinutes: number,
 *   tasksCompleted: number,
 *   totalHours: string,
 *   chartDays: Array<{label: string, minutes: number, isToday: boolean}>,
 *   currentStreak: number,
 * }}
 */
export function computeWeeklyStats(daily = [], tasksCompleted = 0, currentStreak = 0, opts = {}) {
  const { locale, t } = opts;
  const days = Array.from({ length: 7 }, (_, i) => daily[i] || { sessions: 0, total_seconds: 0 });
  const hasLabels = days.every(d => d.label);

  const totalSeconds = days.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalSessions = days.reduce((sum, d) => sum + (d.sessions || 0), 0);
  const activeDays = days.filter(d => (d.sessions || 0) > 0).length;
  const bestDayMinutes = Math.round(Math.max(0, ...days.map(d => d.total_seconds || 0)) / 60);

  const today = new Date();
  const chartDays = days.map((d, i) => {
    let label = d.label;
    let isToday = false;
    if (!label) {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - i));
      label = getDayLabel(date, locale);
      isToday = i === 6;
    }
    return {
      label,
      isToday: !opts.isPastWeek && isToday,
      sessions: d.sessions || 0,
      minutes: Math.round((d.total_seconds || 0) / 60),
    };
  });

  return {
    totalMinutes,
    totalSessions,
    activeDays,
    bestDayMinutes,
    tasksCompleted,
    totalHours: formatFocusTime(totalMinutes, t),
    chartDays,
    currentStreak,
  };
}